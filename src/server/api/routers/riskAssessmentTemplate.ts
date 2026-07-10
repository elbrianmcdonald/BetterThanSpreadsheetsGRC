/**
 * Risk Assessment Questionnaire Template Router
 *
 * Story 2 (Risk Assessment Questionnaires): Templates library CRUD.
 *
 * Manages QuestionnaireTemplate rows where usageType = RISK_ASSESSMENT.
 * Vendor-side flows are handled by the separate `questionnaire` router and
 * are filtered by usageType = VENDOR_ASSESSMENT, so the two never collide.
 *
 * Templates are the *library* side. Picking a template into a risk assessment
 * deep-clones it into RiskAssessmentQuestionnaire/Section/Question (Story 4).
 */
import { TRPCError } from "@trpc/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import {
  AuditAction,
  Prisma,
  QuestionType,
  QuestionnaireUsageType,
  UserRole,
} from "@prisma/client";

import {
  createTRPCRouter,
  organizationProcedure,
  requireRole,
} from "@/server/api/trpc";
import { READ_ROLES, WRITE_ROLES } from "@/lib/auth/roles";

const TEMPLATE_VIEW_ROLES: UserRole[] = [...READ_ROLES];

const TEMPLATE_MANAGE_ROLES: UserRole[] = [...WRITE_ROLES];

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const frameworkRefFields = {
  standardControlId: z.string().optional().nullable(),
  organizationalControlId: z.string().optional().nullable(),
  unresolvedReference: z.string().max(255).optional().nullable(),
};

const atMostOneFrameworkRef = (v: {
  standardControlId?: string | null;
  organizationalControlId?: string | null;
}) =>
  [v.standardControlId, v.organizationalControlId].filter((x) => x != null && x !== "").length <= 1;

const createTemplateSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().max(2000).optional().nullable(),
});

const updateTemplateSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional().nullable(),
  isActive: z.boolean().optional(),
});

const createSectionSchema = z.object({
  templateId: z.string(),
  title: z.string().min(1).max(255),
  description: z.string().max(1000).optional().nullable(),
});

const updateSectionSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
});

const createQuestionSchema = z
  .object({
    sectionId: z.string(),
    number: z.string().max(20).optional().nullable(),
    questionText: z.string().min(1).max(2000),
    helpText: z.string().max(1000).optional().nullable(),
    ...frameworkRefFields,
  })
  .refine(atMostOneFrameworkRef, {
    message: "At most one of standardControlId / organizationalControlId may be set",
  });

const updateQuestionSchema = z
  .object({
    id: z.string(),
    number: z.string().max(20).optional().nullable(),
    questionText: z.string().min(1).max(2000).optional(),
    helpText: z.string().max(1000).optional().nullable(),
    sortOrder: z.number().int().min(0).optional(),
    ...frameworkRefFields,
  })
  .refine(atMostOneFrameworkRef, {
    message: "At most one of standardControlId / organizationalControlId may be set",
  });

// ---------------------------------------------------------------------------
// Authorization predicates (inlined where used; defined once for readability).
// Each loader narrows by org + RISK_ASSESSMENT usageType so a vendor template
// row can never be reached through this router.
// ---------------------------------------------------------------------------

const NOT_FOUND_TEMPLATE = new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
const NOT_FOUND_SECTION = new TRPCError({ code: "NOT_FOUND", message: "Section not found" });
const NOT_FOUND_QUESTION = new TRPCError({ code: "NOT_FOUND", message: "Question not found" });

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const riskAssessmentTemplateRouter = createTRPCRouter({
  list: organizationProcedure
    .use(requireRole(TEMPLATE_VIEW_ROLES))
    .input(
      z
        .object({
          includeInactive: z.boolean().default(false),
          search: z.string().max(255).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const where: Prisma.QuestionnaireTemplateWhereInput = {
        organizationId: ctx.organizationId!,
        usageType: QuestionnaireUsageType.RISK_ASSESSMENT,
        ...(input?.includeInactive ? {} : { isActive: true }),
        ...(input?.search
          ? {
              OR: [
                { name: { contains: input.search, mode: Prisma.QueryMode.insensitive } },
                { description: { contains: input.search, mode: Prisma.QueryMode.insensitive } },
              ],
            }
          : {}),
      };

      const templates = await ctx.db.questionnaireTemplate.findMany({
        where,
        include: {
          sections: { select: { _count: { select: { questions: true } } } },
          createdBy: { select: { id: true, name: true, email: true } },
          _count: { select: { riskAssessmentQuestionnaires: true } },
        },
        orderBy: [{ name: "asc" }],
      });

      return templates.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        isActive: t.isActive,
        version: t.version,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        createdBy: t.createdBy,
        sectionCount: t.sections.length,
        questionCount: t.sections.reduce((acc, s) => acc + s._count.questions, 0),
        instanceCount: t._count.riskAssessmentQuestionnaires,
      }));
    }),

  getById: organizationProcedure
    .use(requireRole(TEMPLATE_VIEW_ROLES))
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const tpl = await ctx.db.questionnaireTemplate.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId!,
          usageType: QuestionnaireUsageType.RISK_ASSESSMENT,
        },
        include: {
          sections: {
            orderBy: { sortOrder: "asc" },
            include: {
              questions: {
                orderBy: { sortOrder: "asc" },
                include: {
                  standardControl: { select: { id: true, code: true, title: true, standardId: true } },
                  organizationalControl: { select: { id: true, localControlId: true, name: true } },
                },
              },
            },
          },
          createdBy: { select: { id: true, name: true, email: true } },
        },
      });
      if (!tpl) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      }
      return tpl;
    }),

  create: organizationProcedure
    .use(requireRole(TEMPLATE_MANAGE_ROLES))
    .input(createTemplateSchema)
    .mutation(async ({ ctx, input }) => {
      const conflict = await ctx.db.questionnaireTemplate.findFirst({
        where: {
          organizationId: ctx.organizationId!,
          name: input.name,
          version: 1,
        },
      });
      if (conflict) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A template with this name already exists",
        });
      }

      const tpl = await ctx.db.questionnaireTemplate.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          name: input.name,
          description: input.description ?? null,
          usageType: QuestionnaireUsageType.RISK_ASSESSMENT,
          isSystemTemplate: false,
          isActive: true,
          version: 1,
          createdById: ctx.session!.user.id,
          updatedAt: new Date(),
        },
      });

      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          userId: ctx.session!.user.id,
          action: AuditAction.SYSTEM_CONFIGURATION_CHANGED,
          entityType: "QuestionnaireTemplate",
          entityId: tpl.id,
          changes: { action: "CREATE", usageType: "RISK_ASSESSMENT", name: input.name },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });

      return tpl;
    }),

  update: organizationProcedure
    .use(requireRole(TEMPLATE_MANAGE_ROLES))
    .input(updateTemplateSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.questionnaireTemplate.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId!,
          usageType: QuestionnaireUsageType.RISK_ASSESSMENT,
        },
      });
      if (!existing) throw NOT_FOUND_TEMPLATE;

      if (input.name && input.name !== existing.name) {
        const conflict = await ctx.db.questionnaireTemplate.findFirst({
          where: {
            organizationId: ctx.organizationId!,
            name: input.name,
            version: existing.version,
            id: { not: input.id },
          },
        });
        if (conflict) {
          throw new TRPCError({ code: "CONFLICT", message: "A template with this name already exists" });
        }
      }

      const updated = await ctx.db.questionnaireTemplate.update({
        where: { id: input.id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.isActive !== undefined && { isActive: input.isActive }),
        },
      });

      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          userId: ctx.session!.user.id,
          action: AuditAction.SYSTEM_CONFIGURATION_CHANGED,
          entityType: "QuestionnaireTemplate",
          entityId: input.id,
          changes: {
            action: "UPDATE",
            before: { name: existing.name, description: existing.description, isActive: existing.isActive },
            after: { name: updated.name, description: updated.description, isActive: updated.isActive },
          },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });

      return updated;
    }),

  delete: organizationProcedure
    .use(requireRole(TEMPLATE_MANAGE_ROLES))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.questionnaireTemplate.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId!,
          usageType: QuestionnaireUsageType.RISK_ASSESSMENT,
        },
      });
      if (!existing) throw NOT_FOUND_TEMPLATE;

      const instanceCount = await ctx.db.riskAssessmentQuestionnaire.count({
        where: { templateId: input.id },
      });
      if (instanceCount > 0) {
        // Soft delete: keep snapshots intact (templateId is nullable on instances).
        const updated = await ctx.db.questionnaireTemplate.update({
          where: { id: input.id },
          data: { isActive: false },
        });
        await ctx.db.auditLog.create({
          data: {
            id: randomUUID(),
            organizationId: ctx.organizationId!,
            userId: ctx.session!.user.id,
            action: AuditAction.SYSTEM_CONFIGURATION_CHANGED,
            entityType: "QuestionnaireTemplate",
            entityId: input.id,
            changes: { action: "SOFT_DELETE", reason: "instances_exist", instanceCount },
            actorName: ctx.session!.user.name,
            actorRole: ctx.session!.user.role,
          },
        });
        return { soft: true, template: updated };
      }

      // Hard delete: cascade removes sections + questions.
      await ctx.db.questionnaireTemplate.delete({ where: { id: input.id } });
      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          userId: ctx.session!.user.id,
          action: AuditAction.SYSTEM_CONFIGURATION_CHANGED,
          entityType: "QuestionnaireTemplate",
          entityId: input.id,
          changes: { action: "HARD_DELETE", name: existing.name },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });
      return { soft: false };
    }),

  // -------------------------------------------------------------------------
  // Sections
  // -------------------------------------------------------------------------

  createSection: organizationProcedure
    .use(requireRole(TEMPLATE_MANAGE_ROLES))
    .input(createSectionSchema)
    .mutation(async ({ ctx, input }) => {
      const tpl = await ctx.db.questionnaireTemplate.findFirst({
        where: {
          id: input.templateId,
          organizationId: ctx.organizationId!,
          usageType: QuestionnaireUsageType.RISK_ASSESSMENT,
        },
        select: { id: true },
      });
      if (!tpl) throw NOT_FOUND_TEMPLATE;
      const last = await ctx.db.questionnaireSection.findFirst({
        where: { templateId: input.templateId },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      const section = await ctx.db.questionnaireSection.create({
        data: {
          id: randomUUID(),
          templateId: input.templateId,
          title: input.title,
          description: input.description ?? null,
          sortOrder: (last?.sortOrder ?? -1) + 1,
          updatedAt: new Date(),
        },
      });
      return section;
    }),

  updateSection: organizationProcedure
    .use(requireRole(TEMPLATE_MANAGE_ROLES))
    .input(updateSectionSchema)
    .mutation(async ({ ctx, input }) => {
      const section = await ctx.db.questionnaireSection.findFirst({
        where: {
          id: input.id,
          template: {
            organizationId: ctx.organizationId!,
            usageType: QuestionnaireUsageType.RISK_ASSESSMENT,
          },
        },
        select: { id: true },
      });
      if (!section) throw NOT_FOUND_SECTION;
      return ctx.db.questionnaireSection.update({
        where: { id: input.id },
        data: {
          ...(input.title !== undefined && { title: input.title }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
        },
      });
    }),

  deleteSection: organizationProcedure
    .use(requireRole(TEMPLATE_MANAGE_ROLES))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const section = await ctx.db.questionnaireSection.findFirst({
        where: {
          id: input.id,
          template: {
            organizationId: ctx.organizationId!,
            usageType: QuestionnaireUsageType.RISK_ASSESSMENT,
          },
        },
        select: { id: true },
      });
      if (!section) throw NOT_FOUND_SECTION;
      await ctx.db.questionnaireSection.delete({ where: { id: input.id } });
      return { ok: true };
    }),

  // -------------------------------------------------------------------------
  // Questions
  // -------------------------------------------------------------------------

  createQuestion: organizationProcedure
    .use(requireRole(TEMPLATE_MANAGE_ROLES))
    .input(createQuestionSchema)
    .mutation(async ({ ctx, input }) => {
      const section = await ctx.db.questionnaireSection.findFirst({
        where: {
          id: input.sectionId,
          template: {
            organizationId: ctx.organizationId!,
            usageType: QuestionnaireUsageType.RISK_ASSESSMENT,
          },
        },
        select: { id: true },
      });
      if (!section) throw NOT_FOUND_SECTION;
      const last = await ctx.db.questionnaireQuestion.findFirst({
        where: { sectionId: input.sectionId },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      return ctx.db.questionnaireQuestion.create({
        data: {
          id: randomUUID(),
          sectionId: input.sectionId,
          questionText: input.questionText,
          helpText: input.helpText ?? null,
          questionType: QuestionType.TEXT, // Required by schema; ignored at render time for risk-assessment usage.
          isRequired: false,
          sortOrder: (last?.sortOrder ?? -1) + 1,
          isLongText: false,
          number: input.number ?? null,
          standardControlId: input.standardControlId ?? null,
          organizationalControlId: input.organizationalControlId ?? null,
          unresolvedReference: input.unresolvedReference ?? null,
          updatedAt: new Date(),
        },
      });
    }),

  updateQuestion: organizationProcedure
    .use(requireRole(TEMPLATE_MANAGE_ROLES))
    .input(updateQuestionSchema)
    .mutation(async ({ ctx, input }) => {
      const q = await ctx.db.questionnaireQuestion.findFirst({
        where: {
          id: input.id,
          section: {
            template: {
              organizationId: ctx.organizationId!,
              usageType: QuestionnaireUsageType.RISK_ASSESSMENT,
            },
          },
        },
        select: { id: true },
      });
      if (!q) throw NOT_FOUND_QUESTION;
      return ctx.db.questionnaireQuestion.update({
        where: { id: input.id },
        data: {
          ...(input.number !== undefined && { number: input.number }),
          ...(input.questionText !== undefined && { questionText: input.questionText }),
          ...(input.helpText !== undefined && { helpText: input.helpText }),
          ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
          ...(input.standardControlId !== undefined && { standardControlId: input.standardControlId }),
          ...(input.organizationalControlId !== undefined && {
            organizationalControlId: input.organizationalControlId,
          }),
          ...(input.unresolvedReference !== undefined && {
            unresolvedReference: input.unresolvedReference,
          }),
        },
      });
    }),

  deleteQuestion: organizationProcedure
    .use(requireRole(TEMPLATE_MANAGE_ROLES))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const q = await ctx.db.questionnaireQuestion.findFirst({
        where: {
          id: input.id,
          section: {
            template: {
              organizationId: ctx.organizationId!,
              usageType: QuestionnaireUsageType.RISK_ASSESSMENT,
            },
          },
        },
        select: { id: true },
      });
      if (!q) throw NOT_FOUND_QUESTION;
      await ctx.db.questionnaireQuestion.delete({ where: { id: input.id } });
      return { ok: true };
    }),

  // -------------------------------------------------------------------------
  // CSV import — accepts pre-parsed rows from the client. Resolves each row's
  // framework_ref against StandardControl (exact match on code) and
  // OrganizationalControl (exact match on localControlId). Unresolved refs
  // are stored as raw strings on `unresolvedReference` for the post-import
  // [Resolve Now] wizard.
  // -------------------------------------------------------------------------

  importCsv: organizationProcedure
    .use(requireRole(TEMPLATE_MANAGE_ROLES))
    .input(
      z.object({
        target: z.discriminatedUnion("kind", [
          z.object({ kind: z.literal("existing"), templateId: z.string() }),
          z.object({ kind: z.literal("new"), name: z.string().min(1).max(255), description: z.string().max(2000).optional().nullable() }),
        ]),
        rows: z
          .array(
            z.object({
              section: z.string().min(1).max(255),
              number: z.string().max(20).optional().nullable(),
              question: z.string().min(1).max(2000),
              framework_ref: z.string().max(255).optional().nullable(),
            })
          )
          .min(1, "CSV must contain at least one row")
          .max(2000, "CSV exceeds 2000-row limit"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Resolve target template
      let templateId: string;
      if (input.target.kind === "existing") {
        const tpl = await ctx.db.questionnaireTemplate.findFirst({
          where: {
            id: input.target.templateId,
            organizationId: ctx.organizationId!,
            usageType: QuestionnaireUsageType.RISK_ASSESSMENT,
          },
          select: { id: true },
        });
        if (!tpl) throw NOT_FOUND_TEMPLATE;
        templateId = tpl.id;
      } else {
        const conflict = await ctx.db.questionnaireTemplate.findFirst({
          where: { organizationId: ctx.organizationId!, name: input.target.name, version: 1 },
          select: { id: true },
        });
        if (conflict) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A template with this name already exists",
          });
        }
        const created = await ctx.db.questionnaireTemplate.create({
          data: {
            id: randomUUID(),
            organizationId: ctx.organizationId!,
            name: input.target.name,
            description: input.target.description ?? null,
            usageType: QuestionnaireUsageType.RISK_ASSESSMENT,
            isSystemTemplate: false,
            isActive: true,
            version: 1,
            createdById: ctx.session!.user.id,
            updatedAt: new Date(),
          },
        });
        templateId = created.id;
      }

      // Build a resolution lookup for all unique framework_refs in the CSV.
      const uniqueRefs = Array.from(
        new Set(
          input.rows
            .map((r) => r.framework_ref?.trim())
            .filter((v): v is string => Boolean(v))
        )
      );

      const [stdMatches, orgMatches] = await Promise.all([
        uniqueRefs.length
          ? ctx.db.standardControl.findMany({
              where: {
                code: { in: uniqueRefs },
                Standard: { organizationId: ctx.organizationId! },
              },
              select: { id: true, code: true },
            })
          : Promise.resolve([]),
        uniqueRefs.length
          ? ctx.db.organizationalControl.findMany({
              where: {
                organizationId: ctx.organizationId!,
                localControlId: { in: uniqueRefs },
              },
              select: { id: true, localControlId: true },
            })
          : Promise.resolve([]),
      ]);

      const stdByCode = new Map(stdMatches.map((s) => [s.code, s.id]));
      const orgByLocalId = new Map(orgMatches.map((o) => [o.localControlId, o.id]));

      // Group rows by section in original order, preserving first-seen order for sections
      // and within-section order for questions.
      const sectionOrder: string[] = [];
      const sectionRows = new Map<string, typeof input.rows>();
      for (const row of input.rows) {
        const key = row.section.trim();
        if (!sectionRows.has(key)) {
          sectionOrder.push(key);
          sectionRows.set(key, []);
        }
        sectionRows.get(key)!.push(row);
      }

      // Find the highest existing sortOrder so we append after.
      const lastSection = await ctx.db.questionnaireSection.findFirst({
        where: { templateId },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      let nextSectionOrder = (lastSection?.sortOrder ?? -1) + 1;

      let unresolvedCount = 0;
      let createdQuestions = 0;

      for (const sectionTitle of sectionOrder) {
        const rows = sectionRows.get(sectionTitle)!;
        const section = await ctx.db.questionnaireSection.create({
          data: {
            id: randomUUID(),
            templateId,
            title: sectionTitle,
            sortOrder: nextSectionOrder++,
            updatedAt: new Date(),
          },
        });
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i]!;
          const ref = row.framework_ref?.trim() || null;
          const standardControlId = ref ? stdByCode.get(ref) ?? null : null;
          const organizationalControlId =
            !standardControlId && ref ? orgByLocalId.get(ref) ?? null : null;
          const unresolvedReference =
            ref && !standardControlId && !organizationalControlId ? ref : null;
          if (unresolvedReference) unresolvedCount++;

          await ctx.db.questionnaireQuestion.create({
            data: {
              id: randomUUID(),
              sectionId: section.id,
              questionText: row.question.trim(),
              questionType: QuestionType.TEXT,
              isRequired: false,
              sortOrder: i,
              isLongText: false,
              number: row.number?.trim() || null,
              standardControlId,
              organizationalControlId,
              unresolvedReference,
              updatedAt: new Date(),
            },
          });
          createdQuestions++;
        }
      }

      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          userId: ctx.session!.user.id,
          action: AuditAction.SYSTEM_CONFIGURATION_CHANGED,
          entityType: "QuestionnaireTemplate",
          entityId: templateId,
          changes: {
            action: "CSV_IMPORT",
            sections: sectionOrder.length,
            questions: createdQuestions,
            unresolved: unresolvedCount,
            target: input.target.kind,
          },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });

      return {
        templateId,
        sectionsCreated: sectionOrder.length,
        questionsCreated: createdQuestions,
        unresolvedCount,
      };
    }),

  // -------------------------------------------------------------------------
  // Resolve a previously-unresolved framework reference (post-import wizard).
  // -------------------------------------------------------------------------

  resolveReference: organizationProcedure
    .use(requireRole(TEMPLATE_MANAGE_ROLES))
    .input(
      z.object({
        questionId: z.string(),
        resolution: z.discriminatedUnion("kind", [
          z.object({ kind: z.literal("standard"), id: z.string() }),
          z.object({ kind: z.literal("org"), id: z.string() }),
          z.object({ kind: z.literal("clear") }),
        ]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const q = await ctx.db.questionnaireQuestion.findFirst({
        where: {
          id: input.questionId,
          section: {
            template: {
              organizationId: ctx.organizationId!,
              usageType: QuestionnaireUsageType.RISK_ASSESSMENT,
            },
          },
        },
        select: { id: true },
      });
      if (!q) throw NOT_FOUND_QUESTION;

      const data: {
        standardControlId: string | null;
        organizationalControlId: string | null;
        unresolvedReference: string | null;
      } = {
        standardControlId: null,
        organizationalControlId: null,
        unresolvedReference: null,
      };
      if (input.resolution.kind === "standard") data.standardControlId = input.resolution.id;
      else if (input.resolution.kind === "org") data.organizationalControlId = input.resolution.id;
      // clear leaves all null

      return ctx.db.questionnaireQuestion.update({
        where: { id: input.questionId },
        data,
      });
    }),

  listUnresolved: organizationProcedure
    .use(requireRole(TEMPLATE_VIEW_ROLES))
    .input(z.object({ templateId: z.string() }))
    .query(async ({ ctx, input }) => {
      const tpl = await ctx.db.questionnaireTemplate.findFirst({
        where: {
          id: input.templateId,
          organizationId: ctx.organizationId!,
          usageType: QuestionnaireUsageType.RISK_ASSESSMENT,
        },
        select: { id: true },
      });
      if (!tpl) throw NOT_FOUND_TEMPLATE;
      return ctx.db.questionnaireQuestion.findMany({
        where: {
          section: { templateId: input.templateId },
          unresolvedReference: { not: null },
          standardControlId: null,
          organizationalControlId: null,
        },
        select: {
          id: true,
          number: true,
          questionText: true,
          unresolvedReference: true,
          section: { select: { id: true, title: true } },
        },
        orderBy: [{ section: { sortOrder: "asc" } }, { sortOrder: "asc" }],
      });
    }),

  // -------------------------------------------------------------------------
  // Framework reference search (for the per-question framework picker UI).
  // Returns merged StandardControl + OrganizationalControl matches so the UI
  // can render a single typeahead. Capped server-side.
  // -------------------------------------------------------------------------

  searchFrameworkRefs: organizationProcedure
    .use(requireRole(TEMPLATE_VIEW_ROLES))
    .input(z.object({ query: z.string().max(255).default("") }))
    .query(async ({ ctx, input }) => {
      const q = input.query.trim();
      const limit = 25;

      const [standardControls, orgControls] = await Promise.all([
        ctx.db.standardControl.findMany({
          where: {
            Standard: { organizationId: ctx.organizationId! },
            ...(q
              ? {
                  OR: [
                    { code: { contains: q, mode: Prisma.QueryMode.insensitive } },
                    { title: { contains: q, mode: Prisma.QueryMode.insensitive } },
                  ],
                }
              : {}),
          },
          select: {
            id: true,
            code: true,
            title: true,
            Standard: { select: { title: true } },
          },
          orderBy: [{ standardId: "asc" }, { sortOrder: "asc" }],
          take: limit,
        }),
        ctx.db.organizationalControl.findMany({
          where: q
            ? {
                organizationId: ctx.organizationId!,
                OR: [
                  { localControlId: { contains: q, mode: Prisma.QueryMode.insensitive } },
                  { name: { contains: q, mode: Prisma.QueryMode.insensitive } },
                ],
              }
            : { organizationId: ctx.organizationId! },
          select: { id: true, localControlId: true, name: true },
          orderBy: { localControlId: "asc" },
          take: limit,
        }),
      ]);

      return {
        standardControls: standardControls.map((s) => ({
          id: s.id,
          code: s.code,
          title: s.title,
          standardName: s.Standard.title,
        })),
        organizationalControls: orgControls.map((o) => ({
          id: o.id,
          localControlId: o.localControlId,
          name: o.name,
        })),
      };
    }),
});
