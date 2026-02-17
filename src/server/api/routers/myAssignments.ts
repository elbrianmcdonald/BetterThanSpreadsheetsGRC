/**
 * My Assignments Router
 *
 * Provides unified access to all work assignments across the platform:
 * - Risk Treatments (assigned via Person entity)
 * - Maturity Assessment assignments (via AssessorAssignment)
 * - Compliance Assessment assignments (via assessorId)
 *
 * Enables the "My Assignments" dashboard for visibility and accountability.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

// Assignment type enum for categorization
const AssignmentType = z.enum([
  "RISK_TREATMENT",
  "MATURITY_AUDIT",
  "COMPLIANCE_AUDIT",
]);
type AssignmentType = z.infer<typeof AssignmentType>;

// Urgency levels for sorting/display
const UrgencyLevel = z.enum(["OVERDUE", "DUE_THIS_WEEK", "DUE_SOON", "UPCOMING", "NO_DUE_DATE"]);
type UrgencyLevel = z.infer<typeof UrgencyLevel>;

// Unified assignment interface
interface UnifiedAssignment {
  id: string;
  type: AssignmentType;
  title: string;
  description: string | null;
  status: string;
  dueDate: Date | null;
  urgency: UrgencyLevel;
  entityId: string; // The actual entity ID (risk, assessment, etc.)
  entityUrl: string; // URL to navigate to
  assignedAt: Date;
  metadata: Record<string, unknown>;
}

/**
 * Calculate urgency level based on due date
 */
function calculateUrgency(dueDate: Date | null): UrgencyLevel {
  if (!dueDate) return "NO_DUE_DATE";

  const now = new Date();
  const dueDateObj = new Date(dueDate);
  const diffMs = dueDateObj.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "OVERDUE";
  if (diffDays <= 7) return "DUE_THIS_WEEK";
  if (diffDays <= 14) return "DUE_SOON";
  return "UPCOMING";
}

export const myAssignmentsRouter = createTRPCRouter({
  /**
   * Get all assignments for the current user across all domains
   */
  getAll: protectedProcedure
    .input(
      z.object({
        types: z.array(AssignmentType).optional(), // Filter by type(s)
        includeCompleted: z.boolean().default(false),
      })
    )
    .query(async ({ ctx, input }) => {
      const { types, includeCompleted } = input;
      const userId = ctx.session.user.id;
      const userEmail = ctx.session.user.email;
      const organizationId = ctx.session.user.organizationId;

      if (!organizationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "User must belong to an organization",
        });
      }

      const assignments: UnifiedAssignment[] = [];

      // =========================================================================
      // 1. RISK TREATMENTS
      // Query via Person.email matching User.email
      // =========================================================================
      const shouldIncludeRisk = !types || types.includes("RISK_TREATMENT");

      if (shouldIncludeRisk && userEmail) {
        // Find Person records for this user (by email)
        const userPersons = await ctx.db.person.findMany({
          where: {
            organizationId,
            email: userEmail,
            isActive: true,
          },
          select: { id: true },
        });

        const personIds = userPersons.map((p) => p.id);

        if (personIds.length > 0) {
          const riskTreatments = await ctx.db.riskTreatment.findMany({
            where: {
              organizationId,
              assignedToId: { in: personIds },
              ...(includeCompleted
                ? {}
                : {
                    completedAt: null,
                  }),
            },
            include: {
              risk: {
                select: {
                  id: true,
                  title: true,
                  description: true,
                  status: true,
                },
              },
              assignedTo: {
                select: { id: true, name: true },
              },
              treatmentBusinessUnit: {
                select: { id: true, name: true },
              },
            },
            orderBy: { dueDate: "asc" },
          });

          for (const treatment of riskTreatments) {
            assignments.push({
              id: `risk-treatment-${treatment.id}`,
              type: "RISK_TREATMENT",
              title: treatment.risk.title ?? "Untitled Risk",
              description: treatment.detail ?? treatment.risk.description,
              status: treatment.completedAt
                ? "COMPLETED"
                : treatment.actionStatus ?? "NOT_STARTED",
              dueDate: treatment.targetCompletionDate ?? treatment.dueDate,
              urgency: calculateUrgency(
                treatment.targetCompletionDate ?? treatment.dueDate
              ),
              entityId: treatment.riskId,
              entityUrl: `/risks/${treatment.riskId}/treatment`,
              assignedAt: treatment.decidedAt,
              metadata: {
                treatmentId: treatment.id,
                treatmentType: treatment.treatmentType,
                riskStatus: treatment.risk.status,
                slaDueDate: treatment.dueDate,
                slaBreached: treatment.slaBreached,
                businessUnit: treatment.treatmentBusinessUnit?.name,
              },
            });
          }
        }
      }

      // =========================================================================
      // 2. MATURITY ASSESSMENTS
      // Query via AssessorAssignment.userId
      // =========================================================================
      const shouldIncludeMaturity = !types || types.includes("MATURITY_AUDIT");

      if (shouldIncludeMaturity) {
        const maturityAssignments = await ctx.db.assessorAssignment.findMany({
          where: {
            userId,
            assessment: {
              organizationId,
            },
            ...(includeCompleted
              ? {}
              : {
                  status: { in: ["PENDING", "IN_PROGRESS"] },
                }),
          },
          include: {
            assessment: {
              select: {
                id: true,
                identifier: true,
                name: true,
                description: true,
                status: true,
                targetDate: true,
                framework: {
                  select: { id: true, name: true },
                },
              },
            },
          },
          orderBy: { assignedAt: "desc" },
        });

        for (const assignment of maturityAssignments) {
          const assessment = assignment.assessment;
          assignments.push({
            id: `maturity-${assignment.id}`,
            type: "MATURITY_AUDIT",
            title: assessment.name,
            description: assessment.description,
            status: assignment.status,
            dueDate: assessment.targetDate,
            urgency: calculateUrgency(assessment.targetDate),
            entityId: assessment.id,
            entityUrl: `/maturity/${assessment.id}`,
            assignedAt: assignment.assignedAt,
            metadata: {
              assignmentId: assignment.id,
              assessmentIdentifier: assessment.identifier,
              assessmentStatus: assessment.status,
              frameworkName: assessment.framework?.name,
              assignedDomains: assignment.assignedDomains,
            },
          });
        }
      }

      // =========================================================================
      // 3. COMPLIANCE ASSESSMENTS
      // Query via assessorId (direct User link)
      // =========================================================================
      const shouldIncludeCompliance = !types || types.includes("COMPLIANCE_AUDIT");

      if (shouldIncludeCompliance) {
        const complianceAssessments = await ctx.db.complianceAssessment.findMany({
          where: {
            organizationId,
            assessorId: userId,
            ...(includeCompleted
              ? {}
              : {
                  status: { in: ["DRAFT", "IN_PROGRESS"] },
                }),
          },
          include: {
            framework: {
              select: { id: true, name: true },
            },
            businessUnit: {
              select: { id: true, name: true },
            },
          },
          orderBy: { dueDate: "asc" },
        });

        for (const assessment of complianceAssessments) {
          assignments.push({
            id: `compliance-${assessment.id}`,
            type: "COMPLIANCE_AUDIT",
            title: assessment.name,
            description: assessment.description,
            status: assessment.status,
            dueDate: assessment.dueDate,
            urgency: calculateUrgency(assessment.dueDate),
            entityId: assessment.id,
            entityUrl: `/compliance/assessments/${assessment.id}`,
            assignedAt: assessment.createdAt,
            metadata: {
              identifier: assessment.identifier,
              frameworkName: assessment.framework?.name,
              businessUnitName: assessment.businessUnit?.name,
              complianceScore: assessment.complianceScore,
              totalControls: assessment.totalControls,
              compliantCount: assessment.compliantCount,
            },
          });
        }
      }

      // Sort all assignments by urgency (overdue first), then by due date
      const urgencyOrder: Record<UrgencyLevel, number> = {
        OVERDUE: 0,
        DUE_THIS_WEEK: 1,
        DUE_SOON: 2,
        UPCOMING: 3,
        NO_DUE_DATE: 4,
      };

      assignments.sort((a, b) => {
        const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
        if (urgencyDiff !== 0) return urgencyDiff;

        // Within same urgency, sort by due date
        if (a.dueDate && b.dueDate) {
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return 0;
      });

      // Calculate summary stats
      const stats = {
        total: assignments.length,
        byType: {
          riskTreatments: assignments.filter((a) => a.type === "RISK_TREATMENT").length,
          maturityAudits: assignments.filter((a) => a.type === "MATURITY_AUDIT").length,
          complianceAudits: assignments.filter((a) => a.type === "COMPLIANCE_AUDIT").length,
        },
        byUrgency: {
          overdue: assignments.filter((a) => a.urgency === "OVERDUE").length,
          dueThisWeek: assignments.filter((a) => a.urgency === "DUE_THIS_WEEK").length,
          dueSoon: assignments.filter((a) => a.urgency === "DUE_SOON").length,
          upcoming: assignments.filter((a) => a.urgency === "UPCOMING").length,
          noDueDate: assignments.filter((a) => a.urgency === "NO_DUE_DATE").length,
        },
      };

      return {
        assignments,
        stats,
      };
    }),

  /**
   * Get summary counts for dashboard widgets
   */
  getSummary: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const userEmail = ctx.session.user.email;
    const organizationId = ctx.session.user.organizationId;

    if (!organizationId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "User must belong to an organization",
      });
    }

    // Get counts for each type
    let riskTreatmentCount = 0;

    if (userEmail) {
      // Find Person records for this user
      const userPersons = await ctx.db.person.findMany({
        where: {
          organizationId,
          email: userEmail,
          isActive: true,
        },
        select: { id: true },
      });

      const personIds = userPersons.map((p) => p.id);

      if (personIds.length > 0) {
        riskTreatmentCount = await ctx.db.riskTreatment.count({
          where: {
            organizationId,
            assignedToId: { in: personIds },
            completedAt: null,
          },
        });
      }
    }

    const maturityCount = await ctx.db.assessorAssignment.count({
      where: {
        userId,
        assessment: { organizationId },
        status: { in: ["PENDING", "IN_PROGRESS"] },
      },
    });

    const complianceCount = await ctx.db.complianceAssessment.count({
      where: {
        organizationId,
        assessorId: userId,
        status: { in: ["DRAFT", "IN_PROGRESS"] },
      },
    });

    return {
      riskTreatments: riskTreatmentCount,
      maturityAudits: maturityCount,
      complianceAudits: complianceCount,
      total: riskTreatmentCount + maturityCount + complianceCount,
    };
  }),
});
