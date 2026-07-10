/**
 * Manager Role Capability — Regression Guard (Role Consolidation, Epic 1)
 *
 * The consolidated MANAGER role must be able to perform GRC writes across the
 * app. The original 8→4 rename left write-authorization arrays as
 * `[ANALYST, ANALYST, ADMINISTRATOR]` (no MANAGER) — a bug that was invisible
 * because no test exercised a MANAGER performing a write. This test makes that
 * capability explicit on a representative write path (risk comments), and
 * guards the paired invariant that a read-only BUSINESS_USER may NOT write.
 *
 * @see docs/epics-role-consolidation.md
 */

import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";
import { randomUUID } from "crypto";
import { UserRole, CommentType } from "@prisma/client";
import { TRPCError } from "@trpc/server";

type TestUser = {
  id: string;
  email: string;
  role: UserRole;
  organizationId: string;
  name: string;
  assignedFrameworks: string[];
};

let testOrg: { id: string };
let manager: TestUser;
let analyst: TestUser;
let businessUser: TestUser;
let riskId: string;

const createUser = async (
  name: string,
  email: string,
  role: UserRole,
  orgId: string,
): Promise<TestUser> => {
  const user = await db.user.create({
    data: {
      id: randomUUID(),
      name,
      email,
      platformRole: role === UserRole.BUSINESS_USER ? null : role,
      organizationId: orgId,
      updatedAt: new Date(),
    },
  });
  return {
    id: user.id,
    email: user.email!,
    role,
    organizationId: user.organizationId,
    name: user.name!,
    assignedFrameworks: user.assignedFrameworks,
  };
};

const createCaller = (user: TestUser) =>
  appRouter.createCaller({
    db,
    session: {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
        name: user.name,
        image: null,
        assignedFrameworks: user.assignedFrameworks,
      },
      expires: new Date(Date.now() + 86400000).toISOString(),
    },
    organizationId: user.organizationId,
    headers: new Headers(),
  });

beforeAll(async () => {
  const existing = await db.organization.findUnique({
    where: { slug: "test-org-manager-capability" },
  });
  if (existing) {
    await db.$executeRaw`DELETE FROM "RiskComment" WHERE "organizationId" = ${existing.id}`;
    await db.$executeRaw`DELETE FROM "Risk" WHERE "organizationId" = ${existing.id}`;
    await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${existing.id}`;
    await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${existing.id}`;
    await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${existing.id}`;
  }

  testOrg = await db.organization.create({
    data: {
      id: randomUUID(),
      name: "Test Org Manager Capability",
      slug: "test-org-manager-capability",
      updatedAt: new Date(),
    },
  });

  manager = await createUser("Manager", "manager@mgr-cap.test", "MANAGER", testOrg.id);
  analyst = await createUser("Analyst", "analyst@mgr-cap.test", "ANALYST", testOrg.id);
  businessUser = await createUser("Business User", "biz@mgr-cap.test", "BUSINESS_USER", testOrg.id);

  riskId = randomUUID();
  await db.$executeRaw`
    INSERT INTO "Risk" (id, title, description, severity, status, "organizationId", "createdById", "createdAt", "updatedAt")
    VALUES (${riskId}, 'Manager capability risk', 'Risk for manager-capability tests.', 'HIGH', 'OPEN', ${testOrg.id}, ${analyst.id}, NOW(), NOW())
  `;
});

afterAll(async () => {
  if (testOrg) {
    await db.$executeRaw`DELETE FROM "RiskComment" WHERE "organizationId" = ${testOrg.id}`;
    await db.$executeRaw`DELETE FROM "Risk" WHERE "organizationId" = ${testOrg.id}`;
    await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${testOrg.id}`;
    await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${testOrg.id}`;
    await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${testOrg.id}`;
  }
});

describe("Consolidated MANAGER role — write capability", () => {
  it("MANAGER can perform a GRC write (add a risk comment)", async () => {
    const caller = createCaller(manager);
    const result = await caller.risk.addRiskComment({
      riskId,
      comment: "Manager comment — must be allowed (write tier includes MANAGER).",
      commentType: CommentType.GENERAL,
    });
    expect(result).toBeDefined();
  });

  it("ANALYST can perform the same write", async () => {
    const caller = createCaller(analyst);
    const result = await caller.risk.addRiskComment({
      riskId,
      comment: "Analyst comment — allowed (write tier includes ANALYST).",
      commentType: CommentType.GENERAL,
    });
    expect(result).toBeDefined();
  });

  it("read-only BUSINESS_USER is DENIED the write", async () => {
    const caller = createCaller(businessUser);
    await expect(
      caller.risk.addRiskComment({
        riskId,
        comment: "Business user comment — must be forbidden.",
        commentType: CommentType.GENERAL,
      }),
    ).rejects.toThrow(TRPCError);
  });
});
