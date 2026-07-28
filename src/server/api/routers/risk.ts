/**
 * Risk Router
 *
 * tRPC router for risk management operations including creation and evidence linkage.
 *
 * Story 3.6: Evidence-to-Risk Linkage
 * - linkEvidenceToRisk mutation
 * - unlinkEvidenceFromRisk mutation
 * - getRiskEvidence query
 *
 * Story 4.1: Risk Creation
 * - create mutation
 *
 * @see Story 3.6: Evidence-to-Risk Linkage
 * @see Story 4.1: Risk Creation via tRPC Procedures and Web Forms
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  UserRole,
  RiskEvidenceLinkType,
  Severity,
  RiskTemplateCategory,
  RiskFindingSource,
  EffortLevel,
  RemediationPriority,
  AssetCriticality,
  RiskStatus,
  CommentType,
  AuditAction,
  RiskOrgControlRole,
  RiskDiscoveryStatus,
  RiskControlLinkType,
  AssessmentProjectStatus,
  RiskRegisterStatus,
  Prisma,
  type PrismaClient
} from "@prisma/client";
import { APPROVE_ROLES, WRITE_ROLES } from "@/lib/auth/roles";
// Story 5.6: CSV Export imports
import {
  formatRisksForCSV,
  generateExportFilename,
  type RiskExportData,
} from "@/lib/csvFormatter";
import {
  validateTransition,
  getAvailableTransitions,
  transitionRequiresReason,
  transitionRequiresEvidence,
} from "@/server/services/riskStatusStateMachine";
import {
  createTRPCRouter,
  organizationProcedure,
  requireRole,
} from "@/server/api/trpc";
import { createAuditLog } from "@/server/services/audit-log.service";
import {
  logRiskAction,
  logSystemRiskAction,
  createRiskCreationDetails,
  createRiskAssignmentDetails,
  createStatusChangeDetails,
  createEvidenceLinkDetails,
  createRemediationOptionDetails,
  createCommentDetails,
} from "@/server/services/riskAuditLogger";
import { recalculateRiskImpact } from "@/server/services/risk-impact-calculator";
import { generateIdentifier } from "@/server/services/identifierService";
import {
  sendRiskAssignmentNotification,
  sendStatusChangeNotification,
  sendRiskClosedNotification,
  sendDecisionRequiredNotification,
  sendCommentAddedNotification,
} from "@/server/services/riskNotification.service";
import { randomUUID } from "crypto";
import {
  getAffectedFrameworkIdsForRisk,
  queueMultipleFrameworkRecalculations,
} from "@/server/services/complianceJobQueue";
// Story 16.4: Residual severity calculation imports
import {
  calculateInherentScore,
  isScoreResult,
} from "@/lib/matrix/scoring";
import type { MatrixScales, Threshold } from "@/lib/matrix/types";
import { score2D, thresholdForScore } from "@/lib/matrix/heatmap";
import { recomputeEnterpriseRiskScore } from "@/server/services/enterpriseRiskScore";
import { recomputeRiskScore } from "@/server/services/riskScore";
import { isTerminalFindingStatus } from "@/server/services/findingStateMachine";
import {
  computeMatrixScoring,
  severityFromLabel as severityFromMatrixLabel,
} from "@/server/services/matrixScoring";

/**
 * Roles that can update risks (Story 4.3 AC29)
 * - Security Engineer
 * - GRC Analyst
 * - Org Admin
 */
const RISK_UPDATE_ROLES: UserRole[] = [...WRITE_ROLES];

/**
 * Roles that can link evidence to risks (Story 3.6 AC24)
 * - Security Engineer
 * - GRC Analyst
 * - Org Admin
 */
const LINK_EVIDENCE_ROLES: UserRole[] = [...WRITE_ROLES];

/**
 * Roles that can create risks (Story 4.1 AC21)
 * - Security Engineer
 * - GRC Analyst
 * - Org Admin
 *
 * AC22: IT_STAKEHOLDER and BUSINESS_STAKEHOLDER cannot create risks
 * AC23: AUDITOR cannot create risks (view-only role)
 */
const RISK_CREATE_ROLES: UserRole[] = [...WRITE_ROLES];

/**
 * Promotes a risk into the risk register (idempotent).
 *
 * A risk only belongs in the register once it has been signed off: either it
 * was raised by someone who can approve (ADMINISTRATOR/MANAGER — see
 * `risk.create`), or it was raised by an ANALYST and has since cleared review
 * (see `approveAssessment`). Assessment-discovered risks are promoted by
 * `riskAssessmentProject.approve` instead, which owns its own promotion.
 *
 * No-ops when an entry already exists, so callers can invoke it without first
 * checking — `riskId` is unique on RiskRegisterEntry.
 */
async function promoteRiskToRegister(
  db: PrismaClient | Prisma.TransactionClient,
  organizationId: string,
  riskId: string,
  ownerId: string,
): Promise<void> {
  const existing = await db.riskRegisterEntry.findUnique({
    where: { riskId },
    select: { id: true },
  });
  if (existing) return;

  const identifier = await generateIdentifier(organizationId, "RR");
  await db.riskRegisterEntry.create({
    data: {
      organizationId,
      identifier,
      riskId,
      ownerId,
      status: RiskRegisterStatus.OPEN,
    },
  });
}

/**
 * Story 4.5: Roles that can manage remediation options (AC9, AC15, AC20)
 * - GRC Analyst: Can add, update, delete options
 * - Security Engineer: Can add, update options
 * - Org Admin: Full access
 */
const REMEDIATION_OPTION_ROLES: UserRole[] = [...WRITE_ROLES];

/**
 * Story 4.6: Roles that can assign risks (AC8, AC36)
 * - GRC Analyst: Primary role for assigning risks
 * - Security Engineer: Can also assign risks
 * - Org Admin: Full access
 */
// Assigning risk owners is staff work (Manager gap fix). NOTE: whether ANALYST
// should retain assign vs. Manager+-only is an open model question (see epics doc).
const RISK_ASSIGN_ROLES: UserRole[] = [...WRITE_ROLES];

/**
 * Story 4.5: Roles that can delete remediation options (AC20)
 * More restrictive - only GRC Analyst and Org Admin
 */
const REMEDIATION_OPTION_DELETE_ROLES: UserRole[] = [...WRITE_ROLES];

/**
 * Story 4.11: Roles that can comment on all risks (AC41)
 * - GRC Analyst: Can comment on all org risks
 * - Security Engineer: Can comment on all org risks
 * - Org Admin: Full access
 */
const COMMENT_FULL_ACCESS_ROLES: UserRole[] = [...WRITE_ROLES];

/**
 * Story 4.11: Roles that can comment on org risks (AC39-AC40)
 * - IT Stakeholder: Can comment on any risk in their org
 * - Business Stakeholder: Can comment on any risk in their org
 */
// Read-only Business Users may NOT comment (commenting is a write action).
const COMMENT_RESTRICTED_ROLES: UserRole[] = [];

/**
 * Story 4.11: All roles that can add comments (AC39-AC42)
 * Excludes AUDITOR (read-only role)
 */
const COMMENT_ALLOWED_ROLES = [
  ...COMMENT_FULL_ACCESS_ROLES,
  ...COMMENT_RESTRICTED_ROLES,
];

/** A matrix version reduced to the bits needed to size/score a heatmap grid. */
interface ReferenceMatrix {
  versionId: string;
  templateName: string;
  scales: MatrixScales;
  thresholds: Threshold[];
  outputScaleMax: number;
}

/**
 * Resolve the org's reference matrix for heatmap plotting. Mirrors
 * enterpriseRisk.resolveReferenceMatrix precedence: explicit version →
 * org's default published template's currentVersion → newest active template's
 * currentVersion. Returns null when the org has no published matrix.
 */
async function resolveReferenceMatrix(
  db: PrismaClient,
  organizationId: string,
  preferredVersionId?: string | null,
): Promise<ReferenceMatrix | null> {
  if (preferredVersionId) {
    const v = await db.riskMatrixVersion.findFirst({
      where: { id: preferredVersionId, template: { organizationId } },
      include: { template: true },
    });
    if (v) {
      return {
        versionId: v.id,
        templateName: v.template.name,
        scales: v.scales as unknown as MatrixScales,
        thresholds: v.thresholds as unknown as Threshold[],
        outputScaleMax: Number(v.template.outputScaleMax),
      };
    }
  }
  const defaultTemplate = await db.riskMatrixTemplate.findFirst({
    where: { organizationId, isDefault: true, isActive: true, currentVersionId: { not: null } },
    include: { currentVersion: true },
  });
  const tpl =
    defaultTemplate ??
    (await db.riskMatrixTemplate.findFirst({
      where: { organizationId, isActive: true, currentVersionId: { not: null } },
      orderBy: { updatedAt: "desc" },
      include: { currentVersion: true },
    }));
  if (!tpl?.currentVersion) return null;
  return {
    versionId: tpl.currentVersion.id,
    templateName: tpl.name,
    scales: tpl.currentVersion.scales as unknown as MatrixScales,
    thresholds: tpl.currentVersion.thresholds as unknown as Threshold[],
    outputScaleMax: Number(tpl.outputScaleMax),
  };
}

/** Round a value to the nearest available scale level (by `value`). */
function nearestScaleValue(value: number, levels: { value: number }[]): number {
  let best = levels[0]?.value ?? value;
  let bestDist = Infinity;
  for (const l of levels) {
    const d = Math.abs(l.value - value);
    if (d < bestDist) {
      bestDist = d;
      best = l.value;
    }
  }
  return best;
}

export const riskRouter = createTRPCRouter({
  /**
   * Create a new risk (Story 4.1: AC15-AC20, Story 4.2: Task 5)
   *
   * Creates a new risk record with initial status OPEN.
   * Only SECURITY_ENGINEER, GRC_ANALYST, and ORG_ADMIN can create risks.
   *
   * Story 4.1:
   * AC15: createRisk mutation accepts: title, description, affectedSystems, severity
   * AC16: Mutation validates all required fields present
   * AC17: Mutation creates Risk record with status OPEN
   * AC18: Mutation sets createdById from session user
   * AC19: Mutation sets organizationId from session user
   * AC20: Mutation returns created risk with ID
   *
   * Story 4.2 (Task 5):
   * - Add optional templateId to createRisk input schema (5.1)
   * - If templateId provided, fetch template and use defaults (5.2)
   * - Associate created risk with templateId for tracking (5.3)
   * - Log template usage in audit trail (5.4)
   */
  create: organizationProcedure
    .use(requireRole(RISK_CREATE_ROLES))
    .input(
      z.object({
        title: z.string().min(1, "Title is required"),
        description: z.string().min(1, "Description is required").max(10000),
        affectedSystems: z.string().optional(),
        severity: z.nativeEnum(Severity),
        // Story 4.2 (Task 5.1): Optional templateId for template-based risk creation
        templateId: z.string().optional(),
        // Story 4.3 (AC18-AC22): Finding context fields
        findingSource: z.nativeEnum(RiskFindingSource).optional(),
        cveId: z.string().max(50).optional(),
        discoveryDate: z.date().optional(),
        technicalDetails: z.string().max(10000).optional(),
        // Story 4.7 (AC8-AC17): Impact calculation fields
        assetCriticality: z.nativeEnum(AssetCriticality).optional(),
        nextAuditDate: z.date().optional(),
        // Story 16.3: Controls documentation fields (legacy text fields)
        mitigatingControlsInPlace: z.string().max(10000).optional().nullable(),
        preventativeControlsInPlace: z.string().max(10000).optional().nullable(),
        mitigatingControlsNeeded: z.string().max(10000).optional().nullable(),
        preventativeControlsNeeded: z.string().max(10000).optional().nullable(),
        // Organizational control linkages (new picker-based approach)
        controlIdsInPlace: z.array(z.string()).optional(),
        controlIdsNeeded: z.array(z.string()).optional(),
        // Story 2.2: Risk Assessment Project - discovered risk linkage
        discoveryProjectId: z.string().min(1).optional(),
        // Spawned from a questionnaire question (links the identified risk back
        // to the source question in the assessment questionnaire).
        sourceRiskAssessmentQuestionId: z.string().optional().nullable(),
        // Enterprise Risk alignment (rollup parent)
        enterpriseRiskId: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Story 2.2: If discoveryProjectId provided, validate the assessment
      let assessmentSubject: string | null = null;
      if (input.discoveryProjectId) {
        const assessment = await ctx.db.riskAssessmentProject.findUnique({
          where: { id: input.discoveryProjectId },
          select: {
            id: true,
            organizationId: true,
            status: true,
            assigneeId: true,
            subject: true,
          },
        });

        if (!assessment) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Risk assessment project not found",
          });
        }

        if (assessment.organizationId !== ctx.organizationId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to this assessment",
          });
        }

        if (assessment.status !== AssessmentProjectStatus.IN_PROGRESS) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot add risks to an assessment that is not in progress",
          });
        }

        if (assessment.assigneeId !== ctx.session!.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only the assigned analyst can add risks to this assessment",
          });
        }

        assessmentSubject = assessment.subject;
      }

      // Story 4.2 (Task 5.2): If templateId provided, validate it exists and belongs to org
      let templateName: string | null = null;
      if (input.templateId) {
        const template = await ctx.db.riskTemplate.findUnique({
          where: { id: input.templateId },
          select: { id: true, name: true, organizationId: true },
        });

        if (!template) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Risk template not found",
          });
        }

        if (template.organizationId !== ctx.organizationId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to this template",
          });
        }

        templateName = template.name;
      }

      // Story 23.5 (review MJ-1): enterprise-risk alignment must stay inside
      // the caller's org (recomputeEnterpriseRiskScore writes to the target).
      if (input.enterpriseRiskId) {
        const er = await ctx.db.enterpriseRisk.findFirst({
          where: { id: input.enterpriseRiskId, organizationId: ctx.organizationId! },
          select: { id: true },
        });
        if (!er) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid enterprise risk - must be in same organization",
          });
        }
      }

      // Generate risk identifier (RISK-2026-0001 format)
      const identifier = await generateIdentifier(ctx.organizationId!, "RISK");

      // Manually-raised risks (no discoveryProjectId) route by the raiser's
      // authority: someone who can approve doesn't need a second signature, so
      // their risk opens straight away and is promoted to the register below.
      // An ANALYST's risk is submitted for review instead — it lands in the
      // reviewer queue (/risks/decisions) and only reaches the register once
      // `approveAssessment` clears it. Assessment-discovered risks keep their
      // existing behaviour: the project's own approval owns their promotion.
      const isManualRisk = !input.discoveryProjectId;
      const canSelfApprove = APPROVE_ROLES.includes(
        ctx.session!.user.role as UserRole,
      );
      const initialStatus: RiskStatus =
        isManualRisk && !canSelfApprove ? RiskStatus.PENDING_REVIEW : RiskStatus.OPEN;

      // Create risk with status OPEN (AC17)
      // Story 4.2 (Task 5.3): Associate with templateId if provided
      // Story 4.3 (AC18-AC22): Include finding context fields
      // Story 2.2: Include discoveryProjectId and discoveryStatus when from assessment
      const risk = await ctx.db.risk.create({
        data: {
          identifier,
          title: input.title,
          description: input.description,
          affectedSystems: input.affectedSystems ?? null,
          severity: input.severity,
          status: initialStatus,
          createdById: ctx.session!.user.id, // AC18
          organizationId: ctx.organizationId!, // AC19
          templateId: input.templateId ?? null, // Story 4.2 (Task 5.3)
          // Story 4.3 (AC18-AC22): Finding context fields
          findingSource: input.findingSource ?? null,
          cveId: input.cveId ?? null,
          discoveryDate: input.discoveryDate ?? null,
          technicalDetails: input.technicalDetails ?? null,
          // Story 4.7 (AC8-AC17): Impact calculation fields
          assetCriticality: input.assetCriticality ?? "MEDIUM", // AC11: Default to MEDIUM
          nextAuditDate: input.nextAuditDate ?? null,
          // Story 16.3: Controls documentation fields
          mitigatingControlsInPlace: input.mitigatingControlsInPlace ?? null,
          preventativeControlsInPlace: input.preventativeControlsInPlace ?? null,
          mitigatingControlsNeeded: input.mitigatingControlsNeeded ?? null,
          preventativeControlsNeeded: input.preventativeControlsNeeded ?? null,
          // Story 2.2: Link to assessment project with PENDING status
          discoveryProjectId: input.discoveryProjectId ?? null,
          discoveryStatus: input.discoveryProjectId
            ? RiskDiscoveryStatus.PENDING
            : null,
          // Link back to the source questionnaire question when spawned from one
          sourceRiskAssessmentQuestionId:
            input.sourceRiskAssessmentQuestionId ?? null,
          // Enterprise Risk alignment
          enterpriseRiskId: input.enterpriseRiskId ?? null,
        },
      });

      // An approver's own risk needs no second signature — put it in the
      // register now. The analyst path deliberately skips this: promotion
      // happens on approval instead.
      if (isManualRisk && canSelfApprove) {
        await promoteRiskToRegister(
          ctx.db,
          ctx.organizationId!,
          risk.id,
          ctx.session!.user.id,
        );
      }

      // Audit logging (AC24-AC25)
      // Story 4.2 (Task 5.4): Include template info in audit log
      // Story 4.3: Include finding context in audit log
      // Story 4.12: Actor snapshots for audit compliance (AC7, AC16)
      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: "CREATE_RISK",
        entityType: "Risk",
        entityId: risk.id,
        changes: {
          before: null,
          after: {
            identifier: risk.identifier,
            title: risk.title,
            severity: risk.severity,
            status: risk.status,
            affectedSystems: risk.affectedSystems,
            // Story 4.2: Include template usage in audit trail
            ...(input.templateId && {
              templateId: input.templateId,
              templateName: templateName,
            }),
            // Story 4.3: Include finding context in audit trail
            ...(input.findingSource && { findingSource: input.findingSource }),
            ...(input.cveId && { cveId: input.cveId }),
            ...(input.discoveryDate && { discoveryDate: input.discoveryDate }),
            ...(input.technicalDetails && { technicalDetails: "Updated" }), // Don't log full content
            // Story 2.2: Include assessment linkage in audit trail
            ...(input.discoveryProjectId && {
              discoveryProjectId: input.discoveryProjectId,
              assessmentSubject: assessmentSubject,
              discoveryStatus: RiskDiscoveryStatus.PENDING,
            }),
          },
        },
        // Story 4.12: Actor snapshots (AC7)
        actorName: ctx.session!.user.name ?? "Unknown",
        actorRole: ctx.session!.user.role,
      });

      // Story 4.7: Calculate initial impact score after risk creation
      void recalculateRiskImpact(risk.id, ctx.db);

      // Link organizational controls (picker-based approach)
      const controlLinks: Array<{
        riskId: string;
        organizationalControlId: string;
        organizationId: string;
        role: RiskOrgControlRole;
        createdById: string;
      }> = [];

      // Add controls in place
      if (input.controlIdsInPlace && input.controlIdsInPlace.length > 0) {
        for (const controlId of input.controlIdsInPlace) {
          controlLinks.push({
            riskId: risk.id,
            organizationalControlId: controlId,
            organizationId: ctx.organizationId!,
            role: RiskOrgControlRole.IN_PLACE,
            createdById: ctx.session!.user.id,
          });
        }
      }

      // Add controls needed
      if (input.controlIdsNeeded && input.controlIdsNeeded.length > 0) {
        for (const controlId of input.controlIdsNeeded) {
          controlLinks.push({
            riskId: risk.id,
            organizationalControlId: controlId,
            organizationId: ctx.organizationId!,
            role: RiskOrgControlRole.NEEDED,
            createdById: ctx.session!.user.id,
          });
        }
      }

      // Create all control links in one batch
      if (controlLinks.length > 0) {
        await ctx.db.riskOrganizationalControl.createMany({
          data: controlLinks,
          skipDuplicates: true,
        });
      }

      // Enterprise Risk: recompute parent score if aligned
      if (input.enterpriseRiskId) {
        await recomputeEnterpriseRiskScore(ctx.db, input.enterpriseRiskId);
      }

      return risk; // AC20
    }),

  /**
   * Link evidence to a risk (AC19-AC23)
   *
   * Creates a RiskEvidence junction record linking an evidence file to a risk.
   * Validates organization access and prevents duplicate links.
   */
  linkEvidenceToRisk: organizationProcedure
    .use(
      requireRole([
        ...LINK_EVIDENCE_ROLES,
        UserRole.BUSINESS_USER, // Can link remediation evidence to assigned risks (AC25)
      ])
    )
    .input(
      z.object({
        riskId: z.string().min(1, "Risk ID is required"),
        evidenceId: z.string().min(1, "Evidence ID is required"),
        linkType: z.nativeEnum(RiskEvidenceLinkType),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Fetch risk and evidence to validate access (AC20)
      const [risk, evidence] = await Promise.all([
        ctx.db.risk.findUnique({
          where: { id: input.riskId },
          select: { id: true, organizationId: true, title: true },
        }),
        ctx.db.evidence.findUnique({
          where: { id: input.evidenceId },
          select: { id: true, organizationId: true, title: true, isActive: true },
        }),
      ]);

      if (!risk) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Risk not found",
        });
      }

      if (!evidence) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Evidence not found",
        });
      }

      // Verify both belong to user's organization (AC20)
      if (risk.organizationId !== ctx.organizationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Risk does not belong to your organization",
        });
      }

      if (evidence.organizationId !== ctx.organizationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Evidence does not belong to your organization",
        });
      }

      // Check if evidence is active
      if (!evidence.isActive) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot link deleted evidence to a risk",
        });
      }

      // IT Stakeholder role check for remediation-only linking (AC25)
      if (ctx.session!.user.role === UserRole.BUSINESS_USER) {
        if (input.linkType !== RiskEvidenceLinkType.REMEDIATION) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "IT Stakeholders can only link remediation evidence",
          });
        }
        // TODO: Add check for risk assignment when risk assignment feature is implemented
        // For now, allow IT Stakeholders to link remediation evidence to any risk in their org
      }

      // Check for duplicate link (AC21)
      const existingLink = await ctx.db.riskEvidence.findUnique({
        where: {
          riskId_evidenceId: {
            riskId: input.riskId,
            evidenceId: input.evidenceId,
          },
        },
      });

      if (existingLink) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Evidence is already linked to this risk",
        });
      }

      // Create link
      const link = await ctx.db.riskEvidence.create({
        data: {
          id: randomUUID(),
          riskId: input.riskId,
          evidenceId: input.evidenceId,
          linkType: input.linkType,
          linkedById: ctx.session!.user.id,
        },
        include: {
          Evidence: {
            select: {
              id: true,
              title: true,
              originalFileName: true,
            },
          },
          Risk: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });

      // Audit log (AC23)
      // Story 4.12: Actor snapshots for audit compliance (AC7, AC19)
      void createAuditLog({
        organizationId: ctx.organizationId,
        userId: ctx.session!.user.id,
        action: "LINK_EVIDENCE_TO_RISK",
        entityType: "RiskEvidence",
        entityId: link.id,
        changes: {
          before: null,
          after: {
            riskId: input.riskId,
            riskTitle: risk.title,
            evidenceId: input.evidenceId,
            evidenceTitle: evidence.title,
            linkType: input.linkType,
          },
        },
        // Story 4.12: Actor snapshots (AC7)
        actorName: ctx.session!.user.name ?? "Unknown",
        actorRole: ctx.session!.user.role,
      });

      // Story 4.7 AC34: Recalculate impact score when evidence linked (frameworks affected may change)
      void recalculateRiskImpact(input.riskId, ctx.db);

      return link;
    }),

  /**
   * Unlink evidence from a risk (AC22)
   *
   * Removes the RiskEvidence junction record.
   */
  unlinkEvidenceFromRisk: organizationProcedure
    .use(requireRole(LINK_EVIDENCE_ROLES))
    .input(
      z.object({
        riskId: z.string().min(1, "Risk ID is required"),
        evidenceId: z.string().min(1, "Evidence ID is required"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Find the link
      const link = await ctx.db.riskEvidence.findUnique({
        where: {
          riskId_evidenceId: {
            riskId: input.riskId,
            evidenceId: input.evidenceId,
          },
        },
        include: {
          Risk: {
            select: {
              id: true,
              title: true,
              organizationId: true,
            },
          },
          Evidence: {
            select: {
              id: true,
              title: true,
              organizationId: true,
            },
          },
        },
      });

      if (!link) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Evidence link not found",
        });
      }

      // Verify organization access
      if (link.Risk.organizationId !== ctx.organizationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this resource",
        });
      }

      // Delete the link
      await ctx.db.riskEvidence.delete({
        where: {
          riskId_evidenceId: {
            riskId: input.riskId,
            evidenceId: input.evidenceId,
          },
        },
      });

      // Audit log (AC23)
      // Story 4.12: Actor snapshots for audit compliance (AC7)
      void createAuditLog({
        organizationId: ctx.organizationId,
        userId: ctx.session!.user.id,
        action: "UNLINK_EVIDENCE_FROM_RISK",
        entityType: "RiskEvidence",
        entityId: link.id,
        changes: {
          before: {
            riskId: input.riskId,
            riskTitle: link.Risk.title,
            evidenceId: input.evidenceId,
            evidenceTitle: link.Evidence.title,
            linkType: link.linkType,
          },
          after: null,
        },
        // Story 4.12: Actor snapshots (AC7)
        actorName: ctx.session!.user.name ?? "Unknown",
        actorRole: ctx.session!.user.role,
      });

      // Story 4.7 AC34: Recalculate impact score when evidence unlinked (frameworks affected may change)
      void recalculateRiskImpact(input.riskId, ctx.db);

      return { success: true };
    }),

  /**
   * Get evidence linked to a risk (AC7-AC9)
   *
   * Returns evidence grouped by link type (FINDING vs REMEDIATION).
   */
  getRiskEvidence: organizationProcedure
    .input(
      z.object({
        riskId: z.string().min(1, "Risk ID is required"),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify risk exists and user has access
      const risk = await ctx.db.risk.findUnique({
        where: { id: input.riskId },
        select: { id: true, organizationId: true },
      });

      if (!risk) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Risk not found",
        });
      }

      if (risk.organizationId !== ctx.organizationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this risk",
        });
      }

      // Fetch all linked evidence
      const links = await ctx.db.riskEvidence.findMany({
        where: { riskId: input.riskId },
        include: {
          Evidence: {
            select: {
              id: true,
              title: true,
              originalFileName: true,
              fileSize: true,
              fileType: true,
              createdAt: true,
              isActive: true,
            },
          },
          LinkedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { linkedAt: "desc" },
      });

      // Group by link type (AC8)
      const findingEvidence = links
        .filter((l) => l.linkType === RiskEvidenceLinkType.FINDING)
        .map((l) => ({
          id: l.Evidence.id,
          title: l.Evidence.title,
          originalFileName: l.Evidence.originalFileName,
          fileSize: l.Evidence.fileSize,
          fileType: l.Evidence.fileType,
          uploadedAt: l.Evidence.createdAt,
          linkedAt: l.linkedAt,
          linkedBy: l.LinkedBy,
          linkType: l.linkType,
          isActive: l.Evidence.isActive,
        }));

      const remediationEvidence = links
        .filter((l) => l.linkType === RiskEvidenceLinkType.REMEDIATION)
        .map((l) => ({
          id: l.Evidence.id,
          title: l.Evidence.title,
          originalFileName: l.Evidence.originalFileName,
          fileSize: l.Evidence.fileSize,
          fileType: l.Evidence.fileType,
          uploadedAt: l.Evidence.createdAt,
          linkedAt: l.linkedAt,
          linkedBy: l.LinkedBy,
          linkType: l.linkType,
          isActive: l.Evidence.isActive,
        }));

      return {
        findingEvidence,
        remediationEvidence,
        totalCount: links.length,
      };
    }),

  /**
   * Lightweight risk list for link pickers (Story 20.1 follow-up — the
   * finding form links findings to register risks at creation). Mirrors
   * enterpriseRisk.listForPicker.
   */
  listForPicker: organizationProcedure.query(async ({ ctx }) => {
    return ctx.db.risk.findMany({
      where: { organizationId: ctx.organizationId! },
      orderBy: { createdAt: "desc" },
      select: { id: true, identifier: true, title: true, severity: true },
    });
  }),

  /**
   * List risks with role-based filtering
   *
   * Story 4.9: Role-Based Risk Views (AC23-AC28)
   * - All roles: See all org risks (filtered by organizationId)
   * - GRC_ANALYST, SECURITY_ENGINEER, ORG_ADMIN, AUDITOR, IT_STAKEHOLDER, BUSINESS_STAKEHOLDER: See all org risks
   *
   * Returns risks for the user's organization with role-based filtering.
   */
  list: organizationProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
        search: z.string().optional(),
        // Story 5.5 AC7-AC9: Multi-select severity filter (OR within filter)
        severity: z.array(z.enum(["HIGH", "MEDIUM", "LOW"])).optional(),
        // Story 5.5 AC10-AC12: Multi-select status filter (OR within filter)
        status: z.array(z.enum(["DRAFT", "PENDING_REVIEW", "OPEN", "ASSIGNED", "REMEDIATED", "CLOSED"])).optional(),
        // Story 5.5 AC13-AC15: Framework filter
        frameworkId: z.string().optional(),
        // Story 5.5 AC2: Multi-select finding source filter
        findingSource: z.array(z.enum([
          "VULNERABILITY_SCAN",
          "PENETRATION_TEST",
          "AUDIT_FINDING",
          "SECURITY_REVIEW",
          "COMPLIANCE_ASSESSMENT",
          "OTHER",
        ])).optional(),
        // Story 4.7 AC25: Support sorting by impact score
        sortBy: z.enum(["impactScore", "severity", "createdAt", "assignedAt"]).default("impactScore"),
        sortOrder: z.enum(["asc", "desc"]).default("desc"),
        // Story 4.9 AC16: Filter by specific owner
        ownerId: z.string().optional(),
        ownerType: z.enum(["it", "business"]).optional(),
        // Story 5.5 AC16-AC18: Separate IT and Business owner filters
        itOwnerId: z.string().optional(),
        businessOwnerId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { page, pageSize, search, status, severity, sortBy, sortOrder, ownerId, ownerType, frameworkId, findingSource, itOwnerId: inputItOwnerId, businessOwnerId: inputBusinessOwnerId } = input;
      const skip = (page - 1) * pageSize;

      // Base where clause with organization filter
      // Story 5.5 AC23-AC26: Build dynamic WHERE clause based on filters
      // Story 6.4: Filter to only show PUBLISHED or directly-created risks
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {
        organizationId: ctx.organizationId,
        // Story 6.4: Only show risks that are:
        // - Published (from approved assessments)
        // - OR created directly (no discoveryStatus)
        AND: [
          {
            OR: [
              { discoveryStatus: "PUBLISHED" },
              { discoveryStatus: null },
            ],
          },
        ],
      };

      // All roles see all org risks filtered by organizationId
      // No additional owner-based scoping - organizationId is already set

      // AC16: Optional filter by specific owner (for full view users) - legacy support
      if (ownerId && ownerType) {
        if (ownerType === "it") {
          where.itOwnerId = ownerId;
        } else if (ownerType === "business") {
          where.businessOwnerId = ownerId;
        }
      }

      // Story 5.5 AC16-AC18: Separate IT and Business owner filters
      if (inputItOwnerId) {
        where.itOwnerId = inputItOwnerId === "unassigned" ? null : inputItOwnerId;
      }
      if (inputBusinessOwnerId) {
        where.businessOwnerId = inputBusinessOwnerId === "unassigned" ? null : inputBusinessOwnerId;
      }

      // Search filter - push to AND array to combine with discoveryStatus filter
      if (search) {
        where.AND.push({
          OR: [
            { identifier: { contains: search, mode: "insensitive" as const } },
            { title: { contains: search, mode: "insensitive" as const } },
            { description: { contains: search, mode: "insensitive" as const } },
          ],
        });
      }

      // Story 5.5 AC7-AC9: Multi-select severity filter (OR within filter, AND with other filters)
      if (severity && severity.length > 0) {
        where.severity = { in: severity };
      }

      // Story 5.5 AC10-AC12: Multi-select status filter (OR within filter, AND with other filters)
      if (status && status.length > 0) {
        where.status = { in: status };
      }

      // Story 5.5 AC2: Multi-select finding source filter
      if (findingSource && findingSource.length > 0) {
        where.findingSource = { in: findingSource };
      }

      // Story 5.5 AC13-AC15: Framework filter - risks with evidence linked to framework controls
      if (frameworkId) {
        if (frameworkId === "none") {
          // AC15: "No Framework" option - risks without framework-mapped evidence
          where.NOT = {
            RiskEvidence: {
              some: {
                Evidence: {
                  ControlDomains: {
                    some: {},
                  },
                },
              },
            },
          };
        } else {
          // AC14: Filter by specific framework
          where.RiskEvidence = {
            some: {
              Evidence: {
                ControlDomains: {
                  some: {
                    ControlDomain: {
                      ControlDomainMappings: {
                        some: {
                          Control: {
                            frameworkId: frameworkId,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          };
        }
      }

      // Story 4.7 AC25 + Story 4.9 AC5: Build orderBy based on sortBy parameter
      const orderBy = sortBy === "impactScore"
        ? [{ impactScore: sortOrder }, { createdAt: "desc" as const }]
        : sortBy === "severity"
          ? [{ severity: sortOrder }, { createdAt: "desc" as const }]
          : sortBy === "assignedAt"
            ? [{ assignedAt: sortOrder }, { createdAt: "desc" as const }]
            : [{ createdAt: sortOrder }];

      // AC26-AC28: Query with pagination and return total
      const [risks, total] = await Promise.all([
        ctx.db.risk.findMany({
          where,
          select: {
            // Core fields
            id: true,
            identifier: true,
            title: true,
            description: true,
            affectedSystems: true,
            severity: true,
            status: true,
            // Date fields
            createdAt: true,
            updatedAt: true,
            discoveryDate: true,
            assignedAt: true,
            nextAuditDate: true,
            assessmentDueDate: true,
            // Scoring fields
            impactScore: true,
            assetCriticality: true,
            inherentScore: true,
            inherentScoreLabel: true,
            residualScore: true,
            residualScoreLabel: true,
            // Story 22.4: derived scoring — register reads effective
            effectiveScore: true,
            effectiveScoreLabel: true,
            effectiveScoreSource: true,
            // Source fields
            findingSource: true,
            cveId: true,
            technicalDetails: true,
            // Business impact
            businessImpactStatement: true,
            businessUnitId: true,
            // Owner IDs for filter verification
            itOwnerId: true,
            businessOwnerId: true,
            // Owner info for display
            ITOwner: {
              select: { id: true, name: true, email: true },
            },
            BusinessOwner: {
              select: { id: true, name: true, email: true },
            },
            // Assessor info
            Assessor: {
              select: { id: true, name: true, email: true },
            },
            // Remediation options count
            RemediationOptions: {
              select: { id: true },
            },
          },
          orderBy,
          skip,
          take: pageSize,
        }),
        ctx.db.risk.count({ where }),
      ]);

      // Transform to include counts
      const transformedRisks = risks.map((risk) => ({
        ...risk,
        remediationOptionsCount: risk.RemediationOptions.length,
        RemediationOptions: undefined, // Remove the raw array
      }));

      return {
        risks: transformedRisks,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    }),

  /**
   * Get filter counts for the risk list
   *
   * Story 5.5: Risk Filtering UI (AC12)
   * - Returns count of risks by status for filter UI
   * - Returns count of risks by severity for filter UI
   * - Respects role-based access (IT/Business stakeholders see only their risks)
   */
  getFilterCounts: organizationProcedure.query(async ({ ctx }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const baseWhere: any = {
      organizationId: ctx.organizationId,
    };

    // Get counts by status
    const statusCounts = await ctx.db.risk.groupBy({
      by: ["status"],
      where: baseWhere,
      _count: { status: true },
    });

    // Get counts by severity
    const severityCounts = await ctx.db.risk.groupBy({
      by: ["severity"],
      where: baseWhere,
      _count: { severity: true },
    });

    // Get counts by finding source
    const findingSourceCounts = await ctx.db.risk.groupBy({
      by: ["findingSource"],
      where: baseWhere,
      _count: { findingSource: true },
    });

    return {
      byStatus: {
        DRAFT: statusCounts.find((s) => s.status === "DRAFT")?._count.status ?? 0,
        PENDING_REVIEW: statusCounts.find((s) => s.status === "PENDING_REVIEW")?._count.status ?? 0,
        OPEN: statusCounts.find((s) => s.status === "OPEN")?._count.status ?? 0,
        ASSIGNED: statusCounts.find((s) => s.status === "ASSIGNED")?._count.status ?? 0,
        REMEDIATED: statusCounts.find((s) => s.status === "REMEDIATED")?._count.status ?? 0,
        CLOSED: statusCounts.find((s) => s.status === "CLOSED")?._count.status ?? 0,
      },
      bySeverity: {
        HIGH: severityCounts.find((s) => s.severity === "HIGH")?._count.severity ?? 0,
        MEDIUM: severityCounts.find((s) => s.severity === "MEDIUM")?._count.severity ?? 0,
        LOW: severityCounts.find((s) => s.severity === "LOW")?._count.severity ?? 0,
      },
      byFindingSource: {
        VULNERABILITY_SCAN: findingSourceCounts.find((s) => s.findingSource === "VULNERABILITY_SCAN")?._count.findingSource ?? 0,
        PENETRATION_TEST: findingSourceCounts.find((s) => s.findingSource === "PENETRATION_TEST")?._count.findingSource ?? 0,
        AUDIT_FINDING: findingSourceCounts.find((s) => s.findingSource === "AUDIT_FINDING")?._count.findingSource ?? 0,
        SECURITY_REVIEW: findingSourceCounts.find((s) => s.findingSource === "SECURITY_REVIEW")?._count.findingSource ?? 0,
        COMPLIANCE_ASSESSMENT: findingSourceCounts.find((s) => s.findingSource === "COMPLIANCE_ASSESSMENT")?._count.findingSource ?? 0,
        OTHER: findingSourceCounts.find((s) => s.findingSource === "OTHER")?._count.findingSource ?? 0,
      },
    };
  }),

  /**
   * Get risk by ID
   * Story 4.3: Includes all finding context fields (AC23-AC27)
   * Story 4.6: Includes owner relations (Task 7)
   */
  getById: organizationProcedure
    .input(
      z.object({
        id: z.string().min(1, "Risk ID is required"),
      })
    )
    .query(async ({ ctx, input }) => {
      const risk = await ctx.db.risk.findUnique({
        where: { id: input.id },
        include: {
          RiskEvidence: {
            include: {
              Evidence: {
                select: {
                  id: true,
                  title: true,
                  originalFileName: true,
                  fileType: true,
                  fileSize: true,
                  // Story 4.17 AC55: Include path to get framework codes
                  EvidenceControlDomain: {
                    select: {
                      ControlDomain: {
                        select: {
                          ControlDomainMapping: {
                            select: {
                              frameworkCode: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          CreatedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          Template: {
            select: {
              id: true,
              name: true,
              category: true,
            },
          },
          // Story 4.6: Include owner relations (Task 7.1-7.3)
          ITOwner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          BusinessOwner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          AssignedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          // Story 4.10: Verification relation (AC38-AC40)
          RemediationVerifiedBy: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          // Story 4.17: Include remediation options for tab counts
          RemediationOptions: {
            select: {
              id: true,
              title: true,
              priority: true,
            },
            orderBy: { priority: "asc" },
          },
          // Story 4.17: Include comments for tab counts
          Comments: {
            where: { deletedAt: null },
            select: {
              id: true,
            },
          },
          // Assessment origin ("Identified in") — resolved by resolveRiskOrigin.
          // Intentionally omits `Assessment` (RiskAssessment): that FK is never
          // populated on create and has no page route.
          DiscoveryProject: {
            select: { id: true, subject: true },
          },
          sourceComplianceAssessment: {
            select: { id: true, identifier: true, name: true },
          },
          VendorAssessment: {
            select: { id: true, identifier: true, title: true },
          },
          SourceRiskAssessmentQuestion: {
            select: { id: true, number: true, text: true },
          },
        },
      });

      if (!risk) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Risk not found",
        });
      }

      if (risk.organizationId !== ctx.organizationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this risk",
        });
      }

      // All roles in the organization can access any org risk
      // Organization check above is sufficient for access control

      // Story 4.17 AC55: Extract unique framework codes and fetch framework names
      const frameworkCodes = new Set<string>();
      risk.RiskEvidence?.forEach((re) => {
        re.Evidence?.EvidenceControlDomain?.forEach((ecd) => {
          ecd.ControlDomain?.ControlDomainMapping?.forEach((cdm) => {
            if (cdm.frameworkCode) {
              frameworkCodes.add(cdm.frameworkCode);
            }
          });
        });
      });

      // Fetch framework details for the unique codes
      const frameworks = frameworkCodes.size > 0
        ? await ctx.db.framework.findMany({
            where: {
              organizationId: ctx.organizationId!,
              code: { in: Array.from(frameworkCodes) },
              isActive: true,
            },
            select: {
              code: true,
              name: true,
            },
          })
        : [];

      return {
        ...risk,
        // Add frameworks affected for AC55
        frameworksAffected: frameworks,
      };
    }),

  /**
   * Story 4.2: List all risk templates for the organization (AC27, AC29, AC30)
   *
   * Returns all templates available to the user's organization,
   * ordered by category alphabetically.
   */
  listRiskTemplates: organizationProcedure.query(async ({ ctx }) => {
    // AC29: Filter by organizationId (multi-tenancy)
    // AC30: Order by category alphabetical
    const templates = await ctx.db.riskTemplate.findMany({
      where: {
        organizationId: ctx.organizationId!,
      },
      orderBy: {
        category: "asc",
      },
      select: {
        id: true,
        name: true,
        category: true,
        description: true,
        prePopulatedDomains: true,
        evidenceGuidance: true,
        severityDefault: true,
        affectedSystemsGuidance: true,
        createdAt: true,
      },
    });

    return templates;
  }),

  /**
   * Story 4.2: Get a single risk template by ID (AC28)
   *
   * Returns template with all fields including evidenceGuidance.
   * Validates organization access for multi-tenancy.
   */
  getRiskTemplateById: organizationProcedure
    .input(
      z.object({
        id: z.string().min(1, "Template ID is required"),
      })
    )
    .query(async ({ ctx, input }) => {
      const template = await ctx.db.riskTemplate.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          name: true,
          category: true,
          description: true,
          prePopulatedDomains: true,
          evidenceGuidance: true,
          severityDefault: true,
          affectedSystemsGuidance: true,
          organizationId: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Risk template not found",
        });
      }

      // AC29: Verify organization access (multi-tenancy)
      if (template.organizationId !== ctx.organizationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this template",
        });
      }

      return template;
    }),

  /**
   * Story 4.3: Update risk finding fields (AC28-AC32)
   *
   * Updates a risk record with new finding information.
   * Only SECURITY_ENGINEER, GRC_ANALYST, and ORG_ADMIN can update risks.
   *
   * AC28: updateRisk mutation accepts all finding fields
   * AC29: Mutation validates user has permission
   * AC30: Mutation validates risk belongs to user's organization
   * AC31: Mutation logs changes to audit trail (field-level tracking)
   * AC32: Mutation returns updated risk with timestamps
   */
  updateRisk: organizationProcedure
    .use(requireRole(RISK_UPDATE_ROLES))
    .input(
      z.object({
        riskId: z.string().min(1, "Risk ID is required"),
        // All fields are optional - only update what's provided
        title: z.string().min(1).max(200).optional(),
        description: z.string().min(1).max(10000).optional(),
        affectedSystems: z.string().optional().nullable(),
        severity: z.nativeEnum(Severity).optional(),
        findingSource: z.nativeEnum(RiskFindingSource).optional().nullable(),
        cveId: z.string().max(50).optional().nullable(),
        discoveryDate: z.date().optional().nullable(),
        technicalDetails: z.string().max(10000).optional().nullable(),
        // Story 4.7: Impact calculation fields
        assetCriticality: z.nativeEnum(AssetCriticality).optional().nullable(),
        nextAuditDate: z.date().optional().nullable(),
        // Story 16.3: Controls documentation fields
        mitigatingControlsInPlace: z.string().max(10000).optional().nullable(),
        preventativeControlsInPlace: z.string().max(10000).optional().nullable(),
        mitigatingControlsNeeded: z.string().max(10000).optional().nullable(),
        preventativeControlsNeeded: z.string().max(10000).optional().nullable(),
        // Enterprise Risk alignment
        enterpriseRiskId: z.string().optional().nullable(),
        // Acceptance PROPOSAL fields (creator-authored documentation).
        // Story 23.5 (review CR-2): the decision markers acceptedById /
        // acceptedAt were removed from this input — an acceptance decision
        // can only be minted via risk.createTreatment (TreatmentDecision
        // ACCEPT), which enforces segregation of duties.
        acceptanceJustification: z.string().max(10000).optional().nullable(),
        acceptanceReviewDate: z.date().optional().nullable(),
        acceptanceCompensatingControls: z.string().max(10000).optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { riskId, ...updateFields } = input;

      // Fetch existing risk to validate access and track changes (AC30)
      const existingRisk = await ctx.db.risk.findUnique({
        where: { id: riskId },
        select: {
          id: true,
          organizationId: true,
          title: true,
          description: true,
          affectedSystems: true,
          severity: true,
          findingSource: true,
          cveId: true,
          discoveryDate: true,
          technicalDetails: true,
          // Story 4.7: Impact calculation fields
          assetCriticality: true,
          nextAuditDate: true,
          // Story 16.3: Controls documentation fields
          mitigatingControlsInPlace: true,
          preventativeControlsInPlace: true,
          mitigatingControlsNeeded: true,
          preventativeControlsNeeded: true,
          // Enterprise Risk alignment
          enterpriseRiskId: true,
        },
      });

      if (!existingRisk) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Risk not found",
        });
      }

      // Verify organization access (AC30)
      if (existingRisk.organizationId !== ctx.organizationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this risk",
        });
      }

      // Build update data - only include fields that were provided
      const updateData: Record<string, unknown> = {};
      const changes: Record<string, { old: unknown; new: unknown }> = {};

      // Track changes for each field (AC31)
      if (updateFields.title !== undefined && updateFields.title !== existingRisk.title) {
        updateData.title = updateFields.title;
        changes.title = { old: existingRisk.title, new: updateFields.title };
      }

      if (updateFields.description !== undefined && updateFields.description !== existingRisk.description) {
        updateData.description = updateFields.description;
        changes.description = { old: "Updated", new: "Updated" }; // Don't log full content
      }

      if (updateFields.affectedSystems !== undefined && updateFields.affectedSystems !== existingRisk.affectedSystems) {
        updateData.affectedSystems = updateFields.affectedSystems;
        changes.affectedSystems = { old: existingRisk.affectedSystems, new: updateFields.affectedSystems };
      }

      if (updateFields.severity !== undefined && updateFields.severity !== existingRisk.severity) {
        updateData.severity = updateFields.severity;
        changes.severity = { old: existingRisk.severity, new: updateFields.severity };
      }

      if (updateFields.findingSource !== undefined && updateFields.findingSource !== existingRisk.findingSource) {
        updateData.findingSource = updateFields.findingSource;
        changes.findingSource = { old: existingRisk.findingSource, new: updateFields.findingSource };
      }

      if (updateFields.cveId !== undefined && updateFields.cveId !== existingRisk.cveId) {
        updateData.cveId = updateFields.cveId;
        changes.cveId = { old: existingRisk.cveId, new: updateFields.cveId };
      }

      if (updateFields.discoveryDate !== undefined) {
        const existingDate = existingRisk.discoveryDate?.toISOString();
        const newDate = updateFields.discoveryDate?.toISOString();
        if (existingDate !== newDate) {
          updateData.discoveryDate = updateFields.discoveryDate;
          changes.discoveryDate = { old: existingDate, new: newDate };
        }
      }

      if (updateFields.technicalDetails !== undefined && updateFields.technicalDetails !== existingRisk.technicalDetails) {
        updateData.technicalDetails = updateFields.technicalDetails;
        changes.technicalDetails = { old: "Updated", new: "Updated" }; // Don't log full content
      }

      // Story 4.7: Track assetCriticality changes (AC32)
      if (updateFields.assetCriticality !== undefined && updateFields.assetCriticality !== existingRisk.assetCriticality) {
        updateData.assetCriticality = updateFields.assetCriticality;
        changes.assetCriticality = { old: existingRisk.assetCriticality, new: updateFields.assetCriticality };
      }

      // Story 4.7: Track nextAuditDate changes (AC33)
      if (updateFields.nextAuditDate !== undefined) {
        const existingAuditDate = existingRisk.nextAuditDate?.toISOString();
        const newAuditDate = updateFields.nextAuditDate?.toISOString();
        if (existingAuditDate !== newAuditDate) {
          updateData.nextAuditDate = updateFields.nextAuditDate;
          changes.nextAuditDate = { old: existingAuditDate, new: newAuditDate };
        }
      }

      // Story 16.3: Track controls documentation changes
      if (updateFields.mitigatingControlsInPlace !== undefined && updateFields.mitigatingControlsInPlace !== existingRisk.mitigatingControlsInPlace) {
        updateData.mitigatingControlsInPlace = updateFields.mitigatingControlsInPlace;
        changes.mitigatingControlsInPlace = { old: "Updated", new: "Updated" }; // Don't log full content
      }

      if (updateFields.preventativeControlsInPlace !== undefined && updateFields.preventativeControlsInPlace !== existingRisk.preventativeControlsInPlace) {
        updateData.preventativeControlsInPlace = updateFields.preventativeControlsInPlace;
        changes.preventativeControlsInPlace = { old: "Updated", new: "Updated" }; // Don't log full content
      }

      if (updateFields.mitigatingControlsNeeded !== undefined && updateFields.mitigatingControlsNeeded !== existingRisk.mitigatingControlsNeeded) {
        updateData.mitigatingControlsNeeded = updateFields.mitigatingControlsNeeded;
        changes.mitigatingControlsNeeded = { old: "Updated", new: "Updated" }; // Don't log full content
      }

      if (updateFields.preventativeControlsNeeded !== undefined && updateFields.preventativeControlsNeeded !== existingRisk.preventativeControlsNeeded) {
        updateData.preventativeControlsNeeded = updateFields.preventativeControlsNeeded;
        changes.preventativeControlsNeeded = { old: "Updated", new: "Updated" }; // Don't log full content
      }

      // Enterprise Risk alignment change tracking
      if (updateFields.enterpriseRiskId !== undefined && updateFields.enterpriseRiskId !== existingRisk.enterpriseRiskId) {
        // Story 23.5 (review MJ-1): the new parent must be in the same org.
        if (updateFields.enterpriseRiskId) {
          const er = await ctx.db.enterpriseRisk.findFirst({
            where: { id: updateFields.enterpriseRiskId, organizationId: existingRisk.organizationId },
            select: { id: true },
          });
          if (!er) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Invalid enterprise risk - must be in same organization",
            });
          }
        }
        updateData.enterpriseRiskId = updateFields.enterpriseRiskId;
        changes.enterpriseRiskId = { old: existingRisk.enterpriseRiskId, new: updateFields.enterpriseRiskId };
      }

      // Acceptance proposal fields (documentation only — never the decision;
      // see the input-schema note above).
      if (updateFields.acceptanceJustification !== undefined) {
        updateData.acceptanceJustification = updateFields.acceptanceJustification;
      }
      if (updateFields.acceptanceReviewDate !== undefined) {
        updateData.acceptanceReviewDate = updateFields.acceptanceReviewDate;
      }
      if (updateFields.acceptanceCompensatingControls !== undefined) {
        updateData.acceptanceCompensatingControls = updateFields.acceptanceCompensatingControls;
      }

      // Only update if there are actual changes
      if (Object.keys(updateData).length === 0) {
        return existingRisk;
      }

      // Update the risk (AC32: returns updated risk)
      const updatedRisk = await ctx.db.risk.update({
        where: { id: riskId },
        data: updateData,
      });

      // Enterprise Risk: recompute parents if alignment changed
      if (changes.enterpriseRiskId) {
        const oldParent = changes.enterpriseRiskId.old as string | null;
        const newParent = changes.enterpriseRiskId.new as string | null;
        if (oldParent) await recomputeEnterpriseRiskScore(ctx.db, oldParent);
        if (newParent) await recomputeEnterpriseRiskScore(ctx.db, newParent);
      }

      // Story 4.7 AC31-AC33: Recalculate impact score if severity, criticality, or audit date changed
      if (changes.severity || changes.assetCriticality || changes.nextAuditDate) {
        void recalculateRiskImpact(riskId, ctx.db);
      }

      // Audit logging (AC31)
      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: "UPDATE_RISK",
        entityType: "Risk",
        entityId: riskId,
        changes: {
          before: Object.fromEntries(
            Object.entries(changes).map(([key, value]) => [key, value.old])
          ),
          after: Object.fromEntries(
            Object.entries(changes).map(([key, value]) => [key, value.new])
          ),
        },
      });

      return updatedRisk;
    }),

  // ===============================================
  // Story 4.5: Remediation Options Management
  // ===============================================

  /**
   * Add a remediation option to a risk (AC8-AC13)
   *
   * Creates a new RemediationOption record for a risk.
   * Only GRC_ANALYST, SECURITY_ENGINEER, and ORG_ADMIN can add options.
   *
   * AC8: Mutation accepts: riskId, title, description, approach, costEstimate, timelineEstimate, effortLevel, priority
   * AC9: Validates user role
   * AC10: Validates risk belongs to user's organization
   * AC11: Creates RemediationOption with createdById from session
   * AC12: Logs option addition to audit trail
   * AC13: Returns created option with ID
   */
  addRemediationOption: organizationProcedure
    .use(requireRole(REMEDIATION_OPTION_ROLES))
    .input(
      z.object({
        riskId: z.string().min(1, "Risk ID is required"),
        title: z.string().min(3, "Title must be at least 3 characters").max(200, "Title must be at most 200 characters"),
        description: z.string().min(10, "Description must be at least 10 characters").max(5000, "Description must be at most 5000 characters"),
        approach: z.string().min(10, "Approach must be at least 10 characters").max(5000, "Approach must be at most 5000 characters"),
        costEstimate: z.number().min(0, "Cost estimate must be non-negative").max(9999999999.99, "Cost estimate exceeds maximum"),
        timelineEstimate: z.string().min(1, "Timeline estimate is required").max(100, "Timeline estimate must be at most 100 characters"),
        effortLevel: z.nativeEnum(EffortLevel),
        priority: z.nativeEnum(RemediationPriority),
        ownerId: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // AC10: Validate risk exists and belongs to organization
      const risk = await ctx.db.risk.findUnique({
        where: { id: input.riskId },
        select: { id: true, organizationId: true, title: true },
      });

      if (!risk) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Risk not found",
        });
      }

      if (risk.organizationId !== ctx.organizationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Risk does not belong to your organization",
        });
      }

      // AC11: Create RemediationOption with createdById from session
      const option = await ctx.db.remediationOption.create({
        data: {
          riskId: input.riskId,
          title: input.title,
          description: input.description,
          approach: input.approach,
          costEstimate: input.costEstimate,
          timelineEstimate: input.timelineEstimate,
          effortLevel: input.effortLevel,
          priority: input.priority,
          ownerId: input.ownerId ?? null,
          createdById: ctx.session!.user.id,
          organizationId: ctx.organizationId!,
        },
        include: {
          CreatedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      // AC12: Log to audit trail
      // Story 4.12: Actor snapshots for audit compliance (AC7, AC20)
      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: "ADD_REMEDIATION_OPTION",
        entityType: "RemediationOption",
        entityId: option.id,
        changes: {
          before: null,
          after: {
            riskId: input.riskId,
            riskTitle: risk.title,
            title: input.title,
            costEstimate: input.costEstimate,
            effortLevel: input.effortLevel,
            priority: input.priority,
          },
        },
        // Story 4.12: Actor snapshots (AC7)
        actorName: ctx.session!.user.name ?? "Unknown",
        actorRole: ctx.session!.user.role,
      });

      // AC13: Return created option
      return option;
    }),

  /**
   * Update a remediation option (AC14-AC18)
   *
   * Updates an existing RemediationOption record.
   * Only GRC_ANALYST, SECURITY_ENGINEER, and ORG_ADMIN can update options.
   *
   * AC14: Mutation accepts: optionId and optional fields
   * AC15: Validates user role
   * AC16: Validates option belongs to user's organization
   * AC17: Logs changes to audit trail
   * AC18: Returns updated option
   */
  updateRemediationOption: organizationProcedure
    .use(requireRole(REMEDIATION_OPTION_ROLES))
    .input(
      z.object({
        optionId: z.string().min(1, "Option ID is required"),
        title: z.string().min(3).max(200).optional(),
        description: z.string().min(10).max(5000).optional(),
        approach: z.string().min(10).max(5000).optional(),
        costEstimate: z.number().min(0).max(9999999999.99).optional(),
        timelineEstimate: z.string().min(1).max(100).optional(),
        effortLevel: z.nativeEnum(EffortLevel).optional(),
        priority: z.nativeEnum(RemediationPriority).optional(),
        ownerId: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { optionId, ...updateFields } = input;

      // Fetch existing option to validate access and track changes
      const existingOption = await ctx.db.remediationOption.findUnique({
        where: { id: optionId },
        include: {
          Risk: {
            select: { id: true, title: true },
          },
        },
      });

      if (!existingOption) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Remediation option not found",
        });
      }

      // AC16: Verify organization access
      if (existingOption.organizationId !== ctx.organizationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this remediation option",
        });
      }

      // Build update data and track changes
      const updateData: Record<string, unknown> = {};
      const changes: Record<string, { old: unknown; new: unknown }> = {};

      if (updateFields.title !== undefined && updateFields.title !== existingOption.title) {
        updateData.title = updateFields.title;
        changes.title = { old: existingOption.title, new: updateFields.title };
      }

      if (updateFields.description !== undefined && updateFields.description !== existingOption.description) {
        updateData.description = updateFields.description;
        changes.description = { old: "Updated", new: "Updated" };
      }

      if (updateFields.approach !== undefined && updateFields.approach !== existingOption.approach) {
        updateData.approach = updateFields.approach;
        changes.approach = { old: "Updated", new: "Updated" };
      }

      if (updateFields.costEstimate !== undefined) {
        const existingCost = Number(existingOption.costEstimate);
        if (updateFields.costEstimate !== existingCost) {
          updateData.costEstimate = updateFields.costEstimate;
          changes.costEstimate = { old: existingCost, new: updateFields.costEstimate };
        }
      }

      if (updateFields.timelineEstimate !== undefined && updateFields.timelineEstimate !== existingOption.timelineEstimate) {
        updateData.timelineEstimate = updateFields.timelineEstimate;
        changes.timelineEstimate = { old: existingOption.timelineEstimate, new: updateFields.timelineEstimate };
      }

      if (updateFields.effortLevel !== undefined && updateFields.effortLevel !== existingOption.effortLevel) {
        updateData.effortLevel = updateFields.effortLevel;
        changes.effortLevel = { old: existingOption.effortLevel, new: updateFields.effortLevel };
      }

      if (updateFields.priority !== undefined && updateFields.priority !== existingOption.priority) {
        updateData.priority = updateFields.priority;
        changes.priority = { old: existingOption.priority, new: updateFields.priority };
      }

      if (updateFields.ownerId !== undefined && updateFields.ownerId !== existingOption.ownerId) {
        updateData.ownerId = updateFields.ownerId;
        changes.ownerId = { old: existingOption.ownerId, new: updateFields.ownerId };
      }

      // Only update if there are actual changes
      if (Object.keys(updateData).length === 0) {
        return existingOption;
      }

      // Update the option
      const updatedOption = await ctx.db.remediationOption.update({
        where: { id: optionId },
        data: updateData,
        include: {
          CreatedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      // AC17: Log to audit trail
      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: "UPDATE_REMEDIATION_OPTION",
        entityType: "RemediationOption",
        entityId: optionId,
        changes: {
          before: Object.fromEntries(
            Object.entries(changes).map(([key, value]) => [key, value.old])
          ),
          after: Object.fromEntries(
            Object.entries(changes).map(([key, value]) => [key, value.new])
          ),
        },
      });

      // AC18: Return updated option
      return updatedOption;
    }),

  /**
   * Delete a remediation option (AC19-AC22)
   *
   * Deletes a RemediationOption record.
   * Only GRC_ANALYST and ORG_ADMIN can delete options.
   *
   * AC19: Mutation accepts: optionId
   * AC20: Validates user role (GRC_ANALYST, ORG_ADMIN only)
   * AC21: Soft delete if selected, hard delete if not
   * AC22: Logs deletion to audit trail
   */
  deleteRemediationOption: organizationProcedure
    .use(requireRole(REMEDIATION_OPTION_DELETE_ROLES))
    .input(
      z.object({
        optionId: z.string().min(1, "Option ID is required"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Fetch existing option to validate access
      const existingOption = await ctx.db.remediationOption.findUnique({
        where: { id: input.optionId },
        include: {
          Risk: {
            select: { id: true, title: true },
          },
        },
      });

      if (!existingOption) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Remediation option not found",
        });
      }

      // Verify organization access
      if (existingOption.organizationId !== ctx.organizationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this remediation option",
        });
      }

      // AC21: Hard delete the option
      // (Selected options are preserved in audit trail for history)
      await ctx.db.remediationOption.delete({
        where: { id: input.optionId },
      });

      // AC22: Log to audit trail
      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: "DELETE_REMEDIATION_OPTION",
        entityType: "RemediationOption",
        entityId: input.optionId,
        changes: {
          before: {
            riskId: existingOption.riskId,
            // Risk is null for finding-attached options (Story 20.1)
            riskTitle: existingOption.Risk?.title ?? null,
            title: existingOption.title,
            costEstimate: Number(existingOption.costEstimate),
            effortLevel: existingOption.effortLevel,
            priority: existingOption.priority,
            selectedStatus: existingOption.selectedStatus,
          },
          after: null,
        },
      });

      return { success: true };
    }),

  /**
   * List remediation options for a risk
   *
   * Returns all remediation options for a risk, sorted by priority.
   */
  listRemediationOptions: organizationProcedure
    .input(
      z.object({
        riskId: z.string().min(1, "Risk ID is required"),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify risk exists and user has access
      const risk = await ctx.db.risk.findUnique({
        where: { id: input.riskId },
        select: { id: true, organizationId: true },
      });

      if (!risk) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Risk not found",
        });
      }

      if (risk.organizationId !== ctx.organizationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this risk",
        });
      }

      // Fetch options sorted by priority (RECOMMENDED first)
      const options = await ctx.db.remediationOption.findMany({
        where: { riskId: input.riskId },
        include: {
          CreatedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          SelectedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          Owner: {
            select: {
              id: true,
              name: true,
              email: true,
              jobTitle: true,
            },
          },
        },
        orderBy: [
          { priority: "asc" }, // RECOMMENDED (0) < ALTERNATIVE (1) < NOT_RECOMMENDED (2)
          { createdAt: "asc" },
        ],
      });

      return options;
    }),

  // ===============================================
  // Story 4.6: Risk Ownership Assignment
  // ===============================================

  /**
   * Assign risk ownership (AC7-AC13)
   *
   * Assigns IT and/or Business owners to a risk.
   * Only GRC_ANALYST, SECURITY_ENGINEER, and ORG_ADMIN can assign risks.
   *
   * AC7: Mutation accepts: riskId, itOwnerId?, businessOwnerId?
   * AC8: Validates user role
   * AC9: Validates risk belongs to user's organization
   * AC10: Validates IT owner Person exists in organization (if provided)
   * AC11: Validates Business owner Person exists in organization (if provided)
   * AC12: Updates risk with owner IDs, assignedAt timestamp, assignedById
   * AC13: Changes risk status from OPEN to ASSIGNED
   */
  assignRisk: organizationProcedure
    .use(requireRole(RISK_ASSIGN_ROLES))
    .input(
      z.object({
        riskId: z.string().min(1, "Risk ID is required"),
        itOwnerId: z.string().optional(),
        businessOwnerId: z.string().optional(),
      }).refine(
        (data) => data.itOwnerId || data.businessOwnerId,
        { message: "At least one owner (IT or Business) must be provided" }
      )
    )
    .mutation(async ({ ctx, input }) => {
      // AC9: Validate risk exists and belongs to organization
      const risk = await ctx.db.risk.findUnique({
        where: { id: input.riskId },
        select: {
          id: true,
          organizationId: true,
          title: true,
          status: true,
          itOwnerId: true,
          businessOwnerId: true,
        },
      });

      if (!risk) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Risk not found",
        });
      }

      if (risk.organizationId !== ctx.organizationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Risk does not belong to your organization",
        });
      }

      // Only reject when the caller is trying to *change* a slot that's
      // already filled. If the dialog echoes back the existing owner (to
      // preserve it while assigning the other slot), treat that as a no-op
      // and let the mutation proceed.
      if (
        input.itOwnerId &&
        risk.itOwnerId &&
        input.itOwnerId !== risk.itOwnerId
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "IT owner is already assigned. Use reassignRisk to change owners.",
        });
      }
      if (
        input.businessOwnerId &&
        risk.businessOwnerId &&
        input.businessOwnerId !== risk.businessOwnerId
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Business owner is already assigned. Use reassignRisk to change owners.",
        });
      }

      // Validate IT owner exists in org as a Person (if provided)
      if (input.itOwnerId) {
        const itOwner = await ctx.db.person.findFirst({
          where: {
            id: input.itOwnerId,
            organizationId: ctx.organizationId,
          },
          select: { id: true, name: true },
        });

        if (!itOwner) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "IT Owner not found in your organization",
          });
        }
      }

      // Validate Business owner exists in org as a Person (if provided)
      if (input.businessOwnerId) {
        const businessOwner = await ctx.db.person.findFirst({
          where: {
            id: input.businessOwnerId,
            organizationId: ctx.organizationId,
          },
          select: { id: true, name: true },
        });

        if (!businessOwner) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Business Owner not found in your organization",
          });
        }
      }

      // AC12 & AC13: Update risk with owner IDs and change status to ASSIGNED.
      // Only write fields the caller provided so an existing business owner
      // isn't wiped when only an IT owner is being set (and vice versa).
      const updatedRisk = await ctx.db.risk.update({
        where: { id: input.riskId },
        data: {
          ...(input.itOwnerId ? { itOwnerId: input.itOwnerId } : {}),
          ...(input.businessOwnerId
            ? { businessOwnerId: input.businessOwnerId }
            : {}),
          assignedAt: new Date(),
          assignedById: ctx.session!.user.id,
          status: "ASSIGNED", // AC13
        },
        include: {
          ITOwner: {
            select: { id: true, name: true, email: true },
          },
          BusinessOwner: {
            select: { id: true, name: true, email: true },
          },
          AssignedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      // Audit logging
      // Story 4.12: Actor snapshots for audit compliance (AC7, AC17)
      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: "ASSIGN_RISK",
        entityType: "Risk",
        entityId: input.riskId,
        changes: {
          before: {
            status: risk.status,
            itOwnerId: risk.itOwnerId,
            businessOwnerId: risk.businessOwnerId,
          },
          after: {
            status: "ASSIGNED",
            itOwnerId: updatedRisk.itOwnerId,
            businessOwnerId: updatedRisk.businessOwnerId,
            assignedAt: updatedRisk.assignedAt,
            assignedById: ctx.session!.user.id,
          },
        },
        // Story 4.12: Actor snapshots (AC7)
        actorName: ctx.session!.user.name ?? "Unknown",
        actorRole: ctx.session!.user.role,
      });

      // Story 4.16: Send assignment notifications
      if (input.itOwnerId) {
        void sendRiskAssignmentNotification({
          riskId: input.riskId,
          assignedByUserId: ctx.session!.user.id,
          assignedRole: "IT_OWNER",
          organizationId: ctx.organizationId!,
        });
      }
      if (input.businessOwnerId) {
        void sendRiskAssignmentNotification({
          riskId: input.riskId,
          assignedByUserId: ctx.session!.user.id,
          assignedRole: "BUSINESS_OWNER",
          organizationId: ctx.organizationId!,
        });
      }

      return updatedRisk;
    }),

  /**
   * Reassign risk ownership (AC14-AC18)
   *
   * Changes owners after initial assignment.
   * Only GRC_ANALYST and ORG_ADMIN can reassign risks.
   *
   * AC14: Mutation allows changing owners after initial assignment
   * AC15: Validates user has permission (GRC_ANALYST, ORG_ADMIN)
   * AC16: Logs reassignment to audit trail (old owner → new owner)
   * AC17: Returns updated risk with new owner details (email notification handled separately)
   * AC18: Returns updated risk with new owner details
   */
  reassignRisk: organizationProcedure
    .use(requireRole([...WRITE_ROLES]))
    .input(
      z.object({
        riskId: z.string().min(1, "Risk ID is required"),
        itOwnerId: z.string().optional().nullable(),
        businessOwnerId: z.string().optional().nullable(),
      }).refine(
        (data) => data.itOwnerId !== undefined || data.businessOwnerId !== undefined,
        { message: "At least one owner field must be provided for reassignment" }
      )
    )
    .mutation(async ({ ctx, input }) => {
      // Validate risk exists and belongs to organization
      const risk = await ctx.db.risk.findUnique({
        where: { id: input.riskId },
        include: {
          ITOwner: { select: { id: true, name: true, email: true } },
          BusinessOwner: { select: { id: true, name: true, email: true } },
        },
      });

      if (!risk) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Risk not found",
        });
      }

      if (risk.organizationId !== ctx.organizationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Risk does not belong to your organization",
        });
      }

      // Validate new IT owner exists in org as a Person (if provided)
      if (input.itOwnerId) {
        const itOwner = await ctx.db.person.findFirst({
          where: {
            id: input.itOwnerId,
            organizationId: ctx.organizationId,
          },
          select: { id: true, name: true },
        });

        if (!itOwner) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "IT Owner not found in your organization",
          });
        }
      }

      // Validate new Business owner exists in org as a Person (if provided)
      if (input.businessOwnerId) {
        const businessOwner = await ctx.db.person.findFirst({
          where: {
            id: input.businessOwnerId,
            organizationId: ctx.organizationId,
          },
          select: { id: true, name: true },
        });

        if (!businessOwner) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Business Owner not found in your organization",
          });
        }
      }

      // Build update data - only update fields that were explicitly provided
      const updateData: {
        itOwnerId?: string | null;
        businessOwnerId?: string | null;
        assignedAt: Date;
        assignedById: string;
      } = {
        assignedAt: new Date(),
        assignedById: ctx.session!.user.id,
      };

      if (input.itOwnerId !== undefined) {
        updateData.itOwnerId = input.itOwnerId;
      }
      if (input.businessOwnerId !== undefined) {
        updateData.businessOwnerId = input.businessOwnerId;
      }

      // Update risk with new owners
      const updatedRisk = await ctx.db.risk.update({
        where: { id: input.riskId },
        data: updateData,
        include: {
          ITOwner: {
            select: { id: true, name: true, email: true },
          },
          BusinessOwner: {
            select: { id: true, name: true, email: true },
          },
          AssignedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      // AC16: Audit logging with old and new owner details
      // Story 4.12: Actor snapshots for audit compliance (AC7)
      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: "REASSIGN_RISK",
        entityType: "Risk",
        entityId: input.riskId,
        changes: {
          before: {
            itOwner: risk.ITOwner
              ? { id: risk.ITOwner.id, name: risk.ITOwner.name, email: risk.ITOwner.email }
              : null,
            businessOwner: risk.BusinessOwner
              ? { id: risk.BusinessOwner.id, name: risk.BusinessOwner.name, email: risk.BusinessOwner.email }
              : null,
          },
          after: {
            itOwner: updatedRisk.ITOwner
              ? { id: updatedRisk.ITOwner.id, name: updatedRisk.ITOwner.name, email: updatedRisk.ITOwner.email }
              : null,
            businessOwner: updatedRisk.BusinessOwner
              ? { id: updatedRisk.BusinessOwner.id, name: updatedRisk.BusinessOwner.name, email: updatedRisk.BusinessOwner.email }
              : null,
            assignedAt: updatedRisk.assignedAt,
            assignedById: ctx.session!.user.id,
          },
        },
        // Story 4.12: Actor snapshots (AC7)
        actorName: ctx.session!.user.name ?? "Unknown",
        actorRole: ctx.session!.user.role,
      });

      // Story 4.16: Send reassignment notifications to new owners
      // Only notify if owner is different from before
      if (input.itOwnerId && input.itOwnerId !== risk.ITOwner?.id) {
        void sendRiskAssignmentNotification({
          riskId: input.riskId,
          assignedByUserId: ctx.session!.user.id,
          assignedRole: "IT_OWNER",
          organizationId: ctx.organizationId!,
        });
      }
      if (input.businessOwnerId && input.businessOwnerId !== risk.BusinessOwner?.id) {
        void sendRiskAssignmentNotification({
          riskId: input.riskId,
          assignedByUserId: ctx.session!.user.id,
          assignedRole: "BUSINESS_OWNER",
          organizationId: ctx.organizationId!,
        });
      }

      return updatedRisk;
    }),

  // ===============================================
  // Story 4.7: Impact Calculation
  // ===============================================

  /**
   * Calculate impact score for a risk (AC27-AC30)
   *
   * Recalculates the impact score based on severity, frameworks affected,
   * asset criticality, and audit proximity.
   *
   * AC27: calculateRiskImpact mutation triggers recalculation
   * AC28: Recalculates all component scores
   * AC29: Updates impactScore in Risk table
   * AC30: Returns updated risk with new impact score
   */
  calculateRiskImpact: organizationProcedure
    .input(
      z.object({
        riskId: z.string().min(1, "Risk ID is required"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify risk exists and belongs to organization
      const risk = await ctx.db.risk.findUnique({
        where: { id: input.riskId },
        select: { id: true, organizationId: true, title: true },
      });

      if (!risk) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Risk not found",
        });
      }

      if (risk.organizationId !== ctx.organizationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Risk does not belong to your organization",
        });
      }

      // Calculate impact score
      const breakdown = await recalculateRiskImpact(input.riskId, ctx.db);

      // Fetch updated risk
      const updatedRisk = await ctx.db.risk.findUnique({
        where: { id: input.riskId },
        select: {
          id: true,
          title: true,
          impactScore: true,
          impactScoreCalculatedAt: true,
          severity: true,
          assetCriticality: true,
          nextAuditDate: true,
        },
      });

      return {
        ...updatedRisk,
        breakdown,
      };
    }),

  /**
   * Update asset criticality and next audit date (AC9, AC15)
   *
   * Updates impact-related fields and triggers recalculation.
   */
  updateImpactFields: organizationProcedure
    .use(requireRole(RISK_UPDATE_ROLES))
    .input(
      z.object({
        riskId: z.string().min(1, "Risk ID is required"),
        assetCriticality: z.nativeEnum(AssetCriticality).optional(),
        nextAuditDate: z.date().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { riskId, ...updateFields } = input;

      // Verify risk exists and belongs to organization
      const existingRisk = await ctx.db.risk.findUnique({
        where: { id: riskId },
        select: {
          id: true,
          organizationId: true,
          assetCriticality: true,
          nextAuditDate: true,
          impactScore: true,
        },
      });

      if (!existingRisk) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Risk not found",
        });
      }

      if (existingRisk.organizationId !== ctx.organizationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Risk does not belong to your organization",
        });
      }

      // Build update data
      const updateData: Record<string, unknown> = {};
      const changes: Record<string, { old: unknown; new: unknown }> = {};

      if (
        updateFields.assetCriticality !== undefined &&
        updateFields.assetCriticality !== existingRisk.assetCriticality
      ) {
        updateData.assetCriticality = updateFields.assetCriticality;
        changes.assetCriticality = {
          old: existingRisk.assetCriticality,
          new: updateFields.assetCriticality,
        };
      }

      if (updateFields.nextAuditDate !== undefined) {
        const existingDate = existingRisk.nextAuditDate?.toISOString();
        const newDate = updateFields.nextAuditDate?.toISOString();
        if (existingDate !== newDate) {
          updateData.nextAuditDate = updateFields.nextAuditDate;
          changes.nextAuditDate = { old: existingDate, new: newDate };
        }
      }

      // Only update if there are actual changes
      if (Object.keys(updateData).length === 0) {
        return existingRisk;
      }

      // Update the risk
      await ctx.db.risk.update({
        where: { id: riskId },
        data: updateData,
      });

      // AC31-AC33: Recalculate impact score after changes
      const breakdown = await recalculateRiskImpact(riskId, ctx.db);

      // Fetch updated risk with new impact score
      const updatedRisk = await ctx.db.risk.findUnique({
        where: { id: riskId },
        select: {
          id: true,
          title: true,
          severity: true,
          assetCriticality: true,
          nextAuditDate: true,
          impactScore: true,
          impactScoreCalculatedAt: true,
        },
      });

      // Audit logging
      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: "UPDATE_RISK",
        entityType: "Risk",
        entityId: riskId,
        changes: {
          before: Object.fromEntries(
            Object.entries(changes).map(([key, value]) => [key, value.old])
          ),
          after: {
            ...Object.fromEntries(
              Object.entries(changes).map(([key, value]) => [key, value.new])
            ),
            impactScore: breakdown.totalScore,
          },
        },
      });

      return {
        ...updatedRisk,
        breakdown,
      };
    }),

  // ===============================================
  // Story 16.4: Residual Severity Calculation
  // ===============================================

  /**
   * Update residual severity for a risk (AC3-AC7)
   *
   * Calculates residual risk severity after documenting controls.
   * Uses the organization's active risk matrix for calculation.
   *
   * AC3: updateResidualScore mutation calculates and saves residual severity
   * AC4: Calculation uses organization's active risk matrix
   * AC5: 2D calculation: residualLikelihood × residualImpact
   * AC6: 3D calculation: residualLikelihood × residualImpact × residualExposure
   * AC7: Score normalized and mapped to severity threshold
   */
  updateResidualSeverity: organizationProcedure
    .use(requireRole(RISK_UPDATE_ROLES))
    .input(
      z.object({
        riskId: z.string().min(1, "Risk ID is required"),
        residualLikelihood: z.number().min(1).max(10).optional().nullable(),
        residualImpact: z.number().min(1).max(10).optional().nullable(),
        residualExposure: z.number().min(1).max(10).optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { riskId, residualLikelihood, residualImpact, residualExposure } = input;
      const organizationId = ctx.organizationId!;

      // Verify risk exists and belongs to organization
      const existingRisk = await ctx.db.risk.findUnique({
        where: { id: riskId },
        select: {
          id: true,
          organizationId: true,
          residualLikelihood: true,
          residualImpact: true,
          residualExposure: true,
          residualScore: true,
          residualScoreLabel: true,
          matrixVersionId: true,
          enterpriseRiskId: true,
        },
      });

      if (!existingRisk) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Risk not found",
        });
      }

      if (existingRisk.organizationId !== organizationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Risk does not belong to your organization",
        });
      }

      // Build update data
      const updateData: Record<string, unknown> = {};
      const changes: Record<string, { old: unknown; new: unknown }> = {};

      // Track value changes
      if (residualLikelihood !== undefined) {
        const oldValue = existingRisk.residualLikelihood
          ? Number(existingRisk.residualLikelihood)
          : null;
        if (residualLikelihood !== oldValue) {
          updateData.residualLikelihood = residualLikelihood !== null
            ? new Prisma.Decimal(residualLikelihood)
            : null;
          changes.residualLikelihood = { old: oldValue, new: residualLikelihood };
        }
      }

      if (residualImpact !== undefined) {
        const oldValue = existingRisk.residualImpact
          ? Number(existingRisk.residualImpact)
          : null;
        if (residualImpact !== oldValue) {
          updateData.residualImpact = residualImpact !== null
            ? new Prisma.Decimal(residualImpact)
            : null;
          changes.residualImpact = { old: oldValue, new: residualImpact };
        }
      }

      if (residualExposure !== undefined) {
        const oldValue = existingRisk.residualExposure
          ? Number(existingRisk.residualExposure)
          : null;
        if (residualExposure !== oldValue) {
          updateData.residualExposure = residualExposure !== null
            ? new Prisma.Decimal(residualExposure)
            : null;
          changes.residualExposure = { old: oldValue, new: residualExposure };
        }
      }

      // AC4-AC7: Calculate residual score using active matrix
      const newLikelihood = residualLikelihood ?? (existingRisk.residualLikelihood
        ? Number(existingRisk.residualLikelihood)
        : null);
      const newImpact = residualImpact ?? (existingRisk.residualImpact
        ? Number(existingRisk.residualImpact)
        : null);
      const newExposure = residualExposure ?? (existingRisk.residualExposure
        ? Number(existingRisk.residualExposure)
        : null);

      // Get matrix version (locked or org's published version)
      const matrixVersionId = existingRisk.matrixVersionId;
      let matrixVersion = null;

      if (matrixVersionId) {
        matrixVersion = await ctx.db.riskMatrixVersion.findUnique({
          where: { id: matrixVersionId },
          include: {
            template: true,
          },
        });
      }

      // Fallback to org's default template's published version
      if (!matrixVersion) {
        const defaultTemplate = await ctx.db.riskMatrixTemplate.findFirst({
          where: {
            organizationId,
            isDefault: true,
            isActive: true,
            currentVersionId: { not: null },
          },
          select: { currentVersionId: true },
        });

        if (defaultTemplate?.currentVersionId) {
          matrixVersion = await ctx.db.riskMatrixVersion.findUnique({
            where: { id: defaultTemplate.currentVersionId },
            include: {
              template: true,
            },
          });
        }
      }

      // Calculate score if we have a matrix version and values
      if (matrixVersion && newLikelihood !== null && newImpact !== null) {
        const scales = matrixVersion.scales as unknown as MatrixScales;
        const thresholds = matrixVersion.thresholds as unknown as Threshold[];
        const outputScaleMax = Number(matrixVersion.template.outputScaleMax);

        const scoreResult = calculateInherentScore(
          scales,
          thresholds,
          outputScaleMax,
          newLikelihood,
          newImpact,
          newExposure
        );

        if (isScoreResult(scoreResult)) {
          updateData.residualScore = new Prisma.Decimal(scoreResult.normalizedScore);
          updateData.residualScoreLabel = scoreResult.label;
          changes.residualScore = {
            old: existingRisk.residualScore ? Number(existingRisk.residualScore) : null,
            new: scoreResult.normalizedScore,
          };
          changes.residualScoreLabel = {
            old: existingRisk.residualScoreLabel,
            new: scoreResult.label,
          };
        }
      } else if (newLikelihood === null || newImpact === null) {
        // Clear score if values are cleared
        updateData.residualScore = null;
        updateData.residualScoreLabel = null;
      }

      // Only update if there are changes
      if (Object.keys(updateData).length === 0) {
        return {
          id: riskId,
          residualLikelihood: existingRisk.residualLikelihood
            ? Number(existingRisk.residualLikelihood)
            : null,
          residualImpact: existingRisk.residualImpact
            ? Number(existingRisk.residualImpact)
            : null,
          residualExposure: existingRisk.residualExposure
            ? Number(existingRisk.residualExposure)
            : null,
          residualScore: existingRisk.residualScore
            ? Number(existingRisk.residualScore)
            : null,
          residualScoreLabel: existingRisk.residualScoreLabel,
          updated: false,
        };
      }

      // Update the risk
      const updatedRisk = await ctx.db.risk.update({
        where: { id: riskId },
        data: updateData,
        select: {
          id: true,
          residualLikelihood: true,
          residualImpact: true,
          residualExposure: true,
          residualScore: true,
          residualScoreLabel: true,
        },
      });

      // Enterprise Risk: recompute parent if score changed and risk is aligned
      if (existingRisk.enterpriseRiskId && (changes.residualScore || changes.residualScoreLabel)) {
        await recomputeEnterpriseRiskScore(ctx.db, existingRisk.enterpriseRiskId);
      }

      // Audit logging
      if (Object.keys(changes).length > 0) {
        void createAuditLog({
          organizationId,
          userId: ctx.session!.user.id,
          action: "UPDATE_RISK",
          entityType: "Risk",
          entityId: riskId,
          changes: {
            before: Object.fromEntries(
              Object.entries(changes).map(([k, v]) => [k, (v as { old: unknown }).old])
            ),
            after: Object.fromEntries(
              Object.entries(changes).map(([k, v]) => [k, (v as { new: unknown }).new])
            ),
          },
        });
      }

      return {
        id: updatedRisk.id,
        residualLikelihood: updatedRisk.residualLikelihood
          ? Number(updatedRisk.residualLikelihood)
          : null,
        residualImpact: updatedRisk.residualImpact
          ? Number(updatedRisk.residualImpact)
          : null,
        residualExposure: updatedRisk.residualExposure
          ? Number(updatedRisk.residualExposure)
          : null,
        residualScore: updatedRisk.residualScore
          ? Number(updatedRisk.residualScore)
          : null,
        residualScoreLabel: updatedRisk.residualScoreLabel,
        updated: true,
      };
    }),

  // ===============================================
  // Story 4.8: Business Impact Statement Management
  // ===============================================

  /**
   * Update business impact statement manually (AC33-AC36)
   *
   * Allows GRC_ANALYST to manually edit the impact statement.
   * Sets impactStatementManuallyEdited = true to prevent auto-regeneration.
   *
   * AC33: GRC_ANALYST can click "Edit Impact Statement" button
   * AC34: Opens dialog with markdown editor pre-filled with auto-generated statement
   * AC35: Analyst can customize statement while retaining structure
   * AC36: Manual edits saved to businessImpactStatement field with override flag
   */
  updateBusinessImpact: organizationProcedure
    .use(requireRole([...WRITE_ROLES]))
    .input(
      z.object({
        riskId: z.string().min(1, "Risk ID is required"),
        businessImpactStatement: z
          .string()
          .max(10000, "Impact statement must be at most 10000 characters"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify risk exists and belongs to organization
      const existingRisk = await ctx.db.risk.findUnique({
        where: { id: input.riskId },
        select: {
          id: true,
          organizationId: true,
          businessImpactStatement: true,
          impactStatementManuallyEdited: true,
        },
      });

      if (!existingRisk) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Risk not found",
        });
      }

      if (existingRisk.organizationId !== ctx.organizationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Risk does not belong to your organization",
        });
      }

      // AC36: Update with manual edit flag
      const updatedRisk = await ctx.db.risk.update({
        where: { id: input.riskId },
        data: {
          businessImpactStatement: input.businessImpactStatement,
          impactStatementManuallyEdited: true,
          impactStatementGeneratedAt: new Date(),
        },
        select: {
          id: true,
          businessImpactStatement: true,
          impactStatementManuallyEdited: true,
          impactStatementGeneratedAt: true,
        },
      });

      // Audit logging
      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: "UPDATE_RISK",
        entityType: "Risk",
        entityId: input.riskId,
        changes: {
          before: {
            impactStatementManuallyEdited: existingRisk.impactStatementManuallyEdited,
            businessImpactStatement: existingRisk.businessImpactStatement
              ? "Previous statement"
              : null,
          },
          after: {
            impactStatementManuallyEdited: true,
            businessImpactStatement: "Manually edited statement",
          },
        },
      });

      return updatedRisk;
    }),

  // ===============================================
  // Story 4.9: Role-Based Risk Views - Summary Queries
  // ===============================================

  /**
   * Get IT Stakeholder risk summary (AC29-AC30)
   *
   * Returns summary stats for risks assigned to the current user as IT owner.
   * Used for the "My Assigned Risks" dashboard widget.
   */
  getMyRisksSummary: organizationProcedure
    .use(requireRole([UserRole.BUSINESS_USER, UserRole.ADMINISTRATOR]))
    .query(async ({ ctx }) => {
      const organizationId = ctx.organizationId!;

      // Find Person records for the current user matched by email
      const myPersonRecords = await ctx.db.person.findMany({
        where: { organizationId, email: ctx.session!.user.email },
        select: { id: true },
      });
      const myPersonIds = myPersonRecords.map((p: { id: string }) => p.id);

      // Get all open/assigned risks for this IT owner (matched via Person)
      const risks = await ctx.db.risk.findMany({
        where: {
          organizationId,
          itOwnerId: { in: myPersonIds },
          status: { in: ["OPEN", "ASSIGNED"] },
        },
        select: {
          impactScore: true,
          assignedAt: true,
        },
      });

      const totalAssigned = risks.length;
      const avgImpactScore =
        totalAssigned > 0
          ? Math.round(risks.reduce((sum: number, r: { impactScore: number }) => sum + r.impactScore, 0) / totalAssigned)
          : 0;

      // Find oldest risk by assignment date
      const sortedByDate = [...risks].sort((a, b) => {
        if (!a.assignedAt) return 1;
        if (!b.assignedAt) return -1;
        return a.assignedAt.getTime() - b.assignedAt.getTime();
      });

      const oldestRisk = sortedByDate[0];
      const oldestRiskDays = oldestRisk?.assignedAt
        ? Math.floor((Date.now() - oldestRisk.assignedAt.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      return {
        totalAssigned,
        avgImpactScore,
        oldestRiskDays,
      };
    }),

  /**
   * Get Business Stakeholder decisions summary (AC31-AC32)
   *
   * Returns summary stats for risks assigned to the current user for business decision.
   * Used for the "Decisions Pending" dashboard widget.
   */
  getDecisionsSummary: organizationProcedure
    .use(requireRole([UserRole.BUSINESS_USER, UserRole.ADMINISTRATOR]))
    .query(async ({ ctx }) => {
      const organizationId = ctx.organizationId!;

      // Find Person records for the current user matched by email
      const myPersonRecords = await ctx.db.person.findMany({
        where: { organizationId, email: ctx.session!.user.email },
        select: { id: true },
      });
      const myPersonIds = myPersonRecords.map((p: { id: string }) => p.id);

      // Get all risks pending business decision (ASSIGNED status with this business owner)
      const risks = await ctx.db.risk.findMany({
        where: {
          organizationId,
          businessOwnerId: { in: myPersonIds },
          status: "ASSIGNED",
        },
        select: {
          impactScore: true,
          assignedAt: true,
          RemediationOptions: {
            select: { id: true },
          },
        },
      });

      const totalPending = risks.length;

      // Find highest impact risk
      const highestImpactScore =
        risks.length > 0 ? Math.max(...risks.map((r: { impactScore: number }) => r.impactScore)) : 0;

      // Count overdue (assigned more than 7 days ago)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const overdueCount = risks.filter(
        (r) => r.assignedAt && r.assignedAt < sevenDaysAgo
      ).length;

      // Count risks with remediation options ready for decision
      const readyForDecisionCount = risks.filter(
        (r: { RemediationOptions: { id: string }[] }) => r.RemediationOptions.length > 0
      ).length;

      return {
        totalPending,
        highestImpactScore,
        overdueCount,
        readyForDecisionCount,
      };
    }),

  // ===============================================
  // Story 4.10: Remediation Workflow State Machine
  // ===============================================

  /**
   * Update risk status with state machine validation (AC13-AC18)
   *
   * Validates transitions using the state machine service and enforces
   * role-based permissions. Creates status history record for audit trail.
   *
   * AC13: updateRiskStatus mutation accepts: riskId, newStatus, transitionReason?
   * AC14: Mutation validates transition is allowed by state machine
   * AC15: Mutation validates user role has permission for transition
   * AC16: Mutation requires transitionReason for CLOSED → other transitions
   * AC17: Mutation updates risk status and logs to audit trail
   * AC18: Mutation triggers status change notifications (future Story 4.14)
   */
  updateRiskStatus: organizationProcedure
    .input(
      z.object({
        riskId: z.string().min(1, "Risk ID is required"),
        newStatus: z.nativeEnum(RiskStatus),
        reason: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      const userRole = ctx.session?.user?.role as UserRole;

      // Fetch current risk
      const risk = await ctx.db.risk.findUnique({
        where: { id: input.riskId },
        select: {
          id: true,
          organizationId: true,
          title: true,
          status: true,
          itOwnerId: true,
          businessOwnerId: true,
        },
      });

      if (!risk) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Risk not found",
        });
      }

      if (risk.organizationId !== ctx.organizationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Risk does not belong to your organization",
        });
      }

      // Check if user is the IT owner (for IT_STAKEHOLDER permission check)
      const isOwner = risk.itOwnerId === userId;

      // AC14: Validate transition with state machine
      const validation = validateTransition(
        risk.status,
        input.newStatus,
        userRole,
        isOwner
      );

      if (!validation.allowed) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: validation.reason || "This status transition is not allowed",
        });
      }

      // AC16: Require reason for reopening closed risks
      if (transitionRequiresReason(risk.status, input.newStatus) && !input.reason) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A reason is required when reopening a closed risk",
        });
      }

      // AC36: Check if transition requires remediation evidence
      // (This is informational - actual evidence requirement enforced in UI)
      const requiresEvidence = transitionRequiresEvidence(risk.status, input.newStatus);

      // AC17: Update risk status
      const updatedRisk = await ctx.db.risk.update({
        where: { id: input.riskId },
        data: {
          status: input.newStatus,
        },
        include: {
          ITOwner: { select: { id: true, name: true, email: true } },
          BusinessOwner: { select: { id: true, name: true, email: true } },
        },
      });

      // AC12: Create status history record for audit trail
      await ctx.db.riskStatusHistory.create({
        data: {
          riskId: input.riskId,
          oldStatus: risk.status,
          newStatus: input.newStatus,
          reason: input.reason,
          changedById: userId!,
          organizationId: ctx.organizationId!,
        },
      });

      // Log to audit trail
      // Story 4.12: Actor snapshots for audit compliance (AC7, AC18)
      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: userId!,
        action: "UPDATE_RISK_STATUS",
        entityType: "Risk",
        entityId: input.riskId,
        changes: {
          before: { status: risk.status },
          after: {
            status: input.newStatus,
            reason: input.reason,
          },
        },
        // Story 4.12: Actor snapshots (AC7)
        actorName: ctx.session?.user?.name ?? "Unknown",
        actorRole: ctx.session?.user?.role ?? "UNKNOWN",
      });

      // AC18/Story 4.16: Trigger status change notifications
      // Send general status change notification
      void sendStatusChangeNotification({
        riskId: input.riskId,
        oldStatus: risk.status,
        newStatus: input.newStatus,
        changedByUserId: userId!,
        changeReason: input.reason,
        organizationId: ctx.organizationId!,
      });

      // Send risk closed notification if applicable
      if (input.newStatus === "CLOSED") {
        void sendRiskClosedNotification({
          riskId: input.riskId,
          closedByUserId: userId!,
          finalStatus: "CLOSED",
          remediationSummary: input.reason,
          organizationId: ctx.organizationId!,
        });

        // Story 5.3 AC10-AC13: Trigger compliance recalculation when risk closed
        // AC11: Risk closure may update coverage if remediation evidence satisfies new controls
        // AC12: Recalculation triggered only if risk has linked evidence
        // AC13: Asynchronous processing doesn't block risk closure operation
        void (async () => {
          try {
            const affectedFrameworkIds = await getAffectedFrameworkIdsForRisk(
              input.riskId,
              ctx.db
            );
            if (affectedFrameworkIds.length > 0) {
              queueMultipleFrameworkRecalculations(
                affectedFrameworkIds,
                ctx.organizationId!,
                "risk_closure"
              );
            }
          } catch (error) {
            console.error("[Risk] Failed to queue compliance recalculation:", error);
          }
        })();
      }

      // Send decision required notification when moving to ASSIGNED with business owner
      if (input.newStatus === "ASSIGNED") {
        void sendDecisionRequiredNotification({
          riskId: input.riskId,
          organizationId: ctx.organizationId!,
        });
      }

      return {
        ...updatedRisk,
        previousStatus: risk.status,
        requiresEvidence,
      };
    }),

  /**
   * Get available status transitions for a risk (AC29)
   *
   * Returns list of valid next statuses based on current status and user role.
   * Used by StatusTransitionDialog to show available options.
   */
  getAvailableTransitions: organizationProcedure
    .input(
      z.object({
        riskId: z.string().min(1, "Risk ID is required"),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      const userRole = ctx.session?.user?.role as UserRole;

      // Fetch risk to get current status and ownership
      const risk = await ctx.db.risk.findUnique({
        where: { id: input.riskId },
        select: {
          id: true,
          organizationId: true,
          status: true,
          itOwnerId: true,
        },
      });

      if (!risk) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Risk not found",
        });
      }

      if (risk.organizationId !== ctx.organizationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Risk does not belong to your organization",
        });
      }

      const isOwner = risk.itOwnerId === userId;

      // Get available transitions based on current status and role
      const availableStatuses = getAvailableTransitions(
        risk.status,
        userRole,
        isOwner
      );

      // Build transition info for each available status
      const transitions = availableStatuses.map((status) => ({
        status,
        requiresReason: transitionRequiresReason(risk.status, status),
        requiresEvidence: transitionRequiresEvidence(risk.status, status),
      }));

      return {
        currentStatus: risk.status,
        transitions,
      };
    }),

  /**
   * Get status history for a risk (AC31-AC35)
   *
   * Returns all status transitions chronologically (newest first).
   * Used by StatusHistory component on risk detail page.
   */
  getRiskStatusHistory: organizationProcedure
    .input(
      z.object({
        riskId: z.string().min(1, "Risk ID is required"),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify risk exists and user has access
      const risk = await ctx.db.risk.findUnique({
        where: { id: input.riskId },
        select: { id: true, organizationId: true },
      });

      if (!risk) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Risk not found",
        });
      }

      if (risk.organizationId !== ctx.organizationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Risk does not belong to your organization",
        });
      }

      // AC32: Fetch history chronologically (newest first)
      const history = await ctx.db.riskStatusHistory.findMany({
        where: { riskId: input.riskId },
        include: {
          ChangedBy: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
        orderBy: { changedAt: "desc" },
      });

      return history;
    }),

  /**
   * Add verification comments when closing a risk (AC38-AC40)
   *
   * Allows GRC_ANALYST to add verification comments when verifying remediation.
   */
  addVerificationComments: organizationProcedure
    .use(requireRole([...WRITE_ROLES]))
    .input(
      z.object({
        riskId: z.string().min(1, "Risk ID is required"),
        verificationComments: z.string().min(10, "Comments must be at least 10 characters").max(5000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;

      // Verify risk exists and belongs to organization
      const risk = await ctx.db.risk.findUnique({
        where: { id: input.riskId },
        select: {
          id: true,
          organizationId: true,
          status: true,
        },
      });

      if (!risk) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Risk not found",
        });
      }

      if (risk.organizationId !== ctx.organizationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Risk does not belong to your organization",
        });
      }

      // AC38: Only allow verification for REMEDIATED risks
      if (risk.status !== RiskStatus.REMEDIATED) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Verification comments can only be added to risks in REMEDIATED status",
        });
      }

      // AC40: Update verification fields
      const updatedRisk = await ctx.db.risk.update({
        where: { id: input.riskId },
        data: {
          remediationVerifiedById: userId,
          remediationVerificationComments: input.verificationComments,
        },
        select: {
          id: true,
          status: true,
          remediationVerificationComments: true,
          RemediationVerifiedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      // Audit logging
      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: userId!,
        action: "UPDATE_RISK",
        entityType: "Risk",
        entityId: input.riskId,
        changes: {
          before: { verificationComments: null },
          after: { verificationComments: "Added verification comments" },
        },
      });

      return updatedRisk;
    }),

  // ===============================================
  // Story 4.11: Risk Comments and Collaboration
  // ===============================================

  /**
   * Add a comment to a risk (AC7-AC12)
   *
   * Creates a new RiskComment record for collaboration on risks.
   * Role-based access control determines who can comment:
   * - GRC_ANALYST, SECURITY_ENGINEER, ORG_ADMIN: Can comment on all org risks
   * - IT_STAKEHOLDER: Can only comment on risks where they are IT owner
   * - BUSINESS_STAKEHOLDER: Can only comment on risks where they are business owner
   * - AUDITOR: Cannot comment (read-only role)
   *
   * AC7: addRiskComment mutation accepts: riskId, comment, commentType
   * AC8: Mutation validates user has access to risk
   * AC9: Mutation creates RiskComment record with authorId from session
   * AC10: Mutation logs comment addition to audit trail
   * AC11: Mutation triggers notification to risk watchers (see Story 4.14)
   * AC12: Mutation returns created comment with author details
   */
  addRiskComment: organizationProcedure
    .use(requireRole(COMMENT_ALLOWED_ROLES))
    .input(
      z.object({
        riskId: z.string().min(1, "Risk ID is required"),
        comment: z
          .string()
          .min(1, "Comment cannot be empty")
          .max(5000, "Comment must be at most 5000 characters"), // AC3
        commentType: z.nativeEnum(CommentType).default("GENERAL"), // AC2
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      const userRole = ctx.session?.user?.role as UserRole;

      // AC8: Validate user has access to risk
      const risk = await ctx.db.risk.findUnique({
        where: { id: input.riskId },
        select: {
          id: true,
          organizationId: true,
          title: true,
        },
      });

      if (!risk) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Risk not found",
        });
      }

      if (risk.organizationId !== ctx.organizationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Risk does not belong to your organization",
        });
      }

      // Role-based comment access: all roles allowed by COMMENT_ALLOWED_ROLES can comment
      // on any org risk - role alone is sufficient, no ownership check needed
      if (!(COMMENT_FULL_ACCESS_ROLES as UserRole[]).includes(userRole) &&
          !(COMMENT_RESTRICTED_ROLES as UserRole[]).includes(userRole)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Your role cannot add comments to risks",
        });
      }

      // AC9: Create RiskComment record with authorId from session
      const comment = await ctx.db.riskComment.create({
        data: {
          riskId: input.riskId,
          comment: input.comment,
          commentType: input.commentType,
          authorId: userId!,
          organizationId: ctx.organizationId!,
        },
        include: {
          // AC12: Return created comment with author details
          Author: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      });

      // AC10: Log comment addition to audit trail
      // Story 4.12: Actor snapshots for audit compliance (AC7, AC21)
      // Note: Use entityType "Risk" and entityId riskId so comments appear in risk's audit trail
      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: userId!,
        action: "ADD_RISK_COMMENT",
        entityType: "Risk",
        entityId: input.riskId,
        changes: {
          before: null,
          after: {
            commentId: comment.id,
            riskTitle: risk.title,
            commentType: input.commentType,
            commentLength: input.comment.length,
          },
        },
        // Story 4.12: Actor snapshots (AC7)
        actorName: ctx.session?.user?.name ?? "Unknown",
        actorRole: ctx.session?.user?.role ?? "UNKNOWN",
      });

      // AC11/Story 4.16: Trigger notification to risk watchers
      void sendCommentAddedNotification({
        riskId: input.riskId,
        commenterId: userId!,
        commentText: input.comment,
        organizationId: ctx.organizationId!,
      });

      // AC12: Return created comment with author details
      return comment;
    }),

  /**
   * Update a comment on a risk (AC13-AC17)
   *
   * Updates an existing RiskComment text.
   * Only the comment author or GRC_ANALYST/ORG_ADMIN can update.
   *
   * AC13: updateRiskComment mutation accepts: commentId, updatedComment
   * AC14: Mutation validates user is comment author or GRC_ANALYST/ORG_ADMIN
   * AC15: Mutation updates comment text and updatedAt timestamp
   * AC16: Mutation logs update to audit trail with old/new text
   * AC17: Edited comments show "Edited" badge (handled in UI)
   */
  updateRiskComment: organizationProcedure
    .use(requireRole(COMMENT_ALLOWED_ROLES))
    .input(
      z.object({
        commentId: z.string().min(1, "Comment ID is required"),
        updatedComment: z
          .string()
          .min(1, "Comment cannot be empty")
          .max(5000, "Comment must be at most 5000 characters"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      const userRole = ctx.session?.user?.role as UserRole;

      // Fetch existing comment
      const existingComment = await ctx.db.riskComment.findUnique({
        where: { id: input.commentId },
        include: {
          Risk: {
            select: { id: true, title: true, organizationId: true },
          },
        },
      });

      if (!existingComment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Comment not found",
        });
      }

      if (existingComment.organizationId !== ctx.organizationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Comment does not belong to your organization",
        });
      }

      // Check if comment is already deleted
      if (existingComment.deletedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot update a deleted comment",
        });
      }

      // AC14: Validate user is author or has edit permission
      const isAuthor = existingComment.authorId === userId;
      const canEditAny = ([UserRole.ANALYST, UserRole.ADMINISTRATOR] as UserRole[]).includes(userRole);

      if (!isAuthor && !canEditAny) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only edit your own comments",
        });
      }

      // AC15: Update comment text (updatedAt is auto-updated by Prisma)
      const updatedComment = await ctx.db.riskComment.update({
        where: { id: input.commentId },
        data: {
          comment: input.updatedComment,
        },
        include: {
          Author: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      });

      // AC16: Log update to audit trail
      // Note: Use entityType "Risk" and entityId riskId so comments appear in risk's audit trail
      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: userId!,
        action: "UPDATE_RISK_COMMENT",
        entityType: "Risk",
        entityId: existingComment.riskId,
        changes: {
          before: {
            commentId: input.commentId,
            comment: existingComment.comment.substring(0, 100) + (existingComment.comment.length > 100 ? "..." : ""),
          },
          after: {
            commentId: input.commentId,
            comment: input.updatedComment.substring(0, 100) + (input.updatedComment.length > 100 ? "..." : ""),
            riskTitle: existingComment.Risk.title,
          },
        },
        actorName: ctx.session?.user?.name ?? "Unknown",
        actorRole: ctx.session?.user?.role ?? "UNKNOWN",
      });

      return updatedComment;
    }),

  /**
   * Delete a comment on a risk (AC18-AC21)
   *
   * Soft deletes a RiskComment by setting deletedAt timestamp.
   * Only the comment author or GRC_ANALYST/ORG_ADMIN can delete.
   *
   * AC18: deleteRiskComment mutation accepts: commentId
   * AC19: Mutation validates user is comment author or GRC_ANALYST/ORG_ADMIN
   * AC20: Mutation soft deletes comment (sets deletedAt timestamp)
   * AC21: Deleted comments show "[Comment deleted]" placeholder (handled in UI)
   */
  deleteRiskComment: organizationProcedure
    .use(requireRole(COMMENT_ALLOWED_ROLES))
    .input(
      z.object({
        commentId: z.string().min(1, "Comment ID is required"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      const userRole = ctx.session?.user?.role as UserRole;

      // Fetch existing comment
      const existingComment = await ctx.db.riskComment.findUnique({
        where: { id: input.commentId },
        include: {
          Risk: {
            select: { id: true, title: true, organizationId: true },
          },
        },
      });

      if (!existingComment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Comment not found",
        });
      }

      if (existingComment.organizationId !== ctx.organizationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Comment does not belong to your organization",
        });
      }

      // Check if already deleted
      if (existingComment.deletedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Comment is already deleted",
        });
      }

      // AC19: Validate user is author or has delete permission
      const isAuthor = existingComment.authorId === userId;
      const canDeleteAny = ([UserRole.ANALYST, UserRole.ADMINISTRATOR] as UserRole[]).includes(userRole);

      if (!isAuthor && !canDeleteAny) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only delete your own comments",
        });
      }

      // AC20: Soft delete - set deletedAt timestamp
      await ctx.db.riskComment.update({
        where: { id: input.commentId },
        data: {
          deletedAt: new Date(),
        },
      });

      // Log deletion to audit trail
      // Note: Use entityType "Risk" and entityId riskId so comments appear in risk's audit trail
      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: userId!,
        action: "DELETE_RISK_COMMENT",
        entityType: "Risk",
        entityId: existingComment.riskId,
        changes: {
          before: {
            commentId: input.commentId,
            riskTitle: existingComment.Risk.title,
            commentType: existingComment.commentType,
            commentLength: existingComment.comment.length,
          },
          after: null,
        },
        actorName: ctx.session?.user?.name ?? "Unknown",
        actorRole: ctx.session?.user?.role ?? "UNKNOWN",
      });

      return { success: true };
    }),

  /**
   * Get comments for a risk (AC22-AC28)
   *
   * Returns all comments for a risk, sorted chronologically (oldest first).
   * Soft-deleted comments are included but marked as deleted.
   *
   * AC23: Comments displayed in chronological order (oldest first)
   */
  getRiskComments: organizationProcedure
    .input(
      z.object({
        riskId: z.string().min(1, "Risk ID is required"),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify risk exists and user has access
      const risk = await ctx.db.risk.findUnique({
        where: { id: input.riskId },
        select: {
          id: true,
          organizationId: true,
        },
      });

      if (!risk) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Risk not found",
        });
      }

      if (risk.organizationId !== ctx.organizationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Risk does not belong to your organization",
        });
      }

      // All roles in the organization can view comments on any org risk
      // Organization check above is sufficient for access control

      // AC23: Fetch comments sorted by createdAt ASC (oldest first)
      // Include soft-deleted comments to show placeholder
      const comments = await ctx.db.riskComment.findMany({
        where: { riskId: input.riskId },
        include: {
          Author: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      return comments;
    }),

  // ===============================================
  // Story 4.12: Risk Audit Trail
  // ===============================================

  /**
   * Get audit trail for a risk (AC28-AC32)
   *
   * Returns paginated audit log entries for a specific risk.
   * Supports optional filtering by action type.
   *
   * AC28: Query accepts: riskId, actionType?, limit, offset
   * AC29: Returns audit logs with actor details
   * AC30: Filters by organizationId (multi-tenancy)
   * AC31: Orders by timestamp DESC (newest first)
   * AC32: Returns total count for pagination
   */
  getRiskAuditTrail: organizationProcedure
    .input(
      z.object({
        riskId: z.string().min(1, "Risk ID is required"),
        actionType: z.string().optional(), // Optional filter by action type
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      // Build where clause
      const whereClause: {
        entityType: string;
        entityId: string;
        organizationId: string;
        action?: AuditAction;
      } = {
        entityType: "Risk",
        entityId: input.riskId,
        organizationId: ctx.organizationId!, // AC30: Multi-tenant filtering
      };

      // AC28: Optional action type filter
      if (input.actionType) {
        whereClause.action = input.actionType as AuditAction;
      }

      // Fetch audit logs and total count in parallel
      const [auditLogs, totalCount] = await Promise.all([
        ctx.db.auditLog.findMany({
          where: whereClause,
          orderBy: { timestamp: "desc" }, // AC31: Newest first
          skip: input.offset,
          take: input.limit,
          include: {
            User: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        }),
        ctx.db.auditLog.count({ where: whereClause }), // AC32: Total count
      ]);

      // AC29: Return audit logs with actor details
      return {
        auditLogs: auditLogs.map((log) => ({
          id: log.id,
          action: log.action,
          timestamp: log.timestamp,
          changes: log.changes,
          // Actor information (prefer snapshot over relation)
          actorId: log.userId,
          actorName: log.actorName ?? log.User?.name ?? "Unknown",
          actorRole: log.actorRole ?? "UNKNOWN",
          actorEmail: log.User?.email ?? null,
        })),
        totalCount,
        limit: input.limit,
        offset: input.offset,
        hasMore: input.offset + auditLogs.length < totalCount,
      };
    }),

  /**
   * Get available action types for risk audit trail filter dropdown
   *
   * Returns list of distinct action types that have been logged for risks.
   */
  getAuditTrailActionTypes: organizationProcedure.query(async ({ ctx }) => {
    const actions = await ctx.db.auditLog.findMany({
      where: {
        entityType: "Risk",
        organizationId: ctx.organizationId!,
      },
      select: { action: true },
      distinct: ["action"],
    });

    return actions.map((a: { action: string }) => a.action);
  }),

  /**
   * Export audit trail as CSV (AC23-AC27)
   *
   * Generates a CSV file containing all audit trail entries for a risk.
   *
   * AC23: "Export Audit Trail" button downloads CSV with all entries
   * AC24: CSV includes columns: Timestamp, Action, Actor, Role, Change Details
   * AC25: CSV formatted for Excel import (UTC timestamps, escaped commas)
   * AC26: Export available to GRC_ANALYST, ORG_ADMIN, AUDITOR roles only
   * AC27: Export filename: `risk-${riskId}-audit-trail-${date}.csv`
   */
  exportRiskAuditTrail: organizationProcedure
    .use(requireRole([...WRITE_ROLES])) // AC26
    .input(z.object({ riskId: z.string().min(1, "Risk ID is required") }))
    .mutation(async ({ ctx, input }) => {
      // Fetch all audit logs for this risk (no pagination)
      const auditLogs = await ctx.db.auditLog.findMany({
        where: {
          entityType: "Risk",
          entityId: input.riskId,
          organizationId: ctx.organizationId!,
        },
        orderBy: { timestamp: "asc" }, // Chronological order for export
        include: {
          User: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      });

      // Import the formatChangeDetails function dynamically to avoid circular deps
      const { formatChangeDetails } = await import("@/lib/formatAuditChange");

      // AC24: Build CSV with columns: Timestamp, Action, Actor, Role, Change Details
      const headers = ["Timestamp", "Action", "Actor", "Role", "Change Details"];
      const rows = auditLogs.map((log) => {
        // AC25: UTC timestamp for Excel
        const timestamp = log.timestamp.toISOString();
        const action = log.action;
        const actor = log.actorName ?? log.User?.name ?? "Unknown";
        const role = log.actorRole ?? "UNKNOWN";
        const changeDetails = formatChangeDetails(
          log.action,
          log.changes as Record<string, unknown>
        );

        // Escape values for CSV (handle commas, quotes, newlines)
        const escapeCSV = (value: string): string => {
          if (value.includes(",") || value.includes('"') || value.includes("\n")) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        };

        return [
          escapeCSV(timestamp),
          escapeCSV(action),
          escapeCSV(actor),
          escapeCSV(role),
          escapeCSV(changeDetails),
        ].join(",");
      });

      // Combine headers and rows
      const csv = [headers.join(","), ...rows].join("\n");

      // AC27: Generate filename
      const date = new Date().toISOString().split("T")[0];
      const filename = `risk-${input.riskId}-audit-trail-${date}.csv`;

      return {
        filename,
        data: csv,
      };
    }),

  // =============================================================================
  // Story 4.13: Risk Assignment Queue for GRC Analysts
  // =============================================================================

  /**
   * Story 4.13: Roles that can access assignment queue (AC33-AC36)
   * - GRC_ANALYST: Full access (can assign)
   * - SECURITY_ENGINEER: Full access (can assign)
   * - ORG_ADMIN: Full access (can assign)
   * - AUDITOR: Read-only access (cannot assign)
   */

  /**
   * Get assignment queue (AC1-AC7)
   *
   * Returns all risks with status OPEN (not yet assigned) for the user's organization.
   * Supports filtering, sorting, and pagination.
   *
   * AC1: Queue shows all risks with status OPEN (not yet assigned)
   * AC2: Queue displays risk: title, severity badge, impact score, finding source, discovery date, created by
   * AC3: Queue sortable by impact score (default, highest first), discovery date (oldest first), severity
   * AC4: Queue includes search box (filter by title or description keywords)
   * AC5: Queue includes filter panel with severity, finding source, date range filters
   * AC6: Queue pagination (20 risks per page)
   * AC7: Empty state when no unassigned risks
   */
  getAssignmentQueue: organizationProcedure
    .input(
      z.object({
        search: z.string().optional(),
        severity: z.array(z.nativeEnum(Severity)).optional(),
        findingSource: z.nativeEnum(RiskFindingSource).optional(),
        discoveryDateRange: z
          .object({
            start: z.date(),
            end: z.date(),
          })
          .optional(),
        sortBy: z
          .enum(["impactScore", "discoveryDate", "severity", "createdAt"])
          .default("impactScore"),
        sortOrder: z.enum(["asc", "desc"]).default("desc"),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      // AC33-AC35: Check authorization
      const allowedRoles: UserRole[] = [
        UserRole.ANALYST,
        UserRole.ANALYST,
        UserRole.ADMINISTRATOR,
        UserRole.BUSINESS_USER, // AC35: Read-only access
      ];

      if (!allowedRoles.includes(ctx.session!.user.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to access the assignment queue",
        });
      }

      // Build where clause (AC1, AC4, AC5)
      const whereClause: {
        organizationId: string;
        status: typeof RiskStatus.OPEN;
        OR?: { title?: { contains: string; mode: "insensitive" }; description?: { contains: string; mode: "insensitive" } }[];
        severity?: { in: Severity[] };
        findingSource?: RiskFindingSource;
        discoveryDate?: { gte?: Date; lte?: Date };
      } = {
        organizationId: ctx.organizationId!,
        status: RiskStatus.OPEN, // AC1: Unassigned risks only
      };

      // AC4: Search filter
      if (input.search && input.search.trim()) {
        whereClause.OR = [
          { title: { contains: input.search.trim(), mode: "insensitive" } },
          { description: { contains: input.search.trim(), mode: "insensitive" } },
        ];
      }

      // AC5: Severity filter
      if (input.severity && input.severity.length > 0) {
        whereClause.severity = { in: input.severity };
      }

      // AC5: Finding source filter
      if (input.findingSource) {
        whereClause.findingSource = input.findingSource;
      }

      // AC5: Discovery date range filter
      if (input.discoveryDateRange) {
        whereClause.discoveryDate = {
          gte: input.discoveryDateRange.start,
          lte: input.discoveryDateRange.end,
        };
      }

      // Build orderBy clause (AC3)
      let orderBy: Record<string, "asc" | "desc"> = {};
      if (input.sortBy === "impactScore") {
        orderBy = { impactScore: input.sortOrder };
      } else if (input.sortBy === "discoveryDate") {
        orderBy = { discoveryDate: input.sortOrder };
      } else if (input.sortBy === "severity") {
        // For severity, we need to handle the ordering manually
        // HIGH = 3, MEDIUM = 2, LOW = 1 for sorting purposes
        orderBy = { severity: input.sortOrder };
      } else if (input.sortBy === "createdAt") {
        orderBy = { createdAt: input.sortOrder };
      }

      // Fetch risks and count (AC2, AC6)
      const [risks, total] = await Promise.all([
        ctx.db.risk.findMany({
          where: whereClause,
          include: {
            CreatedBy: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy,
          skip: input.offset,
          take: input.limit,
        }),
        ctx.db.risk.count({ where: whereClause }),
      ]);

      return {
        risks,
        total,
        hasMore: input.offset + risks.length < total,
      };
    }),

  /**
   * Get assignment queue metrics (AC8-AC12)
   *
   * Returns summary metrics for the assignment queue including:
   * - Total unassigned count
   * - Highest impact score
   * - Average days unassigned
   * - Count by severity (HIGH/MEDIUM/LOW)
   * - Count of aging risks (>7 days)
   *
   * AC8: Queue page shows summary metrics at top
   * AC9: Metrics include all specified data points
   * AC10: Metrics update in real-time when risks assigned
   * AC11: Metrics highlight risks >7 days unassigned (aging risks indicator)
   * AC12: Metrics color-coded (red for >7 days, yellow for >3 days, green for <3 days)
   */
  getAssignmentQueueMetrics: organizationProcedure.query(async ({ ctx }) => {
    // Check authorization (same as getAssignmentQueue)
    const allowedRoles: UserRole[] = [
      UserRole.ANALYST,
      UserRole.ANALYST,
      UserRole.ADMINISTRATOR,
      UserRole.BUSINESS_USER,
    ];

    if (!allowedRoles.includes(ctx.session!.user.role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You do not have permission to access the assignment queue metrics",
      });
    }

    // Fetch all OPEN risks for metrics calculation
    const risks = await ctx.db.risk.findMany({
      where: {
        organizationId: ctx.organizationId!,
        status: RiskStatus.OPEN,
      },
      select: {
        id: true,
        title: true,
        impactScore: true,
        severity: true,
        createdAt: true,
      },
    });

    const totalUnassigned = risks.length;
    const now = Date.now();

    // Calculate highest impact score
    const highestImpact = risks.length > 0
      ? Math.max(...risks.map((r) => r.impactScore ?? 0))
      : 0;

    // Find the highest impact risk for preview
    const highestImpactRisk = risks.length > 0
      ? risks.reduce((prev, curr) =>
          (curr.impactScore ?? 0) > (prev.impactScore ?? 0) ? curr : prev
        )
      : null;

    // Calculate average days unassigned
    const avgDaysUnassigned =
      totalUnassigned > 0
        ? risks.reduce((sum: number, r: { createdAt: Date }) => {
            const days = Math.floor(
              (now - r.createdAt.getTime()) / (1000 * 60 * 60 * 24)
            );
            return sum + days;
          }, 0) / totalUnassigned
        : 0;

    // Count by severity (AC9)
    const severityCounts = {
      HIGH: risks.filter((r: { severity: Severity }) => r.severity === Severity.HIGH).length,
      MEDIUM: risks.filter((r: { severity: Severity }) => r.severity === Severity.MEDIUM).length,
      LOW: risks.filter((r: { severity: Severity }) => r.severity === Severity.LOW).length,
    };

    // Count aging risks (AC11): >7 days
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const agingRisks = risks.filter(
      (r: { createdAt: Date }) => r.createdAt.getTime() < sevenDaysAgo
    ).length;

    // Count for color coding (AC12)
    const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000;
    const risksOver3Days = risks.filter(
      (r: { createdAt: Date }) => r.createdAt.getTime() < threeDaysAgo && r.createdAt.getTime() >= sevenDaysAgo
    ).length;
    const risksUnder3Days = risks.filter(
      (r: { createdAt: Date }) => r.createdAt.getTime() >= threeDaysAgo
    ).length;

    return {
      totalUnassigned,
      highestImpact,
      highestImpactRisk: highestImpactRisk
        ? {
            id: highestImpactRisk.id,
            title: highestImpactRisk.title,
            impactScore: highestImpactRisk.impactScore,
          }
        : null,
      avgDaysUnassigned: Math.round(avgDaysUnassigned * 10) / 10, // Round to 1 decimal
      severityCounts,
      agingRisks, // >7 days (red)
      risksOver3Days, // 3-7 days (yellow)
      risksUnder3Days, // <3 days (green)
    };
  }),

  /**
   * Bulk assign risks (AC19-AC23)
   *
   * Assigns multiple risks to the same IT and/or Business owner.
   * Only GRC_ANALYST, SECURITY_ENGINEER, and ORG_ADMIN can bulk assign.
   *
   * AC19: Queue supports multi-select
   * AC20: Bulk actions toolbar appears when risks selected
   * AC21: Bulk "Assign to Same Owner" action opens dialog
   * AC22: Dialog allows assigning all selected risks to same IT and/or Business owner
   * AC23: Bulk assignment processes all risks and shows "X risks assigned" confirmation
   */
  bulkAssignRisks: organizationProcedure
    .use(requireRole(RISK_ASSIGN_ROLES))
    .input(
      z
        .object({
          riskIds: z.array(z.string()).min(1, "At least one risk must be selected"),
          itOwnerId: z.string().optional(),
          businessOwnerId: z.string().optional(),
        })
        .refine(
          (data) => data.itOwnerId || data.businessOwnerId,
          { message: "At least one owner (IT or Business) must be provided" }
        )
    )
    .mutation(async ({ ctx, input }) => {
      // Validate all risks exist and are OPEN
      const risks = await ctx.db.risk.findMany({
        where: {
          id: { in: input.riskIds },
          organizationId: ctx.organizationId!,
        },
        select: {
          id: true,
          title: true,
          status: true,
          itOwnerId: true,
          businessOwnerId: true,
        },
      });

      if (risks.length !== input.riskIds.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "One or more risks not found or do not belong to your organization",
        });
      }

      // Check for already assigned risks
      const alreadyAssigned = risks.filter(
        (r: { itOwnerId: string | null; businessOwnerId: string | null }) => r.itOwnerId || r.businessOwnerId
      );
      if (alreadyAssigned.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `${alreadyAssigned.length} risk(s) are already assigned. Use reassign for those.`,
        });
      }

      // Check for non-OPEN status
      const nonOpen = risks.filter((r: { status: RiskStatus }) => r.status !== RiskStatus.OPEN);
      if (nonOpen.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `${nonOpen.length} risk(s) are not in OPEN status and cannot be assigned.`,
        });
      }

      // Validate IT owner exists in org as a Person (if provided)
      if (input.itOwnerId) {
        const itOwner = await ctx.db.person.findFirst({
          where: {
            id: input.itOwnerId,
            organizationId: ctx.organizationId!,
          },
          select: { id: true, name: true },
        });

        if (!itOwner) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "IT Owner not found in your organization",
          });
        }
      }

      // Validate Business owner exists in org as a Person (if provided)
      if (input.businessOwnerId) {
        const businessOwner = await ctx.db.person.findFirst({
          where: {
            id: input.businessOwnerId,
            organizationId: ctx.organizationId!,
          },
          select: { id: true, name: true },
        });

        if (!businessOwner) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Business Owner not found in your organization",
          });
        }
      }

      // Bulk update all risks
      const updateData = {
        itOwnerId: input.itOwnerId ?? null,
        businessOwnerId: input.businessOwnerId ?? null,
        assignedAt: new Date(),
        assignedById: ctx.session!.user.id,
        status: RiskStatus.ASSIGNED,
      };

      await ctx.db.risk.updateMany({
        where: {
          id: { in: input.riskIds },
          organizationId: ctx.organizationId!,
        },
        data: updateData,
      });

      // Create status history for each risk
      await ctx.db.riskStatusHistory.createMany({
        data: input.riskIds.map((riskId) => ({
          riskId,
          oldStatus: RiskStatus.OPEN,
          newStatus: RiskStatus.ASSIGNED,
          changedById: ctx.session!.user.id,
          organizationId: ctx.organizationId!,
        })),
      });

      // Audit logging for bulk assignment
      for (const risk of risks) {
        void createAuditLog({
          organizationId: ctx.organizationId!,
          userId: ctx.session!.user.id,
          action: AuditAction.ASSIGN_RISK,
          entityType: "Risk",
          entityId: risk.id,
          changes: {
            before: {
              status: RiskStatus.OPEN,
              itOwnerId: null,
              businessOwnerId: null,
            },
            after: {
              status: RiskStatus.ASSIGNED,
              itOwnerId: input.itOwnerId ?? null,
              businessOwnerId: input.businessOwnerId ?? null,
              assignedAt: updateData.assignedAt,
              assignedById: ctx.session!.user.id,
              bulkAssignment: true,
            },
          },
          actorName: ctx.session!.user.name ?? "Unknown",
          actorRole: ctx.session!.user.role,
        });
      }

      return {
        assignedCount: input.riskIds.length,
        message: `${input.riskIds.length} risks assigned successfully`,
      };
    }),

  /**
   * Delete a risk (Story 4.17: AC11)
   *
   * Only GRC_ANALYST and ORG_ADMIN can delete risks.
   * Cascades to RiskEvidence, RemediationOptions, Comments, StatusHistory.
   */
  delete: organizationProcedure
    .use(requireRole([...WRITE_ROLES]))
    .input(
      z.object({
        id: z.string().min(1, "Risk ID is required"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify risk exists and belongs to org
      const risk = await ctx.db.risk.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          title: true,
          organizationId: true,
          status: true,
          enterpriseRiskId: true,
        },
      });

      if (!risk) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Risk not found",
        });
      }

      if (risk.organizationId !== ctx.organizationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Risk does not belong to your organization",
        });
      }

      // Delete related records first (cascade)
      await ctx.db.$transaction([
        // Delete linked evidence records
        ctx.db.riskEvidence.deleteMany({
          where: { riskId: input.id },
        }),
        // Delete remediation options
        ctx.db.remediationOption.deleteMany({
          where: { riskId: input.id },
        }),
        // Delete comments
        ctx.db.riskComment.deleteMany({
          where: { riskId: input.id },
        }),
        // Delete status history
        ctx.db.riskStatusHistory.deleteMany({
          where: { riskId: input.id },
        }),
        // Finally delete the risk
        ctx.db.risk.delete({
          where: { id: input.id },
        }),
      ]);

      // Enterprise Risk: recompute parent score after deletion
      if (risk.enterpriseRiskId) {
        await recomputeEnterpriseRiskScore(ctx.db, risk.enterpriseRiskId);
      }

      // Audit log
      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: AuditAction.DELETE_RISK,
        entityType: "Risk",
        entityId: input.id,
        changes: {
          before: {
            id: risk.id,
            title: risk.title,
            status: risk.status,
          },
          after: null,
        },
        actorName: ctx.session!.user.name ?? "Unknown",
        actorRole: ctx.session!.user.role,
      });

      return { success: true };
    }),

  /**
   * Story 5.6: Export Risks to CSV
   * AC17: Accepts same filter parameters as listRisks
   * AC18: Validates user has GRC_ANALYST, SECURITY_ENGINEER, ORG_ADMIN, or AUDITOR role
   * AC19: Fetches all filtered risks (no pagination limit for export)
   * AC20: Generates CSV using csv-stringify library
   * AC21: Returns CSV as downloadable content
   * AC22-AC24: Logs export action to audit trail
   */
  exportRisks: organizationProcedure
    .use(
      requireRole([
        UserRole.ANALYST,
        UserRole.ANALYST,
        UserRole.ADMINISTRATOR,
        UserRole.BUSINESS_USER,
      ])
    )
    .input(
      z.object({
        // Story 5.6 AC2: Export respects active filters
        search: z.string().optional(),
        severity: z.array(z.enum(["HIGH", "MEDIUM", "LOW"])).optional(),
        status: z.array(z.enum(["DRAFT", "PENDING_REVIEW", "OPEN", "ASSIGNED", "REMEDIATED", "CLOSED"])).optional(),
        frameworkId: z.string().optional(),
        findingSource: z.array(z.enum([
          "VULNERABILITY_SCAN",
          "PENETRATION_TEST",
          "AUDIT_FINDING",
          "SECURITY_REVIEW",
          "COMPLIANCE_ASSESSMENT",
          "OTHER",
        ])).optional(),
        itOwnerId: z.string().optional(),
        businessOwnerId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { search, severity, status, frameworkId, findingSource, itOwnerId, businessOwnerId } = input;

      // Build WHERE clause (same logic as list query)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {
        organizationId: ctx.organizationId,
      };

      // Search filter
      if (search) {
        where.OR = [
          { title: { contains: search, mode: "insensitive" as const } },
          { description: { contains: search, mode: "insensitive" as const } },
        ];
      }

      // Multi-select severity filter
      if (severity && severity.length > 0) {
        where.severity = { in: severity };
      }

      // Multi-select status filter
      if (status && status.length > 0) {
        where.status = { in: status };
      }

      // Multi-select finding source filter
      if (findingSource && findingSource.length > 0) {
        where.findingSource = { in: findingSource };
      }

      // IT Owner filter
      if (itOwnerId) {
        where.itOwnerId = itOwnerId === "unassigned" ? null : itOwnerId;
      }

      // Business Owner filter
      if (businessOwnerId) {
        where.businessOwnerId = businessOwnerId === "unassigned" ? null : businessOwnerId;
      }

      // Framework filter
      if (frameworkId) {
        if (frameworkId === "none") {
          where.NOT = {
            RiskEvidence: {
              some: {
                Evidence: {
                  ControlDomains: {
                    some: {},
                  },
                },
              },
            },
          };
        } else {
          where.RiskEvidence = {
            some: {
              Evidence: {
                ControlDomains: {
                  some: {
                    ControlDomain: {
                      ControlDomainMappings: {
                        some: {
                          Control: {
                            frameworkId: frameworkId,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          };
        }
      }

      // AC19: Fetch all filtered risks (no pagination limit)
      const risks = await ctx.db.risk.findMany({
        where,
        include: {
          ITOwner: {
            select: { name: true, email: true },
          },
          BusinessOwner: {
            select: { name: true, email: true },
          },
          AssignedBy: {
            select: { name: true },
          },
          RiskEvidence: {
            include: {
              Evidence: {
                include: {
                  EvidenceControlDomain: {
                    include: {
                      ControlDomain: {
                        include: {
                          ControlDomainMapping: {
                            select: {
                              frameworkCode: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          RemediationOptions: {
            select: { id: true },
          },
          Comments: {
            where: { deletedAt: null },
            select: { id: true },
          },
        },
        orderBy: [{ impactScore: "desc" }, { createdAt: "desc" }],
      });

      // Collect all unique framework codes from risks
      const allFrameworkCodes = new Set<string>();
      risks.forEach((risk) => {
        risk.RiskEvidence.forEach((re) => {
          re.Evidence.EvidenceControlDomain.forEach((ecd) => {
            ecd.ControlDomain.ControlDomainMapping.forEach((m) => {
              allFrameworkCodes.add(m.frameworkCode);
            });
          });
        });
      });

      // Look up framework names for all codes
      const frameworks = allFrameworkCodes.size > 0
        ? await ctx.db.framework.findMany({
            where: { code: { in: Array.from(allFrameworkCodes) } },
            select: { code: true, name: true },
          })
        : [];
      const frameworkNameMap = new Map(frameworks.map((f) => [f.code, f.name]));

      // Transform risks to export data format
      const exportData: RiskExportData[] = risks.map((risk) => ({
        id: risk.id,
        title: risk.title,
        description: risk.description,
        severity: risk.severity,
        status: risk.status,
        impactScore: risk.impactScore,
        assetCriticality: risk.assetCriticality,
        findingSource: risk.findingSource,
        cveId: risk.cveId,
        discoveryDate: risk.discoveryDate,
        createdAt: risk.createdAt,
        updatedAt: risk.updatedAt,
        affectedSystems: risk.affectedSystems,
        closedAt: risk.status === "CLOSED" ? risk.updatedAt : null,
        itOwner: risk.ITOwner ? { name: risk.ITOwner.name, email: risk.ITOwner.email } : null,
        businessOwner: risk.BusinessOwner ? { name: risk.BusinessOwner.name, email: risk.BusinessOwner.email } : null,
        assignedAt: risk.assignedAt,
        assignedBy: risk.AssignedBy,
        linkedEvidence: risk.RiskEvidence.map((re) => ({
          evidence: {
            controlDomains: re.Evidence.EvidenceControlDomain.map((cd) => ({
              controlDomain: {
                ControlDomainMappings: cd.ControlDomain.ControlDomainMapping.map((m) => ({
                  Control: {
                    Framework: {
                      name: frameworkNameMap.get(m.frameworkCode) ?? m.frameworkCode,
                    },
                  },
                })),
              },
            })),
          },
        })),
        remediationOptions: risk.RemediationOptions,
        comments: risk.Comments,
      }));

      // AC20: Generate CSV using csv-stringify
      const csv = formatRisksForCSV(exportData);

      // AC4: Generate filename with current date
      const filename = generateExportFilename();

      // AC22-AC24: Audit log with filter parameters and row count
      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: AuditAction.EXPORT_RISKS,
        entityType: "Risk",
        entityId: "CSV_EXPORT",
        changes: {
          before: null,
          after: {
            exportType: "CSV",
            filters: {
              search: search ?? null,
              severity: severity ?? null,
              status: status ?? null,
              frameworkId: frameworkId ?? null,
              findingSource: findingSource ?? null,
              itOwnerId: itOwnerId ?? null,
              businessOwnerId: businessOwnerId ?? null,
            },
            rowCount: risks.length,
            filename,
          },
        },
        actorName: ctx.session!.user.name ?? "Unknown",
        actorRole: ctx.session!.user.role,
      });

      // AC21: Return CSV with filename for download
      return {
        filename,
        data: csv,
        rowCount: risks.length,
      };
    }),

  /**
   * Bulk-import risks from CSV rows (round-trips the exportRisks format).
   *
   * The client parses the CSV (see src/lib/riskCsv.ts) and sends already-typed
   * rows — mirroring riskAssessmentTemplate.importCsv. Each row becomes a new
   * Risk (org-scoped, identifier-generated, promoted to the register when the
   * actor can self-approve). Rows whose title already exists in the org are
   * skipped so re-importing an edited export doesn't duplicate. Returns a
   * per-run summary; a single failing row never aborts the batch.
   */
  importRisks: organizationProcedure
    .use(requireRole(RISK_CREATE_ROLES))
    .input(
      z.object({
        rows: z
          .array(
            z.object({
              title: z.string().min(1).max(500),
              description: z.string().min(1).max(10000),
              severity: z.nativeEnum(Severity),
              affectedSystems: z.string().max(5000).optional(),
              cveId: z.string().max(50).optional(),
              findingSource: z.nativeEnum(RiskFindingSource).optional(),
              assetCriticality: z.nativeEnum(AssetCriticality).optional(),
              discoveryDate: z.string().datetime().optional(),
            }),
          )
          .min(1, "No rows to import")
          .max(2000, "Import is limited to 2000 rows at a time"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;
      const canSelfApprove = APPROVE_ROLES.includes(
        ctx.session!.user.role as UserRole,
      );
      const initialStatus: RiskStatus = canSelfApprove
        ? RiskStatus.OPEN
        : RiskStatus.PENDING_REVIEW;

      let created = 0;
      let skipped = 0;
      const errors: Array<{ title: string; message: string }> = [];

      for (const row of input.rows) {
        try {
          // Dedupe by title within the org so re-importing an edited export
          // doesn't create duplicates.
          const existing = await ctx.db.risk.findFirst({
            where: { organizationId, title: row.title },
            select: { id: true },
          });
          if (existing) {
            skipped++;
            continue;
          }

          const identifier = await generateIdentifier(organizationId, "RISK");
          const risk = await ctx.db.risk.create({
            data: {
              identifier,
              title: row.title,
              description: row.description,
              severity: row.severity,
              status: initialStatus,
              affectedSystems: row.affectedSystems ?? null,
              cveId: row.cveId ?? null,
              findingSource: row.findingSource ?? null,
              assetCriticality: row.assetCriticality ?? "MEDIUM",
              discoveryDate: row.discoveryDate ? new Date(row.discoveryDate) : null,
              createdById: userId,
              organizationId,
            },
            select: { id: true },
          });

          // Match manual-create behaviour: an approver's own risk goes straight
          // into the register; otherwise it waits for approval.
          if (canSelfApprove) {
            await promoteRiskToRegister(ctx.db, organizationId, risk.id, userId);
          }
          created++;
        } catch (err) {
          errors.push({
            title: row.title,
            message: err instanceof Error ? err.message : "Failed to create risk",
          });
        }
      }

      // Single summary audit entry (no dedicated IMPORT action in the enum).
      void createAuditLog({
        organizationId,
        userId,
        action: AuditAction.CREATE_RISK,
        entityType: "Risk",
        entityId: "CSV_IMPORT",
        changes: {
          before: null,
          after: {
            source: "CSV",
            submitted: input.rows.length,
            created,
            skipped,
            failed: errors.length,
          },
        },
        actorName: ctx.session!.user.name ?? "Unknown",
        actorRole: ctx.session!.user.role,
      });

      return { created, skipped, errors };
    }),

  // ============================================================================
  // Story 15.5: MITRE ATT&CK Threat Modeling
  // ============================================================================

  /**
   * Set initial access vector for a risk
   */
  setInitialAccessVector: organizationProcedure
    .use(requireRole(RISK_UPDATE_ROLES))
    .input(
      z.object({
        riskId: z.string(),
        techniqueId: z.string().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      const risk = await ctx.db.risk.findFirst({
        where: { id: input.riskId, organizationId },
      });

      if (!risk) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Risk not found" });
      }

      // Validate technique exists if provided
      if (input.techniqueId) {
        const technique = await ctx.db.mitreTechnique.findUnique({
          where: { id: input.techniqueId },
        });
        if (!technique) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Technique not found" });
        }
      }

      const updated = await ctx.db.risk.update({
        where: { id: input.riskId },
        data: { initialAccessVectorId: input.techniqueId },
        include: {
          InitialAccessVector: { select: { id: true, externalId: true, name: true } },
        },
      });

      return updated;
    }),

  /**
   * Add a threat step technique to a risk
   */
  addThreatStep: organizationProcedure
    .use(requireRole(RISK_UPDATE_ROLES))
    .input(
      z.object({
        riskId: z.string(),
        techniqueId: z.string(),
        stepOrder: z.number().optional(),
        notes: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      const risk = await ctx.db.risk.findFirst({
        where: { id: input.riskId, organizationId },
      });

      if (!risk) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Risk not found" });
      }

      // Check technique exists
      const technique = await ctx.db.mitreTechnique.findUnique({
        where: { id: input.techniqueId },
      });
      if (!technique) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Technique not found" });
      }

      // Get current step count for ordering
      const existingSteps = await ctx.db.riskThreatStep.count({
        where: { riskId: input.riskId },
      });

      const step = await ctx.db.riskThreatStep.create({
        data: {
          riskId: input.riskId,
          techniqueId: input.techniqueId,
          stepOrder: input.stepOrder ?? existingSteps,
          notes: input.notes,
        },
        include: {
          technique: { select: { id: true, externalId: true, name: true } },
        },
      });

      return step;
    }),

  /**
   * Remove a threat step from a risk
   */
  removeThreatStep: organizationProcedure
    .use(requireRole(RISK_UPDATE_ROLES))
    .input(z.object({ stepId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      const step = await ctx.db.riskThreatStep.findFirst({
        where: { id: input.stepId },
        include: { risk: { select: { organizationId: true } } },
      });

      if (!step || step.risk.organizationId !== organizationId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Threat step not found" });
      }

      await ctx.db.riskThreatStep.delete({ where: { id: input.stepId } });

      return { success: true };
    }),

  /**
   * Reorder threat steps for a risk (Story 16.2 AC14)
   */
  reorderThreatSteps: organizationProcedure
    .use(requireRole(RISK_UPDATE_ROLES))
    .input(
      z.object({
        riskId: z.string(),
        stepIds: z.array(z.string()), // Array of step IDs in new order
      })
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      const risk = await ctx.db.risk.findFirst({
        where: { id: input.riskId, organizationId },
      });

      if (!risk) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Risk not found" });
      }

      // Update each step with new order
      await Promise.all(
        input.stepIds.map((stepId, index) =>
          ctx.db.riskThreatStep.update({
            where: { id: stepId },
            data: { stepOrder: index },
          })
        )
      );

      // Return updated steps
      const steps = await ctx.db.riskThreatStep.findMany({
        where: { riskId: input.riskId },
        orderBy: { stepOrder: "asc" },
        include: {
          technique: { select: { id: true, externalId: true, name: true } },
        },
      });

      return steps;
    }),

  /**
   * Add a threat objective technique to a risk
   */
  addThreatObjective: organizationProcedure
    .use(requireRole(RISK_UPDATE_ROLES))
    .input(
      z.object({
        riskId: z.string(),
        techniqueId: z.string(),
        notes: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      const risk = await ctx.db.risk.findFirst({
        where: { id: input.riskId, organizationId },
      });

      if (!risk) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Risk not found" });
      }

      const technique = await ctx.db.mitreTechnique.findUnique({
        where: { id: input.techniqueId },
      });
      if (!technique) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Technique not found" });
      }

      const objective = await ctx.db.riskThreatObjective.create({
        data: {
          riskId: input.riskId,
          techniqueId: input.techniqueId,
          notes: input.notes,
        },
        include: {
          technique: { select: { id: true, externalId: true, name: true } },
        },
      });

      return objective;
    }),

  /**
   * Remove a threat objective from a risk
   */
  removeThreatObjective: organizationProcedure
    .use(requireRole(RISK_UPDATE_ROLES))
    .input(z.object({ objectiveId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      const objective = await ctx.db.riskThreatObjective.findFirst({
        where: { id: input.objectiveId },
        include: { risk: { select: { organizationId: true } } },
      });

      if (!objective || objective.risk.organizationId !== organizationId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Threat objective not found" });
      }

      await ctx.db.riskThreatObjective.delete({ where: { id: input.objectiveId } });

      return { success: true };
    }),

  /**
   * Get MITRE threat modeling data for a risk
   */
  getThreatModeling: organizationProcedure
    .input(z.object({ riskId: z.string() }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      const risk = await ctx.db.risk.findFirst({
        where: { id: input.riskId, organizationId },
        include: {
          InitialAccessVector: {
            select: { id: true, externalId: true, name: true, url: true },
          },
          ThreatSteps: {
            orderBy: { stepOrder: "asc" },
            include: {
              technique: { select: { id: true, externalId: true, name: true, url: true } },
            },
          },
          ThreatObjectives: {
            include: {
              technique: { select: { id: true, externalId: true, name: true, url: true } },
            },
          },
        },
      });

      if (!risk) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Risk not found" });
      }

      return {
        initialAccessVector: risk.InitialAccessVector,
        threatSteps: risk.ThreatSteps,
        threatObjectives: risk.ThreatObjectives,
      };
    }),

  // ============================================================================
  // Story 15.8: Risk Treatment Management
  // ============================================================================

  /**
   * Create a treatment decision for a risk
   * Includes optional expected residual severity scoring
   */
  createTreatment: organizationProcedure
    .use(requireRole(RISK_UPDATE_ROLES))
    .input(
      z.object({
        riskId: z.string(),
        treatmentType: z.enum(["ACCEPT", "REMEDIATE", "TRANSFER", "AVOID"]),
        justification: z.string().min(1),
        slaDays: z.number().positive().optional(),
        // Treatment action details
        detail: z.string().optional().nullable(),
        assignedToId: z.string().optional().nullable(),
        treatmentBusinessUnitId: z.string().optional().nullable(),
        targetCompletionDate: z.date().optional().nullable(),
        // Optional expected residual severity after treatment
        residualLikelihood: z.number().min(1).max(10).optional().nullable(),
        residualImpact: z.number().min(1).max(10).optional().nullable(),
        residualExposure: z.number().min(1).max(10).optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      const risk = await ctx.db.risk.findFirst({
        where: { id: input.riskId, organizationId },
        select: {
          id: true,
          matrixVersionId: true,
          createdById: true,
        },
      });

      if (!risk) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Risk not found" });
      }

      // Story 23.1: segregation of duties — the acceptance decider cannot be
      // the risk's creator (NFR6: created_by vs approved_by are separate).
      if (input.treatmentType === "ACCEPT" && risk.createdById === userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Segregation of duties: the risk's creator cannot accept it — another authorized user must record the acceptance.",
        });
      }

      // Calculate due date if SLA provided
      const dueDate = input.slaDays
        ? new Date(Date.now() + input.slaDays * 24 * 60 * 60 * 1000)
        : null;

      // Prepare residual score data
      let residualScore: Prisma.Decimal | null = null;
      let residualScoreLabel: string | null = null;

      // Calculate residual score if likelihood and impact provided
      if (input.residualLikelihood && input.residualImpact) {
        // Get matrix version (locked or org's published version)
        let matrixVersion = null;

        if (risk.matrixVersionId) {
          matrixVersion = await ctx.db.riskMatrixVersion.findUnique({
            where: { id: risk.matrixVersionId },
            include: { template: true },
          });
        }

        // Fallback to org's default template's published version
        if (!matrixVersion) {
          const defaultTemplate = await ctx.db.riskMatrixTemplate.findFirst({
            where: {
              organizationId,
              isDefault: true,
              isActive: true,
              currentVersionId: { not: null },
            },
            select: { currentVersionId: true },
          });

          if (defaultTemplate?.currentVersionId) {
            matrixVersion = await ctx.db.riskMatrixVersion.findUnique({
              where: { id: defaultTemplate.currentVersionId },
              include: { template: true },
            });
          }
        }

        // Calculate score if we have a matrix version
        if (matrixVersion) {
          const scales = matrixVersion.scales as unknown as MatrixScales;
          const thresholds = matrixVersion.thresholds as unknown as Threshold[];
          const outputScaleMax = Number(matrixVersion.template.outputScaleMax);

          const scoreResult = calculateInherentScore(
            scales,
            thresholds,
            outputScaleMax,
            input.residualLikelihood,
            input.residualImpact,
            input.residualExposure ?? undefined
          );

          if (isScoreResult(scoreResult)) {
            residualScore = new Prisma.Decimal(scoreResult.normalizedScore);
            residualScoreLabel = scoreResult.label;
          }
        }
      }

      const treatment = await ctx.db.riskTreatment.create({
        data: {
          organizationId,
          riskId: input.riskId,
          treatmentType: input.treatmentType,
          justification: input.justification,
          slaDays: input.slaDays,
          dueDate,
          decidedById: userId,
          // Treatment action details
          detail: input.detail ?? null,
          assignedToId: input.assignedToId ?? null,
          treatmentBusinessUnitId: input.treatmentBusinessUnitId ?? null,
          targetCompletionDate: input.targetCompletionDate ?? null,
          actionStatus: "NOT_STARTED",
          // Residual severity fields
          residualLikelihood: input.residualLikelihood
            ? new Prisma.Decimal(input.residualLikelihood)
            : null,
          residualImpact: input.residualImpact
            ? new Prisma.Decimal(input.residualImpact)
            : null,
          residualExposure: input.residualExposure
            ? new Prisma.Decimal(input.residualExposure)
            : null,
          residualScore,
          residualScoreLabel,
        },
        include: {
          decidedBy: { select: { id: true, name: true, email: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
          treatmentBusinessUnit: { select: { id: true, name: true } },
        },
      });

      // Story 23.1: a fresh treatment decision resolves any pending
      // acceptance re-review flag.
      await ctx.db.risk.update({
        where: { id: input.riskId },
        data: { acceptanceReReviewRequired: false },
      });

      // Audit log
      await createAuditLog({
        action: AuditAction.RISK_TREATMENT_CREATED,
        entityType: "RiskTreatment",
        entityId: treatment.id,
        userId,
        organizationId,
        changes: {
          before: null,
          after: {
            riskId: input.riskId,
            treatmentType: input.treatmentType,
            slaDays: input.slaDays,
            dueDate: dueDate?.toISOString(),
            residualLikelihood: input.residualLikelihood,
            residualImpact: input.residualImpact,
            residualExposure: input.residualExposure,
            residualScore: residualScore ? Number(residualScore) : null,
            residualScoreLabel,
          },
        },
      });

      return treatment;
    }),

  /**
   * Complete a treatment
   * Syncs residual scores from treatment to the Risk model
   */
  completeTreatment: organizationProcedure
    .use(requireRole(RISK_UPDATE_ROLES))
    .input(z.object({ treatmentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      const treatment = await ctx.db.riskTreatment.findFirst({
        where: { id: input.treatmentId, organizationId },
      });

      if (!treatment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Treatment not found" });
      }

      if (treatment.completedAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Treatment already completed" });
      }

      const updated = await ctx.db.riskTreatment.update({
        where: { id: input.treatmentId },
        data: {
          completedAt: new Date(),
          completedById: userId,
        },
        include: {
          decidedBy: { select: { id: true, name: true, email: true } },
          completedBy: { select: { id: true, name: true, email: true } },
        },
      });

      // Sync residual scores to the Risk model if treatment has residual scores set
      if (
        treatment.residualLikelihood !== null ||
        treatment.residualImpact !== null ||
        treatment.residualScore !== null
      ) {
        await ctx.db.risk.update({
          where: { id: treatment.riskId },
          data: {
            residualLikelihood: treatment.residualLikelihood,
            residualImpact: treatment.residualImpact,
            residualExposure: treatment.residualExposure,
            residualScore: treatment.residualScore,
            residualScoreLabel: treatment.residualScoreLabel,
          },
        });

        // Audit log for risk residual update
        await createAuditLog({
          action: "UPDATE_RISK" as AuditAction,
          entityType: "Risk",
          entityId: treatment.riskId,
          userId,
          organizationId,
          changes: {
            before: null,
            after: {
              residualLikelihood: treatment.residualLikelihood
                ? Number(treatment.residualLikelihood)
                : null,
              residualImpact: treatment.residualImpact
                ? Number(treatment.residualImpact)
                : null,
              residualExposure: treatment.residualExposure
                ? Number(treatment.residualExposure)
                : null,
              residualScore: treatment.residualScore
                ? Number(treatment.residualScore)
                : null,
              residualScoreLabel: treatment.residualScoreLabel,
              syncedFromTreatmentId: treatment.id,
            },
          },
        });
      }

      // Audit log for treatment completion
      await createAuditLog({
        action: AuditAction.RISK_TREATMENT_COMPLETED,
        entityType: "RiskTreatment",
        entityId: treatment.id,
        userId,
        organizationId,
        changes: {
          before: { completedAt: null },
          after: {
            riskId: treatment.riskId,
            treatmentType: treatment.treatmentType,
            completedAt: updated.completedAt?.toISOString(),
          },
        },
      });

      return updated;
    }),

  /**
   * Get treatments for a risk
   */
  getTreatments: organizationProcedure
    .input(z.object({ riskId: z.string() }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      const treatments = await ctx.db.riskTreatment.findMany({
        where: { riskId: input.riskId, organizationId },
        orderBy: { createdAt: "desc" },
        include: {
          decidedBy: { select: { id: true, name: true, email: true } },
          completedBy: { select: { id: true, name: true, email: true } },
        },
      });

      return treatments;
    }),

  // ============================================================================
  // Risk Assessment Assignment Workflow
  // Story: Risk Assessment Assignment & Approval Workflow
  // ============================================================================

  /**
   * Assign a risk assessment to a user
   *
   * Creates a new risk in DRAFT status assigned to the specified assessor.
   * Only GRC_ANALYST and ORG_ADMIN can assign assessments.
   */
  assignAssessment: organizationProcedure
    .input(
      z.object({
        title: z.string().min(1, "Title is required"),
        description: z.string().optional(),
        assessorId: z.string().min(1, "Assessor is required"),
        dueDate: z.date().optional(),
        businessUnitId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;
      const userRole = ctx.session!.user.role as UserRole;

      // Only managers can assign assessments
      if (userRole !== UserRole.ANALYST && userRole !== UserRole.ADMINISTRATOR) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only GRC Analysts and Admins can assign risk assessments",
        });
      }

      // Verify assessor exists in the same organization
      const assessor = await ctx.db.user.findFirst({
        where: {
          id: input.assessorId,
          organizationId,
        },
      });

      if (!assessor) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessor not found in your organization",
        });
      }

      // Generate risk identifier
      const identifier = await generateIdentifier(organizationId, "RISK");

      // Create the risk in DRAFT status
      const risk = await ctx.db.risk.create({
        data: {
          identifier,
          organizationId,
          title: input.title,
          description: input.description ?? "",
          severity: "MEDIUM", // Default, assessor will update
          status: "DRAFT",
          assessorId: input.assessorId,
          assessmentCreatedById: userId,
          assessmentCreatedAt: new Date(),
          assessmentDueDate: input.dueDate,
          businessUnitId: input.businessUnitId,
          createdById: userId,
        },
        include: {
          Assessor: { select: { id: true, name: true, email: true } },
          AssessmentCreatedBy: { select: { id: true, name: true, email: true } },
        },
      });

      // Audit log
      void createAuditLog({
        organizationId,
        userId,
        action: AuditAction.CREATE_RISK,
        entityType: "Risk",
        entityId: risk.id,
        changes: {
          before: null,
          after: {
            id: risk.id,
            title: risk.title,
            status: "DRAFT",
            assessorId: input.assessorId,
            dueDate: input.dueDate?.toISOString() ?? null,
          },
        },
      });

      return risk;
    }),

  /**
   * Get assessments assigned to the current user (My Assignments)
   *
   * Returns risks in DRAFT status where the current user is the assessor.
   */
  getMyAssignments: organizationProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
        includeSubmitted: z.boolean().default(false), // Include PENDING_REVIEW
      })
    )
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      const statusFilter: RiskStatus[] = input.includeSubmitted
        ? [RiskStatus.DRAFT, RiskStatus.PENDING_REVIEW]
        : [RiskStatus.DRAFT];

      const [risks, total] = await Promise.all([
        ctx.db.risk.findMany({
          where: {
            organizationId,
            assessorId: userId,
            status: { in: statusFilter },
          },
          include: {
            AssessmentCreatedBy: { select: { id: true, name: true, email: true } },
            BusinessUnit: { select: { id: true, name: true } },
          },
          orderBy: [
            { assessmentDueDate: "asc" }, // Soonest due first
            { assessmentCreatedAt: "desc" },
          ],
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        ctx.db.risk.count({
          where: {
            organizationId,
            assessorId: userId,
            status: { in: statusFilter },
          },
        }),
      ]);

      return {
        risks,
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(total / input.pageSize),
      };
    }),

  /**
   * Get assessments pending review (Review Queue)
   *
   * Returns risks in PENDING_REVIEW status for manager review.
   * Only GRC_ANALYST and ORG_ADMIN can access this.
   */
  getReviewQueue: organizationProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userRole = ctx.session!.user.role as UserRole;

      // Only managers can view the review queue
      if (userRole !== UserRole.ANALYST && userRole !== UserRole.ADMINISTRATOR) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only GRC Analysts and Admins can view the review queue",
        });
      }

      const [risks, total] = await Promise.all([
        ctx.db.risk.findMany({
          where: {
            organizationId,
            status: RiskStatus.PENDING_REVIEW,
          },
          include: {
            Assessor: { select: { id: true, name: true, email: true } },
            AssessmentCreatedBy: { select: { id: true, name: true, email: true } },
            BusinessUnit: { select: { id: true, name: true } },
          },
          orderBy: [
            { assessmentSubmittedAt: "asc" }, // Oldest submissions first
          ],
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        ctx.db.risk.count({
          where: {
            organizationId,
            status: RiskStatus.PENDING_REVIEW,
          },
        }),
      ]);

      return {
        risks,
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(total / input.pageSize),
      };
    }),

  /**
   * Submit assessment for review
   *
   * Transitions a DRAFT risk to PENDING_REVIEW.
   * Only the assigned assessor can submit.
   */
  submitForReview: organizationProcedure
    .input(
      z.object({
        riskId: z.string().min(1, "Risk ID is required"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      const risk = await ctx.db.risk.findFirst({
        where: {
          id: input.riskId,
          organizationId,
        },
      });

      if (!risk) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Risk not found",
        });
      }

      // Only the assessor can submit
      if (risk.assessorId !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the assigned assessor can submit for review",
        });
      }

      // Must be in DRAFT status
      if (risk.status !== RiskStatus.DRAFT) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only draft assessments can be submitted for review",
        });
      }

      const updated = await ctx.db.risk.update({
        where: { id: input.riskId },
        data: {
          status: RiskStatus.PENDING_REVIEW,
          assessmentSubmittedAt: new Date(),
        },
      });

      // Record status history
      await ctx.db.riskStatusHistory.create({
        data: {
          riskId: input.riskId,
          oldStatus: RiskStatus.DRAFT,
          newStatus: RiskStatus.PENDING_REVIEW,
          changedById: userId,
          organizationId,
        },
      });

      // Audit log
      void createAuditLog({
        organizationId,
        userId,
        action: AuditAction.UPDATE_RISK,
        entityType: "Risk",
        entityId: input.riskId,
        changes: {
          before: { status: "DRAFT" },
          after: { status: "PENDING_REVIEW", submittedAt: new Date().toISOString() },
        },
      });

      return updated;
    }),

  /**
   * Approve an assessment
   *
   * Transitions a PENDING_REVIEW risk to OPEN (enters the risk register).
   * Only GRC_ANALYST and ORG_ADMIN can approve.
   */
  approveAssessment: organizationProcedure
    .input(
      z.object({
        riskId: z.string().min(1, "Risk ID is required"),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;
      const userRole = ctx.session!.user.role as UserRole;

      // Only approvers can approve. This previously admitted ANALYST and
      // rejected MANAGER — inverted, and it defeated the point of review,
      // since an analyst could sign off the risk they had just raised.
      if (!APPROVE_ROLES.includes(userRole)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only Managers and Administrators can approve risks",
        });
      }

      const risk = await ctx.db.risk.findFirst({
        where: {
          id: input.riskId,
          organizationId,
        },
      });

      if (!risk) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Risk not found",
        });
      }

      // Must be in PENDING_REVIEW status
      if (risk.status !== RiskStatus.PENDING_REVIEW) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only pending review assessments can be approved",
        });
      }

      const updated = await ctx.db.risk.update({
        where: { id: input.riskId },
        data: {
          status: RiskStatus.OPEN,
          assessmentReviewerId: userId,
          assessmentReviewedAt: new Date(),
          assessmentReviewNotes: input.notes,
        },
      });

      // Approval is the signature the register was waiting for. Owner is the
      // person who raised the risk, not the approver.
      await promoteRiskToRegister(
        ctx.db,
        organizationId,
        input.riskId,
        risk.createdById ?? userId,
      );

      // Record status history
      await ctx.db.riskStatusHistory.create({
        data: {
          riskId: input.riskId,
          oldStatus: RiskStatus.PENDING_REVIEW,
          newStatus: RiskStatus.OPEN,
          changedById: userId,
          organizationId,
          reason: input.notes ?? "Assessment approved",
        },
      });

      // Audit log
      void createAuditLog({
        organizationId,
        userId,
        action: AuditAction.UPDATE_RISK,
        entityType: "Risk",
        entityId: input.riskId,
        changes: {
          before: { status: "PENDING_REVIEW" },
          after: { status: "OPEN", reviewedAt: new Date().toISOString(), reviewedBy: userId },
        },
      });

      return updated;
    }),

  /**
   * Reject an assessment
   *
   * Transitions a PENDING_REVIEW risk back to DRAFT with feedback.
   * Only GRC_ANALYST and ORG_ADMIN can reject.
   * SLA is reset on rejection.
   */
  rejectAssessment: organizationProcedure
    .input(
      z.object({
        riskId: z.string().min(1, "Risk ID is required"),
        notes: z.string().min(1, "Rejection notes are required"),
        newDueDate: z.date().optional(), // Optional new SLA deadline
      })
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;
      const userRole = ctx.session!.user.role as UserRole;

      // Only managers can reject
      if (userRole !== UserRole.ANALYST && userRole !== UserRole.ADMINISTRATOR) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only GRC Analysts and Admins can reject assessments",
        });
      }

      const risk = await ctx.db.risk.findFirst({
        where: {
          id: input.riskId,
          organizationId,
        },
      });

      if (!risk) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Risk not found",
        });
      }

      // Must be in PENDING_REVIEW status
      if (risk.status !== RiskStatus.PENDING_REVIEW) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only pending review assessments can be rejected",
        });
      }

      // Calculate new due date (fresh SLA on rejection)
      // If not provided, use the organization's default SLA (7 days as default)
      const newDueDate = input.newDueDate ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const updated = await ctx.db.risk.update({
        where: { id: input.riskId },
        data: {
          status: RiskStatus.DRAFT,
          assessmentReviewerId: userId,
          assessmentReviewedAt: new Date(),
          assessmentReviewNotes: input.notes,
          assessmentDueDate: newDueDate,
          assessmentRevisionCount: { increment: 1 },
          assessmentSubmittedAt: null, // Clear submission timestamp
        },
      });

      // Record status history
      await ctx.db.riskStatusHistory.create({
        data: {
          riskId: input.riskId,
          oldStatus: RiskStatus.PENDING_REVIEW,
          newStatus: RiskStatus.DRAFT,
          changedById: userId,
          organizationId,
          reason: input.notes,
        },
      });

      // Audit log
      void createAuditLog({
        organizationId,
        userId,
        action: AuditAction.UPDATE_RISK,
        entityType: "Risk",
        entityId: input.riskId,
        changes: {
          before: { status: "PENDING_REVIEW" },
          after: {
            status: "DRAFT",
            rejectedAt: new Date().toISOString(),
            rejectedBy: userId,
            rejectionNotes: input.notes,
            revisionCount: (risk.assessmentRevisionCount ?? 0) + 1,
          },
        },
      });

      return updated;
    }),

  // ===============================================
  // Risk Assessment Creation (New Form)
  // ===============================================

  /**
   * Create a new risk assessment with multiple identified risks
   *
   * Creates an assessment with:
   * - Assessment header (title, description, business context, matrix version)
   * - Multiple child risk records with MITRE ATT&CK mapping
   * - Controls documentation
   * - Severity scoring (inherent/residual)
   * - Treatment decisions
   */
  createAssessment: organizationProcedure
    .use(requireRole(RISK_CREATE_ROLES))
    .input(
      z.object({
        title: z.string().min(5, "Title must be at least 5 characters").max(200),
        matrixVersionId: z.string().min(1, "Matrix version is required"),
        description: z.string().optional().nullable(),
        businessOwnerId: z.string().optional().nullable(),
        businessUnitId: z.string().optional().nullable(),
        performedById: z.string().optional().nullable(),
        overallSeverity: z.string().optional().nullable(),
        // Optional asset / process linkage — loss values snapshot at create time.
        linkedAssetId: z.string().optional().nullable(),
        linkedBusinessProcessId: z.string().optional().nullable(),
        risks: z.array(
          z.object({
            title: z.string().min(5, "Risk title must be at least 5 characters").max(200),
            riskStatement: z.string().min(10, "Risk statement must be at least 10 characters"),
            controlDomainId: z.string().optional().nullable(),
            initialAccessVectorId: z.string().optional().nullable(),
            threatStepIds: z.array(z.string()).default([]),
            threatObjectiveIds: z.array(z.string()).default([]),
            mitigatingControlsInPlace: z.string().optional().nullable(),
            preventativeControlsInPlace: z.string().optional().nullable(),
            mitigatingControlsNeeded: z.string().optional().nullable(),
            preventativeControlsNeeded: z.string().optional().nullable(),
            controlLinkIds: z.array(z.string()).default([]),
            mitigatingControlIds: z.array(z.string()).default([]),
            controlGapIds: z.array(z.string()).default([]),
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
              .default([]),
            inherentLikelihood: z.number().optional().nullable(),
            inherentImpact: z.number().optional().nullable(),
            inherentExposure: z.number().optional().nullable(),
            residualLikelihood: z.number().optional().nullable(),
            residualImpact: z.number().optional().nullable(),
            residualExposure: z.number().optional().nullable(),
            residualEliminated: z.boolean().optional().default(false),
            treatment: z.enum(["ACCEPT", "REMEDIATE"]).optional().nullable(),
            treatmentDueDate: z.date().optional().nullable(),
            evidenceIds: z.array(z.string()).default([]),
          })
        ).min(1, "At least one risk must be identified"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      // Validate matrix version exists and get details
      const matrixVersion = await ctx.db.riskMatrixVersion.findUnique({
        where: { id: input.matrixVersionId },
        include: { template: true },
      });

      if (!matrixVersion) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Risk matrix version not found",
        });
      }

      if (matrixVersion.template.organizationId !== organizationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Risk matrix does not belong to your organization",
        });
      }

      // Get matrix scales and thresholds for scoring. Use the template's
      // configured outputScaleMax — computing it as gridSize^dim ignores the
      // actual scale values, which inflates scores when any scale uses
      // non-integer steps (e.g. exposure {0.2, 0.6, 1}).
      const scales = matrixVersion.scales as unknown as MatrixScales;
      const thresholds = matrixVersion.thresholds as unknown as Threshold[];
      const is3D = matrixVersion.template.dimensionCount === 3;
      const outputScaleMax = Number(matrixVersion.template.outputScaleMax);

      // Snapshot loss values from linked asset / process (frozen at link time).
      let inheritedLossMinimum: number | null = null;
      let inheritedLossProbable: number | null = null;
      let inheritedLossMaximum: number | null = null;
      if (input.linkedAssetId) {
        const a = await ctx.db.asset.findFirst({
          where: { id: input.linkedAssetId, organizationId },
          select: { lossMinimum: true, lossProbable: true, lossMaximum: true },
        });
        if (!a) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Linked asset not found" });
        }
        inheritedLossMinimum = a.lossMinimum ? Number(a.lossMinimum) : null;
        inheritedLossProbable = a.lossProbable ? Number(a.lossProbable) : null;
        inheritedLossMaximum = a.lossMaximum ? Number(a.lossMaximum) : null;
      }
      if (input.linkedBusinessProcessId) {
        const p = await ctx.db.businessProcess.findFirst({
          where: { id: input.linkedBusinessProcessId, organizationId },
          select: { lossMinimum: true, lossProbable: true, lossMaximum: true },
        });
        if (!p) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Linked business process not found" });
        }
        // If both are linked, take the wider range so the assessment captures
        // the worst-case envelope. Asset values are already loaded above.
        const pMin = p.lossMinimum ? Number(p.lossMinimum) : null;
        const pProb = p.lossProbable ? Number(p.lossProbable) : null;
        const pMax = p.lossMaximum ? Number(p.lossMaximum) : null;
        inheritedLossMinimum =
          inheritedLossMinimum === null ? pMin :
          pMin === null ? inheritedLossMinimum :
          Math.min(inheritedLossMinimum, pMin);
        inheritedLossProbable =
          inheritedLossProbable === null ? pProb :
          pProb === null ? inheritedLossProbable :
          Math.max(inheritedLossProbable, pProb);
        inheritedLossMaximum =
          inheritedLossMaximum === null ? pMax :
          pMax === null ? inheritedLossMaximum :
          Math.max(inheritedLossMaximum, pMax);
      }
      const inheritedLossSnapshotAt =
        input.linkedAssetId || input.linkedBusinessProcessId ? new Date() : null;

      // Create all risks in a transaction, wrapped in a RiskAssessmentProject
      // so the assessment shows up on /risk-assessments. Each child Risk is
      // linked to the project via discoveryProjectId.
      const createdRisks = await ctx.db.$transaction(async (tx) => {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);

        const project = await tx.riskAssessmentProject.create({
          data: {
            organizationId,
            subject: input.title,
            description: input.description ?? null,
            matrixVersionId: input.matrixVersionId,
            assigneeId: input.performedById ?? userId,
            createdById: userId,
            dueDate,
            linkedAssetId: input.linkedAssetId ?? null,
            linkedBusinessProcessId: input.linkedBusinessProcessId ?? null,
            inheritedLossMinimum,
            inheritedLossProbable,
            inheritedLossMaximum,
            inheritedLossSnapshotAt,
          },
        });

        const risks = [];

        for (const riskInput of input.risks) {
          // Calculate inherent score
          let inherentScore: number | null = null;
          let inherentScoreLabel: string | null = null;
          if (riskInput.inherentLikelihood && riskInput.inherentImpact) {
            const scoreResult = calculateInherentScore(
              scales,
              thresholds,
              outputScaleMax,
              riskInput.inherentLikelihood,
              riskInput.inherentImpact,
              is3D ? riskInput.inherentExposure : null
            );
            if (isScoreResult(scoreResult)) {
              inherentScore = scoreResult.normalizedScore;
              inherentScoreLabel = scoreResult.label;
            }
          }

          // Calculate residual score. "Eliminated" skips the numeric path and
          // short-circuits the label so the UI can render an explicit badge
          // without any likelihood/impact inputs.
          let residualScore: number | null = null;
          let residualScoreLabel: string | null = null;
          if (riskInput.residualEliminated) {
            residualScoreLabel = "ELIMINATED";
          } else if (riskInput.residualLikelihood && riskInput.residualImpact) {
            const scoreResult = calculateInherentScore(
              scales,
              thresholds,
              outputScaleMax,
              riskInput.residualLikelihood,
              riskInput.residualImpact,
              is3D ? riskInput.residualExposure : null
            );
            if (isScoreResult(scoreResult)) {
              residualScore = scoreResult.normalizedScore;
              residualScoreLabel = scoreResult.label;
            }
          }

          // Determine severity from inherent score or use HIGH as default
          let severity: Severity = Severity.MEDIUM;
          if (inherentScoreLabel) {
            const labelUpper = inherentScoreLabel.toUpperCase();
            if (labelUpper === "CRITICAL" || labelUpper === "HIGH") {
              severity = Severity.HIGH;
            } else if (labelUpper === "LOW") {
              severity = Severity.LOW;
            }
          }

          // Generate risk identifier
          const identifier = await generateIdentifier(organizationId, "RISK");

          // Create the risk record
          const risk = await tx.risk.create({
            data: {
              identifier,
              organizationId,
              title: riskInput.title,
              description: riskInput.riskStatement,
              severity,
              status: RiskStatus.OPEN,
              createdById: userId,
              // Business context
              businessOwnerId: input.businessOwnerId,
              businessUnitId: input.businessUnitId,
              controlDomainId: riskInput.controlDomainId ?? null,
              discoveryProjectId: project.id,
              assessorId: input.performedById,
              assessmentCreatedAt: new Date(),
              assessmentCreatedById: userId,
              // Matrix version locked
              matrixVersionId: input.matrixVersionId,
              // MITRE
              initialAccessVectorId: riskInput.initialAccessVectorId,
              // Controls documentation
              mitigatingControlsInPlace: riskInput.mitigatingControlsInPlace,
              preventativeControlsInPlace: riskInput.preventativeControlsInPlace,
              mitigatingControlsNeeded: riskInput.mitigatingControlsNeeded,
              preventativeControlsNeeded: riskInput.preventativeControlsNeeded,
              // Inherent scoring
              inherentLikelihood: riskInput.inherentLikelihood
                ? new Prisma.Decimal(riskInput.inherentLikelihood)
                : null,
              inherentImpact: riskInput.inherentImpact
                ? new Prisma.Decimal(riskInput.inherentImpact)
                : null,
              inherentExposure: riskInput.inherentExposure
                ? new Prisma.Decimal(riskInput.inherentExposure)
                : null,
              inherentScore: inherentScore !== null
                ? new Prisma.Decimal(inherentScore)
                : null,
              inherentScoreLabel,
              // Residual scoring — eliminated risks carry a label only
              residualLikelihood: !riskInput.residualEliminated && riskInput.residualLikelihood
                ? new Prisma.Decimal(riskInput.residualLikelihood)
                : null,
              residualImpact: !riskInput.residualEliminated && riskInput.residualImpact
                ? new Prisma.Decimal(riskInput.residualImpact)
                : null,
              residualExposure: !riskInput.residualEliminated && riskInput.residualExposure
                ? new Prisma.Decimal(riskInput.residualExposure)
                : null,
              residualScore: residualScore !== null
                ? new Prisma.Decimal(residualScore)
                : null,
              residualScoreLabel,
              // Story 22.2: assessment risks are BORN in manual-score mode —
              // the card-entered judgment (residual preferred) becomes the
              // manual/effective score. The DRAFT→PENDING_REVIEW approval
              // workflow keeps operating on manually-scored risks.
              ...(residualScore !== null || inherentScore !== null
                ? {
                    useManualScore: true,
                    manualLikelihood:
                      riskInput.residualLikelihood ?? riskInput.inherentLikelihood
                        ? new Prisma.Decimal(
                            (riskInput.residualLikelihood ??
                              riskInput.inherentLikelihood)!
                          )
                        : null,
                    manualImpact:
                      riskInput.residualImpact ?? riskInput.inherentImpact
                        ? new Prisma.Decimal(
                            (riskInput.residualImpact ?? riskInput.inherentImpact)!
                          )
                        : null,
                    manualScore: new Prisma.Decimal(
                      (residualScore ?? inherentScore)!
                    ),
                    manualScoreLabel: residualScore !== null
                      ? residualScoreLabel
                      : inherentScoreLabel,
                    effectiveScore: new Prisma.Decimal(
                      (residualScore ?? inherentScore)!
                    ),
                    effectiveScoreLabel: residualScore !== null
                      ? residualScoreLabel
                      : inherentScoreLabel,
                    effectiveScoreSource: "MANUAL" as const,
                  }
                : {}),
            },
          });

          // Create MITRE threat steps
          if (riskInput.threatStepIds.length > 0) {
            await tx.riskThreatStep.createMany({
              data: riskInput.threatStepIds.map((techniqueId) => ({
                riskId: risk.id,
                techniqueId,
              })),
            });
          }

          // Create MITRE threat objectives
          if (riskInput.threatObjectiveIds.length > 0) {
            await tx.riskThreatObjective.createMany({
              data: riskInput.threatObjectiveIds.map((techniqueId) => ({
                riskId: risk.id,
                techniqueId,
              })),
            });
          }

          // Create control linkages. `controlLinkIds` is legacy (all IN_PLACE).
          // `mitigatingControlIds` and `controlGapIds` are the split-role picks
          // coming from the risk assessment form's /controls-backed pickers.
          const controlLinks: Array<{
            organizationalControlId: string;
            role: RiskOrgControlRole;
          }> = [];
          for (const id of riskInput.controlLinkIds) {
            controlLinks.push({ organizationalControlId: id, role: RiskOrgControlRole.IN_PLACE });
          }
          for (const id of riskInput.mitigatingControlIds) {
            if (!controlLinks.some((l) => l.organizationalControlId === id)) {
              controlLinks.push({ organizationalControlId: id, role: RiskOrgControlRole.IN_PLACE });
            }
          }
          for (const id of riskInput.controlGapIds) {
            if (!controlLinks.some((l) => l.organizationalControlId === id)) {
              controlLinks.push({ organizationalControlId: id, role: RiskOrgControlRole.NEEDED });
            }
          }
          if (controlLinks.length > 0) {
            await tx.riskOrganizationalControl.createMany({
              data: controlLinks.map((link) => ({
                riskId: risk.id,
                organizationalControlId: link.organizationalControlId,
                organizationId,
                role: link.role,
                createdById: userId,
              })),
              skipDuplicates: true,
            });
          }

          // Per-risk remediation options (from the assessment form editor)
          if (riskInput.remediationOptions.length > 0) {
            await tx.remediationOption.createMany({
              data: riskInput.remediationOptions.map((opt) => ({
                riskId: risk.id,
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

          // Create treatment record if treatment selected.
          // Story 23.5 (review CR-1): ACCEPT is a segregated decision — the
          // risk's creator cannot decide it, and in this flow the decider
          // would always BE the creator. Acceptance intent stays on the
          // risk's proposal fields (acceptanceJustification et al. via the
          // card); the formal decision must come from another authorized
          // user through risk.createTreatment, which enforces the guard.
          if (riskInput.treatment && riskInput.treatment !== "ACCEPT") {
            // Get SLA days from threshold
            let slaDays = 30; // Default
            if (inherentScoreLabel) {
              const threshold = thresholds.find(
                (t) => t.label.toLowerCase() === inherentScoreLabel!.toLowerCase()
              );
              if (threshold) {
                slaDays = threshold.slaDays;
              }
            }

            await tx.riskTreatment.create({
              data: {
                id: randomUUID(),
                organizationId,
                riskId: risk.id,
                treatmentType: riskInput.treatment,
                justification: "Risk to be remediated",
                decidedById: userId,
                decidedAt: new Date(),
                slaDays,
                dueDate: riskInput.treatmentDueDate ?? new Date(Date.now() + slaDays * 24 * 60 * 60 * 1000),
              },
            });
          }

          risks.push(risk);
        }

        return risks;
      });

      // Create audit log for the assessment creation
      await createAuditLog({
        organizationId,
        userId,
        action: AuditAction.CREATE_RISK,
        entityType: "RiskAssessment",
        entityId: createdRisks[0]?.id ?? "unknown",
        changes: {
          before: null,
          after: {
            title: input.title,
            matrixVersionId: input.matrixVersionId,
            businessOwnerId: input.businessOwnerId,
            businessUnitId: input.businessUnitId,
            performedById: input.performedById,
            overallSeverity: input.overallSeverity,
            riskCount: createdRisks.length,
            riskIds: createdRisks.map((r: { id: string }) => r.id),
          },
        },
      });

      // Return the first risk (primary) with count
      return {
        id: createdRisks[0]?.id ?? "",
        risks: createdRisks,
        count: createdRisks.length,
      };
    }),

  /**
   * Rescind (soft-delete) a risk from an assessment
   *
   * Story 2.4: Rescind Discovered Risk
   *
   * - Only works for PENDING risks
   * - Only the assignee of the assessment can rescind
   * - Soft-deletes the risk (preserves audit trail)
   * - Sets discoveryProjectId to null to unlink from assessment
   */
  rescindFromAssessment: organizationProcedure
    .input(
      z.object({
        riskId: z.string().uuid(),
        assessmentId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { riskId, assessmentId } = input;

      // Fetch the assessment to verify ownership and status
      const assessment = await ctx.db.riskAssessmentProject.findFirst({
        where: {
          id: assessmentId,
          organizationId: ctx.organizationId,
        },
        select: {
          id: true,
          assigneeId: true,
          status: true,
        },
      });

      if (!assessment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment not found",
        });
      }

      // Verify user is the assignee
      if (assessment.assigneeId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the assigned analyst can rescind risks",
        });
      }

      // Verify assessment is IN_PROGRESS
      if (assessment.status !== "IN_PROGRESS") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only rescind risks from IN_PROGRESS assessments",
        });
      }

      // Fetch the risk to verify it belongs to this assessment and is PENDING
      const risk = await ctx.db.risk.findFirst({
        where: {
          id: riskId,
          organizationId: ctx.organizationId,
          discoveryProjectId: assessmentId,
        },
        select: {
          id: true,
          title: true,
          discoveryStatus: true,
        },
      });

      if (!risk) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Risk not found in this assessment",
        });
      }

      if (risk.discoveryStatus !== "PENDING") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only rescind PENDING risks",
        });
      }

      // Soft-delete the risk by unlinking from assessment
      // We set discoveryProjectId to null and mark as rescinded
      await ctx.db.risk.update({
        where: { id: riskId },
        data: {
          discoveryProjectId: null,
          discoveryStatus: null,
          // Optionally: could add a 'rescindedAt' field or status
        },
      });

      // Log the rescind action in audit trail
      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          userId: ctx.session.user.id,
          action: AuditAction.ASSESSMENT_RISK_RESCINDED,
          entityType: "Risk",
          entityId: riskId,
          changes: {
            action: "RESCIND_FROM_ASSESSMENT",
            riskTitle: risk.title,
            assessmentId,
          },
          actorName: ctx.session.user.name,
          actorRole: ctx.session.user.role,
        },
      });

      return { success: true, riskId };
    }),

  /**
   * Create a vendor-linked risk
   *
   * Epic 5: Vendor Risk & Finding Integration
   * FR48: GRC Analyst can create a vendor risk record linked to the Risk register
   */
  createVendorRisk: organizationProcedure
    .use(requireRole(RISK_CREATE_ROLES))
    .input(
      z.object({
        vendorId: z.string(),
        vendorAssessmentId: z.string().optional(),
        title: z.string().min(5, "Title must be at least 5 characters"),
        description: z.string().min(20, "Description must be at least 20 characters"),
        affectedSystems: z.string().optional(),
        severity: z.nativeEnum(Severity),
        findingSource: z.nativeEnum(RiskFindingSource).optional(),
        technicalDetails: z.string().max(10000).optional(),
        assetCriticality: z.nativeEnum(AssetCriticality).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      // Validate vendor exists in organization
      const vendor = await ctx.db.vendor.findFirst({
        where: { id: input.vendorId, organizationId },
      });
      if (!vendor) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Vendor not found",
        });
      }

      // Validate assessment if provided
      if (input.vendorAssessmentId) {
        const assessment = await ctx.db.vendorAssessment.findFirst({
          where: { id: input.vendorAssessmentId, organizationId },
        });
        if (!assessment) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Vendor assessment not found",
          });
        }
      }

      // Generate risk identifier
      const identifier = await generateIdentifier(organizationId, "RISK");

      // Create the risk with vendor linkage
      const risk = await ctx.db.risk.create({
        data: {
          identifier,
          title: input.title,
          description: input.description,
          affectedSystems: input.affectedSystems ?? null,
          severity: input.severity,
          status: "OPEN",
          createdById: userId,
          organizationId,
          findingSource: input.findingSource ?? null,
          technicalDetails: input.technicalDetails ?? null,
          assetCriticality: input.assetCriticality ?? "MEDIUM",
          // Epic 5: Vendor integration
          vendorId: input.vendorId,
          vendorAssessmentId: input.vendorAssessmentId ?? null,
        },
        include: {
          Vendor: { select: { id: true, name: true, identifier: true } },
          VendorAssessment: { select: { id: true, identifier: true, title: true } },
        },
      });

      // Audit logging
      void createAuditLog({
        organizationId,
        userId,
        action: "CREATE_RISK",
        entityType: "Risk",
        entityId: risk.id,
        changes: {
          before: null,
          after: {
            title: risk.title,
            severity: risk.severity,
            status: risk.status,
            vendorId: input.vendorId,
            vendorName: vendor.name,
            vendorAssessmentId: input.vendorAssessmentId,
          },
        },
        actorName: ctx.session!.user.name ?? "Unknown",
        actorRole: ctx.session!.user.role,
      });

      // Calculate impact score
      void recalculateRiskImpact(risk.id, ctx.db);

      return risk;
    }),

  /**
   * Get risks linked to a specific vendor
   *
   * Epic 5: FR49 - System displays vendor risks on the vendor profile
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

      return ctx.db.risk.findMany({
        where: {
          organizationId,
          vendorId: input.vendorId,
        },
        include: {
          CreatedBy: { select: { id: true, name: true, email: true } },
          ITOwner: { select: { id: true, name: true, email: true } },
          BusinessOwner: { select: { id: true, name: true, email: true } },
          VendorAssessment: { select: { id: true, identifier: true, title: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  /**
   * Create a lightweight risk from within a compliance assessment workspace.
   *
   * Mirrors finding.create's inline flow: creates a first-class register risk
   * tied to the assessment via Risk.sourceComplianceAssessmentId (+ optional
   * RiskControlLink), with assessment findings attached via RiskFindingLink
   * (recommended but optional — Story 21.1).
   */
  createForAssessment: organizationProcedure
    .use(requireRole(RISK_CREATE_ROLES))
    .input(
      z.object({
        title: z.string().min(1, "Title is required").max(500),
        description: z.string().min(1, "Description is required").max(10000),
        severity: z.nativeEnum(Severity),
        complianceAssessmentId: z.string().min(1),
        controlId: z.string().optional(),
        // Story 21.1: linking findings is recommended but OPTIONAL (FR5) —
        // an assessment risk can exist before any finding documents it.
        linkedFindingIds: z.array(z.string().min(1)).optional().default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      // Validate the compliance assessment belongs to this org.
      const assessment = await ctx.db.complianceAssessment.findFirst({
        where: { id: input.complianceAssessmentId, organizationId },
        select: { id: true },
      });
      if (!assessment) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid compliance assessment — must be in same organization",
        });
      }

      // De-duplicate ids, preserving order.
      const findingIds = Array.from(new Set(input.linkedFindingIds));

      // Linked findings (when provided) must be RAISED IN THIS ASSESSMENT.
      if (findingIds.length > 0) {
        const findings = await ctx.db.finding.findMany({
          where: {
            id: { in: findingIds },
            organizationId,
            sourceComplianceAssessmentId: input.complianceAssessmentId,
          },
          select: { id: true },
        });
        if (findings.length !== findingIds.length) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Every linked finding must be a finding from this assessment.",
          });
        }
      }

      // Generate risk identifier (RISK-YYYY-NNNN format).
      const identifier = await generateIdentifier(organizationId, "RISK");

      // Story 21.1: RiskFindingLink is the sole source of truth.
      const risk = await ctx.db.risk.create({
        data: {
          identifier,
          title: input.title,
          description: input.description,
          severity: input.severity,
          status: RiskStatus.OPEN,
          createdById: userId,
          organizationId,
          assetCriticality: "MEDIUM",
          sourceComplianceAssessmentId: input.complianceAssessmentId,
          // Surface the source in the register filters.
          findingSource: RiskFindingSource.COMPLIANCE_ASSESSMENT,
        },
        select: { id: true, identifier: true, title: true },
      });

      // Source of truth: create a RiskFindingLink for EACH linked finding.
      if (findingIds.length > 0) {
        await ctx.db.riskFindingLink.createMany({
          data: findingIds.map((findingId) => ({
            riskId: risk.id,
            findingId,
          })),
          skipDuplicates: true,
        });
        // Story 22.1: seed the derived score from the linked findings
        void recomputeRiskScore(ctx.db, risk.id, "risk-created-with-findings", userId);
      }

      // Auto-link to the compliance control when spawned from one (mirrors the
      // finding side's auto-link). AFFECTED = the risk affects this control.
      if (input.controlId) {
        await ctx.db.riskControlLink.create({
          data: {
            organizationId,
            riskId: risk.id,
            controlId: input.controlId,
            linkType: RiskControlLinkType.AFFECTED,
            createdById: userId,
          },
        });
      }

      void createAuditLog({
        organizationId,
        userId,
        action: "CREATE_RISK",
        entityType: "Risk",
        entityId: risk.id,
        changes: {
          before: null,
          after: {
            identifier: risk.identifier,
            title: risk.title,
            severity: input.severity,
            status: RiskStatus.OPEN,
            sourceComplianceAssessmentId: input.complianceAssessmentId,
            linkedFindingIds: findingIds,
            controlId: input.controlId ?? null,
          },
        },
        actorName: ctx.session!.user.name ?? "Unknown",
        actorRole: ctx.session!.user.role,
      });

      void recalculateRiskImpact(risk.id, ctx.db);

      return risk;
    }),

  /**
   * List risks spawned from a specific compliance assessment.
   * Mirrors finding.listForAssessment — used by the assessment's "Risks" tab.
   * Each row includes ALL its linked findings (findingLinks).
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

      // Map each assessment kind to the Risk source field it lives under.
      // - MATURITY: Risk has no maturity source field → no risks → [].
      // - RISK: risk-assessment risks are embedded discoveredRisks, not picked
      //   here → [] for now.
      // - BIA: no Risk↔BIA linkage → [] for now.
      // Short-circuit those before the DB call (keeps the picker working).
      let where: Prisma.RiskWhereInput;
      switch (input.assessmentType) {
        case "COMPLIANCE":
          where = { organizationId, sourceComplianceAssessmentId: input.assessmentId };
          break;
        case "VENDOR":
          where = { organizationId, vendorAssessmentId: input.assessmentId };
          break;
        case "MATURITY":
        case "RISK":
        case "BIA":
        default:
          return [];
      }

      return ctx.db.risk.findMany({
        where,
        select: {
          id: true,
          identifier: true,
          title: true,
          severity: true,
          inherentScoreLabel: true,
          status: true,
          createdAt: true,
          CreatedBy: { select: { id: true, name: true, email: true } },
          findingLinks: {
            select: {
              finding: {
                select: { id: true, identifier: true, title: true },
              },
            },
            orderBy: { createdAt: "asc" },
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
   * General-model finding linking from the risk side (Story 21.3). Contrast
   * addFinding below (assessment-scoped: the finding must belong to the same
   * compliance assessment): any non-terminal org finding qualifies and the
   * operation is idempotent. Audited as FINDING_RISK_LINKED on the Risk entity.
   */
  linkFindings: organizationProcedure
    .use(requireRole(RISK_UPDATE_ROLES))
    .input(
      z.object({
        riskId: z.string().min(1),
        findingIds: z.array(z.string().min(1)).min(1, "Select at least one finding"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      const risk = await ctx.db.risk.findFirst({
        where: { id: input.riskId, organizationId },
        select: { id: true },
      });
      if (!risk) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Risk not found" });
      }

      const findingIds = Array.from(new Set(input.findingIds));
      const validFindings = await ctx.db.finding.count({
        where: {
          id: { in: findingIds },
          organizationId,
          status: { notIn: ["DUPLICATE", "REJECTED", "CLOSED"] },
        },
      });
      if (validFindings !== findingIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Invalid finding(s) — must be non-terminal findings in the same organization",
        });
      }

      await ctx.db.riskFindingLink.createMany({
        data: findingIds.map((findingId) => ({ riskId: risk.id, findingId })),
        skipDuplicates: true,
      });

      void createAuditLog({
        organizationId,
        userId,
        action: AuditAction.FINDING_RISK_LINKED,
        entityType: "Risk",
        entityId: risk.id,
        changes: {
          before: null,
          after: { linkedFindingIds: findingIds },
        },
      });

      // Story 22.1: derived-score rollup (fire-and-forget)
      // Story 23.5 (review MJ-6): awaited so the client's immediate refetch
      // of risk.getById sees the settled rollup.
      await recomputeRiskScore(ctx.db, risk.id, "findings-linked", userId);

      return ctx.db.riskFindingLink.findMany({
        where: { riskId: risk.id },
        select: {
          finding: {
            select: {
              id: true,
              identifier: true,
              title: true,
              severity: true,
              severityLabel: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      });
    }),

  /**
   * Remove a risk↔finding link from the risk side (Story 21.3). Idempotent;
   * no last-link protection (linking is optional in the cleaned-up model) and
   * no spawn-sync. Audited as FINDING_RISK_UNLINKED on the Risk entity.
   */
  unlinkFinding: organizationProcedure
    .use(requireRole(RISK_UPDATE_ROLES))
    .input(
      z.object({
        riskId: z.string().min(1),
        findingId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      const risk = await ctx.db.risk.findFirst({
        where: { id: input.riskId, organizationId },
        select: { id: true },
      });
      if (!risk) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Risk not found" });
      }

      // Story 23.5 (review MJ-9): terminal findings' links are read-only from
      // BOTH sides (mirrors finding.unlinkRisk) — a closed finding's evidence
      // trail to its risks must not be silently destroyed.
      const linkedFinding = await ctx.db.finding.findFirst({
        where: { id: input.findingId, organizationId },
        select: { status: true },
      });
      if (linkedFinding && isTerminalFindingStatus(linkedFinding.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "This finding is in a terminal status - its risk links are read-only.",
        });
      }

      await ctx.db.riskFindingLink.deleteMany({
        where: { riskId: risk.id, findingId: input.findingId },
      });

      void createAuditLog({
        organizationId,
        userId,
        action: AuditAction.FINDING_RISK_UNLINKED,
        entityType: "Risk",
        entityId: risk.id,
        changes: {
          before: { findingId: input.findingId },
          after: null,
        },
      });

      // Story 22.1: derived-score rollup (fire-and-forget)
      // Story 23.5 (review MJ-6): awaited so the client's immediate refetch
      // of risk.getById sees the settled rollup.
      await recomputeRiskScore(ctx.db, risk.id, "finding-unlinked", userId);

      return { success: true };
    }),

  /**
   * ER-style risk creation (Story 22.3) — the register's /risks/new form.
   *
   * A risk is an AGGREGATION: identity fields (name, description, owner,
   * matrix, review cadence, BU, category) plus a score that comes from
   * linked findings (22.1 rollup) and/or a manual override (22.2). Direct
   * inherent/residual entry does not exist here. At least one scoring path
   * is required — a risk is never born unscoreable.
   */
  createAggregateRisk: organizationProcedure
    .use(requireRole(RISK_CREATE_ROLES))
    .input(
      z.object({
        title: z.string().min(5).max(200),
        description: z.string().min(10).max(10000),
        businessOwnerId: z.string().optional().nullable(),
        businessUnitId: z.string().optional().nullable(),
        controlDomainId: z.string().optional().nullable(),
        enterpriseRiskId: z.string().optional().nullable(),
        matrixVersionId: z.string().min(1, "Select a risk matrix"),
        reviewIntervalDays: z.number().int().positive().max(3650).optional().nullable(),
        // Scoring paths — at least one required (refined below)
        linkedFindingIds: z.array(z.string().min(1)).optional().default([]),
        manualLikelihood: z.number().positive().optional(),
        manualImpact: z.number().positive().optional(),
        manualExposure: z.number().positive().optional(),
      })
      .refine(
        (v) =>
          v.linkedFindingIds.length > 0 ||
          (v.manualLikelihood != null && v.manualImpact != null),
        { message: "Link at least one finding or set a manual score" }
      )
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      // Validate linked findings (org-scoped, non-terminal).
      const findingIds = Array.from(new Set(input.linkedFindingIds));
      if (findingIds.length > 0) {
        const valid = await ctx.db.finding.count({
          where: {
            id: { in: findingIds },
            organizationId,
            status: { notIn: ["DUPLICATE", "REJECTED", "CLOSED"] },
          },
        });
        if (valid !== findingIds.length) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid finding(s) — must be open findings in the same organization",
          });
        }
      }

      // Story 23.5 (review MJ-1): validate the remaining org-scoped foreign
      // ids against the caller's org before persisting them.
      if (input.enterpriseRiskId) {
        const ok = await ctx.db.enterpriseRisk.findFirst({
          where: { id: input.enterpriseRiskId, organizationId },
          select: { id: true },
        });
        if (!ok) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid enterprise risk - must be in same organization",
          });
        }
      }
      if (input.businessOwnerId) {
        const ok = await ctx.db.person.findFirst({
          where: { id: input.businessOwnerId, organizationId },
          select: { id: true },
        });
        if (!ok) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid owner - must be in same organization",
          });
        }
      }
      if (input.businessUnitId) {
        const ok = await ctx.db.businessUnit.findFirst({
          where: { id: input.businessUnitId, organizationId },
          select: { id: true },
        });
        if (!ok) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid business unit - must be in same organization",
          });
        }
      }
      // matrixVersionId is persisted on every path; on the findings-only path
      // computeMatrixScoring never runs, so verify ownership here (version ->
      // template -> organization).
      {
        const version = await ctx.db.riskMatrixVersion.findFirst({
          where: {
            id: input.matrixVersionId,
            template: { organizationId },
          },
          select: { id: true },
        });
        if (!version) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid risk matrix - must belong to your organization",
          });
        }
      }

      // Manual score path (22.2): score against the selected matrix.
      const hasManual = input.manualLikelihood != null && input.manualImpact != null;
      let manualScoring: Awaited<ReturnType<typeof computeMatrixScoring>> | null = null;
      if (hasManual) {
        manualScoring = await computeMatrixScoring(ctx.db, organizationId, {
          likelihood: input.manualLikelihood,
          impact: input.manualImpact,
          exposure: input.manualExposure,
          matrixVersionId: input.matrixVersionId,
        });
        if (manualScoring.inherentScore === null) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Selected matrix could not score the manual values",
          });
        }
      }

      const identifier = await generateIdentifier(organizationId, "RISK");

      const risk = await ctx.db.risk.create({
        data: {
          identifier,
          organizationId,
          title: input.title,
          description: input.description,
          status: RiskStatus.OPEN,
          createdById: userId,
          businessOwnerId: input.businessOwnerId ?? null,
          businessUnitId: input.businessUnitId ?? null,
          controlDomainId: input.controlDomainId ?? null,
          enterpriseRiskId: input.enterpriseRiskId ?? null,
          matrixVersionId: input.matrixVersionId,
          reviewIntervalDays: input.reviewIntervalDays ?? null,
          nextReviewDue: input.reviewIntervalDays
            ? new Date(Date.now() + input.reviewIntervalDays * 86400000)
            : null,
          // Advisory severity — refined below once the rollup lands.
          severity: manualScoring
            ? severityFromMatrixLabel(manualScoring.severityLabel)
            : Severity.MEDIUM,
          ...(manualScoring
            ? {
                useManualScore: true,
                manualLikelihood: new Prisma.Decimal(input.manualLikelihood!),
                manualImpact: new Prisma.Decimal(input.manualImpact!),
                manualExposure:
                  manualScoring.inherentExposure !== null
                    ? new Prisma.Decimal(manualScoring.inherentExposure)
                    : null,
                manualScore: new Prisma.Decimal(manualScoring.inherentScore!),
                manualScoreLabel: manualScoring.severityLabel,
              }
            : {}),
        },
        select: { id: true, identifier: true, title: true },
      });

      if (findingIds.length > 0) {
        await ctx.db.riskFindingLink.createMany({
          data: findingIds.map((findingId) => ({ riskId: risk.id, findingId })),
          skipDuplicates: true,
        });
      }

      // Awaited so the response carries the settled effective score.
      const scored = await recomputeRiskScore(
        ctx.db,
        risk.id,
        "risk-created-aggregate",
        userId
      );

      // Without a manual override, derive the coarse severity from the rollup.
      if (!manualScoring && scored && "effectiveScoreLabel" in scored) {
        await ctx.db.risk.update({
          where: { id: risk.id },
          data: {
            severity: severityFromMatrixLabel(
              (scored.effectiveScoreLabel as string | null) ?? null
            ),
          },
        });
      }

      void createAuditLog({
        organizationId,
        userId,
        action: "CREATE_RISK",
        entityType: "Risk",
        entityId: risk.id,
        changes: {
          before: null,
          after: {
            identifier: risk.identifier,
            title: risk.title,
            matrixVersionId: input.matrixVersionId,
            linkedFindingIds: findingIds,
            manualScore: manualScoring?.inherentScore ?? null,
            reviewIntervalDays: input.reviewIntervalDays ?? null,
          },
        },
        actorName: ctx.session!.user.name ?? "Unknown",
        actorRole: ctx.session!.user.role,
      });

      return ctx.db.risk.findUnique({
        where: { id: risk.id },
        select: {
          id: true,
          identifier: true,
          title: true,
          severity: true,
          useManualScore: true,
          manualScore: true,
          calculatedScore: true,
          effectiveScore: true,
          effectiveScoreLabel: true,
          effectiveScoreSource: true,
          nextReviewDue: true,
        },
      });
    }),

  /**
   * Set / change / remove the manual score override (Story 22.2).
   *
   * When enabled, L×I(×E) is scored against the risk's LOCKED matrix version
   * (org default fallback) and the effective score switches to MANUAL
   * immediately (recompute awaited). Disabling reverts effective to the
   * calculated rollup. Audited (UPDATE_RISK before/after of the override
   * fields; the recompute itself audits RISK_SCORE_RECALCULATED).
   */
  setManualScore: organizationProcedure
    .use(requireRole(RISK_UPDATE_ROLES))
    .input(
      z.object({
        riskId: z.string().min(1),
        enabled: z.boolean(),
        likelihood: z.number().positive().optional(),
        impact: z.number().positive().optional(),
        exposure: z.number().positive().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      const risk = await ctx.db.risk.findFirst({
        where: { id: input.riskId, organizationId },
        select: {
          id: true,
          matrixVersionId: true,
          useManualScore: true,
          manualLikelihood: true,
          manualImpact: true,
          manualScore: true,
          manualScoreLabel: true,
        },
      });
      if (!risk) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Risk not found" });
      }

      const before = {
        useManualScore: risk.useManualScore,
        manualScore: risk.manualScore?.toNumber() ?? null,
        manualScoreLabel: risk.manualScoreLabel,
      };

      if (input.enabled) {
        if (input.likelihood == null || input.impact == null) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Likelihood and impact are required for a manual score",
          });
        }
        // Score against the risk's own locked matrix (org default fallback).
        const scoring = await computeMatrixScoring(ctx.db, organizationId, {
          likelihood: input.likelihood,
          impact: input.impact,
          exposure: input.exposure,
          matrixVersionId: risk.matrixVersionId ?? undefined,
        });
        if (scoring.inherentScore === null) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No risk matrix available to score against",
          });
        }
        await ctx.db.risk.update({
          where: { id: risk.id },
          data: {
            useManualScore: true,
            manualLikelihood: new Prisma.Decimal(input.likelihood),
            manualImpact: new Prisma.Decimal(input.impact),
            manualExposure:
              scoring.inherentExposure !== null
                ? new Prisma.Decimal(scoring.inherentExposure)
                : null,
            manualScore: new Prisma.Decimal(scoring.inherentScore),
            manualScoreLabel: scoring.severityLabel,
            matrixVersionId: scoring.matrixVersionId ?? risk.matrixVersionId,
          },
        });
      } else {
        await ctx.db.risk.update({
          where: { id: risk.id },
          data: { useManualScore: false },
        });
      }

      // Effective must reflect the change immediately (AC1) — await it.
      const updated = await recomputeRiskScore(
        ctx.db,
        risk.id,
        input.enabled ? "manual-override-set" : "manual-override-removed",
        userId
      );

      void createAuditLog({
        organizationId,
        userId,
        action: "UPDATE_RISK",
        entityType: "Risk",
        entityId: risk.id,
        changes: {
          before,
          after: {
            useManualScore: input.enabled,
            manualScore: input.enabled
              ? (updated && "manualScore" in updated
                  ? (updated.manualScore as Prisma.Decimal | null)?.toNumber() ?? null
                  : null)
              : before.manualScore,
            manualLikelihood: input.enabled ? input.likelihood : null,
            manualImpact: input.enabled ? input.impact : null,
          },
        },
        actorName: ctx.session!.user.name ?? "Unknown",
        actorRole: ctx.session!.user.role,
      });

      return ctx.db.risk.findUnique({
        where: { id: risk.id },
        select: {
          id: true,
          useManualScore: true,
          manualScore: true,
          manualScoreLabel: true,
          calculatedScore: true,
          calculatedScoreLabel: true,
          effectiveScore: true,
          effectiveScoreLabel: true,
          effectiveScoreSource: true,
        },
      });
    }),

  /**
   * Linked findings for a risk's detail page (Story 21.3).
   */
  getLinkedFindings: organizationProcedure
    .input(z.object({ riskId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const risk = await ctx.db.risk.findFirst({
        where: { id: input.riskId, organizationId: ctx.organizationId! },
        select: { id: true },
      });
      if (!risk) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Risk not found" });
      }
      return ctx.db.riskFindingLink.findMany({
        where: { riskId: risk.id },
        select: {
          finding: {
            select: {
              id: true,
              identifier: true,
              title: true,
              severity: true,
              severityLabel: true,
              status: true,
              inherentScore: true,
            },
          },
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      });
    }),

  addFinding: organizationProcedure
    .use(requireRole(RISK_UPDATE_ROLES))
    .input(
      z.object({
        riskId: z.string().min(1),
        findingId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      const risk = await ctx.db.risk.findFirst({
        where: { id: input.riskId, organizationId },
        select: { id: true, sourceComplianceAssessmentId: true },
      });
      if (!risk) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Risk not found" });
      }

      // The finding must be in the SAME assessment as the risk.
      const finding = await ctx.db.finding.findFirst({
        where: {
          id: input.findingId,
          organizationId,
          sourceComplianceAssessmentId: risk.sourceComplianceAssessmentId,
        },
        select: { id: true, status: true },
      });
      if (!finding) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The finding must be from the same assessment as the risk.",
        });
      }
      // Story 23.5 (review MJ-9): terminal findings' links are read-only.
      if (isTerminalFindingStatus(finding.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "This finding is in a terminal status - its risk links are read-only.",
        });
      }

      // Idempotent: create the link only if it doesn't already exist.
      await ctx.db.riskFindingLink.createMany({
        data: [{ riskId: input.riskId, findingId: input.findingId }],
        skipDuplicates: true,
      });

      void createAuditLog({
        organizationId,
        userId,
        action: "UPDATE_RISK",
        entityType: "Risk",
        entityId: input.riskId,
        changes: {
          before: null,
          after: { addedFindingId: input.findingId },
        },
        actorName: ctx.session!.user.name ?? "Unknown",
        actorRole: ctx.session!.user.role,
      });

      // Story 22.1: derived-score rollup (fire-and-forget)
      void recomputeRiskScore(ctx.db, input.riskId, "finding-linked", userId);

      return ctx.db.riskFindingLink.findMany({
        where: { riskId: input.riskId },
        select: {
          finding: { select: { id: true, identifier: true, title: true } },
        },
        orderBy: { createdAt: "asc" },
      });
    }),

  /**
   * Remove a finding from a risk (deletes the RiskFindingLink).
   *
   * Story 23.5 (review MN-2): the legacy "risk must keep >=1 finding" rule is
   * gone — linking is recommended-but-optional in the cleaned-up model, and
   * the other unlink paths never enforced it. Terminal findings' links are
   * read-only (review MJ-9). Org-scoped.
   */
  removeFinding: organizationProcedure
    .use(requireRole(RISK_UPDATE_ROLES))
    .input(
      z.object({
        riskId: z.string().min(1),
        findingId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      const risk = await ctx.db.risk.findFirst({
        where: { id: input.riskId, organizationId },
        select: { id: true },
      });
      if (!risk) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Risk not found" });
      }

      const links = await ctx.db.riskFindingLink.findMany({
        where: { riskId: input.riskId },
        select: { id: true, findingId: true, finding: { select: { status: true } } },
      });

      const target = links.find((l) => l.findingId === input.findingId);
      if (!target) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That finding is not linked to this risk.",
        });
      }

      // Story 23.5 (review MJ-9): terminal findings' links are read-only.
      if (isTerminalFindingStatus(target.finding.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "This finding is in a terminal status - its risk links are read-only.",
        });
      }

      await ctx.db.riskFindingLink.delete({ where: { id: target.id } });

      void createAuditLog({
        organizationId,
        userId,
        action: "UPDATE_RISK",
        entityType: "Risk",
        entityId: input.riskId,
        changes: {
          before: { removedFindingId: input.findingId },
          after: null,
        },
        actorName: ctx.session!.user.name ?? "Unknown",
        actorRole: ctx.session!.user.role,
      });

      // Story 22.1: derived-score rollup (fire-and-forget)
      void recomputeRiskScore(ctx.db, input.riskId, "finding-unlinked", userId);

      return ctx.db.riskFindingLink.findMany({
        where: { riskId: input.riskId },
        select: {
          finding: { select: { id: true, identifier: true, title: true } },
        },
        orderBy: { createdAt: "asc" },
      });
    }),

  /**
   * Matrix-adaptive risk heatmap. Resolves the org's reference matrix and plots
   * each risk on it by snapping its residual (or, if absent, inherent) L/I to
   * the nearest matrix scale level. Returns `matrix: null` when the org has no
   * published matrix so the client can hide the heatmap. Risks without
   * plottable L/I are omitted. Mirrors enterpriseRisk.heatmap.
   */
  heatmap: organizationProcedure.query(async ({ ctx }) => {
    const orgId = ctx.organizationId!;
    const matrix = await resolveReferenceMatrix(ctx.db, orgId, null);

    if (!matrix) {
      return { matrix: null, rows: [] as Array<{
        id: string;
        label: string | null;
        title: string;
        likelihood: number | null;
        impact: number | null;
        score: number | null;
        scoreLabel: string | null;
        color: string;
        overAppetite: boolean;
        href: string;
      }> };
    }

    const risks = await ctx.db.risk.findMany({
      where: {
        organizationId: orgId,
        AND: [{ OR: [{ discoveryStatus: "PUBLISHED" }, { discoveryStatus: null }] }],
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        identifier: true,
        title: true,
        residualLikelihood: true,
        residualImpact: true,
        inherentLikelihood: true,
        inherentImpact: true,
      },
    });

    const rows = risks
      .map((r) => {
        const rawL = r.residualLikelihood ?? r.inherentLikelihood;
        const rawI = r.residualImpact ?? r.inherentImpact;
        if (rawL === null || rawI === null) return null;

        const likelihood = nearestScaleValue(Number(rawL), matrix.scales.likelihood);
        const impact = nearestScaleValue(Number(rawI), matrix.scales.impact);
        const score = score2D(likelihood, impact, matrix.scales, matrix.outputScaleMax);
        const band = thresholdForScore(score, matrix.thresholds);
        return {
          id: r.id,
          label: r.identifier ?? null,
          title: r.title,
          likelihood,
          impact,
          score,
          scoreLabel: band?.label ?? null,
          color: band?.color ?? "#CCCCCC",
          // Risk appetite: the (residual) band this risk lands in is flagged.
          overAppetite: band?.overAppetite ?? false,
          href: `/risks/${r.id}`,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

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
});
