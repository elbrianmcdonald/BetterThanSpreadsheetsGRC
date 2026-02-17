/**
 * Vendor Portal Router
 *
 * Epic 6: Vendor Portal
 * FR37: Vendor Contact can access portal via secure token link (no password)
 * FR38: View assigned questionnaires in portal
 * FR39: Complete responses (text, yes/no, multi-choice, file upload)
 * FR40: Save progress and resume later
 * FR41: Submit completed responses
 * FR42: Pre-fill from previous submissions
 * FR43: Update pre-filled responses
 * FR44: Confirmation when submitted
 *
 * This router uses PUBLIC procedures with token-based authentication
 * instead of session-based authentication.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { QuestionnaireStatus, QuestionType } from "@prisma/client";

import {
  createTRPCRouter,
  publicProcedure,
} from "@/server/api/trpc";
import { enqueueEmail } from "@/server/services/emailQueue.service";
import { renderQuestionnaireResponseEmail } from "@/server/email/templates";

// Validation schemas
const tokenSchema = z.object({
  token: z.string().min(1, "Access token is required"),
});

const saveResponseSchema = z.object({
  token: z.string().min(1),
  questionId: z.string().min(1),
  textResponse: z.string().optional(),
  selectedChoiceId: z.string().optional(),
  // File upload handled separately via presigned URL
});

const submitQuestionnaireSchema = z.object({
  token: z.string().min(1),
});

/**
 * Helper: Validate token and get questionnaire
 * Returns questionnaire if valid, throws error if invalid/expired
 */
async function validateAndGetQuestionnaire(
  db: typeof import("@/server/db").db,
  token: string,
  requireNotCompleted = false,
) {
  const questionnaire = await db.assessmentQuestionnaire.findUnique({
    where: { accessToken: token },
    include: {
      assessment: {
        include: {
          vendor: {
            select: { id: true, name: true },
          },
        },
      },
      template: {
        select: { id: true, name: true },
      },
    },
  });

  if (!questionnaire) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Invalid or expired access link. Please contact the organization that sent this questionnaire.",
    });
  }

  // Check if token has expired
  if (questionnaire.tokenExpiresAt && questionnaire.tokenExpiresAt < new Date()) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This access link has expired. Please contact the organization to request a new link.",
    });
  }

  // Check if questionnaire has been voided
  if (questionnaire.status === QuestionnaireStatus.VOIDED) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This questionnaire has been cancelled and is no longer available.",
    });
  }

  // Check if already completed (for mutations)
  if (requireNotCompleted && questionnaire.status === QuestionnaireStatus.COMPLETED) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This questionnaire has already been submitted and cannot be modified.",
    });
  }

  return questionnaire;
}

/**
 * Helper: Refresh token expiration on activity
 * Extends token expiration by 7 days from last activity
 */
async function refreshTokenExpiration(
  db: typeof import("@/server/db").db,
  questionnaireId: string,
) {
  const newExpiration = new Date();
  newExpiration.setDate(newExpiration.getDate() + 7);

  await db.assessmentQuestionnaire.update({
    where: { id: questionnaireId },
    data: { tokenExpiresAt: newExpiration },
  });
}

export const vendorPortalRouter = createTRPCRouter({
  /**
   * Validate access token (FR37)
   * Returns basic questionnaire info if valid
   */
  validateToken: publicProcedure
    .input(tokenSchema)
    .query(async ({ ctx, input }) => {
      const questionnaire = await validateAndGetQuestionnaire(ctx.db, input.token);

      // Update viewedAt if first access
      if (!questionnaire.viewedAt) {
        await ctx.db.assessmentQuestionnaire.update({
          where: { id: questionnaire.id },
          data: {
            viewedAt: new Date(),
            status: QuestionnaireStatus.VIEWED,
          },
        });
      }

      // Refresh token expiration
      await refreshTokenExpiration(ctx.db, questionnaire.id);

      return {
        valid: true,
        questionnaire: {
          id: questionnaire.id,
          status: questionnaire.status,
          templateName: questionnaire.template.name,
          vendorName: questionnaire.assessment.vendor.name,
          sentAt: questionnaire.sentAt,
          viewedAt: questionnaire.viewedAt,
          completedAt: questionnaire.completedAt,
        },
      };
    }),

  /**
   * Get full questionnaire for portal display (FR38)
   * Includes template, sections, questions, choices, and existing responses
   */
  getQuestionnaireByToken: publicProcedure
    .input(tokenSchema)
    .query(async ({ ctx, input }) => {
      const questionnaire = await validateAndGetQuestionnaire(ctx.db, input.token);

      // Get template with all sections/questions/choices
      const template = await ctx.db.questionnaireTemplate.findUnique({
        where: { id: questionnaire.templateId },
        include: {
          sections: {
            orderBy: { sortOrder: "asc" },
            include: {
              questions: {
                orderBy: { sortOrder: "asc" },
                include: {
                  choices: {
                    orderBy: { sortOrder: "asc" },
                  },
                },
              },
            },
          },
        },
      });

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Questionnaire template not found",
        });
      }

      // Get existing responses for this questionnaire
      const responses = await ctx.db.questionnaireResponse.findMany({
        where: { questionnaireId: questionnaire.id },
      });

      // Map responses by questionId for easy lookup
      const responseMap = new Map(
        responses.map((r) => [r.questionId, r])
      );

      // Build response structure with existing answers
      const sections = template.sections.map((section) => ({
        id: section.id,
        name: section.title,
        description: section.description,
        sortOrder: section.sortOrder,
        questions: section.questions.map((question) => {
          const existingResponse = responseMap.get(question.id);
          return {
            id: question.id,
            questionText: question.questionText,
            questionType: question.questionType,
            isRequired: question.isRequired,
            helpText: question.helpText,
            sortOrder: question.sortOrder,
            choices: question.choices.map((c) => ({
              id: c.id,
              choiceText: c.choiceText,
              sortOrder: c.sortOrder,
            })),
            // Include existing response if any
            response: existingResponse
              ? {
                  id: existingResponse.id,
                  textResponse: existingResponse.textResponse,
                  selectedChoiceId: existingResponse.selectedChoiceId,
                  fileUrl: existingResponse.fileUrl,
                  fileName: existingResponse.fileName,
                  isPreFilled: existingResponse.isPreFilled,
                  wasModified: existingResponse.wasModified,
                }
              : null,
          };
        }),
      }));

      // Refresh token expiration
      await refreshTokenExpiration(ctx.db, questionnaire.id);

      return {
        questionnaire: {
          id: questionnaire.id,
          status: questionnaire.status,
          vendorName: questionnaire.assessment.vendor.name,
          completedAt: questionnaire.completedAt,
        },
        template: {
          id: template.id,
          name: template.name,
          description: template.description,
        },
        sections,
      };
    }),

  /**
   * Save a single response (FR39, FR40)
   * Auto-saves as vendor fills out the form
   */
  saveResponse: publicProcedure
    .input(saveResponseSchema)
    .mutation(async ({ ctx, input }) => {
      const questionnaire = await validateAndGetQuestionnaire(
        ctx.db,
        input.token,
        true // requireNotCompleted
      );

      // Verify question exists and belongs to this template
      const question = await ctx.db.questionnaireQuestion.findUnique({
        where: { id: input.questionId },
        include: {
          section: {
            select: { templateId: true },
          },
        },
      });

      if (!question || question.section.templateId !== questionnaire.templateId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Question not found in this questionnaire",
        });
      }

      // Validate response based on question type
      if (question.questionType === QuestionType.MULTI_CHOICE && input.selectedChoiceId) {
        // Verify choice belongs to this question
        const choice = await ctx.db.questionChoice.findFirst({
          where: {
            id: input.selectedChoiceId,
            questionId: question.id,
          },
        });
        if (!choice) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid choice for this question",
          });
        }
      }

      // Check if response already exists
      const existingResponse = await ctx.db.questionnaireResponse.findUnique({
        where: {
          questionnaireId_questionId: {
            questionnaireId: questionnaire.id,
            questionId: input.questionId,
          },
        },
      });

      let response;
      if (existingResponse) {
        // Update existing response
        response = await ctx.db.questionnaireResponse.update({
          where: { id: existingResponse.id },
          data: {
            textResponse: input.textResponse,
            selectedChoiceId: input.selectedChoiceId,
            // Mark as modified if it was pre-filled
            wasModified: existingResponse.isPreFilled ? true : existingResponse.wasModified,
          },
        });
      } else {
        // Create new response
        response = await ctx.db.questionnaireResponse.create({
          data: {
            questionnaireId: questionnaire.id,
            questionId: input.questionId,
            textResponse: input.textResponse,
            selectedChoiceId: input.selectedChoiceId,
          },
        });
      }

      // Update questionnaire status to IN_PROGRESS if not already
      if (
        questionnaire.status === QuestionnaireStatus.SENT ||
        questionnaire.status === QuestionnaireStatus.VIEWED
      ) {
        await ctx.db.assessmentQuestionnaire.update({
          where: { id: questionnaire.id },
          data: {
            status: QuestionnaireStatus.IN_PROGRESS,
            startedAt: questionnaire.startedAt ?? new Date(),
          },
        });
      }

      // Refresh token expiration
      await refreshTokenExpiration(ctx.db, questionnaire.id);

      return {
        success: true,
        responseId: response.id,
      };
    }),

  /**
   * Submit completed questionnaire (FR41, FR44)
   * Marks questionnaire as completed
   */
  submitQuestionnaire: publicProcedure
    .input(submitQuestionnaireSchema)
    .mutation(async ({ ctx, input }) => {
      const questionnaire = await validateAndGetQuestionnaire(
        ctx.db,
        input.token,
        true // requireNotCompleted
      );

      // Get all required questions
      const template = await ctx.db.questionnaireTemplate.findUnique({
        where: { id: questionnaire.templateId },
        include: {
          sections: {
            include: {
              questions: {
                where: { isRequired: true },
              },
            },
          },
        },
      });

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Questionnaire template not found",
        });
      }

      const requiredQuestionIds = template.sections
        .flatMap((s) => s.questions)
        .map((q) => q.id);

      // Check all required questions have responses
      const responses = await ctx.db.questionnaireResponse.findMany({
        where: {
          questionnaireId: questionnaire.id,
          questionId: { in: requiredQuestionIds },
        },
      });

      const answeredQuestionIds = new Set(responses.map((r) => r.questionId));
      const unansweredRequired = requiredQuestionIds.filter(
        (id) => !answeredQuestionIds.has(id)
      );

      if (unansweredRequired.length > 0) {
        // Get question texts for better error message
        const unansweredQuestions = await ctx.db.questionnaireQuestion.findMany({
          where: { id: { in: unansweredRequired } },
          select: { questionText: true },
        });

        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Please answer all required questions before submitting. Missing: ${unansweredQuestions
            .map((q) => q.questionText)
            .slice(0, 3)
            .join(", ")}${unansweredRequired.length > 3 ? ` and ${unansweredRequired.length - 3} more` : ""}`,
        });
      }

      // Mark questionnaire as completed
      const updatedQuestionnaire = await ctx.db.assessmentQuestionnaire.update({
        where: { id: questionnaire.id },
        data: {
          status: QuestionnaireStatus.COMPLETED,
          completedAt: new Date(),
        },
        include: {
          assessment: {
            include: {
              vendor: { select: { id: true, name: true } },
              assessor: { select: { id: true, name: true, email: true } },
            },
          },
          template: { select: { id: true, name: true } },
        },
      });

      // Get total question count and count of modified pre-filled responses
      const [totalQuestions, allResponses] = await Promise.all([
        ctx.db.questionnaireQuestion.count({
          where: {
            section: {
              templateId: updatedQuestionnaire.templateId,
            },
          },
        }),
        ctx.db.questionnaireResponse.findMany({
          where: { questionnaireId: updatedQuestionnaire.id },
          select: { isPreFilled: true, wasModified: true },
        }),
      ]);

      const modifiedPrefilledCount = allResponses.filter(
        (r) => r.isPreFilled && r.wasModified
      ).length;

      // Send notification to assessor (FR64)
      if (updatedQuestionnaire.assessment.assessor?.email) {
        const organization = await ctx.db.organization.findUnique({
          where: { id: updatedQuestionnaire.assessment.organizationId },
          select: { name: true },
        });

        const emailData = renderQuestionnaireResponseEmail({
          recipientName: updatedQuestionnaire.assessment.assessor.name || "Assessor",
          vendorName: updatedQuestionnaire.assessment.vendor.name,
          questionnaireName: updatedQuestionnaire.template.name,
          assessmentTitle: updatedQuestionnaire.assessment.title,
          completedAt: updatedQuestionnaire.completedAt || new Date(),
          totalQuestionsAnswered: allResponses.length,
          totalQuestions,
          vendorId: updatedQuestionnaire.assessment.vendor.id,
          assessmentId: updatedQuestionnaire.assessmentId,
          questionnaireId: updatedQuestionnaire.id,
          organizationName: organization?.name || "Organization",
          organizationLogoUrl: undefined, // Organization model doesn't have logoUrl
          modifiedPrefilledCount,
        });

        void enqueueEmail({
          to: updatedQuestionnaire.assessment.assessor.email,
          subject: emailData.subject,
          htmlContent: emailData.html,
          textContent: emailData.text,
          emailType: "QUESTIONNAIRE_RESPONSE",
          relatedEntityType: "AssessmentQuestionnaire",
          relatedEntityId: updatedQuestionnaire.id,
          organizationId: updatedQuestionnaire.assessment.organizationId,
        });
      }

      // TODO: Send confirmation email to vendor (FR44) - would need vendor contact email

      return {
        success: true,
        message: "Thank you! Your questionnaire has been submitted successfully.",
        completedAt: updatedQuestionnaire.completedAt,
        vendorName: updatedQuestionnaire.assessment.vendor.name,
        questionnaireName: updatedQuestionnaire.template.name,
      };
    }),

  /**
   * Pre-fill responses from previous submission (FR42)
   * Called when questionnaire is first loaded to copy answers from previous
   */
  prefillFromPrevious: publicProcedure
    .input(tokenSchema)
    .mutation(async ({ ctx, input }) => {
      const questionnaire = await validateAndGetQuestionnaire(
        ctx.db,
        input.token,
        true // requireNotCompleted
      );

      // Only allow pre-fill if questionnaire has no responses yet
      const existingResponses = await ctx.db.questionnaireResponse.count({
        where: { questionnaireId: questionnaire.id },
      });

      if (existingResponses > 0) {
        return {
          success: false,
          message: "Questionnaire already has responses",
          prefilledCount: 0,
        };
      }

      // Find the most recent completed questionnaire for the same vendor/template
      const previousQuestionnaire = await ctx.db.assessmentQuestionnaire.findFirst({
        where: {
          id: { not: questionnaire.id },
          templateId: questionnaire.templateId,
          status: QuestionnaireStatus.COMPLETED,
          assessment: {
            vendorId: questionnaire.assessment.vendorId,
          },
        },
        orderBy: { completedAt: "desc" },
        include: {
          responses: true,
        },
      });

      if (!previousQuestionnaire || previousQuestionnaire.responses.length === 0) {
        return {
          success: true,
          message: "No previous responses found to pre-fill",
          prefilledCount: 0,
        };
      }

      // Get question IDs that exist in current template
      const templateQuestions = await ctx.db.questionnaireQuestion.findMany({
        where: {
          section: {
            templateId: questionnaire.templateId,
          },
        },
        select: { id: true },
      });
      const validQuestionIds = new Set(templateQuestions.map((q) => q.id));

      // Filter to only responses for questions that still exist
      const responsesToCopy = previousQuestionnaire.responses.filter((r) =>
        validQuestionIds.has(r.questionId)
      );

      if (responsesToCopy.length === 0) {
        return {
          success: true,
          message: "No matching questions found to pre-fill",
          prefilledCount: 0,
        };
      }

      // Create pre-filled responses
      await ctx.db.questionnaireResponse.createMany({
        data: responsesToCopy.map((r) => ({
          questionnaireId: questionnaire.id,
          questionId: r.questionId,
          textResponse: r.textResponse,
          selectedChoiceId: r.selectedChoiceId,
          fileUrl: r.fileUrl,
          fileName: r.fileName,
          isPreFilled: true,
          preFilledFromId: r.id,
          wasModified: false,
        })),
      });

      // Update status to show questionnaire was viewed/started
      if (questionnaire.status === QuestionnaireStatus.SENT) {
        await ctx.db.assessmentQuestionnaire.update({
          where: { id: questionnaire.id },
          data: {
            status: QuestionnaireStatus.VIEWED,
            viewedAt: new Date(),
          },
        });
      }

      // Refresh token expiration
      await refreshTokenExpiration(ctx.db, questionnaire.id);

      return {
        success: true,
        message: `Pre-filled ${responsesToCopy.length} responses from your previous submission`,
        prefilledCount: responsesToCopy.length,
      };
    }),
});
