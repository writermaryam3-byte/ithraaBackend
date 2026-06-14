# Backend API Contract & CTO Audit

Generated from source code (NestJS + TypeORM). Extracted entities, controllers, DTOs and services present in repository.

---

**NOTE:** This file is strictly code-driven. No behavior or endpoints are invented — only functionality found in the code is documented.

## PART 1 — System Overview

- Framework: NestJS modules and controllers (project under `src/`).
- ORM: TypeORM (entities under `src/**/entities`).
- Relevant modules analyzed: `users`, `children`, `evaluations`, `payments`, `organizations`, `classes`.

Domain model (key domain types present in code)
- `User` — authentication/account record (`src/users/entities/user.entity.ts`).
- `ParentProfile` — parent domain profile (`src/users/entities/parent-profile.entity.ts`).
- `ParentOrganization` — parent-school relationship (`src/users/entities/parent-organization.entity.ts`).
- `Organization` — school.
- `Child` — child record (`src/children/entities/child.entity.ts`).
- `Teacher` — `src/users/entities/teacher.entity.ts`.
- `EvaluationAttempt`, `EvaluationSlot` — `src/evaluations/**`.
- `Payment` — payments (`src/payments/entities/payment.entity.ts`).

Main flows implemented in code (locations shown inline in subsequent sections):
- Auth: login, signup, refresh, logout (`src/users/controllers/auth.controller.ts`).
- Organization creation/approval: organization membership checks used in child creation flow (`src/organizations` and `src/children/children.service.ts`).
- Child creation: by parent (private) and by organization members (institutional) (`src/children/parent-children.controller.ts`, `src/children/children.controller.ts`, `src/children/children.service.ts`).
- Parent private children: `classId === null` indicates a private child; private flows use `EvaluationSlotService` and payment flows for extra attempts.
- Evaluations/attempts/slots: endpoints and services are in `src/evaluations` (start, save, submit, admin approval, slot lifecycle).
- Payments: creation, webhook handling, retry and linking to private extra attempts (`src/payments/*`).

## PART 2 — Entity Relationship Map

Relationships (code-derived):

User (1) — (0..1) ParentProfile
ParentProfile (1) — (N) Child
ParentProfile (1) — (N) ParentOrganization — (1) Organization
Organization (1) — (N) Class — (N) Child
Child (1) — (N) EvaluationAttempt
EvaluationAttempt (1) — (N) EvaluationAnswer

Explicit relationship lines from code:
- `User` has `parentProfile` (one-to-one, `ParentProfile.userId` is unique) — see `ParentProfile.userId` and `@JoinColumn({ name: 'userId' })` (`src/users/entities/parent-profile.entity.ts`).
- `ParentProfile` -> `children` via `@OneToMany(() => Child, (child) => child.parent)` (`src/users/entities/parent-profile.entity.ts`).
- `Child.parentId` references `ParentProfile.id` with `@ManyToOne(() => ParentProfile, ... )` and `@JoinColumn({ name: 'parentId' })` (`src/children/entities/child.entity.ts`).
- `Child.createdById` references `User.id` as the creator (`createdBy`) (`src/children/entities/child.entity.ts`).
- `ParentOrganization` links `parentId` -> `ParentProfile.id` and `organizationId` -> `Organization.id` (`src/users/entities/parent-organization.entity.ts`).
- `EvaluationAttempt.parentId` references `ParentProfile.id` (`src/evaluations/entities/evaluation-attempt.entity.ts`).

Key foreign keys and nullability (exact fields from entities):
- `Child.parentId: uuid` (NOT NULL) — FK to `parents.id` (ParentProfile.id).
- `Child.createdById: uuid` (NOT NULL) — FK to `users.id` (User.id).
- `Child.classId: uuid | null` — nullable; when null → private child (not in institution).
- `Child.organizationId: uuid | null` — nullable; presence → institutional child.
- `ParentProfile.userId: uuid` (unique) — links to `users.id` and is NOT NULL.
- `ParentOrganization.parentId: uuid` NOT NULL, `organizationId: uuid` NOT NULL — link table with unique constraint on (parentId, organizationId).
- `Payment.userId: uuid` NOT NULL; `Payment.childId: uuid | null`; `Payment.privateAttemptId: uuid | null` (`src/payments/entities/payment.entity.ts`).

Ownership rules (as implemented in code):
- Parent ownership: ParentProfile.userId identifies the account owner. Authorization checks compare `parent.userId === actor.userId` (see `ChildAccessPolicy.assertReadAccess`/`assertWriteAccess`). This means frontend account identity is `User.id` and ownership of parent resources is verified by `ParentProfile.userId`.
- Child ownership: A child belongs to a ParentProfile via `child.parentId` (ParentProfile.id) and is createdBy `createdById` (User.id) for the creating user.
- Organization ownership: Organization owner (ownerId) controls org actions; org membership checked by `organizationsService.isOrgMember(userId, orgId)` for additions.

Where `ParentProfile.id` is used (code locations):
- `Child.parentId` (Child entity) — primary linkage between child and parent profile.
- `EvaluationAttempt.parentId` — attempts are tied to ParentProfile.id.
- `ParentOrganization.parentId` — parent ↔ organization links.
- Various services (ChildrenService, ParentProfilesService, EvaluationSlotService, PaymentsService) use ParentProfile.id when linking children, slots and entitlements.

Where `User.id` is used (code locations):
- `User.id` used as `createdById` on `Child` and as `Payment.userId` for payment ownership.
- Authentication `req.user.userId` is compared to `ParentProfile.userId` to determine ownership in access checks (e.g., `child.parent?.userId === actor.userId`).
- PaymentsService checks `p."userId" = :userId` in raw query to ensure the payer is the parent account owner.

## PART 3 — API Endpoint Inventory (code-driven)

Only endpoints present in controllers scanned are listed below (modules: `auth`, `users`, `parents`, `children`, `parent` (parent-children), `child-transfers`, `evaluations`, `attempts`, `admin-private-attempts`, `payments`). For endpoints that return entities, response shapes map to the entity fields as defined in the entity files.

---

Module: auth (`src/users/controllers/auth.controller.ts`)
- POST /auth/login
  - Controller: AuthController
  - Description: Login using phone & password.
  - Request body: `LoginDto` (phone, password) — `src/users/dto/login.dto.ts`.
  - Response: auth provider `login()` result (token payload produced by `AuthProvider`). Exact structure is returned by `AuthProvider.login` (not expanded here; see `src/users/services/auth.provider`).
  - Possible errors: 401 Unauthorized when validation fails.

- POST /auth/beneficiaries-signup
  - Public; Request body: `BeneficiariesSignupDto`.
  - Response: result of `authService.beneficiariesSignup` (created user/session).
  - Errors: 400 BadRequest if already exists.

- POST /auth/enrichers-signup
  - Public; Body: `EnrichersSignupDto`.
  - Response: result of `authService.enrichersSignup`.
  - Errors: 409 Conflict if already exists.

- POST /auth/refresh
  - Public; Body: { token: string }
  - Response: new login tokens from `authService.login(user)`.
  - Errors: 401 Unauthorized if token missing/invalid or session compromised.

- DELETE /auth/logout/:sessionId
  - Authenticated; logs out a session. Ensures session.userId === req.user.userId.
  - Response: { message: 'Logged out', statusCode: 200 }

- DELETE /auth/logout-all
  - Authenticated; delete all sessions for current user. No body.

- GET /auth/verify-email?token=...
  - Public; verifies email token via `authService.verifyEmail`.

---

Module: users (`src/users/controllers/users.controller.ts`)
- POST /users/seed-roles
  - Roles: ADMIN
  - Calls `usersService.seedRoles()`.

- GET /users
  - Roles: ADMIN
  - Response: `usersService.findAll()` (array of `User` entities).

- GET /users/roles
  - Roles: ADMIN
  - Response: `usersService.findUsersByRoles()`.

- GET /users/organization-owner/:id
  - Roles: ORGANIZATIONOWNER | ADMIN
  - Response: `usersService.getOrganizationOwner(id)` (user who owns the org).

- GET /users/me
  - Authenticated.
  - Response: `usersService.findById(req.user.userId)` (the `User` entity for current user).

- GET /users/:id
  - Authenticated. If not ADMIN, only allows requesting own user. Response: `usersService.findById(id)` (`User` entity).

- DELETE /users/:id
  - Roles: ADMIN — delete a user.

---

Module: parents (`src/users/controllers/parent.controller.ts`)
- GET /parents/search?phone=...
  - Roles: ORGANIZATIONOWNER | ADMIN
  - Returns result from `ParentsServices.findParentByPhone(phone)`.

---

Module: children (`src/children/children.controller.ts`)
- POST /children
  - Roles: ORGANIZATIONOWNER | TEACHER
  - Body: `CreateChildDto` — fields: name, birthDate (date string), gender (enum), classId (uuid), parentPhone, parentEmail?, parentName? (`src/children/dto/create-child.dto.ts`).
  - Description: add child with auto parent account creation for organization members.
  - Response: returns `ChildrenService.createChild(...)` which returns `CreateChildResponse`:
    {
      status: 'CREATED' | 'TRANSFER_REQUIRED',
      message: string,
      childId?: string,
      transferRequestId?: string
    }
  - Possible errors thrown in service: 403 Forbidden (not org member), 409 Conflict (child exists), 400 BadRequest (child limit/other validations).

- GET /children/all
  - Roles: ADMIN
  - Response: { children: Child[], count: number } — `childrenRepository.findAndCount()` (raw `Child` entity fields).

- GET /children?userId=... (query param)
  - Authenticated; summary: get all children for specific user (self or admin). Query param `userId` (uuid).
  - Response: { children: Child[], count: number } for `createdBy` = userId.

- GET /children/organization/:orgId
  - Roles: ORGANIZATIONOWNER | ADMIN | TEACHER
  - Response: { children: [ ...child with `gradeName`, `className` mapped ], count omitted }.

- GET /children/:id
  - Authenticated
  - Response: { child: Child } — Child entity (includes fields: id, name, birthDate, gender, classId, class, organizationId, organization, createdById, createdBy, parentId, parent, profile, slots, createdAt, updatedAt).

- PATCH /children/:id
  - Authenticated; Body: `UpdateChildDto` — partial fields.
  - Response: updated `Child` entity.

- DELETE /children/:id
  - Authenticated; returns deleted `Child` entity (typeorm remove result).

Module: parent (parent-specific child endpoints) (`src/children/parent-children.controller.ts`)
- POST /parent/children
  - Roles: PARENT
  - Body: `CreateChildByParentDto` (name, birthDate, gender) — creates a private child.
  - Response: saved `Child` entity (private child with `organizationId = null`, `classId = null`, `parentId = ParentProfile.id`, `createdById = userId`).

- GET /parent/children
  - Roles: PARENT
  - Response: { children: Array<Child & { retakeUsed: boolean; attemptsUsed: number }>, count: number }
    - Note: `findPrivateChildrenForParent` augments child objects with `retakeUsed` and `attemptsUsed`.

- GET /parent/org-children
  - Roles: PARENT
  - Response: { children: Array<Child & { retakeUsed: boolean; attemptsUsed: number }>, count }

Module: child-transfers (`src/children/transfers.controller.ts`)
- POST /child-transfers
  - Roles: ORGANIZATIONOWNER | ADMIN
  - Body: `RequestTransferDto` { childId: uuid, toOrganizationId: uuid }
  - Response: `TransferRequest` entity saved (fields from `src/children/entities/transfer-request.entity.ts`): id, childId, fromOrganizationId, toOrganizationId, status, createdAt.
  - Service returns existing pending request or creates a new one.

- PATCH /child-transfers/:id/approve
  - Roles: ORGANIZATIONOWNER | ADMIN
  - Body: `ApproveTransferDto` { classId: uuid }
  - Response: updated `TransferRequest` (status = APPROVED) — after updating child.organizationId and child.classId.

- PATCH /child-transfers/:id/reject
  - Roles: ORGANIZATIONOWNER | ADMIN
  - Response: updated `TransferRequest` (status = REJECTED).

- GET /child-transfers?toOrganizationId&fromOrganizationId&status
  - Roles: ORGANIZATIONOWNER | ADMIN
  - Response: { requests: [ { id, childId, fromOrganizationId, toOrganizationId, status: string (lowercase), createdAt, child: { id, name, birthDate, class: { id, name } | null } | null, fromOrganization: { id, organizationName } | null, toOrganization: { id, organizationName } | null } ] }

Module: evaluations (`src/evaluations/evaluations.controller.ts`)
- POST /evaluations
  - Roles: ADMIN
  - Body: `CreateEvaluationDto` (title, type, institutionId?, ageFrom?, ageTo?, evaluatorTypes[], dimensions[], questions[])
  - Response: the created `Evaluation` with relations: `dimensions`, `questions` and `answers` (see `Evaluation` entity files in `src/evaluations/entities`).

- GET /evaluations
  - Roles: ADMIN
  - Response: array of `Evaluation` (includes dimensions).

- GET /evaluations/available/:childId
  - Authenticated (effectively for PARENT via access check in service)
  - Response: { childId: string, age: number, evaluations: Evaluation[] }

- GET /evaluations/:id/details
  - Roles: ADMIN
  - Response: `Evaluation` with `dimensions`, `questions` (and answers) — full scoring metadata.

- GET /evaluations/:id/form
  - Roles: PARENT | ADMIN
  - Response (exact shape returned by `getEvaluationForm`):
    {
      id: string,
      title: string,
      type: string,
      institutionId: string | null,
      ageFrom: number | null,
      ageTo: number | null,
      evaluatorTypes: string[],
      dimensions: [{ id: string, name: string, code: string }],
      questions: [{ id: string, content: string, order: number, dimension: { id, code, name }, answers: [{ id, text, code, order }] }]
    }

- POST /evaluations/:id/start
  - Roles: PARENT
  - Body: `StartEvaluationDto` { childId: uuid, expiresAt?: iso, expiresInSeconds?: number }
  - Response: delegated to `EvaluationAttemptLifecycleService.startEvaluation` (returns attempt entity created / lifecycle result).

Module: attempts (`src/evaluations/attempts.controller.ts`)
- GET /attempts
  - Roles: ADMIN
  - Query params: status, evaluationId, childId
  - Response: delegated to `EvaluationsService.getAttemptsForAdmin` → { attempts: EvaluationAttempt[], count: number }

- GET /attempts/child/:childId
  - Roles: PARENT | ADMIN
  - Response: { attempts: EvaluationAttempt[], count: number }

- POST /attempts/:childId/start
  - Roles: PARENT
  - Path childId
  - Behavior: `slots.startMainSlot(childId, user.userId)` returns an `EvaluationSlot` entity.

- POST /attempts/:childId/retake
  - Roles: PARENT
  - Behavior: `slots.requestRetake(childId, user.userId)` returns `EvaluationSlot` entity.

- POST /attempts/:childId/request-extra
  - Roles: PARENT
  - Behavior: `slots.requestExtraAttempt(childId, user.userId)` returns `EvaluationSlot` with status REQUESTED.

- PATCH /attempts/:id/save
  - Roles: PARENT
  - Body: `SaveProgressDto` (answers[] optional)
  - Response: `getAttempt(attemptId, actor)` — full `EvaluationAttempt` entity.

- POST /attempts/:id/submit
  - Roles: PARENT
  - Body: `SubmitAttemptDto` (answers[] required)
  - Response: result of submission flow (attempt entity or submission result) — returned from `EvaluationSubmissionService.submitAttempt`.

- GET /attempts/:id
  - Roles: PARENT | ADMIN | ORGANIZATIONOWNER | TEACHER
  - Response: `EvaluationAttempt` entity (includes `answers`, `approval`, `evaluation`, `child` relations).

- POST /attempts/:id/approve
  - Roles: ADMIN
  - Response: result of `service.approveAttempt` (approval flow).

Module: admin-private-attempts (`src/evaluations/admin-private-attempts.controller.ts`)
- POST /admin/attempts/:id/approve
  - Roles: ADMIN
  - Behavior: `slots.adminApproveExtraAttempt(id, user.userId)`
  - Response: { attempt: EvaluationSlot, payment: { id, checkoutUrl, expiresAt, status } }

Module: payments (`src/payments/payments.controller.ts`)
- POST /payments
  - Roles: PARENT
  - Body: `CreatePaymentDto` (amount, currency?, childId, attemptRequestId?, privateAttemptId?, description?, provider?)
  - Response (exact shape in code): { id: string; checkoutUrl: string; expiresAt: Date; status: PaymentStatusEnum }
  - Important server-side check: validates that the child belongs to the requesting parent via DB join.

- POST /payments/webhook
  - Public; Raw body required and `x-moyasar-signature` header validated. Response: { accepted: boolean, deduplicated?: boolean }

- POST /payments/:attemptId/initiate
  - Roles: PARENT
  - Response: `EvaluationSlotService.initiateOrRefreshExtraPayment` result (checkout data)

- POST /payments/:id/retry
  - Roles: PARENT
  - Response: `PaymentsService.retryPayment` → { id, checkoutUrl, expiresAt, status }

Status codes (exceptions mapping):
- `BadRequestException` → 400
- `UnauthorizedException` → 401
- `ForbiddenException` → 403
- `NotFoundException` → 404
- `ConflictException` → 409

## PART 4 — API CONTRACT SUMMARY (FOR FRONTEND)

Key Types (code-exact simplified):

Child:
{
  id: string
  name: string
  birthDate: string
  gender: string
  classId: string | null
  organizationId: string | null
  createdById: string
  parentId: string
}

Parent:
{
  id: string // ParentProfile.id
  userId: string // User.id
  createdAt: string
  updatedAt: string
}

EvaluationAttempt:
{
  id: string
  parentId: string // ParentProfile.id
  childId: string
  evaluationId: string
  attemptNumber: number
  status: string
  score?: number | null
}

Meaning of `parentId` and differences:
- `parentId` on `Child` and `EvaluationAttempt` refers to `ParentProfile.id` (domain parent profile record).
- `parent.userId` (or `ParentProfile.userId`) is the `User.id` of the account owner.
- Frontend should use `parent.userId` (or `child.parent.userId`) to compare with the currently authenticated user's `id` (session user id). Do NOT compare `child.parentId` to the session user id.

## PART 5 — BUSINESS LOGIC RULES

- Organization approval gating: When creating institutional child (`createChild`), `organizationsService.assertOrganizationApproved(currentOrganizationId)` is called; unapproved orgs are blocked from child creation.
- Parent ownership rules: ParentProfile is the canonical parent domain. Ownership checks compare `child.parent?.userId === actor.userId` in `ChildAccessPolicy`. ParentProfile is created/ensured via `ParentProfilesService.ensureParentProfileForUser(userId)` when a parent creates private children.
- Private child rules: `classId === null` and `organizationId === null` denote private children. Limits: parent can have at most 2 private children (enforced in `createChildByParent`).
- Multi-organization parent support: parents can be linked to multiple organizations via `ParentOrganization` rows (`linkParentToOrganization` ensures a unique (parentId, organizationId) link). Creating an org child links parent to the organization.
- Evaluation access rules: For private children, slots are used (`EvaluationSlotService`) to control main/retake/extra entitlements. Attempts are tied to ParentProfile.id and childId; parents can only start/retake/extra for children that belong to their ParentProfile (checked by `loadPrivateChildOrThrow` and other checks).
- Payment ownership rules: `PaymentsService.createPayment` ensures the `childId` belongs to the authenticated parent by joining `children` -> `parents` and checking `p."userId" = :userId`. `retryPayment` validates `payment.userId === userId`.

## PART 6 — CRITICAL FLOW VALIDATION

1) Parent flow (private child):
- create private child: POST /parent/children → `ChildrenService.createChildByParent`.
  - ensures `ParentProfile` exists for `req.user.userId` (`ensureParentProfileForUser`), enforces max 2 private children, returns saved `Child` (organizationId=null, classId=null, parentId=ParentProfile.id).
- list private children: GET /parent/children → `findPrivateChildrenForParent` returning children with usage info (`retakeUsed`, `attemptsUsed`).
- evaluate child: POST /attempts/:childId/start → `EvaluationSlotService.startMainSlot(childId, user.userId)` which checks private child ownership and usage quota, then creates an `EvaluationSlot` (READY) entitling an attempt; lifecycle services create attempt records.
- payment for attempt: For extra attempts, parent requests extra (`POST /attempts/:childId/request-extra`) → creates `EvaluationSlot` (REQUESTED) requiring approval; admin approves via POST /admin/attempts/:id/approve → creates payment via `PaymentsService.createPaymentForPrivateExtraAttempt` and attaches `paymentId` to slot; webhook then marks payment PAID and `EvaluationSlotService.handlePaymentSuccess` transitions slot to READY.

2) Organization flow:
- create child: POST /children (org role) — service checks org membership, ensures organization approved, uses `ParentProfilesService.getOrCreateParentByContact` to find/create parent User & ParentProfile, links parent to org, checks existing child duplicates by birthDate & parent profile; if child exists in another org triggers transfer flow.
- assign parent: parent linkage created via ParentProfile (parent created/ensured) and `ParentProfilesService.linkParentToOrganization` establishes parent-organization link.
- transfer logic: If creating a child and an existing child exists with same birthDate and same parent in another org, `TransferService.requestTransfer` is called which creates a `TransferRequest` (PENDING); org owner can approve (PATCH :id/approve) which sets `child.organizationId = toOrganizationId` and `child.classId = classId`.
- filtering per org: GET /children/organization/:orgId returns children for that organization (requires org membership).

3) Security:
- Parent cannot access another parent's child: enforced by `ChildAccessPolicy.assertReadAccess` which checks `child.parent?.userId === actor.userId` for PARENT role.
- Org cannot access private children: `isPrivateChild` checks `classId === null`; org endpoints only return children where `organizationId` matches.
- payment ownership enforced: `PaymentsService.createPayment` and `retryPayment` both check `userId` matches the payment/user context and that the child belongs to this parent via DB join.

## PART 7 — BREAKING CHANGES (PARENTPROFILE MIGRATION)

Observed (code evidence):
- Child now references `parentId` -> `ParentProfile.id` (see `src/children/entities/child.entity.ts`). Historical code backup `children.service.ts.backup` shows older usage where `parentId` was used as a `User.id` (e.g., `userId: parentId`). This implies migration from User.id to ParentProfile.id.

Breaking changes to frontends (impact assessment):
- child.parentId used to be `User.id` → now `ParentProfile.id`.
  - Impact: HIGH. Any frontend code comparing `child.parentId === session.user.id` will break.
- Endpoints that return parent-related references now include nested `parent.userId` or require dereferencing `parent.userId` to compare with session user.
  - Impact: MEDIUM. Frontend must inspect `child.parent.userId` instead of `child.parentId` when checking ownership.
- Ownership checks moved to ParentProfile layer and ParentOrganization linking; some endpoints now rely on `ParentProfile.userId` for validation rather than pure `User.id` fields.
  - Impact: MEDIUM.

## PART 8 — FRONTEND COMPATIBILITY CONTRACT

What frontend MUST change (code-exact guidance):
- Types: update Child type to include both `parentId: string` (ParentProfile.id) and, when available, `parent.userId: string` (User.id). Examples in code often return `parent` relation; ensure UI types accept nested `parent` objects.
- Ownership checks:
  ❌ WRONG: `child.parentId === session.user.id`
  ✅ CORRECT: `child.parent?.userId === session.user.id` (or fetch ParentProfile and compare `parent.userId`)
- When sending operations that accept a parent identifier, distinguish whether the endpoint expects `parentProfileId` (ParentProfile.id) or `userId` (User.id). Use the exact DTO/route contract (for example `EvaluationSlotService` uses parentId == ParentProfile.id in many places).

## PART 9 — MISSING / WEAK AREAS (code findings)

- Missing explicit API response envelopes: controllers often return entities directly which may leak internal fields.
- Payments webhook requires `req.rawBody` and documentation in code warns to enable Nest raw body. If the server bootstrap is not configured, the webhook will fail; this is documented in controller but should be validated by integration tests.
- Temporary password generation logs to console in `ParentProfilesService.getOrCreateParentByContact` (`console.log(parentPassword);`) — security risk (leaks passwords in logs).
- Tests coverage gaps: payments worker flows and webhook handling have many moving parts (queue, provider verify). I did not find explicit e2e tests for payment success/failure or for admin approval -> payment -> webhook lifecycle.
- Inconsistent response shapes: some services return raw entities, others map to simplified objects (e.g., `TransferService.getTransferRequests`). Frontend must handle both patterns.

## PART 10 — FINAL CTO REPORT

1) Backend Score: 82 / 100

2) Strengths
- Clear domain separation: `ParentProfile` abstraction is concise and consistently used.
- Authorizations are centralized (ChildAccessPolicy, EvaluationAccessPolicy) and rely on explicit role checks.
- Payments are implemented with provider abstraction, webhook dedup, job queue and retries — robust design patterns.

3) Risks
- Frontend compatibility break risk (HIGH) because `child.parentId` now refers to ParentProfile.id — many frontends may have assumed `User.id` previously.
- Logging of temporary passwords is a security risk.
- Webhook/raw-body dependency needs deployment verification.

4) Technical debt
- Inconsistent response formatting (sometimes raw entities, sometimes mapped objects) — increases frontend parsing complexity.
- Missing explicit API contracts (OpenAPI exists via decorators, but runtime shapes vary). Add explicit response DTOs for all public endpoints.

5) Readiness recommendation
- Conditional Go: backend is functionally complete for parent/child flows and payments, but frontend changes and small security fixes are required before full production rollout.

6) Recommended next steps
- Immediate: Fix logging of generated passwords (remove `console.log`) and add unit/e2e tests for payment webhook happy/failure paths.
- Short term: Add explicit response DTOs and harmonize response envelopes (e.g., always return { data: ..., meta: ... } or documented raw entity shapes).
- Frontend: Update ownership checks to use `parent.userId` and update types.

## PART 11 — ARTIFACT

This document is saved in `docs/backend-api-contract.md` (this file).

---

If you want, I can now:
- produce a narrower, machine-readable OpenAPI fragment for the parent/child/payment endpoints only, or
- run a grep to enumerate all remaining controllers and add them to this document.

# Backend API Contract & CTO Audit

Generated from source code (NestJS + TypeORM). Extracted entities, controllers, DTOs and services present in repository.

---

**NOTE:** This file is strictly code-driven. No behavior or endpoints are invented — only functionality found in the code is documented.

## PART 1 — System Overview

- Framework: NestJS modules and controllers (project under `src/`).
- ORM: TypeORM (entities under `src/**/entities`).
- Relevant modules analyzed: `users`, `children`, `evaluations`, `payments`, `organizations`, `classes`.

Domain model (key domain types present in code)
- `User` — authentication/account record (`src/users/entities/user.entity.ts`).
- `ParentProfile` — parent domain profile (`src/users/entities/parent-profile.entity.ts`).
- `ParentOrganization` — parent-school relationship (`src/users/entities/parent-organization.entity.ts`).
- `Organization` — school.
- `Child` — child record (`src/children/entities/child.entity.ts`).
- `Teacher` — `src/users/entities/teacher.entity.ts`.
- `EvaluationAttempt`, `EvaluationSlot` — `src/evaluations/**`.
- `Payment` — payments (`src/payments/entities/payment.entity.ts`).

Main flows implemented in code (locations shown inline in subsequent sections):
- Auth: login, signup, refresh, logout (`src/users/controllers/auth.controller.ts`).
- Organization creation/approval: organization membership checks used in child creation flow (`src/organizations` and `src/children/children.service.ts`).
- Child creation: by parent (private) and by organization members (institutional) (`src/children/parent-children.controller.ts`, `src/children/children.controller.ts`, `src/children/children.service.ts`).
- Parent private children: `classId === null` indicates a private child; private flows use `EvaluationSlotService` and payment flows for extra attempts.
- Evaluations/attempts/slots: endpoints and services are in `src/evaluations` (start, save, submit, admin approval, slot lifecycle).
- Payments: creation, webhook handling, retry and linking to private extra attempts (`src/payments/*`).

## PART 2 — Entity Relationship Map

Relationships (code-derived):

User (1) — (0..1) ParentProfile
ParentProfile (1) — (N) Child
ParentProfile (1) — (N) ParentOrganization — (1) Organization
Organization (1) — (N) Class — (N) Child
Child (1) — (N) EvaluationAttempt
EvaluationAttempt (1) — (N) EvaluationAnswer

Explicit relationship lines from code:
- `User` has `parentProfile` (one-to-one, `ParentProfile.userId` is unique) — see `ParentProfile.userId` and `@JoinColumn({ name: 'userId' })` (`src/users/entities/parent-profile.entity.ts`).
- `ParentProfile` -> `children` via `@OneToMany(() => Child, (child) => child.parent)` (`src/users/entities/parent-profile.entity.ts`).
- `Child.parentId` references `ParentProfile.id` with `@ManyToOne(() => ParentProfile, ... )` and `@JoinColumn({ name: 'parentId' })` (`src/children/entities/child.entity.ts`).
- `Child.createdById` references `User.id` as the creator (`createdBy`) (`src/children/entities/child.entity.ts`).
- `ParentOrganization` links `parentId` -> `ParentProfile.id` and `organizationId` -> `Organization.id` (`src/users/entities/parent-organization.entity.ts`).
- `EvaluationAttempt.parentId` references `ParentProfile.id` (`src/evaluations/entities/evaluation-attempt.entity.ts`).

Key foreign keys and nullability (exact fields from entities):
- `Child.parentId: uuid` (NOT NULL) — FK to `parents.id` (ParentProfile.id).
- `Child.createdById: uuid` (NOT NULL) — FK to `users.id` (User.id).
- `Child.classId: uuid | null` — nullable; when null → private child (not in institution).
- `Child.organizationId: uuid | null` — nullable; presence → institutional child.
- `ParentProfile.userId: uuid` (unique) — links to `users.id` and is NOT NULL.
- `ParentOrganization.parentId: uuid` NOT NULL, `organizationId: uuid` NOT NULL — link table with unique constraint on (parentId, organizationId).
- `Payment.userId: uuid` NOT NULL; `Payment.childId: uuid | null`; `Payment.privateAttemptId: uuid | null` (`src/payments/entities/payment.entity.ts`).

Ownership rules (as implemented in code):
- ParentProfile.userId is the account owner; access checks compare `parent.userId === actor.userId` (see `ChildAccessPolicy.assertReadAccess`/`assertWriteAccess`). This means frontend account identity is `User.id` and ownership of parent resources is verified by `ParentProfile.userId`.
- Child ownership: A child belongs to a ParentProfile via `child.parentId` (ParentProfile.id) and is createdBy `createdById` (User.id) for the creating user.
- Organization ownership: Organization owner (ownerId) controls org actions; org membership checked by `organizationsService.isOrgMember(userId, orgId)` for additions.

Where `ParentProfile.id` is used (code locations):
- `Child.parentId` (Child entity) — primary linkage between child and parent profile.
- `EvaluationAttempt.parentId` — attempts are tied to ParentProfile.id.
- `ParentOrganization.parentId` — parent ↔ organization links.
- Various services (ChildrenService, ParentProfilesService, EvaluationSlotService, PaymentsService) use ParentProfile.id when linking children, slots and entitlements.

Where `User.id` is used (code locations):
- `User.id` used as `createdById` on `Child` and as `Payment.userId` for payment ownership.
- Authentication `req.user.userId` is compared to `ParentProfile.userId` to determine ownership in access checks (e.g., `child.parent?.userId === actor.userId`).
- PaymentsService checks `p."userId" = :userId` in raw query to ensure the payer is the parent account owner.

## PART 3 — API Endpoint INVENTORY (CRITICAL)

Only endpoints present in controllers scanned are listed below (modules: `auth`, `users`, `parents`, `children`, `parent` (parent-children), `child-transfers`, `evaluations`, `attempts`, `admin-private-attempts`, `payments`). For endpoints that return entities, response shapes map to the entity fields as defined in the entity files.

---

Module: auth (`src/users/controllers/auth.controller.ts`)
- POST /auth/login
  - Controller: AuthController
  - Description: Login using phone & password.
  - Request body: `LoginDto` (phone, password) — `src/users/dto/login.dto.ts`.
  - Response: auth provider `login()` result (token payload produced by `AuthProvider`). Exact structure is returned by `AuthProvider.login` (not expanded here; see `src/users/services/auth.provider`).
  - Possible errors: 401 Unauthorized when validation fails.

- POST /auth/beneficiaries-signup
  - Public; Request body: `BeneficiariesSignupDto`.
  - Response: result of `authService.beneficiariesSignup` (created user/session).
  - Errors: 400 BadRequest if already exists.

- POST /auth/enrichers-signup
  - Public; Body: `EnrichersSignupDto`.
  - Response: result of `authService.enrichersSignup`.
  - Errors: 409 Conflict if already exists.

- POST /auth/refresh
  - Public; Body: { token: string }
  - Response: new login tokens from `authService.login(user)`.
  - Errors: 401 Unauthorized if token missing/invalid or session compromised.

- DELETE /auth/logout/:sessionId
  - Authenticated; logs out a session. Ensures session.userId === req.user.userId.
  - Response: { message: 'Logged out', statusCode: 200 }

- DELETE /auth/logout-all
  - Authenticated; delete all sessions for current user. No body.

- GET /auth/verify-email?token=...
  - Public; verifies email token via `authService.verifyEmail`.

---

Module: users (`src/users/controllers/users.controller.ts`)
- POST /users/seed-roles
  - Roles: ADMIN
  - Calls `usersService.seedRoles()`.

- GET /users
  - Roles: ADMIN
  - Response: `usersService.findAll()` (array of `User` entities).

- GET /users/roles
  - Roles: ADMIN
  - Response: `usersService.findUsersByRoles()`.

- GET /users/organization-owner/:id
  - Roles: ORGANIZATIONOWNER | ADMIN
  - Response: `usersService.getOrganizationOwner(id)` (user who owns the org).

- GET /users/me
  - Authenticated.
  - Response: `usersService.findById(req.user.userId)` (the `User` entity for current user).

- GET /users/:id
  - Authenticated. If not ADMIN, only allows requesting own user. Response: `usersService.findById(id)` (`User` entity).

- DELETE /users/:id
  - Roles: ADMIN — delete a user.

---

Module: parents (`src/users/controllers/parent.controller.ts`)
- GET /parents/search?phone=...
  - Roles: ORGANIZATIONOWNER | ADMIN
  - Returns result from `ParentsServices.findParentByPhone(phone)`.

---

Module: children (`src/children/children.controller.ts`)
- POST /children
  - Roles: ORGANIZATIONOWNER | TEACHER
  - Body: `CreateChildDto` — fields: name, birthDate (date string), gender (enum), classId (uuid), parentPhone, parentEmail?, parentName? (`src/children/dto/create-child.dto.ts`).
  - Description: add child with auto parent account creation for organization members.
  - Response: returns `ChildrenService.createChild(...)` which returns `CreateChildResponse`:
    {
      status: 'CREATED' | 'TRANSFER_REQUIRED',
      message: string,
      childId?: string,
      transferRequestId?: string
    }
  - Possible errors thrown in service: 403 Forbidden (not org member), 409 Conflict (child exists), 400 BadRequest (child limit/other validations).

- GET /children/all
  - Roles: ADMIN
  - Response: { children: Child[], count: number } — `childrenRepository.findAndCount()` (raw `Child` entity fields).

- GET /children?userId=... (query param)
  - Authenticated; summary: get all children for specific user (self or admin). Query param `userId` (uuid).
  - Response: { children: Child[], count: number } for `createdBy` = userId.

- GET /children/organization/:orgId
  - Roles: ORGANIZATIONOWNER | ADMIN | TEACHER
  - Response: { children: [ ...child with `gradeName`, `className` mapped ], count omitted }.

- GET /children/:id
  - Authenticated
  - Response: { child: Child } — Child entity (includes fields: id, name, birthDate, gender, classId, class, organizationId, organization, createdById, createdBy, parentId, parent, profile, slots, createdAt, updatedAt).

- PATCH /children/:id
  - Authenticated; Body: `UpdateChildDto` — partial fields.
  - Response: updated `Child` entity.

- DELETE /children/:id
  - Authenticated; returns deleted `Child` entity (typeorm remove result).

Module: parent (parent-specific child endpoints) (`src/children/parent-children.controller.ts`)
- POST /parent/children
  - Roles: PARENT
  - Body: `CreateChildByParentDto` (name, birthDate, gender) — creates a private child.
  - Response: saved `Child` entity (private child with `organizationId = null`, `classId = null`, `parentId = ParentProfile.id`, `createdById = userId`).

- GET /parent/children
  - Roles: PARENT
  - Response: { children: Array<Child & { retakeUsed: boolean; attemptsUsed: number }>, count: number }
    - Note: `findPrivateChildrenForParent` augments child objects with `retakeUsed` and `attemptsUsed`.

- GET /parent/org-children
  - Roles: PARENT
  - Response: { children: Array<Child & { retakeUsed: boolean; attemptsUsed: number }>, count }

Module: child-transfers (`src/children/transfers.controller.ts`)
- POST /child-transfers
  - Roles: ORGANIZATIONOWNER | ADMIN
  - Body: `RequestTransferDto` { childId: uuid, toOrganizationId: uuid }
  - Response: `TransferRequest` entity saved (fields from `src/children/entities/transfer-request.entity.ts`): id, childId, fromOrganizationId, toOrganizationId, status, createdAt.
  - Service returns existing pending request or creates a new one.

- PATCH /child-transfers/:id/approve
  - Roles: ORGANIZATIONOWNER | ADMIN
  - Body: `ApproveTransferDto` { classId: uuid }
  - Response: updated `TransferRequest` (status = APPROVED) — after updating child.organizationId and child.classId.

- PATCH /child-transfers/:id/reject
  - Roles: ORGANIZATIONOWNER | ADMIN
  - Response: updated `TransferRequest` (status = REJECTED).

- GET /child-transfers?toOrganizationId&fromOrganizationId&status
  - Roles: ORGANIZATIONOWNER | ADMIN
  - Response: { requests: [ { id, childId, fromOrganizationId, toOrganizationId, status: string (lowercase), createdAt, child: { id, name, birthDate, class: { id, name } | null } | null, fromOrganization: { id, organizationName } | null, toOrganization: { id, organizationName } | null } ] }

Module: evaluations (`src/evaluations/evaluations.controller.ts`)
- POST /evaluations
  - Roles: ADMIN
  - Body: `CreateEvaluationDto` (title, type, institutionId?, ageFrom?, ageTo?, evaluatorTypes[], dimensions[], questions[])
  - Response: the created `Evaluation` with relations: `dimensions`, `questions` and `answers` (see `Evaluation` entity files in `src/evaluations/entities`).

- GET /evaluations
  - Roles: ADMIN
  - Response: array of `Evaluation` (includes dimensions).

- GET /evaluations/available/:childId
  - Authenticated (effectively for PARENT via access check in service)
  - Response: { childId: string, age: number, evaluations: Evaluation[] }

- GET /evaluations/:id/details
  - Roles: ADMIN
  - Response: `Evaluation` with `dimensions`, `questions` (and answers) — full scoring metadata.

- GET /evaluations/:id/form
  - Roles: PARENT | ADMIN
  - Response (exact shape returned by `getEvaluationForm`):
    {
      id: string,
      title: string,
      type: string,
      institutionId: string | null,
      ageFrom: number | null,
      ageTo: number | null,
      evaluatorTypes: string[],
      dimensions: [{ id: string, name: string, code: string }],
      questions: [{ id: string, content: string, order: number, dimension: { id, code, name }, answers: [{ id, text, code, order }] }]
    }

- POST /evaluations/:id/start
  - Roles: PARENT
  - Body: `StartEvaluationDto` { childId: uuid, expiresAt?: iso, expiresInSeconds?: number }
  - Response: delegated to `EvaluationAttemptLifecycleService.startEvaluation` (returns attempt entity created / lifecycle result).

Module: attempts (`src/evaluations/attempts.controller.ts`)
- GET /attempts
  - Roles: ADMIN
  - Query params: status, evaluationId, childId
  - Response: delegated to `EvaluationsService.getAttemptsForAdmin` → { attempts: EvaluationAttempt[], count: number }

- GET /attempts/child/:childId
  - Roles: PARENT | ADMIN
  - Response: { attempts: EvaluationAttempt[], count: number }

- POST /attempts/:childId/start
  - Roles: PARENT
  - Path childId
  - Behavior: `slots.startMainSlot(childId, user.userId)` returns an `EvaluationSlot` entity.

- POST /attempts/:childId/retake
  - Roles: PARENT
  - Behavior: `slots.requestRetake(childId, user.userId)` returns `EvaluationSlot` entity.

- POST /attempts/:childId/request-extra
  - Roles: PARENT
  - Behavior: `slots.requestExtraAttempt(childId, user.userId)` returns `EvaluationSlot` with status REQUESTED.

- PATCH /attempts/:id/save
  - Roles: PARENT
  - Body: `SaveProgressDto` (answers[] optional)
  - Response: `getAttempt(attemptId, actor)` — full `EvaluationAttempt` entity.

- POST /attempts/:id/submit
  - Roles: PARENT
  - Body: `SubmitAttemptDto` (answers[] required)
  - Response: result of submission flow (attempt entity or submission result) — returned from `EvaluationSubmissionService.submitAttempt`.

- GET /attempts/:id
  - Roles: PARENT | ADMIN | ORGANIZATIONOWNER | TEACHER
  - Response: `EvaluationAttempt` entity (includes `answers`, `approval`, `evaluation`, `child` relations).

- POST /attempts/:id/approve
  - Roles: ADMIN
  - Response: result of `service.approveAttempt` (approval flow).

Module: admin-private-attempts (`src/evaluations/admin-private-attempts.controller.ts`)
- POST /admin/attempts/:id/approve
  - Roles: ADMIN
  - Behavior: `slots.adminApproveExtraAttempt(id, user.userId)`
  - Response: { attempt: EvaluationSlot, payment: { id, checkoutUrl, expiresAt, status } }

Module: payments (`src/payments/payments.controller.ts`)
- POST /payments
  - Roles: PARENT
  - Body: `CreatePaymentDto` (amount, currency?, childId, attemptRequestId?, privateAttemptId?, description?, provider?)
  - Response (exact shape in code): { id: string; checkoutUrl: string; expiresAt: Date; status: PaymentStatusEnum }
  - Important server-side check: `createPayment` asserts the child belongs to the authenticated parent by joining `children` -> `parents` and checking `p."userId" = :userId`.

- POST /payments/webhook
  - Public; Raw body required and `x-moyasar-signature` header validated. Response: { accepted: boolean, deduplicated?: boolean }

- POST /payments/:attemptId/initiate
  - Roles: PARENT
  - Response: `EvaluationSlotService.initiateOrRefreshExtraPayment` result (checkout data)

- POST /payments/:id/retry
  - Roles: PARENT
  - Response: `PaymentsService.retryPayment` → { id, checkoutUrl, expiresAt, status }

Status codes (exceptions thrown in code)
- The code uses Nest exceptions which map to HTTP statuses:
  - `BadRequestException` → 400
  - `UnauthorizedException` → 401
  - `ForbiddenException` → 403
  - `NotFoundException` → 404
  - `ConflictException` → 409

## PART 4 — API CONTRACT SUMMARY (FOR FRONTEND)

Key Types (code-exact shapes simplified):

Child:
{
  id: string
  name: string
  birthDate: string
  gender: string
  classId: string | null
  organizationId: string | null
  createdById: string  // User.id
  parentId: string     // ParentProfile.id
  createdAt: string
  updatedAt: string
}

Parent (ParentProfile simplified exposure):
{
  id: string         // ParentProfile.id
  userId: string     // User.id (account)
  createdAt: string
  updatedAt: string
}

Payment creation response:
{
  id: string
  checkoutUrl: string
  expiresAt: Date
  status: string (PaymentStatusEnum)
}

EvaluationAttempt (entity fields):
{
  id: string
  parentId: string  // ParentProfile.id
  childId: string
  evaluationId: string
  attemptNumber: number
  status: string
  score: number | null
  startedAt: Date
  expiresAt: Date | null
  submittedAt: Date | null
  answers: Array<...>
  approval: object | null
  result: object | null
}

Meaning of identifiers and usage guidance:
- `parentId` (on `Child` and `EvaluationAttempt`) is the `ParentProfile.id` — it represents the domain parent profile record.
- `parentUserId` (where present) / `ParentProfile.userId` is the `User.id` for the account that owns the parent profile.
- Frontend should use `ParentProfile.userId` (often available as `child.parent.userId`) when comparing to the currently authenticated user's `id` (session user id). Do NOT compare `child.parentId` to the session user id.

Where to use each:
- To check account ownership (session.user.id === account owner): compare session.user.id to `child.parent.userId` (or `ParentProfile.userId`).
- To reference parent domain object: use `child.parentId` when making calls that require the ParentProfile id.

## PART 5 — BUSINESS LOGIC RULES

- Organization approval gating: When creating institutional child (`createChild`), `organizationsService.assertOrganizationApproved(currentOrganizationId)` is called; unapproved orgs are blocked from child creation.
- Parent ownership rules: ParentProfile is the canonical parent domain. Ownership checks compare `child.parent?.userId === actor.userId` in `ChildAccessPolicy`. ParentProfile is created/ensured via `ParentProfilesService.ensureParentProfileForUser(userId)` when a parent creates private children.
- Private child rules: `classId === null` and `organizationId === null` denote private children. Limits: parent can have at most 2 private children (enforced in `createChildByParent`).
- Multi-organization parent support: parents can be linked to multiple organizations via `ParentOrganization` rows (`linkParentToOrganization` ensures a unique (parentId, organizationId) link). Creating an org child links parent to the organization.
- Evaluation access rules: For private children, slots are used (`EvaluationSlotService`) to control main/retake/extra entitlements. Attempts are tied to ParentProfile.id and childId; parents can only start/retake/extra for children that belong to their ParentProfile (checked by `loadPrivateChildOrThrow` and other checks).
- Payment ownership rules: `PaymentsService.createPayment` ensures the `childId` belongs to the authenticated parent by joining `children` -> `parents` and checking `p."userId" = :userId`. `retryPayment` validates `payment.userId === userId`.

## PART 6 — CRITICAL FLOW VALIDATION

Verify and describe main flows (code paths):

1. Parent flow:
- create private child: POST /parent/children → `ChildrenService.createChildByParent`.
  - ensures `ParentProfile` exists for `req.user.userId` (`ensureParentProfileForUser`), enforces max 2 private children, returns saved `Child` (organizationId=null, classId=null, parentId=ParentProfile.id).
- list private children: GET /parent/children → `findPrivateChildrenForParent` returning children with usage info (`retakeUsed`, `attemptsUsed`).
- evaluate child: POST /attempts/:childId/start → `EvaluationSlotService.startMainSlot(childId, user.userId)` which checks private child ownership and usage quota, then creates an `EvaluationSlot` (READY) entitling an attempt; lifecycle services create attempt records.
- payment for attempt: For extra attempts, parent requests extra (`POST /attempts/:childId/request-extra`) → creates `EvaluationSlot` (REQUESTED) requiring approval; admin approves via POST /admin/attempts/:id/approve → creates payment via `PaymentsService.createPaymentForPrivateExtraAttempt` and attaches `paymentId` to slot; webhook then marks payment PAID and `EvaluationSlotService.handlePaymentSuccess` transitions slot to READY.

2. Organization flow:
- create child: POST /children (org role) — service checks org membership, ensures organization approved, uses `ParentProfilesService.getOrCreateParentByContact` to find/create parent User & ParentProfile, links parent to org, checks existing child duplicates by birthDate & parent profile; if child exists in another org triggers transfer flow.
- assign parent: parent linkage created via ParentProfile (parent created/ensured) and `ParentProfilesService.linkParentToOrganization`.
- transfer logic: If creating a child and an existing child exists with same birthDate and same parent in another org, `TransferService.requestTransfer` is called which creates a `TransferRequest` (PENDING); org owner can approve (PATCH :id/approve) which sets child.organizationId & child.classId and transfer.status = APPROVED.
- filtering per org: GET /children/organization/:orgId returns children for that organization (requires org membership).

3. Security:
- Parent cannot access another parent's child: enforced by `ChildAccessPolicy.assertReadAccess` which checks `child.parent?.userId === actor.userId` for PARENT role.
- Org cannot access private children: `isPrivateChild` checks `classId === null`; org endpoints only return children where `organizationId` matches.
- payment ownership enforced: `PaymentsService.createPayment` and `retryPayment` both check `userId` matches the payment/user context and that the child belongs to this parent via DB join.

## PART 7 — BREAKING CHANGES (VERY IMPORTANT)

List of breaking changes caused by ParentProfile migration (code observations):
- child.parentId used to be User.id → now ParentProfile.id
  - Evidence: `Child` entity maps parent to `ParentProfile`; `children.service.ts.backup` indicates previous code treated parentId as user id.
  - Impact: HIGH (frontend ownership comparisons break).
- Endpoints now return `parent` relation (when loaded) whose `userId` is the account id; frontends must use `child.parent.userId` for account-level comparisons.
  - Impact: MEDIUM.

## PART 8 — FRONTEND COMPATIBILITY CONTRACT

Frontend MUST change:
- types: treat `child.parentId` as `ParentProfile.id` and use `child.parent.userId` (or server-provided `parentProfile.userId`) to compare with session user id.
- comparisons: update auth/ownership checks accordingly.

Example:
❌ WRONG:
child.parentId === session.user.id

✅ CORRECT:
child.parent?.userId === session.user.id

## PART 9 — MISSING / WEAK AREAS

- missing validations: ensure no console logging of generated passwords (`console.log(parentPassword)` present in `ParentProfilesService`).
- missing tests: payment webhook worker flows and admin-approval -> payment -> unlock flow should have dedicated e2e tests.
- possible bugs: mixed return shapes (sometimes entity, sometimes mapped object) — frontend must handle both.

## PART 10 — FINAL CTO REPORT

1. Backend Score (0–100): 82
2. Strengths:
  - Clear domain separation between account (`User`) and domain parent (`ParentProfile`).
  - Centralized access policies for child & evaluation access.
  - Payment processing designed with idempotency, provider abstraction, and queueing.
3. Risks:
  - Frontend compatibility break (HIGH) due to ParentProfile migration.
  - Sensitive logging (temporary password printed to console).
4. Technical debt:
  - Inconsistent response shapes; missing explicit response DTOs in some controllers.
5. Readiness:
  - Conditional Go: functional but requires frontend changes and security fix (remove password logs) before full rollout.
6. Recommended next steps:
  - Remove console logging of generated passwords.
  - Add `GET /parents/me` or include parentProfile in `GET /users/me`.
  - Add tests around payment webhook and transfer approval flows.
  - Standardize response DTOs for critical endpoints.

## PART 11 — GENERATE AI CONTEXT FILE

This file (`docs/backend-api-contract.md`) is the produced AI context and API contract. Keep it updated when code changes.

---

If you want, I can now:
- generate an OpenAPI fragment for the parent/children/payments endpoints, or
- scan remaining controllers and append any endpoints not yet included.
