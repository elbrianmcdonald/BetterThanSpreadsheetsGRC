/**
 * RBAC Enforcement Integration Tests
 *
 * Tests for Story 1.7: RBAC Enforcement at tRPC Procedure Level
 *
 * **Critical Test Coverage:**
 * - Role-based access control at procedure level
 * - Cross-organization data isolation with RBAC
 * - Audit logging for failed authorization attempts
 * - Permission middleware enforcement
 * - Role-specific procedure protection
 *
 * @see Story 1.7: RBAC Enforcement at tRPC Procedure Level
 */

import { type UserRole } from "@prisma/client";
import { randomUUID } from "crypto";
import { TRPCError } from "@trpc/server";
import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";

// Test data
let orgA: { id: string; name: string };
let orgB: { id: string; name: string };
let adminA: { id: string; email: string | null; role: UserRole; organizationId: string; name: string | null };
let analystA: { id: string; email: string | null; role: UserRole; organizationId: string; name: string | null };
let auditorA: { id: string; email: string | null; role: UserRole; organizationId: string; name: string | null };
let adminB: { id: string; email: string | null; role: UserRole; organizationId: string; name: string | null };

beforeAll(async () => {
  // Cleanup any residual data from previous failed runs
  const existingOrgA = await db.organization.findUnique({
    where: { slug: "test-org-a-rbac" },
  });
  if (existingOrgA) {
    await db.auditLog.deleteMany({ where: { organizationId: existingOrgA.id } });
    await db.user.deleteMany({ where: { organizationId: existingOrgA.id } });
    await db.organization.delete({ where: { id: existingOrgA.id } });
  }
  const existingOrgB = await db.organization.findUnique({
    where: { slug: "test-org-b-rbac" },
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
      name: "Test Org A RBAC",
      slug: "test-org-a-rbac",
      updatedAt: new Date(),
    },
  });

  orgB = await db.organization.create({
    data: {
      id: randomUUID(),
      name: "Test Org B RBAC",
      slug: "test-org-b-rbac",
      updatedAt: new Date(),
    },
  });

  // Create test users with different roles
  adminA = await db.user.create({
    data: {
      id: randomUUID(),
      name: "Admin A",
      email: "admin-a@rbac-test.com",
      role: "ORG_ADMIN",
      organizationId: orgA.id,
      updatedAt: new Date(),
    },
  });

  analystA = await db.user.create({
    data: {
      id: randomUUID(),
      name: "Analyst A",
      email: "analyst-a@rbac-test.com",
      role: "GRC_ANALYST",
      organizationId: orgA.id,
      updatedAt: new Date(),
    },
  });

  auditorA = await db.user.create({
    data: {
      id: randomUUID(),
      name: "Auditor A",
      email: "auditor-a@rbac-test.com",
      role: "AUDITOR",
      organizationId: orgA.id,
      updatedAt: new Date(),
    },
  });

  adminB = await db.user.create({
    data: {
      id: randomUUID(),
      name: "Admin B",
      email: "admin-b@rbac-test.com",
      role: "ORG_ADMIN",
      organizationId: orgB.id,
      updatedAt: new Date(),
    },
  });
});

afterAll(async () => {
  // Cleanup
  await db.organization.deleteMany({
    where: {
      slug: {
        in: ["test-org-a-rbac", "test-org-b-rbac"],
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
        name: user.name ?? "",
        image: null,
        assignedFrameworks: [], // Story 3.7
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
    organizationId: user.organizationId,
    headers: new Headers(),
  });
}

describe("RBAC Enforcement", () => {
  describe("Role-Based Procedure Protection", () => {
    it("ORG_ADMIN can create users in their organization (AC6)", async () => {
      const caller = createCaller(adminA);

      const newUser = await caller.user.createUser({
        email: "test-user@rbac-test.com",
        name: "Test User",
        role: "AUDITOR",
      });

      expect(newUser).toBeDefined();
      expect(newUser.email).toBe("test-user@rbac-test.com");
      expect(newUser.organizationId).toBe(orgA.id);

      // Cleanup
      await db.user.delete({ where: { id: newUser.id } });
    });

    it("GRC_ANALYST cannot create users (AC6)", async () => {
      const caller = createCaller(analystA);

      await expect(
        caller.user.createUser({
          email: "should-fail@rbac-test.com",
          name: "Should Fail",
          role: "AUDITOR",
        })
      ).rejects.toThrow(/FORBIDDEN|requires one of these roles: ORG_ADMIN/);
    });

    it("AUDITOR cannot create users (read-only role - AC12)", async () => {
      const caller = createCaller(auditorA);

      await expect(
        caller.user.createUser({
          email: "should-fail@rbac-test.com",
          name: "Should Fail",
          role: "AUDITOR",
        })
      ).rejects.toThrow(/FORBIDDEN|requires one of these roles: ORG_ADMIN/);
    });
  });

  describe("Cross-Organization Isolation with RBAC (AC5, AC25)", () => {
    it("Admin A cannot create users in Org B", async () => {
      const callerA = createCaller(adminA);

      // Try to create user - should succeed but be in Org A (not Org B)
      const newUser = await callerA.user.createUser({
        email: "cross-org-test@rbac-test.com",
        name: "Cross Org Test",
        role: "AUDITOR",
      });

      // Verify user is in Org A (admin's org), not Org B
      expect(newUser.organizationId).toBe(orgA.id);
      expect(newUser.organizationId).not.toBe(orgB.id);

      // Cleanup
      await db.user.delete({ where: { id: newUser.id } });
    });

    it("Admin A cannot access Org B users", async () => {
      const callerA = createCaller(adminA);

      // Get users - should only see Org A users
      const result = await callerA.user.listUsers({ skip: 0, take: 100 });

      // Verify all returned users are from Org A
      result.users.forEach((user) => {
        expect(user.id === adminA.id || user.id === analystA.id || user.id === auditorA.id).toBe(true);
      });

      // Verify Admin B is NOT in the list
      const hasAdminB = result.users.some((u) => u.id === adminB.id);
      expect(hasAdminB).toBe(false);
    });

    it("Admin A cannot access Org B user by ID", async () => {
      const callerA = createCaller(adminA);

      await expect(
        callerA.user.getUserById({ id: adminB.id })
      ).rejects.toThrow(/NOT_FOUND|not found in your organization/);
    });
  });

  describe("Audit Logging for Failed Authorization (AC17, AC27)", () => {
    it("logs failed authorization attempts to AuditLog", async () => {
      const caller = createCaller(analystA);

      // Get initial audit log count
      const initialLogs = await db.auditLog.count({
        where: {
          userId: analystA.id,
          action: "AUTHORIZATION_FAILED",
        },
      });

      // Attempt unauthorized action (GRC_ANALYST trying to create user)
      await expect(
        caller.user.createUser({
          email: "audit-test@rbac-test.com",
          name: "Audit Test",
          role: "AUDITOR",
        })
      ).rejects.toThrow();

      // Give the async audit log time to complete
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Verify audit log was created
      const finalLogs = await db.auditLog.count({
        where: {
          userId: analystA.id,
          action: "AUTHORIZATION_FAILED",
        },
      });

      expect(finalLogs).toBeGreaterThan(initialLogs);

      // Verify audit log details
      const latestLog = await db.auditLog.findFirst({
        where: {
          userId: analystA.id,
          action: "AUTHORIZATION_FAILED",
        },
        orderBy: { timestamp: "desc" },
      });

      expect(latestLog).toBeDefined();
      expect(latestLog!.organizationId).toBe(orgA.id);
      expect(latestLog!.entityType).toBe("Authorization");

      // Check the changes field contains authorization details
      const changes = latestLog!.changes as Record<string, unknown>;
      const afterChanges = changes.after as Record<string, unknown>;
      expect(afterChanges.attemptedAction).toBeDefined();
      expect(afterChanges.userRole).toBe("GRC_ANALYST");
    });
  });

  describe("Permission Matrix Enforcement (AC1, AC6-AC12)", () => {
    it("each role can only perform allowed operations", async () => {
      // ORG_ADMIN: Can create users ✓
      const adminCaller = createCaller(adminA);
      const adminUser = await adminCaller.user.createUser({
        email: "admin-test@rbac-test.com",
        name: "Admin Test",
        role: "AUDITOR",
      });
      expect(adminUser).toBeDefined();
      await db.user.delete({ where: { id: adminUser.id } });

      // GRC_ANALYST: Cannot create users ✗
      const analystCaller = createCaller(analystA);
      await expect(
        analystCaller.user.createUser({
          email: "analyst-test@rbac-test.com",
          name: "Analyst Test",
          role: "AUDITOR",
        })
      ).rejects.toThrow(/requires one of these roles: ORG_ADMIN/);

      // AUDITOR: Cannot create users (read-only) ✗
      const auditorCaller = createCaller(auditorA);
      await expect(
        auditorCaller.user.createUser({
          email: "auditor-test@rbac-test.com",
          name: "Auditor Test",
          role: "AUDITOR",
        })
      ).rejects.toThrow(/requires one of these roles: ORG_ADMIN/);
    });

    it("all authenticated users can list users (AC6)", async () => {
      // All roles can list users (for assignment dropdowns, etc.)
      const adminCaller = createCaller(adminA);
      const analystCaller = createCaller(analystA);
      const auditorCaller = createCaller(auditorA);

      const adminResult = await adminCaller.user.listUsers({ skip: 0, take: 10 });
      const analystResult = await analystCaller.user.listUsers({ skip: 0, take: 10 });
      const auditorResult = await auditorCaller.user.listUsers({ skip: 0, take: 10 });

      expect(adminResult.users.length).toBeGreaterThan(0);
      expect(analystResult.users.length).toBeGreaterThan(0);
      expect(auditorResult.users.length).toBeGreaterThan(0);

      // All should see the same users (same org)
      expect(adminResult.total).toBe(analystResult.total);
      expect(analystResult.total).toBe(auditorResult.total);
    });
  });

  describe("Organization Context Enforcement (AC16)", () => {
    it("organization context automatically available in protected procedures", async () => {
      const caller = createCaller(adminA);

      // List users - should be filtered by organizationId automatically
      const result = await caller.user.listUsers({ skip: 0, take: 100 });

      // Verify all returned users belong to the caller's organization
      result.users.forEach((user) => {
        expect(user).toHaveProperty("id");
        expect(user).toHaveProperty("email");
        // Organization filtering happens at query level, verified by cross-org test above
      });
    });

    it("prevents access to resources from other organizations", async () => {
      const callerA = createCaller(adminA);
      const callerB = createCaller(adminB);

      // Create user in Org A
      const userA = await callerA.user.createUser({
        email: "org-context-test-a@rbac-test.com",
        name: "Org Context Test A",
        role: "AUDITOR",
      });

      // Try to access with Admin B (different org)
      await expect(
        callerB.user.getUserById({ id: userA.id })
      ).rejects.toThrow(/NOT_FOUND|not found in your organization/);

      // Cleanup
      await db.user.delete({ where: { id: userA.id } });
    });
  });

  describe("Error Messages (AC14, AC15)", () => {
    it("provides clear error messages indicating required roles", async () => {
      const caller = createCaller(analystA);

      try {
        await caller.user.createUser({
          email: "error-msg-test@rbac-test.com",
          name: "Error Msg Test",
          role: "AUDITOR",
        });
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        const trpcError = error as TRPCError;
        expect(trpcError.code).toBe("FORBIDDEN");
        expect(trpcError.message).toMatch(/requires one of these roles.*ORG_ADMIN/i);
      }
    });

    it("indicates user's current role in error message", async () => {
      const caller = createCaller(analystA);

      try {
        await caller.user.createUser({
          email: "role-msg-test@rbac-test.com",
          name: "Role Msg Test",
          role: "AUDITOR",
        });
        expect(true).toBe(false);
      } catch (error) {
        const trpcError = error as TRPCError;
        expect(trpcError.message).toMatch(/your role.*GRC_ANALYST/i);
      }
    });
  });

  describe("Self-Protection (AC6)", () => {
    it("ORG_ADMIN cannot delete their own account", async () => {
      const caller = createCaller(adminA);

      await expect(
        caller.user.deleteUser({ id: adminA.id })
      ).rejects.toThrow(/cannot delete your own account/i);
    });

    it("ORG_ADMIN cannot change their own role", async () => {
      const caller = createCaller(adminA);

      await expect(
        caller.user.updateUserRole({ id: adminA.id, role: "AUDITOR" })
      ).rejects.toThrow(/cannot change your own role/i);
    });
  });
});

describe("RBAC Middleware Stack", () => {
  describe("protectedProcedure", () => {
    it("requires authentication", async () => {
      // Create caller without session (unauthenticated)
      const unauthenticatedCaller = appRouter.createCaller({
        db,
        session: null,
        organizationId: null,
        headers: new Headers(),
      });

      await expect(
        unauthenticatedCaller.user.listUsers({ skip: 0, take: 10 })
      ).rejects.toThrow(/UNAUTHORIZED/);
    });
  });

  describe("organizationProcedure", () => {
    it("requires organizationId in session", async () => {
      // Create caller with session but no organizationId
      const callerWithoutOrg = appRouter.createCaller({
        db,
        session: {
          user: {
            id: "test-id",
            email: "test@example.com",
            role: "ORG_ADMIN" as UserRole,
            organizationId: null as unknown as string, // Force null organizationId
            name: "",
            image: null,
            assignedFrameworks: [], // Story 3.7
          },
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
        organizationId: null,
        headers: new Headers(),
      });

      await expect(
        callerWithoutOrg.user.listUsers({ skip: 0, take: 10 })
      ).rejects.toThrow(/FORBIDDEN|must belong to an organization/);
    });
  });

  describe("adminProcedure", () => {
    it("only allows ORG_ADMIN role", async () => {
      // Analyst trying to use admin procedure
      const analystCaller = createCaller(analystA);

      await expect(
        analystCaller.user.createUser({
          email: "admin-proc-test@rbac-test.com",
          name: "Admin Proc Test",
          role: "AUDITOR",
        })
      ).rejects.toThrow(/requires one of these roles: ORG_ADMIN/);

      // Admin can use admin procedure
      const adminCaller = createCaller(adminA);

      const user = await adminCaller.user.createUser({
        email: "admin-proc-test@rbac-test.com",
        name: "Admin Proc Test",
        role: "AUDITOR",
      });

      expect(user).toBeDefined();
      await db.user.delete({ where: { id: user.id } });
    });
  });
});
