/**
 * Epic 1 — Story 1.3 (session claim + audit).
 *
 * - `organization.switch` writes a SWITCH_ORGANIZATION audit entry (AR1).
 * - The NextAuth JWT `update` callback re-validates access server-side and only
 *   then mutates the active-org claim + role (FR5, FR9, NFR5).
 */

import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";
import { authConfig } from "@/server/auth/config";
import { randomUUID } from "crypto";
import { UserRole } from "@prisma/client";
import { runWithOrganizationContext } from "@/server/db/middleware/organization-filter";

type TestUser = { id: string; email: string; organizationId: string; role: UserRole };

const createCaller = (user: TestUser) =>
  appRouter.createCaller({
    db,
    session: {
      user: {
        id: user.id,
        email: user.email,
        organizationId: user.organizationId,
        role: user.role,
        name: "T",
        image: null,
        assignedFrameworks: [],
      },
      expires: new Date(Date.now() + 86400000).toISOString(),
    },
    organizationId: user.organizationId,
    headers: new Headers(),
  });

const callJwt = (args: Record<string, unknown>) =>
  (authConfig.callbacks!.jwt as (a: Record<string, unknown>) => Promise<Record<string, unknown>>)(
    args,
  );

describe("Epic 1 — Story 1.3 switch session claim + audit", () => {
  let orgA: { id: string };
  let orgB: { id: string };
  let orgC: { id: string }; // user has no access
  let userBoth: TestUser;

  beforeAll(async () => {
    const stamp = `${Date.now()}-${Math.round(performance.now())}`;
    orgA = await db.organization.create({ data: { id: randomUUID(), name: `SA ${stamp}`, slug: `sa-${stamp}`, updatedAt: new Date() } });
    orgB = await db.organization.create({ data: { id: randomUUID(), name: `SB ${stamp}`, slug: `sb-${stamp}`, updatedAt: new Date() } });
    orgC = await db.organization.create({ data: { id: randomUUID(), name: `SC ${stamp}`, slug: `sc-${stamp}`, updatedAt: new Date() } });

    const u = await db.user.create({
      data: { id: randomUUID(), email: `both-${stamp}@example.com`, name: "both", organizationId: orgA.id, role: UserRole.ADMINISTRATOR, updatedAt: new Date() },
    });
    userBoth = { id: u.id, email: u.email!, organizationId: orgA.id, role: UserRole.ADMINISTRATOR };
    await db.organizationMembership.create({ data: { id: randomUUID(), userId: u.id, organizationId: orgA.id, role: UserRole.ADMINISTRATOR } });
    await db.organizationMembership.create({ data: { id: randomUUID(), userId: u.id, organizationId: orgB.id, role: UserRole.BUSINESS_USER } });
  });

  afterAll(async () => {
    for (const org of [orgA, orgB, orgC]) {
      if (!org) continue;
      await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "OrganizationMembership" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "Organization" WHERE "id" = ${org.id}`;
    }
  });

  it("writes a SWITCH_ORGANIZATION audit entry on a successful switch (AR1)", async () => {
    await createCaller(userBoth).organization.switch({ organizationId: orgB.id });
    // Fire-and-forget audit write
    await new Promise((r) => setTimeout(r, 300));

    const logs = await runWithOrganizationContext(orgB.id, async () => {
      return await db.auditLog.findMany({
        where: { organizationId: orgB.id, userId: userBoth.id, action: "SWITCH_ORGANIZATION" },
      });
    });
    expect(logs.length).toBeGreaterThanOrEqual(1);
  });

  it("JWT update switches the active-org claim + role when access is valid (FR5)", async () => {
    const token = { id: userBoth.id, organizationId: orgA.id, role: UserRole.ADMINISTRATOR };
    const result = await callJwt({ token, trigger: "update", session: { organizationId: orgB.id } });
    expect(result.organizationId).toBe(orgB.id);
    expect(result.role).toBe(UserRole.BUSINESS_USER); // per-membership role in B
  });

  it("JWT update refuses to switch into an org the user cannot access (FR9, NFR5)", async () => {
    const token = { id: userBoth.id, organizationId: orgA.id, role: UserRole.ADMINISTRATOR };
    const result = await callJwt({ token, trigger: "update", session: { organizationId: orgC.id } });
    // Claim unchanged — the forged target is rejected server-side
    expect(result.organizationId).toBe(orgA.id);
    expect(result.role).toBe(UserRole.ADMINISTRATOR);
  });

  it("session callback surfaces isPlatformAdmin for UI gating (Story 3.3)", async () => {
    const session = { user: { name: "x" } } as Record<string, unknown>;
    const token = { id: "x", role: UserRole.BUSINESS_USER, organizationId: "o", isPlatformAdmin: true };
    const sessionCb = authConfig.callbacks!.session as unknown as (
      a: Record<string, unknown>,
    ) => Promise<{ user: { isPlatformAdmin?: boolean } }>;
    const result = await sessionCb({ session, token });
    expect(result.user.isPlatformAdmin).toBe(true);
  });
});
