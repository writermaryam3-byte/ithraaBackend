# Ithraa Backend — API Reference

**Base URL:** /api  
**Protocol:** HTTPS (production) / HTTP (development)  
**Port:** 3000 (configurable via PORT env)  
**Swagger UI:** /api-docs (when server is running)

---

## Table of Contents

1. [Authentication & Authorization](#1-authentication--authorization)
2. [Common Behaviors](#2-common-behaviors)
3. [Roles & Permissions Matrix](#3-roles--permissions-matrix)
4. [Auth Endpoints](#4-auth-endpoints)
5. [User Endpoints](#5-user-endpoints)
6. [Organization Endpoints](#6-organization-endpoints)
7. [Teacher Endpoints](#7-teacher-endpoints)
8. [Parent Endpoints](#8-parent-endpoints)
9. [Enricher (Service Provider) Endpoints](#9-enricher-service-provider-endpoints)
10. [Children Endpoints](#10-children-endpoints)
11. [Parent-Children Endpoints](#11-parent-children-endpoints)
12. [Child Transfers Endpoints](#12-child-transfers-endpoints)
13. [Class Endpoints](#13-class-endpoints)
14. [Grade Endpoints](#14-grade-endpoints)
15. [Evaluation Endpoints](#15-evaluation-endpoints)
16. [Evaluation Attempt Endpoints](#16-evaluation-attempt-endpoints)
17. [Admin Private Attempt Endpoints](#17-admin-private-attempt-endpoints)
18. [Owner Evaluation Results Endpoints](#18-owner-evaluation-results-endpoints)
19. [Deal Endpoints](#19-deal-endpoints)
20. [Proposal Endpoints](#20-proposal-endpoints)
21. [Activity Endpoints](#21-activity-endpoints)
22. [Payment Endpoints](#22-payment-endpoints)
23. [Notification Endpoints](#23-notification-endpoints)
24. [Upload Endpoints](#24-upload-endpoints)
25. [Capacity Request Endpoints](#25-capacity-request-endpoints)
26. [Session Endpoints](#26-session-endpoints)
27. [Entity Summary](#27-entity-summary)

---

## 1. Authentication & Authorization

### Authentication

- **Scheme:** Bearer JWT
- **Header:** Authorization: Bearer <token>
- **Token payload:** { sub: userId, email, roles: Role[], phone }
- **Public routes** are annotated with @Public() — no token required.
- All other routes require a valid JWT. Requests without a token receive **401 Unauthorized**.

### Token Acquisition

- POST /api/auth/login returns { accessToken, refreshToken, ... }.
- POST /api/auth/refresh accepts { token: refreshToken } and returns a new token pair.
- Refresh tokens are hashed and stored in the sessions table.
- On logout (DELETE /api/auth/logout/:sessionId or DELETE /api/auth/logout-all), the session is invalidated.

### Authorization (RBAC)

Five roles are defined in UserRole enum:

| Role | Description |
|------|-------------|
| ADMIN | System administrator |
| ORGANIZATIONOWNER | School/center owner |
| ENRICHER | Service provider (external vendor) |
| TEACHER | School teacher |
| PARENT | Child's parent/guardian |

- Routes use @Roles(...) decorators to restrict access.
- If no @Roles() is present, the route is accessible to **any authenticated user**.
- Unauthorized roles receive **403 Forbidden**.

### Error Responses

| Status | Meaning |
|--------|---------|
| 400 | Validation error — flattened field errors in body |
| 401 | Missing or invalid JWT |
| 403 | Insufficient role permissions |
| 404 | Resource not found |
| 409 | Conflict (e.g., duplicate user) |
| 410 | Endpoint deprecated and gone |
| 429 | Rate limit exceeded |

### Rate Limiting

Global default: **120 requests/min**. Specific overrides:
- Auth routes (login, signup): **10 requests/min**
- File upload: **20 requests/min**

---

## 2. Common Behaviors

### Validation

- All request bodies are validated via class-validator + ValidationPipe.
- whitelist: true — strips unknown properties.
- orbidNonWhitelisted: true — rejects unknown properties with 400.
- 	ransform: true — auto-transforms types (string to number, etc.).
- Errors are flattened: { "field.nestedField": "error message" }.

### ID Format

All resource IDs are **UUID v4**.

### Audit Logging

Key mutating endpoints are decorated with @AuditLog() which records actions in the udit_log table.

### File Upload

- Accepted MIME types: image/jpeg, image/png, image/webp, pplication/pdf
- Max file size: **5 MB**
- Storage: local ./uploads/ directory
- File name: {uuid}.{ext}

### CORS

Configurable via CORS_ORIGINS env variable (comma-separated list of origins).

---

## 3. Roles & Permissions Matrix

| Module | Endpoint | ADMIN | ORGOWNER | TEACHER | PARENT | ENRICHER |
|--------|----------|-------|----------|---------|--------|----------|
| **Auth** | POST login, signup, refresh | Public | Public | Public | Public | Public |
| **Auth** | DELETE logout | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Users** | GET /users, POST seed-roles | ✓ | | | | |
| **Users** | GET /users/me | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Users** | GET /users/:id | self | self | self | self | self |
| **Users** | DELETE /users/:id | ✓ | | | | |
| **Teachers** | POST, PATCH, DELETE | | ✓ | | | |
| **Teachers** | GET organization/:orgId | ✓ | ✓ | ✓ | | |
| **Parents** | GET /search | ✓ | ✓ | | | |
| **Organizations** | GET, PATCH, DELETE | ✓ | ✓ | | | |
| **Organizations** | GET /pending, approve, reject | ✓ | | | | |
| **Organizations** | GET /me | | ✓ | | | |
| **Children** | POST | | ✓ | ✓ | | |
| **Children** | GET /all | ✓ | | | | |
| **Children** | GET /organization/:orgId | ✓ | ✓ | ✓ | | |
| **Children** | GET ?userId= | ✓ | | | ✓ | |
| **Children** | GET/PATCH/DELETE :id | ✓ | ✓* | ✓* | ✓* | |
| **Parent-Children** | POST/GET /parent/children | | | | ✓ | |
| **Parent-Children** | GET /parent/org-children | | | | ✓ | |
| **Child Transfers** | All | ✓ | ✓ | | | |
| **Classes** | POST, PATCH, DELETE, asign | | ✓ | | | |
| **Classes** | GET (all) | ✓ | | | | |
| **Classes** | GET /org/:orgId, /:id | ✓ | ✓ | ✓ | | |
| **Grades** | POST, PATCH, DELETE | | ✓ | | | |
| **Grades** | GET (all) | ✓ | | | | |
| **Grades** | GET /org/:orgId, /:id | ✓ | ✓ | ✓ | | |
| **Evaluations** | POST, GET, GET details | ✓ | | | | |
| **Evaluations** | GET /available/:childId, POST /start | | | | ✓ | |
| **Evaluations** | GET /:id/form | ✓ | | | ✓ | |
| **Attempts** | GET (list) | ✓ | | | | |
| **Attempts** | GET /child/:childId | ✓ | | | ✓ | |
| **Attempts** | POST start, retake, extra | | | | ✓ | |
| **Attempts** | PATCH save, POST submit | | | | ✓ | |
| **Attempts** | GET :id | ✓ | ✓ | ✓ | ✓ | |
| **Attempts** | POST approve | ✓ | | | | |
| **Admin Attempts** | POST approve (slot) | ✓ | | | | |
| **Owner Results** | All | ✓ | ✓ | | | |
| **Deals** | POST | | ✓ | ✓ | | |
| **Deals** | GET | | ✓ | ✓ | | ✓ |
| **Deals** | GET /:dealId/proposals | | ✓ | | | |
| **Deals** | POST /:dealId/proposals | | | | | ✓ |
| **Deals** | POST select | | ✓ | | | |
| **Deals** | POST approve | ✓ | | | | |
| **Proposals** | PATCH | | | | | ✓ |
| **Activities** | POST, PATCH, DELETE | ✓ | | | | |
| **Activities** | GET | ✓ | ✓ | ✓ | | ✓ |
| **Payments** | POST, initiate, retry | | | | ✓ | |
| **Payments** | POST webhook | Public | Public | Public | Public | Public |
| **Notifications** | POST dispatch | ✓ | | | | |
| **Notifications** | GET, PATCH read | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Notifications** | POST verify-email | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Uploads** | POST upload | ✓ | ✓ | | ✓ | |
| **Capacity Requests** | POST | | | | ✓ | |
| **Capacity Requests** | GET (list) | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Capacity Requests** | PATCH, approve, reject | ✓ | | | | |

> * — Access check performed at service level via ChildAccessPolicy.

---

## 4. Auth Endpoints

### POST /api/auth/login

Authenticate with phone and password.

**Access:** Public (rate-limited: 10/min)

**Request Body:**
`json
{
  "phone": "+2015013657687",
  "password": "550e8AEd@400-e29b-41d4-a716-446655440000"
}
`

**Response:** 200 OK
`json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": { ... }
}
`

**Errors:** 401 — invalid credentials

---

### POST /api/auth/beneficiaries-signup

Register a new beneficiary (organization owner) account.

**Access:** Public (rate-limited: 10/min)

**Request Body:**
`json
{
  "name": "ziad user",
  "email": "ziadzayd79@gmail.com",
  "password": "550e8AEd@400-e29b-41d4-a716-446655440000",
  "phone": "+201503657687",
  "accountType": "ORGANIZATION",
  "organizationName": "organization-name",
  "organizationType": "SCHOOL"
}
`

organizationType enum: SCHOOL, CENTER, NURSERY, INSTITUTE, CLINIC, OTHER

**Response:** 201 Created — created user + auth tokens

**Errors:** 400 — user already exists

---

### POST /api/auth/enrichers-signup

Register a new enricher (service provider) account.

**Access:** Public (rate-limited: 10/min)

**Request Body:**
`json
{
  "name": "ziad user",
  "email": "ziadzayd79@gmail.com",
  "password": "550e8AEd@400-e29b-41d4-a716-446655440000",
  "phone": "+201503657687",
  "organizationName": "enricher institution",
  "accountType": "ENRICHER"
}
`

**Response:** 201 Created — created user + auth tokens

**Errors:** 409 — user already exists

---

### POST /api/auth/parent-signup

Register a new parent account.

**Access:** Public (rate-limited: 10/min)

**Request Body:**
`json
{
  "name": "ziad user",
  "email": "ziadzayd79@gmail.com",
  "password": "550e8AEd@400-e29b-41d4-a716-446655440000",
  "phone": "+201503657687"
}
`

**Response:** 201 Created — created user + auth tokens

**Errors:** 409 — user already exists

---

### POST /api/auth/refresh

Refresh an expired access token.

**Access:** Public

**Request Body:**
`json
{
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
`

**Response:** 200 OK — new token pair

**Errors:** 401 — invalid or compromised refresh token

---

### DELETE /api/auth/logout/:sessionId

Log out a specific session.

**Access:** Authenticated

**Parameters:**
- sessionId (uuid, path)

**Response:** 200 OK
`json
{ "message": "Logged out", "statusCode": 200 }
`

**Errors:** 403 — cannot log out another user's session

---

### DELETE /api/auth/logout-all

Log out all active sessions for the authenticated user.

**Access:** Authenticated

**Response:** 200 OK

---

### GET /api/auth/verify-email?token=<token>

Verify a user's email address via signed token.

**Access:** Public

**Query Parameters:**
- 	oken (string, required) — verification token from email

**Response:** 200 OK

---

## 5. User Endpoints

### POST /api/users/seed-roles

Seed default roles into the database.

**Roles:** ADMIN

**Response:** 201 Created

---

### GET /api/users

List all users.

**Roles:** ADMIN

**Response:** 200 OK — array of User objects

---

### GET /api/users/roles

List users grouped by role.

**Roles:** ADMIN

**Response:** 200 OK

---

### GET /api/users/organization-owner/:id

Get organization owner details by user ID.

**Roles:** ORGANIZATIONOWNER, ADMIN

**Parameters:**
- id (uuid, path)

**Response:** 200 OK

---

### GET /api/users/me

Get the authenticated user's profile.

**Access:** Authenticated

**Response:** 200 OK — User object (password excluded via @Exclude())

---

### GET /api/users/:id

Get a user by ID. Self-access allowed; others require ADMIN.

**Roles:** self or ADMIN

**Parameters:**
- id (uuid, path)

**Response:** 200 OK — User object

**Errors:** 403 — accessing another user's profile without ADMIN

---

### DELETE /api/users/:id

Delete a user.

**Roles:** ADMIN

**Parameters:**
- id (uuid, path)

**Response:** 200 OK

---

## 6. Organization Endpoints

### GET /api/organizations/pending

List organizations with pending approval status.

**Roles:** ADMIN

**Response:** 200 OK

---

### GET /api/organizations

List organizations, optionally filtered by status.

**Roles:** ADMIN

**Query Parameters:**
- status (string, optional) — filter by approval status

**Response:** 200 OK

---

### GET /api/organizations/me

Get the authenticated organization owner's organization.

**Roles:** ORGANIZATIONOWNER

**Response:** 200 OK

---

### GET /api/organizations/by-parent/:parentProfileId

Get organization linked to a parent profile.

**Roles:** ADMIN, PARENT

**Parameters:**
- parentProfileId (uuid, path)

**Response:** 200 OK

---

### GET /api/organizations/owner/:ownerId

Get organization by owner ID. Admin can access any; others can only access their own.

**Roles:** self or ADMIN

**Parameters:**
- ownerId (uuid, path)

**Response:** 200 OK

**Errors:** 403 — accessing another owner's org without ADMIN

---

### PATCH /api/organizations/:id/approve

Approve a pending or rejected organization.

**Roles:** ADMIN

**Parameters:**
- id (uuid, path)

**Response:** 200 OK

---

### PATCH /api/organizations/:id/reject

Reject a pending or approved organization.

**Roles:** ADMIN

**Parameters:**
- id (uuid, path)

**Request Body:**
`json
{
  "rejectionReason": "string"
}
`

**Response:** 200 OK

---

### GET /api/organizations/:id

Get organization by ID.

**Roles:** ADMIN, ORGANIZATIONOWNER

**Parameters:**
- id (uuid, path)

**Response:** 200 OK

---

### PATCH /api/organizations/:id

Update organization profile fields.

**Roles:** ADMIN, ORGANIZATIONOWNER

**Parameters:**
- id (uuid, path)

**Request Body:**
`json
{
  "organizationName": "Al Noor School",
  "organizationType": "SCHOOL"
}
`

**Response:** 200 OK

---

### DELETE /api/organizations/:id

Delete an organization.

**Roles:** ADMIN

**Parameters:**
- id (uuid, path)

**Response:** 200 OK

---

## 7. Teacher Endpoints

### POST /api/teachers

Create a new teacher.

**Roles:** ORGANIZATIONOWNER

**Request Body:**
`json
{
  "name": "teacher-name",
  "email": "teacher@example.com",
  "phone": "+201503657687",
  "organizationId": "uuid",
  "specialization": "string (optional)"
}
`

**Response:** 201 Created

---

### PATCH /api/teachers/:id

Update a teacher's information.

**Roles:** ORGANIZATIONOWNER

**Parameters:**
- id (uuid, path)

**Response:** 200 OK

---

### GET /api/teachers/organization/:organizationId

List all teachers in an organization.

**Roles:** ORGANIZATIONOWNER, ADMIN, TEACHER

**Parameters:**
- organizationId (uuid, path)

**Response:** 200 OK

---

### DELETE /api/teachers/:id

Remove a teacher.

**Roles:** ORGANIZATIONOWNER

**Parameters:**
- id (uuid, path)

**Response:** 200 OK

---

## 8. Parent Endpoints

### GET /api/parents/search?phone=<phone>

Find a parent by phone number.

**Roles:** ORGANIZATIONOWNER, ADMIN

**Query Parameters:**
- phone (string, required) — phone number with country code

**Response:** 200 OK

---

## 9. Enricher (Service Provider) Endpoints

### GET /api/enrichers/deals

List available open deals for providers.

**Roles:** ENRICHER

**Response:** 200 OK

---

### GET /api/enrichers/deals/:dealId

Get deal details for a provider.

**Roles:** ENRICHER

**Parameters:**
- dealId (uuid, path)

**Response:** 200 OK

---

### GET /api/enrichers/proposals

List the authenticated enricher's proposals.

**Roles:** ENRICHER

**Response:** 200 OK

---

## 10. Children Endpoints

### POST /api/children

Add a child with auto parent account creation (organization members).

**Roles:** ORGANIZATIONOWNER, TEACHER

**Request Body:**
`json
{
  "name": "child-name",
  "birthDate": "2007-05-21",
  "gender": "MALE",
  "classId": "0a7d391a-a4e5-4716-89c3-158a97919c89",
  "parentPhone": "+201503657687",
  "parentEmail": "parent@example.com",
  "parentName": "Parent Name"
}
`

**Response:** 201 Created

---

### GET /api/children/all

Get all children (admin only).

**Roles:** ADMIN

**Response:** 200 OK

---

### GET /api/children?userId=<uuid>

Get all children for a specific user.

**Roles:** ADMIN, PARENT

**Query Parameters:**
- userId (uuid, required)

**Response:** 200 OK

---

### GET /api/children/organization/:orgId

Get all children for a specific organization.

**Roles:** ORGANIZATIONOWNER, ADMIN, TEACHER

**Parameters:**
- orgId (uuid, path)

**Response:** 200 OK

---

### GET /api/children/:id

Get child data by ID.

**Roles:** ADMIN, PARENT, ORGANIZATIONOWNER, TEACHER

**Parameters:**
- id (uuid, path)

**Response:** 200 OK

---

### PATCH /api/children/:id

Update child information.

**Roles:** ADMIN, PARENT, ORGANIZATIONOWNER, TEACHER

**Parameters:**
- id (uuid, path)

**Response:** 200 OK

---

### DELETE /api/children/:id

Delete a child record.

**Roles:** ADMIN, PARENT, ORGANIZATIONOWNER, TEACHER

**Parameters:**
- id (uuid, path)

**Response:** 200 OK

---

## 11. Parent-Children Endpoints

### POST /api/parent/children

Add a private (non-institutional) child.

**Roles:** PARENT

**Request Body:**
`json
{
  "name": "child-name",
  "birthDate": "2007-02-28",
  "gender": "MALE"
}
`

**Response:** 201 Created

---

### GET /api/parent/children

List private children for the current parent.

**Roles:** PARENT

**Response:** 200 OK

---

### GET /api/parent/org-children

List organization-linked children for the current parent.

**Roles:** PARENT

**Response:** 200 OK

---

## 12. Child Transfers Endpoints

### POST /api/child-transfers

Request moving a child to another organization.

**Roles:** ORGANIZATIONOWNER, ADMIN

**Request Body:**
`json
{
  "childId": "uuid",
  "toOrganizationId": "uuid",
  "childType": "organization"
}
`

**Response:** 201 Created

---

### PATCH /api/child-transfers/:id/approve

Approve a child transfer request and assign a class.

**Roles:** ORGANIZATIONOWNER, ADMIN

**Parameters:**
- id (uuid, path)

**Request Body:**
`json
{
  "classId": "uuid"
}
`

**Response:** 200 OK

---

### PATCH /api/child-transfers/:id/reject

Reject a child transfer request.

**Roles:** ORGANIZATIONOWNER, ADMIN

**Parameters:**
- id (uuid, path)

**Response:** 200 OK

---

### GET /api/child-transfers

List transfer requests.

**Roles:** ORGANIZATIONOWNER, ADMIN

**Response:** 200 OK

---

## 13. Class Endpoints

### POST /api/classes

Create a new class.

**Roles:** ORGANIZATIONOWNER

**Request Body:**
`json
{
  "name": "class-name",
  "gradeId": "f120dbc5-4fab-480c-af01-eac3b3942fc6",
  "teacherId": "uuid (optional)"
}
`

**Response:** 201 Created

---

### GET /api/classes

Get all classes.

**Roles:** ADMIN

**Response:** 200 OK

---

### GET /api/classes/organization/:orgId

Get all classes in an organization.

**Roles:** ORGANIZATIONOWNER, ADMIN, TEACHER

**Parameters:**
- orgId (uuid, path)

**Response:** 200 OK

---

### GET /api/classes/:id/get-children

Get all children in a class.

**Roles:** ORGANIZATIONOWNER, ADMIN, TEACHER

**Parameters:**
- id (uuid, path)

**Response:** 200 OK

---

### GET /api/classes/:id

Get a single class.

**Roles:** ADMIN, ORGANIZATIONOWNER, TEACHER

**Parameters:**
- id (uuid, path)

**Response:** 200 OK

---

### PATCH /api/classes/:id

Update a class.

**Roles:** ORGANIZATIONOWNER

**Parameters:**
- id (uuid, path)

**Response:** 200 OK

---

### DELETE /api/classes/:id

Delete a class.

**Roles:** ORGANIZATIONOWNER

**Parameters:**
- id (uuid, path)

**Response:** 200 OK

---

### POST /api/classes/:clsId/asign/:childId

Assign a child to a class.

**Roles:** ORGANIZATIONOWNER

**Parameters:**
- clsId (uuid, path) — class ID
- childId (uuid, path) — child ID

**Response:** 200 OK

---

## 14. Grade Endpoints

### POST /api/grades

Create a grade.

**Roles:** ORGANIZATIONOWNER

**Response:** 201 Created

---

### GET /api/grades

Get all grades.

**Roles:** ADMIN

**Response:** 200 OK

---

### GET /api/grades/organization/:orgId

Get all grades for a specific organization.

**Roles:** ORGANIZATIONOWNER, ADMIN, TEACHER

**Parameters:**
- orgId (uuid, path)

**Response:** 200 OK

---

### GET /api/grades/:id

Get a single grade.

**Roles:** ORGANIZATIONOWNER, ADMIN, TEACHER

**Parameters:**
- id (uuid, path)

**Response:** 200 OK

---

### PATCH /api/grades/:id

Update a grade.

**Roles:** ORGANIZATIONOWNER

**Parameters:**
- id (uuid, path)

**Response:** 200 OK

---

### DELETE /api/grades/:id

Delete a grade.

**Roles:** ORGANIZATIONOWNER

**Parameters:**
- id (uuid, path)

**Response:** 200 OK

---

## 15. Evaluation Endpoints

### POST /api/evaluations

Create an evaluation with dimensions, questions, and scored answers.

**Roles:** ADMIN

**Response:** 201 Created

---

### GET /api/evaluations

Get all evaluations for admin.

**Roles:** ADMIN

**Response:** 200 OK

---

### GET /api/evaluations/available/:childId

Get available evaluations for a child by age.

**Roles:** PARENT

**Parameters:**
- childId (uuid, path)

**Response:** 200 OK

---

### GET /api/evaluations/:id/details

Get evaluation details with scoring data (admin).

**Roles:** ADMIN

**Parameters:**
- id (uuid, path)

**Response:** 200 OK

---

### GET /api/evaluations/:id/form

Get evaluation form without exposing score values.

**Roles:** PARENT, ADMIN

**Parameters:**
- id (uuid, path)

**Response:** 200 OK

---

### POST /api/evaluations/:id/start

Start an evaluation attempt for a child.

**Roles:** PARENT

**Parameters:**
- id (uuid, path) — evaluation ID

**Request Body:**
`json
{
  "childId": "uuid"
}
`

**Response:** 201 Created

---

## 16. Evaluation Attempt Endpoints

### GET /api/attempts

Admin list and filter evaluation attempts.

**Roles:** ADMIN

**Query Parameters:**
- status (string, optional) — filter by attempt status
- evaluationId (uuid, optional)
- childId (uuid, optional)

**Response:** 200 OK

---

### GET /api/attempts/child/:childId

Get evaluation attempts for a child.

**Roles:** PARENT, ADMIN

**Parameters:**
- childId (uuid, path)

**Response:** 200 OK

---

### POST /api/attempts/:childId/start

Open the main free evaluation slot for a private child.

**Roles:** PARENT

**Parameters:**
- childId (uuid, path)

**Response:** 201 Created

---

### POST /api/attempts/:childId/retake

Open the free retake slot for a private child.

**Roles:** PARENT

**Parameters:**
- childId (uuid, path)

**Response:** 201 Created

---

### POST /api/attempts/:childId/request-extra

Request a paid extra evaluation attempt.

**Roles:** PARENT

**Parameters:**
- childId (uuid, path)

**Response:** 201 Created

---

### PATCH /api/attempts/:id/save

Save evaluation attempt progress (incremental).

**Roles:** PARENT

**Parameters:**
- id (uuid, path) — attempt ID

**Response:** 200 OK

---

### POST /api/attempts/:id/submit

Submit evaluation attempt final answers.

**Roles:** PARENT

**Parameters:**
- id (uuid, path) — attempt ID

**Response:** 200 OK

---

### GET /api/attempts/:id

Get evaluation attempt details.

**Roles:** PARENT, ADMIN, ORGANIZATIONOWNER, TEACHER

**Parameters:**
- id (uuid, path) — attempt ID

**Response:** 200 OK

---

### POST /api/attempts/:id/approve

Admin approve an evaluation attempt.

**Roles:** ADMIN

**Parameters:**
- id (uuid, path) — attempt ID

**Response:** 200 OK

---

## 17. Admin Private Attempt Endpoints

### POST /api/admin/attempts/:id/approve

Approve an extra private evaluation attempt (creates checkout session).

**Roles:** ADMIN

**Parameters:**
- id (uuid, path) — evaluation slot ID

**Response:** 200 OK — creates payment checkout session

---

## 18. Owner Evaluation Results Endpoints

### GET /api/evaluations/owner/filters

Get owner filters: classes and evaluations for dropdowns.

**Roles:** ORGANIZATIONOWNER, ADMIN

**Response:** 200 OK

---

### GET /api/evaluations/owner/reports

Get owner evaluation report cards.

**Roles:** ORGANIZATIONOWNER, ADMIN

**Query Parameters:**
- evaluationId (uuid, optional)

**Response:** 200 OK

---

### GET /api/evaluations/owner/classes/:classId/evaluations/:evaluationId/summary

Get class evaluation summary by class and evaluation.

**Roles:** ORGANIZATIONOWNER, ADMIN

**Parameters:**
- classId (uuid, path)
- evaluationId (uuid, path)

**Response:** 200 OK

---

### GET /api/evaluations/owner/classes/:classId/evaluations/:evaluationId/status

Get class evaluation status (who has completed vs pending).

**Roles:** ORGANIZATIONOWNER, ADMIN

**Parameters:**
- classId (uuid, path)
- evaluationId (uuid, path)

**Response:** 200 OK

---

### POST /api/evaluations/owner/children/:childId/reminder

Send evaluation reminder to parent.

**Roles:** ORGANIZATIONOWNER, ADMIN

**Parameters:**
- childId (uuid, path)

**Response:** 200 OK

---

## 19. Deal Endpoints

### POST /api/deals

Create a new deal.

**Roles:** ORGANIZATIONOWNER, TEACHER

**Response:** 201 Created

---

### GET /api/deals

List deals, optionally filtered by status.

**Roles:** ORGANIZATIONOWNER, TEACHER, ENRICHER

**Query Parameters:**
- status (string, optional) — filter by deal status (e.g., OPEN)

**Response:** 200 OK

---

### GET /api/deals/:dealId

Get deal details.

**Roles:** ORGANIZATIONOWNER, TEACHER, ENRICHER

**Parameters:**
- dealId (uuid, path)

**Response:** 200 OK

---

### GET /api/deals/:dealId/proposals

List proposals for a deal (org owner only).

**Roles:** ORGANIZATIONOWNER

**Parameters:**
- dealId (uuid, path)

**Response:** 200 OK

---

### POST /api/deals/:dealId/proposals

Submit a proposal for a deal.

**Roles:** ENRICHER

**Parameters:**
- dealId (uuid, path)

**Response:** 201 Created

---

### POST /api/deals/:dealId/proposals/:proposalId/select

Select a winning proposal.

**Roles:** ORGANIZATIONOWNER

**Parameters:**
- dealId (uuid, path)
- proposalId (uuid, path)

**Response:** 200 OK

---

### POST /api/deals/:dealId/proposals/:proposalId/approve

Admin approve a selected proposal.

**Roles:** ADMIN

**Parameters:**
- dealId (uuid, path)
- proposalId (uuid, path)

**Response:** 200 OK

---

## 20. Proposal Endpoints

### PATCH /api/proposals/:id

Update proposal price before deal deadline.

**Roles:** ENRICHER

**Parameters:**
- id (uuid, path)

**Response:** 200 OK

---

## 21. Activity Endpoints

### POST /api/activities

Create a new activity.

**Roles:** ADMIN

**Response:** 201 Created

---

### GET /api/activities

Get all activities.

**Roles:** ADMIN, ORGANIZATIONOWNER, TEACHER, ENRICHER

**Response:** 200 OK

---

### GET /api/activities/with-deals

Get all activities with their associated deals.

**Roles:** ADMIN, ORGANIZATIONOWNER, TEACHER, ENRICHER

**Response:** 200 OK

---

### GET /api/activities/:id

Get a single activity by ID.

**Roles:** ADMIN, ORGANIZATIONOWNER, TEACHER, ENRICHER

**Parameters:**
- id (uuid, path)

**Response:** 200 OK

---

### GET /api/activities/:id/with-deals

Get a single activity with its deals.

**Roles:** ADMIN, ORGANIZATIONOWNER, TEACHER, ENRICHER

**Parameters:**
- id (uuid, path)

**Response:** 200 OK

---

### PATCH /api/activities/:id

Update an activity.

**Roles:** ADMIN

**Parameters:**
- id (uuid, path)

**Response:** 200 OK

---

### DELETE /api/activities/:id

Delete an activity.

**Roles:** ADMIN

**Parameters:**
- id (uuid, path)

**Response:** 200 OK

---

## 22. Payment Endpoints

### POST /api/payments

Create a SAR checkout session (Moyasar).

**Roles:** PARENT

**Response:** 201 Created

---

### POST /api/payments/webhook

Provider webhook (signature-validated, idempotent, queued).

**Access:** Public

**Headers:**
- x-moyasar-signature (required) — HMAC-SHA256 hex digest of the raw body

**Response:** 200 OK

---

### POST /api/payments/:attemptId/initiate

Refresh or retry checkout for a private extra attempt after admin approval.

**Roles:** PARENT

**Parameters:**
- ttemptId (uuid, path)

**Response:** 200 OK

---

### POST /api/payments/:id/retry

Retry a failed or expired payment.

**Roles:** PARENT

**Parameters:**
- id (uuid, path) — payment ID

**Response:** 200 OK

---

## 23. Notification Endpoints

### POST /api/notifications/verify-email

Send verification email.

**Access:** Authenticated

**Request Body:**
`json
{
  "email": "user@example.com",
  "userId": "uuid"
}
`

**Response:** 201 Created
`json
{
  "success": true,
  "message": "Verification email queued successfully"
}
`

---

### GET /api/notifications

List notifications for the authenticated user.

**Access:** Authenticated

**Response:** 200 OK

---

### GET /api/notifications/unread-count

Get the count of unread in-app notifications.

**Access:** Authenticated

**Response:** 200 OK

---

### PATCH /api/notifications/read-all

Mark all notifications as read for the current user.

**Access:** Authenticated

**Response:** 200 OK

---

### PATCH /api/notifications/:id/read

Mark a single notification as read.

**Access:** Authenticated

**Parameters:**
- id (uuid, path)

**Response:** 200 OK

---

### POST /api/notifications/dispatch

Enqueue a notification for a user (admin). Queues email, in-app, or both.

**Roles:** ADMIN

**Response:** 201 Created

---

## 24. Upload Endpoints

### POST /api/uploads/upload

Upload a file. Rate-limited: 20/min.

**Roles:** ADMIN, ORGANIZATIONOWNER, PARENT

**Request:** multipart/form-data
- ile — JPEG, PNG, WebP, or PDF (max 5 MB)

**Response:** 201 Created
`json
{
  "message": "file uploaded successfully",
  "filename": "uuid.jpg",
  "mimeType": "image/jpeg",
  "size": 123456
}
`

**Errors:** 400 — unsupported file type or no file

---

## 25. Capacity Request Endpoints

### POST /api/capacity-requests

Create a capacity request (parent only).

**Roles:** PARENT

**Response:** 201 Created

---

### GET /api/capacity-requests

List capacity requests for the authenticated user.

**Access:** Authenticated

**Response:** 200 OK

---

### GET /api/capacity-requests/:id

Get a single capacity request.

**Access:** Authenticated

**Parameters:**
- id (uuid, path)

**Response:** 200 OK

---

### PATCH /api/capacity-requests/:id

Update a capacity request (admin only).

**Roles:** ADMIN

**Parameters:**
- id (uuid, path)

**Response:** 200 OK

---

### POST /api/capacity-requests/:id/approve

Approve a capacity request (admin only).

**Roles:** ADMIN

**Parameters:**
- id (uuid, path)

**Response:** 200 OK

---

### POST /api/capacity-requests/:id/reject

Reject a capacity request (admin only).

**Roles:** ADMIN

**Parameters:**
- id (uuid, path)

**Response:** 200 OK

---

## 26. Session Endpoints

### POST /api/session

Create a session record.

**Access:** Authenticated

**Response:** 201 Created

---

### GET /api/session

List all sessions.

**Access:** Authenticated

**Response:** 200 OK

---

### GET /api/session/:id

Get a single session.

**Access:** Authenticated

**Parameters:**
- id (uuid, path)

**Response:** 200 OK

---

## 27. Entity Summary

### Core Entities

| Entity | Table | Description |
|--------|-------|-------------|
| User | users | Authentication and profile record for all roles |
| Role | oles | Role definitions (ADMIN, ORGANIZATIONOWNER, TEACHER, ENRICHER, PARENT) |
| Session | sessions | Refresh token sessions linked to users |
| Organization | organizations | Schools, centers, nurseries, institutes, clinics |
| ParentProfile | parents | Extended profile for parent users |
| ParentOrganization | parent_organizations | Join table linking parents to organizations |
| Teacher | 	eachers | Teacher profile linked to users and organizations |
| Enricher | enrichers | Service provider profile linked to users |
| Notification | 
otifications | In-app and email notification records |

### Child & Education Entities

| Entity | Table | Description |
|--------|-------|-------------|
| OrganizationChild | — | Institutional child (belongs to an org/class) |
| PrivateChild | — | Private child (registered by parent, no org) |
| ChildProfile | — | Extended child profile data |
| ChildReport | — | Child report records |
| TransferRequest | — | Child transfer requests between organizations |
| Class | classes | Classes within an organization, linked to a grade |
| Grade | grades | Grade levels within an organization |

### Evaluation Entities

| Entity | Table | Description |
|--------|-------|-------------|
| Evaluation | — | Assessment template with scoring strategy |
| EvaluationDimension | — | Dimension/category within an evaluation |
| EvaluationQuestion | — | Question within a dimension |
| EvaluationQuestionAnswer | — | Scored answer option for a question |
| EvaluationAnswer | — | Child's answer to a question in an attempt |
| EvaluationAttempt | — | A child's attempt at an evaluation |
| EvaluationApproval | — | Approval records for attempts |
| EvaluationSlot | — | Slot management for private child evaluations |

### Marketplace & Finance Entities

| Entity | Table | Description |
|--------|-------|-------------|
| Deal | — | Service deal/opportunity posted by organizations |
| Proposal | — | Bid/proposal submitted by an enricher |
| Activity | — | Activity category that groups deals |
| Payment | — | Payment transactions via Moyasar |
| PaymentWebhookDedup | — | Idempotency tracking for webhook events |
| CapacityRequest | capacity_requests | Parent requests to increase child capacity |

### Common Entities

| Entity | Table | Description |
|--------|-------|-------------|
| AuditLog | udit_log | Audit trail for key mutating operations |

### Key Relationships

```
User 1──1 ParentProfile
User 1──1 Teacher
User 1──1 Enricher
User 1──1 Organization (owner)
User M──M Role
ParentProfile 1──M OrganizationChild
ParentProfile 1──M PrivateChild
ParentProfile M──M Organization (via ParentOrganization)
Organization 1──M Class
Organization 1──M Grade
Grade 1──M Class
Class 1──M OrganizationChild
OrganizationChild 1──1 ChildProfile
PrivateChild 1──1 ChildProfile
ChildProfile 1──M ChildReport
ChildProfile 1──M EvaluationAttempt
Evaluation 1──M EvaluationDimension
EvaluationDimension 1──M EvaluationQuestion
EvaluationQuestion 1──M EvaluationQuestionAnswer
EvaluationAttempt 1──M EvaluationAnswer
EvaluationAnswer 1──1 EvaluationQuestionAnswer
Activity 1──M Deal
Deal 1──M Proposal
User 1──M Payment
Organization 1──M CapacityRequest
```

---

> **Document Version:** 1.0.0  
> **Generated from:** NestJS v11 + TypeORM source code analysis  
> **Swagger UI:** /api-docs (when server is running)
