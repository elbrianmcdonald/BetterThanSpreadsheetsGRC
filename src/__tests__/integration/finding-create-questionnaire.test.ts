/**
 * finding.create — questionnaire-response linkage
 *
 * Covers the vendor path folded in from the deleted
 * finding.createFromQuestionnaireResponse (2026-07-14 unified-finding-create-form):
 * - vendor ids are DERIVED from the response, never trusted from the client
 * - one finding per response
 * - a response in another org is rejected
 * - the guard does not fire for non-vendor creates
 */

import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";
import { randomUUID } from "crypto";
import { UserRole, Severity, FindingSource, QuestionType } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { runWithOrganizationContext } from "@/server/db/middleware/organization-filter";

const SLUG = "test-org-fnd-qr";
const SLUG2 = "test-org-fnd-qr-2";

let orgA: { id: string };
let orgB: { id: string };
let userA: { id: string; email: string; role: UserRole; organizationId: string; name: string; assignedFrameworks: string[] };
let responseA: { id: string };
let responseB: { id: string };
let vendorA: { id: string };
let vendorAssessmentA: { id: string };

/**
 * Build vendor → assessment → questionnaire → response for one org.
 *
 * NOTE (task-1 correction): Vendor, VendorAssessment and QuestionnaireTemplate
 * are org-scoped models that are NOT on the organization-filter middleware's
 * allowlist (src/server/db/middleware/organization-filter.ts) — their `create`
 * calls throw "Organization context required for creating <Model>" unless
 * ambient org context is set, even though `organizationId` is passed explicitly
 * in the data. The brief's version called these directly; wrapping the whole
 * chain in `runWithOrganizationContext` fixes it (harmless for the other calls
 * here, which target allowlisted child tables and don't require context).
 */
async function seedVendorChain(organizationId: string, tag: string) {
  return runWithOrganizationContext(organizationId, async () => {
  const vendor = await db.vendor.create({
    data: {
      id: randomUUID(),
      identifier: `VND-2026-${tag}`,
      organizationId,
      name: `Vendor ${tag}`,
      updatedAt: new Date(),
    },
  });
  const assessment = await db.vendorAssessment.create({
    data: {
      id: randomUUID(),
      identifier: `VA-2026-${tag}`,
      organizationId,
      vendorId: vendor.id,
      title: `Assessment ${tag}`,
      updatedAt: new Date(),
    },
  });
  const template = await db.questionnaireTemplate.create({
    data: {
      id: randomUUID(),
      organizationId,
      name: `Template ${tag}`,
      updatedAt: new Date(),
    },
  });
  const section = await db.questionnaireSection.create({
    data: {
      id: randomUUID(),
      templateId: template.id,
      title: "Section 1",
      updatedAt: new Date(),
    },
  });
  const question = await db.questionnaireQuestion.create({
    data: {
      id: randomUUID(),
      sectionId: section.id,
      questionText: "Do you encrypt data at rest?",
      questionType: QuestionType.YES_NO,
      updatedAt: new Date(),
    },
  });
  const questionnaire = await db.assessmentQuestionnaire.create({
    data: {
      id: randomUUID(),
      assessmentId: assessment.id,
      templateId: template.id,
      updatedAt: new Date(),
    },
  });
  const response = await db.questionnaireResponse.create({
    data: {
      id: randomUUID(),
      questionnaireId: questionnaire.id,
      questionId: question.id,
      textResponse: "No",
      updatedAt: new Date(),
    },
  });
  return { vendor, assessment, response };
  });
}

async function purge(slug: string) {
  const org = await db.organization.findUnique({ where: { slug } });
  if (!org) return;
  await db.$executeRaw`DELETE FROM "Finding" WHERE "organizationId" = ${org.id}`;
  await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${org.id}`;
  await db.$executeRaw`DELETE FROM "QuestionnaireResponse" WHERE "questionnaireId" IN (SELECT q.id FROM "AssessmentQuestionnaire" q JOIN "VendorAssessment" va ON va.id = q."assessmentId" WHERE va."organizationId" = ${org.id})`;
  await db.$executeRaw`DELETE FROM "AssessmentQuestionnaire" WHERE "assessmentId" IN (SELECT id FROM "VendorAssessment" WHERE "organizationId" = ${org.id})`;
  await db.$executeRaw`DELETE FROM "QuestionnaireQuestion" WHERE "sectionId" IN (SELECT s.id FROM "QuestionnaireSection" s JOIN "QuestionnaireTemplate" t ON t.id = s."templateId" WHERE t."organizationId" = ${org.id})`;
  await db.$executeRaw`DELETE FROM "QuestionnaireSection" WHERE "templateId" IN (SELECT id FROM "QuestionnaireTemplate" WHERE "organizationId" = ${org.id})`;
  await db.$executeRaw`DELETE FROM "QuestionnaireTemplate" WHERE "organizationId" = ${org.id}`;
  await db.$executeRaw`DELETE FROM "VendorAssessment" WHERE "organizationId" = ${org.id}`;
  await db.$executeRaw`DELETE FROM "Vendor" WHERE "organizationId" = ${org.id}`;
  await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${org.id}`;
  await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${org.id}`;
}

beforeAll(async () => {
  await purge(SLUG);
  await purge(SLUG2);

  orgA = await db.organization.create({
    data: { id: randomUUID(), name: "Test Org FND QR", slug: SLUG, updatedAt: new Date() },
  });
  orgB = await db.organization.create({
    data: { id: randomUUID(), name: "Test Org FND QR 2", slug: SLUG2, updatedAt: new Date() },
  });

  // NOTE (task-1 correction): the brief's payload had `role: UserRole.SECURITY_ENGINEER`
  // directly on `db.user.create`. Neither is valid against the current schema:
  // - User has no `role` column (Role Consolidation Epic 2) — only `platformRole`,
  //   which staff roles use; the four-role UserRole enum is
  //   ADMINISTRATOR | MANAGER | ANALYST | BUSINESS_USER.
  // - SECURITY_ENGINEER was a legacy 8-role value; it maps to ANALYST under
  //   LEGACY_ROLE_MAP (src/lib/auth/roles.ts) and ANALYST is in WRITE_ROLES,
  //   which finding.create requires.
  // `role` is kept on the in-memory `userA` object (not persisted) purely to
  // build the mock session below, mirroring the pattern in finding-creation.test.ts.
  const createdUserA = await db.user.create({
    data: {
      id: randomUUID(),
      email: `sec-${randomUUID()}@example.com`,
      name: "Sec Engineer",
      platformRole: UserRole.ANALYST,
      organizationId: orgA.id,
      assignedFrameworks: [],
      updatedAt: new Date(),
    },
  });
  userA = {
    id: createdUserA.id,
    email: createdUserA.email!,
    role: UserRole.ANALYST,
    organizationId: createdUserA.organizationId,
    name: createdUserA.name!,
    assignedFrameworks: createdUserA.assignedFrameworks,
  };

  const chainA = await seedVendorChain(orgA.id, "AAAA");
  vendorA = chainA.vendor;
  vendorAssessmentA = chainA.assessment;
  responseA = chainA.response;

  const chainB = await seedVendorChain(orgB.id, "BBBB");
  responseB = chainB.response;
});

afterAll(async () => {
  await purge(SLUG);
  await purge(SLUG2);
  await db.$disconnect();
});

/** Caller in orgA with create rights. */
function callerA() {
  return appRouter.createCaller({
    db,
    session: { user: { id: userA.id, role: userA.role, organizationId: orgA.id }, expires: "" },
    organizationId: orgA.id,
    headers: new Headers(),
  } as never);
}

const basePayload = {
  title: "Vendor does not encrypt data at rest",
  description: "The vendor confirmed in the questionnaire that data at rest is not encrypted.",
  source: FindingSource.MANUAL,
  severity: Severity.HIGH,
};

describe("finding.create with questionnaireResponseId", () => {
  it("derives vendor and vendor-assessment ids from the response", async () => {
    const finding = await runWithOrganizationContext(orgA.id, () =>
      callerA().finding.create({
        ...basePayload,
        questionnaireResponseId: responseA.id,
      }),
    );

    const row = await db.finding.findUnique({
      where: { id: finding.id },
      select: { vendorId: true, vendorAssessmentId: true, questionnaireResponseId: true },
    });

    expect(row).toEqual({
      vendorId: vendorA.id,
      vendorAssessmentId: vendorAssessmentA.id,
      questionnaireResponseId: responseA.id,
    });
  });

  it("rejects a second finding for the same response", async () => {
    await expect(
      runWithOrganizationContext(orgA.id, () =>
        callerA().finding.create({
          ...basePayload,
          title: "A second finding for the same response",
          questionnaireResponseId: responseA.id,
        }),
      ),
    ).rejects.toThrow(/already been created for this response/i);
  });

  it("rejects a response belonging to another organization", async () => {
    await expect(
      runWithOrganizationContext(orgA.id, () =>
        callerA().finding.create({
          ...basePayload,
          title: "Cross-org questionnaire response finding",
          questionnaireResponseId: responseB.id,
        }),
      ),
    ).rejects.toThrow(TRPCError);
  });

  it("does not apply the one-per-response guard to non-vendor creates", async () => {
    const first = await runWithOrganizationContext(orgA.id, () =>
      callerA().finding.create({ ...basePayload, title: "Plain finding number one" }),
    );
    const second = await runWithOrganizationContext(orgA.id, () =>
      callerA().finding.create({ ...basePayload, title: "Plain finding number two" }),
    );

    expect(first.id).not.toEqual(second.id);
    const rows = await db.finding.findMany({
      where: { id: { in: [first.id, second.id] } },
      select: { questionnaireResponseId: true, vendorId: true },
    });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.questionnaireResponseId === null && r.vendorId === null)).toBe(true);
  });
});
