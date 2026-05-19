# AI Project Context

Authoritative architecture notes for future AI agents working on this NestJS backend. This file was reverse engineered from `src` on 2026-05-19. Treat it as a map, not a replacement for tests when changing risky flows.

## 1. Project Overview

Ithraa backend is a NestJS + TypeORM API for managing children, parents, organizations, classes, evaluations, payments, notifications, and service-provider deals. The main business domain is educational/talent evaluation for children, with two operating modes:

- Institutional mode: an organization owner/teacher creates or manages children attached to an organization/class. Parents submit evaluations assigned to their children. Admin approves submitted results. Organization owners view class-level reports.
- Private-parent mode: a parent creates private children outside any organization, opens limited free evaluation slots, requests retakes, and can request paid extra attempts after admin approval and payment.

Main actors:

- `ADMIN`: creates evaluations, seeds roles, lists/approves attempts, approves paid extra-attempt requests, manages activities/tests.
- `ORGANIZATIONOWNER`: owns exactly one `Organization`, creates teachers/classes/grades/children, sees organization reports, creates deals.
- `TEACHER`: belongs to an organization and can access some organization child/deal flows.
- `PARENT`: owns children through `Child.parent`; starts/saves/submits evaluation attempts; manages private children.
- `ENRICHER`: service provider; receives deal notifications and submits/updates proposals.
- `EMPLOYEE`: appears in roles and some route permissions, but concrete employee entity/workflow is not implemented.

Core workflows:

1. Sign up organization owner or enricher under `/api/auth/*`.
2. Organization owner creates grades/classes/teachers and creates organization children with parent accounts.
3. Parent lists available evaluations by child age/institution and starts attempts.
4. Parent saves progress or submits; submission calculates score/result and emits events.
5. Admin approves submitted attempts; parent and owner-facing reports use approved results.
6. Private parent opens main/retake/extra evaluation slots; extra attempts require admin approval plus payment.
7. Notifications are queued through Bull and delivered in-app and/or by email.
8. Organizations create deals for activities; enrichers submit proposals.

## 2. System Architecture

High-level architecture:

```text
HTTP controllers
  -> Nest services / providers
    -> TypeORM repositories + DataSource transactions
    -> EventEmitter2 domain events
    -> Bull queues: notifications, payment-processing
    -> external providers: Resend, Moyasar
```

Bootstrap and global behavior:

- `src/main.ts` sets global prefix `/api`, enables CORS for all origins, uses `ValidationPipe` with `whitelist`, `forbidNonWhitelisted`, `transform`, and custom flattened error output.
- `src/app.module.ts` installs global `JwtAuthGuard`, global `RolesGuard`, and `ClassSerializerInterceptor`.
- Public endpoints use `@Public()` from `src/users/decorators/public.decorator.ts`.
- TypeORM uses `autoLoadEntities: true`; no migration files were found in `src`. Runtime schema currently depends on `synchronize`.
- Bull uses Redis from `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_TLS`.
- EventEmitter2 uses wildcard support with `.` delimiter.

Module responsibilities:

- `UsersModule`: users, roles, auth, signup strategies, teachers, enrichers, parents placeholders.
- `SessionModule`: refresh token sessions.
- `OrganizationsModule`: organization lookup/update helpers.
- `GradesModule` / `ClassesModule`: school structure.
- `ChildrenModule`: organization child creation, private child creation, private attempt entitlements.
- `EvaluationsModule`: evaluation definitions, attempts, scoring, admin approval, owner reports.
- `PaymentsModule`: payment creation, Moyasar integration, webhook idempotency, retries, payment events.
- `NotificationsModule`: in-app/email notification queue and evaluation event listeners.
- `DealsModule`: activities, deals, proposals for service providers.
- `TestsModule`: older/basic test/assignment/result model separate from the richer evaluation system.
- `UploadsModule`, `MailerModule`: utility modules; both have thin/direct endpoints.

Important module coupling:

- `ChildrenModule` and `ClassesModule` use `forwardRef` because class assignment calls child services and child creation validates classes.
- `ChildrenModule` and `PaymentsModule` use `forwardRef` because private extra attempts create/retry payments and payment success unlocks private attempts.
- `NotificationsModule` imports `UsersModule` with `forwardRef`; `AuthProvider` also injects `NotificationsService`, so auth and notifications are tightly coupled.
- `EvaluationsService` directly calls `PrivateChildAttemptsService`, tying evaluation attempt creation/submission to private entitlement state.

Event-driven behavior:

- Evaluation events in `src/evaluations/evaluations.events.ts`:
  - `evaluation.submitted`
  - `evaluation.approved`
  - `evaluation.limit_reached`
- Payment events in `src/payments/payments.events.ts`:
  - `payment.success`
  - `payment.failed`
- `EvaluationNotificationsListener` converts evaluation events into in-app notifications.
- `PrivateChildAttemptsService` listens to `payment.success` and unlocks paid private extra attempts.
- Payment webhooks are not processed inline; they are verified/deduplicated, queued, provider-verified, persisted, then converted into success/failure jobs/events.

## 3. Database & Entities

Most primary keys are UUIDs. Relations are mostly TypeORM entity relations with explicit `@JoinColumn` only where a specific FK column name is desired. Many entities rely on TypeORM default FK column naming when `@JoinColumn` is absent.

### Users and roles

`src/users/entities/user.entity.ts` (`users`):

- Purpose: core login/profile/account identity.
- Fields: `name`, unique `email`, unique `phone`, `password` excluded by class-transformer, email/phone verification flags.
- `roles`: `ManyToMany(Role)` with eager loading and default join table.
- `ownedOrganization`: `OneToOne(Organization.owner)` for organization owners.
- `organization`: nullable `ManyToOne(Organization.users)` for membership; `onDelete: SET NULL`.
- `enricher`, `teacher`: one-to-one profile extensions.
- `children`: `OneToMany(Child.user)` where user created/owns institutional record.
- `parentChildren`: intended `OneToMany(Child.parent)`, but `Child.parent` currently maps to `(user) => user.children`, not `parentChildren`. This is a real relationship bug.

`src/users/entities/user-roles.entity.ts` (`roles`):

- Purpose: role catalog, unique `name: UserRole`.
- Users are linked via many-to-many join table owned by `User.roles`.
- `UsersService.onModuleInit()` calls `seedRoles()`.

`src/users/entities/teacher.entity.ts` (`teachers`):

- Purpose: organization teacher profile.
- Scalar `userId`, `orgId`; `OneToOne(User)` with `@JoinColumn({ name: 'userId' })`, cascade delete; `ManyToOne(Organization)` with `@JoinColumn({ name: 'orgId' })`, cascade delete.
- `classes`: `OneToMany('Class', 'teacher')`.
- Risk: `OrganizationsService.isOrgMember()` compares `teacher.id` to `userId`, but `teacher.id` is not the `User.id`.

`src/users/entities/enricher.entity.ts` (`enrichers`):

- Purpose: service provider profile.
- `OneToOne(User)` with cascade delete; `approvalStatus` defaults `pending`.
- No implemented approval workflow beyond field existence.

### Organizations, classes, grades

`src/organizations/entities/organization.entity.ts` (`organizations`):

- Purpose: institution/owner boundary.
- Fields: `organizationName`, `organizationType`, `approvalStatus`, unique `ownerId`.
- `owner`: `OneToOne(User)` with `@JoinColumn({ name: 'ownerId' })`, cascade delete.
- `users`, `teachers`, `parents`, `grades`, `classes`: `OneToMany` collections.
- `parents` duplicates `users` over the same `User.organization` inverse relation.

`src/grades/entities/grade.entity.ts` (`grades`):

- Purpose: grade level within organization. `name` uses `GradeName` enum, currently only `grade-1`.
- `ManyToOne(Organization)` cascade delete; `OneToMany(Class)`.

`src/classes/entities/class.entity.ts` (`classes`):

- Purpose: classroom grouping.
- `ManyToOne(Grade)` cascade delete.
- nullable `ManyToOne(Teacher)` with `@JoinColumn({ name: 'teacherId' })`, `onDelete: SET NULL`.
- `ManyToOne(Organization)` with `@JoinColumn({ name: 'orgId' })`, cascade delete. Inverse incorrectly points to `org.grades` instead of `org.classes`.
- `OneToMany(Child.class)`.

### Children

`src/children/entities/child.entity.ts` (`children`):

- Purpose: child profile for either institution or private parent.
- Fields: `name`, `birthDate`, `gender`, private attempt counters `attemptsUsed`, `retakeUsed`.
- `organization`: nullable `ManyToOne(Organization)` with `@JoinColumn({ name: 'organizationId' })`, cascade delete. `null` means private child.
- `class`: nullable `ManyToOne(Class)` with `@JoinColumn({ name: 'classId' })`, cascade delete.
- `user`: `ManyToOne(User)` with `@JoinColumn({ name: 'userId' })`, cascade delete. This appears to mean creator/current user.
- `parent`: `ManyToOne(User)` with `@JoinColumn({ name: 'parentId' })`, cascade delete. This is the business owner for parent flows.
- `profile`: `OneToOne(ChildProfile)`.
- `privateAttempts`: `OneToMany(ChildPrivateAttempt)`.

`src/children/entities/child-profile.entity.ts` (`children_profiles`):

- Optional diagnosis/notes/status extension. `OneToOne(Child)` with implicit join column; no cascade delete configured.

`src/children/entities/child-private-attempt.entity.ts` (`child_private_attempts`):

- Purpose: entitlement/slot ledger for private child evaluation attempts.
- Indexed by `childId`, `parentId`, status.
- `kind`: `MAIN`, `RETAKE`, `EXTRA`.
- `status`: `PENDING`, `COMPLETED`, `RETAKE`, `EXTRA_REQUESTED`, `PENDING_PAYMENT`.
- `isPaid`, `requiresApproval`, nullable `evaluationAttemptId`, nullable `paymentId`.
- `ManyToOne(Child)` and `ManyToOne(User parent)`, both cascade delete.
- Important: this is not the same as `EvaluationAttempt`; it authorizes creation of one.

`src/children/entities/child-report.entity.ts` (`children-reports`):

- Legacy report tied to `TestAssignment`; stores JSON as text.

### Evaluations

`src/evaluations/entities/evaluation.entity.ts` (`evaluations`):

- Purpose: evaluation definition/template.
- Fields: `type`, nullable `ageFrom`/`ageTo`, `evaluatorTypes` text array, `title`, `institutionId`.
- `institutionId` is a UUID scalar with no relation to `Organization`, but business logic treats it as organization id for institutional evaluations.
- `questions`, `dimensions` cascade on save; `attempts` no cascade.

`EvaluationDimension` (`evaluation_dimensions`):

- Belongs to one evaluation via explicit `evaluation_id`.
- Unique `(evaluationId, code)`.
- Stores `minScore`, `maxScore`, optional `interpretationRules` JSONB.
- Has questions with cascade.

`EvaluationQuestion` (`evaluation_questions`):

- Belongs to evaluation and dimension via `evaluationId`, `evaluationDimensionId`.
- Has ordered answer options cascade.

`EvaluationQuestionAnswer` (`evaluation_question_answers`):

- Answer option with `text`, `scoreValue`, optional `code`, `order`.
- Belongs to question and cascades on question delete.

`EvaluationAttempt` (`evaluation_attempts`):

- Concrete parent-child-evaluation run.
- Unique `(evaluationId, parentId, childId, attemptNumber)`.
- Indexed lookup `(evaluationId, parentId, childId)`.
- `attemptNumber` is sequential (`count + 1`), not limited by DB except business logic.
- `status`: `in_progress`, `submitted`, `approved`.
- Nullable `score`, `expiresAt`, `submittedAt`, JSONB `result`.
- Answers cascade; one optional approval.

`EvaluationAnswer` (`evaluation_answers`):

- One selected answer per attempt/question, enforced by unique `(attemptId, questionId)`.
- Stores denormalized `evaluationDimensionId` and `scoreValue` at save time. This protects attempt scoring from future answer edits but duplicates state.

`EvaluationApproval` (`evaluation_approvals`):

- One-to-one approval row per attempt, unique `attemptId`.
- Fields `approvedBy`, `approvedAt`.

### Payments and notifications

`src/payments/entities/payment.entity.ts` (`payments`):

- Payment row for user/child/private attempt.
- Fields include `userId`, nullable `childId`, nullable `privateAttemptId`, `paymentUrl`, numeric string `amount`, `currency`, `status`, `provider`, nullable `providerPaymentId`, JSONB `metadata`, retry counters, `expiresAt`.
- Indexed pending expiry and provider id.
- `ManyToOne(User)` cascade delete.

`PaymentWebhookDedup` (`payment_webhook_dedup`):

- Idempotency table unique `(providerPaymentId, payloadHash)`.
- Note: same provider event with changed payload hash is accepted again; terminal status guards prevent many repeats.

`Notification` (`notifications`):

- In-app notification for a user.
- `ManyToOne(User)` cascade delete, explicit `userId`.
- Has `title`, `message`, `isRead`, `type`, nullable JSONB `metadata`.

### Deals and tests

`Activity` (`activities`): activity/service category. Cannot be deleted if deals exist.

`Deal` (`deals`): organization-created opportunity with `activity`, `organization`, `creator`, `studentsCount`, `status`, `deadline`, proposals. Activity and creator deletion is restricted; organization cascade deletes deals.

`Proposal` (`proposals`): enricher bid for a deal. Unique `(deal, provider)`, price stored as numeric string, status defaults `PENDING`.

Legacy tests:

- `Test` -> `Question` -> `Answer`
- `TestAssignment` links child/test with due date/status.
- `TestResult` stores score and submitted answers JSON.
- This system is separate from `EvaluationsModule` and appears older/less complete.

## 4. Business Workflows

### Authentication

1. Public `POST /api/auth/login` validates phone/password with `AuthProvider.validateUser()`.
2. `AuthProvider.login()` signs access token for 30 days and refresh token for 60 days, stores hashed refresh token in `sessions`, and returns user identity/roles.
3. Public `POST /api/auth/refresh` verifies token, finds a valid session by user id, compares supplied token with stored hash, deletes the old session, and issues a fresh login.
4. `DELETE /api/auth/logout/:sessionId` deletes a session; `DELETE /api/auth/logout-all` deletes all sessions for authenticated user.
5. Email verification is intended through `GET /api/auth/verify-email?token=...`.

Risk: `AuthProvider.generateVerificationToken()` signs `{ sub: userId, type: 'email_verification' }`, but `verifyEmail()` reads `payload.userId`; verification will not find the user. `MailerService` signs `{ userId }` but does not include `type`, so that token also fails `AuthProvider.verifyEmail()`.

### Signup

Organization owner:

1. Public `POST /api/auth/beneficiaries-signup`.
2. DTO is `BeneficiariesSignupDto`, effectively `OrganizationSignupDto`.
3. Transaction creates `User` with `ORGANIZATIONOWNER`.
4. `OrganizationSignupStrategy` creates `Organization` owned by user.
5. Queues welcome notification and verification email.

Enricher:

1. Public `POST /api/auth/enrichers-signup`.
2. Creates `User` with `ENRICHER`.
3. Creates `Enricher` profile with organization name and pending approval.
4. Queues welcome and verification email.

### Parent and child flows

Institutional child creation (`ChildrenService.create()`):

1. Roles allowed at controller: organization owner, parent, teacher.
2. If both `organizationId` and `classId` are provided, validates organization exists and class belongs to organization.
3. Verifies current user exists.
4. Parent input may create a new user or update/add `PARENT` role to an existing user.
5. Creates `Child` with optional organization/class, `user` as current user, `parent` as parent account.

Private parent child creation (`ParentChildrenController`):

1. Parent calls `POST /api/parent/children`.
2. Service validates caller has `PARENT`.
3. Counts private children (`parent = current user`, `organization IS NULL`).
4. Enforces max 2 private children.
5. Creates child with `organization = null`, `user = parent`, `parent = parent`, counters reset.

Organization child listing:

- `/api/children/organization/:orgId` validates `OrganizationsService.isOrgMember()`, then returns lightweight cards with class/grade and derived evaluation status from `attemptsUsed`.
- Bug: org membership check for teachers likely fails because it compares teacher profile id to user id.

### Evaluation flows

Evaluation definition:

1. Admin creates evaluation through `POST /api/evaluations`.
2. `EvaluationsService.createEvaluation()` saves evaluation, dimensions, questions, and scored answer options in one transaction.
3. Duplicate dimension codes are rejected in service and also by DB unique constraint.
4. Form endpoint strips `scoreValue`, `minScore`, `maxScore`, interpretation rules.

Available evaluations:

1. Parent calls `/api/evaluations/available/:childId`.
2. Child must belong to parent.
3. Age is computed from `birthDate`.
4. Evaluation age bounds are applied.
5. If child is institutional, `evaluation.institutionId` must match `child.organization.id`.
6. For private children, no institution filter is applied, so all age-compatible evaluations are returned. This is intentional only if private evaluations are global; otherwise it is a missing scope rule.

Attempt lifecycle:

```text
start -> IN_PROGRESS
save progress -> IN_PROGRESS
submit or auto-submit -> SUBMITTED
admin approve -> APPROVED
```

Only parents start/save/submit. Admin approves. Owner/teacher/employee can fetch only approved attempts through `getAttempt()`, but organization/class scoping is marked TODO.

### Private attempt/retake/payment flow

Main slot:

1. Parent creates private child.
2. Parent calls `POST /api/attempts/:childId/start`, which creates/reuses a `ChildPrivateAttempt` kind `MAIN`, status `PENDING`, if `child.attemptsUsed === 0`.
3. Parent starts an evaluation; `EvaluationsService.startEvaluation()` consumes matching entitlement and links it to `EvaluationAttempt`.

Retake:

1. Parent calls `POST /api/attempts/:childId/retake`.
2. Child must have at least one completed attempt and `retakeUsed === false`.
3. Creates/reuses `ChildPrivateAttempt` kind `RETAKE`, status `RETAKE`.
4. Starting the next evaluation consumes the retake entitlement.
5. On submission, `markPrivateAttemptCompleted()` sets `attemptsUsed = 2` and `retakeUsed = true`.

Extra paid attempt:

1. Parent calls `POST /api/attempts/:childId/request-extra`.
2. Requires `attemptsUsed >= 2` and `retakeUsed === true`.
3. Creates `ChildPrivateAttempt` kind `EXTRA`, status `EXTRA_REQUESTED`, `requiresApproval = true`.
4. Admin calls `POST /api/admin/attempts/:id/approve`.
5. Service changes status to `PENDING_PAYMENT`, creates payment checkout, stores `paymentId`, notifies parent.
6. Parent can refresh/retry checkout through `POST /api/payments/:attemptId/initiate`.
7. Webhook success emits `payment.success`; listener changes private attempt to `PENDING`, `isPaid = true`.
8. Starting evaluation attempt number 3+ consumes `EXTRA` entitlement where `status = PENDING` and `isPaid = true`.

### Payments

Generic payment creation:

1. Parent calls `POST /api/payments`.
2. Currency must be `SAR`.
3. Active provider must match `MoyasarProvider`.
4. Raw SQL checks child belongs to parent using `"c.parentId"` column.
5. Creates local pending payment, then provider invoice/checkout.
6. If provider creation fails, local payment becomes `FAILED`.

Webhook:

1. Public `POST /api/payments/webhook` requires raw body and `x-moyasar-signature`.
2. `MoyasarProvider.verifyWebhookSignature()` HMAC-validates raw body.
3. Payload is parsed, provider payment id extracted, payload hash saved in `payment_webhook_dedup`.
4. Bull job `PROCESS_PAYMENT_WEBHOOK` verifies payment status with provider.
5. Pending local row is locked pessimistically and moved to `PAID` or `FAILED`.
6. Follow-up jobs emit `payment.success` or `payment.failed`.

Cron:

- Every 5 minutes: expire stale pending payments.
- Every 15 minutes: optionally auto-retry failed payments unless `PAYMENT_AUTO_RETRY_ENABLED=false`.

### Notifications

1. Services call `NotificationsService.enqueue()` or `dispatch()`.
2. Payload is queued to Bull queue `notifications` as job `send`.
3. `NotificationProcessor` sends email, verification email, in-app notification, or both.
4. In-app notifications can be listed, counted, and marked read.

### Organization management

- Organization creation only exists through signup.
- `OrganizationsController.findOne()` and `remove()` still coerce UUIDs to numbers and call stub service methods. These routes are broken.
- Organization owner lookup `findByOwner()` is used by class/teacher/deal flows.
- `isOrgMember()` is central but currently flawed for teachers.

### Deals

1. Admin creates activities.
2. Organization owner or teacher creates a deal for an activity with future deadline.
3. `DealsService.resolveOrganizationId()` maps owner by owned organization or teacher by teacher profile. Although controller permits `EMPLOYEE`, service does not implement employee resolution, so employees are rejected.
4. New deal notifies all users with `ENRICHER`.
5. Enricher submits one proposal per deal before deadline.
6. Enricher can update own proposal before deadline.
7. Proposal acceptance/closing is not implemented.

## 5. Evaluation System Deep Dive

Evaluation definition is template data. `EvaluationAttempt` is the runtime state. `ChildPrivateAttempt` is a separate entitlement ledger only for private children.

State machine:

```text
EvaluationAttempt
  IN_PROGRESS --submit/auto-submit--> SUBMITTED --admin approve--> APPROVED

ChildPrivateAttempt
  MAIN:   PENDING -> linked -> COMPLETED
  RETAKE: RETAKE  -> linked -> COMPLETED
  EXTRA:  EXTRA_REQUESTED -> PENDING_PAYMENT -> PENDING -> linked -> COMPLETED
```

Attempt numbering:

- In `startEvaluation()`, attempts are loaded for `(evaluationId, parentId, childId)` ordered by `attemptNumber DESC`.
- `attemptNumber = attempts.length + 1`.
- DB uniqueness prevents duplicate same-number rows, but no retry logic catches unique violations.
- Institutional children: max 2 attempts. Retake is blocked after any last approved attempt.
- Private children: attempt count is controlled by available entitlements. This allows paid attempts beyond 2 if entitlements exist.

Scoring:

- `buildAnswerRows()` validates one answer per question, question belongs to evaluation, selected answer belongs to question.
- `EvaluationAnswer.scoreValue` and `evaluationDimensionId` are copied from the selected answer/question.
- `EvaluationScoringService.calculate()` dispatches by `EvaluationType`.
- Default/multiple intelligences/Torrance: sums by dimensions, calculates dimension and total percentage, returns top 3 dominant dimensions.
- Pride: uses total score thresholds for Arabic low/medium/high labels.
- Renzulli: computes per-dimension and total averages, maps average to low/medium/high.
- Holland: marks dimensions suitable if score >= 21, total suitable if total >= 126, builds three-letter code from top dimensions.
- Learning styles: uses absolute score strength and JSON `positivePole`/`negativePole`, no total score.

Approval:

- Only `ADMIN` can approve.
- Only `SUBMITTED` can be approved.
- Transaction locks attempt and approval row, creates `EvaluationApproval`, sets attempt status `APPROVED`, emits `evaluation.approved`.
- Owner reports use only approved attempts for score statistics.

Expiration and auto-submit:

- Attempt expiry is optional and can be absolute `expiresAt` or relative `expiresInSeconds`.
- `maybeAutoSubmitIfExpired()` is called from `saveProgress()` and parent `getAttempt()`.
- There is no scheduler to auto-submit expired attempts globally; auto-submit happens lazily when the parent touches the attempt.
- Auto-submit scores whatever answers have been saved, even zero answers.

Locking/concurrency:

- Submission and approval use pessimistic write locks on the attempt row.
- Auto-submit also locks attempt row.
- Private entitlement lookup/link/completion uses pessimistic locks.
- Payment webhook status update locks payment row.
- Gaps: `startEvaluation()` uses `repo.find(... lock: pessimistic_write)` without an explicit query runner outside a transaction manager; it is inside a transaction, but TypeORM `find` locking semantics are database-dependent. Concurrent starts may still hit the unique constraint rather than produce a clean business error.

Private vs institutional flows:

- Institutional children must use evaluations belonging to their organization and are capped at 2 attempts.
- Private children must first create entitlement rows. Main and retake are free; extra requires approval/payment.
- Submission of private attempts updates child-level counters (`attemptsUsed`, `retakeUsed`) and entitlement status. Institutional submissions do not update these counters, so using `attemptsUsed` as general evaluation status is inaccurate for institutional children.

## 6. Authorization Model

Global guards:

- All routes require JWT unless marked `@Public`.
- `@Roles(...)` metadata is enforced by `RolesGuard`.
- Roles are stored as entities in JWT payload. `RolesGuard` expects `request.user.roles` to be an array of objects with `.name`.

Roles:

- `ADMIN`
- `ORGANIZATIONOWNER`
- `EMPLOYEE`
- `ENRICHER`
- `TEACHER`
- `PARENT`

Ownership checks:

- Parent child ownership: usually `Child.parent.id === actor.userId`.
- Private child ownership additionally requires `organization IS NULL`.
- Attempt ownership: `EvaluationAttempt.parentId === actor.userId`.
- Notification ownership: update queries include `userId`.
- Payment ownership: `Payment.userId === current user` and child ownership checked during creation.
- Proposal ownership: only proposal provider can update proposal.

Admin-only flows:

- Create/list detailed evaluations.
- List/filter attempts.
- Approve evaluation attempts.
- Approve extra private attempt requests.
- Seed roles, role-grouped users, create/update/delete tests and activities.

Parent-only flows:

- Private children.
- Evaluation slots/retake/extra request.
- Start/save/submit attempts.
- Payment creation/retry.

Known access risks:

- `UsersController.findAll()`, `findOne()`, `remove()` have no role restriction beyond JWT.
- `ChildrenController.findByUser`, `findOne`, `update`, `remove` are authenticated but not owner/admin scoped.
- `ClassesController` has several unscoped read/write routes.
- `EvaluationsService.getAttempt()` explicitly has TODO for organization/class scoping for owner/teacher/employee.
- `OwnershipGuard` exists but is not used.

## 7. Important Services

`AuthProvider`:

- Responsibility: login, refresh token issuance through `SessionService`, signup orchestration, email verification token creation.
- Dependencies: users, JWT, sessions, DataSource, signup factory, notifications.
- Risks: verification token payload mismatch; signup only handles organization in `beneficiariesSignup`; notifications inside DB transaction can enqueue jobs before transaction commit.
- Coupling: high.
- Refactor: split `AuthService`, `SignupService`, `EmailVerificationService`; use outbox/after-commit notification dispatch.

`UsersService`:

- Responsibility: user create/update/role mutation/lookup/role seeding.
- Risks: `create()` uses injected `roleRepo` even inside a transaction manager, while saving user through manager. Role lookup should use the same manager.
- Coupling: medium.

`ChildrenService`:

- Responsibility: child creation/listing/update and private child creation.
- Risks: mixes institutional and private rules; updates existing parent user with supplied password during child creation; unscoped update/delete.
- Coupling: high due to users/auth/classes/org/notifications.

`PrivateChildAttemptsService`:

- Responsibility: private entitlement lifecycle, admin approval, payment unlock listener, child counter updates.
- Risks: entitlement state and child counters are duplicated; partial failures around payment creation after state change can leave `PENDING_PAYMENT` without usable payment if provider fails.
- Coupling: high with payments, children, notifications, evaluation service.

`EvaluationsService`:

- Responsibility: evaluation definitions, forms, available evaluation lookup, attempts, save/submit/approve, scoring, events.
- Risks: large service with multiple policies; private/institutional logic intertwined; lazy expiration only; owner/teacher access TODO.
- Coupling: very high.
- Refactor: split into `EvaluationCatalogService`, `AttemptLifecycleService`, `AttemptSubmissionService`, `EvaluationAccessPolicy`, `PrivateAttemptPolicy`.

`EvaluationScoringService`:

- Responsibility: deterministic scoring per evaluation type.
- Risks: hard-coded thresholds and Arabic labels in code; result JSON shape differs by type; no versioning.
- Coupling: low.
- Refactor: externalize scoring policy/version per evaluation type.

`OwnerEvaluationResultsService`:

- Responsibility: organization owner filters, report cards, class summaries/status, reminders.
- Risks: controller allows admin, but `resolveOrganizationId()` rejects non-owner in practice; relies on latest attempt ordering and approved-only stats.
- Coupling: medium.

`PaymentsService`:

- Responsibility: create payment sessions, webhook verification/dedup, processing jobs, status transitions, retry/expiry.
- Risks: idempotency by payload hash allows duplicate semantic events with changed payload; retry sets existing payment back to pending before provider call; no DB-level unique provider id.
- Coupling: high to provider, Bull, events.

`NotificationsService`:

- Responsibility: enqueue notifications, resolve email, list/read in-app notifications.
- Risks: async queue means callers assume eventual delivery; controller has debug `console.log`.
- Coupling: medium.

`DealsService`:

- Responsibility: create deals, notify enrichers, submit/update proposals.
- Risks: employee route allowed but not implemented; notifying all enrichers uses full user scan and in-memory role filter.
- Coupling: medium.

`TestsService`:

- Responsibility: legacy test creation/assignment/submission.
- Risks: imports `Test` from `@nestjs/testing` instead of local `entities/test.entity`, causing repository injection/entity mismatch. Update/remove are stubs and controller converts UUID to number.
- Coupling: low but likely broken.

## 8. Technical Debt & Risks

High-risk issues:

- `src/app.module.ts`: `port: Number(process.env.DB_HOST)` should likely be `DB_PORT`; `Boolean(process.env.DB_SYNCHRONIZE)` makes `"false"` true.
- No migrations were found. With `synchronize` misparsed, production schema safety is at risk.
- Email verification token mismatch across `AuthProvider` and `MailerService`.
- Multiple UUID routes still use `+id` and service stubs (`OrganizationsController`, `SessionController`, `TestsController` update/remove).
- `TestsService` imports the wrong `Test` class from `@nestjs/testing`.
- Owner/teacher access scoping is incomplete in evaluation attempt retrieval.
- Several controllers expose destructive or broad read routes without role/ownership policies.

Duplicated state:

- `Child.attemptsUsed` / `retakeUsed` duplicate information in `EvaluationAttempt` and `ChildPrivateAttempt`.
- `EvaluationAttempt.score/result` duplicate derived data from answers and scoring rules.
- `EvaluationAnswer.scoreValue` duplicates selected answer score intentionally, but scoring changes will not retroactively apply.

Race/transaction risks:

- Notifications are enqueued inside transactions in signup and child/evaluation flows. A job may observe state before commit or survive a rollback.
- Payment extra approval sets attempt to `PENDING_PAYMENT` before provider checkout is created; provider failure can strand state.
- Concurrent start attempts can race into unique constraint errors.
- Refresh token lookup uses `findValidSession(userId)` and returns one arbitrary session, not the matching token/session.

Null-driven logic:

- `Child.organization == null` is the private-child flag. This is simple but makes accidental nulls semantically significant.
- `Evaluation.expiresAt == null` means no expiry.
- Nullable `paymentId` and `evaluationAttemptId` drive entitlement status alongside enum status.

Scalability concerns:

- `DealsService.notifyServiceProviders()` loads all users and filters roles in memory.
- Owner reports fetch attempts and aggregate in application code.
- Notification and payment queues have basic concurrency but no dead-letter/outbox model.
- Eager-loaded roles may bloat JWT payload and user queries.

Inconsistent patterns:

- Some entities use explicit snake_case join columns, others rely on defaults.
- DTO validation quality varies; some DTOs use `@IsNotEmptyObject()` on arrays.
- Controllers sometimes enforce roles; services sometimes enforce roles; no single policy layer.
- Arabic strings appear mojibake-encoded in source/output, indicating file encoding or display issues.

## 9. Suggested Refactors

HIGH:

- Fix configuration parsing in `AppModule`: use `DB_PORT`, parse booleans explicitly, disable `synchronize` outside local dev, add TypeORM migrations.
- Fix auth verification token payload and consolidate verification email generation in one service.
- Repair access control for users/children/classes/evaluation attempts; apply ownership/org policies consistently.
- Fix `TestsService` wrong import and UUID-to-number controller stubs, or explicitly deprecate the legacy tests module.
- Correct organization membership checks for teachers (`teacher.user.id` vs `teacher.id`) and `Class.organization` inverse relation.
- Add transaction-safe side effects: outbox pattern or enqueue after commit for notifications/payment events.

MEDIUM:

- Split `EvaluationsService` and `PrivateChildAttemptsService` policies into smaller services/state machines.
- Replace child attempt counters with computed state or a single authoritative ledger.
- Add DB constraints/indexes: unique active private entitlement per child/kind/status where applicable, unique provider payment id when non-null, FK relation for `Evaluation.institutionId`.
- Implement proposal acceptance/deal closing or hide unused statuses.
- Make owner reports admin-compatible by accepting explicit organization context or changing role annotations.
- Normalize route naming (`/sessions`) and remove debug endpoints/logs from mailer/notifications/uploads.

LOW:

- Move hard-coded scoring labels/thresholds into versioned config tables.
- Introduce response DTOs for sensitive entities to avoid leaking password hashes where class serialization is bypassed.
- Replace string statuses in legacy tests/profile with enums.
- Improve file upload validation, MIME/type limits, and returned file URL.
- Add richer unit tests around private attempt/payment/evaluation transitions.

## 10. AI Guidance Section

Coding conventions:

- Follow `CONVENTIONS.md`: kebab-case files, plural resource routes, DTO validation, UUID strings with `ParseUUIDPipe`, explicit snake_case table names.
- Prefer TypeORM repositories and `DataSource.transaction()` where business state changes cross entities.
- Use `@Roles()` in controllers for coarse access, but enforce ownership/org rules in services.
- Keep relations explicit with `@JoinColumn({ name: ... })` when adding new foreign keys.
- Preserve global validation assumptions: DTOs should be strict and transform-friendly.

Patterns to preserve:

- Payment webhook flow: raw-body signature validation -> dedup table -> Bull job -> provider verification -> locked DB transition -> event.
- Evaluation form endpoint must not expose `scoreValue`, `minScore`, `maxScore`, or interpretation internals to parents.
- `EvaluationAnswer` should continue storing denormalized score values unless a deliberate scoring version migration is designed.
- Private children are identified by `organization IS NULL`; institutional children must have org/class consistency.

Dangerous areas:

- `EvaluationsService.startEvaluation()`, `submitAttempt()`, `approveAttempt()`.
- `PrivateChildAttemptsService` state changes and `payment.success` listener.
- `PaymentsService.runProcessPaymentWebhookJob()` and retry logic.
- `ChildrenService.create()` because it creates/updates users and children in one transaction.
- Any relation involving `Teacher`, `Organization`, `Class`, and user id/profile id.

Existing anti-patterns to avoid extending:

- Do not add more UUID-to-number coercion.
- Do not enqueue external side effects from inside transactions unless you accept rollback inconsistency.
- Do not expose raw entities on broad list endpoints if sensitive fields/relations can leak.
- Do not add more business rules as scattered controller conditions; centralize in services or policy classes.
- Do not add new magic string statuses where enums already exist.

Recommended extension patterns:

- For new evaluation lifecycle rules, create policy/state-machine helpers and call them from `EvaluationsService` instead of expanding nested conditions.
- For new payment providers, implement `PaymentProvider`, bind it through `PAYMENT_PROVIDER`, and keep provider-specific webhook parsing/signature logic in the provider class.
- For new notification types, enqueue through `NotificationsService`; include `type` and metadata for frontend routing.
- For organization-scoped features, resolve organization through a dedicated policy that supports owner, teacher, employee, and admin consistently.
- For background side effects, prefer events plus queues, and consider adding an outbox table before increasing cross-module side effects.

