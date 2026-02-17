/**
 * Questionnaire Router
 *
 * tRPC router for questionnaire system operations.
 *
 * Epic 4: Questionnaire System
 * - Story 4.1: Pre-Built Questionnaire Templates (FR27)
 * - Story 4.2: Custom Questionnaire Builder (FR28)
 * - Story 4.3: Edit Questionnaire Templates (FR29)
 * - Story 4.4: Attach Questionnaire to Assessment (FR30)
 * - Story 4.5: Send Questionnaire to Vendor Contact (FR31)
 * - Story 4.6: Track Questionnaire Response Status (FR32)
 * - Story 4.8: View and Score Questionnaire Responses (FR34, FR35)
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  UserRole,
  QuestionType,
  QuestionnaireStatus,
  ResponseScore,
  VendorAssessmentStatus,
  AuditAction,
  Prisma,
} from "@prisma/client";
import crypto from "crypto";

import {
  createTRPCRouter,
  organizationProcedure,
  publicProcedure,
  requireRole,
} from "@/server/api/trpc";
import { createAuditLog } from "@/server/services/audit-log.service";
import { enqueueEmail } from "@/server/services/emailQueue.service";
import { renderQuestionnaireAssignedEmail } from "@/server/email/templates";
import { getBaseUrl } from "@/server/email/templates/renderer";

/**
 * Roles that can view questionnaire templates
 */
const TEMPLATE_VIEW_ROLES = [
  UserRole.ORG_ADMIN,
  UserRole.GRC_ANALYST,
  UserRole.SECURITY_ENGINEER,
  UserRole.CISO,
  UserRole.AUDITOR,
];

/**
 * Roles that can manage questionnaire templates
 */
const TEMPLATE_MANAGE_ROLES = [
  UserRole.ORG_ADMIN,
  UserRole.GRC_ANALYST,
];

/**
 * Roles that can send questionnaires (assessors)
 */
const QUESTIONNAIRE_SEND_ROLES = [
  UserRole.ORG_ADMIN,
  UserRole.GRC_ANALYST,
  UserRole.SECURITY_ENGINEER,
];

// ============================================================================
// Input Schemas
// ============================================================================

/**
 * Question choice schema for multi-choice questions
 */
const questionChoiceSchema = z.object({
  id: z.string().optional(), // Existing choice ID for updates
  choiceText: z.string().min(1, "Choice text is required").max(500),
  sortOrder: z.number().default(0),
  isConcerning: z.boolean().default(false),
});

/**
 * Question schema for template creation/update
 */
const questionSchema = z.object({
  id: z.string().optional(), // Existing question ID for updates
  questionText: z.string().min(1, "Question text is required").max(2000),
  helpText: z.string().max(1000).optional().nullable(),
  questionType: z.nativeEnum(QuestionType),
  isRequired: z.boolean().default(false),
  sortOrder: z.number().default(0),
  isLongText: z.boolean().default(false),
  choices: z.array(questionChoiceSchema).optional(),
});

/**
 * Section schema for template creation/update
 */
const sectionSchema = z.object({
  id: z.string().optional(), // Existing section ID for updates
  title: z.string().min(1, "Section title is required").max(200),
  description: z.string().max(1000).optional().nullable(),
  sortOrder: z.number().default(0),
  questions: z.array(questionSchema),
});

/**
 * Create template input schema
 */
const createTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required").max(200),
  description: z.string().max(2000).optional().nullable(),
  sections: z.array(sectionSchema),
});

/**
 * Update template input schema
 */
const updateTemplateSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  sections: z.array(sectionSchema).optional(),
});

/**
 * List templates input schema
 */
const listTemplatesSchema = z.object({
  includeSystem: z.boolean().default(true),
  includeCustom: z.boolean().default(true),
  isActive: z.boolean().default(true),
  search: z.string().optional(),
});

/**
 * Attach questionnaire to assessment input schema
 */
const attachQuestionnaireSchema = z.object({
  assessmentId: z.string(),
  templateId: z.string(),
});

/**
 * Send questionnaire input schema
 */
const sendQuestionnaireSchema = z.object({
  questionnaireId: z.string(),
  recipientEmail: z.string().email("Valid email is required"),
  customMessage: z.string().max(2000).optional().nullable(),
});

/**
 * Save response input schema
 */
const saveResponseSchema = z.object({
  questionnaireId: z.string(),
  questionId: z.string(),
  textResponse: z.string().optional().nullable(),
  selectedChoiceId: z.string().optional().nullable(),
  fileUrl: z.string().optional().nullable(),
  fileName: z.string().optional().nullable(),
});

/**
 * Score response input schema
 */
const scoreResponseSchema = z.object({
  responseId: z.string(),
  score: z.nativeEnum(ResponseScore),
  comment: z.string().max(2000).optional().nullable(),
});

export const questionnaireRouter = createTRPCRouter({
  // ============================================================================
  // Template Management (FR27, FR28, FR29)
  // ============================================================================

  /**
   * Create a custom questionnaire template (Story 4.2 - FR28)
   */
  createTemplate: organizationProcedure
    .use(requireRole(TEMPLATE_MANAGE_ROLES))
    .input(createTemplateSchema)
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;
      const { name, description, sections } = input;

      // Check for duplicate name in organization
      const existing = await ctx.db.questionnaireTemplate.findFirst({
        where: {
          organizationId,
          name,
          isActive: true,
        },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A template with this name already exists",
        });
      }

      // Create template with nested sections and questions
      const template = await ctx.db.questionnaireTemplate.create({
        data: {
          organizationId,
          name,
          description,
          isSystemTemplate: false,
          createdById: userId,
          sections: {
            create: sections.map((section, sIdx) => ({
              title: section.title,
              description: section.description,
              sortOrder: section.sortOrder ?? sIdx,
              questions: {
                create: section.questions.map((question, qIdx) => ({
                  questionText: question.questionText,
                  helpText: question.helpText,
                  questionType: question.questionType,
                  isRequired: question.isRequired,
                  sortOrder: question.sortOrder ?? qIdx,
                  isLongText: question.isLongText,
                  choices: question.choices && question.questionType === QuestionType.MULTI_CHOICE
                    ? {
                        create: question.choices.map((choice, cIdx) => ({
                          choiceText: choice.choiceText,
                          sortOrder: choice.sortOrder ?? cIdx,
                          isConcerning: choice.isConcerning,
                        })),
                      }
                    : undefined,
                })),
              },
            })),
          },
        },
        include: {
          sections: {
            include: {
              questions: {
                include: { choices: true },
                orderBy: { sortOrder: "asc" },
              },
            },
            orderBy: { sortOrder: "asc" },
          },
        },
      });

      // Audit log
      void createAuditLog({
        organizationId,
        userId,
        action: AuditAction.QUESTIONNAIRE_TEMPLATE_CREATED,
        entityType: "QuestionnaireTemplate",
        entityId: template.id,
        changes: {
          before: null,
          after: { name, sectionCount: sections.length },
        },
      });

      return template;
    }),

  /**
   * Update a custom questionnaire template (Story 4.3 - FR29)
   */
  updateTemplate: organizationProcedure
    .use(requireRole(TEMPLATE_MANAGE_ROLES))
    .input(updateTemplateSchema)
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;
      const { id, name, description, sections } = input;

      // Verify template exists and belongs to this organization
      const existing = await ctx.db.questionnaireTemplate.findFirst({
        where: { id, organizationId, isActive: true },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Template not found",
        });
      }

      if (existing.isSystemTemplate) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "System templates cannot be edited. Create a copy instead.",
        });
      }

      // Update template with transaction to handle nested updates
      const template = await ctx.db.$transaction(async (tx) => {
        // If sections are being updated, delete existing and recreate
        if (sections) {
          await tx.questionnaireSection.deleteMany({
            where: { templateId: id },
          });
        }

        return tx.questionnaireTemplate.update({
          where: { id },
          data: {
            name,
            description,
            version: { increment: 1 },
            sections: sections
              ? {
                  create: sections.map((section, sIdx) => ({
                    title: section.title,
                    description: section.description,
                    sortOrder: section.sortOrder ?? sIdx,
                    questions: {
                      create: section.questions.map((question, qIdx) => ({
                        questionText: question.questionText,
                        helpText: question.helpText,
                        questionType: question.questionType,
                        isRequired: question.isRequired,
                        sortOrder: question.sortOrder ?? qIdx,
                        isLongText: question.isLongText,
                        choices: question.choices && question.questionType === QuestionType.MULTI_CHOICE
                          ? {
                              create: question.choices.map((choice, cIdx) => ({
                                choiceText: choice.choiceText,
                                sortOrder: choice.sortOrder ?? cIdx,
                                isConcerning: choice.isConcerning,
                              })),
                            }
                          : undefined,
                      })),
                    },
                  })),
                }
              : undefined,
          },
          include: {
            sections: {
              include: {
                questions: {
                  include: { choices: true },
                  orderBy: { sortOrder: "asc" },
                },
              },
              orderBy: { sortOrder: "asc" },
            },
          },
        });
      });

      // Audit log
      void createAuditLog({
        organizationId,
        userId,
        action: AuditAction.QUESTIONNAIRE_TEMPLATE_UPDATED,
        entityType: "QuestionnaireTemplate",
        entityId: template.id,
        changes: {
          before: { name: existing.name },
          after: { name: template.name },
        },
      });

      return template;
    }),

  /**
   * Delete (deactivate) a custom template (Story 4.3 - FR29)
   */
  deleteTemplate: organizationProcedure
    .use(requireRole(TEMPLATE_MANAGE_ROLES))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;
      const { id } = input;

      const template = await ctx.db.questionnaireTemplate.findFirst({
        where: { id, organizationId },
      });

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Template not found",
        });
      }

      if (template.isSystemTemplate) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "System templates cannot be deleted",
        });
      }

      await ctx.db.questionnaireTemplate.update({
        where: { id },
        data: { isActive: false },
      });

      // Audit log
      void createAuditLog({
        organizationId,
        userId,
        action: AuditAction.QUESTIONNAIRE_TEMPLATE_DELETED,
        entityType: "QuestionnaireTemplate",
        entityId: id,
        changes: { before: { isActive: true }, after: { isActive: false } },
      });

      return { success: true };
    }),

  /**
   * List questionnaire templates (Story 4.1 - FR27)
   */
  listTemplates: organizationProcedure
    .use(requireRole(TEMPLATE_VIEW_ROLES))
    .input(listTemplatesSchema)
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const { includeSystem, includeCustom, isActive, search } = input;

      const where: Prisma.QuestionnaireTemplateWhereInput = {
        isActive,
        AND: [
          // Include system templates (org = null) and/or custom templates (org = current)
          {
            OR: [
              ...(includeSystem ? [{ isSystemTemplate: true }] : []),
              ...(includeCustom ? [{ organizationId }] : []),
            ],
          },
          // Search filter
          ...(search
            ? [
                {
                  OR: [
                    { name: { contains: search, mode: Prisma.QueryMode.insensitive } },
                    { description: { contains: search, mode: Prisma.QueryMode.insensitive } },
                  ],
                },
              ]
            : []),
        ],
      };

      const templates = await ctx.db.questionnaireTemplate.findMany({
        where,
        include: {
          sections: {
            include: {
              questions: {
                select: { id: true },
              },
            },
          },
          createdBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: [{ isSystemTemplate: "desc" }, { name: "asc" }],
      });

      return templates.map((t) => ({
        ...t,
        questionCount: t.sections.reduce((acc, s) => acc + s.questions.length, 0),
        sectionCount: t.sections.length,
      }));
    }),

  /**
   * Get template by ID with full details (Story 4.1 - FR27)
   */
  getTemplateById: organizationProcedure
    .use(requireRole(TEMPLATE_VIEW_ROLES))
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const { id } = input;

      const template = await ctx.db.questionnaireTemplate.findFirst({
        where: {
          id,
          OR: [{ organizationId }, { isSystemTemplate: true }],
        },
        include: {
          sections: {
            include: {
              questions: {
                include: { choices: { orderBy: { sortOrder: "asc" } } },
                orderBy: { sortOrder: "asc" },
              },
            },
            orderBy: { sortOrder: "asc" },
          },
          createdBy: { select: { id: true, name: true, email: true } },
        },
      });

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Template not found",
        });
      }

      return template;
    }),

  /**
   * Copy a system template to create a custom template (Story 4.3 - FR29)
   */
  copyTemplate: organizationProcedure
    .use(requireRole(TEMPLATE_MANAGE_ROLES))
    .input(z.object({ templateId: z.string(), newName: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;
      const { templateId, newName } = input;

      // Get source template
      const source = await ctx.db.questionnaireTemplate.findFirst({
        where: {
          id: templateId,
          OR: [{ organizationId }, { isSystemTemplate: true }],
        },
        include: {
          sections: {
            include: {
              questions: {
                include: { choices: true },
                orderBy: { sortOrder: "asc" },
              },
            },
            orderBy: { sortOrder: "asc" },
          },
        },
      });

      if (!source) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Source template not found",
        });
      }

      // Check for duplicate name
      const existing = await ctx.db.questionnaireTemplate.findFirst({
        where: { organizationId, name: newName, isActive: true },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A template with this name already exists",
        });
      }

      // Create copy
      const copy = await ctx.db.questionnaireTemplate.create({
        data: {
          organizationId,
          name: newName,
          description: source.description,
          isSystemTemplate: false,
          createdById: userId,
          sections: {
            create: source.sections.map((section) => ({
              title: section.title,
              description: section.description,
              sortOrder: section.sortOrder,
              questions: {
                create: section.questions.map((question) => ({
                  questionText: question.questionText,
                  helpText: question.helpText,
                  questionType: question.questionType,
                  isRequired: question.isRequired,
                  sortOrder: question.sortOrder,
                  isLongText: question.isLongText,
                  choices:
                    question.questionType === QuestionType.MULTI_CHOICE
                      ? {
                          create: question.choices.map((choice) => ({
                            choiceText: choice.choiceText,
                            sortOrder: choice.sortOrder,
                            isConcerning: choice.isConcerning,
                          })),
                        }
                      : undefined,
                })),
              },
            })),
          },
        },
        include: {
          sections: {
            include: {
              questions: {
                include: { choices: true },
                orderBy: { sortOrder: "asc" },
              },
            },
            orderBy: { sortOrder: "asc" },
          },
        },
      });

      // Audit log
      void createAuditLog({
        organizationId,
        userId,
        action: AuditAction.QUESTIONNAIRE_TEMPLATE_CREATED,
        entityType: "QuestionnaireTemplate",
        entityId: copy.id,
        changes: {
          before: null,
          after: { name: newName, copiedFrom: source.id },
        },
      });

      return copy;
    }),

  // ============================================================================
  // Assessment Questionnaire Management (FR30)
  // ============================================================================

  /**
   * Attach a questionnaire to an assessment (Story 4.4 - FR30)
   */
  attachToAssessment: organizationProcedure
    .use(requireRole(QUESTIONNAIRE_SEND_ROLES))
    .input(attachQuestionnaireSchema)
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;
      const { assessmentId, templateId } = input;

      // Verify assessment exists and is in editable state
      const assessment = await ctx.db.vendorAssessment.findFirst({
        where: { id: assessmentId, organizationId },
      });

      if (!assessment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment not found",
        });
      }

      const editableStatuses: VendorAssessmentStatus[] = [VendorAssessmentStatus.DRAFT, VendorAssessmentStatus.IN_PROGRESS];
      if (!editableStatuses.includes(assessment.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only attach questionnaires to assessments in Draft or In Progress status",
        });
      }

      // Verify template exists
      const template = await ctx.db.questionnaireTemplate.findFirst({
        where: {
          id: templateId,
          OR: [{ organizationId }, { isSystemTemplate: true }],
          isActive: true,
        },
      });

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Template not found",
        });
      }

      // Create questionnaire instance
      const questionnaire = await ctx.db.assessmentQuestionnaire.create({
        data: {
          assessmentId,
          templateId,
          status: QuestionnaireStatus.DRAFT,
        },
        include: {
          template: { select: { id: true, name: true } },
        },
      });

      // Audit log
      void createAuditLog({
        organizationId,
        userId,
        action: AuditAction.QUESTIONNAIRE_ATTACHED,
        entityType: "AssessmentQuestionnaire",
        entityId: questionnaire.id,
        changes: {
          before: null,
          after: { assessmentId, templateId, templateName: template.name },
        },
      });

      return questionnaire;
    }),

  /**
   * Detach a questionnaire from an assessment (Story 4.4 - FR30)
   */
  detachFromAssessment: organizationProcedure
    .use(requireRole(QUESTIONNAIRE_SEND_ROLES))
    .input(z.object({ questionnaireId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;
      const { questionnaireId } = input;

      // Get questionnaire with assessment
      const questionnaire = await ctx.db.assessmentQuestionnaire.findFirst({
        where: { id: questionnaireId },
        include: { assessment: true },
      });

      if (!questionnaire || questionnaire.assessment.organizationId !== organizationId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Questionnaire not found",
        });
      }

      // Can only detach if not yet sent
      if (questionnaire.status !== QuestionnaireStatus.DRAFT) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot remove a questionnaire that has already been sent. You can void it instead.",
        });
      }

      await ctx.db.assessmentQuestionnaire.delete({
        where: { id: questionnaireId },
      });

      // Audit log
      void createAuditLog({
        organizationId,
        userId,
        action: AuditAction.QUESTIONNAIRE_DETACHED,
        entityType: "AssessmentQuestionnaire",
        entityId: questionnaireId,
        changes: {
          before: { assessmentId: questionnaire.assessmentId },
          after: null,
        },
      });

      return { success: true };
    }),

  /**
   * Get questionnaires for an assessment (Story 4.4 - FR30)
   */
  getQuestionnairesForAssessment: organizationProcedure
    .use(requireRole(TEMPLATE_VIEW_ROLES))
    .input(z.object({ assessmentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const { assessmentId } = input;

      // Verify assessment access
      const assessment = await ctx.db.vendorAssessment.findFirst({
        where: { id: assessmentId, organizationId },
      });

      if (!assessment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment not found",
        });
      }

      const questionnaires = await ctx.db.assessmentQuestionnaire.findMany({
        where: { assessmentId },
        include: {
          template: { select: { id: true, name: true, description: true } },
          sentBy: { select: { id: true, name: true, email: true } },
          reminders: { select: { id: true, sentAt: true, success: true } },
          responses: { select: { id: true, score: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      return questionnaires.map((q) => ({
        ...q,
        responseCount: q.responses.length,
        scoredCount: q.responses.filter((r) => r.score !== null).length,
        reminderCount: q.reminders.length,
      }));
    }),

  // ============================================================================
  // Sending and Tracking (FR31, FR32)
  // ============================================================================

  /**
   * Send questionnaire to vendor contact (Story 4.5 - FR31)
   */
  sendQuestionnaire: organizationProcedure
    .use(requireRole(QUESTIONNAIRE_SEND_ROLES))
    .input(sendQuestionnaireSchema)
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;
      const { questionnaireId, recipientEmail, customMessage } = input;

      // Get questionnaire with assessment
      const questionnaire = await ctx.db.assessmentQuestionnaire.findFirst({
        where: { id: questionnaireId },
        include: {
          assessment: {
            include: { vendor: true },
          },
          template: true,
        },
      });

      if (!questionnaire || questionnaire.assessment.organizationId !== organizationId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Questionnaire not found",
        });
      }

      if (questionnaire.status !== QuestionnaireStatus.DRAFT) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This questionnaire has already been sent",
        });
      }

      // Generate secure access token
      const accessToken = crypto.randomBytes(32).toString("hex");
      const tokenExpiresAt = new Date();
      tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 7); // 7 days

      // Update questionnaire with send info
      const updated = await ctx.db.assessmentQuestionnaire.update({
        where: { id: questionnaireId },
        data: {
          status: QuestionnaireStatus.SENT,
          recipientEmail,
          customMessage,
          sentAt: new Date(),
          sentById: userId,
          accessToken,
          tokenExpiresAt,
        },
      });

      // Get organization for email
      const organization = await ctx.db.organization.findUnique({
        where: { id: organizationId },
        select: { name: true },
      });

      // Build portal access URL
      const baseUrl = getBaseUrl();
      const portalAccessUrl = `${baseUrl}/portal/${accessToken}`;

      // Queue email notification (FR61)
      const emailData = renderQuestionnaireAssignedEmail({
        vendorName: questionnaire.assessment.vendor.name,
        contactName: recipientEmail.split("@")[0] || "Vendor Contact", // Use email prefix as name fallback
        questionnaireName: questionnaire.template.name,
        questionnaireDescription: questionnaire.template.description,
        dueDate: null, // No due date tracked currently
        organizationName: organization?.name || "Organization",
        organizationLogoUrl: undefined, // Organization model doesn't have logoUrl
        portalAccessUrl,
        assessmentTitle: questionnaire.assessment.title,
      });

      void enqueueEmail({
        to: recipientEmail,
        subject: emailData.subject,
        htmlContent: emailData.html,
        textContent: emailData.text,
        emailType: "QUESTIONNAIRE_ASSIGNED",
        relatedEntityType: "AssessmentQuestionnaire",
        relatedEntityId: questionnaireId,
        organizationId,
      });

      // Audit log
      void createAuditLog({
        organizationId,
        userId,
        action: AuditAction.QUESTIONNAIRE_SENT,
        entityType: "AssessmentQuestionnaire",
        entityId: questionnaireId,
        changes: {
          before: { status: QuestionnaireStatus.DRAFT },
          after: { status: QuestionnaireStatus.SENT, recipientEmail },
        },
      });

      return {
        ...updated,
        // Include token for testing (in production, this would only be in the email)
        accessToken,
      };
    }),

  /**
   * Get questionnaire by access token (for vendor portal) (Story 4.6 - FR32)
   * This is a public procedure - no auth required, token is the auth
   */
  getQuestionnaireByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const { token } = input;

      const questionnaire = await ctx.db.assessmentQuestionnaire.findFirst({
        where: { accessToken: token },
        include: {
          template: {
            include: {
              sections: {
                include: {
                  questions: {
                    include: { choices: { orderBy: { sortOrder: "asc" } } },
                    orderBy: { sortOrder: "asc" },
                  },
                },
                orderBy: { sortOrder: "asc" },
              },
            },
          },
          assessment: {
            include: {
              vendor: { select: { name: true } },
            },
          },
          responses: true,
        },
      });

      if (!questionnaire) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invalid or expired link. Please contact the organization for a new link.",
        });
      }

      // Check token expiration
      if (questionnaire.tokenExpiresAt && questionnaire.tokenExpiresAt < new Date()) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This link has expired. Please contact the organization for a new link.",
        });
      }

      // Update status if first view
      if (questionnaire.status === QuestionnaireStatus.SENT && !questionnaire.viewedAt) {
        await ctx.db.assessmentQuestionnaire.update({
          where: { id: questionnaire.id },
          data: {
            status: QuestionnaireStatus.VIEWED,
            viewedAt: new Date(),
            // Extend token expiration on view
            tokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        });
      }

      // Return questionnaire data (excluding sensitive fields)
      return {
        id: questionnaire.id,
        templateName: questionnaire.template.name,
        templateDescription: questionnaire.template.description,
        vendorName: questionnaire.assessment.vendor.name,
        status: questionnaire.status,
        sections: questionnaire.template.sections,
        responses: questionnaire.responses.map((r) => ({
          questionId: r.questionId,
          textResponse: r.textResponse,
          selectedChoiceId: r.selectedChoiceId,
          fileUrl: r.fileUrl,
          fileName: r.fileName,
        })),
      };
    }),

  /**
   * Void a sent questionnaire (Story 4.4 - FR30)
   */
  voidQuestionnaire: organizationProcedure
    .use(requireRole(QUESTIONNAIRE_SEND_ROLES))
    .input(z.object({ questionnaireId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;
      const { questionnaireId } = input;

      const questionnaire = await ctx.db.assessmentQuestionnaire.findFirst({
        where: { id: questionnaireId },
        include: { assessment: true },
      });

      if (!questionnaire || questionnaire.assessment.organizationId !== organizationId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Questionnaire not found",
        });
      }

      if (questionnaire.status === QuestionnaireStatus.COMPLETED) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot void a completed questionnaire",
        });
      }

      await ctx.db.assessmentQuestionnaire.update({
        where: { id: questionnaireId },
        data: {
          status: QuestionnaireStatus.VOIDED,
          accessToken: null, // Invalidate token
        },
      });

      // Audit log
      void createAuditLog({
        organizationId,
        userId,
        action: AuditAction.QUESTIONNAIRE_VOIDED,
        entityType: "AssessmentQuestionnaire",
        entityId: questionnaireId,
        changes: {
          before: { status: questionnaire.status },
          after: { status: QuestionnaireStatus.VOIDED },
        },
      });

      return { success: true };
    }),

  // ============================================================================
  // Response Management (FR34, FR35, FR39-FR41)
  // ============================================================================

  /**
   * Save a response (vendor portal) (Story 4.8 - FR34)
   * This is a public procedure - validated by token
   */
  saveResponse: publicProcedure
    .input(saveResponseSchema.extend({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { token, questionnaireId, questionId, textResponse, selectedChoiceId, fileUrl, fileName } = input;

      // Validate token
      const questionnaire = await ctx.db.assessmentQuestionnaire.findFirst({
        where: { id: questionnaireId, accessToken: token },
      });

      if (!questionnaire) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Invalid access token",
        });
      }

      if (questionnaire.tokenExpiresAt && questionnaire.tokenExpiresAt < new Date()) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This link has expired",
        });
      }

      if (questionnaire.status === QuestionnaireStatus.COMPLETED) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This questionnaire has already been submitted",
        });
      }

      // Update status to IN_PROGRESS if needed
      const pendingStatuses: QuestionnaireStatus[] = [QuestionnaireStatus.SENT, QuestionnaireStatus.VIEWED];
      if (pendingStatuses.includes(questionnaire.status)) {
        await ctx.db.assessmentQuestionnaire.update({
          where: { id: questionnaireId },
          data: {
            status: QuestionnaireStatus.IN_PROGRESS,
            startedAt: questionnaire.startedAt ?? new Date(),
          },
        });
      }

      // Upsert response
      const response = await ctx.db.questionnaireResponse.upsert({
        where: {
          questionnaireId_questionId: { questionnaireId, questionId },
        },
        create: {
          questionnaireId,
          questionId,
          textResponse,
          selectedChoiceId,
          fileUrl,
          fileName,
        },
        update: {
          textResponse,
          selectedChoiceId,
          fileUrl,
          fileName,
        },
      });

      return response;
    }),

  /**
   * Submit questionnaire responses (vendor portal) (Story 4.8 - FR34)
   */
  submitResponses: publicProcedure
    .input(z.object({ questionnaireId: z.string(), token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { questionnaireId, token } = input;

      // Validate token
      const questionnaire = await ctx.db.assessmentQuestionnaire.findFirst({
        where: { id: questionnaireId, accessToken: token },
        include: {
          template: {
            include: {
              sections: {
                include: {
                  questions: true,
                },
              },
            },
          },
          responses: true,
        },
      });

      if (!questionnaire) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Invalid access token",
        });
      }

      if (questionnaire.status === QuestionnaireStatus.COMPLETED) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This questionnaire has already been submitted",
        });
      }

      // Validate required questions are answered
      const allQuestions = questionnaire.template.sections.flatMap((s) => s.questions);
      const requiredQuestions = allQuestions.filter((q) => q.isRequired);
      const answeredQuestionIds = new Set(questionnaire.responses.map((r) => r.questionId));

      const unanswered = requiredQuestions.filter((q) => !answeredQuestionIds.has(q.id));
      if (unanswered.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Please answer all required questions. ${unanswered.length} required question(s) remaining.`,
        });
      }

      // Mark as completed
      await ctx.db.assessmentQuestionnaire.update({
        where: { id: questionnaireId },
        data: {
          status: QuestionnaireStatus.COMPLETED,
          completedAt: new Date(),
          accessToken: null, // Invalidate token after submission
        },
      });

      // TODO: Send notification to assessor via email queue

      return { success: true };
    }),

  /**
   * Score a response (Story 4.8 - FR35)
   */
  scoreResponse: organizationProcedure
    .use(requireRole(QUESTIONNAIRE_SEND_ROLES))
    .input(scoreResponseSchema)
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;
      const { responseId, score, comment } = input;

      // Get response with questionnaire and assessment
      const response = await ctx.db.questionnaireResponse.findFirst({
        where: { id: responseId },
        include: {
          questionnaire: {
            include: { assessment: true },
          },
        },
      });

      if (!response || response.questionnaire.assessment.organizationId !== organizationId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Response not found",
        });
      }

      // Update response with score
      const updated = await ctx.db.questionnaireResponse.update({
        where: { id: responseId },
        data: {
          score,
          scoreComment: comment,
          scoredAt: new Date(),
          scoredById: userId,
        },
      });

      // Recalculate overall questionnaire score
      const allResponses = await ctx.db.questionnaireResponse.findMany({
        where: { questionnaireId: response.questionnaireId },
      });

      const scoredResponses = allResponses.filter((r) => r.score !== null);
      if (scoredResponses.length > 0) {
        const acceptableCount = scoredResponses.filter((r) => r.score === ResponseScore.ACCEPTABLE).length;
        const overallScore = (acceptableCount / scoredResponses.length) * 100;

        await ctx.db.assessmentQuestionnaire.update({
          where: { id: response.questionnaireId },
          data: { overallScore },
        });
      }

      return updated;
    }),

  /**
   * Get responses for a questionnaire (Story 4.8 - FR34)
   */
  getResponses: organizationProcedure
    .use(requireRole(TEMPLATE_VIEW_ROLES))
    .input(z.object({ questionnaireId: z.string() }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const { questionnaireId } = input;

      // Verify access
      const questionnaire = await ctx.db.assessmentQuestionnaire.findFirst({
        where: { id: questionnaireId },
        include: { assessment: true },
      });

      if (!questionnaire || questionnaire.assessment.organizationId !== organizationId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Questionnaire not found",
        });
      }

      const responses = await ctx.db.questionnaireResponse.findMany({
        where: { questionnaireId },
        include: {
          question: {
            include: {
              choices: true,
              section: true,
            },
          },
          scoredBy: { select: { id: true, name: true, email: true } },
          // Epic 5: Include finding if one was created from this response
          finding: { select: { id: true, identifier: true } },
        },
        orderBy: [
          { question: { section: { sortOrder: "asc" } } },
          { question: { sortOrder: "asc" } },
        ],
      });

      return responses;
    }),

  /**
   * Get questionnaire with full assessment and vendor details
   *
   * Epic 5: FR45, FR50 - Used for responses page with Create Finding capability
   */
  getQuestionnaireWithDetails: organizationProcedure
    .use(requireRole(TEMPLATE_VIEW_ROLES))
    .input(z.object({ questionnaireId: z.string() }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const { questionnaireId } = input;

      const questionnaire = await ctx.db.assessmentQuestionnaire.findFirst({
        where: { id: questionnaireId },
        include: {
          template: {
            select: { id: true, name: true },
          },
          assessment: {
            select: {
              id: true,
              identifier: true,
              title: true,
              organizationId: true,
              vendor: {
                select: { id: true, name: true, identifier: true },
              },
            },
          },
        },
      });

      if (!questionnaire || questionnaire.assessment.organizationId !== organizationId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Questionnaire not found",
        });
      }

      return questionnaire;
    }),
});
