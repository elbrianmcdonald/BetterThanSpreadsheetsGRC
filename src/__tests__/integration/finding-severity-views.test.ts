/**
 * Finding Severity Views Integration Tests
 *
 * Story 20.3: See Matrix Severity Across Finding Views
 *
 * AC1: The register can filter findings by matrix severityLabel and sort by
 *      inherentScore (nulls last); distinct labels are queryable for the
 *      filter dropdown.
 */

import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";
import { randomUUID } from "crypto";
import { type UserRole, Severity, FindingSource } from "@prisma/client";
import { runWithOrganizationContext } from "@/server/db/middleware/organization-filter";

let testOrg: { id: string };
let analyst: { id: string; email: string; role: UserRole; organizationId: string; name: string; assignedFrameworks: string[] };

const createCaller = (user: typeof analyst) =>
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

async function seedFinding(title: string, label: string | null, score: number | null) {
  await runWithOrganizationContext(testOrg.id, async () => {
    await db.finding.create({
      data: {
        id: randomUUID(),
        organizationId: testOrg.id,
        identifier: `FND-SV-${randomUUID().slice(0, 8)}`,
        title,
        description: "Severity-views fixture finding for register filter/sort tests.",
        source: FindingSource.AUDIT,
        severity: Severity.MEDIUM,
        severityLabel: label,
        inherentScore: score,
        status: "NEW",
        createdBy: analyst.id,
        updatedAt: new Date(),
      },
    });
  });
}

beforeAll(async () => {
  const stamp = Date.now();
  testOrg = await db.organization.create({
    data: { id: randomUUID(), name: `SevViews Org ${stamp}`, slug: `sevviews-org-${stamp}`, updatedAt: new Date() },
  });
  const u = await db.user.create({
    data: {
      id: randomUUID(),
      name: "SevViews Analyst",
      email: `sevviews-analyst-${stamp}@example.com`,
      platformRole: "ANALYST",
      organizationId: testOrg.id,
      updatedAt: new Date(),
    },
  });
  analyst = {
    id: u.id,
    email: u.email!,
    role: "ANALYST",
    organizationId: u.organizationId,
    name: u.name!,
    assignedFrameworks: u.assignedFrameworks,
  };

  await seedFinding("Critical scored finding", "Critical", 25);
  await seedFinding("Medium scored finding", "Medium", 9);
  await seedFinding("Low scored finding", "Low", 2);
  await seedFinding("Legacy unscored finding", null, null);
});

afterAll(async () => {
  await db.$executeRaw`DELETE FROM "Finding" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${testOrg.id}`;
});

describe("Story 20.3: Matrix severity across finding views", () => {
  it("AC1: list filters by severityLabel", async () => {
    const caller = createCaller(analyst);

    const result = await caller.finding.list({ severityLabel: ["Critical", "Low"] });

    expect(result.items).toHaveLength(2);
    const labels = result.items.map((f) => f.severityLabel).sort();
    expect(labels).toEqual(["Critical", "Low"]);
  });

  it("AC1: list sorts by inherentScore desc with unscored findings last", async () => {
    const caller = createCaller(analyst);

    const result = await caller.finding.list({
      sortBy: "inherentScore",
      sortOrder: "desc",
    });

    const scores = result.items.map((f) =>
      f.inherentScore == null ? null : Number(f.inherentScore)
    );
    expect(scores).toEqual([25, 9, 2, null]);
  });

  it("AC1: listSeverityLabels returns distinct non-null labels for the org", async () => {
    const caller = createCaller(analyst);

    const labels = await caller.finding.listSeverityLabels();

    expect(labels.sort()).toEqual(["Critical", "Low", "Medium"]);
  });
});
