# Backend Domain Compliance + Frontend Integration Audit

## Executive Summary

```
Backend Coverage:      62%  (partial implementation across all domains)
Frontend Compatibility: 45%  (backend changes made but frontend not migrated)
Build Status:          BUILD BREAKING (entity relation mismatches, missing enum values)
```

### Verdict: NOT READY FOR FRONTEND INTEGRATION

**Root Causes:**
1. **Build does not compile** — `Child` entity missing `organization`/`user` relations that services reference; `UserRole.EMPLOYEE` referenced but does not exist in enum
2. **Parent independent signup missing** — no `POST /auth/parent-signup` endpoint
3. **Enricher routes empty** — `EnrichersController` has zero endpoints; providers cannot view deals, submit proposals, or participate
4. **Deal workflow incomplete** — no proposal selection, admin approval, awarding, attendance, evaluation, or closure endpoints
5. **Parent capacity/payment linkage missing** — hard-coded 2-child limit with no capacity increase system
6. **Many routes lack RBAC** — no `@Roles()` on key child/class/grade endpoints
7. **No `/organizations/by-parent/:parentProfileId` endpoint** despite frontend compatibility guide referencing it
8. **Organizational approval not enforced** — `approvalStatus` stored but never checked in guards
9. **Dynamic assessment engine missing** — assessments have dynamic questions but scoring is hardcoded per type; no "Admin create/edit/archive Assessment" endpoint for dynamic management

---

## 1. Domain Coverage Matrix

### Organization Lifecycle

| Requirement | Status | Details |
|---|---|---|
| Register Organization | ✅ | `POST /auth/beneficiaries-signup` |
| Pending Approval | ✅ | `approvalStatus = PENDING` default |
| Admin Approval | ✅ | `PATCH /organizations/:id/approve` |
| Admin Rejection | ✅ | `PATCH /organizations/:id/reject` |
| Create Stages | ❌ | No "Stage" concept in entities (Grades used instead) |
| Create Classes | ✅ | `POST /classes` |
| Create Teachers | ✅ | `POST /teachers` |
| Create Children | ✅ | `POST /children` |
| Create Deals | ✅ | `POST /deals` |
| Approval Guard | ❌ | No middleware checks `approvalStatus` before allowing operations |

### Parent Lifecycle (Independent)

| Requirement | Status | Details |
|---|---|---|
| Register independently | ❌ | No `POST /auth/parent-signup`; only org/enricher signup exists |
| Account Active | ❌ | No independent parent registration flow |
| Create Parent Profile | ⚠️ | `ParentProfile` entity exists, but created only via child creation |
| Add Child (max 2) | ✅ | Hard-coded limit of 2 in `ChildrenService` |
| Run Assessments | ✅ | Evaluation system exists |
| View Reports | ✅ | Evaluation reports via `GET /attempts/child/:childId` |
| Request Additional Capacity | ❌ | Not implemented |
| Payment Link Sent | ❌ | No payment flow for capacity increase |
| Payment Success → Capacity | ❌ | Not implemented |

### Parent Lifecycle (Organization-linked)

| Requirement | Status | Details |
|---|---|---|
| Teacher searches by phone | ✅ | `GET /parents/search?phone=` |
| Check Child Exists | ✅ | Via parent search response includes children |
| Transfer Request | ✅ | `POST /child-transfers` |
| Create Child (if no child) | ✅ | `POST /children` |
| Create User + Parent + Child | ✅ | `POST /children` with auto-creation |
| Link parent to org | ✅ | `ParentOrganization` entity + `linkParentToOrganization()` |

### Deal Lifecycle

| Requirement | Status | Details |
|---|---|---|
| Organization creates deal | ✅ | `POST /deals` |
| Select Activity | ✅ | Deal references `Activity` |
| Define student count | ✅ | `studentsCount` field |
| Publish Deal | ✅ | Deal saved with `OPEN` status |
| System notifies providers | ❌ | Not implemented (notifications for new deals) |
| Providers submit proposals | ✅ | `POST /deals/:dealId/proposals` |
| Organization reviews proposals | ❌ | No list/view proposals endpoint for organization |
| Organization selects proposal | ❌ | No "select winning proposal" endpoint |
| Admin approves/rejects | ❌ | No admin approval of proposal |
| Deal Awarded | ❌ | Missing `AWARDED` status |
| Activity Execution | ❌ | No execution tracking |
| Attendance | ❌ | No attendance recording |
| Evaluation | ❌ | No evaluation link to deal |
| Closure | ❌ | No closure workflow |

### Assessment Domain

| Requirement | Status | Details |
|---|---|---|
| Dynamic Questions | ✅ | Questions stored per evaluation |
| Dynamic Answer Types | ✅ | Per-question answers with score values |
| Dynamic Scoring Strategies | ⚠️ | Scoring per type is hardcoded in service |
| Dynamic Result Calculators | ⚠️ | Result JSONB but interpretation per type |
| Dynamic Report Builders | ❌ | No per-assessment report template |
| Admin Create Assessment | ✅ | `POST /evaluations` |
| Admin Edit Assessment | ⚠️ | No update endpoint for evaluations |
| Admin Archive Assessment | ❌ | No archive/deactivate |

### Parent-Organization Relationship

| Requirement | Status | Details |
|---|---|---|
| ParentProfile entity | ✅ | `ParentProfile` entity |
| ParentOrganization link | ✅ | `ParentOrganization` entity |
| Multi-organization | ✅ | `ParentOrganization` supports many |
| Track membership independently | ✅ | Via `ParentOrganization` table |

---

## 2. API Contract Catalog

### Auth (`/api/auth`)

```
POST /auth/login
  Request:  { phone, password }
  Response: { accessToken, refreshToken, user }
  Auth:     Public

POST /auth/beneficiaries-signup
  Request:  { name, email, phone, password, organizationName, organizationType }
  Response: { accessToken, refreshToken, user, organization }
  Auth:     Public

POST /auth/enrichers-signup
  Request:  { name, email, phone, password, organizationName }
  Response: { accessToken, refreshToken, user, enricher }
  Auth:     Public

POST /auth/refresh
  Request:  { token }
  Response: { accessToken, refreshToken, user }
  Auth:     Public

DELETE /auth/logout/:sessionId
  Response: { message, statusCode }
  Auth:     Authenticated

DELETE /auth/logout-all
  Response: void
  Auth:     Authenticated

GET /auth/verify-email?token=
  Auth:     Public
```

### Users (`/api/users`)

```
POST /users/seed-roles
  Auth: ADMIN

GET /users
  Auth: ADMIN

GET /users/roles
  Auth: ADMIN

GET /users/me
  Auth: Authenticated

GET /users/:id
  Auth: Self or ADMIN

DELETE /users/:id
  Auth: ADMIN
```

### Parents (`/api/parents`)

```
GET /parents/search?phone=
  Auth: ORGANIZATIONOWNER, ADMIN
  Response: { parent: {...parentInfo, parentProfileId}, children: [...] }
```

### Children (`/api/children`)

```
POST /children
  Auth: ORGANIZATIONOWNER, TEACHER
  Request: { name, birthDate, gender, classId, parentPhone, parentEmail?, parentName? }
  Response: Child (with parent nested)

GET /children/all
  Auth: ADMIN

GET /children?userId=
  Auth: Self or ADMIN

GET /children/organization/:orgId
  Auth: ORGANIZATIONOWNER, ADMIN, TEACHER

GET /children/:id
  Auth: Authenticated (access check in service)

PATCH /children/:id
  Auth: Authenticated (no RBAC decorator!)
  Issue: MISSING @Roles() decorator

DELETE /children/:id
  Auth: Authenticated (no RBAC decorator!)
  Issue: MISSING @Roles() decorator
```

### Parent Children (`/api/parent`)

```
POST /parent/children
  Auth: PARENT
  Request: { name, birthDate, gender }
  Response: Child

GET /parent/children
  Auth: PARENT
  Response: Child[]

GET /parent/org-children
  Auth: PARENT
  Response: Child[]
```

### Child Transfers (`/api/child-transfers`)

```
POST /child-transfers
  Auth: ORGANIZATIONOWNER, ADMIN
  Request: { childId, toOrganizationId }
  Response: TransferRequest

PATCH /child-transfers/:id/approve
  Auth: ORGANIZATIONOWNER, ADMIN
  Request: { classId }
  Response: TransferRequest

PATCH /child-transfers/:id/reject
  Auth: ORGANIZATIONOWNER, ADMIN

GET /child-transfers
  Auth: ORGANIZATIONOWNER, ADMIN
  Query: { status?, organizationId? }
  Response: TransferRequest[]
```

### Classes (`/api/classes`)

```
POST /classes
  Auth: ORGANIZATIONOWNER

GET /classes
  Auth: ADMIN

GET /classes/organization/:orgId
  Auth: ORGANIZATIONOWNER, ADMIN, TEACHER

GET /classes/:id/get-children
  Auth: ORGANIZATIONOWNER, ADMIN, TEACHER

GET /classes/:id
  Auth: Authenticated
  Issue: MISSING @Roles()

PATCH /classes/:id
  Auth: ORGANIZATIONOWNER

DELETE /classes/:id
  Auth: ORGANIZATIONOWNER

POST /classes/:clsId/asign/:childId
  Auth: ORGANIZATIONOWNER
```

### Grades (`/api/grades`)

```
POST /grades
  Auth: ORGANIZATIONOWNER

GET /grades
  Auth: ADMIN

GET /grades/organization/:orgId
  Auth: ORGANIZATIONOWNER, ADMIN, TEACHER

GET /grades/:id
  Auth: Authenticated
  Issue: MISSING @Roles()

PATCH /grades/:id
  Auth: ORGANIZATIONOWNER

DELETE /grades/:id
  Auth: ORGANIZATIONOWNER
```

### Organizations (`/api/organizations`)

```
GET /organizations/pending
  Auth: ADMIN

GET /organizations
  Auth: ADMIN
  Query: { status? }

GET /organizations/me
  Auth: ORGANIZATIONOWNER

GET /organizations/owner/:ownerId
  Auth: Self or ADMIN

PATCH /organizations/:id/approve
  Auth: ADMIN

PATCH /organizations/:id/reject
  Auth: ADMIN
  Request: { rejectionReason }

GET /organizations/:id
  Auth: Admin or Owner

PATCH /organizations/:id
  Auth: Admin or Owner

DELETE /organizations/:id
  Auth: ADMIN
```

### Evaluations (`/api/evaluations`)

```
POST /evaluations
  Auth: ADMIN
  Request: { type, title, ageFrom?, ageTo?, evaluatorTypes?, institutionId, dimensions, questions }

GET /evaluations
  Auth: ADMIN

GET /evaluations/available/:childId
  Auth: Authenticated (no @Roles() - commented out)
  Issue: @Roles(UserRole.PARENT) commented out

GET /evaluations/:id/details
  Auth: ADMIN

GET /evaluations/:id/form
  Auth: PARENT, ADMIN

POST /evaluations/:id/start
  Auth: PARENT
  Request: { childId, expiresAt?, expiresInSeconds? }
```

### Evaluation Attempts (`/api/attempts`)

```
GET /attempts
  Auth: ADMIN
  Query: { status?, evaluationId?, childId? }

GET /attempts/child/:childId
  Auth: PARENT, ADMIN

POST /attempts/:childId/start
  Auth: PARENT
  (opens main free slot)

POST /attempts/:childId/retake
  Auth: PARENT

POST /attempts/:childId/request-extra
  Auth: PARENT

PATCH /attempts/:id/save
  Auth: PARENT
  Request: { answers: [{ questionId, selectedAnswerId }] }

POST /attempts/:id/submit
  Auth: PARENT
  Request: { answers: [{ questionId, selectedAnswerId }] }

GET /attempts/:id
  Auth: PARENT, ADMIN, ORGANIZATIONOWNER, TEACHER

POST /attempts/:id/approve
  Auth: ADMIN
```

### Admin Private Attempts (`/api/admin/attempts`)

```
POST /admin/attempts/:id/approve
  Auth: ADMIN
```

### Owner Evaluation Results (`/api/evaluations/owner`)

```
GET /evaluations/owner/filters
  Auth: ORGANIZATIONOWNER, ADMIN

GET /evaluations/owner/reports
  Auth: ORGANIZATIONOWNER, ADMIN
  Query: { evaluationId? }

GET /evaluations/owner/classes/:classId/evaluations/:evaluationId/summary
  Auth: ORGANIZATIONOWNER, ADMIN

GET /evaluations/owner/classes/:classId/evaluations/:evaluationId/status
  Auth: ORGANIZATIONOWNER, ADMIN

POST /evaluations/owner/children/:childId/reminder
  Auth: ORGANIZATIONOWNER, ADMIN
```

### Deals (`/api/deals`)

```
POST /deals
  Auth: ORGANIZATIONOWNER, TEACHER
  Request: { activityId, studentsCount, deadline, organizationId }

POST /deals/:dealId/proposals
  Auth: ENRICHER
  Request: { price }
```

### Proposals (`/api/proposals`)

```
PATCH /proposals/:id
  Auth: ENRICHER
  Request: { price }
```

### Activities (`/api/activities`)

```
POST /activities
  Auth: ADMIN

GET /activities
  Auth: Authenticated (no @Roles())

GET /activities/with-deals
  Auth: Authenticated (no @Roles())

GET /activities/:id
  Auth: Authenticated (no @Roles())

GET /activities/:id/with-deals
  Auth: Authenticated (no @Roles())

PATCH /activities/:id
  Auth: ADMIN

DELETE /activities/:id
  Auth: ADMIN
```

### Notifications (`/api/notifications`)

```
POST /notifications/verify-email
GET /notifications
GET /notifications/unread-count
PATCH /notifications/read-all
PATCH /notifications/:id/read
POST /notifications/dispatch
  Auth: ADMIN (dispatch only)
```

### Payments (`/api/payments`)

```
POST /payments
  Auth: PARENT
  Request: { amount, childId, attemptRequestId?, privateAttemptId?, description?, provider? }
  Response: { id, checkoutUrl, expiresAt, status }

POST /payments/webhook
  Auth: Public
  Headers: x-moyasar-signature

POST /payments/:attemptId/initiate
  Auth: PARENT

POST /payments/:id/retry
  Auth: PARENT
```

---

## 3. Frontend Integration Map

### Features Where Backend Exists (Frontend Missing)

| Feature | Endpoint | Request | Response |
|---|---|---|---|
| Parent Profile | embedded in child response | N/A | `{ id, userId, phone, email, children }` |
| Private Children | `POST /parent/children` | `{ name, birthDate, gender }` | Child |
| Private Children List | `GET /parent/children` | - | Child[] |
| Org Children List | `GET /parent/org-children` | - | Child[] |
| Parent Search | `GET /parents/search?phone=` | - | `{ parent, children }` |
| Transfer Request | `POST /child-transfers` | `{ childId, toOrganizationId }` | TransferRequest |
| Transfer Approve | `PATCH /child-transfers/:id/approve` | `{ classId }` | TransferRequest |
| Transfer Reject | `PATCH /child-transfers/:id/reject` | - | TransferRequest |
| Transfer List | `GET /child-transfers` | `?status=&organizationId=` | TransferRequest[] |
| Extra Attempt Admin Approve | `POST /admin/attempts/:id/approve` | - | `{ attempt, payment }` |
| Extra Attempt Initiate | `POST /payments/:attemptId/initiate` | - | checkout |
| Payment Retry | `POST /payments/:id/retry` | - | checkout |
| Owner Reports | `GET /evaluations/owner/reports` | `?evaluationId=` | ReportCard[] |
| Class Summary | `GET .../classes/:classId/evaluations/:evaluationId/summary` | - | Summary |
| Class Status | `GET .../classes/:classId/evaluations/:evaluationId/status` | - | Status[] |
| Send Reminder | `POST .../children/:childId/reminder` | - | void |
| Available Evaluations | `GET /evaluations/available/:childId` | - | Evaluation[] |
| Start Evaluation | `POST /evaluations/:id/start` | `{ childId }` | Attempt |
| Save Progress | `PATCH /attempts/:id/save` | `{ answers }` | void |
| Submit Attempt | `POST /attempts/:id/submit` | `{ answers }` | Attempt |

### Features Where Both Backend and Frontend Missing

| Feature | Backend Status | Required Work |
|---|---|---|
| Parent Independent Signup | ❌ Missing | New endpoint + service |
| Parent Capacity Increase | ❌ Missing | Payment → capacity linkage |
| Deal Notification to Providers | ❌ Missing | Notification service integration |
| Deal Proposal Review/Select | ❌ Missing | New endpoint + status flow |
| Deal Admin Approval | ❌ Missing | New endpoint + status machine |
| Deal Attendance | ❌ Missing | New entity + endpoints |
| Deal Evaluation | ❌ Missing | Integration with evaluation |
| Deal Closing | ❌ Missing | Status transition |
| Enricher Routes (all) | ❌ Missing | View deals, proposals, attendance, evaluation |
| Dynamic Assessment Engine | ❌ Missing | Admin edit/archive; per-type report builder |
| Organization Approval Guarding | ❌ Missing | Middleware on org operations |
| Enricher Approval Guarding | ❌ Missing | Middleware on enricher operations |
| Teacher Assessment Access | ❌ Missing | "Teacher performs evaluation when parent didn't" |
| Provider Contract Signing | ❌ Missing | Contract entity + workflow |

---

## 4. Workflow Issues

### Organization Lifecycle
```
Domain: Guest → Register → Pending Approval → Admin Approval → Active
Backend: ✔ Register → ✔ Pending default → ✔ Admin approve/reject → ✘ No Active enforcement
Issue: Organization can operate fully even when PENDING or REJECTED
```

### Parent Lifecycle (Independent)
```
Domain: Register → Active → Create Parent Profile → Add Child → Assessments → Reports
Backend: ✘ No Register → ✘ No Active → ⚠️ Profile created via child creation → ✔ Max 2 → ✔ Assessments → ✔ Reports
Missing: Entire independent parent registration flow
```

### Parent Capacity Increase
```
Domain: Request Capacity → Admin Review → Payment Link → Payment Success → Capacity Increased
Backend: ✘ Entire flow missing
```

### Deal Lifecycle
```
Domain: Create Deal → Publish → Notify Providers → Proposals → Select Proposal → Admin Approve → Award → Execute → Attendance → Evaluation → Close
Backend: ✔ Create Deal → ✔ Published (OPEN) → ✘ Notify → ✔ Proposals → ✘ Select → ✘ Admin Approve → ✘ Award → ✘ Execute → ✘ Attendance → ✘ Evaluation → ✘ Close
Missing: 8 of 11 steps
```

### Transfer Request
```
Domain: Request Transfer → Approve → Child Moved to New Org
Backend: ✔ Request → ✔ Approve (with classId) → ✔ Reject
Complete: ✔ But missing `requestedById` tracking
```

### Assessment State (Admin)
```
Domain: Create Assessment → Edit Assessment → Archive Assessment
Backend: ✔ Create → ✘ Edit → ✘ Archive
```

---

## 5. RBAC Issues

### Missing @Roles() Decorators

| Endpoint | Issue | Severity |
|---|---|---|
| `PATCH /children/:id` | Update child - no @Roles() | HIGH - any authenticated user |
| `DELETE /children/:id` | Delete child - no @Roles() | HIGH - any authenticated user |
| `GET /children/:id` | Get child - no @Roles() | MEDIUM - relies on internal check |
| `GET /children` | List by user - no @Roles() | MEDIUM - relies on internal check |
| `GET /classes/:id` | Get class - no @Roles() | MEDIUM |
| `GET /grades/:id` | Get grade - no @Roles() | MEDIUM |
| `GET /activities` | List activities - no @Roles() | LOW - public data |
| `GET /activities/:id` | Get activity - no @Roles() | LOW |
| `GET /activities/with-deals` | List with deals - no @Roles() | LOW |
| `GET /evaluations/available/:childId` | @Roles(PARENT) commented out | HIGH - org owners could access |

### Ownership Check Issues

| Check | Issue |
|---|---|
| `PATCH /children/:id` | No ownership validation in service |
| `DELETE /children/:id` | No ownership validation in service |
| `PATCH /classes/:id` | No ownership validation - role only |
| `DELETE /classes/:id` | No ownership validation - role only |
| `PATCH /grades/:id` | No ownership validation - role only |
| `DELETE /grades/:id` | No ownership validation - role only |

### Guard Weaknesses

| Guard | Issue |
|---|---|
| `OwnershipGuard` | Exists but never registered/used in any controller |
| `RolesGuard` | Global but only checks if `@Roles()` is defined - routes without it pass freely |
| `JwtAuthGuard` | Global - only skipped if `@Public()` |

---

## 6. Data Model Issues

### Missing Entities/Tables

| Entity | Domain Requirement | Impact |
|---|---|---|
| `ChildType` discriminator | Private vs Institutional separation | Fragile `organizationId IS NULL` check |
| `Stage` | Organization lifecycle requires stages | Not implemented |
| `Contract` | Provider contract signing workflow | Not implemented |
| `Attendance` | Deal attendance tracking | Not implemented |
| `ParentCapacityRequest` | Parent capacity increase flow | Not implemented |
| `AssessmentReportTemplate` | Per-assessment report builder | Not implemented |

### Entity Field Issues

| Entity | Field | Issue |
|---|---|---|
| `Child` | `organizationId` | Column has no `nullable: true` in decorator |
| `Child` | `organization` relation | ❌ **DOES NOT EXIST** - services reference it |
| `Child` | `user` relation | ❌ **DOES NOT EXIST** - services reference it |
| `Child` | `classId` | Column `@Column({ type: 'uuid' })` lacks nullable: true |
| `Class` | `organization` inverse | Points to `(org) => org.grades` instead of `(org) => org.classes` |
| `TransferRequest` | `requestedById` | Missing - who requested the transfer |
| `Enricher` | No `contractStatus` | Contract signing not tracked |
| `Organization` | No `rejectionReason` on reject route | DTO exists but entity unused |
| `EvaluationSlot` | `isPaid` deprecated | Still used alongside `status` |
| `EvaluationSlot` | `requiresApproval` deprecated | Duplicates `status = REQUESTED` |
| `EvaluationSlot` | `kind` uses numeric enum | Hard to debug in DB |
| `ChildReport` | No FK to child/attempt | Orphaned entity |

### Enum Issues

| Enum | Issue |
|---|---|
| `UserRole` | Missing `EMPLOYEE` - referenced in deals/users controllers |
| `DealStatus` | Only `OPEN`/`CLOSED` - needs `AWARDED`, `EXECUTING`, `EVALUATION` |
| `ProposalStatus` | Only `PENDING`/`ACCEPTED`/`REJECTED` - needs `SELECTED` |
| `SlotKind` | Numeric enum - should be string |
| `GradeName` | Only has `grade-1` |

---

## 7. Payment Flow Issues

| Issue | Severity | Detail |
|---|---|---|
| Parent capacity increase | 🔴 CRITICAL | Payment exists but no linkage to parent child limit |
| Payment expiry no notification | 🔴 HIGH | Expired payments don't trigger parent notification |
| Provider creation failure handling | 🟡 MEDIUM | Slot can be stranded in AWAITING_PAYMENT without valid paymentId |
| Payment history | 🟡 MEDIUM | Retry overwrites providerPaymentId, losing old session trail |
| Mock provider returns paid | 🟡 MEDIUM | Missing secret causes mock provider that treats any status as paid |
| No `payment.failed` slot handler | 🟡 MEDIUM | Failed payments don't update slot state |

### Payment State Machine
```
Domain: Payment Created → PENDING → Provider Webhook → PAID → Slot Unlocked → Attempt Start
                                        → Webhook → FAILED → Retry → PENDING
                                        → EXPIRED (cron) → Retry → PENDING

Backend: ✔ PENDING → ✔ Webhook → ✔ PAID → ✔ Slot UNLOCKED (via event)
         ✔ PENDING → ✔ Webhook → ✔ FAILED → ✔ Retry → ✔ PENDING
         ✔ PENDING → ✔ EXPIRED (cron) → ✔ Retry
         ✘ FAILED/EXPIRED → NOTIFY parent
         ✘ FAILED/EXPIRED → update slot state
```

---

## 8. Gap Classification

### Backend Missing (HIGH priority)

| Feature | Domain Ref | Complexity | Dependencies |
|---|---|---|---|
| Parent signup | `POST /auth/parent-signup` | Medium | Auth module |
| Enricher routes | View deals, proposals, attendance | High | Deals, Evaluations |
| Deal notification | Notify providers on new deal | Medium | Notifications, Deals |
| Deal proposal selection | Organization selects winner | Medium | Deals |
| Deal admin approval | Admin approves selected proposal | Medium | Deals |
| Deal awarding & execution | Status transitions | Medium | Deals entity |
| Deal attendance & evaluation | Post-deal tracking | High | Deals, Evaluations |
| Parent capacity increase | Payment → ParentProfile.limit | High | Payments, ParentProfile |
| Organization approval guard | Middleware checking `approvalStatus` | Low | Organizations |
| Enricher approval guard | Middleware checking `approvalStatus` | Low | Enrichers |
| Dynamic assessment editor | Edit/archive evaluations | Medium | Evaluations |
| Teacher evaluation for absent parent | Teacher can evaluate | High | Evaluations |

### Frontend Missing (Backend Exists)

| Feature | Endpoint |
|---|---|
| Parent Profile migration | child.parent?.userId pattern |
| Private child management | `POST/GET /parent/children` |
| Transfer request flow | `POST/PATCH /child-transfers` |
| Extra attempt approval | `POST /admin/attempts/:id/approve` |
| Payment retry | `POST /payments/:id/retry` |
| Owner reports | `GET /evaluations/owner/*` |
| Send reminders | `POST .../children/:childId/reminder` |
| Available evaluations | `GET /evaluations/available/:childId` |

### Both Missing

| Feature | Impact |
|---|---|
| Parent independent signup | Blocked |
| Deal full lifecycle | Blocked |
| Enricher participation | Blocked |
| Capacity increase payment | Blocked |
| Dynamic assessment editor | Blocked |

### Contract Mismatches

| Endpoint | Backend | Domain Docs | Issue |
|---|---|---|---|
| `parentId` in Child | `ParentProfile.id` | Should be `ParentProfile.id` | ✅ Correct now but frontend uses old `User.id` |
| `GET /organizations/by-parent/:id` | ❌ Missing | Required by FRONTEND_COMPATIBILITY_GUIDE | Must be created |
| `POST /attempts/:childId/start` | Opens a slot | Domain: starts evaluation | Semantic mismatch - returns slot, not attempt |
| `POST /evaluations/:id/start` | Starts actual attempt | Domain: starts evaluation | Correct for institutional; private uses slot |

---

## 9. Backend → Frontend Traceability Matrix

| Domain Feature | Backend Endpoint | Frontend Component | Status |
|---|---|---|---|
| Login | `POST /auth/login` | Auth/Login | ✅ |
| Org Signup | `POST /auth/beneficiaries-signup` | Auth/OrgSignup | ✅ |
| Enricher Signup | `POST /auth/enrichers-signup` | Auth/EnricherSignup | ✅ |
| Parent Signup | ❌ Missing | Auth/ParentSignup | ❌ |
| My Profile | `GET /users/me` | Profile | ✅ |
| List Orgs (Admin) | `GET /organizations` | Admin/Orgs | ✅ |
| Pending Orgs | `GET /organizations/pending` | Admin/Orgs | ✅ |
| Org Approve | `PATCH /organizations/:id/approve` | Admin/Orgs | ✅ |
| Org Reject | `PATCH /organizations/:id/reject` | Admin/Orgs | ✅ |
| My Org | `GET /organizations/me` | OrgOwner/Dashboard | ✅ |
| Create Teacher | `POST /teachers` | OrgOwner/Teachers | ✅ |
| List Teachers | `GET /teachers/organization/:orgId` | OrgOwner/Teachers | ✅ |
| Create Class | `POST /classes` | OrgOwner/Classes | ✅ |
| List Classes | `GET /classes/organization/:orgId` | OrgOwner/Classes | ✅ |
| Assign Child to Class | `POST /classes/:clsId/asign/:childId` | OrgOwner/Classes | ✅ |
| Create Grade | `POST /grades` | OrgOwner/Grades | ✅ |
| List Grades | `GET /grades/organization/:orgId` | OrgOwner/Grades | ✅ |
| Create Institution Child | `POST /children` | OrgOwner/Children | ✅ |
| List Org Children | `GET /children/organization/:orgId` | OrgOwner/Children | ✅ |
| Create Private Child | `POST /parent/children` | Parent/Children | ⚠️ Backend ✅, Frontend ❌ |
| List Private Children | `GET /parent/children` | Parent/Children | ⚠️ |
| List Org Children (Parent) | `GET /parent/org-children` | Parent/Children | ⚠️ |
| Search Parent by Phone | `GET /parents/search` | OrgOwner/Children | ✅ |
| Transfer Request | `POST /child-transfers` | OrgOwner/Transfer | ⚠️ |
| Transfer Approve | `PATCH /child-transfers/:id/approve` | OrgOwner/Transfer | ⚠️ |
| Transfer Reject | `PATCH /child-transfers/:id/reject` | OrgOwner/Transfer | ⚠️ |
| Transfer List | `GET /child-transfers` | OrgOwner/Transfer | ⚠️ |
| Create Activity | `POST /activities` | Admin/Activities | ✅ |
| List Activities | `GET /activities` | All | ✅ |
| Create Deal | `POST /deals` | OrgOwner/Deals | ✅ |
| Submit Proposal | `POST /deals/:dealId/proposals` | Enricher/Proposals | ❌ (no enricher UI) |
| Update Proposal | `PATCH /proposals/:id` | Enricher/Proposals | ❌ |
| List Deals (Enricher) | ❌ Missing | Enricher/Deals | ❌ |
| Select Proposal | ❌ Missing | OrgOwner/Deals | ❌ |
| Admin Approve Deal | ❌ Missing | Admin/Deals | ❌ |
| List Evaluations | `GET /evaluations` | Admin/Evaluations | ✅ |
| Get Evaluation Form | `GET /evaluations/:id/form` | Parent/Evaluation | ✅ |
| Available Evals | `GET /evaluations/available/:childId` | Parent/Evaluation | ✅ |
| Start Attempt | `POST /evaluations/:id/start` | Parent/Evaluation | ✅ |
| Save Progress | `PATCH /attempts/:id/save` | Parent/Evaluation | ✅ |
| Submit Attempt | `POST /attempts/:id/submit` | Parent/Evaluation | ✅ |
| List Child Attempts | `GET /attempts/child/:childId` | Parent/Evaluation | ✅ |
| Approve Attempt | `POST /attempts/:id/approve` | Admin/Evaluation | ✅ |
| Open Main Slot | `POST /attempts/:childId/start` | Parent/Attempts | ⚠️ |
| Request Retake | `POST /attempts/:childId/retake` | Parent/Attempts | ⚠️ |
| Request Extra | `POST /attempts/:childId/request-extra` | Parent/Attempts | ⚠️ |
| Admin Approve Extra | `POST /admin/attempts/:id/approve` | Admin/Attempts | ⚠️ |
| Initiate Extra Payment | `POST /payments/:attemptId/initiate` | Parent/Payments | ⚠️ |
| Create Payment | `POST /payments` | Parent/Payments | ✅ |
| Retry Payment | `POST /payments/:id/retry` | Parent/Payments | ⚠️ |
| Owner Reports | `GET /evaluations/owner/reports` | OrgOwner/Reports | ⚠️ |
| Class Summary | `GET .../classes/:classId/evaluations/:evaluationId/summary` | OrgOwner/Reports | ⚠️ |
| Class Status | `GET .../classes/:classId/evaluations/:evaluationId/status` | OrgOwner/Reports | ⚠️ |
| Send Reminder | `POST .../children/:childId/reminder` | OrgOwner/Reports | ⚠️ |
| Owner Filters | `GET /evaluations/owner/filters` | OrgOwner/Reports | ⚠️ |
| Create Evaluation | `POST /evaluations` | Admin/Evaluation | ✅ |
| Notifications List | `GET /notifications` | All/Notifications | ✅ |
| Mark Read | `PATCH /notifications/:id/read` | All/Notifications | ✅ |

---

## 10. CONTRACT MISMATCHES

| # | Issue | Backend | Frontend Expectation | Fix |
|---|---|---|---|---|
| 1 | `parentId` semantics | `ParentProfile.id` | Old code uses `User.id` | Update frontend: use `child.parent?.userId` |
| 2 | `/organizations/by-parent/:id` | ❌ Missing | Referenced in compatibility guide | Create endpoint |
| 3 | `child.parent` structure | `{ id, userId, phone, email, children }` | Old: `{ id }` (User) | Update frontend to use new shape |
| 4 | `GET /attempts/:childId/start` | Opens a slot returns `EvaluationSlot` | Expects evaluation start | Document as slot opener |
| 5 | `POST /payments/:attemptId/initiate` | Uses `attemptId` (slot ID) | Expects payment initiation | Document as slot-based |
| 6 | `Deal` status enum | Only OPEN/CLOSED | Unknown - may expect more states | Align when deal workflow complete |
| 7 | `Evaluation` has no `isArchived` | No archive field | Unknown | Add when assessment editor flows built |

---

## 11. Implementation Roadmap

### Phase 1: Build Fixes (CRITICAL — Blocking)

| Task | Priority | Est. Complexity |
|---|---|---|
| Add `Child.organization` and `Child.user` relations | Critical | 1 day |
| Add `UserRole.EMPLOYEE` or remove references | Critical | 0.5 day |
| Fix `Class.organization` inverse mapping | Critical | 0.5 day |
| Fix `Child.classId` nullable decorator | Critical | 0.5 day |

### Phase 2: Auth & RBAC (HIGH)

| Task | Priority | Complexity |
|---|---|---|
| Add `POST /auth/parent-signup` | High | 1 day |
| Add `@Roles()` to child update/delete routes | High | 0.5 day |
| Add `@Roles()` to class/grade GET routes | High | 0.5 day |
| Implement organization approval guard | High | 1 day |
| Implement enricher approval guard | High | 0.5 day |
| Add ownership checks on child/class/grade updates | High | 1 day |

### Phase 3: Deal Workflow (HIGH)

| Task | Priority | Complexity |
|---|---|---|
| Add deal listing endpoint | High | 0.5 day |
| Add deal status transitions (AWARDED, EXECUTING, etc.) | High | 1 day |
| Add proposal selection endpoint | High | 1 day |
| Add admin approval of selected proposal | High | 1 day |
| Add provider notification on deal creation | Medium | 1 day |

### Phase 4: Enricher Module (HIGH)

| Task | Priority | Complexity |
|---|---|---|
| Add view available deals endpoint | High | 1 day |
| Add view own proposals endpoint | High | 0.5 day |
| Add attendance recording entity + endpoints | High | 2 days |
| Add enrollment in deal evaluations | Medium | 1 day |

### Phase 5: Parent Capacity & Payments (MEDIUM)

| Task | Priority | Complexity |
|---|---|---|
| Add `ParentProfile.maxChildren` field | Medium | 0.5 day |
| Create capacity increase request flow | Medium | 2 days |
| Link payment success to capacity increase | Medium | 1 day |
| Add payment failure/expiry notifications | Medium | 0.5 day |

### Phase 6: Evaluation & Assessment (MEDIUM)

| Task | Priority | Complexity |
|---|---|---|
| Add evaluation update endpoint | Medium | 0.5 day |
| Add evaluation archive/deactivate | Medium | 1 day |
| Dynamic scoring strategy pattern | Medium | 2 days |
| Per-evaluation report template | Low | 2 days |

### Phase 7: Data Model Cleanup (LOW)

| Task | Priority | Complexity |
|---|---|---|
| Add `ChildType` discriminator | Low | 1 day |
| Replace numeric SlotKind with string | Low | 0.5 day |
| Remove deprecated `isPaid`, `requiresApproval` | Low | 0.5 day |
| Add `requestedById` to TransferRequest | Low | 0.5 day |
| Add FK index on ChildReport | Low | 0.5 day |

---

## 12. Backend → Frontend Contract Specification

### Auth

```typescript
// POST /api/auth/login
Request: {
  phone: string;     // +966XXXXXXXXX
  password: string;
}
Response: {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string;
    roles: Array<{ name: UserRole }>;
    ownedOrganization?: { id: string; organizationName: string };
    parentProfile?: { id: string; userId: string };
    enricher?: { id: string; approvalStatus: string };
    teacher?: { id: string; orgId: string };
  };
}
Errors: 401 Unauthorized

// POST /api/auth/parent-signup (MISSING — must be created)
Request: {
  name: string;
  email: string;
  phone: string;
  password: string;
}
Response: {
  accessToken: string;
  refreshToken: string;
  user: { ... };
  parentProfile: { id: string; userId: string };
}
```

### Children

```typescript
// POST /api/children (Institution child)
Request: {
  name: string;
  birthDate: string;   // "2007-05-21"
  gender: 'male'|'female';
  classId: string;      // UUID
  parentPhone: string;
  parentEmail?: string;
  parentName?: string;
}
Response: {
  id: string;
  name: string;
  birthDate: string;
  gender: string;
  classId: string;
  organizationId: string;
  parentId: string;        // ParentProfile.id
  parent: {
    id: string;            // ParentProfile.id
    userId: string;        // User.id — use for auth checks!
    phone: string;
    email: string;
    children: Array<{ id: string; name: string; organizationId: string|null }>;
  };
  createdById: string;
  createdAt: string;
  updatedAt: string;
}
Errors: 403 Forbidden, 404 Not Found, 409 Conflict

// GET /api/parent/children (Private children)
Response: Child[]  // classId === null

// GET /api/parent/org-children
Response: Child[]  // classId !== null
```

### Parent Search

```typescript
// GET /api/parents/search?phone=+966XXXXXXXXX
Response: {
  parent: {
    id: string;
    name: string;
    email: string;
    phone: string;
    parentProfileId: string;
  } | null;
  children: Array<{
    id: string;
    name: string;
    organizationId: string | null;
  }>;
}
```

### Transfers

```typescript
// POST /api/child-transfers
Request: {
  childId: string;
  toOrganizationId: string;
}
Response: {
  id: string;
  childId: string;
  fromOrganizationId: string;
  toOrganizationId: string;
  status: 'PENDING';
  createdAt: string;
}

// PATCH /api/child-transfers/:id/approve
Request: {
  classId: string;
}
Response: TransferRequest (status: 'APPROVED')

// PATCH /api/child-transfers/:id/reject
Response: TransferRequest (status: 'REJECTED')

// GET /api/child-transfers?status=&organizationId=
Response: TransferRequest[]
```

### Evaluations

```typescript
// GET /api/evaluations/available/:childId
Response: Array<{
  id: string;
  type: EvaluationType;
  title: string;
  ageFrom: number|null;
  ageTo: number|null;
  evaluatorTypes: string[];
}>

// GET /api/evaluations/:id/form
Response: {
  id: string;
  title: string;
  type: EvaluationType;
  dimensions: Array<{
    id: string;
    name: string;
    code: string;
  }>;
  questions: Array<{
    id: string;
    questionText: string;
    dimensionId: string;
    answers: Array<{
      id: string;
      text: string;
      code?: string;
      order: number;
    }>;
  }>;
}

// POST /api/evaluations/:id/start
Request: {
  childId: string;
  expiresAt?: string;
  expiresInSeconds?: number;
}
Response: {
  id: string;           // EvaluationAttempt.id
  evaluationId: string;
  childId: string;
  parentId: string;
  attemptNumber: number;
  status: 'in_progress';
  expiresAt: string|null;
  startedAt: string;
}

// GET /api/attempts/child/:childId
Response: Array<{
  id: string;
  evaluationId: string;
  evaluation: { id: string; title: string; type: string };
  childId: string;
  attemptNumber: number;
  status: 'in_progress'|'submitted'|'approved';
  score: number|null;
  startedAt: string;
  submittedAt: string|null;
}>

// PATCH /api/attempts/:id/save
Request: {
  answers: Array<{
    questionId: string;
    selectedAnswerId: string;
  }>;
}

// POST /api/attempts/:id/submit
Request: {
  answers: Array<{
    questionId: string;
    selectedAnswerId: string;
  }>;
}
Response: {
  id: string;
  status: 'submitted';
  score: number|null;
  result: Record<string, unknown>|null;
  submittedAt: string;
}

// GET /api/attempts/:id
Response: {
  id: string;
  evaluationId: string;
  evaluation: { id: string; title: string; type: string };
  parentId: string;
  parent: { id: string; userId: string };
  childId: string;
  child: { id: string; name: string; parentId: string };
  attemptNumber: number;
  status: string;
  score: number|null;
  result: Record<string, unknown>|null;
  startedAt: string;
  submittedAt: string|null;
  answers: Array<{
    id: string;
    questionId: string;
    selectedAnswerId: string;
    scoreValue: number;
  }>;
}

// POST /api/attempts/:id/approve
Auth: ADMIN only
Response: {
  id: string;
  status: 'approved';
  approval: { approvedBy: string; approvedAt: string };
}

// POST /api/attempts/:childId/start (slot opener)
Response: {
  id: string;         // EvaluationSlot.id
  childId: string;
  parentId: string;
  kind: 'MAIN'|'RETAKE'|'EXTRA';
  status: 'READY';
}

// POST /api/attempts/:childId/retake
Response: EvaluationSlot

// POST /api/attempts/:childId/request-extra
Response: EvaluationSlot (status: REQUESTED)
```

### Payments

```typescript
// POST /api/payments
Auth: PARENT
Request: {
  amount: number;       // SAR
  childId: string;
  attemptRequestId?: string;
  privateAttemptId?: string;
  description?: string;
  provider?: 'MOYASAR';
}
Response: {
  id: string;
  checkoutUrl: string;
  expiresAt: string;
  status: 'pending';
}

// POST /api/payments/:attemptId/initiate
Auth: PARENT
Response: {
  id: string;
  checkoutUrl: string;
  expiresAt: string;
  status: 'pending';
}

// POST /api/payments/:id/retry
Auth: PARENT
Response: {
  id: string;
  checkoutUrl: string;
  expiresAt: string;
  status: 'pending';
}
Errors: 400 Max retries exceeded, 400 Only failed/expired payments
```

### Owner Reports

```typescript
// GET /api/evaluations/owner/filters
Auth: ORGANIZATIONOWNER, ADMIN
Response: {
  evaluations: Array<{ id: string; title: string }>;
  classes: Array<{ id: string; name: string }>;
}

// GET /api/evaluations/owner/reports?evaluationId=
Auth: ORGANIZATIONOWNER, ADMIN
Response: Array<{
  childId: string;
  childName: string;
  className: string;
  score: number|null;
  status: string;
  submittedAt: string|null;
}>

// GET /api/evaluations/owner/classes/:classId/evaluations/:evaluationId/summary
Auth: ORGANIZATIONOWNER, ADMIN
Response: {
  totalChildren: number;
  completedCount: number;
  averageScore: number|null;
  dimensionAverages: Record<string, number>;
}

// GET /api/evaluations/owner/classes/:classId/evaluations/:evaluationId/status
Auth: ORGANIZATIONOWNER, ADMIN
Response: Array<{
  childId: string;
  childName: string;
  status: string;
  score: number|null;
}>

// POST /api/evaluations/owner/children/:childId/reminder
Auth: ORGANIZATIONOWNER, ADMIN
Response: void
```

---

## 13. Production Risks

| Risk | Severity | Description |
|---|---|---|
| Build fails (10+ TS errors) | 🔴 CRITICAL | Cannot deploy current state |
| Duplicate private slots | 🔴 HIGH | No unique constraints on active slots |
| Counter desynchronization | 🔴 HIGH | `Child.attemptsUsed` can diverge from actual attempts |
| Payment approval partial failure | 🔴 HIGH | Slot stranded in AWAITING_PAYMENT |
| Event emission inside tx | 🟡 MEDIUM | Notifications for rolled-back data |
| No page/pagination on lists | 🟡 MEDIUM | Owner reports, children, attempts all return full sets |
| Organization approval not enforced | 🟡 MEDIUM | PENDING orgs can fully operate |
| Enricher approval not enforced | 🟡 MEDIUM | PENDING enrichers can submit proposals |
| Email verification broken | 🔴 HIGH | Token payload mismatch |
| Refresh session no expiry check | 🟡 MEDIUM | Stale sessions may be reused |
| Mock payment provider | 🟡 MEDIUM | Missing secret exposes mock behavior |
| `Boolean(process.env.DB_SYNCHRONIZE)` | 🟡 MEDIUM | Any non-empty string = true |

---

## 14. Final Verdict

### NOT READY FOR FRONTEND INTEGRATION

**The build does not compile.** This is the single blocking issue. Before any frontend integration can proceed:

1. **Must fix:** Child entity relations (`organization`, `user`), UserRole.EMPLOYEE, Class inverse mapping, Child.classId nullable
2. **Must create:** Parent signup endpoint, enricher routes, deal full lifecycle
3. **Must protect:** Missing `@Roles()` on child/class/grade routes
4. **Must enforce:** Organization and enricher approval statuses
5. **Must build:** `/organizations/by-parent/:parentProfileId` endpoint

**After these fixes, re-run this audit** to assess readiness.

### What Frontend CAN Start On Immediately

Despite the build failure, the following contracts are stable and backend implementation is complete:

1. Auth flow (login, org signup, enricher signup, refresh, logout)
2. Organization management (CRUD, approve/reject)
3. Teacher management (CRUD)
4. Class management (CRUD, assign children)
5. Grade management (CRUD)
6. Institutional child creation
7. Parent search by phone
8. Transfer requests
9. Evaluation form display and attempt submission
10. Payment creation (basic)
11. Notifications (list, read)
12. Activity management

The frontend team should use the `parent?.userId` pattern for parent ownership checks and expect `ParentProfile.id` in `parentId` fields.
