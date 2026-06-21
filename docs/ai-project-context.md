# AI Project Context - Ithraa Backend

**Last Updated:** 2026-06-09
**Status:** Post-Parent Model Refactor (Full Migration)

---

## 1. Project Overview

### Technology Stack
- **Framework:** NestJS 11
- **Language:** TypeScript
- **ORM:** TypeORM
- **Database:** PostgreSQL
- **Runtime:** Node.js

### Purpose
Educational/child-development platform managing organizations (schools), students (children), parents, teachers, and evaluations with payment processing for premium assessment attempts.

### Core Entities
- **Organization** = School
- **User** = Authentication/account identity with roles
- **ParentProfile** = Parent domain profile (NEW)
- **Child** = Student record (linked to parent)
- **Teacher** = Staff member
- **Enricher** = Content provider
- **Grade** = Academic level
- **Class** = Classroom grouping
- **Evaluation** = Assessment schema
- **EvaluationAttempt** = Specific attempt by parent for child
- **EvaluationSlot** = Attempt slot (MAIN/RETAKE/EXTRA)
- **Payment** = Extra attempt purchase

---

## 2. Domain Model Summary (POST-REFACTOR)

### User Entity
- **Purpose:** Authentication and account management
- **Fields:** id, name, email, phone, password, roles, createdAt, updatedAt
- **Relations:**
  - `roles: Role[]` (many-to-many)
  - `ownedOrganization: Organization?` (one-to-one, for org owners)
  - `organization: Organization?` (many-to-one, for staff/members, nullable)
  - `teacher: Teacher?` (one-to-one)
  - `enricher: Enricher?` (one-to-one)
  - `parentProfile: ParentProfile?` (one-to-one, NEW - if user has PARENT role)
  - `children: Child[]` (one-to-many, for createdBy relationship only, not parent ownership)

**KEY CHANGE:** User no longer owns children via `parentChildren` relation. Parent ownership is now via ParentProfile.

### ParentProfile Entity (NEW)
- **Purpose:** Domain profile for parents
- **Table:** `parents`
- **Fields:**
  - `id: uuid` (primary key)
  - `userId: uuid` (unique, foreign key to User)
  - `createdAt: Date`
  - `updatedAt: Date`
- **Relations:**
  - `user: User` (one-to-one, cascade delete)
  - `children: Child[]` (one-to-many, parent ownership)
  - `organizationLinks: ParentOrganization[]` (one-to-many)
- **Key Invariants:**
  - One user can have at most one ParentProfile
  - User must have PARENT role to have ParentProfile
  - Cascade delete ensures data integrity

### ParentOrganization Entity (NEW)
- **Purpose:** Links parent to organization with metadata
- **Table:** `parent_organizations`
- **Fields:**
  - `id: uuid`
  - `parentId: uuid` (FK to ParentProfile)
  - `organizationId: uuid` (FK to Organization)
  - `status: enum` (ACTIVE | INVITED | BLOCKED)
  - `source: enum` (CHILD_REGISTRATION | MANUAL_INVITE | TRANSFER | BACKFILL)
  - `createdAt: Date`
  - `updatedAt: Date`
- **Constraints:**
  - Unique: (parentId, organizationId)
  - Indexes: (parentId, organizationId), (organizationId)
- **Purpose:** Supports future metadata and multi-organization parent relationships

### Child Entity (UPDATED)
- **Purpose:** Student record
- **Changes from Previous:**
  - `parent: ParentProfile` (was User, NOW ParentProfile)
  - `parentId: uuid` (NOW refers to ParentProfile.id, was User.id)
  - `createdBy: User` (unchanged, who created the record)
- **Fields:**
  - `id, name, birthDate, gender`
  - `classId: uuid?` (nullable, null for private children)
  - `organizationId: uuid?` (nullable, null for private children)
  - `parentId: uuid` (FK to ParentProfile, not User)
  - `createdById: uuid` (FK to User who created)
- **Private Child:**
  - `organizationId = null`
  - `classId = null`
  - Belongs to parent, not any school
  - Parent has limit of 2 private children per ParentProfile
- **Organization Child:**
  - `organizationId = Organization.id`
  - `classId = Class.id` (must belong to organization's class)
  - Linked to school via class
  - Parent still owns child, but school can manage enrollment

### Organization Entity
- **Purpose:** Represents a school
- **Key Relations:**
  - `owner: User` (one-to-one, organization owner)
  - `users: User[]` (staff/member list via User.organization)
  - `parentLinks: ParentOrganization[]` (NEW, parent relationships)
- **Status:**
  - `approvalStatus: PENDING | APPROVED | REJECTED`
  - Pending/rejected organizations cannot create classes, children, or operate
  - Admin must approve before operational use

### EvaluationAttempt Entity (UPDATED)
- **Purpose:** Specific evaluation attempt record
- **Changes:**
  - `parent: ParentProfile` (was User)
  - `parentId: uuid` (NOW refers to ParentProfile.id)
- **Constraints:**
  - Unique: (evaluationId, parentId, childId, attemptNumber)
  - Index: (evaluationId, parentId, childId)
- **Status:** IN_PROGRESS | SUBMITTED | APPROVED | REJECTED

### EvaluationSlot Entity (UPDATED)
- **Purpose:** Attempt slot (MAIN/RETAKE/EXTRA)
- **Changes:**
  - `parent: ParentProfile` (was User)
  - `parentId: uuid` (NOW refers to ParentProfile.id)
- **Kind:** MAIN | RETAKE | EXTRA
- **Status:** READY | REQUESTED | AWAITING_PAYMENT | CONSUMED | COMPLETED
- **Constraints:**
  - Unique index on (childId, parentId, kind) for READY/REQUESTED/AWAITING_PAYMENT/CONSUMED statuses

---

## 3. Business Rules (Post-Refactor)

### Organization Lifecycle
1. School owner registers organization (status: PENDING)
2. Admin approves organization (status: APPROVED)
3. Approved organization can:
   - Create grades, classes, teachers
   - Enroll children and link parents
   - Conduct evaluations
4. Rejected organization (status: REJECTED) cannot operate
5. Organization has exactly one owner

### Parent & Child Relationships
1. **Parent Can Have Multiple Child Types:**
   - Private children (organizationId = null)
   - Organization children in School A
   - Organization children in School B
   - No limit on organization children, but limit of 2 private children per ParentProfile

2. **Parent-School Relationship:**
   - Derived from children + ParentOrganization table
   - ParentOrganization created when school owner creates child for parent
   - Supports future admin operations (invite, block parents)

3. **Parent Ownership:**
   - Parent owns all children linked to their ParentProfile
   - Ownership is via ParentProfile.id, not User.id
   - Parent can access/evaluate own children regardless of organization

4. **School Owner Authority:**
   - Can create children in own organization only
   - Can manage children where child.organizationId = owner.organizationId
   - Cannot access private children (organizationId = null)
   - Cannot see children from other organizations

### Evaluation Flow
1. Parent creates evaluation attempt for own child
2. Parent saves progress (multiple saves)
3. Parent submits attempt
4. School admin approves attempt (org children only)
5. Notifications sent to parent
6. Parent can request retake (if entitlement available)
7. Parent can purchase extra attempts (for private children)

### Private vs Organization Child Distinction
- **Private Child:**
  - No organization affiliation
  - Only parent can see/manage
  - Limit 2 per parent
  - Parent evaluations only
  - Payment required for extra attempts

- **Organization Child:**
  - Linked to school via class
  - Parents and school staff can see (per role rules)
  - School can create and manage enrollment
  - Parent and school evaluations supported
  - No payment requirement (typically covered by school)

---

## 4. Key Business Rules Preserved

✅ Organization must be approved before operation
✅ Parent cannot exceed 2 private children
✅ Parent access independent of organization membership
✅ Organization owner access limited to own org children
✅ Teacher access limited to class children
✅ Admin access to all children
✅ Child transfer flow intact
✅ Payment ownership checks updated to ParentProfile
✅ Evaluation attempt uniqueness maintained
✅ Notifications sent to parent User (via ParentProfile.userId)

---

## 5. Important Endpoints

### Authentication
- `POST /auth/signup`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/verify-email`

### Organizations
- `GET /organizations/me` - Current user's organization (if owner)
- `POST /organizations` - Create organization
- `GET /organizations` - List organizations (admin only)
- `PATCH /organizations/:id/approve` - Approve organization (admin)
- `PATCH /organizations/:id/reject` - Reject organization (admin)

### Children - Parent Private Flow
- `POST /parent/children` - Create private child
- `GET /parent/children` - List private children
- `GET /parent/org-children` - List organization children (across all orgs)
- `GET /children/:id` - Get child details

### Children - School Flow
- `POST /children` - Create child (school owner only)
- `GET /children` - List all children (school owner context)
- `PATCH /children/:id` - Update child
- `DELETE /children/:id` - Delete child

### Evaluations
- `GET /evaluations/available/:childId` - Find available evaluations for child
- `POST /evaluations/:id/start` - Start evaluation attempt
- `PATCH /attempts/:id/save` - Save progress
- `POST /attempts/:id/submit` - Submit attempt
- `GET /attempts/:id` - Get attempt details

### Payments
- `POST /payments` - Create payment for extra attempt
- `GET /payments/:id` - Get payment status

### Child Transfers
- `POST /child-transfers/request` - Request child transfer
- `GET /child-transfers` - List transfer requests
- `PATCH /child-transfers/:id/approve` - Approve transfer

---

## 6. API Contract Notes (Post-Migration)

### Response Field Changes
- **Child Response:**
  - `parentId` NOW means `ParentProfile.id` (was `User.id`)
  - Use `parentUserId` if you need the parent user's ID
  - Use `parentProfileId` for explicit parent profile reference
- **Evaluation Attempt Response:**
  - `parentId` NOW means `ParentProfile.id`
  - Notifications still route to parent `User.id`

### Backward Compatibility
- API consumers **must** update to expect `parentId` as ParentProfile.id
- Any frontend using `child.parentId === loggedInUserId` must change to `child.parentUserId === loggedInUserId`
- Response DTOs will explicitly include both fields to avoid ambiguity

---

## 7. Security / RBAC Rules

### IMPORTANT: Backend is source of truth

**Roles:**
- `ADMIN`: Full access to all resources
- `ORGANIZATIONOWNER`: Access to own organization resources
- `PARENT`: Access to own children and evaluations
- `TEACHER`: Access to assigned class and its children
- `ENRICHER`: Limited access (content provider)

**Parent Access:**
- Parent User can access/manage children where `child.parent.userId === currentUser.id`
- Parent access is NOT gated by `User.organization` (no longer used for parent access)
- Parent can access children across multiple organizations
- Evaluation attempts are owned by parent: `attempt.parent.userId === currentUser.id`

**Organization Owner Access:**
- Owner can only access children in own organization: `child.organizationId === ownerOrgId`
- Owner **cannot** access private children: `child.organizationId = null`
- Owner accesses org children via `child.organization` relationship, not User.organization

**Approval Gate:**
- Any operational action on organization children requires: `organization.approvalStatus === APPROVED`
- Pending/rejected organizations cannot create classes or conduct evaluations

**Data Isolation:**
- Private children (organizationId = null) visible only to parent and admin
- Organization children visible to parent, org owner, assigned teachers, and admin
- Do not leak private children to organization users without explicit permission

---

## 8. Database Schema Notes (Post-Migration)

### New Tables
- `parents` - ParentProfile records (1:1 with users)
- `parent_organizations` - Parent-school links with metadata

### Modified Foreign Keys
- `children.parentId` - NOW FK to `parents.id` (was `users.id`)
- `evaluation_attempts.parentId` - NOW FK to `parents.id` (was `users.id`)
- `evaluation_slot.parentId` - NOW FK to `parents.id` (was `users.id`)

### Removed Relations
- `users.parentChildren` - inverse no longer exists (moved to ParentProfile)

### Migration Strategy
- Full migration implemented via database scripts
- All parent-child relationships backfilled to ParentProfile
- Old User.id to ParentProfile.id mappings created for all existing data

See `docs/parent-profile-migration-plan.md` for detailed migration steps.

---

## 9. Known Limitations & TODOs

### Current Limitations
1. **ParentOrganization metadata:** Status and source fields not yet utilized by UI
2. **Parent search:** May need additional indexes for performance
3. **Organization child limit:** No enforcement of max children per organization
4. **Transfer workflow:** Complex logic around multi-org parent transfers

### Potential Future Enhancements
1. Admin ability to invite/block parents to organizations
2. Parent notification preferences per organization
3. Bulk parent import via CSV
4. Parent activity audit logging
5. Organization-specific parent portals

---

## 10. Instructions for Future AI Agents

### CRITICAL: Always Read This First
This file documents the parent domain model refactor completed on 2026-06-09. Understand this before making changes to parent-related code.

### Key Principles
1. **Parent access is NOT via User.organization**
   - Parent ownership is via `ParentProfile.userId` comparison
   - `User.organization` is for staff/members only
   - Do not re-introduce User.organization for parent access

2. **ParentProfile.id is not User.id**
   - `child.parentId` NOW means `ParentProfile.id`
   - If API response needs parent user ID, explicitly include `parentUserId` field
   - Never overload `parentId` ambiguously

3. **Parent can have multiple organizations**
   - Do not assume parent belongs to single organization
   - Use ParentOrganization table to find all parent-org links
   - Private children (organizationId=null) are accessible to parent anywhere

4. **Approval gate is mandatory**
   - Operational mutations on org children require `organization.approvalStatus === APPROVED`
   - Do not bypass this gate for any reason

5. **Backward compatibility:**
   - Frontend may need updates if it used `child.parentId === userId` comparisons
   - Update to use explicit `child.parentUserId` if available
   - See FRONTEND COMPATIBILITY REPORT for details

### When Making Changes
- Always check if change affects ParentProfile or ParentOrganization
- Update tests if changing parent access logic
- Verify organization approval flow still works
- Run `npm run build && npm test` before considering change complete
- Update AI_PROJECT_CONTEXT.md if new parent-related features added

### Files to Review
- `src/users/entities/parent-profile.entity.ts` - Parent profile schema
- `src/users/entities/parent-organization.entity.ts` - Parent-org link schema
- `src/users/services/parent-profiles.service.ts` - Parent profile operations
- `src/children/children.service.ts` - Child creation/access
- `src/children/services/child-access-policy.service.ts` - Access control
- `src/evaluations/services/evaluation-access-policy.service.ts` - Attempt access control

### Do NOT:
- Re-enable User.organization for parent ownership
- Assume parent belongs to one organization
- Forget organization approval gate
- Expose private children to unauthorized users
- Use User.id for parent ownership checks without loading ParentProfile.userId

---

## 11. Migration Completed

**Date:** 2026-06-09
**Strategy:** Full migration (new entities created, data backfilled, old relationships updated)
**Status:** Implementation in progress

See `docs/parent-profile-migration-plan.md` for detailed migration steps and SQL.

