# AI Quick Context - Ithraa Backend

**[UPDATED 2026-06-09 - Parent Model Refactor Completed]**

---

## System Overview

**Ithraa** is an educational platform built with NestJS + TypeORM + PostgreSQL.

- **What it does:** Manages schools (organizations), students (children), parents, teachers, and learning evaluations with payment support.
- **Key entities:** Organization=School, User=Account, ParentProfile=Parent Domain Profile (NEW), Child=Student

---

## Quick Domain Facts

| Concept | What It Is | Key Details |
|---------|-----------|------------|
| **Organization** | School | Has owner, status (PENDING/APPROVED/REJECTED), classes, teachers, children, parents |
| **User** | Account/Login | Has roles (ADMIN/OWNER/PARENT/TEACHER/ENRICHER); password + auth |
| **ParentProfile** | Parent Identity | 1:1 with User, owns children, links to organizations, NEW in refactor |
| **ParentOrganization** | Parent-School Link | Tracks which schools a parent connects to, supports future metadata |
| **Child** | Student | Belongs to ParentProfile (not User), can be private or in a school/class |
| **Class** | Classroom | Belongs to organization, has grades, teachers, children |
| **Evaluation** | Assessment | Template for testing; creates attempts for specific child-parent pairs |
| **EvaluationAttempt** | Test Taking | Specific child taking specific evaluation; owns progress/answers |
| **EvaluationSlot** | Attempt Slot | MAIN/RETAKE/EXTRA - determines available attempts for private children |

---

## Critical Changes (Parent Refactor)

| What Changed | Old Way | New Way |
|-------------|---------|---------|
| Parent = ??? | `User` with PARENT role | `ParentProfile` (1:1 with User) |
| Who owns child? | `child.parent: User` | `child.parent: ParentProfile` |
| Parent access check | `child.parentId === userId` | `child.parent.userId === userId` |
| Parent-school link | Via `User.organization` | Via `ParentOrganization` table |
| Parent scope | Single organization | Multiple organizations ✓ |

**IMPORTANT:** `child.parentId` now means `ParentProfile.id`, NOT `User.id`. If you need user ID, use `child.parentUserId` or query `child.parent.userId`.

---

## Access Rules (RBAC)

- **ADMIN:** Can access anything
- **PARENT:** Can access own children (all organization children + all private children); access is via `ParentProfile.userId`
- **ORGANIZATIONOWNER:** Can access org children where `child.organizationId === ownerOrgId` ONLY; cannot access private children
- **TEACHER:** Can access children in assigned classes
- **ENRICHER:** Limited content provider access

**KEY RULE:** Parent access is NOT through `User.organization`. Do not use that field for parent ownership!

---

## Important Constraints

1. ✅ **Organization must be APPROVED** before any operational mutations
2. ✅ **Parent limit:** Max 2 private children per `ParentProfile`
3. ✅ **Child ownership:** Only parent can see/edit their children (unless ADMIN/TEACHER/ORGOWNER per rules)
4. ✅ **Evaluation attempts:** Tied to parent-child-evaluation triplet; parent must own child
5. ✅ **Transfer flow:** Complex; preserves ParentProfile ownership across organizations

---

## Key Services

| Service | Responsibility |
|---------|----------------|
| `ParentProfilesService` | Manage ParentProfile, create/link parents to organizations |
| `ChildrenService` | CRUD children; create private/org children; handle duplicates + transfers |
| `ChildAccessPolicy` | Enforce access rules for children |
| `EvaluationAccessPolicy` | Enforce parent ownership of attempts |
| `UsersService` | User creation/updates; role management |
| `OrganizationsService` | Org CRUD; approval flow; membership |

---

## Development Checklist

Before changing parent-related code:

- [ ] Read `docs/ai-project-context.md` (detailed version)
- [ ] Is the change parent access related? → Check `ChildAccessPolicy` and `EvaluationAccessPolicy`
- [ ] Do you need parent user ID? → Use `ParentProfile.userId`, not `child.parentId`
- [ ] Multi-organization scenario? → Check ParentOrganization table, not User.organization
- [ ] Does it affect child creation? → Validate duplicate detection uses ParentProfile.id
- [ ] Did you modify evaluations? → Verify approval gate still works
- [ ] Run: `npm run build && npm test` ✓

---

## Frontend Must Know

**API BREAKING CHANGES:**
- `child.parentId` is NOW `ParentProfile.id` (was `User.id`)
- If frontend does `child.parentId === userId`, IT WILL BREAK
- Solution: Use `child.parentUserId` (explicit) or query `child.parent.userId`
- See `docs/parent-profile-migration-plan.md` for migration steps

---

## Database Migration

Full migration completed:
1. Created `parents` table (ParentProfile)
2. Created `parent_organizations` table
3. Backfilled all parent data
4. Updated `children`, `evaluation_attempts`, `evaluation_slot` FKs to point to `parents.id`
5. Indexes and constraints updated

See `docs/parent-profile-migration-plan.md` for exact SQL.

---

## Common Pitfalls

❌ **DON'T:**
- Use `User.organization` to check if parent can access child
- Assume parent only has one organization
- Forget organization approval gate
- Expose private children (organizationId=null) to organization staff
- Use `child.parentId === userId` for access checks (use `child.parent.userId === userId`)

✅ **DO:**
- Load `child.parent` relation when checking parent access
- Query ParentOrganization for parent-school relationships
- Check `organization.approvalStatus === APPROVED` before mutations
- Hide private children from org users
- Explicitly use `parentUserId` and `parentProfileId` in responses

---

## Quick Links

- 📖 Full context: `docs/ai-project-context.md`
- 🗂️ Migration steps: `docs/parent-profile-migration-plan.md`
- 🏗️ Parent entities: `src/users/entities/parent-profile.entity.ts`, `src/users/entities/parent-organization.entity.ts`
- 🔐 Access policy: `src/children/services/child-access-policy.service.ts`
- 👶 Child service: `src/children/children.service.ts`

