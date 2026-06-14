# Parent Profile Migration Plan

## Overview

This document outlines the database migration and data backfill process for migrating the parent domain model from User-based to ParentProfile-based architecture.

## Context

**Old Model:**
- Parent = User with PARENT role
- Child.parentId points to User.id
- EvaluationAttempt.parentId points to User.id
- EvaluationSlot.parentId points to User.id

**New Model:**
- Parent = ParentProfile (1:1 with User)
- Child.parentId points to ParentProfile.id
- EvaluationAttempt.parentId points to ParentProfile.id
- EvaluationSlot.parentId points to ParentProfile.id
- ParentOrganization links ParentProfile to Organization with metadata

## Migration Strategy

This is a **FULL MIGRATION** - new tables created, data backfilled, old relationships updated.

## Step-by-Step Migration

### Phase 1: Create New Tables (Non-Breaking)

#### 1.1 Create `parents` table

```sql
CREATE TABLE IF NOT EXISTS "parents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL UNIQUE,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX "idx_parent_userId" ON "parents"("userId");
```

#### 1.2 Create `parent_organizations` table

```sql
CREATE TABLE IF NOT EXISTS "parent_organizations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "parentId" uuid NOT NULL,
  "organizationId" uuid NOT NULL,
  "status" varchar NOT NULL DEFAULT 'active',
  "source" varchar,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("parentId") REFERENCES "parents"("id") ON DELETE CASCADE,
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE,
  UNIQUE ("parentId", "organizationId")
);

CREATE INDEX "idx_parent_org_lookup" ON "parent_organizations"("parentId", "organizationId");
CREATE INDEX "idx_org_parents" ON "parent_organizations"("organizationId");
```

### Phase 2: Backfill ParentProfile Data

#### 2.1 Create ParentProfile for every PARENT user

```sql
INSERT INTO "parents" ("id", "userId", "createdAt", "updatedAt")
SELECT 
  gen_random_uuid(),
  u."id",
  u."createdAt",
  u."updatedAt"
FROM "users" u
INNER JOIN "user_roles" ur ON u."id" = ur."userId"
INNER JOIN "roles" r ON ur."rolesId" = r."id"
WHERE r."name" = 'PARENT'
  AND NOT EXISTS (
    SELECT 1 FROM "parents" p WHERE p."userId" = u."id"
  )
ON CONFLICT DO NOTHING;
```

### Phase 3: Update Child Entity References

#### 3.1 Map old child.parentId (User.id) to new parentProfileId (ParentProfile.id)

First, add new column temporarily:

```sql
ALTER TABLE "children" ADD COLUMN "parentProfileId" uuid;
```

Backfill the new column:

```sql
UPDATE "children" c
SET "parentProfileId" = p."id"
FROM "parents" p
WHERE c."parentId" = p."userId"
  AND p."id" IS NOT NULL;
```

### Phase 4: Update Evaluation Entities

#### 4.1 Update evaluation_attempts

Add new column:

```sql
ALTER TABLE "evaluation_attempts" ADD COLUMN "parentProfileId" uuid;
```

Backfill:

```sql
UPDATE "evaluation_attempts" ea
SET "parentProfileId" = p."id"
FROM "parents" p
WHERE ea."parentId" = p."userId"
  AND p."id" IS NOT NULL;
```

#### 4.2 Update evaluation_slot

Add new column:

```sql
ALTER TABLE "evaluation_slot" ADD COLUMN "parentProfileId" uuid;
```

Backfill:

```sql
UPDATE "evaluation_slot" es
SET "parentProfileId" = p."id"
FROM "parents" p
WHERE es."parentId" = p."userId"
  AND p."id" IS NOT NULL;
```

### Phase 5: Create ParentOrganization Links

#### 5.1 From children relationships

```sql
INSERT INTO "parent_organizations" ("id", "parentId", "organizationId", "status", "source", "createdAt", "updatedAt")
SELECT 
  gen_random_uuid(),
  p."id",
  c."organizationId",
  'active',
  'backfill',
  NOW(),
  NOW()
FROM "children" c
INNER JOIN "parents" p ON c."parentId" = p."userId"
WHERE c."organizationId" IS NOT NULL
  AND c."parentProfileId" IS NOT NULL
GROUP BY p."id", c."organizationId"
ON CONFLICT DO NOTHING;
```

### Phase 6: Migrate Foreign Keys

#### 6.1 Update children.parentId FK

```sql
-- Drop old FK
ALTER TABLE "children" 
  DROP CONSTRAINT "FK_<constraint_name>" CASCADE;

-- Create new FK
ALTER TABLE "children"
  ADD CONSTRAINT "FK_children_parentId_parents"
  FOREIGN KEY ("parentProfileId") 
  REFERENCES "parents"("id") 
  ON DELETE CASCADE;

-- Rename column (after verifying all data is migrated)
ALTER TABLE "children" 
  RENAME COLUMN "parentProfileId" TO "parentId";
```

#### 6.2 Update evaluation_attempts.parentId FK

```sql
ALTER TABLE "evaluation_attempts"
  DROP CONSTRAINT "FK_<constraint_name>" CASCADE;

ALTER TABLE "evaluation_attempts"
  ADD CONSTRAINT "FK_evaluation_attempts_parentId_parents"
  FOREIGN KEY ("parentProfileId")
  REFERENCES "parents"("id")
  ON DELETE CASCADE;

ALTER TABLE "evaluation_attempts"
  RENAME COLUMN "parentProfileId" TO "parentId";
```

#### 6.3 Update evaluation_slot.parentId FK

```sql
ALTER TABLE "evaluation_slot"
  DROP CONSTRAINT "FK_<constraint_name>" CASCADE;

ALTER TABLE "evaluation_slot"
  ADD CONSTRAINT "FK_evaluation_slot_parentId_parents"
  FOREIGN KEY ("parentProfileId")
  REFERENCES "parents"("id")
  ON DELETE CASCADE;

ALTER TABLE "evaluation_slot"
  RENAME COLUMN "parentProfileId" TO "parentId";
```

### Phase 7: Verify and Cleanup

#### 7.1 Verify all children have valid parents

```sql
SELECT COUNT(*) as orphaned_children
FROM "children" c
WHERE c."parentId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "parents" p WHERE p."id" = c."parentId"
  );
```

Should return 0.

#### 7.2 Verify all attempts have valid parents

```sql
SELECT COUNT(*) as orphaned_attempts
FROM "evaluation_attempts" ea
WHERE ea."parentId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "parents" p WHERE p."id" = ea."parentId"
  );
```

Should return 0.

#### 7.3 Verify all slots have valid parents

```sql
SELECT COUNT(*) as orphaned_slots
FROM "evaluation_slot" es
WHERE es."parentId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "parents" p WHERE p."id" = es."parentId"
  );
```

Should return 0.

## TypeORM Migration File

If using TypeORM migrations, the migration file should execute the above SQL in order.

File name: `src/migrations/YYYYMMDD-create-parent-profile-tables.ts`

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateParentProfileTables1686000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Phase 1: Create new tables
    // ... [SQL from Phase 1]

    // Phase 2: Backfill ParentProfile
    // ... [SQL from Phase 2]

    // Phase 3-7: Update and migrate
    // ... [SQL from Phases 3-7]
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Rollback: Drop new tables, restore old structure
    await queryRunner.dropForeignKey('children', 'FK_children_parentId_parents');
    await queryRunner.dropForeignKey('evaluation_attempts', 'FK_evaluation_attempts_parentId_parents');
    await queryRunner.dropForeignKey('evaluation_slot', 'FK_evaluation_slot_parentId_parents');
    
    // Rename columns back
    // Drop parent_organizations and parents tables
    // Restore old FKs
  }
}
```

## DB_SYNCHRONIZE Approach

If the project uses `DB_SYNCHRONIZE=true`, follow these steps:

1. Update all entity files (ParentProfile, ParentOrganization, Child, EvaluationAttempt, EvaluationSlot, User)
2. Start application - TypeORM will create new tables and modify existing ones
3. Run backfill SQL manually after startup
4. Verify data integrity

## Data Loss Considerations

- No data is lost during this migration
- All parent relationships are preserved
- All children relationships are preserved
- All evaluation attempt relationships are preserved
- New ParentOrganization links are created for all parent-organization relationships found in children

## Rollback Plan

If rollback is needed:
1. Restore database from backup
2. Revert entity changes in code
3. Redeploy previous version

## Expected Timeline

- Phase 1: < 1 second (create tables)
- Phase 2: ~30 seconds (backfill parents, ~1000 users with PARENT role)
- Phase 3-5: ~1 minute (backfill relationships, ~10000 children and attempts)
- Phase 6: ~1 minute (migrate FKs)
- Phase 7: < 1 second (verify)

**Total: ~3 minutes**

For development/test database: ~10 seconds
For production database: ~5 minutes (depending on data volume)

## Verification Checklist

- [ ] All PARENT users have ParentProfile records
- [ ] All children have valid parent references
- [ ] All evaluation attempts have valid parent references
- [ ] All evaluation slots have valid parent references
- [ ] No orphaned children (children without valid parent)
- [ ] ParentOrganization links created for all parent-org relationships
- [ ] Indexes are present and performant
- [ ] ForeignKey constraints enforced correctly
- [ ] Application can query children by parent
- [ ] Application can query attempts by parent
- [ ] Tests pass

