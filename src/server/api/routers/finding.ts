/**
 * Finding Router
 *
 * tRPC router for finding management operations including creation and triage.
 *
 * Story 7.2: Finding Creation Form
 * - create mutation
 *
 * Story 7.3: Finding Triage Workflow
 * - transition mutation
 * - search query
 *
 * @see Story 7.2: Finding Creation Form
 * @see Story 7.3: Finding Triage Workflow
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { UserRole, FindingSource, Severity, AuditAction, FindingStatus, AssessmentStatus, AssessmentProjectStatus, RiskDiscoveryStatus, RiskOrgControlRole, Prisma } from "@prisma/client";

import {
  createTRPCRouter,
  organizationProcedure,
  requireRole,
} from "@/server/api/trpc";
import { READ_ROLES, WRITE_ROLES, ADMIN_ROLES } from "@/lib/auth/roles";
import { generateIdentifier } from "@/server/services/identifierService";
import { createAuditLog } from "@/server/services/audit-log.service";
import {
  recomputeRiskScore,
  recomputeRiskScoresForFinding,
} from "@/server/services/riskScore";
import {
  assertFindingTransition,
  isTerminalFindingStatus,
} from "@/server/services/findingStateMachine";
import {
  formatFindingsForCSV,
  generateFindingsExportFilename,
  type FindingExportData,
} from "@/lib/csvFormatter";
// Story 22.2: matrix scoring extracted to a shared service (used by both the
// finding router and the risk manual-override mutation).
import { computeMatrixScoring as computeFindingMatrixScoring } from "@/server/services/matrixScoring";
import { PUBLISHED_FINDINGS_AND, PUBLISHED_FINDINGS_WHERE } from "@/server/services/findingVisibility";
// Reuse the enterprise-risk heatmap machinery so findings plot on the same
// org reference matrix with identical grid sizing/coloring semantics.
import { resolveReferenceMatrix, nearestScaleValue } from "@/server/api/routers/enterpriseRisk";
import { score2D, thresholdForScore } from "@/lib/matrix/heatmap";

/**
 * Roles that can create findings (Story 7.2 AC29)
 * - Security Engineer
 * - GRC Analyst
 * - Org Admin
 */
const FINDING_CREATE_ROLES: UserRole[] = [...WRITE_ROLES];

/**
 * Roles that can triage findings (Story 7.3 AC29)
 * - Security Engineer
 * - GRC Analyst
 * - Org Admin
 */
const FINDING_TRIAGE_ROLES: UserRole[] = [...WRITE_ROLES];

/**
 * Create Finding Input Schema (Story 7.2 AC24)
 * Validates input for finding creation with proper constraints
 */
const createFindingInput = z.object({
  title: z
    .string()
    .min(5, "Title must be at least 5 characters")
    .max(500, "Title must be less than 500 characters"),
  description: z
    .string()
    .min(20, "Description must be at least 20 characters"),
  source: z.nativeEnum(FindingSource),
  severity: z.nativeEnum(Severity),
  // Matrix-anchored severity â€” when the create UI pulled options from the
  // org's risk matrix, it passes the threshold label and the version it came
  // from so findings and risks share the same qualitative vocabulary.
  severityLabel: z.string().max(50).optional(),
  matrixVersionId: z.string().optional(),
  // Matrix-based LÃ—I(Ã—E) scoring. When likelihood + impact are supplied, the
  // server computes the authoritative inherent score (and derives severity +
  // severityLabel) against the matrix version's scales/thresholds â€” the
  // client-sent severity/severityLabel are ignored in that path so the score
  // can't be spoofed.
  likelihood: z.number().positive().optional(),
  impact: z.number().positive().optional(),
  exposure: z.number().positive().optional(),
  // Story 20.1 follow-up: finding-context documentation (ported from the
  // risks/new form). Flow straight through to the Finding columns.
  cveId: z.string().max(50, "CVE ID must be less than 50 characters").optional(),
  discoveryDate: z.date().optional(),
  technicalDetails: z
    .string()
    .max(10000, "Technical details must be less than 10,000 characters")
    .optional(),
  // Story 20.1 follow-up: identified-risk-card parity â€” findings capture the
  // full risk-item block (minus treatment, which stays on the Risk per the
  // acceptance-at-risk-level model).
  controlDomainId: z.string().optional().nullable(),
  enterpriseRiskId: z.string().optional().nullable(),
  // Link to existing register risks at creation (RiskFindingLink M:N).
  linkedRiskIds: z.array(z.string()).optional().default([]),
  initialAccessVectorId: z.string().optional().nullable(),
  threatStepIds: z.array(z.string()).optional().default([]),
  threatObjectiveIds: z.array(z.string()).optional().default([]),
  mitigatingControlIds: z.array(z.string()).optional().default([]),
  controlGapIds: z.array(z.string()).optional().default([]),
  residualLikelihood: z.number().positive().optional().nullable(),
  residualImpact: z.number().positive().optional().nullable(),
  residualExposure: z.number().positive().optional().nullable(),
  residualEliminated: z.boolean().optional().default(false),
  remediationOptions: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().min(1),
        approach: z.string().min(1),
        costEstimate: z.number().min(0),
        timelineEstimate: z.string().min(1).max(100),
        effortLevel: z.enum(["LOW", "MEDIUM", "HIGH", "VERY_HIGH"]),
        priority: z.enum(["RECOMMENDED", "ALTERNATIVE", "NOT_RECOMMENDED"]),
        ownerId: z.string().optional().nullable(),
      })
    )
    .optional()
    .default([]),
  affectedAssets: z.array(z.string()).optional().default([]),
  affectedBusinessUnitIds: z.array(z.string()).optional().default([]),
  assigneeId: z.string().optional(),
  // Optional inline-creation context. When the finding is spawned from a
  // specific compliance control or maturity domain card, the UI passes the
  // appropriate IDs so we can link them automatically.
  controlId: z.string().optional(),
  complianceAssessmentId: z.string().optional(),
  maturityAssessmentId: z.string().optional(),
  maturityDomainId: z.string().optional(),
  // Risk Assessment Project linkage â€” findings discovered during an assessment.
  // When set, the finding is created PENDING and published on assessment approval.
  discoveryProjectId: z.string().min(1).optional(),
  // Source questionnaire question (when spawned from a question card).
  sourceRiskAssessmentQuestionId: z.string().optional(),
  // Vendor (TPRM) linkage — the finding was raised against a questionnaire
  // response. vendorId / vendorAssessmentId are DERIVED from this id server-side
  // (QuestionnaireResponse has no organizationId of its own), so a caller can't
  // attach a finding to a vendor the response doesn't belong to.
  questionnaireResponseId: z.string().optional(),
});


/**
 * Transition Finding Input Schema (Story 7.3 AC7)
 * Validates input for finding status transition
 */
const transitionFindingInput = z.object({
  findingId: z.string(),
  targetStatus: z.nativeEnum(FindingStatus),
  duplicateOfId: z.string().optional(), // Required when targetStatus is DUPLICATE (AC11)
  rejectionReason: z.string().max(500).optional(), // Optional for REJECTED (AC24)
});

/**
 * Search Finding Input Schema (Story 7.3 AC20)
 * For duplicate finder modal
 */
const searchFindingInput = z.object({
  query: z.string().min(1),
  excludeId: z.string().optional(),
});

/**
 * List Finding Input Schema (Story 7.12)
 * Supports filtering, sorting, and cursor-based pagination
 */
const listFindingInput = z.object({
  // Filters (AC13-AC16)
  status: z.array(z.nativeEnum(FindingStatus)).optional(),
  source: z.array(z.nativeEnum(FindingSource)).optional(),
  severity: z.array(z.nativeEnum(Severity)).optional(),
  // Story 20.3: matrix-anchored severity label filter (e.g. "Critical")
  severityLabel: z.array(z.string()).optional(),
  search: z.string().optional(),
  // Sorting (AC19-AC21; Story 20.3 adds inherentScore)
  sortBy: z
    .enum(["identifier", "title", "severity", "status", "createdAt", "inherentScore"])
    .optional()
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  // Pagination (AC22-AC25)
  limit: z.number().min(1).max(100).optional().default(25),
  cursor: z.string().optional(),
});

export const findingRouter = createTRPCRouter({
  /**
   * Get a finding by ID with all related data
   *
   * Story 7.11: Finding Detail Page
   * Returns finding with creator/assignee/triager info, affected business
   * units, and linked register risks (the legacy 1:1 risk assessment spine
   * retired in Story 23.3).
   */
  getById: organizationProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      const finding = await ctx.db.finding.findFirst({
        where: {
          id: input.id,
          organizationId,
        },
        include: {
          creator: { select: { id: true, name: true, email: true } },
          assignee: { select: { id: true, name: true, email: true } },
          triager: { select: { id: true, name: true, email: true } },
          affectedBusinessUnits: { select: { id: true, name: true } },
          duplicateOf: { select: { id: true, identifier: true, title: true } },
          // Story 21.2: linked register risks (RiskFindingLink M:N)
          riskLinks: {
            select: {
              riskId: true,
              risk: {
                select: {
                  id: true,
                  identifier: true,
                  title: true,
                  severity: true,
                  status: true,
                  // Story 23.1: treatment state shown on the finding side
                  Treatments: {
                    orderBy: { decidedAt: "desc" },
                    take: 1,
                    select: { treatmentType: true, decidedAt: true },
                  },
                },
              },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (!finding) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Finding not found",
        });
      }

      return finding;
    }),

  /**
   * List findings with filtering, sorting, and pagination
   *
   * Story 7.12: Findings List Page
   * AC5: Returns findings with required columns
   * AC13-AC16: Status, source, severity, search filters
   * AC19-AC21: Sorting by multiple columns
   * AC22-AC25: Cursor-based pagination
   */
  /**
   * Distinct matrix severity labels across the org's findings (Story 20.3).
   * Drives the register's "Matrix Severity" filter dropdown â€” sourced from
   * actual data rather than the current matrix so legacy/superseded labels
   * remain filterable.
   */
  listSeverityLabels: organizationProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.finding.findMany({
      where: {
        organizationId: ctx.organizationId!,
        severityLabel: { not: null },
        ...PUBLISHED_FINDINGS_AND,
      },
      distinct: ["severityLabel"],
      select: { severityLabel: true },
      orderBy: { severityLabel: "asc" },
    });
    return rows.map((r) => r.severityLabel!) ;
  }),

  /**
   * Org-wide findings heatmap: every register finding positioned on the org's
   * default reference matrix grid. Each finding uses its residual L/I when
   * scored, otherwise its inherent L/I, snapped to the matrix's nearest scale
   * value. Findings with neither residual nor inherent L/I are omitted (they
   * can't be plotted). Mirrors enterpriseRisk.heatmap so it can feed the shared
   * RiskScoreHeatmap component. Gated on the same read tier as `list`.
   */
  heatmap: organizationProcedure.query(async ({ ctx }) => {
    const orgId = ctx.organizationId!;
    const matrix = await resolveReferenceMatrix(ctx.db, orgId, null);

    const findings = await ctx.db.finding.findMany({
      where: {
        organizationId: orgId,
        ...PUBLISHED_FINDINGS_WHERE,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        identifier: true,
        title: true,
        severityLabel: true,
        inherentLikelihood: true,
        inherentImpact: true,
        residualLikelihood: true,
        residualImpact: true,
      },
    });

    // Row shape mirrors RiskScoreHeatmap's HeatmapItem so the client can pass
    // it straight through. Nullable numerics keep the two return branches
    // (matrix / no-matrix) type-compatible for tRPC inference.
    type HeatmapRow = {
      id: string;
      label: string | null;
      title: string;
      likelihood: number | null;
      impact: number | null;
      score: number | null;
      scoreLabel: string | null;
      color: string;
      href: string;
    };

    // No org matrix → nothing to plot on. Return matrix: null so the client can
    // render its empty-card fallback (same contract as enterpriseRisk.heatmap).
    if (!matrix) {
      return { matrix: null, rows: [] as HeatmapRow[] };
    }

    const rows: HeatmapRow[] = findings
      .map((f): HeatmapRow | null => {
        // Prefer residual L/I (post-treatment), fall back to inherent.
        const rawL = f.residualLikelihood ?? f.inherentLikelihood;
        const rawI = f.residualImpact ?? f.inherentImpact;
        // Skip findings with no usable L/I — they can't be plotted.
        if (rawL === null || rawI === null) return null;

        const likelihood = nearestScaleValue(Number(rawL), matrix.scales.likelihood);
        const impact = nearestScaleValue(Number(rawI), matrix.scales.impact);
        const score = score2D(likelihood, impact, matrix.scales, matrix.outputScaleMax);
        const band = thresholdForScore(score, matrix.thresholds);

        return {
          id: f.id,
          label: f.identifier,
          title: f.title,
          likelihood,
          impact,
          score,
          // Prefer the finding's stored matrix label; fall back to the band the
          // grid resolves this cell to.
          scoreLabel: f.severityLabel ?? band?.label ?? null,
          color: band?.color ?? "#CCCCCC",
          href: `/findings/${f.id}`,
        };
      })
      .filter((r): r is HeatmapRow => r !== null);

    return {
      matrix: {
        templateName: matrix.templateName,
        scales: matrix.scales,
        thresholds: matrix.thresholds,
        outputScaleMax: matrix.outputScaleMax,
      },
      rows,
    };
  }),

  /**
   * List findings spawned from a specific compliance or maturity assessment.
   * Used by the bottom-of-page "Findings entered here" section.
   */
  listForAssessment: organizationProcedure
    .input(
      z.object({
        assessmentId: z.string(),
        // Full AssessmentKind set so the consulting wrapper (Exploitation
        // Pathways / Action Plans pickers) works for every assessment kind.
        assessmentType: z.enum([
          "COMPLIANCE",
          "MATURITY",
          "VENDOR",
          "RISK",
          "BIA",
        ]),
      })
    )
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      // Map each assessment kind to the Finding source field it lives under.
      // BIA has no Findingâ†”BIA linkage, so short-circuit with an empty array
      // before touching the DB (keeps the picker working, never throws).
      let where: Prisma.FindingWhereInput;
      switch (input.assessmentType) {
        case "COMPLIANCE":
          where = { organizationId, sourceComplianceAssessmentId: input.assessmentId };
          break;
        case "MATURITY":
          where = { organizationId, sourceMaturityAssessmentId: input.assessmentId };
          break;
        case "VENDOR":
          where = { organizationId, vendorAssessmentId: input.assessmentId };
          break;
        case "RISK":
          where = { organizationId, discoveryProjectId: input.assessmentId };
          break;
        case "BIA":
        default:
          return [];
      }

      return ctx.db.finding.findMany({
        where,
        select: {
          id: true,
          identifier: true,
          title: true,
          severity: true,
          severityLabel: true,
          status: true,
          source: true,
          createdAt: true,
          creator: { select: { id: true, name: true, email: true } },
          sourceMaturityDomain: {
            select: { id: true, code: true, name: true },
          },
          ControlLinks: {
            select: {
              control: { select: { id: true, controlId: true, title: true } },
            },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  /**
   * List findings discovered within a risk-assessment project (the assessment's
   * own Findings tab). Returns all of the assessment's findings regardless of
   * discoveryStatus, so PENDING (not-yet-published) findings are visible here.
   */
  listForProject: organizationProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      return ctx.db.finding.findMany({
        where: { organizationId, discoveryProjectId: input.projectId },
        select: {
          id: true,
          identifier: true,
          title: true,
          severity: true,
          severityLabel: true,
          status: true,
          source: true,
          discoveryStatus: true,
          createdAt: true,
          assignee: { select: { id: true, name: true, email: true } },
          creator: { select: { id: true, name: true, email: true } },
          sourceRiskAssessmentQuestion: { select: { id: true, number: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  list: organizationProcedure
    .input(listFindingInput)
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const { status, source, severity, severityLabel, search, sortBy, sortOrder, limit, cursor } = input;

      // Build where clause with filters
      // Only show findings that are published (from approved assessments) or
      // created directly (no discoveryStatus). Assessment-discovered findings
      // stay PENDING and hidden from the register until approval â€” same gating
      // as discovered risks.
      const where: Prisma.FindingWhereInput = {
        organizationId,
        OR: [{ discoveryStatus: RiskDiscoveryStatus.PUBLISHED }, { discoveryStatus: null }],
        ...(status && status.length > 0 && { status: { in: status } }),
        ...(source && source.length > 0 && { source: { in: source } }),
        ...(severity && severity.length > 0 && { severity: { in: severity } }),
        // Story 20.3: matrix label filter
        ...(severityLabel &&
          severityLabel.length > 0 && { severityLabel: { in: severityLabel } }),
        ...(search && {
          AND: [
            {
              OR: [
                { identifier: { contains: search, mode: "insensitive" as const } },
                { title: { contains: search, mode: "insensitive" as const } },
              ],
            },
          ],
        }),
      };

      // Build orderBy clause. Score sorting keeps unscored legacy findings at
      // the bottom regardless of direction (Story 20.3).
      // Story 23.5 (review MN-1): a deterministic id tie-breaker makes cursor
      // pagination stable when the primary sort column has duplicates.
      const orderBy: Prisma.FindingOrderByWithRelationInput[] =
        sortBy === "inherentScore"
          ? [{ inherentScore: { sort: sortOrder!, nulls: "last" } }, { id: "asc" }]
          : [{ [sortBy!]: sortOrder }, { id: "asc" }];

      // Get total count for pagination info
      const totalCount = await ctx.db.finding.count({ where });

      // Fetch findings with cursor-based pagination
      // Returns all displayable fields for column customization
      const findings = await ctx.db.finding.findMany({
        where,
        orderBy,
        take: limit! + 1, // Fetch one extra to determine if there's a next page
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
        select: {
          // Core fields
          id: true,
          identifier: true,
          title: true,
          description: true,
          source: true,
          severity: true,
          severityLabel: true,
          inherentScore: true, // Story 20.3: sortable score column
          status: true,
          // Epic 19: exploitation-pathway membership (drives the â¬¡ register indicator)
          isToxic: true,
          // Array fields
          affectedAssets: true,
          // Date fields
          createdAt: true,
          updatedAt: true,
          triagedAt: true,
          dueDate: true,
          closedAt: true,
          // SLA fields
          slaBreached: true,
          // Duplicate tracking
          duplicateOfId: true,
          // User relations
          creator: { select: { id: true, name: true, email: true } },
          assignee: { select: { id: true, name: true, email: true } },
          triager: { select: { id: true, name: true, email: true } },
          // Business unit relations
          affectedBusinessUnits: { select: { id: true, name: true } },
          // Counts for related items
          _count: {
            select: {
              ControlLinks: true,
              comments: true,
              evidenceLinks: true,
            },
          },
        },
      });

      // Determine if there's a next page
      let nextCursor: string | undefined;
      if (findings.length > limit!) {
        const nextItem = findings.pop();
        nextCursor = nextItem?.id;
      }

      return {
        items: findings,
        nextCursor,
        totalCount,
      };
    }),

  /**
   * Create a new finding
   *
   * AC23: `finding.create` mutation defined in finding router
   * AC24: Input validated with Zod schema
   * AC25: Identifier generated via `generateIdentifier(orgId, "FND")`
   * AC26: createdBy set from session user
   * AC27: organizationId set from session user
   * AC28: Returns created finding with id and identifier
   * AC29: SecurityOrg role members can create findings
   * AC32-AC33: Finding creation logged with action FINDING_CREATED
   */
  create: organizationProcedure
    .use(requireRole(FINDING_CREATE_ROLES))
    .input(createFindingInput)
    .mutation(async ({ ctx, input }) => {
      const {
        affectedBusinessUnitIds,
        assigneeId,
        controlId,
        complianceAssessmentId,
        maturityAssessmentId,
        maturityDomainId,
        discoveryProjectId,
        sourceRiskAssessmentQuestionId,
        questionnaireResponseId,
        likelihood,
        impact,
        exposure,
        // Identified-risk-card parity fields (handled explicitly below)
        linkedRiskIds,
        threatStepIds,
        threatObjectiveIds,
        mitigatingControlIds,
        controlGapIds,
        residualLikelihood,
        residualImpact,
        residualExposure,
        residualEliminated,
        remediationOptions,
        ...findingData
      } = input;

      // organizationProcedure guarantees session and organizationId are non-null
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      // Risk Assessment Project linkage: validate the assessment and restrict
      // to the assigned analyst (mirrors risk.create â€” the assignee owns the
      // assessment's discovered items). Findings start PENDING and publish on
      // assessment approval.
      if (discoveryProjectId) {
        const assessment = await ctx.db.riskAssessmentProject.findUnique({
          where: { id: discoveryProjectId },
          select: { id: true, organizationId: true, status: true, assigneeId: true },
        });
        if (!assessment) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Risk assessment project not found",
          });
        }
        if (assessment.organizationId !== organizationId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to this assessment",
          });
        }
        if (assessment.status !== AssessmentProjectStatus.IN_PROGRESS) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot add findings to an assessment that is not in progress",
          });
        }
        if (assessment.assigneeId !== userId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only the assigned analyst can add findings to this assessment",
          });
        }
      }

      // Vendor (TPRM) linkage: walk response → questionnaire → assessment → vendor.
      // This walk is also the org check — QuestionnaireResponse has no
      // organizationId column, so ownership is only provable through the
      // assessment. Absorbed from the deleted createFromQuestionnaireResponse.
      let vendorLinkage: { vendorId: string; vendorAssessmentId: string } | null = null;
      if (questionnaireResponseId) {
        const response = await ctx.db.questionnaireResponse.findUnique({
          where: { id: questionnaireResponseId },
          select: {
            questionnaire: {
              select: {
                assessment: {
                  select: { id: true, organizationId: true, vendorId: true },
                },
              },
            },
          },
        });
        if (!response) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Questionnaire response not found",
          });
        }
        const assessment = response.questionnaire.assessment;
        if (assessment.organizationId !== organizationId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Assessment does not belong to this organization",
          });
        }

        // One finding per response (FR46). Only ever checked on the vendor path —
        // every other create flow leaves questionnaireResponseId undefined.
        const existing = await ctx.db.finding.findFirst({
          where: { questionnaireResponseId },
          select: { id: true },
        });
        if (existing) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "A finding has already been created for this response",
          });
        }

        vendorLinkage = {
          vendorId: assessment.vendorId,
          vendorAssessmentId: assessment.id,
        };
      }

      // AC25: Generate sequential identifier
      const identifier = await generateIdentifier(organizationId, "FND");

      // Validate BUs are in same organization (if provided)
      if (affectedBusinessUnitIds && affectedBusinessUnitIds.length > 0) {
        const validBUs = await ctx.db.businessUnit.count({
          where: {
            id: { in: affectedBusinessUnitIds },
            organizationId,
          },
        });
        if (validBUs !== affectedBusinessUnitIds.length) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid business unit(s) - must be in same organization",
          });
        }
      }

      // Validate assignee is in same organization (if provided)
      if (assigneeId) {
        const validAssignee = await ctx.db.user.findFirst({
          where: {
            id: assigneeId,
            organizationId,
          },
        });
        if (!validAssignee) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid assignee - must be in same organization",
          });
        }
      }

      // Validate maturity linkage if provided
      if (maturityAssessmentId) {
        const ok = await ctx.db.maturityAssessment.findFirst({
          where: { id: maturityAssessmentId, organizationId },
          select: { id: true },
        });
        if (!ok) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid maturity assessment â€” must be in same organization",
          });
        }
      }

      if (complianceAssessmentId) {
        const ok = await ctx.db.complianceAssessment.findFirst({
          where: { id: complianceAssessmentId, organizationId },
          select: { id: true },
        });
        if (!ok) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Invalid compliance assessment â€” must be in same organization",
          });
        }
      }

      // Story 23.5 (review MJ-1): every remaining org-scoped foreign id on the
      // card payload is validated against the caller's org - the org-filter
      // middleware doesn't inspect nested writes or raw FK values.
      if (controlId) {
        const ok = await ctx.db.control.findFirst({
          where: { id: controlId, organizationId },
          select: { id: true },
        });
        if (!ok) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid control - must be in same organization",
          });
        }
      }

      if (findingData.enterpriseRiskId) {
        const ok = await ctx.db.enterpriseRisk.findFirst({
          where: { id: findingData.enterpriseRiskId, organizationId },
          select: { id: true },
        });
        if (!ok) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid enterprise risk - must be in same organization",
          });
        }
      }

      const orgControlIdsToValidate = Array.from(
        new Set([...(mitigatingControlIds ?? []), ...(controlGapIds ?? [])]),
      );
      if (orgControlIdsToValidate.length > 0) {
        const validOrgControls = await ctx.db.organizationalControl.count({
          where: { id: { in: orgControlIdsToValidate }, organizationId },
        });
        if (validOrgControls !== orgControlIdsToValidate.length) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Invalid organizational control(s) - must be in same organization",
          });
        }
      }

      const remediationOwnerIds = Array.from(
        new Set(
          (remediationOptions ?? [])
            .map((o) => o.ownerId)
            .filter((id): id is string => Boolean(id)),
        ),
      );
      if (remediationOwnerIds.length > 0) {
        const validOwners = await ctx.db.person.count({
          where: { id: { in: remediationOwnerIds }, organizationId },
        });
        if (validOwners !== remediationOwnerIds.length) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Invalid remediation owner(s) - must be in same organization",
          });
        }
      }

      // Story 23.5 (review MJ-2): linked-risk validation happens BEFORE the
      // write transaction so a rejected payload never half-creates a finding.
      if (linkedRiskIds && linkedRiskIds.length > 0) {
        const validRisks = await ctx.db.risk.count({
          where: { id: { in: linkedRiskIds }, organizationId },
        });
        if (validRisks !== linkedRiskIds.length) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid linked risk(s) - must be in same organization",
          });
        }
      }

      // Matrix-based LÃ—I(Ã—E) scoring (authoritative, server-side) â€” shared
      // helper across all finding-creation mutations (Story 20.1). Overrides
      // the client-sent severity/severityLabel in the matrix path so a score
      // can't be spoofed; keeps the categorical flow untouched otherwise.
      const scoring = await computeFindingMatrixScoring(ctx.db, organizationId, {
        likelihood,
        impact,
        exposure,
        matrixVersionId: findingData.matrixVersionId,
        residualLikelihood,
        residualImpact,
        residualExposure,
        residualEliminated,
      });

      // AC22, AC26, AC27: Create finding with status NEW, createdBy and
      // organizationId from session.
      // Story 23.5 (review MJ-2): the finding row and all its card junctions
      // (risk links, threat steps/objectives, org-control links, remediation
      // options) commit atomically - a failure anywhere rolls back the whole
      // create instead of leaving an orphaned half-populated finding.
      const finding = await ctx.db.$transaction(async (tx) => {
      const created = await tx.finding.create({
        data: {
          ...findingData,
          // Matrix scoring overrides the categorical severity when present.
          severity: scoring.severity ?? findingData.severity,
          severityLabel: scoring.severityLabel ?? findingData.severityLabel,
          matrixVersionId: scoring.matrixVersionId,
          inherentLikelihood:
            scoring.inherentLikelihood !== null
              ? new Prisma.Decimal(scoring.inherentLikelihood)
              : null,
          inherentImpact:
            scoring.inherentImpact !== null
              ? new Prisma.Decimal(scoring.inherentImpact)
              : null,
          inherentExposure:
            scoring.inherentExposure !== null
              ? new Prisma.Decimal(scoring.inherentExposure)
              : null,
          inherentScore:
            scoring.inherentScore !== null
              ? new Prisma.Decimal(scoring.inherentScore)
              : null,
          // Residual severity (identified-risk-card parity)
          residualLikelihood:
            scoring.residualLikelihood !== null
              ? new Prisma.Decimal(scoring.residualLikelihood)
              : null,
          residualImpact:
            scoring.residualImpact !== null
              ? new Prisma.Decimal(scoring.residualImpact)
              : null,
          residualExposure:
            scoring.residualExposure !== null
              ? new Prisma.Decimal(scoring.residualExposure)
              : null,
          residualScore:
            scoring.residualScore !== null
              ? new Prisma.Decimal(scoring.residualScore)
              : null,
          residualScoreLabel: scoring.residualScoreLabel,
          residualEliminated: residualEliminated ?? false,
          identifier,
          organizationId,
          createdBy: userId,
          status: "NEW",
          assigneeId: assigneeId ?? null,
          sourceMaturityAssessmentId: maturityAssessmentId ?? null,
          sourceMaturityDomainId: maturityDomainId ?? null,
          sourceComplianceAssessmentId: complianceAssessmentId ?? null,
          sourceRiskAssessmentQuestionId: sourceRiskAssessmentQuestionId ?? null,
          // Vendor (TPRM) linkage — derived above, never client-supplied.
          questionnaireResponseId: questionnaireResponseId ?? null,
          vendorId: vendorLinkage?.vendorId ?? null,
          vendorAssessmentId: vendorLinkage?.vendorAssessmentId ?? null,
          // Gated lifecycle: PENDING until the assessment is approved (mirrors risks)
          discoveryProjectId: discoveryProjectId ?? null,
          discoveryStatus: discoveryProjectId ? RiskDiscoveryStatus.PENDING : null,
          affectedBusinessUnits: affectedBusinessUnitIds?.length
            ? { connect: affectedBusinessUnitIds.map((id) => ({ id })) }
            : undefined,
          // Auto-link to the compliance control when spawned from an
          // assessment â€” mirrors the manual linking flow from the findings
          // detail page. Default linkType OBSERVATION; users can change it.
          ControlLinks: controlId
            ? {
                create: {
                  organizationId,
                  controlId,
                  linkType: "OBSERVATION",
                  createdById: userId,
                },
              }
            : undefined,
        },
        include: {
          affectedBusinessUnits: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true, email: true } },
          creator: { select: { id: true, name: true, email: true } },
        },
      });

      // Story 20.1 follow-up: link the finding to existing register risks
      // (RiskFindingLink M:N). Ids validated pre-transaction.
      if (linkedRiskIds && linkedRiskIds.length > 0) {
        await tx.riskFindingLink.createMany({
          data: linkedRiskIds.map((riskId) => ({
            riskId,
            findingId: created.id,
          })),
          skipDuplicates: true,
        });
      }

      // Story 20.1 follow-up: identified-risk-card parity - persist MITRE
      // threat steps/objectives, split-role org-control links, and per-item
      // remediation options (mirrors risk.createAssessment, minus treatment).
      if (threatStepIds && threatStepIds.length > 0) {
        await tx.findingThreatStep.createMany({
          data: threatStepIds.map((techniqueId, i) => ({
            findingId: created.id,
            techniqueId,
            stepOrder: i,
          })),
          skipDuplicates: true,
        });
      }
      if (threatObjectiveIds && threatObjectiveIds.length > 0) {
        await tx.findingThreatObjective.createMany({
          data: threatObjectiveIds.map((techniqueId) => ({
            findingId: created.id,
            techniqueId,
          })),
          skipDuplicates: true,
        });
      }
      const orgControlLinks: Array<{ organizationalControlId: string; role: RiskOrgControlRole }> = [];
      for (const id of mitigatingControlIds ?? []) {
        orgControlLinks.push({ organizationalControlId: id, role: RiskOrgControlRole.IN_PLACE });
      }
      for (const id of controlGapIds ?? []) {
        if (!orgControlLinks.some((l) => l.organizationalControlId === id)) {
          orgControlLinks.push({ organizationalControlId: id, role: RiskOrgControlRole.NEEDED });
        }
      }
      if (orgControlLinks.length > 0) {
        await tx.findingOrganizationalControl.createMany({
          data: orgControlLinks.map((link) => ({
            findingId: created.id,
            organizationalControlId: link.organizationalControlId,
            organizationId,
            role: link.role,
            createdById: userId,
          })),
          skipDuplicates: true,
        });
      }
      if (remediationOptions && remediationOptions.length > 0) {
        await tx.remediationOption.createMany({
          data: remediationOptions.map((opt) => ({
            findingId: created.id,
            organizationId,
            title: opt.title,
            description: opt.description,
            approach: opt.approach,
            costEstimate: new Prisma.Decimal(opt.costEstimate),
            timelineEstimate: opt.timelineEstimate,
            effortLevel: opt.effortLevel,
            priority: opt.priority,
            ownerId: opt.ownerId ?? null,
            createdById: userId,
          })),
        });
      }

      return created;
      });

      // Story 22.1: derived-score rollup for newly-linked risks - after the
      // transaction commits so the recompute sees the new links.
      if (linkedRiskIds && linkedRiskIds.length > 0) {
        for (const riskId of linkedRiskIds) {
          void recomputeRiskScore(ctx.db, riskId, "finding-created-linked", userId);
        }
      }

      // AC32-AC33: Audit log finding creation
      void createAuditLog({
        organizationId,
        userId,
        action: AuditAction.FINDING_CREATED,
        entityType: "Finding",
        entityId: finding.id,
        changes: {
          before: null,
          after: {
            identifier: finding.identifier,
            title: finding.title,
            source: finding.source,
            severity: finding.severity,
            severityLabel: finding.severityLabel,
            matrixVersionId: finding.matrixVersionId,
            assigneeId: finding.assigneeId,
            affectedBusinessUnits: finding.affectedBusinessUnits.map((bu) => bu.id),
          },
        },
      });

      // AC28: Return created finding with id and identifier
      return finding;
    }),

  /**
   * Transition a finding to a new status
   *
   * Story 7.3: Finding Triage Workflow
   * AC7: `finding.transition` mutation accepts findingId and targetStatus
   * AC8: Mutation validates state transition is allowed
   * AC9: Mutation updates finding status and timestamp fields
   * AC10: TRIAGED transition sets triagedBy and triagedAt
   * AC11: DUPLICATE transition requires duplicateOfId parameter
   * AC12: Returns updated finding
   * AC29: Only SecurityOrg role members can triage findings
   * AC31-AC33: Audit logging with FINDING_TRANSITIONED action
   */
  transition: organizationProcedure
    .use(requireRole(FINDING_TRIAGE_ROLES))
    .input(transitionFindingInput)
    .mutation(async ({ ctx, input }) => {
      const { findingId, targetStatus, duplicateOfId, rejectionReason } = input;
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      // Fetch finding and validate organization ownership
      const finding = await ctx.db.finding.findFirst({
        where: { id: findingId, organizationId },
      });

      if (!finding) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Finding not found",
        });
      }

      // AC8: Validate state transition is allowed
      assertFindingTransition(finding.status, targetStatus);

      // Build update data based on target status
      const updateData: Prisma.FindingUpdateInput = {
        status: targetStatus,
      };

      // AC10: TRIAGED transition sets triagedBy and triagedAt
      if (targetStatus === FindingStatus.TRIAGED) {
        updateData.triager = { connect: { id: userId } };
        updateData.triagedAt = new Date();
      }

      // Story 21.4: CLOSED transition stamps closedAt (SLA reporting reads it)
      if (targetStatus === FindingStatus.CLOSED) {
        updateData.closedAt = new Date();
      }

      // AC11: DUPLICATE transition requires duplicateOfId parameter
      if (targetStatus === FindingStatus.DUPLICATE) {
        if (!duplicateOfId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "duplicateOfId is required when marking as duplicate",
          });
        }
        // Validate duplicate finding exists in same org
        const originalFinding = await ctx.db.finding.findFirst({
          where: { id: duplicateOfId, organizationId },
        });
        if (!originalFinding) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Original finding not found in organization",
          });
        }
        // Prevent self-reference
        if (duplicateOfId === findingId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "A finding cannot be a duplicate of itself",
          });
        }
        updateData.duplicateOf = { connect: { id: duplicateOfId } };
      }

      // AC9, AC12: Update finding status and return result
      const updated = await ctx.db.finding.update({
        where: { id: findingId },
        data: updateData,
        include: {
          affectedBusinessUnits: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true, email: true } },
          creator: { select: { id: true, name: true, email: true } },
          duplicateOf: { select: { id: true, identifier: true, title: true } },
        },
      });

      // AC31-AC33: Audit log finding transition
      void createAuditLog({
        organizationId,
        userId,
        action: AuditAction.FINDING_TRANSITIONED,
        entityType: "Finding",
        entityId: finding.id,
        changes: {
          before: { status: finding.status },
          after: {
            status: targetStatus,
            ...(duplicateOfId && { duplicateOfId }),
            ...(rejectionReason && { rejectionReason }),
          },
        },
      });

      // Story 22.1: status changes move findings in/out of the open rollup
      // (closing a linked finding burns down its risks' calculated scores)
      void recomputeRiskScoresForFinding(ctx.db, finding.id, "finding-status-changed", userId);

      return updated;
    }),

  /**
   * Search for findings (for duplicate finder modal)
   *
   * Story 7.3: Finding Triage Workflow
   * AC19: "Mark Duplicate" opens modal to search/select original finding
   * AC20: Search finds findings by identifier or title (within organization)
   */
  search: organizationProcedure
    .input(searchFindingInput)
    .query(async ({ ctx, input }) => {
      const { query, excludeId } = input;
      const organizationId = ctx.organizationId!;

      return ctx.db.finding.findMany({
        where: {
          organizationId,
          ...(excludeId && { id: { not: excludeId } }),
          // Unpublished assessment findings are not searchable (2026-07-06).
          ...PUBLISHED_FINDINGS_AND,
          OR: [
            { identifier: { startsWith: query.toUpperCase() } },
            { title: { contains: query, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          identifier: true,
          title: true,
          status: true,
          severity: true,
        },
        take: 10,
        orderBy: { createdAt: "desc" },
      });
    }),

  // Story 23.3: the legacy `finding.accept` mutation (finding → spawned
  // RiskAssessment) is retired. Findings link to register risks instead
  // (finding.linkRisks / risk.linkFindings); acceptance is a risk-level
  // treatment decision (risk.createTreatment ACCEPT).

  // ============================================================================
  // Story 14.5: Finding Comments & Collaboration
  // ============================================================================

  /**
   * Add a comment to a finding
   *
   * Story 14.5: Finding Comments
   * AC1: Any stakeholder can add comments
   * AC3: Comments displayed in chronological order
   */
  addComment: organizationProcedure
    .input(z.object({
      findingId: z.string(),
      content: z.string().min(1, "Comment cannot be empty").max(5000),
    }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      // Verify finding exists in organization
      const finding = await ctx.db.finding.findFirst({
        where: { id: input.findingId, organizationId },
      });

      if (!finding) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Finding not found",
        });
      }

      const comment = await ctx.db.findingComment.create({
        data: {
          organizationId,
          findingId: input.findingId,
          userId,
          content: input.content,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });

      return comment;
    }),

  /**
   * Get comments for a finding
   *
   * Story 14.5: Finding Comments
   * AC3: Comments displayed in chronological order
   * AC4: Shows commenter name and timestamp
   */
  getComments: organizationProcedure
    .input(z.object({ findingId: z.string() }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      return ctx.db.findingComment.findMany({
        where: {
          findingId: input.findingId,
          organizationId,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
      });
    }),

  /**
   * Update a comment (author only)
   *
   * Story 14.5: Finding Comments
   * AC5: Edit own comments
   */
  updateComment: organizationProcedure
    .input(z.object({
      commentId: z.string(),
      content: z.string().min(1).max(5000),
    }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      const comment = await ctx.db.findingComment.findFirst({
        where: {
          id: input.commentId,
          organizationId,
          userId, // Can only edit own comments
        },
      });

      if (!comment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Comment not found or you cannot edit it",
        });
      }

      return ctx.db.findingComment.update({
        where: { id: input.commentId },
        data: { content: input.content },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });
    }),

  /**
   * Delete a comment (author only)
   *
   * Story 14.5: Finding Comments
   * AC5: Delete own comments
   */
  deleteComment: organizationProcedure
    .input(z.object({ commentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      const comment = await ctx.db.findingComment.findFirst({
        where: {
          id: input.commentId,
          organizationId,
          userId,
        },
      });

      if (!comment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Comment not found or you cannot delete it",
        });
      }

      await ctx.db.findingComment.delete({
        where: { id: input.commentId },
      });

      return { success: true };
    }),

  // ============================================================================
  // Story 14.6: Finding Evidence Attachment
  // ============================================================================

  /**
   * Attach evidence to a finding
   *
   * Story 14.6: Finding Evidence
   * AC2: Can attach existing evidence from repository
   */
  attachEvidence: organizationProcedure
    .use(requireRole(FINDING_TRIAGE_ROLES))
    .input(z.object({
      findingId: z.string(),
      evidenceId: z.string(),
      notes: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      // Verify finding exists
      const finding = await ctx.db.finding.findFirst({
        where: { id: input.findingId, organizationId },
      });

      if (!finding) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Finding not found",
        });
      }

      // Verify evidence exists
      const evidence = await ctx.db.evidence.findFirst({
        where: { id: input.evidenceId, organizationId },
      });

      if (!evidence) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Evidence not found",
        });
      }

      // Create attachment
      const attachment = await ctx.db.findingEvidence.create({
        data: {
          organizationId,
          findingId: input.findingId,
          evidenceId: input.evidenceId,
          attachedById: userId,
          notes: input.notes,
        },
        include: {
          evidence: {
            select: {
              id: true,
              title: true,
              originalFileName: true,
              fileType: true,
              createdAt: true,
            },
          },
          attachedBy: { select: { id: true, name: true, email: true } },
        },
      });

      return attachment;
    }),

  /**
   * Get evidence attached to a finding
   *
   * Story 14.6: Finding Evidence
   * AC4: Evidence list shows file name, upload date, uploader
   */
  getEvidence: organizationProcedure
    .input(z.object({ findingId: z.string() }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      return ctx.db.findingEvidence.findMany({
        where: {
          findingId: input.findingId,
          organizationId,
        },
        include: {
          evidence: {
            select: {
              id: true,
              title: true,
              originalFileName: true,
              fileType: true,
              fileSize: true,
              createdAt: true,
            },
          },
          attachedBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { attachedAt: "desc" },
      });
    }),

  /**
   * Remove evidence attachment from a finding
   *
   * Story 14.6: Finding Evidence
   * AC5: Remove attachment action
   */
  removeEvidence: organizationProcedure
    .use(requireRole(FINDING_TRIAGE_ROLES))
    .input(z.object({
      findingId: z.string(),
      evidenceId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      const attachment = await ctx.db.findingEvidence.findFirst({
        where: {
          findingId: input.findingId,
          evidenceId: input.evidenceId,
          organizationId,
        },
      });

      if (!attachment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Evidence attachment not found",
        });
      }

      await ctx.db.findingEvidence.delete({
        where: { id: attachment.id },
      });

      return { success: true };
    }),

  // ============================================================================
  // Story 14.7: Finding SLA Tracking
  // ============================================================================

  /**
   * Update finding with due date for SLA tracking
   *
   * Story 14.7: Finding SLA
   * AC1: Due date field on finding
   */
  updateDueDate: organizationProcedure
    .use(requireRole(FINDING_TRIAGE_ROLES))
    .input(z.object({
      findingId: z.string(),
      dueDate: z.date().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      const finding = await ctx.db.finding.findFirst({
        where: { id: input.findingId, organizationId },
      });

      if (!finding) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Finding not found",
        });
      }

      return ctx.db.finding.update({
        where: { id: input.findingId },
        data: { dueDate: input.dueDate },
      });
    }),

  /**
   * Get findings with SLA status
   *
   * Story 14.7: Finding SLA
   * AC2: SLA status calculated (On Track, At Risk, Breached)
   */
  getWithSlaStatus: organizationProcedure
    .input(z.object({
      slaStatus: z.enum(["on_track", "at_risk", "breached"]).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const now = new Date();
      const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

      // Build where clause based on SLA status filter. Unpublished assessment
      // findings don't accrue register SLA visibility (2026-07-06).
      let whereClause: Prisma.FindingWhereInput = {
        organizationId,
        status: { in: [FindingStatus.NEW, FindingStatus.TRIAGED, FindingStatus.NEEDS_INFO] },
        dueDate: { not: null },
        ...PUBLISHED_FINDINGS_AND,
      };

      if (input.slaStatus === "breached") {
        whereClause = {
          ...whereClause,
          OR: [
            { slaBreached: true },
            { dueDate: { lt: now } },
          ],
        };
      } else if (input.slaStatus === "at_risk") {
        whereClause = {
          ...whereClause,
          dueDate: { gte: now, lte: threeDaysFromNow },
          slaBreached: false,
        };
      } else if (input.slaStatus === "on_track") {
        whereClause = {
          ...whereClause,
          dueDate: { gt: threeDaysFromNow },
          slaBreached: false,
        };
      }

      return ctx.db.finding.findMany({
        where: whereClause,
        include: {
          assignee: { select: { id: true, name: true, email: true } },
        },
        orderBy: { dueDate: "asc" },
      });
    }),

  /**
   * Rescore a finding against its LOCKED matrix version (Story 20.2).
   *
   * AC1: The finding's own matrixVersionId drives the scoring â€” a client can
   *      never re-anchor to a newer matrix (legacy unscored findings fall back
   *      to the org default for their first score).
   * AC2: Before/after audit entry (FINDING_RESCORED).
   * AC3: Terminal-status findings (DUPLICATE/REJECTED/CLOSED) are read-only.
   */
  rescore: organizationProcedure
    .use(requireRole(FINDING_TRIAGE_ROLES))
    .input(
      z.object({
        findingId: z.string(),
        likelihood: z.number().positive(),
        impact: z.number().positive(),
        exposure: z.number().positive().optional(),
        residualLikelihood: z.number().positive().optional().nullable(),
        residualImpact: z.number().positive().optional().nullable(),
        residualExposure: z.number().positive().optional().nullable(),
        residualEliminated: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      const finding = await ctx.db.finding.findFirst({
        where: { id: input.findingId, organizationId },
      });
      if (!finding) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Finding not found" });
      }
      if (isTerminalFindingStatus(finding.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Finding is in terminal status ${finding.status} â€” scoring is read-only`,
        });
      }

      // Locked matrix version: the finding's own, never client-supplied.
      const scoring = await computeFindingMatrixScoring(ctx.db, organizationId, {
        likelihood: input.likelihood,
        impact: input.impact,
        exposure: input.exposure,
        matrixVersionId: finding.matrixVersionId ?? undefined,
        residualLikelihood: input.residualLikelihood,
        residualImpact: input.residualImpact,
        residualExposure: input.residualExposure,
        residualEliminated: input.residualEliminated,
      });

      const before = {
        severity: finding.severity,
        severityLabel: finding.severityLabel,
        inherentLikelihood: finding.inherentLikelihood?.toNumber() ?? null,
        inherentImpact: finding.inherentImpact?.toNumber() ?? null,
        inherentExposure: finding.inherentExposure?.toNumber() ?? null,
        inherentScore: finding.inherentScore?.toNumber() ?? null,
        residualLikelihood: finding.residualLikelihood?.toNumber() ?? null,
        residualImpact: finding.residualImpact?.toNumber() ?? null,
        residualScore: finding.residualScore?.toNumber() ?? null,
        residualScoreLabel: finding.residualScoreLabel,
        residualEliminated: finding.residualEliminated,
      };

      const updated = await ctx.db.finding.update({
        where: { id: finding.id },
        data: {
          severity: scoring.severity ?? finding.severity,
          severityLabel: scoring.severityLabel ?? finding.severityLabel,
          matrixVersionId: scoring.matrixVersionId ?? finding.matrixVersionId,
          inherentLikelihood:
            scoring.inherentLikelihood !== null
              ? new Prisma.Decimal(scoring.inherentLikelihood)
              : null,
          inherentImpact:
            scoring.inherentImpact !== null
              ? new Prisma.Decimal(scoring.inherentImpact)
              : null,
          inherentExposure:
            scoring.inherentExposure !== null
              ? new Prisma.Decimal(scoring.inherentExposure)
              : null,
          inherentScore:
            scoring.inherentScore !== null
              ? new Prisma.Decimal(scoring.inherentScore)
              : null,
          residualLikelihood:
            scoring.residualLikelihood !== null
              ? new Prisma.Decimal(scoring.residualLikelihood)
              : null,
          residualImpact:
            scoring.residualImpact !== null
              ? new Prisma.Decimal(scoring.residualImpact)
              : null,
          residualExposure:
            scoring.residualExposure !== null
              ? new Prisma.Decimal(scoring.residualExposure)
              : null,
          residualScore:
            scoring.residualScore !== null
              ? new Prisma.Decimal(scoring.residualScore)
              : null,
          residualScoreLabel: scoring.residualScoreLabel,
          residualEliminated: input.residualEliminated,
        },
      });

      void createAuditLog({
        organizationId,
        userId,
        action: AuditAction.FINDING_RESCORED,
        entityType: "Finding",
        entityId: finding.id,
        changes: {
          before,
          after: {
            severity: updated.severity,
            severityLabel: updated.severityLabel,
            inherentLikelihood: updated.inherentLikelihood?.toNumber() ?? null,
            inherentImpact: updated.inherentImpact?.toNumber() ?? null,
            inherentExposure: updated.inherentExposure?.toNumber() ?? null,
            inherentScore: updated.inherentScore?.toNumber() ?? null,
            residualLikelihood: updated.residualLikelihood?.toNumber() ?? null,
            residualImpact: updated.residualImpact?.toNumber() ?? null,
            residualScore: updated.residualScore?.toNumber() ?? null,
            residualScoreLabel: updated.residualScoreLabel,
            residualEliminated: updated.residualEliminated,
          },
        },
      });

      // Story 22.1: a rescored finding moves every linked risk's rollup
      void recomputeRiskScoresForFinding(ctx.db, finding.id, "finding-rescored", userId);

      return updated;
    }),

  /**
   * Link a finding to one or more register risks (Story 21.2 â€” replaces the
   * legacy "Accept finding" promotion path).
   *
   * General-model linking: any org risk qualifies (no assessment scoping â€”
   * contrast risk.addFinding). Idempotent; audited as FINDING_RISK_LINKED.
   * Terminal findings are read-only.
   */
  linkRisks: organizationProcedure
    .use(requireRole(FINDING_TRIAGE_ROLES))
    .input(
      z.object({
        findingId: z.string().min(1),
        riskIds: z.array(z.string().min(1)).min(1, "Select at least one risk"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      const finding = await ctx.db.finding.findFirst({
        where: { id: input.findingId, organizationId },
        select: { id: true, status: true },
      });
      if (!finding) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Finding not found" });
      }
      if (isTerminalFindingStatus(finding.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Finding is in terminal status ${finding.status} â€” linking is read-only`,
        });
      }

      const riskIds = Array.from(new Set(input.riskIds));
      const validRisks = await ctx.db.risk.count({
        where: { id: { in: riskIds }, organizationId },
      });
      if (validRisks !== riskIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid risk(s) â€” must be in same organization",
        });
      }

      await ctx.db.riskFindingLink.createMany({
        data: riskIds.map((riskId) => ({ riskId, findingId: finding.id })),
        skipDuplicates: true,
      });

      void createAuditLog({
        organizationId,
        userId,
        action: AuditAction.FINDING_RISK_LINKED,
        entityType: "Finding",
        entityId: finding.id,
        changes: {
          before: null,
          after: { linkedRiskIds: riskIds },
        },
      });

      // Story 22.1: derived-score rollup (fire-and-forget)
      for (const riskId of riskIds) {
        void recomputeRiskScore(ctx.db, riskId, "finding-linked", userId);
      }

      return ctx.db.riskFindingLink.findMany({
        where: { findingId: finding.id },
        select: {
          risk: { select: { id: true, identifier: true, title: true, severity: true } },
        },
        orderBy: { createdAt: "asc" },
      });
    }),

  /**
   * Remove a findingâ†”risk link (Story 21.3). Idempotent; audited as
   * FINDING_RISK_UNLINKED. Terminal findings are read-only.
   */
  unlinkRisk: organizationProcedure
    .use(requireRole(FINDING_TRIAGE_ROLES))
    .input(
      z.object({
        findingId: z.string().min(1),
        riskId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      const finding = await ctx.db.finding.findFirst({
        where: { id: input.findingId, organizationId },
        select: { id: true, status: true },
      });
      if (!finding) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Finding not found" });
      }
      if (isTerminalFindingStatus(finding.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Finding is in terminal status ${finding.status} â€” linking is read-only`,
        });
      }

      await ctx.db.riskFindingLink.deleteMany({
        where: { findingId: finding.id, riskId: input.riskId },
      });

      void createAuditLog({
        organizationId,
        userId,
        action: AuditAction.FINDING_RISK_UNLINKED,
        entityType: "Finding",
        entityId: finding.id,
        changes: {
          before: { riskId: input.riskId },
          after: null,
        },
      });

      // Story 22.1: derived-score rollup (fire-and-forget)
      void recomputeRiskScore(ctx.db, input.riskId, "finding-unlinked", userId);

      return { success: true };
    }),

  /**
   * Lightweight finding list for link pickers (Story 21.3 â€” the risk detail
   * page links findings). Non-terminal findings only.
   */
  listForPicker: organizationProcedure.query(async ({ ctx }) => {
    return ctx.db.finding.findMany({
      where: {
        organizationId: ctx.organizationId!,
        status: {
          notIn: [
            FindingStatus.DUPLICATE,
            FindingStatus.REJECTED,
            FindingStatus.CLOSED,
          ],
        },
        // Story 23.5 (review MJ-7): unpublished assessment findings are not
        // linkable — mirror finding.list's visibility gate.
        OR: [
          { discoveryStatus: RiskDiscoveryStatus.PUBLISHED },
          { discoveryStatus: null },
        ],
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        identifier: true,
        title: true,
        severity: true,
        severityLabel: true,
        status: true,
      },
    });
  }),

  /**
   * Mark SLA as breached (for cron job)
   *
   * Story 14.8: SLA Breach Detection
   * AC2: Updates slaBreached = true for overdue findings
   */
  markSlaBreach: organizationProcedure
    .use(requireRole(ADMIN_ROLES))
    .mutation(async ({ ctx }) => {
      const now = new Date();

      // Find all non-closed findings that are past due and not yet marked breached
      const result = await ctx.db.finding.updateMany({
        where: {
          status: { in: [FindingStatus.NEW, FindingStatus.TRIAGED, FindingStatus.NEEDS_INFO] },
          dueDate: { lt: now },
          slaBreached: false,
        },
        data: { slaBreached: true },
      });

      return { breachedCount: result.count };
    }),

  /**
   * Get findings summary statistics
   *
   * Returns aggregate stats for the Findings Register dashboard:
   * - Total open findings count (NEW, NEEDS_INFO, TRIAGED)
   * - Severity distribution
   * - Source distribution
   * - Status breakdown
   */
  getStats: organizationProcedure.query(async ({ ctx }) => {
    const organizationId = ctx.organizationId!;

    // Story 23.5 (review MJ-7): mirror finding.list's visibility gate so the
    // dashboard counts match the register (assessment-discovered findings
    // stay hidden until their project publishes them).
    const visible = {
      organizationId,
      OR: [
        { discoveryStatus: RiskDiscoveryStatus.PUBLISHED },
        { discoveryStatus: null },
      ],
    };

    // Count open findings by status
    const [newCount, needsInfoCount, triagedCount, closedCount, rejectedCount, duplicateCount] =
      await Promise.all([
        ctx.db.finding.count({
          where: { ...visible, status: FindingStatus.NEW },
        }),
        ctx.db.finding.count({
          where: { ...visible, status: FindingStatus.NEEDS_INFO },
        }),
        ctx.db.finding.count({
          where: { ...visible, status: FindingStatus.TRIAGED },
        }),
        ctx.db.finding.count({
          where: { ...visible, status: FindingStatus.CLOSED },
        }),
        ctx.db.finding.count({
          where: { ...visible, status: FindingStatus.REJECTED },
        }),
        ctx.db.finding.count({
          where: { ...visible, status: FindingStatus.DUPLICATE },
        }),
      ]);

    // Severity distribution for open findings (not resolved)
    const [highCount, mediumCount, lowCount] = await Promise.all([
      ctx.db.finding.count({
        where: {
          ...visible,
          status: { in: [FindingStatus.NEW, FindingStatus.NEEDS_INFO, FindingStatus.TRIAGED] },
          severity: Severity.HIGH,
        },
      }),
      ctx.db.finding.count({
        where: {
          ...visible,
          status: { in: [FindingStatus.NEW, FindingStatus.NEEDS_INFO, FindingStatus.TRIAGED] },
          severity: Severity.MEDIUM,
        },
      }),
      ctx.db.finding.count({
        where: {
          ...visible,
          status: { in: [FindingStatus.NEW, FindingStatus.NEEDS_INFO, FindingStatus.TRIAGED] },
          severity: Severity.LOW,
        },
      }),
    ]);

    const openCount = newCount + needsInfoCount + triagedCount;

    return {
      openCount,
      statusDistribution: {
        NEW: newCount,
        NEEDS_INFO: needsInfoCount,
        TRIAGED: triagedCount,
        CLOSED: closedCount,
        REJECTED: rejectedCount,
        DUPLICATE: duplicateCount,
      },
      severityDistribution: {
        HIGH: highCount,
        MEDIUM: mediumCount,
        LOW: lowCount,
      },
    };
  }),

  /**
   * Export findings to CSV
   *
   * Generates a CSV file with all findings matching the current filters.
   */
  exportFindings: organizationProcedure
    .use(requireRole(READ_ROLES))
    .input(
      z.object({
        status: z.array(z.nativeEnum(FindingStatus)).optional(),
        source: z.array(z.nativeEnum(FindingSource)).optional(),
        severity: z.array(z.nativeEnum(Severity)).optional(),
        search: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const { status, source, severity, search } = input;

      // Build where clause
      const where: Prisma.FindingWhereInput = {
        organizationId,
        // Story 23.5 (review MJ-7): never export unpublished assessment
        // findings — mirrors finding.list's visibility gate (AND-wrapped so
        // it can't collide with the search OR below).
        AND: [
          {
            OR: [
              { discoveryStatus: RiskDiscoveryStatus.PUBLISHED },
              { discoveryStatus: null },
            ],
          },
        ],
        ...(status && status.length > 0 && { status: { in: status } }),
        ...(source && source.length > 0 && { source: { in: source } }),
        ...(severity && severity.length > 0 && { severity: { in: severity } }),
        ...(search && {
          OR: [
            { identifier: { contains: search, mode: "insensitive" as const } },
            { title: { contains: search, mode: "insensitive" as const } },
          ],
        }),
      };

      // Fetch all findings matching filters
      const findings = await ctx.db.finding.findMany({
        where,
        include: {
          creator: { select: { name: true, email: true } },
          assignee: { select: { name: true, email: true } },
          triager: { select: { name: true } },
          affectedBusinessUnits: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      // Transform to export format
      const exportData: FindingExportData[] = findings.map((finding) => ({
        id: finding.id,
        identifier: finding.identifier,
        title: finding.title,
        description: finding.description,
        source: finding.source,
        severity: finding.severity,
        status: finding.status,
        affectedAssets: finding.affectedAssets,
        createdAt: finding.createdAt,
        updatedAt: finding.updatedAt,
        creator: finding.creator,
        assignee: finding.assignee,
        triager: finding.triager,
        affectedBusinessUnits: finding.affectedBusinessUnits,
        triagedAt: finding.triagedAt,
        closedAt: finding.closedAt,
      }));

      // Generate CSV
      const csv = formatFindingsForCSV(exportData);
      const filename = generateFindingsExportFilename();

      // Audit log
      void createAuditLog({
        organizationId,
        userId: ctx.session!.user.id,
        action: AuditAction.EXPORT_FINDINGS,
        entityType: "Finding",
        entityId: "CSV_EXPORT",
        changes: {
          before: null,
          after: {
            exportType: "CSV",
            filters: { status, source, severity, search },
            rowCount: findings.length,
            filename,
          },
        },
        actorName: ctx.session!.user.name ?? "Unknown",
        actorRole: ctx.session!.user.role,
      });

      return {
        filename,
        data: csv,
        rowCount: findings.length,
      };
    }),

  /**
   * Create a finding from a questionnaire response
   *
   * Epic 5: Vendor Risk & Finding Integration
   * FR45: Assessor can create a finding directly from a questionnaire response
   * FR46: System links vendor findings to the main Findings register
   * FR50: Finding created from vendor assessment includes source context
   */
  createFromQuestionnaireResponse: organizationProcedure
    .use(requireRole(FINDING_CREATE_ROLES))
    .input(
      z.object({
        questionnaireResponseId: z.string(),
        title: z
          .string()
          .min(5, "Title must be at least 5 characters")
          .max(500, "Title must be less than 500 characters"),
        description: z
          .string()
          .min(20, "Description must be at least 20 characters"),
        severity: z.nativeEnum(Severity),
        // Story 20.1: matrix-anchored scoring â€” same contract as finding.create.
        // When likelihood + impact are supplied the server computes the
        // authoritative inherent score and overrides severity/severityLabel.
        severityLabel: z.string().max(50).optional(),
        matrixVersionId: z.string().optional(),
        likelihood: z.number().positive().optional(),
        impact: z.number().positive().optional(),
        exposure: z.number().positive().optional(),
        affectedAssets: z.array(z.string()).optional().default([]),
        assigneeId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const {
        questionnaireResponseId,
        title,
        description,
        severity,
        severityLabel,
        matrixVersionId,
        likelihood,
        impact,
        exposure,
        affectedAssets,
        assigneeId,
      } = input;
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      // Fetch the questionnaire response with full context
      const response = await ctx.db.questionnaireResponse.findUnique({
        where: { id: questionnaireResponseId },
        include: {
          question: {
            include: {
              section: {
                include: {
                  template: true,
                },
              },
            },
          },
          questionnaire: {
            include: {
              assessment: {
                include: {
                  vendor: true,
                },
              },
            },
          },
        },
      });

      if (!response) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Questionnaire response not found",
        });
      }

      // Validate the assessment belongs to this organization
      if (response.questionnaire.assessment.organizationId !== organizationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Assessment does not belong to this organization",
        });
      }

      // Check if a finding already exists for this response
      const existingFinding = await ctx.db.finding.findFirst({
        where: { questionnaireResponseId },
      });
      if (existingFinding) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A finding has already been created for this response",
        });
      }

      // Validate assignee if provided
      if (assigneeId) {
        const validAssignee = await ctx.db.user.findFirst({
          where: { id: assigneeId, organizationId },
        });
        if (!validAssignee) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid assignee - must be in same organization",
          });
        }
      }

      // Generate identifier
      const identifier = await generateIdentifier(organizationId, "FND");

      // Extract vendor info
      const vendorId = response.questionnaire.assessment.vendor.id;
      const vendorAssessmentId = response.questionnaire.assessment.id;
      const vendorName = response.questionnaire.assessment.vendor.name;
      const questionText = response.question.questionText;

      // Story 20.1: matrix scoring shared with finding.create â€” overrides the
      // client-sent severity when a complete LÃ—I(Ã—E) score is supplied.
      const scoring = await computeFindingMatrixScoring(ctx.db, organizationId, {
        likelihood,
        impact,
        exposure,
        matrixVersionId,
      });

      // Create the finding with vendor context
      const finding = await ctx.db.finding.create({
        data: {
          organizationId,
          identifier,
          title,
          description,
          source: FindingSource.MANUAL, // Questionnaire-sourced findings are treated as manual
          severity: scoring.severity ?? severity,
          severityLabel: scoring.severityLabel ?? severityLabel,
          matrixVersionId: scoring.matrixVersionId,
          inherentLikelihood:
            scoring.inherentLikelihood !== null
              ? new Prisma.Decimal(scoring.inherentLikelihood)
              : null,
          inherentImpact:
            scoring.inherentImpact !== null
              ? new Prisma.Decimal(scoring.inherentImpact)
              : null,
          inherentExposure:
            scoring.inherentExposure !== null
              ? new Prisma.Decimal(scoring.inherentExposure)
              : null,
          inherentScore:
            scoring.inherentScore !== null
              ? new Prisma.Decimal(scoring.inherentScore)
              : null,
          status: "NEW",
          affectedAssets,
          createdBy: userId,
          assigneeId: assigneeId ?? null,
          // Epic 5: Vendor integration
          vendorId,
          vendorAssessmentId,
          questionnaireResponseId,
        },
        include: {
          assignee: { select: { id: true, name: true, email: true } },
          creator: { select: { id: true, name: true, email: true } },
          vendor: { select: { id: true, name: true, identifier: true } },
          vendorAssessment: { select: { id: true, identifier: true, title: true } },
        },
      });

      // Audit log with vendor context (FR50)
      void createAuditLog({
        organizationId,
        userId,
        action: AuditAction.FINDING_CREATED,
        entityType: "Finding",
        entityId: finding.id,
        changes: {
          before: null,
          after: {
            identifier: finding.identifier,
            title: finding.title,
            severity: finding.severity,
            vendorId,
            vendorAssessmentId,
            questionnaireResponseId,
            sourceContext: {
              vendorName,
              questionText,
              assessmentId: vendorAssessmentId,
              templateName: response.question.section.template.name,
            },
          },
        },
      });

      return finding;
    }),

  /**
   * Get findings linked to a specific vendor
   *
   * Epic 5: FR47 - GRC Analyst can view vendor-related findings on the vendor profile
   */
  getByVendorId: organizationProcedure
    .input(z.object({ vendorId: z.string() }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      // Validate vendor exists in org
      const vendor = await ctx.db.vendor.findFirst({
        where: { id: input.vendorId, organizationId },
      });
      if (!vendor) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Vendor not found",
        });
      }

      return ctx.db.finding.findMany({
        where: {
          organizationId,
          vendorId: input.vendorId,
        },
        include: {
          creator: { select: { id: true, name: true, email: true } },
          assignee: { select: { id: true, name: true, email: true } },
          vendorAssessment: { select: { id: true, identifier: true, title: true } },
          questionnaireResponse: {
            include: {
              question: { select: { id: true, questionText: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    }),
});
