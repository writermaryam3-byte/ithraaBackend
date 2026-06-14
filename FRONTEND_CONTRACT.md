# Ithraa Backend — Frontend API Contract

> **Base URL**: `http://localhost:3000`
> **Auth**: Bearer token in `Authorization` header (except `@Public()` endpoints)

> **Important: Child Entity Split**
> The legacy `Child` entity has been split into two separate entities:
> - `OrganizationChild`: Children registered by organizations (linked to a class and organization)
> - `PrivateChild`: Children registered directly by parents (not linked to any organization)
>
> **API Changes:**
> - Most endpoints that previously accepted just `childId` now require both `childId` and `childType` parameters
> - `childType` must be either `"organization"` or `"private"`
> - The backend automatically resolves the correct entity based on the ID and type
> - Response objects include either `organizationChildId` or `privateChildId` (never both)
> - Use the helper functions `resolveChild()`, `getChildId()`, and `getChildType()` for child resolution in backend code

---

## Roles

| Role | Value | Scope |
|------|-------|-------|
| ADMIN | `ADMIN` | Full system access |
| ORGANIZATIONOWNER | `ORGANIZATIONOWNER` | Owns/manages an organization |
| TEACHER | `TEACHER` | Works in an organization |
| PARENT | `PARENT` | Child's guardian |
| ENRICHER | `ENRICHER` | Service provider (deals) |

---

## Enums

### Gender
```
MALE = "male", FEMALE = "female"
```

### ApprovalStatus
```
PENDING = "pending", APPROVED = "approved", REJECTED = "rejected"
```

### OrganizationType
```
CENTER = "center", NURSERY = "nursery", TRAINING = "training", SCHOOL = "school"
```

### AccountType
```
PARENT = "parent", TEACHER = "teacher", ORGANIZATION = "organization", ENRICHER = "enricher"
```

### GradeName
```
GradeOne = "grade-1"
```

### DealStatus
```
OPEN, AWARDED, CLOSED
```

### ProposalStatus
```
PENDING, SELECTED, APPROVED, REJECTED
```

### EvaluationType
```
multiple_intelligences, pride, renzulli, holland, learning_styles, torrance
```

### EvaluationAttemptStatus
```
in_progress, submitted, approved
```

### TransferRequestStatus
```
PENDING, APPROVED, REJECTED
```

### PaymentStatusEnum
```
pending, paid, failed, expired
```

### PaymentProviderEnum
```
moyasar, paytabs, hyperpay
```

### ParentOrganizationStatus
```
active, invited, blocked
```

### ParentOrganizationSource
```
child_registration, manual_invite, transfer, backfill
```

### NotificationDelivery
```
email, inapp, both, verify_email
```

### AuditAction
```
CREATE, UPDATE, DELETE, APPROVE, REJECT, LOGIN, LOGOUT, TRANSFER_REQUEST, TRANSFER_APPROVE, TRANSFER_REJECT, PAYMENT_SUCCESS, PAYMENT_FAILURE, EVALUATION_START, EVALUATION_SUBMIT, EVALUATION_APPROVE, DEAL_CREATE, DEAL_SELECT, DEAL_APPROVE, ORGANIZATION_APPROVE, ORGANIZATION_REJECT
```

---

## 1. Authentication (`/auth`)

### POST `/auth/login` — Login
- **Auth**: `@Public()`
- **Body**:
```json
{
  "phone": "+2015013657687",
  "password": "550e8AEd@400"
}
```
- **Response**: `{ accessToken, refreshToken, user }`

### POST `/auth/beneficiaries-signup` — Org Owner Signup
- **Auth**: `@Public()`
- **Body**:
```json
{
  "name": "ziad user",
  "email": "ziadzayd79@gmail.com",
  "password": "550e8AEd@400",
  "phone": "+201503657687",
  "accountType": "organization",
  "organizationName": "organization-name",
  "organizationType": "school"
}
```
- **Response**: `{ user, teacher }`

### POST `/auth/enrichers-signup` — Service Provider Signup
- **Auth**: `@Public()`
- **Body**:
```json
{
  "name": "ziad user",
  "email": "ziadzayd79@gmail.com",
  "password": "550e8AEd@400",
  "phone": "+201503657687",
  "accountType": "enricher",
  "organizationName": "enricher institution"
}
```
- **Response**: `{ user, enricher }`

### POST `/auth/parent-signup` — Parent Signup
- **Auth**: `@Public()`
- **Body**:
```json
{
  "name": "ziad user",
  "email": "ziadzayd79@gmail.com",
  "password": "550e8AEd@400",
  "phone": "+201503657687"
}
```
- **Response**: `{ user, parentProfile }`

### POST `/auth/refresh` — Refresh Token
- **Auth**: `@Public()`
- **Body**: `{ token: "<refreshToken>" }`
- **Response**: New `{ accessToken, refreshToken }`

### POST `/auth/logout` — Logout
- **Auth**: Bearer (any authenticated user)

---

## 2. Users (`/users`)

### GET `/users` — List all users
- **Roles**: ADMIN
- **Response**: Array of `User`

### GET `/users/roles` — Users grouped by role
- **Roles**: ADMIN

### GET `/users/me` — Current user profile
- **Auth**: Bearer (any)
- **Response**:
```json
{
  "id": "uuid",
  "name": "string",
  "email": "string",
  "isEmailVerified": false,
  "phone": "string",
  "isPhoneVerified": false,
  "roles": [{ "name": "ADMIN" }]
}
```

### GET `/users/:id` — Get user by ID
- **Auth**: ADMIN or self
- **Response**: User object (same shape as `/me`)

### GET `/users/organization-owner/:id` — Get org owner detail
- **Roles**: ORGANIZATIONOWNER, ADMIN

### POST `/users/seed-roles` — Seed default roles
- **Roles**: ADMIN

### DELETE `/users/:id` — Delete user
- **Roles**: ADMIN

---

## 3. Organizations (`/organizations`)

### GET `/organizations` — List all orgs
- **Roles**: ADMIN
- **Query**: `?status=pending|approved|rejected`

### GET `/organizations/pending` — Pending orgs
- **Roles**: ADMIN

### GET `/organizations/me` — My org
- **Roles**: ORGANIZATIONOWNER

### GET `/organizations/owner/:ownerId` — By owner
- **Auth**: ADMIN or self

### GET `/organizations/by-parent/:parentProfileId` — By parent
- **Auth**: Bearer (any)

### GET `/organizations/:id` — Get by ID
- **Roles**: ADMIN or org owner
- **Response**:
```json
{
  "id": "uuid",
  "organizationName": "string",
  "organizationType": "school",
  "approvalStatus": "pending",
  "ownerId": "uuid",
  "approvedById": "uuid|null",
  "approvedAt": "ISO|null",
  "rejectedById": "uuid|null",
  "rejectedAt": "ISO|null",
  "rejectionReason": "string|null"
}
```

### PATCH `/organizations/:id` — Update org
- **Roles**: ADMIN or org owner
- **Body**:
```json
{
  "organizationName": "Al Noor School",
  "organizationType": "school"
}
```

### PATCH `/organizations/:id/approve` — Approve
- **Roles**: ADMIN

### PATCH `/organizations/:id/reject` — Reject
- **Roles**: ADMIN
- **Body**:
```json
{
  "rejectionReason": "Incomplete documentation provided"
}
```

### DELETE `/organizations/:id` — Delete
- **Roles**: ADMIN

---

## 4. Children (`/children`)

### POST `/children` — Create child (org context, auto-creates parent)
- **Roles**: ORGANIZATIONOWNER, TEACHER
- **Body**:
```json
{
  "name": "child-name",
  "birthDate": "2007-05-21",
  "gender": "male",
  "classId": "uuid",
  "parentPhone": "+201503657687",
  "parentEmail": "parent@example.com",
  "parentName": "Parent Name"
}
```
> **Note**: This endpoint creates an `OrganizationChild` entity.

### GET `/children/all` — All children
- **Roles**: ADMIN
- **Response**: Returns both `OrganizationChild` and `PrivateChild` entities

### GET `/children` — By user
- **Roles**: ADMIN, PARENT
- **Query**: `?userId=<uuid>`
- **Response**: Returns both `OrganizationChild` and `PrivateChild` entities for the user

### GET `/children/organization/:orgId` — By org
- **Roles**: ORGANIZATIONOWNER, ADMIN, TEACHER
- **Response**: Returns `OrganizationChild` entities for the organization

### GET `/children/:id` — Get child
- **Roles**: ADMIN, PARENT, ORGANIZATIONOWNER, TEACHER (via policy)
- **Response**: Returns either `OrganizationChild` or `PrivateChild` entity based on ID
> **Note**: The backend automatically resolves the child type (organization or private) based on the ID.

### PATCH `/children/:id` — Update child
- **Roles**: PARENT, ORGANIZATIONOWNER, TEACHER, ADMIN
- **Body**: Partial of create body
> **Note**: The backend automatically resolves the child type based on the ID.

### DELETE `/children/:id` — Delete child
- **Roles**: PARENT, ORGANIZATIONOWNER, TEACHER, ADMIN
> **Note**: The backend automatically resolves the child type based on the ID.

---

## 5. Parent Children (`/parent`)

### POST `/parent/children` — Create private child
- **Roles**: PARENT
- **Body**:
```json
{
  "name": "child-name",
  "birthDate": "2007-02-28",
  "gender": "male"
}
```
- **Response**: `{ id, name, birthDate, gender, ... }`

### GET `/parent/children` — My private children
- **Roles**: PARENT

### GET `/parent/org-children` — My organization children
- **Roles**: PARENT

---

## 6. Child Transfers (`/child-transfers`)

### POST `/child-transfers` — Request transfer
- **Roles**: ORGANIZATIONOWNER, ADMIN
- **Body**:
```json
{
  "childId": "uuid",
  "childType": "organization" | "private",
  "toOrganizationId": "uuid"
}
```
> **Note**: `childType` is required to specify whether transferring an `OrganizationChild` or `PrivateChild`.

### PATCH `/child-transfers/:id/approve` — Approve
- **Roles**: ORGANIZATIONOWNER, ADMIN
- **Body**: `{ "classId": "uuid" }`

### PATCH `/child-transfers/:id/reject` — Reject
- **Roles**: ORGANIZATIONOWNER, ADMIN

### GET `/child-transfers` — List requests
- **Roles**: ORGANIZATIONOWNER, ADMIN
- **Query**: `?toOrganizationId=&fromOrganizationId=&status=PENDING`
- **Response**: Each request includes `organizationChildId` or `privateChildId` (never both)

---

## 7. Teachers (`/teachers`)

### POST `/teachers` — Create teacher
- **Roles**: ORGANIZATIONOWNER
- **Body**:
```json
{
  "name": "ziad user",
  "email": "ziadzayd79@gmail.com",
  "password": "550e8AEd@400",
  "phone": "+201503657687",
  "jobTitle": "KG Teacher"
}
```

### PATCH `/teachers/:id` — Update
- **Roles**: ORGANIZATIONOWNER

### GET `/teachers/organization/:organizationId` — List by org
- **Roles**: ORGANIZATIONOWNER, ADMIN, TEACHER

### DELETE `/teachers/:id` — Remove
- **Roles**: ORGANIZATIONOWNER

---

## 8. Parents (`/parents`)

### GET `/parents/search` — Find parent by phone
- **Roles**: ORGANIZATIONOWNER, ADMIN
- **Query**: `?phone=+201503657687`

---

## 9. Enrichers (`/enrichers`)

### GET `/enrichers/deals` — Available open deals
- **Roles**: ENRICHER

### GET `/enrichers/deals/:dealId` — Deal detail
- **Roles**: ENRICHER

### GET `/enrichers/proposals` — My proposals
- **Roles**: ENRICHER

---

## 10. Grades (`/grades`)

### POST `/grades` — Create
- **Roles**: ORGANIZATIONOWNER
- **Body**:
```json
{
  "name": "grade-1",
  "organizationId": "uuid"
}
```

### GET `/grades` — All
- **Roles**: ADMIN

### GET `/grades/organization/:orgId` — By org
- **Roles**: ORGANIZATIONOWNER, ADMIN, TEACHER

### GET `/grades/:id` — Get one
- **Roles**: ORGANIZATIONOWNER, ADMIN, TEACHER

### PATCH `/grades/:id` — Update
- **Roles**: ORGANIZATIONOWNER

### DELETE `/grades/:id` — Delete
- **Roles**: ORGANIZATIONOWNER

---

## 11. Classes (`/classes`)

### POST `/classes` — Create
- **Roles**: ORGANIZATIONOWNER
- **Body**:
```json
{
  "name": "class-name",
  "gradeId": "uuid",
  "teacherId": "uuid (optional)"
}
```

### GET `/classes` — All
- **Roles**: ADMIN

### GET `/classes/organization/:orgId` — By org
- **Roles**: ORGANIZATIONOWNER, ADMIN, TEACHER

### GET `/classes/:id` — Get class
- **Roles**: ADMIN, ORGANIZATIONOWNER, TEACHER

### GET `/classes/:id/get-children` — Children in class
- **Roles**: ORGANIZATIONOWNER, ADMIN, TEACHER

### PATCH `/classes/:id` — Update
- **Roles**: ORGANIZATIONOWNER

### DELETE `/classes/:id` — Delete
- **Roles**: ORGANIZATIONOWNER

### POST `/classes/:clsId/asign/:childId` — Assign child to class
- **Roles**: ORGANIZATIONOWNER

---

## 12. Deals (`/deals`)

### GET `/deals` — List deals
- **Roles**: ORGANIZATIONOWNER, TEACHER, ENRICHER
- **Query**: `?status=OPEN|AWARDED|CLOSED`

### GET `/deals/:dealId` — Deal detail
- **Roles**: ORGANIZATIONOWNER, TEACHER, ENRICHER
- **Response**:
```json
{
  "id": "uuid",
  "activity": { "id": "uuid", "name": "string" },
  "organization": { "id": "uuid", "organizationName": "string" },
  "creator": { "id": "uuid", "name": "string" },
  "studentsCount": 10,
  "status": "OPEN",
  "deadline": "2027-01-10T12:00:00.000Z",
  "createdAt": "ISO"
}
```

### POST `/deals` — Create deal
- **Roles**: ORGANIZATIONOWNER, TEACHER
- **Body**:
```json
{
  "activityId": "uuid",
  "studentsCount": 10,
  "deadline": "2027-01-10T12:00:00.000Z"
}
```

### GET `/deals/:dealId/proposals` — List proposals on a deal
- **Roles**: ORGANIZATIONOWNER
- **Response**: `Proposal[]` (each with `provider`, `price`, `status`)

### POST `/deals/:dealId/proposals` — Submit proposal
- **Roles**: ENRICHER
- **Body**:
```json
{
  "price": 1250.50
}
```

### POST `/deals/:dealId/proposals/:proposalId/select` — Select proposal
- **Roles**: ORGANIZATIONOWNER
- **Response**: Proposal marked SELECTED, deal status → AWARDED

### POST `/deals/:dealId/proposals/:proposalId/approve` — Admin approve
- **Roles**: ADMIN
- **Response**: Proposal status → APPROVED

---

## 13. Proposals (`/proposals`)

### PATCH `/proposals/:id` — Update price
- **Roles**: ENRICHER
- **Body**:
```json
{
  "price": 1400
}
```

---

## 14. Activities (`/activities`)

### POST `/activities` — Create
- **Roles**: ADMIN
- **Body**: `{ "name": "STEM Workshop" }`

### GET `/activities` — All
- **Roles**: ADMIN, ORGANIZATIONOWNER, TEACHER, ENRICHER

### GET `/activities/with-deals` — All with deals
- **Roles**: ADMIN, ORGANIZATIONOWNER, TEACHER, ENRICHER

### GET `/activities/:id` — Get one
- **Roles**: ADMIN, ORGANIZATIONOWNER, TEACHER, ENRICHER

### GET `/activities/:id/with-deals` — One with deals
- **Roles**: ADMIN, ORGANIZATIONOWNER, TEACHER, ENRICHER

### PATCH `/activities/:id` — Update
- **Roles**: ADMIN
- **Body**: `{ "name": "Advanced STEM Workshop (optional)" }`

### DELETE `/activities/:id` — Delete
- **Roles**: ADMIN
- **Note**: Fails with 400 if activity has related deals

---

## 15. Evaluations (`/evaluations`)

### POST `/evaluations` — Create evaluation
- **Roles**: ADMIN
- **Body** (complex — see DTO):
```json
{
  "title": "مؤشر الذكاءات الثمانية",
  "type": "multiple_intelligences",
  "institutionId": "uuid",
  "ageFrom": 3,
  "ageTo": 15,
  "evaluatorTypes": ["parent", "teacher"],
  "dimensions": [
    {
      "name": "الذكاء اللغوي",
      "code": "linguistic",
      "minScore": 3,
      "maxScore": 12,
      "interpretationRules": {}
    }
  ],
  "questions": [
    {
      "content": "لدى طفلي فضول يدفعه لفتح الكتب",
      "dimensionCode": "linguistic",
      "order": 1,
      "answers": [
        { "text": "تنطبق بدرجة عالية", "scoreValue": 4, "code": "A" },
        { "text": "تنطبق قليلاً", "scoreValue": 2, "code": "B" }
      ]
    }
  ]
}
```

### GET `/evaluations` — All evaluations
- **Roles**: ADMIN

### GET `/evaluations/available/:childId` — Available for child
- **Roles**: PARENT
- Returns evaluations matching child's age

### GET `/evaluations/:id/details` — Full scoring data
- **Roles**: ADMIN

### GET `/evaluations/:id/form` — Form without scores
- **Roles**: PARENT, ADMIN

### POST `/evaluations/:id/start` — Start attempt
- **Roles**: PARENT
- **Body**:
```json
{
  "childId": "uuid",
  "childType": "organization" | "private",
  "expiresAt": "2027-12-30T10:00:00.000Z",
  "expiresInSeconds": 1800
}
```
> **Note**: `childId` refers to either `organizationChildId` or `privateChildId` based on `childType`. The backend uses this to resolve the correct child entity.

---

## 16. Evaluation Attempts (`/attempts`)

### GET `/attempts` — Admin list
- **Roles**: ADMIN
- **Query**: `?status=in_progress&evaluationId=&organizationChildId=&privateChildId=`
- **Response**: Attempts include either `organizationChildId` or `privateChildId` (never both)

### GET `/attempts/child/:childId` — Child's attempts
- **Roles**: PARENT, ADMIN
> **Note**: `childId` can refer to either `organizationChildId` or `privateChildId`. The backend automatically resolves the child type.

### POST `/attempts/:childId/start` — Start free main slot
- **Roles**: PARENT
> **Note**: Only for private children. `childId` must be a `privateChildId`.

### POST `/attempts/:childId/retake` — Request free retake
- **Roles**: PARENT
> **Note**: Only for private children. `childId` must be a `privateChildId`.

### POST `/attempts/:childId/request-extra` — Request paid extra
- **Roles**: PARENT
> **Note**: Only for private children. `childId` must be a `privateChildId`.

### PATCH `/attempts/:id/save` — Save progress
- **Roles**: PARENT
- **Body**:
```json
{
  "answers": [
    { "questionId": "uuid", "selectedAnswerId": "uuid" }
  ]
}
```

### POST `/attempts/:id/submit` — Submit final
- **Roles**: PARENT
- **Body**: Same as save

### GET `/attempts/:id` — Get attempt detail
- **Roles**: PARENT, ADMIN, ORGANIZATIONOWNER, TEACHER

### POST `/attempts/:id/approve` — Approve attempt
- **Roles**: ADMIN

---

## 17. Admin Private Attempts (`/admin/attempts`)

### POST `/admin/attempts/:id/approve` — Approve extra attempt
- **Roles**: ADMIN
- Creates payable checkout session for the extra attempt

---

## 18. Owner Evaluation Results (`/evaluations/owner`)

### GET `/evaluations/owner/filters` — Get filter options
- **Roles**: ORGANIZATIONOWNER, ADMIN

### GET `/evaluations/owner/reports` — Report cards
- **Roles**: ORGANIZATIONOWNER, ADMIN
- **Query**: `?evaluationId=uuid`

### GET `/evaluations/owner/classes/:classId/evaluations/:evaluationId/summary` — Class summary
- **Roles**: ORGANIZATIONOWNER, ADMIN
- **Response**:
```json
{
  "classId": "uuid",
  "className": "string",
  "highestScore": 95,
  "averageScore": 72.5,
  "lowestScore": 45,
  "topDimensions": [{ "code": "linguistic", "name": "الذكاء اللغوي", "percentage": 85, "score": 10 }],
  "children": [
    {
      "organizationChildId": "uuid | null",
      "privateChildId": "uuid | null",
      "childName": "string",
      "className": "string",
      "topResultLabel": "string|null",
      "topDimensionName": "string|null",
      "score": 80,
      "status": "submitted"
    }
  ]
}
```

### GET `/evaluations/owner/classes/:classId/evaluations/:evaluationId/status` — Class status
- **Roles**: ORGANIZATIONOWNER, ADMIN

### POST `/evaluations/owner/children/:childId/reminder` — Send reminder to parent
- **Roles**: ORGANIZATIONOWNER, ADMIN
> **Note**: `childId` can refer to either `organizationChildId` or `privateChildId`. The backend automatically resolves the child type.

---

## 19. Payments (`/payments`)

### POST `/payments` — Create checkout session
- **Roles**: PARENT
- **Body**:
```json
{
  "amount": 199.50,
  "currency": "SAR",
  "privateChildId": "uuid",
  "attemptRequestId": "uuid (optional)",
  "privateAttemptId": "uuid (optional)",
  "description": "Evaluation access (optional)",
  "provider": "moyasar (optional)"
}
```
> **Note**: Payments are only for private children (extra attempts).
- **Response**:
```json
{
  "id": "uuid",
  "checkoutUrl": "https://...",
  "expiresAt": "ISO",
  "status": "pending"
}
```

### POST `/payments/webhook` — Provider callback
- **Auth**: `@Public()` — validated via HMAC signature
- **Header**: `x-moyasar-signature`

### POST `/payments/:attemptId/initiate` — Initiate/refresh extra attempt payment
- **Roles**: PARENT

### POST `/payments/:id/retry` — Retry failed payment
- **Roles**: PARENT

---

## 20. Notifications (`/notifications`)

### POST `/notifications/verify-email` — Send verification email
- **Auth**: Bearer (any)
- **Body**: `{ "email": "string", "userId": "uuid" }`

### GET `/notifications` — My notifications
- **Auth**: Bearer (any)
- **Query**: `?page=1&limit=20&unreadOnly=true&type=`

### GET `/notifications/unread-count` — Unread count
- **Auth**: Bearer (any)

### PATCH `/notifications/read-all` — Mark all read
- **Auth**: Bearer (any)

### PATCH `/notifications/:id/read` — Mark one read
- **Auth**: Bearer (any)

### POST `/notifications/dispatch` — Admin dispatch
- **Roles**: ADMIN
- **Body**:
```json
{
  "delivery": "both",
  "userId": "uuid",
  "email": "override@example.com (optional)",
  "title": "string (max 500)",
  "message": "string (max 10000)",
  "type": "evaluation (optional)",
  "metadata": {}
}
```

---

## 21. Sessions (`/session`)

### POST `/session` — Create session
- **Auth**: Bearer (any)
- **Body**: `{ "userId": "uuid", "refreshToken": "string", "device": "optional", "ip": "optional" }`

### GET `/session` — All sessions
- **Auth**: Bearer (any)

### GET `/session/:id` — One session
- **Auth**: Bearer (any)

---

## 22. Uploads (`/uploads`)

### POST `/uploads/upload` — Upload file
- **Roles**: ADMIN, ORGANIZATIONOWNER, PARENT
- **Content-Type**: `multipart/form-data`
- **Field**: `file` (image/jpeg, image/png, image/webp, application/pdf)
- **Max size**: 5MB
- **Response**:
```json
{
  "message": "file uploaded successfully",
  "filename": "uuid.jpg",
  "mimeType": "image/jpeg",
  "size": 123456
}
```

---

## Common HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request / Validation error |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (wrong role) |
| 404 | Not found |
| 409 | Conflict (e.g. duplicate) |
| 429 | Too many requests (rate limit) |
| 500 | Internal server error |

---

## Auth Flow

1. **Signup** (beneficiaries/enrichers/parent) → get `{ user, ... }` (login not automatic)
2. **Login** → `POST /auth/login` → receive `{ accessToken, refreshToken, user }`
3. **Use** `Authorization: Bearer <accessToken>` for all API calls
4. **Refresh** → `POST /auth/refresh` with `{ token: "<refreshToken>" }` → new tokens
5. **Logout** → `POST /auth/logout`

---

## Feature: Deal & Proposal Flow (Org Owner + Admin)

### Overview

The deal system is a **bidding workflow** between Organizations (buyers) and Enrichers (service providers), with Admin superivision.

**Actors & their roles in this flow:**

| Actor | Can do |
|-------|--------|
| ORG Owner / Teacher | Create deal, view proposals on their deals, select a winner |
| ENRICHER | Browse open deals, submit proposals, update their proposal price before deadline |
| ADMIN | Approve or reject the selected proposal, manage activities |

---

### Step-by-step flow (Org Owner view)

#### 1. Create a Deal

The org owner picks an activity, sets student count and a bidding deadline.

```
POST /deals
Roles: ORGANIZATIONOWNER, TEACHER
Body: { activityId, studentsCount, deadline (ISO future date) }
Response: { id, activity, organization, creator, studentsCount, status: "OPEN", deadline, createdAt }
```

**Frontend:** Show a "Create Deal" form. First `GET /activities` to populate a dropdown. Let the user pick activity, enter student count, pick a future deadline. On submit → deal is created with status `OPEN`.

---

#### 2. View My Deals

```
GET /deals
Roles: ORGANIZATIONOWNER, TEACHER, ENRICHER
Query: ?status=OPEN (optional filter)
Response: Deal[]
```

**Frontend:** "My Deals" list page. Show card/table with activity name, status, deadline, number of proposals. For org owners, each deal row should have a "View Proposals" action.

---

#### 3. View Proposals on a Deal (Org Owner)

```
GET /deals/:dealId/proposals
Roles: ORGANIZATIONOWNER
Response: Proposal[] (with provider info)
```

Each proposal:
```json
{
  "id": "uuid",
  "deal": { "id": "uuid" },
  "provider": { "id": "uuid", "name": "string", "email": "string" },
  "price": "1250.50",
  "status": "PENDING",
  "createdAt": "ISO"
}
```

**Frontend:** "Proposals" view for a specific deal. Show all enricher proposals sorted by price or date. Each proposal shows: provider name, price (SAR), status badge, submitted date. The org owner can review and pick one.

---

#### 4. Select a Winning Proposal (Org Owner)

When the org owner decides which proposal to award:

```
POST /deals/:dealId/proposals/:proposalId/select
Roles: ORGANIZATIONOWNER
Response: { id, deal, provider, price, status: "SELECTED", createdAt }
```

**What happens:**
- The selected proposal status changes from `PENDING` → `SELECTED`
- The deal status changes from `OPEN` → `AWARDED`
- Other proposals remain `PENDING` (they can still be viewed)
- The deal is now closed for new proposals

**Frontend:** On each proposal row, show a "Select as Winner" button. Button is disabled if deal is not `OPEN`. Click → confirm dialog → `POST` to select endpoint. On success:
- Show success toast
- Reload deal data
- Selected proposal gets "SELECTED" badge (green)
- Deal status changes to "AWARDED"
- Other proposals keep "PENDING" badge, but selection buttons disappear
- A banner appears: "Winner selected — pending admin approval"

---

#### 5. Admin Approves the Selection

An admin sees all deals with status `AWARDED` and can finalize:

```
POST /deals/:dealId/proposals/:proposalId/approve
Roles: ADMIN
Response: { id, deal, provider, price, status: "APPROVED", createdAt }
```

**What happens:**
- The selected proposal status changes from `SELECTED` → `APPROVED`
- The proposal is now finalised

**Frontend (Admin panel):** 
- List deals filtered by `?status=AWARDED`
- Show "Pending Approval" deals
- Each deal shows the selected proposal details
- "Approve" / "Reject" buttons
- On approve → proposal becomes `APPROVED`
- On reject → proposal becomes `REJECTED`, deal could return to `OPEN` (backend handles this)

---

#### 6. Proposal Lifecycle (Enricher View)

**Browse open deals:**
```
GET /enrichers/deals
Roles: ENRICHER
Response: Deal[] (only OPEN deals)
```

**View deal detail:**
```
GET /enrichers/deals/:dealId
Roles: ENRICHER
Response: Deal detail
```

**Submit proposal:**
```
POST /deals/:dealId/proposals
Roles: ENRICHER
Body: { price: 1250.50 }
Response: Proposal
```

**Update price (before deadline):**
```
PATCH /proposals/:id
Roles: ENRICHER
Body: { price: 1400 }
```

**View my proposals:**
```
GET /enrichers/proposals
Roles: ENRICHER
Response: Proposal[] (with deal info)
```

**Frontend (Enricher panel):**
- "Available Deals" page → list of open deals
- Click deal → view details → "Submit Proposal" form (price input)
- "My Proposals" page → list of all proposals with deal name, price, status badge
- Pending proposals have "Edit" button if deadline hasn't passed
- Once selected/approved/rejected → read-only

---

### Status Flow Diagram

```
Deal: OPEN ──→ (org selects proposal) ──→ AWARDED ──→ (admin approves) ──→ CLOSED
                 ↓                            ↓
Proposal: PENDING ──→ SELECTED ──→ APPROVED
                            ↓
                      (admin rejects)
                            ↓
                        REJECTED
```

### Frontend State Mapping

| Deal Status | Org Owner Actions | Enricher Actions | Admin Actions |
|-------------|-------------------|------------------|---------------|
| `OPEN` | View proposals, select winner | Submit/edit proposals | — |
| `AWARDED` | View selected proposal (waiting) | View status | Approve or reject |
| `CLOSED` | Read-only | Read-only | Read-only |

| Proposal Status | Meaning | Badge Color |
|-----------------|---------|-------------|
| `PENDING` | Submitted, awaiting org review | Yellow |
| `SELECTED` | Picked by org, awaiting admin | Blue |
| `APPROVED` | Finalised by admin | Green |
| `REJECTED` | Not selected / admin rejected | Red |
