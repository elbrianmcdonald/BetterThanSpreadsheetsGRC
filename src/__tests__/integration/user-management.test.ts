/**
 * User Management Integration Tests
 *
 * Tests for Story 1.4: User Account Creation and Role Assignment
 *
 * Coverage:
 * - AC15: Cross-organization isolation
 * - AC16: Role-based access control
 * - AC17: CRUD operations
 * - AC9: Audit logging
 * - Email uniqueness within organization
 */

import { type UserRole } from "@prisma/client";
import { randomUUID } from "crypto";
import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";

// Test data setup
let orgA: { id: string; name: string };
let orgB: { id: string; name: string };
let adminA: { id: string; email: string | null; role: UserRole; organizationId: string };
let analystA: { id: string; email: string | null; role: UserRole; organizationId: string };
let adminB: { id: string; email: string | null; role: UserRole; organizationId: string };

beforeAll(async () => {
  // Cleanup any residual data from previous failed runs
  const existingOrgA = await db.organization.findUnique({
    where: { slug: "test-org-a-user-mgmt" },
  });
  if (existingOrgA) {
    await db.auditLog.deleteMany({ where: { organizationId: existingOrgA.id } });
    await db.user.deleteMany({ where: { organizationId: existingOrgA.id } });
    await db.organization.delete({ where: { id: existingOrgA.id } });
  }
  const existingOrgB = await db.organization.findUnique({
    where: { slug: "test-org-b-user-mgmt" },
  });
  if (existingOrgB) {
    await db.auditLog.deleteMany({ where: { organizationId: existingOrgB.id } });
    await db.user.deleteMany({ where: { organizationId: existingOrgB.id } });
    await db.organization.delete({ where: { id: existingOrgB.id } });
  }

  // Create test organizations
  orgA = await db.organization.create({
    data: {
      id: randomUUID(),
      name: "Test Org A",
      slug: "test-org-a-user-mgmt",
      updatedAt: new Date(),
    },
  });

  orgB = await db.organization.create({
    data: {
      id: randomUUID(),
      name: "Test Org B",
      slug: "test-org-b-user-mgmt",
      updatedAt: new Date(),
    },
  });

  // Create test users
  adminA = await db.user.create({
    data: {
      id: randomUUID(),
      name: "Admin A",
      email: "admin-a@test-user-mgmt.com",
      role: "ADMINISTRATOR",
      organizationId: orgA.id,
      updatedAt: new Date(),
    },
  });

  analystA = await db.user.create({
    data: {
      id: randomUUID(),
      name: "Analyst A",
      email: "analyst-a@test-user-mgmt.com",
      role: "ANALYST",
      organizationId: orgA.id,
      updatedAt: new Date(),
    },
  });

  adminB = await db.user.create({
    data: {
      id: randomUUID(),
      name: "Admin B",
      email: "admin-b@test-user-mgmt.com",
      role: "ADMINISTRATOR",
      organizationId: orgB.id,
      updatedAt: new Date(),
    },
  });
});

afterAll(async () => {
  // Cleanup - organizations will cascade delete users
  await db.organization.deleteMany({
    where: {
      slug: {
        in: ["test-org-a-user-mgmt", "test-org-b-user-mgmt"],
      },
    },
  });
});

/**
 * Helper to create tRPC caller with specific user context
 */
function createCaller(user: typeof adminA) {
  return appRouter.createCaller({
    db,
    session: {
      user: {
        id: user.id,
        email: user.email ?? "",
        role: user.role as UserRole,
        organizationId: user.organizationId,
        name: "",
        image: null,
        assignedFrameworks: [], // Story 3.7
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
    organizationId: user.organizationId,
    headers: new Headers(),
  });
}

describe("User Management - CRUD Operations (AC17)", () => {
  it("should allow ORG_ADMIN to create user in their organization (AC1)", async () => {
    const caller = createCaller(adminA);

    const newUser = await caller.user.createUser({
      name: "New User A",
      email: "new-user-a@test.com",
      role: "BUSINESS_USER",
    });

    expect(newUser).toBeDefined();
    expect(newUser.email).toBe("new-user-a@test.com");
    expect(newUser.role).toBe("BUSINESS_USER");
    expect(newUser.organizationId).toBe(orgA.id);
  });

  it("should allow ORG_ADMIN to list users in their organization (AC11)", async () => {
    const caller = createCaller(adminA);

    const result = await caller.user.listUsers({ skip: 0, take: 50 });

    expect(result.users).toBeDefined();
    expect(result.users.length).toBeGreaterThan(0);
    // Should only see users from orgA
    expect(result.users.every((u) => u.id === adminA.id || u.id === analystA.id || u.email?.includes("new-user"))).toBe(true);
  });

  it("should allow ORG_ADMIN to update user in their organization (AC3)", async () => {
    const caller = createCaller(adminA);

    const updatedUser = await caller.user.updateUser({
      id: analystA.id,
      name: "Updated Analyst A",
      role: "ANALYST",
    });

    expect(updatedUser.name).toBe("Updated Analyst A");
    expect(updatedUser.role).toBe("ANALYST");
  });

  it("should allow ORG_ADMIN to delete user in their organization (AC4)", async () => {
    const caller = createCaller(adminA);

    // Create a user to delete
    const userToDelete = await caller.user.createUser({
      name: "To Delete",
      email: "to-delete@test.com",
      role: "BUSINESS_USER",
    });

    const result = await caller.user.deleteUser({ id: userToDelete.id });

    expect(result.success).toBe(true);
    expect(result.deletedUserId).toBe(userToDelete.id);

    // Verify user is deleted
    await expect(
      caller.user.getUserById({ id: userToDelete.id })
    ).rejects.toThrow("User not found");
  });
});

describe("User Management - Cross-Organization Isolation (AC15, AC7)", () => {
  it("should prevent Admin A from seeing users in Org B (AC5)", async () => {
    const caller = createCaller(adminA);

    const result = await caller.user.listUsers({ skip: 0, take: 50 });

    // Should NOT see adminB
    expect(result.users.some((u) => u.id === adminB.id)).toBe(false);
  });

  it("should prevent Admin A from getting user from Org B by ID", async () => {
    const caller = createCaller(adminA);

    await expect(
      caller.user.getUserById({ id: adminB.id })
    ).rejects.toThrow("User not found");
  });

  it("should prevent Admin A from updating user in Org B", async () => {
    const caller = createCaller(adminA);

    await expect(
      caller.user.updateUser({
        id: adminB.id,
        name: "Hacked Name",
      })
    ).rejects.toThrow("User not found");
  });

  it("should prevent Admin A from deleting user in Org B", async () => {
    const caller = createCaller(adminA);

    await expect(
      caller.user.deleteUser({ id: adminB.id })
    ).rejects.toThrow("User not found");
  });
});

describe("User Management - Role-Based Access Control (AC16, AC6)", () => {
  it("should prevent GRC_ANALYST from creating users", async () => {
    const caller = createCaller(analystA);

    await expect(
      caller.user.createUser({
        name: "Unauthorized User",
        email: "unauthorized@test.com",
        role: "BUSINESS_USER",
      })
    ).rejects.toThrow(/requires one of these roles: ADMINISTRATOR/);
  });

  it("should prevent GRC_ANALYST from updating users", async () => {
    const caller = createCaller(analystA);

    await expect(
      caller.user.updateUser({
        id: adminA.id,
        name: "Hacked Admin Name",
      })
    ).rejects.toThrow(/requires one of these roles: ADMINISTRATOR/);
  });

  it("should prevent GRC_ANALYST from deleting users", async () => {
    const caller = createCaller(analystA);

    await expect(
      caller.user.deleteUser({ id: adminA.id })
    ).rejects.toThrow(/requires one of these roles: ADMINISTRATOR/);
  });

  it("should allow GRC_ANALYST to list users (view-only)", async () => {
    const caller = createCaller(analystA);

    const result = await caller.user.listUsers({ skip: 0, take: 50 });

    expect(result.users).toBeDefined();
    expect(result.users.length).toBeGreaterThan(0);
  });
});

describe("User Management - Security Validations", () => {
  it("should prevent self-delete", async () => {
    const caller = createCaller(adminA);

    await expect(
      caller.user.deleteUser({ id: adminA.id })
    ).rejects.toThrow("Cannot delete your own account");
  });

  it("should enforce email uniqueness within organization", async () => {
    const caller = createCaller(adminA);

    // Create first user with email
    await caller.user.createUser({
      name: "User 1",
      email: "duplicate@test.com",
      role: "BUSINESS_USER",
    });

    // Try to create second user with same email - should fail
    await expect(
      caller.user.createUser({
        name: "User 2",
        email: "duplicate@test.com",
        role: "BUSINESS_USER",
      })
    ).rejects.toThrow("A user with this email already exists");
  });

  it("should enforce globally unique email across all organizations", async () => {
    const callerA = createCaller(adminA);
    const callerB = createCaller(adminB);

    // Create user in Org A
    await callerA.user.createUser({
      name: "User in A",
      email: "global-unique-email@test.com",
      role: "BUSINESS_USER",
    });

    // Should NOT be able to create user with same email in Org B (global uniqueness)
    await expect(
      callerB.user.createUser({
        name: "User in B",
        email: "global-unique-email@test.com",
        role: "BUSINESS_USER",
      })
    ).rejects.toThrow();
  });
});

describe("User Management - Audit Logging (AC9)", () => {
  it("should create audit log when user is created", async () => {
    const caller = createCaller(adminA);

    const newUser = await caller.user.createUser({
      name: "Audit Test User",
      email: "audit-test@test.com",
      role: "BUSINESS_USER",
    });

    // Check audit log
    const auditLog = await db.auditLog.findFirst({
      where: {
        action: "CREATE_USER",
        entityId: newUser.id,
        organizationId: orgA.id,
      },
    });

    expect(auditLog).toBeDefined();
    expect(auditLog?.userId).toBe(adminA.id);
    expect(auditLog?.entityType).toBe("User");
  });

  it("should create audit log when user is updated", async () => {
    const caller = createCaller(adminA);

    await caller.user.updateUser({
      id: analystA.id,
      name: "Audit Update Test",
    });

    // Check audit log
    const auditLog = await db.auditLog.findFirst({
      where: {
        action: "UPDATE_USER",
        entityId: analystA.id,
        organizationId: orgA.id,
      },
      orderBy: { timestamp: "desc" },
    });

    expect(auditLog).toBeDefined();
    expect(auditLog?.userId).toBe(adminA.id);
  });

  it("should create audit log when user is deleted", async () => {
    const caller = createCaller(adminA);

    // Create user to delete
    const userToDelete = await caller.user.createUser({
      name: "Audit Delete Test",
      email: "audit-delete@test.com",
      role: "BUSINESS_USER",
    });

    await caller.user.deleteUser({ id: userToDelete.id });

    // Check audit log
    const auditLog = await db.auditLog.findFirst({
      where: {
        action: "DELETE_USER",
        entityId: userToDelete.id,
        organizationId: orgA.id,
      },
    });

    expect(auditLog).toBeDefined();
    expect(auditLog?.userId).toBe(adminA.id);
  });
});

describe("User Management - Role Assignment (AC2, AC18)", () => {
  // Consolidated four-role model — one entry per distinct role so the
  // per-role email (`${role}@test.com`) stays unique across cases.
  const allRoles: UserRole[] = [
    "ADMINISTRATOR",
    "MANAGER",
    "ANALYST",
    "BUSINESS_USER",
  ];

  it.each(allRoles)("should allow creating user with role: %s", async (role) => {
    const caller = createCaller(adminA);

    const user = await caller.user.createUser({
      name: `User with ${role}`,
      email: `${role.toLowerCase()}@test.com`,
      role,
    });

    expect(user.role).toBe(role);
  });

  it("should update user role with specialized updateUserRole procedure", async () => {
    const caller = createCaller(adminA);

    // Create user with AUDITOR role
    const user = await caller.user.createUser({
      name: "Role Change Test",
      email: "role-change@test.com",
      role: "BUSINESS_USER",
    });

    // Update to CISO role
    const updated = await caller.user.updateUserRole({
      id: user.id,
      role: "MANAGER",
    });

    expect(updated.role).toBe("MANAGER");

    // Check audit log for role change
    const auditLog = await db.auditLog.findFirst({
      where: {
        action: "UPDATE_USER_ROLE",
        entityId: user.id,
      },
    });

    expect(auditLog).toBeDefined();
  });

  it("should prevent admin from changing their own role", async () => {
    const caller = createCaller(adminA);

    await expect(
      caller.user.updateUserRole({
        id: adminA.id,
        role: "BUSINESS_USER",
      })
    ).rejects.toThrow("Cannot change your own role");
  });
});
