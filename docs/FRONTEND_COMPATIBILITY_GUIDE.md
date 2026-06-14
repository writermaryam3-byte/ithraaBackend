# ParentProfile Migration - Frontend Compatibility Guide

**Version**: 1.0  
**Backend Status**: ✅ Migration Complete & Verified  
**Frontend Status**: ⏳ Migration Required  
**Priority**: High  

---

## 1. Overview of Backend Changes

The backend has completed a major architectural refactoring separating **User** (authentication identity) from **ParentProfile** (parent-specific data and relationships).

### What Changed for Frontend

**BEFORE Migration**:
```javascript
child = {
  id: "child-123",
  name: "Ahmed",
  parentId: "user-456",  // This WAS the User.id
  parent: null           // Not populated
}

// Parent access check:
if (child.parentId === currentUser.id) { /* allowed */ }

// Get parent info:
// Had to fetch User separately
```

**AFTER Migration**:
```javascript
child = {
  id: "child-123",
  name: "Ahmed",
  parentId: "parent-789",  // Now this is ParentProfile.id
  parent: {
    id: "parent-789",
    userId: "user-456",     // This is the User.id
    phone: "+966...",
    email: "parent@...",
    children: [...]
  }
}

// Parent access check:
if (child.parent?.userId === currentUser.id) { /* allowed */ }

// Get parent info: 
// Already in child.parent object
```

---

## 2. Critical Migration Changes

### 🔴 Breaking Change #1: Parent Ownership Check

**Location**: Every component that validates parent-child relationships

**OLD CODE** (❌ No longer works):
```typescript
// OLD - DO NOT USE
if (child.parentId === currentUser.id) {
  // Allow parent to edit child
}
```

**NEW CODE** (✅ Correct):
```typescript
// NEW - USE THIS
if (child.parent?.userId === currentUser.id) {
  // Allow parent to edit child
}
```

**Why**: The `child.parentId` field now contains `ParentProfile.id` (parent profile reference), not `User.id` (user identity). Parent ownership must be checked via `child.parent?.userId`.

**Affected Areas**:
- ✅ Child read/write permission checks
- ✅ Child update operations
- ✅ Child delete operations
- ✅ Private child management
- ✅ Evaluation submission for parent
- ✅ Payment initiation by parent

---

### 🔴 Breaking Change #2: Parent Data Structure

**Location**: Any code that accesses parent information

**OLD CODE**:
```typescript
parent = {
  id: "user-456",
  name: "...",
  email: "parent@...",
  organization: "org-123"  // ❌ No longer exists
}

// Getting parent info:
const parent = await fetch(`/users/${child.parentId}`);
```

**NEW CODE**:
```typescript
parent = child.parent  // ✅ Already included
// or
parent = {
  id: "parent-789",        // ParentProfile.id
  userId: "user-456",      // User.id (for auth checks)
  phone: "+966...",        // Parent phone
  email: "parent@...",     // Parent email
  children: [...]          // Array of children
}

// Getting parent info:
const parent = child.parent; // ✅ Already populated
```

**Why**: Parent information is now part of the child object structure, no need for separate requests.

**Affected Areas**:
- ✅ Child detail display (parent information)
- ✅ Parent profile cards
- ✅ Child ownership verification
- ✅ Parent contact information display

---

### 🔴 Breaking Change #3: Parent-Organization Relationship

**Location**: Organization discovery, parent organization links

**OLD CODE**:
```typescript
// Get parent's organizations
organizations = await fetch(`/users/${parentId}/organizations`);
```

**NEW CODE** (endpoint behavior unchanged, but semantics differ):
```typescript
// GET /organizations/by-parent/:parentProfileId
// Now uses ParentProfile.id, not User.id
organizations = await fetch(`/organizations/by-parent/${child.parentId}`);
```

**Why**: Organization links are now managed via `ParentOrganization` table using `ParentProfile.id` as the key, not `User.id`.

**Affected Areas**:
- ✅ Organization discovery by parent
- ✅ Parent's org assignment flows
- ✅ Org-child relationship verification

---

## 3. API Response Changes

### Response Structure: Child Object

```json
{
  "id": "child-123",
  "name": "Ahmed",
  "age": 8,
  "parentId": "parent-789",
  "parent": {
    "id": "parent-789",
    "userId": "user-456",
    "phone": "+966-5xx-xxx-xxxx",
    "email": "parent@example.com",
    "children": [
      {
        "id": "child-123",
        "name": "Ahmed",
        "organizationId": "org-456"
      }
    ]
  },
  "organizationId": null
}
```

**Key Points**:
- ✅ `parentId` = `ParentProfile.id` (for parent profile reference)
- ✅ `parent.userId` = `User.id` (for auth and user identity)
- ✅ `parent` object always populated when available
- ✅ Parent contact info (phone, email) included for display

---

### Response Structure: Evaluation Object

```json
{
  "id": "eval-123",
  "childId": "child-456",
  "child": {
    "id": "child-456",
    "name": "Sara",
    "parentId": "parent-789"
  },
  "parentId": "parent-789",
  "parent": {
    "id": "parent-789",
    "userId": "user-456",
    "phone": "+966-5xx-xxx-xxxx",
    "email": "parent@example.com"
  },
  "status": "pending"
}
```

**Key Points**:
- ✅ `parentId` = `ParentProfile.id`
- ✅ `parent.userId` = `User.id` (for permission checks)
- ✅ Use `parent.userId` when validating who can access this evaluation

---

## 4. Service-by-Service Migration Guide

### 4.1 Child Management Service

**Methods to Update**:

```typescript
// OLD - DO NOT USE
class ChildService {
  isChildOwnedByParent(child: Child, userId: string): boolean {
    return child.parentId === userId; // ❌ WRONG
  }
}

// NEW - USE THIS
class ChildService {
  isChildOwnedByParent(child: Child, userId: string): boolean {
    return child.parent?.userId === userId; // ✅ CORRECT
  }

  getParentIdForChild(child: Child): string {
    return child.parentId; // ✅ Now returns ParentProfile.id, not User.id
  }

  getParentUserIdForChild(child: Child): string {
    return child.parent?.userId; // ✅ Use this for auth checks
  }
}
```

**Tests to Update**:
```typescript
// Update test fixtures
const mockChild = {
  id: 'child-1',
  name: 'Ahmed',
  parentId: 'parent-profile-1',  // ✅ ParentProfile.id
  parent: {
    id: 'parent-profile-1',
    userId: 'user-1',  // ✅ User.id
    phone: '+966...',
    email: 'parent@...'
  }
};
```

---

### 4.2 Parent Management Service

**Methods to Update**:

```typescript
// OLD - DO NOT USE
class ParentService {
  getParentFromChild(child: Child): ParentInfo {
    return await this.userService.getUser(child.parentId); // ❌ May fail
  }
}

// NEW - USE THIS
class ParentService {
  getParentFromChild(child: Child): ParentInfo {
    return child.parent; // ✅ Use embedded parent data
  }

  getParentUserIdFromChild(child: Child): string {
    return child.parent?.userId; // ✅ For auth operations
  }

  getParentProfileIdFromChild(child: Child): string {
    return child.parentId; // ✅ For profile operations
  }
}
```

---

### 4.3 Authorization & Access Control

**Guard Implementation**:

```typescript
// OLD GUARD - DO NOT USE
@Injectable()
class ParentAccessGuard {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const child = request.child;
    
    // ❌ This comparison is now wrong
    return child.parentId === request.user.id;
  }
}

// NEW GUARD - USE THIS
@Injectable()
class ParentAccessGuard {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const child = request.child;
    
    // ✅ Correct comparison using parent?.userId
    return child.parent?.userId === request.user.id;
  }
}
```

---

### 4.4 Organization Discovery

**Endpoint Usage**:

```typescript
// OLD - Used User.id
const orgs = await fetch(`/organizations/by-parent/${userId}`);

// NEW - Use ParentProfile.id from child.parentId
const orgs = await fetch(`/organizations/by-parent/${child.parentId}`);

// Or from parent object
const orgs = await fetch(`/organizations/by-parent/${child.parent?.id}`);
```

---

## 5. Component Migration Checklist

### Pages & Components Using Parent-Child Relationships

- [ ] **Child Detail Page**
  - [ ] Update parent ownership check: `child.parent?.userId === currentUser.id`
  - [ ] Update parent display: Use `child.parent` for contact info
  - [ ] Update edit/delete permissions
  
- [ ] **Children List Page**
  - [ ] Update parent filter logic
  - [ ] Update child cards to show parent contact
  - [ ] Update "view parent" link

- [ ] **Parent Profile Page**
  - [ ] Update parent ID reference from `User.id` to proper lookup
  - [ ] Update children list to use correct parent reference
  - [ ] Update organization links

- [ ] **Evaluation Management**
  - [ ] Update parent access checks: `attempt.parent?.userId === currentUser.id`
  - [ ] Update parent display in evaluation details
  - [ ] Update submission validation

- [ ] **Payment Flow**
  - [ ] Update payment initiation parent check
  - [ ] Update payment history parent filter
  - [ ] Update payment detail parent info

- [ ] **Organization Management**
  - [ ] Update "assign parent" flow to use ParentProfile.id
  - [ ] Update organization discovery by parent
  - [ ] Update parent-organization links

---

## 6. Code Patterns - Before & After

### Pattern 1: Parent Ownership Validation

**❌ BEFORE** (Old Pattern):
```typescript
export function canEditChild(child, currentUser) {
  return child.parentId === currentUser.id;
}
```

**✅ AFTER** (New Pattern):
```typescript
export function canEditChild(child, currentUser) {
  return child.parent?.userId === currentUser.id;
}
```

---

### Pattern 2: Getting Parent Info

**❌ BEFORE**:
```typescript
export async function getParentInfo(childId, apiClient) {
  const child = await apiClient.getChild(childId);
  const parent = await apiClient.getUser(child.parentId);
  return parent;
}
```

**✅ AFTER**:
```typescript
export async function getParentInfo(childId, apiClient) {
  const child = await apiClient.getChild(childId);
  return child.parent; // Already included
}
```

---

### Pattern 3: Parent-Child Relationship Display

**❌ BEFORE**:
```typescript
function ChildCard({ child, currentUser }) {
  const isOwnedByMe = child.parentId === currentUser.id;
  return (
    <Card>
      <h3>{child.name}</h3>
      {isOwnedByMe && <EditButton />}
    </Card>
  );
}
```

**✅ AFTER**:
```typescript
function ChildCard({ child, currentUser }) {
  const isOwnedByMe = child.parent?.userId === currentUser.id;
  return (
    <Card>
      <h3>{child.name}</h3>
      {child.parent && (
        <ParentInfo>
          {child.parent.name} ({child.parent.email})
        </ParentInfo>
      )}
      {isOwnedByMe && <EditButton />}
    </Card>
  );
}
```

---

### Pattern 4: Organization by Parent Lookup

**❌ BEFORE**:
```typescript
async function getParentOrganizations(userId, apiClient) {
  return apiClient.get(`/organizations/by-parent/${userId}`);
}
```

**✅ AFTER**:
```typescript
async function getParentOrganizations(child, apiClient) {
  return apiClient.get(`/organizations/by-parent/${child.parentId}`);
  // child.parentId is now ParentProfile.id
}
```

---

## 7. Testing Updates

### Unit Tests

```typescript
describe('ParentAccessService', () => {
  // OLD TEST - DO NOT USE
  it('should allow parent to edit child - OLD PATTERN', () => {
    const child = { id: 'child-1', parentId: 'user-1' };
    const actor = { id: 'user-1' };
    
    // ❌ This test is now invalid
    expect(canAccess(child, actor)).toBe(true);
  });

  // NEW TEST - USE THIS
  it('should allow parent to edit child', () => {
    const child = {
      id: 'child-1',
      parentId: 'parent-profile-1',
      parent: {
        id: 'parent-profile-1',
        userId: 'user-1'
      }
    };
    const actor = { id: 'user-1' };
    
    // ✅ Correct test with new structure
    expect(child.parent?.userId === actor.id).toBe(true);
  });
});
```

---

### Integration Tests

```typescript
describe('Child Management Flow', () => {
  it('should create child and retrieve with parent info', async () => {
    // Create child for parent
    const response = await request
      .post('/children')
      .send({ name: 'Ahmed', parentUserId: 'user-1' });
    
    const child = response.body;
    
    // ✅ Verify structure
    expect(child.parentId).toBeDefined(); // ParentProfile.id
    expect(child.parent).toBeDefined();
    expect(child.parent.userId).toBe('user-1');
    expect(child.parent.id).toBe(child.parentId);
  });
});
```

---

## 8. Error Prevention Guide

### ❌ Common Mistakes to Avoid

1. **Mistake**: Using `parentId` for auth checks
   ```typescript
   // ❌ WRONG
   if (child.parentId === userId) { /* auth check */ }
   
   // ✅ CORRECT
   if (child.parent?.userId === userId) { /* auth check */ }
   ```

2. **Mistake**: Not null-checking parent
   ```typescript
   // ❌ WRONG (can crash)
   const name = child.parent.name;
   
   // ✅ CORRECT
   const name = child.parent?.name || 'Unknown';
   ```

3. **Mistake**: Fetching parent separately
   ```typescript
   // ❌ WRONG (unnecessary API call)
   const child = await api.getChild(id);
   const parent = await api.getUser(child.parentId);
   
   // ✅ CORRECT (parent already included)
   const child = await api.getChild(id);
   const parent = child.parent;
   ```

4. **Mistake**: Using wrong ID for org lookup
   ```typescript
   // ❌ WRONG (might be wrong ID type)
   const orgs = await api.getOrganizationsByParent(child.parent.userId);
   
   // ✅ CORRECT (use ParentProfile.id)
   const orgs = await api.getOrganizationsByParent(child.parentId);
   ```

---

## 9. Deployment Checklist

- [ ] Backend deployed and verified (✅ Done)
- [ ] All `child.parentId === userId` comparisons updated to `child.parent?.userId === userId`
- [ ] All parent info fetching updated to use `child.parent`
- [ ] All parent-related tests updated with new fixture structure
- [ ] Organization parent lookup updated to use `child.parentId`
- [ ] All access guards updated for new parent structure
- [ ] Local testing completed with updated API responses
- [ ] Code review completed by team
- [ ] E2E tests passing with new parent structure
- [ ] Frontend deployed alongside backend
- [ ] User communication completed (if applicable)

---

## 10. Support & Questions

### FAQ

**Q: Why did the parentId change?**  
A: To properly separate authentication identity (User) from profile information (ParentProfile). This enables better data organization and security.

**Q: Do I need to update my API requests?**  
A: No, the API endpoints work the same. Only the response structure changed.

**Q: What if parent is null?**  
A: Use optional chaining: `child.parent?.userId` instead of `child.parentId` for auth checks.

**Q: When do I use parentId vs parent.userId?**  
A: Use `parentId` for ParentProfile lookups. Use `parent.userId` for user identity/auth checks.

---

**Migration Status**: ✅ Backend Ready | ⏳ Frontend In Progress  
**Questions**: Contact backend team for clarification on semantics  
**Timeline**: Coordinate deployment with backend team  
