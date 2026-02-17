# RBAC UI Components Documentation

**Story 1.8: Role-Based UI Component Rendering**

This document explains how to use the role-based access control (RBAC) UI components and hooks for client-side permission checking and conditional rendering.

## Table of Contents

1. [Overview](#overview)
2. [Permission Hooks](#permission-hooks)
3. [ProtectedElement Component](#protectedelement-component)
4. [Usage Examples](#usage-examples)
5. [Best Practices](#best-practices)
6. [Testing](#testing)

---

## Overview

The RBAC UI system provides three main tools for implementing role-based UI rendering:

- **`usePermission`** - Hook for checking specific permissions
- **`useHasRole`** - Hook for checking user roles
- **`ProtectedElement`** - Component for conditional rendering based on permissions/roles

These tools integrate with NextAuth session management and the centralized permission system from Story 1.7.

---

## Permission Hooks

### usePermission Hook

Check if the current user has a specific permission.

```typescript
import { usePermission } from "@/hooks/usePermission";
import { Permission } from "@/server/auth/permissions";

function MyComponent() {
  const canCreateUser = usePermission(Permission.USER_CREATE);
  const canDeleteEvidence = usePermission(Permission.EVIDENCE_DELETE);

  return (
    <div>
      {canCreateUser && <button>Create User</button>}
      {canDeleteEvidence && <button>Delete Evidence</button>}
    </div>
  );
}
```

**Returns:** `boolean` - `true` if user has the permission, `false` otherwise

**Behavior:**
- Returns `false` if user is not authenticated
- Returns `false` if session is loading
- Uses centralized `hasPermission()` function from `@/server/auth/permissions`

---

### useHasRole Hook

Check if the current user has one or more specific roles.

```typescript
import { useHasRole } from "@/hooks/useHasRole";
import { UserRole } from "@prisma/client";

function MyComponent() {
  // Single role check
  const isAdmin = useHasRole(UserRole.ORG_ADMIN);

  // Multiple roles check (OR logic)
  const canManageRisks = useHasRole([
    UserRole.ORG_ADMIN,
    UserRole.GRC_ANALYST,
    UserRole.SECURITY_ENGINEER
  ]);

  return (
    <div>
      {isAdmin && <AdminPanel />}
      {canManageRisks && <RiskManagement />}
    </div>
  );
}
```

**Parameters:**
- `allowedRoles`: `UserRole | UserRole[]` - Single role or array of roles

**Returns:** `boolean` - `true` if user has one of the allowed roles

**Behavior:**
- Returns `false` if user is not authenticated
- Returns `false` if session is loading
- For arrays, returns `true` if user has ANY of the specified roles (OR logic)

---

## ProtectedElement Component

Declarative component for conditional rendering based on permissions or roles.

### Basic Props

```typescript
interface ProtectedElementProps {
  children: ReactNode;
  permission?: Permission;        // Check specific permission
  role?: UserRole;                 // Check single role
  roles?: UserRole[];              // Check multiple roles (OR)
  fallback?: ReactNode;            // Show when unauthorized
  requireBoth?: boolean;           // Require BOTH permission AND role
}
```

### Permission-Based Rendering

```typescript
import { ProtectedElement } from "@/components/rbac";
import { Permission } from "@/server/auth/permissions";

<ProtectedElement permission={Permission.USER_CREATE}>
  <button>Create User</button>
</ProtectedElement>
```

### Role-Based Rendering

```typescript
import { UserRole } from "@prisma/client";

// Single role
<ProtectedElement role={UserRole.ORG_ADMIN}>
  <AdminDashboard />
</ProtectedElement>

// Multiple roles (OR logic)
<ProtectedElement roles={[UserRole.ORG_ADMIN, UserRole.GRC_ANALYST]}>
  <AnalystTools />
</ProtectedElement>
```

### With Fallback

```typescript
<ProtectedElement
  permission={Permission.EVIDENCE_DELETE}
  fallback={<p>You don't have permission to delete evidence</p>}
>
  <button>Delete Evidence</button>
</ProtectedElement>
```

### Combined Checks (AND Logic)

```typescript
// User must have BOTH the permission AND the role
<ProtectedElement
  permission={Permission.USER_CREATE}
  role={UserRole.ORG_ADMIN}
  requireBoth={true}
>
  <AdvancedUserCreation />
</ProtectedElement>
```

### Combined Checks (OR Logic - Default)

```typescript
// User needs EITHER the permission OR the role
<ProtectedElement
  permission={Permission.RISK_CREATE}
  role={UserRole.CISO}
>
  <CreateRiskButton />
</ProtectedElement>
```

---

## Usage Examples

### Example 1: User List with Admin Actions

```typescript
import { ProtectedElement } from "@/components/rbac";
import { UserRole } from "@prisma/client";

export function UserList() {
  return (
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <ProtectedElement role={UserRole.ORG_ADMIN}>
            <th>Actions</th>
          </ProtectedElement>
        </tr>
      </thead>
      <tbody>
        {users.map((user) => (
          <tr key={user.id}>
            <td>{user.name}</td>
            <td>{user.email}</td>
            <ProtectedElement role={UserRole.ORG_ADMIN}>
              <td>
                <button onClick={() => editUser(user.id)}>Edit</button>
                <button onClick={() => deleteUser(user.id)}>Delete</button>
              </td>
            </ProtectedElement>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### Example 2: Navigation Menu

```typescript
import { useHasRole } from "@/hooks/useHasRole";
import { UserRole } from "@prisma/client";

export function Navigation() {
  const isAdmin = useHasRole(UserRole.ORG_ADMIN);
  const canManageEvidence = useHasRole([
    UserRole.ORG_ADMIN,
    UserRole.GRC_ANALYST,
    UserRole.SECURITY_ENGINEER
  ]);

  return (
    <nav>
      <a href="/dashboard">Dashboard</a>
      {canManageEvidence && <a href="/evidence">Evidence</a>}
      {isAdmin && <a href="/admin/users">User Management</a>}
    </nav>
  );
}
```

### Example 3: Form with Conditional Fields

```typescript
import { usePermission } from "@/hooks/usePermission";
import { Permission } from "@/server/auth/permissions";

export function RiskForm() {
  const canAssignOwner = usePermission(Permission.RISK_ASSIGN);
  const canApprove = usePermission(Permission.RISK_APPROVE);

  return (
    <form>
      <input name="title" placeholder="Risk Title" />
      <textarea name="description" placeholder="Description" />

      {canAssignOwner && (
        <select name="owner">
          <option>Select Owner...</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      )}

      {canApprove && (
        <div>
          <label>
            <input type="checkbox" name="approved" />
            Approve this risk
          </label>
        </div>
      )}

      <button type="submit">Save Risk</button>
    </form>
  );
}
```

### Example 4: Nested Protection

```typescript
<ProtectedElement permission={Permission.EVIDENCE_READ}>
  <div>
    <h2>Evidence List</h2>
    <EvidenceList />

    <ProtectedElement permission={Permission.EVIDENCE_CREATE}>
      <button>Create New Evidence</button>
    </ProtectedElement>

    <ProtectedElement permission={Permission.EVIDENCE_DELETE}>
      <button className="danger">Bulk Delete</button>
    </ProtectedElement>
  </div>
</ProtectedElement>
```

---

## Best Practices

### 1. Always Use Server-Side Authorization

UI-level protection is for **user experience only**. Always enforce authorization on the server:

```typescript
// ✅ Good: UI + Server protection
<ProtectedElement permission={Permission.USER_DELETE}>
  <button onClick={deleteUser}>Delete</button>
</ProtectedElement>

// Server (tRPC)
export const userRouter = createTRPCRouter({
  deleteUser: adminProcedure  // ← Server-side check
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Delete user
    }),
});
```

### 2. Use Permissions Over Roles When Possible

```typescript
// ❌ Less flexible
<ProtectedElement role={UserRole.ORG_ADMIN}>
  <button>Create User</button>
</ProtectedElement>

// ✅ More flexible (supports future role changes)
<ProtectedElement permission={Permission.USER_CREATE}>
  <button>Create User</button>
</ProtectedElement>
```

### 3. Provide User Feedback

```typescript
// ✅ Good: User knows why they can't see something
<ProtectedElement
  permission={Permission.EVIDENCE_DELETE}
  fallback={
    <Tooltip content="You need Evidence Delete permission">
      <button disabled>Delete</button>
    </Tooltip>
  }
>
  <button>Delete</button>
</ProtectedElement>
```

### 4. Keep UI Consistent

```typescript
// ✅ Good: Same permission used for button and column
<ProtectedElement permission={Permission.USER_DELETE}>
  <th>Actions</th>
</ProtectedElement>

// ...later in row...
<ProtectedElement permission={Permission.USER_DELETE}>
  <td><button>Delete</button></td>
</ProtectedElement>
```

### 5. Handle Loading States

The hooks automatically return `false` during loading, which is safe but may cause UI flicker:

```typescript
import { useSession } from "next-auth/react";
import { usePermission } from "@/hooks/usePermission";

function MyComponent() {
  const { status } = useSession();
  const canCreate = usePermission(Permission.USER_CREATE);

  if (status === "loading") {
    return <Skeleton />; // Show loading state
  }

  return (
    <>
      {canCreate && <button>Create User</button>}
    </>
  );
}
```

---

## Testing

### Testing Components with ProtectedElement

```typescript
import { render, screen } from "@testing-library/react";
import { usePermission } from "@/hooks/usePermission";
import { MyComponent } from "./MyComponent";

jest.mock("@/hooks/usePermission");

test("shows button when user has permission", () => {
  (usePermission as jest.Mock).mockReturnValue(true);

  render(<MyComponent />);

  expect(screen.getByText("Create User")).toBeInTheDocument();
});

test("hides button when user lacks permission", () => {
  (usePermission as jest.Mock).mockReturnValue(false);

  render(<MyComponent />);

  expect(screen.queryByText("Create User")).not.toBeInTheDocument();
});
```

### Testing with useHasRole

```typescript
import { useHasRole } from "@/hooks/useHasRole";

jest.mock("@/hooks/useHasRole");

test("shows admin panel for admins", () => {
  (useHasRole as jest.Mock).mockReturnValue(true);

  render(<Dashboard />);

  expect(screen.getByText("Admin Panel")).toBeInTheDocument();
});
```

---

## Related Documentation

- [Permission Matrix](../server/auth/permissions.ts) - Full list of available permissions
- [Story 1.7: RBAC Enforcement](../sprint-artifacts/1-7-rbac-enforcement.md) - Server-side RBAC
- [Story 1.4: User Management](../sprint-artifacts/1-4-user-management.md) - User roles and management

---

## Support

For questions or issues with RBAC UI components:

1. Check the component JSDoc comments in the source files
2. Review the unit tests for usage examples
3. See related stories in `docs/sprint-artifacts/`

**Implementation:** Story 1.8 - Role-Based UI Component Rendering
**Last Updated:** December 2024
