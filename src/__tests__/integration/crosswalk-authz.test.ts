/**
 * Integration tests for crosswalk authorization + multi-tenant isolation on the
 * Epic 26 procedures (added in the Epic 24-26 holistic review to close the
 * role-split / cross-tenant coverage gap).
 */

import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";
import { randomUUID } from "crypto";
import { UserRole, StandardMappingType, FrameworkMappingType, MappingStatus } from "@prisma/client";
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

async function mkUser(orgId: string, role: UserRole, tag: string): Promise<TestUser> {
  const email = `${tag}-${Date.now()}-${Math.round(performance.now())}@example.com`;
  const u = await db.user.create({
    data: { id: randomUUID(), email, name: tag, organizationId: orgId, role, updatedAt: new Date() },
  });
  return { id: u.id, email, organizationId: orgId, role };
}

describe("crosswalk authorization + isolation - Epic 26 review", () => {
  let org1: { id: string };
  let org2: { id: string };
  let admin1: TestUser;
  let auditor1: TestUser;
  let fw1: string;
  let suggestionId: string; // a SUGGESTED row in org1
  let org2SuggestionId: string; // a SUGGESTED row in org2

  const seedSuggestion = async (orgId: string) => {
    // org control --CONFIRMED--> A-1, crosswalk A-1 --> B-1, then generate.
    return runWithOrganizationContext(orgId, async () => {
      const A = await db.framework.create({ data: { id: randomUUID(), organizationId: orgId, name: "A", code: `A${orgId.slice(0, 6)}`, version: "1", isActive: true, updatedAt: new Date() } });
      const B = await db.framework.create({ data: { id: randomUUID(), organizationId: orgId, name: "B", code: `B${orgId.slice(0, 6)}`, version: "1", isActive: true, updatedAt: new Date() } });
      const a1 = await db.control.create({ data: { id: randomUUID(), organizationId: orgId, frameworkId: A.id, controlId: "A-1", title: "a1", description: "d", updatedAt: new Date() } });
      const b1 = await db.control.create({ data: { id: randomUUID(), organizationId: orgId, frameworkId: B.id, controlId: "B-1", title: "b1", description: "d", updatedAt: new Date() } });
      const oc = await db.organizationalControl.create({ data: { id: randomUUID(), organizationId: orgId, localControlId: "OC-1", name: "oc" } });
      await db.orgControlFrameworkMapping.create({ data: { id: randomUUID(), organizationId: orgId, orgControlId: oc.id, frameworkControlId: a1.id, mappingType: StandardMappingType.EQUIVALENT, status: MappingStatus.CONFIRMED } });
      await db.frameworkControlMapping.create({ data: { id: randomUUID(), organizationId: orgId, sourceControlId: a1.id, targetControlId: b1.id, mappingType: FrameworkMappingType.EQUIVALENT } });
      return { targetFrameworkId: B.id, b1Id: b1.id, ocId: oc.id };
    });
  };

  beforeAll(async () => {
    org1 = await db.organization.create({ data: { id: randomUUID(), name: `Authz1 ${Date.now()}`, slug: `authz1-${Date.now()}`, updatedAt: new Date() } });
    org2 = await db.organization.create({ data: { id: randomUUID(), name: `Authz2 ${Date.now()}`, slug: `authz2-${Date.now()}`, updatedAt: new Date() } });
    admin1 = await mkUser(org1.id, UserRole.ORG_ADMIN, "admin1");
    auditor1 = await mkUser(org1.id, UserRole.AUDITOR, "auditor1");
    const admin2 = await mkUser(org2.id, UserRole.ORG_ADMIN, "admin2");

    const s1 = await seedSuggestion(org1.id);
    fw1 = s1.targetFrameworkId;
    const gen1 = await createCaller(admin1).crosswalk.generateSuggestions({ targetFrameworkId: fw1 });
    expect(gen1.generated).toBe(1);
    const list1 = await createCaller(admin1).crosswalk.listSuggestions({ targetFrameworkId: fw1 });
    suggestionId = list1[0]!.id;

    const s2 = await seedSuggestion(org2.id);
    await createCaller(admin2).crosswalk.generateSuggestions({ targetFrameworkId: s2.targetFrameworkId });
    const list2 = await createCaller(admin2).crosswalk.listSuggestions({ targetFrameworkId: s2.targetFrameworkId });
    org2SuggestionId = list2[0]!.id;
  });

  afterAll(async () => {
    for (const org of [org1, org2]) {
      if (!org) continue;
      await db.$executeRaw`DELETE FROM "OrgControlFrameworkMapping" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "FrameworkControlMapping" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "OrganizationalControl" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "Control" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "Framework" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "Organization" WHERE "id" = ${org.id}`;
    }
  });

  it("denies view-only (AUDITOR) role on every Epic 26 write", async () => {
    const a = createCaller(auditor1);
    await expect(a.crosswalk.generateSuggestions({ targetFrameworkId: fw1 })).rejects.toThrow(/FORBIDDEN|role|permission|access/i);
    await expect(a.crosswalk.confirmSuggestion({ id: suggestionId })).rejects.toThrow(/FORBIDDEN|role|permission|access/i);
    await expect(a.crosswalk.rejectSuggestion({ id: suggestionId })).rejects.toThrow(/FORBIDDEN|role|permission|access/i);
    await expect(a.crosswalk.bulkReviewSuggestions({ ids: [suggestionId], action: "REJECT" })).rejects.toThrow(/FORBIDDEN|role|permission|access/i);
  });

  it("allows view-only (AUDITOR) role on Epic 26 reads + export", async () => {
    const a = createCaller(auditor1);
    await expect(a.crosswalk.listSuggestions({ targetFrameworkId: fw1 })).resolves.toBeDefined();
    await expect(a.crosswalk.getFrameworkCoverage({ targetFrameworkId: fw1 })).resolves.toBeDefined();
    const exp = await a.crosswalk.exportOrgControlCrosswalk({ targetFrameworkId: fw1, format: "csv", scope: "complete" });
    expect(exp.content).toContain("Org Control ID");
  });

  it("bulk CONFIRM actually promotes SUGGESTED → CONFIRMED with reviewer", async () => {
    const res = await createCaller(admin1).crosswalk.bulkReviewSuggestions({ ids: [suggestionId], action: "CONFIRM" });
    expect(res.updated).toBe(1);
    const row = await db.orgControlFrameworkMapping.findUnique({ where: { id: suggestionId }, select: { status: true, reviewedById: true } });
    expect(row?.status).toBe(MappingStatus.CONFIRMED);
    expect(row?.reviewedById).toBe(admin1.id);
  });

  it("cannot touch another org's suggestion (multi-tenant isolation)", async () => {
    const caller = createCaller(admin1);
    // Bulk review silently affects nothing across the tenant boundary.
    const res = await caller.crosswalk.bulkReviewSuggestions({ ids: [org2SuggestionId], action: "REJECT" });
    expect(res.updated).toBe(0);
    // Single confirm/reject reports NOT_FOUND, never mutating the foreign row.
    await expect(caller.crosswalk.confirmSuggestion({ id: org2SuggestionId })).rejects.toThrow(/not found/i);

    const foreign = await db.orgControlFrameworkMapping.findUnique({ where: { id: org2SuggestionId }, select: { status: true } });
    expect(foreign?.status).toBe(MappingStatus.SUGGESTED); // untouched
  });
});
