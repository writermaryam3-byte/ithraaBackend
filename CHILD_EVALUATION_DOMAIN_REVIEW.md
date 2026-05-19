# Child & Evaluation Domain Architecture Review

Focused review of child management, parent-child ownership, institutional/private child behavior, evaluation attempts, private retake/extra workflows, payments, approval, and transaction safety.

Reviewed files:

- `src/children/entities/child.entity.ts`
- `src/children/entities/child-private-attempt.entity.ts`
- `src/children/private-child-attempts.service.ts`
- `src/children/children.service.ts`
- `src/evaluations/entities/evaluation-attempt.entity.ts`
- `src/evaluations/entities/evaluation-answer.entity.ts`
- `src/evaluations/entities/evaluation-approval.entity.ts`
- `src/evaluations/evaluations.service.ts`
- `src/evaluations/evaluations-scoring-services.service.ts`
- `src/payments/payments.service.ts`
- `src/payments/entities/payment.entity.ts`

## 1. Current Architecture

The current domain architecture is a transactional CRUD-service architecture with several workflow concepts encoded directly in TypeORM entities and service conditionals.

At runtime the main objects are:

```text
User(parent) ─┐
              ├── Child
User(creator) ┘      ├── organization == null => private child
                     ├── organization != null => institutional child
                     ├── attemptsUsed
                     ├── retakeUsed
                     └── ChildPrivateAttempt[]    private entitlement ledger

Evaluation ─── EvaluationAttempt ─── EvaluationAnswer
                      └── EvaluationApproval

Payment ── payment.success event ──> ChildPrivateAttempt unlock
```

The intended flows are:

```text
Institutional child
  parent starts evaluation
  -> EvaluationAttempt(IN_PROGRESS)
  -> save/submit
  -> EvaluationAttempt(SUBMITTED)
  -> admin approve
  -> EvaluationAttempt(APPROVED)
  -> organization owner reports

Private child
  parent opens slot in ChildPrivateAttempt
  -> parent starts evaluation
  -> EvaluationAttempt linked to slot
  -> submit marks slot completed and mutates Child counters
  -> retake/extra availability inferred from Child counters + slot state

Paid extra
  request extra slot
  -> admin approves request
  -> payment created
  -> webhook/payment success
  -> slot unlocked
  -> parent starts attempt
```

High-level verdict:

- The domain model works for a prototype but is not clean enough for production scale.
- `Child` is overloaded as both child profile and private-attempt quota aggregate.
- `ChildPrivateAttempt` is not merely an attempt; it is an entitlement/request/payment gate/state machine.
- `EvaluationAttempt` is the real assessment attempt, but it does not own all attempt lifecycle policy.
- `EvaluationsService` and `PrivateChildAttemptsService` are god services for workflow orchestration.
- There are real duplicated-state and concurrency risks.

## 2. Domain Modeling Review

### One `Child` Entity for Private and Institutional Children

Using a single `Child` entity is acceptable, but the current modeling relies on nullable structure instead of explicit type:

```ts
@ManyToOne(() => Organization, { nullable: true, onDelete: 'CASCADE' })
@JoinColumn({ name: 'organizationId' })
organization: Organization | null;
```

Current semantic rule:

```text
organization == null  => private child
organization != null  => institutional child
```

This is fragile because a missing organization is both a valid business state and a possible data integrity problem. The model makes important workflow behavior depend on absence of a relation.

Recommendation:

Add an explicit discriminator:

```ts
export enum ChildType {
  PRIVATE = 'PRIVATE',
  INSTITUTIONAL = 'INSTITUTIONAL',
}

@Column({ type: 'enum', enum: ChildType })
type: ChildType;

@Column({ type: 'uuid', nullable: true })
organizationId: string | null;
```

Then enforce invariants:

```text
PRIVATE:
  organizationId must be null
  classId must be null unless private classes become a feature

INSTITUTIONAL:
  organizationId must be not null
  classId may be null or must belong to organization
```

This does not require TypeORM inheritance. Inheritance would be too heavy here because private/institutional children share most profile data. A simple `ChildType` discriminator plus check constraints/policies is enough.

### Parent and User Relationships

`Child` has both `user` and `parent`:

```ts
@ManyToOne(() => User, (user) => user.children, { onDelete: 'CASCADE' })
@JoinColumn({ name: 'userId' })
user: User;

@ManyToOne(() => User, (user) => user.children, { onDelete: 'CASCADE' })
@JoinColumn({ name: 'parentId' })
parent: User;
```

Observed meaning:

- `parent` is the legal/business owner for parent flows.
- `user` is the creator or current authenticated user that created the institutional child.

Problem:

- Both point to `user.children`, so inverse relation semantics are wrong.
- The names are ambiguous. `user` is not ownership; it is closer to `createdBy`.
- Parent ownership checks consistently use `parent`, while child listing by user uses `user`, creating two different "ownership" meanings.

Recommendation:

Rename at the domain level:

```ts
parentId: string;
parent: User;

createdById: string;
createdBy: User;
```

If institutional children are "owned" by the organization and merely associated with a parent, model that explicitly:

```text
Child
  parentId       required
  createdById    required
  organizationId nullable
  classId        nullable
```

Do not use `user` as a business term.

### Nullable Design

Current nullable fields carry too much business meaning:

- `Child.organization === null`: private child.
- `Child.class === null`: unassigned class.
- `ChildPrivateAttempt.evaluationAttemptId === null`: entitlement not consumed.
- `ChildPrivateAttempt.paymentId === null`: no payment linked yet.
- `EvaluationAttempt.expiresAt === null`: no expiration.

Nullable fields are fine for optional relationships, but they should not be the primary state machine. Right now they are mixed with enum state, so the system has two sources of truth.

Example:

```text
ChildPrivateAttempt.status = PENDING
isPaid = true
evaluationAttemptId = null
paymentId = <uuid>
```

This means "paid extra slot ready to consume" only by combining four fields. That state should be a named state.

### Does the Model Violate SRP?

Yes, mostly in `Child`.

`Child` currently represents:

- Child demographic profile.
- Institutional enrollment.
- Parent ownership.
- Creator metadata.
- Private quota counters.
- Retake eligibility.

The private quota counters do not belong on `Child`. They belong in an attempt entitlement/ledger aggregate or should be derived from attempts.

Better boundary:

```text
ChildProfileAggregate
  Child
  ChildProfile
  Organization/Class assignment

EvaluationAttemptAggregate
  EvaluationAttempt
  EvaluationAnswer
  EvaluationApproval

PrivateEvaluationEntitlementAggregate
  ChildEvaluationEntitlement / AttemptSlot
  payment link
  approval request state
```

## 3. Workflow Review

### Institutional Flow

Institutional start logic is inside `EvaluationsService.startEvaluation()`:

```text
load evaluation
load child by parent
if child has organization:
  evaluation.institutionId must equal child.organization.id
check age
lock attempts
if in-progress exists: reject
if last approved: reject
if count >= 2: reject
create EvaluationAttempt
```

This is mostly reasonable, but policy is embedded directly in a large service method. There is no reusable `AttemptPolicy`.

Design issue:

- Institutional attempt quota is counted from `EvaluationAttempt`.
- Private attempt quota is counted partly from `Child` and partly from `ChildPrivateAttempt`.
- Both flows create the same `EvaluationAttempt`, but they use different eligibility sources.

This should be unified behind an attempt eligibility interface.

### Private Main Flow

Private main slot:

```text
startMainSlot(childId, parentId)
  child must be private and owned by parent
  child.attemptsUsed must be 0
  find existing MAIN slot with evaluationAttemptId null
  create ChildPrivateAttempt(MAIN, PENDING)
```

Problem:

- `attemptsUsed` is used as authority, but the actual attempt state lives in `EvaluationAttempt`.
- The query for existing slots is not protected by a unique constraint.
- Two concurrent `startMainSlot()` calls can create duplicate main slots.

### Retake Flow

Retake:

```text
requestRetake()
  child.attemptsUsed >= 1
  child.retakeUsed == false
  create ChildPrivateAttempt(RETAKE, RETAKE)
```

Semantic problem:

- `ChildPrivateAttemptStatus.RETAKE` is not a status; it is a kind/phase label. The kind is already `ChildPrivateAttemptKind.RETAKE`.
- A retake slot should probably be `AVAILABLE`, `OPEN`, or `READY`.

Recommended enum split:

```ts
export enum AttemptSlotKind {
  MAIN = 'MAIN',
  RETAKE = 'RETAKE',
  EXTRA = 'EXTRA',
}

export enum AttemptSlotStatus {
  REQUESTED = 'REQUESTED',
  APPROVED = 'APPROVED',
  AWAITING_PAYMENT = 'AWAITING_PAYMENT',
  READY = 'READY',
  CONSUMED = 'CONSUMED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}
```

### Extra Attempt and Payment Flow

Current flow:

```text
EXTRA_REQUESTED
  -> adminApproveExtraAttempt()
  -> PENDING_PAYMENT
  -> create payment
  -> save paymentId
  -> payment.success
  -> PENDING + isPaid=true
  -> startEvaluation consumes entitlement
```

The biggest issue is transactional consistency between admin approval and payment creation.

Current order in `adminApproveExtraAttempt()`:

```text
set requiresApproval=false
set status=PENDING_PAYMENT
save
create payment through provider
set paymentId
save
notify parent
```

If provider payment creation fails after status is saved, the slot may remain `PENDING_PAYMENT` without a valid `paymentId`. The state machine has no explicit failure/recovery state for approval payment creation failure.

Better flow:

```text
transaction:
  lock extra request
  validate EXTRA_REQUESTED
  create local Payment(PENDING, providerPaymentId null)
  set slot AWAITING_PAYMENT with paymentId

outside transaction:
  create provider checkout

transaction:
  attach providerPaymentId/paymentUrl
  keep slot AWAITING_PAYMENT

on provider creation failure:
  mark Payment FAILED
  mark slot PAYMENT_CREATION_FAILED or keep APPROVED_PENDING_CHECKOUT_RETRY
```

Even better: use a payment-orchestration command/job so provider IO is not inside a request transaction.

### Approval Flow

Evaluation approval flow is clean in concept:

```text
SUBMITTED -> APPROVED
create EvaluationApproval
emit evaluation.approved
```

Good:

- Uses transaction.
- Locks attempt.
- Unique approval per attempt.

Weakness:

- Approval is admin-only but not policy-rich. There is no institutional reviewer concept, rejection, notes, or audit beyond `approvedBy`.
- Approval event is emitted inside transaction before the transaction commits. If the transaction rolls back after emit, downstream notifications may be wrong.

## 4. State Management Review

### Duplicated State

The domain currently duplicates attempt state across:

```text
Child.attemptsUsed
Child.retakeUsed
ChildPrivateAttempt.status
ChildPrivateAttempt.kind
ChildPrivateAttempt.isPaid
ChildPrivateAttempt.requiresApproval
ChildPrivateAttempt.evaluationAttemptId
EvaluationAttempt.attemptNumber
EvaluationAttempt.status
Payment.status
```

Duplication matrix:

| Business fact | Current storage |
|---|---|
| Main attempt completed | `EvaluationAttempt.status`, `ChildPrivateAttempt.status`, `Child.attemptsUsed` |
| Retake used | `EvaluationAttempt.attemptNumber`, `ChildPrivateAttempt.kind/status`, `Child.retakeUsed` |
| Extra attempt paid | `Payment.status`, `ChildPrivateAttempt.isPaid`, `ChildPrivateAttempt.status` |
| Slot consumed | `ChildPrivateAttempt.evaluationAttemptId != null`, `EvaluationAttempt` exists |
| Attempt available | Derived from `ChildPrivateAttempt.status`, `isPaid`, `evaluationAttemptId`, child counters |

This is the central domain risk.

One failed write can desynchronize the system:

- Evaluation submitted but `Child.attemptsUsed` not updated.
- Payment paid but private slot not unlocked.
- Slot linked to evaluation but attempt creation later fails.
- Child counters say retake used, but entitlement row says not completed.

### Source of Truth Problems

The source of truth should be:

- `EvaluationAttempt` for actual attempts.
- `PrivateAttemptSlot`/`ChildPrivateAttempt` for private entitlements.
- `Payment` for payment state.

`Child.attemptsUsed` and `Child.retakeUsed` should not be authoritative.

Preferred approach:

```sql
-- derive private child attempt facts
SELECT count(*)
FROM evaluation_attempts
WHERE child_id = :childId
  AND parent_id = :parentId
  AND status IN ('submitted', 'approved');
```

Or if performance requires counters, maintain them as projections with explicit rebuild capability:

```text
ChildAttemptSummary
  childId
  completedAttemptCount
  retakeConsumedAt
  lastAttemptId
  rebuiltAt
```

Then treat it as read model, not command-side authority.

### Attempt Numbering Safety

Current numbering:

```ts
const count = attempts.length;
const attemptNumber = count + 1;
```

There is a unique constraint:

```text
(evaluationId, parentId, childId, attemptNumber)
```

This prevents duplicate same-number persistence but does not guarantee good UX under concurrency. Two requests can both compute `count + 1`. One wins; the other gets a database unique error unless caught.

Better:

- Lock a parent-child-evaluation aggregate row.
- Or lock the child row plus attempts for this evaluation.
- Or use a database advisory lock on `(evaluationId, parentId, childId)`.
- Catch unique violations and return a domain error.

Example:

```ts
await manager.query(
  'SELECT pg_advisory_xact_lock(hashtext($1))',
  [`evaluation_attempt:${evaluationId}:${parentId}:${childId}`],
);
```

Then count/create inside the same transaction.

## 5. Transaction Safety Review

### Pessimistic Locks

Good use:

- `submitAttempt()` locks the attempt row before final submission.
- `approveAttempt()` locks attempt and approval row.
- `maybeAutoSubmitIfExpired()` locks attempt.
- `findEntitlementForNext()` locks entitlement.
- `markPrivateAttemptCompleted()` locks entitlement and child.
- `PaymentsService.runProcessPaymentWebhookJob()` locks payment row.

But locks are only useful if they cover the aggregate invariants. Several invariants span rows that are not locked together.

### Double Slot Creation

`startMainSlot()`, `requestRetake()`, and `requestExtraAttempt()` check for existing slots, then create. These operations are not wrapped in a transaction and do not use unique constraints.

Race:

```text
Request A: find no MAIN slot
Request B: find no MAIN slot
Request A: insert MAIN
Request B: insert MAIN
```

Recommended constraints:

```sql
-- one unconsumed main slot per child
CREATE UNIQUE INDEX uq_private_main_unconsumed
ON child_private_attempts(child_id, parent_id, kind)
WHERE kind = 'MAIN' AND evaluation_attempt_id IS NULL AND status <> 'COMPLETED';

-- one active retake slot per child
CREATE UNIQUE INDEX uq_private_retake_active
ON child_private_attempts(child_id, parent_id, kind)
WHERE kind = 'RETAKE' AND evaluation_attempt_id IS NULL AND status <> 'COMPLETED';

-- one extra request/payment/ready slot at a time
CREATE UNIQUE INDEX uq_private_extra_active
ON child_private_attempts(child_id, parent_id, kind)
WHERE kind = 'EXTRA'
  AND status IN ('EXTRA_REQUESTED', 'PENDING_PAYMENT', 'PENDING');
```

Names/statuses should be adapted after enum cleanup.

### Double Start Evaluation

For private children:

```text
find entitlement with lock
create EvaluationAttempt
link entitlement to attempt
```

This is conceptually good. The missing piece is aggregate-level lock before attempt count and entitlement selection. A concurrent flow can still race around attempt number generation or consume multiple duplicate entitlement rows if duplicates already exist.

### Submit vs Auto-submit

`saveProgress()` calls `maybeAutoSubmitIfExpired()` before saving. `submitAttempt()` itself computes `expired` but still allows a direct submit after expiry, marking `autoSubmitted: expired` even though user explicitly submitted.

This is semantically odd:

- Direct submit after expiry does not reject.
- It emits `autoSubmitted: true`.
- That may be acceptable, but the name is misleading.

Recommended distinction:

```text
submittedBy = PARENT | SYSTEM
submittedReason = MANUAL | EXPIRED
```

### Payment Success Handling

Current payment success listener:

```text
if privateAttemptId exists:
  lock ChildPrivateAttempt
  if status == PENDING_PAYMENT:
    status = PENDING
    isPaid = true
    paymentId = payload.paymentId
```

Good:

- Idempotent enough for repeated success events.
- Locks entitlement row.

Risk:

- It does not verify that the payment id matches the slot's existing `paymentId` if one was already set.
- It trusts metadata from payment event.
- It does not handle `payment.failed` to update slot state.

Improve:

```ts
if (row.paymentId && row.paymentId !== payload.paymentId) {
  throw new DomainInvariantError('Payment does not match private attempt');
}
```

Also add failure handling:

```text
PENDING_PAYMENT + payment.failed -> PAYMENT_FAILED or AWAITING_PAYMENT_RETRY
PENDING_PAYMENT + payment.expired -> PAYMENT_EXPIRED
```

### Event Emission Inside Transactions

`EvaluationsService.submitAttempt()` and `approveAttempt()` emit domain events inside transaction callbacks. If the transaction later fails, listeners can enqueue notifications for changes that did not commit.

Use after-commit semantics. In Nest/TypeORM this can be implemented by:

- returning event payload from transaction and emitting after it resolves;
- or implementing an outbox table.

Example:

```ts
let event: EvaluationSubmittedPayload | null = null;

const result = await this.dataSource.transaction(async (manager) => {
  // mutate
  event = { ... };
  return savedAttempt;
});

if (event) this.events.emit(EVALUATION_EVENTS.submitted, event);
return result;
```

## 6. Scalability Review

The workflow will struggle as volume grows because command-side services do too much synchronous orchestration.

Scalability concerns:

- Attempt eligibility reads all attempts for `(evaluationId, parentId, childId)` and counts in application code.
- Owner reports aggregate attempts and dimensions in application memory.
- Private slot state is updated synchronously inside user requests and webhook listeners.
- Payment retry mutates the existing payment row, losing a clean history of checkout attempts.
- Notifications are queued, which is good, but event enqueue is not transactionally safe.

Workflow scalability requires:

- A command-side aggregate lock/key for attempt start.
- A clear entitlement ledger with unique active constraints.
- Read models for owner reporting.
- Outbox for events crossing transaction boundaries.
- Separate payment attempts/history if provider retry/audit matters.

## 7. Technical Debt

Major debt:

- `Child.organization == null` is a hidden discriminator.
- `Child.user` vs `Child.parent` semantics are unclear.
- `Child.attemptsUsed` and `retakeUsed` are command-side duplicated state.
- `ChildPrivateAttemptStatus.RETAKE` mixes kind with status.
- `ChildPrivateAttemptStatus.PENDING` means different things for main and paid extra.
- `requiresApproval` duplicates `status = EXTRA_REQUESTED`.
- `isPaid` duplicates `Payment.status = PAID`.
- `evaluationAttemptId` nullability duplicates consumed/unconsumed status.
- `EvaluationsService` owns catalog, forms, availability, attempt lifecycle, submission, approval, expiration, scoring orchestration, and access policy.
- `PrivateChildAttemptsService` owns entitlement policy, admin approval, payment creation, payment success listener, child counter mutation, and notifications.

This is not just style debt; it directly creates correctness risk.

## 8. High-Risk Issues

### HIGH: Duplicate Private Slots

No DB constraint prevents duplicate main/retake/extra active private entitlements. Service checks are non-transactional.

Impact:

- Parents may consume extra free attempts.
- Attempt numbering/counters diverge.
- Paid attempts may be duplicated or incorrectly blocked.

### HIGH: Counter Desynchronization

`Child.attemptsUsed` and `Child.retakeUsed` are updated only after private attempt submission. If any failure occurs after `EvaluationAttempt` submit but before child save, eligibility breaks.

Impact:

- Retake may be blocked or allowed incorrectly.
- Extra attempt may be requested before/after it should.

### HIGH: Payment Approval Partial Failure

Admin extra approval changes slot to `PENDING_PAYMENT` before checkout creation completes.

Impact:

- Slot can be stranded.
- Parent cannot proceed or retry cleanly if `paymentId` is absent.

### HIGH: Transactional Event Inconsistency

Events emitted inside transactions can produce notifications for rolled-back data.

Impact:

- Parent sees false submitted/approved notifications.
- Future side effects may become worse than notifications.

### MEDIUM: Attempt Number Race

Unique constraint protects persistence, but service does not catch/retry domain conflict.

Impact:

- Concurrency can surface raw database errors or create inconsistent slot linkage if duplicate entitlements exist.

### MEDIUM: Approval Model Too Narrow

Only `APPROVED` is supported. No rejection, revision, reviewer notes, reviewer scope, or audit trail beyond one row.

Impact:

- Real-world review workflows will force ad hoc state additions later.

### MEDIUM: Private/Institutional Policies Are Intermixed

`startEvaluation()` branches on child private/institutional mode inside a large service.

Impact:

- New attempt policies, organization-specific quotas, paid institutional retakes, or admin overrides will be hard to add safely.

## 9. Recommended Refactor Plan

### Phase 1: Stabilize Invariants

Add explicit domain type and constraints.

```ts
export enum ChildType {
  PRIVATE = 'PRIVATE',
  INSTITUTIONAL = 'INSTITUTIONAL',
}
```

Migration strategy:

```sql
ALTER TABLE children ADD COLUMN type varchar(30);

UPDATE children
SET type = CASE
  WHEN "organizationId" IS NULL THEN 'PRIVATE'
  ELSE 'INSTITUTIONAL'
END;

ALTER TABLE children ALTER COLUMN type SET NOT NULL;
```

Add active entitlement unique constraints after cleaning duplicate data.

Add scalar FK columns explicitly where needed:

```ts
@Column({ type: 'uuid', nullable: true })
organizationId: string | null;

@Column({ type: 'uuid' })
parentId: string;
```

### Phase 2: Remove Child Counters From Command Authority

Stop using:

```ts
child.attemptsUsed
child.retakeUsed
```

for eligibility.

Replace with a query/domain service:

```ts
class PrivateAttemptUsageService {
  async getUsage(childId: string, parentId: string): Promise<PrivateAttemptUsage> {
    const attempts = await this.attemptRepo.find({
      where: { childId, parentId },
      order: { attemptNumber: 'ASC' },
    });

    return PrivateAttemptUsage.fromAttempts(attempts);
  }
}
```

Keep counters temporarily as read model only. Rebuild them from attempts during migration and remove later.

### Phase 3: Introduce State Machine for Private Attempt Slots

Rename `ChildPrivateAttempt` to a clearer concept:

```text
PrivateEvaluationSlot
PrivateAttemptEntitlement
EvaluationAttemptEntitlement
```

Suggested entity:

```ts
export enum PrivateSlotKind {
  MAIN = 'MAIN',
  RETAKE = 'RETAKE',
  EXTRA = 'EXTRA',
}

export enum PrivateSlotStatus {
  READY = 'READY',
  REQUESTED = 'REQUESTED',
  APPROVED = 'APPROVED',
  AWAITING_PAYMENT = 'AWAITING_PAYMENT',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  CONSUMED = 'CONSUMED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}
```

Transition examples:

```text
MAIN:   READY -> CONSUMED -> COMPLETED
RETAKE: READY -> CONSUMED -> COMPLETED
EXTRA:  REQUESTED -> APPROVED -> AWAITING_PAYMENT -> READY -> CONSUMED -> COMPLETED
EXTRA:  AWAITING_PAYMENT -> PAYMENT_FAILED -> AWAITING_PAYMENT
```

### Phase 4: Split Services

Break `EvaluationsService` into:

```text
EvaluationCatalogService
  create evaluation
  get form
  get admin details
  get available evaluations

EvaluationAttemptService
  start attempt
  get attempt
  list attempts

EvaluationSubmissionService
  save progress
  submit
  auto-submit expired

EvaluationApprovalService
  approve/reject

EvaluationScoringService
  calculate result

EvaluationAccessPolicy
  parent/admin/owner/teacher access checks
```

Break `PrivateChildAttemptsService` into:

```text
PrivateAttemptSlotService
  create/request slots
  consume slots
  complete slots

PrivateAttemptPolicy
  canOpenMain
  canRequestRetake
  canRequestExtra

PrivateExtraPaymentWorkflow
  approve extra request
  create/retry checkout
  handle payment success/failure
```

### Phase 5: Introduce Workflow Commands

Use explicit command handlers:

```ts
class StartEvaluationAttemptCommand {
  evaluationId: string;
  childId: string;
  parentId: string;
  expiresAt?: Date;
}

class StartEvaluationAttemptHandler {
  async execute(cmd: StartEvaluationAttemptCommand) {
    return this.tx.run(async (manager) => {
      await this.lockAttemptAggregate(manager, cmd);
      const child = await this.children.getForParent(manager, cmd.childId, cmd.parentId);
      const evaluation = await this.catalog.get(manager, cmd.evaluationId);
      await this.policy.assertCanStart(manager, child, evaluation, cmd.parentId);
      return this.attempts.create(manager, child, evaluation, cmd);
    });
  }
}
```

This keeps orchestration explicit and policies testable.

## 10. Suggested Final Architecture

Target domain architecture:

```text
Child Context
  Child
  ChildEnrollment
  ParentChildOwnershipPolicy

Evaluation Context
  Evaluation
  EvaluationAttempt
  EvaluationAttemptAnswer
  EvaluationResult
  EvaluationApproval
  EvaluationAttemptLifecycleService
  EvaluationScoringService

Private Attempt Context
  PrivateEvaluationSlot
  PrivateSlotStateMachine
  PrivateAttemptEligibilityPolicy

Payment Context
  Payment
  PaymentAttempt / CheckoutSession
  PaymentProvider
  PaymentWebhookProcessor

Integration Layer
  Domain events
  Outbox
  Bull processors
```

Recommended aggregate boundaries:

```text
Child aggregate:
  owns child identity and enrollment only
  does not own evaluation attempt counters

EvaluationAttempt aggregate:
  owns answer/save/submit/approve lifecycle
  references childId/parentId/evaluationId

PrivateEvaluationSlot aggregate:
  owns private entitlement state
  references childId/parentId/paymentId/evaluationAttemptId

Payment aggregate:
  owns payment provider lifecycle
  emits paid/failed events
```

Final start attempt flow:

```text
StartEvaluationAttemptHandler
  begin transaction
    lock aggregate key evaluationId+childId+parentId
    load child + evaluation
    EvaluationAccessPolicy.assertParentOwnsChild()
    EvaluationEligibilityPolicy.assertAgeAndInstitution()
    AttemptQuotaPolicy.assertCanStart()
    if private:
      slot = PrivateSlotService.consumeNextSlot()
    attempt = EvaluationAttemptRepository.createNext()
    if private:
      slot.linkAttempt(attempt.id)
  commit
  emit AttemptStarted after commit
```

Final submit flow:

```text
SubmitEvaluationAttemptHandler
  begin transaction
    lock attempt
    assert parent owns attempt
    assert attempt is IN_PROGRESS
    upsert answers
    score
    attempt.submit(result)
    if private:
      slot.completeForAttempt(attempt.id)
  commit
  emit EvaluationSubmitted after commit
```

Final paid extra flow:

```text
ApproveExtraAttemptHandler
  begin transaction
    lock slot
    slot.approve()
    payment = Payment.createPending(...)
    slot.awaitPayment(payment.id)
  commit
  enqueue CreateCheckoutSession(payment.id)

PaymentWebhookProcessor
  verify provider
  begin transaction
    lock payment
    payment.markPaid()
  commit
  emit PaymentSucceeded after commit

PrivateSlotPaymentListener
  begin transaction
    lock slot by paymentId
    slot.markReady()
  commit
```

This architecture makes each source of truth explicit:

- Child identity/enrollment lives in `Child`.
- Attempt lifecycle lives in `EvaluationAttempt`.
- Private eligibility lives in `PrivateEvaluationSlot`.
- Payment lifecycle lives in `Payment`.
- Notifications are side effects after committed domain changes.

Final judgment:

The current implementation contains the right raw ingredients, but the aggregate boundaries are blurred. It is service-heavy, condition-heavy, and state is duplicated in ways that will fail under concurrency or operational recovery. Before scale, the highest-value work is not adding more endpoints; it is stabilizing invariants, introducing explicit child type and private slot state, removing command authority from child counters, and splitting the workflow services around state-machine/policy boundaries.

