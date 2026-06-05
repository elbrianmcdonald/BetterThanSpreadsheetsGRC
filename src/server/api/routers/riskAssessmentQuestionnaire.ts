/**
 * Risk Assessment Questionnaire (instance-side) Router
 *
 * Stories 4–6: cloned snapshot per RiskAssessmentProject; answer state
 * (status / notes / evidence); spawn findings + risks per question.
 */
import { TRPCError } from "@trpc/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import {
  AuditAction,
  FindingSource,
  FindingStatus,
  QuestionnaireUsageType,
  RiskDiscoveryStatus,
  RiskQuestionStatus,
  RiskStatus,
  Severity,
  UserRole,
} from "@prisma/client";

import {
  createTRPCRouter,
  organizationProcedure,
  requireRole,
} from "@/server/api/trpc";

const ANSWER_ROLES = [
  UserRole.ORG_ADMIN,
  UserRole.GRC_ANALYST,
  UserRole.SECURITY_ENGINEER,
  UserRole.CISO,
];

const VIEW_ROLES = [...ANSWER_ROLES, UserRole.AUDITOR];

// Helper: load a project the caller has access to (org-scoped).
async function loadProjectForOrg(
  ctx: { db: typeof import("@/server/db").db; organizationId: string | null | undefined },
  projectId: string
) {
  const p = await ctx.db.riskAssessmentProject.findFirst({
    where: { id: projectId, organizationId: ctx.organizationId! },
    select: { id: true },
  });
  if (!p) throw new TRPCError({ code: "NOT_FOUND", message: "Risk assessment not found" });
  return p;
}

// Helper: load a question in a project's questionnaire (org-scoped).
async function loadQuestionForProject(
  ctx: { db: typeof import("@/server/db").db; organizationId: string | null | undefined },
  questionId: string
) {
  const q = await ctx.db.riskAssessmentQuestion.findFirst({
    where: {
      id: questionId,
      section: {
        questionnaire: { organizationId: ctx.organizationId! },
      },
    },
    include: {
      section: {
        include: { questionnaire: { select: { riskAssessmentProjectId: true } } },
      },
    },
  });
  if (!q) throw new TRPCError({ code: "NOT_FOUND", message: "Question not found" });
  return q;
}

const ATTACH_INPUT = z.object({ projectId: z.string(), templateId: z.string() });
const DETACH_INPUT = z.object({ projectId: z.string() });
const GET_INPUT = z.object({ projectId: z.string() });

const SET_STATUS_INPUT = z.object({
  questionId: z.string(),
  status: z.nativeEnum(RiskQuestionStatus).nullable(),
});
const SET_NOTES_INPUT = z.object({
  questionId: z.string(),
  notes: z.string().max(5000).nullable(),
});
const ADD_CUSTOM_INPUT = z.object({
  sectionId: z.string(),
  number: z.string().max(20).optional().nullable(),
  text: z.string().min(1).max(2000),
  helpText: z.string().max(1000).optional().nullable(),
});
const REMOVE_CUSTOM_INPUT = z.object({ questionId: z.string() });

const ATTACH_EVIDENCE_INPUT = z.object({
  questionId: z.string(),
  evidenceId: z.string(),
});
const DETACH_EVIDENCE_INPUT = z.object({
  questionId: z.string(),
  evidenceId: z.string(),
});

const SPAWN_INPUT = z.object({
  questionId: z.string(),
  kind: z.enum(["finding", "risk"]),
  title: z.string().min(1).max(255),
  description: z.string().max(5000).optional().nullable(),
  severity: z.nativeEnum(Severity).default(Severity.MEDIUM),
});

export const riskAssessmentQuestionnaireRouter = createTRPCRouter({
  // ---------------------------------------------------------------------
  // Story 4: attach a template (deep-clone) and read the questionnaire tree.
  // ---------------------------------------------------------------------

  attachTemplate: organizationProcedure
    .use(requireRole(ANSWER_ROLES))
    .input(ATTACH_INPUT)
    .mutation(async ({ ctx, input }) => {
      await loadProjectForOrg(ctx, input.projectId);

      const existing = await ctx.db.riskAssessmentQuestionnaire.findUnique({
        where: { riskAssessmentProjectId: input.projectId },
        select: { id: true },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This assessment already has a questionnaire. Detach it first.",
        });
      }

      const tpl = await ctx.db.questionnaireTemplate.findFirst({
        where: {
          id: input.templateId,
          organizationId: ctx.organizationId!,
          usageType: QuestionnaireUsageType.RISK_ASSESSMENT,
          isActive: true,
        },
        include: {
          sections: {
            orderBy: { sortOrder: "asc" },
            include: { questions: { orderBy: { sortOrder: "asc" } } },
          },
        },
      });
      if (!tpl) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      }

      const questionnaire = await ctx.db.riskAssessmentQuestionnaire.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          riskAssessmentProjectId: input.projectId,
          templateId: tpl.id,
          templateName: tpl.name,
          updatedAt: new Date(),
          sections: {
            create: tpl.sections.map((s, sIdx) => ({
              id: randomUUID(),
              name: s.title,
              description: s.description,
              order: sIdx,
              updatedAt: new Date(),
              questions: {
                create: s.questions.map((q, qIdx) => ({
                  id: randomUUID(),
                  number: q.number,
                  text: q.questionText,
                  helpText: q.helpText,
                  isCustom: false,
                  templateQuestionId: q.id,
                  standardControlId: q.standardControlId,
                  organizationalControlId: q.organizationalControlId,
                  unresolvedReference: q.unresolvedReference,
                  status: null,
                  notes: null,
                  order: qIdx,
                  updatedAt: new Date(),
                })),
              },
            })),
          },
        },
      });

      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          userId: ctx.session!.user.id,
          action: AuditAction.SYSTEM_CONFIGURATION_CHANGED,
          entityType: "RiskAssessmentQuestionnaire",
          entityId: questionnaire.id,
          changes: {
            action: "ATTACH",
            templateId: tpl.id,
            templateName: tpl.name,
            projectId: input.projectId,
          },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });

      return { id: questionnaire.id };
    }),

  detach: organizationProcedure
    .use(requireRole(ANSWER_ROLES))
    .input(DETACH_INPUT)
    .mutation(async ({ ctx, input }) => {
      await loadProjectForOrg(ctx, input.projectId);
      const existing = await ctx.db.riskAssessmentQuestionnaire.findUnique({
        where: { riskAssessmentProjectId: input.projectId },
        select: { id: true, templateName: true },
      });
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No questionnaire attached to this assessment",
        });
      }
      await ctx.db.riskAssessmentQuestionnaire.delete({ where: { id: existing.id } });
      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          userId: ctx.session!.user.id,
          action: AuditAction.SYSTEM_CONFIGURATION_CHANGED,
          entityType: "RiskAssessmentQuestionnaire",
          entityId: existing.id,
          changes: { action: "DETACH", templateName: existing.templateName },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });
      return { ok: true };
    }),

  getCompletionSummary: organizationProcedure
    .use(requireRole(VIEW_ROLES))
    .input(GET_INPUT)
    .query(async ({ ctx, input }) => {
      await loadProjectForOrg(ctx, input.projectId);
      const questionnaire = await ctx.db.riskAssessmentQuestionnaire.findUnique({
        where: { riskAssessmentProjectId: input.projectId },
        select: {
          id: true,
          sections: {
            select: {
              questions: { select: { status: true } },
            },
          },
        },
      });
      if (!questionnaire) {
        return { attached: false as const };
      }
      let total = 0;
      let answered = 0;
      for (const s of questionnaire.sections) {
        for (const q of s.questions) {
          total++;
          if (q.status !== null) answered++;
        }
      }
      return {
        attached: true as const,
        total,
        answered,
        isComplete: total > 0 && answered === total,
      };
    }),

  getForProject: organizationProcedure
    .use(requireRole(VIEW_ROLES))
    .input(GET_INPUT)
    .query(async ({ ctx, input }) => {
      await loadProjectForOrg(ctx, input.projectId);
      return ctx.db.riskAssessmentQuestionnaire.findUnique({
        where: { riskAssessmentProjectId: input.projectId },
        include: {
          sections: {
            orderBy: { order: "asc" },
            include: {
              questions: {
                orderBy: [{ isCustom: "asc" }, { order: "asc" }],
                include: {
                  standardControl: { select: { id: true, code: true, title: true } },
                  organizationalControl: {
                    select: { id: true, localControlId: true, name: true },
                  },
                  evidenceLinks: {
                    include: {
                      evidence: {
                        select: {
                          id: true,
                          title: true,
                          originalFileName: true,
                          fileSize: true,
                        },
                      },
                    },
                  },
                  spawnedFindings: {
                    select: { id: true, identifier: true, title: true, status: true, severity: true },
                  },
                  spawnedRisks: {
                    select: { id: true, identifier: true, title: true, status: true, severity: true },
                  },
                },
              },
            },
          },
        },
      });
    }),

  // ---------------------------------------------------------------------
  // Story 5: answer state (status, notes, evidence) and custom add.
  // ---------------------------------------------------------------------

  setStatus: organizationProcedure
    .use(requireRole(ANSWER_ROLES))
    .input(SET_STATUS_INPUT)
    .mutation(async ({ ctx, input }) => {
      await loadQuestionForProject(ctx, input.questionId);
      return ctx.db.riskAssessmentQuestion.update({
        where: { id: input.questionId },
        data: { status: input.status },
      });
    }),

  setNotes: organizationProcedure
    .use(requireRole(ANSWER_ROLES))
    .input(SET_NOTES_INPUT)
    .mutation(async ({ ctx, input }) => {
      await loadQuestionForProject(ctx, input.questionId);
      return ctx.db.riskAssessmentQuestion.update({
        where: { id: input.questionId },
        data: { notes: input.notes },
      });
    }),

  addCustomQuestion: organizationProcedure
    .use(requireRole(ANSWER_ROLES))
    .input(ADD_CUSTOM_INPUT)
    .mutation(async ({ ctx, input }) => {
      const section = await ctx.db.riskAssessmentSection.findFirst({
        where: {
          id: input.sectionId,
          questionnaire: { organizationId: ctx.organizationId! },
        },
        select: { id: true },
      });
      if (!section) throw new TRPCError({ code: "NOT_FOUND", message: "Section not found" });
      const last = await ctx.db.riskAssessmentQuestion.findFirst({
        where: { sectionId: input.sectionId },
        orderBy: { order: "desc" },
        select: { order: true },
      });
      return ctx.db.riskAssessmentQuestion.create({
        data: {
          id: randomUUID(),
          sectionId: input.sectionId,
          number: input.number ?? null,
          text: input.text,
          helpText: input.helpText ?? null,
          isCustom: true,
          status: null,
          order: (last?.order ?? -1) + 1,
          updatedAt: new Date(),
        },
      });
    }),

  removeCustomQuestion: organizationProcedure
    .use(requireRole(ANSWER_ROLES))
    .input(REMOVE_CUSTOM_INPUT)
    .mutation(async ({ ctx, input }) => {
      const q = await loadQuestionForProject(ctx, input.questionId);
      if (!q.isCustom) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only custom-added questions can be removed (template questions are immutable).",
        });
      }
      await ctx.db.riskAssessmentQuestion.delete({ where: { id: input.questionId } });
      return { ok: true };
    }),

  attachEvidence: organizationProcedure
    .use(requireRole(ANSWER_ROLES))
    .input(ATTACH_EVIDENCE_INPUT)
    .mutation(async ({ ctx, input }) => {
      await loadQuestionForProject(ctx, input.questionId);
      const ev = await ctx.db.evidence.findFirst({
        where: { id: input.evidenceId, organizationId: ctx.organizationId!, isActive: true },
        select: { id: true },
      });
      if (!ev) throw new TRPCError({ code: "NOT_FOUND", message: "Evidence not found" });
      return ctx.db.riskAssessmentQuestionEvidence.upsert({
        where: { questionId_evidenceId: { questionId: input.questionId, evidenceId: input.evidenceId } },
        create: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          questionId: input.questionId,
          evidenceId: input.evidenceId,
          attachedById: ctx.session!.user.id,
        },
        update: {},
      });
    }),

  detachEvidence: organizationProcedure
    .use(requireRole(ANSWER_ROLES))
    .input(DETACH_EVIDENCE_INPUT)
    .mutation(async ({ ctx, input }) => {
      await loadQuestionForProject(ctx, input.questionId);
      await ctx.db.riskAssessmentQuestionEvidence.deleteMany({
        where: { questionId: input.questionId, evidenceId: input.evidenceId },
      });
      return { ok: true };
    }),

  // ---------------------------------------------------------------------
  // Story 6: spawn a Finding or a Risk from a question. Multiple per
  // question allowed. Children carry sourceRiskAssessmentQuestionId.
  // Evidence files are linked by reference.
  // ---------------------------------------------------------------------

  spawn: organizationProcedure
    .use(requireRole(ANSWER_ROLES))
    .input(SPAWN_INPUT)
    .mutation(async ({ ctx, input }) => {
      const question = await loadQuestionForProject(ctx, input.questionId);
      const projectId = question.section.questionnaire.riskAssessmentProjectId;

      if (input.kind === "finding") {
        const year = new Date().getFullYear();
        const yearPrefix = `FND-${year}-`;
        const last = await ctx.db.finding.findFirst({
          where: {
            organizationId: ctx.organizationId!,
            identifier: { startsWith: yearPrefix },
          },
          orderBy: { identifier: "desc" },
          select: { identifier: true },
        });
        const nextNum = last
          ? Number(last.identifier.slice(yearPrefix.length)) + 1
          : 1;
        const identifier = `${yearPrefix}${String(nextNum).padStart(4, "0")}`;
        const finding = await ctx.db.finding.create({
          data: {
            organizationId: ctx.organizationId!,
            identifier,
            title: input.title,
            description: input.description ?? "",
            source: FindingSource.MANUAL,
            severity: input.severity,
            status: FindingStatus.NEW,
            createdBy: ctx.session!.user.id,
            sourceRiskAssessmentQuestionId: input.questionId,
          },
          select: { id: true, identifier: true, title: true, severity: true, status: true },
        });
        await ctx.db.auditLog.create({
          data: {
            id: randomUUID(),
            organizationId: ctx.organizationId!,
            userId: ctx.session!.user.id,
            action: AuditAction.SYSTEM_CONFIGURATION_CHANGED,
            entityType: "Finding",
            entityId: finding.id,
            changes: {
              action: "SPAWN_FROM_QUESTION",
              questionId: input.questionId,
              projectId,
            },
            actorName: ctx.session!.user.name,
            actorRole: ctx.session!.user.role,
          },
        });
        return { kind: "finding" as const, ...finding };
      }

      // RISK
      const yearR = new Date().getFullYear();
      const riskPrefix = `RISK-${yearR}-`;
      const lastR = await ctx.db.risk.findFirst({
        where: {
          organizationId: ctx.organizationId!,
          identifier: { startsWith: riskPrefix },
        },
        orderBy: { identifier: "desc" },
        select: { identifier: true },
      });
      const nextR = lastR && lastR.identifier
        ? Number(lastR.identifier.slice(riskPrefix.length)) + 1
        : 1;
      const identifierR = `${riskPrefix}${String(nextR).padStart(4, "0")}`;
      const risk = await ctx.db.risk.create({
        data: {
          identifier: identifierR,
          organizationId: ctx.organizationId!,
          title: input.title,
          description: input.description ?? "",
          severity: input.severity,
          status: RiskStatus.OPEN,
          createdById: ctx.session!.user.id,
          discoveryProjectId: projectId,
          // Tie into the assessment's identified-risk lifecycle: PENDING risks
          // appear under the assessment and are published to the risk register
          // when the assessment is approved (riskAssessmentProject.approve).
          // Mirrors risk.create / DiscoveredRiskForm behavior.
          discoveryStatus: RiskDiscoveryStatus.PENDING,
          sourceRiskAssessmentQuestionId: input.questionId,
          updatedAt: new Date(),
        },
        select: { id: true, identifier: true, title: true, severity: true, status: true },
      });
      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          userId: ctx.session!.user.id,
          action: AuditAction.SYSTEM_CONFIGURATION_CHANGED,
          entityType: "Risk",
          entityId: risk.id,
          changes: {
            action: "SPAWN_FROM_QUESTION",
            questionId: input.questionId,
            projectId,
          },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });
      return { kind: "risk" as const, ...risk };
    }),
});
