/**
 * Reset risk-domain transactional data and seed sample assessments.
 *
 * Wipes: Risk, RiskAssessment, RiskAssessmentProject, RiskRegisterEntry,
 * RiskScenario, and all dependent rows via CASCADE. Reference data
 * (matrices, templates, enterprise risks) is preserved.
 *
 * Re-seeds 3 sample RiskAssessmentProject containers per organization.
 */

import { PrismaClient, AssessmentProjectStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

const SAMPLE_PROJECTS = [
  {
    subject: "Cloud Migration Risk Assessment",
    description:
      "Identify and evaluate risks associated with migrating production workloads to a public cloud provider.",
  },
  {
    subject: "Vendor Onboarding — Acme SaaS",
    description:
      "Pre-onboarding risk review for the Acme SaaS platform integration, covering data residency, access, and incident response.",
  },
  {
    subject: "Q2 Internal Audit Risk Review",
    description:
      "Quarterly internal audit cycle to surface and re-score top organizational risks across business units.",
  },
];

async function main() {
  console.log("[reset] truncating risk-domain tables (CASCADE)...");

  // Postgres TRUNCATE CASCADE will follow all FK relationships and clear
  // dependent rows (RiskEvidence, RiskStatusHistory, RiskComment,
  // RemediationOption, RiskControlLink, RiskThreatStep, RiskThreatObjective,
  // RiskTreatment, RiskRegisterStatusHistory, RiskScenario, etc.).
  // Note: RiskOrganizationalControl was dropped in Task 10; MITIGATES edges
  // on the graph are retained since they belong to Edge, not Risk cascade.
  await db.$executeRawUnsafe(`
    TRUNCATE TABLE
      "Risk",
      "RiskAssessment",
      "RiskAssessmentProject",
      "RiskRegisterEntry",
      "RiskScenario"
    RESTART IDENTITY CASCADE;
  `);

  console.log("[reset] resetting risk identifier sequences...");
  await db.identifierSequence.deleteMany({
    where: { prefix: { in: ["RISK", "RSK", "RR"] } },
  });

  console.log("[seed] creating sample assessment projects per org...");
  const orgs = await db.organization.findMany({ select: { id: true, name: true } });

  for (const org of orgs) {
    // Pick the first ORG_ADMIN as assignee, fall back to any user
    const assignee =
      (await db.user.findFirst({
        where: { organizationId: org.id, role: "ORG_ADMIN" },
        select: { id: true },
      })) ??
      (await db.user.findFirst({
        where: { organizationId: org.id },
        select: { id: true },
      }));

    if (!assignee) {
      console.warn(`[seed] skipping org "${org.name}" — no users found`);
      continue;
    }

    // Pick the org's active matrix version (via parent template), if any
    const matrix = await db.riskMatrixVersion.findFirst({
      where: {
        isActive: true,
        template: { organizationId: org.id },
      },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    for (const sample of SAMPLE_PROJECTS) {
      await db.riskAssessmentProject.create({
        data: {
          organizationId: org.id,
          subject: sample.subject,
          description: sample.description,
          status: AssessmentProjectStatus.IN_PROGRESS,
          assigneeId: assignee.id,
          createdById: assignee.id,
          dueDate,
          ...(matrix && { matrixVersionId: matrix.id }),
        },
      });
    }

    console.log(
      `[seed] org "${org.name}" — created ${SAMPLE_PROJECTS.length} sample assessments`
    );
  }

  console.log("[done] risk-domain reset + reseed complete.");
}

main()
  .catch((err) => {
    console.error("[error]", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
