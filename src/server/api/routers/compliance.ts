/**
 * Compliance Router - Dashboard and Summary Queries
 *
 * Story 5.1: Compliance Summary Dashboard (AC1-AC35)
 * Story 5.8: Remediation Velocity Metrics (AC1-AC29)
 *
 * Provides queries for:
 * - Framework coverage summary (AC2-AC3)
 * - Risk metrics (AC13-AC17)
 * - Compliance summary widget data (AC18-AC22)
 * - Trend calculations (AC23-AC27)
 * - Remediation velocity metrics (Story 5.8 AC22-AC25)
 *
 * @see Story 5.1: Compliance Summary Dashboard
 * @see Story 5.8: Remediation Velocity Metrics
 * @module server/api/routers/compliance
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  organizationProcedure,
  requirePermission,
  requireRole,
} from "@/server/api/trpc";
import { Permission } from "@/server/auth/permissions";
import { RiskStatus, Severity } from "@prisma/client";
import { READ_ROLES } from "@/lib/auth/roles";
import { generateEvidencePackagePDF } from "@/server/services/pdfGenerator";
import {
  getAllFrameworkCoverage,
  getCoverageTrend,
  calculateOverallComplianceScore,
  refreshFrameworkCoverage,
  refreshAllFrameworkCoverage,
  getBUFrameworkCoverage,
  getFrameworkBUCoverageBreakdown,
  type FrameworkCoverageResult,
  type CoverageTrend,
  type TrendDirection,
} from "@/server/services/complianceCalculator";

/**
 * Framework coverage with additional display information
 */
interface FrameworkCoverageDisplay {
  frameworkId: string;
  frameworkCode: string;
  frameworkName: string;
  frameworkVersion: string;
  coveragePercentage: number;
  satisfiedControlsCount: number;
  totalControlsCount: number;
  lastUpdated: Date;
  trend: {
    direction: TrendDirection;
    change: number;
    previousCoverage: number | null;
  };
  coverageLevel: "high" | "medium" | "low"; // For color coding (AC4)
}

/**
 * Compliance summary for the widget (AC18-AC22)
 */
interface ComplianceSummary {
  overallScore: number;
  totalFrameworks: number;
  readyForAudit: number; // Frameworks ≥90%
  needsAttention: number; // Frameworks <70%
  lastUpdated: Date;
}

/**
 * Risk metrics for dashboard (AC13-AC17)
 * Story 5.4: Enhanced with closedByName (AC8)
 */
interface RiskMetrics {
  openRisksCount: number;
  severityDistribution: {
    HIGH: number;
    MEDIUM: number;
    LOW: number;
  };
  recentlyClosed: Array<{
    id: string;
    title: string;
    severity: Severity; // Story 5.4: Severity for display
    closedAt: Date;
    daysToClose: number;
    closedByName: string | null; // Story 5.4 AC8: Who closed the risk
  }>;
}

/**
 * Story 5.4: Risk trend data for 30-day chart (AC13-AC17)
 */
interface RiskTrendData {
  dailyOpenCounts: Array<{
    date: string;
    count: number;
  }>;
  weeklyClosedCounts: Array<{
    weekStart: string;
    weekEnd: string;
    count: number;
  }>;
}

/**
 * Full compliance dashboard data
 */
interface ComplianceDashboardData {
  summary: ComplianceSummary;
  frameworks: FrameworkCoverageDisplay[];
  riskMetrics: RiskMetrics;
}

/**
 * Story 5.8: Velocity metrics by severity level (AC3, AC9)
 */
interface VelocityBySeverity {
  HIGH: number;
  MEDIUM: number;
  LOW: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
}

/**
 * Story 5.8: Monthly velocity trend data point (AC12-AC16)
 */
interface VelocityTrendPoint {
  month: string; // YYYY-MM format
  overall: number;
  bySeverity: {
    HIGH: number;
    MEDIUM: number;
    LOW: number;
  };
  count: number;
}

/**
 * Story 5.8: Velocity comparison between periods (AC4-AC5)
 */
interface VelocityComparison {
  currentPeriod: number;
  previousPeriod: number;
  change: number;
  direction: "improving" | "stable" | "degrading";
}

/**
 * Story 5.8: Industry benchmark thresholds (AC26-AC29)
 */
const VELOCITY_BENCHMARKS = {
  HIGH: 14, // AC27: <14 days industry best practice
  MEDIUM: 30, // AC28: <30 days
  LOW: 60, // AC29: <60 days
};

/**
 * Story 5.8: Full remediation velocity response (AC22-AC25)
 */
interface RemediationVelocityData {
  overall: number;
  bySeverity: VelocityBySeverity;
  trend: VelocityTrendPoint[];
  comparison: VelocityComparison;
  benchmarks: typeof VELOCITY_BENCHMARKS;
  closedRisksCount: number;
  timeframeDays: number;
}

/**
 * Get coverage level for color coding (AC4)
 */
function getCoverageLevel(percentage: number): "high" | "medium" | "low" {
  if (percentage >= 90) return "high"; // Green
  if (percentage >= 70) return "medium"; // Yellow
  return "low"; // Red
}

/**
 * Compliance Router
 */
export const complianceRouter = createTRPCRouter({
  /**
   * Get compliance summary for dashboard widget
   *
   * AC2-AC3, AC18-AC22: Dashboard summary with coverage data
   * BU-Scoped Compliance: Optional businessUnitId filter for BU-specific view
   *
   * @requires FRAMEWORK_READ permission
   */
  getComplianceSummary: organizationProcedure
    .use(requirePermission(Permission.FRAMEWORK_READ))
    .input(
      z.object({
        /** Optional BU ID - null returns org-level rollup */
        businessUnitId: z.string().nullable().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }): Promise<ComplianceDashboardData> => {
      // organizationProcedure guarantees organizationId is non-null
      const organizationId = ctx.organizationId!;
      const businessUnitId = input?.businessUnitId ?? null;

      // Always get all active frameworks - BU filter only affects coverage calculations
      const frameworksQuery = await ctx.db.framework.findMany({
        where: {
          organizationId,
          isActive: true,
        },
        select: {
          id: true,
          code: true,
          name: true,
          version: true,
        },
        orderBy: { name: "asc" },
      });

      // Get trends for all frameworks
      const frameworksWithCoverage: FrameworkCoverageDisplay[] = [];
      let totalCoverage = 0;
      let readyForAudit = 0;
      let needsAttention = 0;

      for (const framework of frameworksQuery) {
        let coveragePercentage: number;
        let satisfiedControlsCount: number;
        let totalControlsCount: number;
        let lastUpdated: Date;

        // First, check if there's a completed assessment for this framework + BU
        // Use assessment scores if available, otherwise fall back to evidence-based coverage
        const latestAssessment = await ctx.db.complianceAssessment.findFirst({
          where: {
            organizationId,
            frameworkId: framework.id,
            status: "COMPLETED",
            ...(businessUnitId ? { businessUnitId } : {}),
          },
          orderBy: { approvedAt: "desc" },
          select: {
            complianceScore: true,
            compliantCount: true,
            partialCount: true,
            totalControls: true,
            updatedAt: true,
          },
        });

        if (latestAssessment && latestAssessment.complianceScore !== null) {
          // Use assessment scores
          coveragePercentage = Number(latestAssessment.complianceScore);
          // For "satisfied", count compliant + partial (partial counts as 0.5)
          satisfiedControlsCount = latestAssessment.compliantCount + Math.floor(latestAssessment.partialCount / 2);
          totalControlsCount = latestAssessment.totalControls;
          lastUpdated = latestAssessment.updatedAt;
        } else if (businessUnitId) {
          // Get BU-specific coverage from evidence mappings
          const buCoverage = await getBUFrameworkCoverage(
            framework.id,
            organizationId,
            businessUnitId,
            ctx.db
          );
          coveragePercentage = buCoverage.coveragePercentage;
          satisfiedControlsCount = buCoverage.satisfiedControlsCount;
          totalControlsCount = buCoverage.totalControlsCount;
          lastUpdated = buCoverage.lastUpdated;
        } else {
          // Check for any completed assessments across all BUs for org-level rollup
          const allAssessments = await ctx.db.complianceAssessment.findMany({
            where: {
              organizationId,
              frameworkId: framework.id,
              status: "COMPLETED",
            },
            select: {
              complianceScore: true,
              compliantCount: true,
              partialCount: true,
              totalControls: true,
              updatedAt: true,
            },
          });

          if (allAssessments.length > 0) {
            // Calculate average across all completed assessments
            const validAssessments = allAssessments.filter(a => a.complianceScore !== null);
            if (validAssessments.length > 0) {
              const totalScore = validAssessments.reduce((sum, a) => sum + Number(a.complianceScore), 0);
              coveragePercentage = totalScore / validAssessments.length;
              const totalSatisfied = validAssessments.reduce((sum, a) => sum + a.compliantCount + Math.floor(a.partialCount / 2), 0);
              satisfiedControlsCount = Math.round(totalSatisfied / validAssessments.length);
              totalControlsCount = validAssessments[0]!.totalControls;
              lastUpdated = validAssessments.reduce((latest, a) => a.updatedAt > latest ? a.updatedAt : latest, validAssessments[0]!.updatedAt);
            } else {
              // Fall back to evidence-based coverage
              const breakdown = await getFrameworkBUCoverageBreakdown(
                framework.id,
                organizationId,
                ctx.db
              );
              coveragePercentage = breakdown.orgRollup.coveragePercentage;
              satisfiedControlsCount = breakdown.orgRollup.satisfiedControlsCount;
              totalControlsCount = breakdown.orgRollup.totalControlsCount;
              lastUpdated = breakdown.orgRollup.lastUpdated;
            }
          } else {
            // Get org-level rollup from evidence mappings
            const breakdown = await getFrameworkBUCoverageBreakdown(
              framework.id,
              organizationId,
              ctx.db
            );
            coveragePercentage = breakdown.orgRollup.coveragePercentage;
            satisfiedControlsCount = breakdown.orgRollup.satisfiedControlsCount;
            totalControlsCount = breakdown.orgRollup.totalControlsCount;
            lastUpdated = breakdown.orgRollup.lastUpdated;
          }
        }

        // Get trend
        const trend = await getCoverageTrend(framework.id, organizationId, ctx.db);

        const coverageLevel = getCoverageLevel(coveragePercentage);

        if (coveragePercentage >= 90) readyForAudit++;
        if (coveragePercentage < 70) needsAttention++;
        totalCoverage += coveragePercentage;

        frameworksWithCoverage.push({
          frameworkId: framework.id,
          frameworkCode: framework.code,
          frameworkName: framework.name,
          frameworkVersion: framework.version,
          coveragePercentage,
          satisfiedControlsCount,
          totalControlsCount,
          lastUpdated,
          trend: {
            direction: trend.direction,
            change: trend.change,
            previousCoverage: trend.previousCoverage,
          },
          coverageLevel,
        });
      }

      // Calculate overall score
      const overallScore = frameworksQuery.length > 0
        ? Math.round((totalCoverage / frameworksQuery.length) * 100) / 100
        : 0;

      // Get risk metrics
      const riskMetrics = await getRiskMetrics(organizationId, ctx.db);

      return {
        summary: {
          overallScore,
          totalFrameworks: frameworksQuery.length,
          readyForAudit,
          needsAttention,
          lastUpdated: new Date(),
        },
        frameworks: frameworksWithCoverage,
        riskMetrics,
      };
    }),

  /**
   * Get risk metrics for dashboard
   *
   * AC13-AC17: Risk metrics display
   *
   * @requires RISK_READ_ALL permission
   */
  getRiskMetrics: organizationProcedure
    .use(requirePermission(Permission.RISK_READ_ALL))
    .query(async ({ ctx }): Promise<RiskMetrics> => {
      return getRiskMetrics(ctx.organizationId!, ctx.db);
    }),

  /**
   * Refresh coverage for a single framework
   *
   * Story 5.2: On-Demand Compliance Refresh Button (AC12-AC15)
   * - AC12: Individual framework cards include small refresh icon button
   * - AC13: Clicking framework refresh recalculates only that framework
   * - AC14: Per-framework refresh faster than full refresh (<1 second)
   * - AC15: Framework card updates immediately after recalculation
   *
   * @requires FRAMEWORK_READ permission
   */
  refreshFrameworkCoverage: organizationProcedure
    .use(requirePermission(Permission.FRAMEWORK_READ))
    .input(z.object({ frameworkId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const framework = await ctx.db.framework.findFirst({
        where: {
          id: input.frameworkId,
          organizationId: ctx.organizationId!,
        },
      });

      if (!framework) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Framework not found",
        });
      }

      const coverage = await refreshFrameworkCoverage(
        input.frameworkId,
        ctx.organizationId!,
        ctx.db
      );

      return coverage;
    }),

  /**
   * Refresh coverage for all frameworks
   *
   * Story 5.2: On-Demand Compliance Refresh Button (AC7-AC11)
   * - AC7: Recalculates all active frameworks for organization
   * - AC8: Validates user has appropriate permissions (via FRAMEWORK_READ)
   * - AC9: Processes frameworks in parallel for performance
   * - AC11: Returns refreshed framework coverage data
   *
   * @requires FRAMEWORK_READ permission
   */
  refreshAllCoverage: organizationProcedure
    .use(requirePermission(Permission.FRAMEWORK_READ))
    .mutation(async ({ ctx }) => {
      const startTime = Date.now();

      // AC7, AC9: Refresh all active frameworks in parallel
      const coverages = await refreshAllFrameworkCoverage(
        ctx.organizationId!,
        ctx.db
      );

      const durationMs = Date.now() - startTime;

      // AC11: Return refreshed coverage data
      return {
        refreshedCount: coverages.length,
        coverages,
        durationMs,
      };
    }),

  /**
   * Get framework details with control status
   *
   * AC28-AC31: Framework detail page data
   *
   * @requires FRAMEWORK_READ permission
   */
  getFrameworkDetails: organizationProcedure
    .use(requirePermission(Permission.FRAMEWORK_READ))
    .input(z.object({ frameworkId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const framework = await ctx.db.framework.findFirst({
        where: {
          id: input.frameworkId,
          organizationId: ctx.organizationId!,
        },
        select: {
          id: true,
          code: true,
          name: true,
          version: true,
          description: true,
          isActive: true,
        },
      });

      if (!framework) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Framework not found",
        });
      }

      // Get all controls for this framework
      const controls = await ctx.db.control.findMany({
        where: {
          frameworkId: input.frameworkId,
          isActive: true,
        },
        select: {
          id: true,
          controlId: true,
          title: true,
          description: true,
        },
        orderBy: { controlId: "asc" },
      });

      // Get control domain IDs that have evidence for this organization
      const domainsWithEvidence = await ctx.db.evidenceControlDomain.findMany({
        where: {
          Evidence: {
            organizationId: ctx.organizationId!,
            isActive: true,
            deletedAt: null,
          },
        },
        select: {
          controlDomainId: true,
        },
        distinct: ["controlDomainId"],
      });

      const domainIds = domainsWithEvidence.map((d) => d.controlDomainId);

      // Get control IDs that are satisfied via control domain mappings
      const satisfiedMappings = await ctx.db.controlDomainMapping.findMany({
        where: {
          frameworkCode: framework.code,
          controlDomainId: { in: domainIds },
        },
        select: {
          controlId: true,
        },
        distinct: ["controlId"],
      });

      const satisfiedControlIds = new Set(satisfiedMappings.map((m) => m.controlId));

      // Get evidence count per control (via control domain mappings)
      const controlEvidenceCounts = new Map<string, number>();

      // For each control, count evidence files that map to it
      for (const control of controls) {
        if (satisfiedControlIds.has(control.controlId)) {
          // Get the control domains that map to this control
          const controlMappings = await ctx.db.controlDomainMapping.findMany({
            where: {
              frameworkCode: framework.code,
              controlId: control.controlId,
            },
            select: {
              controlDomainId: true,
            },
          });

          const mappedDomainIds = controlMappings.map((m) => m.controlDomainId);

          // Count evidence files tagged with these domains
          const evidenceCount = await ctx.db.evidenceControlDomain.count({
            where: {
              controlDomainId: { in: mappedDomainIds },
              Evidence: {
                organizationId: ctx.organizationId!,
                isActive: true,
                deletedAt: null,
              },
            },
          });

          controlEvidenceCounts.set(control.controlId, evidenceCount);
        }
      }

      // Build controls with status
      const controlsWithStatus = controls.map((control) => ({
        id: control.id,
        controlId: control.controlId,
        title: control.title,
        description: control.description,
        isSatisfied: satisfiedControlIds.has(control.controlId),
        evidenceCount: controlEvidenceCounts.get(control.controlId) ?? 0,
      }));

      // Calculate coverage
      const satisfiedCount = controlsWithStatus.filter((c) => c.isSatisfied).length;
      const totalCount = controlsWithStatus.length;
      const coveragePercentage = totalCount > 0
        ? Math.round((satisfiedCount / totalCount) * 10000) / 100
        : 0;

      return {
        framework: {
          ...framework,
          coveragePercentage,
          satisfiedControlsCount: satisfiedCount,
          totalControlsCount: totalCount,
        },
        controls: controlsWithStatus,
      };
    }),

  /**
   * Get risk trend data for 30-day chart
   *
   * Story 5.4: Risk Trend Widget (AC13-AC17)
   * - AC13: Widget shows risk trend over last 30 days
   * - AC14: Chart plots open risks count per day
   * - AC15: Chart includes closed risks per week
   * - AC16: Hover tooltip shows exact count
   * - AC17: Trend helps visualize remediation velocity
   *
   * @requires RISK_READ_ALL permission
   */
  getRiskTrend: organizationProcedure
    .use(requirePermission(Permission.RISK_READ_ALL))
    .query(async ({ ctx }): Promise<RiskTrendData> => {
      return getRiskTrendData(ctx.organizationId!, ctx.db);
    }),

  /**
   * Export evidence package as PDF
   *
   * Story 5.7: PDF Evidence Package Export (AC1-AC30)
   * - AC1: Framework detail page includes "Export Evidence Package (PDF)" button
   * - AC2: Export generates PDF for all evidence mapped to selected framework
   * - AC22: PDF generated using Puppeteer (headless Chrome)
   * - AC27: exportEvidencePackage mutation accepts frameworkId
   * - AC28: Mutation validates user has GRC_ANALYST, ORG_ADMIN, or AUDITOR role
   *
   * @requires GRC_ANALYST, ORG_ADMIN, or AUDITOR role
   */
  exportEvidencePackage: organizationProcedure
    .use(requireRole(READ_ROLES))
    .input(z.object({ frameworkId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      // Verify framework exists and belongs to organization
      const framework = await ctx.db.framework.findFirst({
        where: {
          id: input.frameworkId,
          organizationId: ctx.organizationId!,
        },
        select: {
          id: true,
          code: true,
          name: true,
        },
      });

      if (!framework) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Framework not found",
        });
      }

      // Generate PDF
      const { buffer, filename } = await generateEvidencePackagePDF(
        input.frameworkId,
        ctx.organizationId!,
        ctx.db
      );

      // Create audit log entry
      // Note: EXPORT_EVIDENCE_PACKAGE needs Prisma generate after schema update
      await ctx.db.auditLog.create({
        data: {
          id: crypto.randomUUID(),
          action: "EXPORT_EVIDENCE_PACKAGE" as Parameters<typeof ctx.db.auditLog.create>[0]["data"]["action"],
          entityType: "FRAMEWORK",
          entityId: input.frameworkId,
          userId: ctx.session!.user.id,
          actorName: ctx.session!.user.name ?? ctx.session!.user.email,
          actorRole: ctx.session!.user.role,
          organizationId: ctx.organizationId!,
          changes: {
            before: null,
            after: {
              exportType: "PDF",
              frameworkCode: framework.code,
              frameworkName: framework.name,
              filename,
              fileSizeBytes: buffer.length,
            },
          },
        },
      });

      // Return PDF as base64 encoded string for client download
      return {
        filename,
        data: buffer.toString("base64"),
        mimeType: "application/pdf",
        sizeBytes: buffer.length,
      };
    }),

  /**
   * Get remediation velocity metrics
   *
   * Story 5.8: Remediation Velocity Metrics (AC22-AC25)
   * - AC22: getRemediationVelocity query returns average days-to-close
   * - AC23: Query accepts timeframe parameter (last 30/60/90/180/365 days)
   * - AC24: Query calculates average per severity level
   * - AC25: Query returns trend data (monthly averages for chart)
   *
   * @requires RISK_READ_ALL permission
   */
  getRemediationVelocity: organizationProcedure
    .use(requirePermission(Permission.RISK_READ_ALL))
    .input(
      z.object({
        timeframeDays: z.number().min(30).max(365).default(90),
      })
    )
    .query(async ({ ctx, input }): Promise<RemediationVelocityData> => {
      return getRemediationVelocityData(
        ctx.organizationId!,
        input.timeframeDays,
        ctx.db
      );
    }),

  /**
   * Get detailed velocity report data
   *
   * Story 5.8: Detailed Velocity Report (AC17-AC21)
   * - AC17: Clicking widget navigates to detailed velocity report page
   * - AC18: Report shows overall average, by severity, by IT owner, by finding source
   * - AC19: Report includes table listing all closed risks with days-to-close
   * - AC20: Table sortable by days-to-close, closed date, severity
   * - AC21: Report exportable to CSV
   *
   * @requires RISK_READ_ALL permission
   */
  getVelocityReport: organizationProcedure
    .use(requirePermission(Permission.RISK_READ_ALL))
    .input(
      z.object({
        timeframeDays: z.number().min(30).max(365).default(90),
        sortBy: z.enum(["daysToClose", "closedAt", "severity"]).default("daysToClose"),
        sortOrder: z.enum(["asc", "desc"]).default("desc"),
      })
    )
    .query(async ({ ctx, input }) => {
      return getVelocityReportData(
        ctx.organizationId!,
        input.timeframeDays,
        input.sortBy,
        input.sortOrder,
        ctx.db
      );
    }),

  /**
   * Export velocity report as CSV
   *
   * Story 5.8: AC21 - Report exportable to CSV
   *
   * @requires RISK_READ_ALL permission
   */
  exportVelocityReport: organizationProcedure
    .use(requirePermission(Permission.RISK_READ_ALL))
    .input(
      z.object({
        timeframeDays: z.number().min(30).max(365).default(90),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const data = await getVelocityReportData(
        ctx.organizationId!,
        input.timeframeDays,
        "daysToClose",
        "desc",
        ctx.db
      );

      // Build CSV content
      const headers = [
        "Risk ID",
        "Title",
        "Severity",
        "Created Date",
        "Closed Date",
        "Days to Close",
        "IT Owner",
        "Business Owner",
        "Finding Source",
      ];

      const rows = data.closedRisks.map((risk) => [
        risk.id,
        `"${risk.title.replace(/"/g, '""')}"`,
        risk.severity,
        risk.createdAt.toISOString().split("T")[0],
        risk.closedAt.toISOString().split("T")[0],
        risk.daysToClose.toString(),
        risk.itOwnerName ?? "",
        risk.businessOwnerName ?? "",
        risk.findingSource ?? "",
      ]);

      // Add summary row at the end
      rows.push([]);
      rows.push(["Summary"]);
      rows.push(["Total Closed Risks", data.closedRisks.length.toString()]);
      rows.push(["Overall Average Days", data.overallAverage.toFixed(1)]);
      rows.push(["HIGH Severity Average", data.averageBySeverity.HIGH.toFixed(1)]);
      rows.push(["MEDIUM Severity Average", data.averageBySeverity.MEDIUM.toFixed(1)]);
      rows.push(["LOW Severity Average", data.averageBySeverity.LOW.toFixed(1)]);

      const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");

      const dateStr = new Date().toISOString().split("T")[0];
      const filename = `velocity-report-${dateStr}.csv`;

      // Create audit log
      await ctx.db.auditLog.create({
        data: {
          id: crypto.randomUUID(),
          action: "EXPORT_RISKS" as Parameters<typeof ctx.db.auditLog.create>[0]["data"]["action"],
          entityType: "RISK",
          entityId: "velocity-report",
          userId: ctx.session!.user.id,
          actorName: ctx.session!.user.name ?? ctx.session!.user.email,
          actorRole: ctx.session!.user.role,
          organizationId: ctx.organizationId!,
          changes: {
            before: null,
            after: {
              exportType: "CSV",
              reportType: "velocity-report",
              timeframeDays: input.timeframeDays,
              closedRisksCount: data.closedRisks.length,
            },
          },
        },
      });

      return {
        filename,
        data: csvContent,
        mimeType: "text/csv",
      };
    }),

  /**
   * Get SLA status summary for dashboard widget
   *
   * Story 16.8: Treatment SLA Display & Alerts (AC5-AC7)
   * - AC5: "SLA Status" widget on compliance dashboard
   * - AC6: Shows count by status (On Track, At Risk, Breached)
   * - AC7: Click status to filter risk register
   *
   * @requires RISK_READ_ALL permission
   */
  getSLAStatusSummary: organizationProcedure
    .use(requirePermission(Permission.RISK_READ_ALL))
    .query(async ({ ctx }) => {
      const organizationId = ctx.organizationId!;
      const now = new Date();
      const thresholdDays = 3; // At Risk threshold

      // Get all active treatments (not completed)
      const activeTreatments = await ctx.db.riskTreatment.findMany({
        where: {
          organizationId,
          completedAt: null,
        },
        select: {
          id: true,
          riskId: true,
          dueDate: true,
          treatmentType: true,
          risk: {
            select: {
              id: true,
              title: true,
              severity: true,
            },
          },
        },
      });

      // Calculate status for each treatment
      let onTrack = 0;
      let atRisk = 0;
      let breached = 0;
      const atRiskRisks: { id: string; title: string; daysRemaining: number }[] = [];
      const breachedRisks: { id: string; title: string; daysOverdue: number }[] = [];

      for (const treatment of activeTreatments) {
        if (!treatment.dueDate) {
          onTrack++;
          continue;
        }

        const daysRemaining = Math.floor(
          (treatment.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysRemaining < 0) {
          breached++;
          breachedRisks.push({
            id: treatment.risk.id,
            title: treatment.risk.title,
            daysOverdue: Math.abs(daysRemaining),
          });
        } else if (daysRemaining <= thresholdDays) {
          atRisk++;
          atRiskRisks.push({
            id: treatment.risk.id,
            title: treatment.risk.title,
            daysRemaining,
          });
        } else {
          onTrack++;
        }
      }

      // Get completed treatments count (last 30 days)
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const completedCount = await ctx.db.riskTreatment.count({
        where: {
          organizationId,
          completedAt: { gte: thirtyDaysAgo },
        },
      });

      return {
        onTrack,
        atRisk,
        breached,
        total: activeTreatments.length,
        completedLast30Days: completedCount,
        atRiskRisks: atRiskRisks.slice(0, 5), // Top 5 at risk
        breachedRisks: breachedRisks.slice(0, 5), // Top 5 breached
      };
    }),

  /**
   * Get risk heatmap data for severity distribution visualization
   *
   * Returns a 5x5 matrix of risk counts by likelihood and impact levels.
   * Uses inherentLikelihood and inherentImpact if available, otherwise
   * derives approximate values from the severity field.
   *
   * @requires RISK_READ_ALL permission
   */
  getRiskHeatmapData: organizationProcedure
    .use(requirePermission(Permission.RISK_READ_ALL))
    .query(async ({ ctx }) => {
      // Fetch all open risks with their likelihood/impact data
      const risks = await ctx.db.risk.findMany({
        where: {
          organizationId: ctx.organizationId!,
          status: {
            in: [RiskStatus.OPEN, RiskStatus.ASSIGNED, RiskStatus.PENDING_REVIEW],
          },
        },
        select: {
          id: true,
          title: true,
          severity: true,
          inherentLikelihood: true,
          inherentImpact: true,
          impactScore: true,
        },
      });

      // Define 5x5 matrix levels
      const levels = ["Very Low", "Low", "Medium", "High", "Very High"] as const;
      type Level = typeof levels[number];

      // Initialize the heatmap matrix
      const matrix: Record<Level, Record<Level, { count: number; risks: Array<{ id: string; title: string; severity: Severity }> }>> = {
        "Very High": { "Very Low": { count: 0, risks: [] }, "Low": { count: 0, risks: [] }, "Medium": { count: 0, risks: [] }, "High": { count: 0, risks: [] }, "Very High": { count: 0, risks: [] } },
        "High": { "Very Low": { count: 0, risks: [] }, "Low": { count: 0, risks: [] }, "Medium": { count: 0, risks: [] }, "High": { count: 0, risks: [] }, "Very High": { count: 0, risks: [] } },
        "Medium": { "Very Low": { count: 0, risks: [] }, "Low": { count: 0, risks: [] }, "Medium": { count: 0, risks: [] }, "High": { count: 0, risks: [] }, "Very High": { count: 0, risks: [] } },
        "Low": { "Very Low": { count: 0, risks: [] }, "Low": { count: 0, risks: [] }, "Medium": { count: 0, risks: [] }, "High": { count: 0, risks: [] }, "Very High": { count: 0, risks: [] } },
        "Very Low": { "Very Low": { count: 0, risks: [] }, "Low": { count: 0, risks: [] }, "Medium": { count: 0, risks: [] }, "High": { count: 0, risks: [] }, "Very High": { count: 0, risks: [] } },
      };

      // Helper to convert decimal value (0-5 scale) to level
      const valueToLevel = (value: number): Level => {
        if (value <= 1) return "Very Low";
        if (value <= 2) return "Low";
        if (value <= 3) return "Medium";
        if (value <= 4) return "High";
        return "Very High";
      };

      // Helper to derive likelihood/impact from severity when not available
      const severityToLevels = (severity: Severity): { likelihood: Level; impact: Level } => {
        switch (severity) {
          case "HIGH":
            return { likelihood: "High", impact: "High" };
          case "MEDIUM":
            return { likelihood: "Medium", impact: "Medium" };
          case "LOW":
            return { likelihood: "Low", impact: "Low" };
          default:
            return { likelihood: "Medium", impact: "Medium" };
        }
      };

      // Populate the matrix
      for (const risk of risks) {
        let likelihood: Level;
        let impact: Level;

        if (risk.inherentLikelihood !== null && risk.inherentImpact !== null) {
          // Use actual values if available
          likelihood = valueToLevel(Number(risk.inherentLikelihood));
          impact = valueToLevel(Number(risk.inherentImpact));
        } else {
          // Derive from severity
          const derived = severityToLevels(risk.severity);
          likelihood = derived.likelihood;
          impact = derived.impact;
        }

        matrix[likelihood][impact].count++;
        matrix[likelihood][impact].risks.push({
          id: risk.id,
          title: risk.title,
          severity: risk.severity,
        });
      }

      // Convert to array format for easier consumption
      const cells = levels.flatMap((likelihood, likelihoodIdx) =>
        levels.map((impact, impactIdx) => ({
          likelihood,
          likelihoodIdx: 4 - likelihoodIdx, // Reverse so "Very High" is at top
          impact,
          impactIdx,
          count: matrix[likelihood][impact].count,
          risks: matrix[likelihood][impact].risks.slice(0, 5), // Limit to 5 risks per cell
          // Calculate severity color based on position
          severityLevel: getSeverityFromPosition(4 - likelihoodIdx, impactIdx),
        }))
      );

      return {
        cells,
        levels,
        totalRisks: risks.length,
      };
    }),
});

/**
 * Helper to determine severity level based on matrix position
 */
function getSeverityFromPosition(likelihoodIdx: number, impactIdx: number): "critical" | "high" | "medium" | "low" {
  const score = likelihoodIdx + impactIdx; // 0-8 range
  if (score >= 7) return "critical";
  if (score >= 5) return "high";
  if (score >= 3) return "medium";
  return "low";
}

/**
 * Helper function to get risk metrics
 * Used by both getComplianceSummary and getRiskMetrics
 */
async function getRiskMetrics(
  organizationId: string,
  db: typeof import("@/server/db").db
): Promise<RiskMetrics> {
  // Count open risks (OPEN or ASSIGNED)
  const openRisksCount = await db.risk.count({
    where: {
      organizationId,
      status: { in: [RiskStatus.OPEN, RiskStatus.ASSIGNED] },
    },
  });

  // Get severity distribution
  const [highCount, mediumCount, lowCount] = await Promise.all([
    db.risk.count({
      where: {
        organizationId,
        status: { in: [RiskStatus.OPEN, RiskStatus.ASSIGNED] },
        severity: Severity.HIGH,
      },
    }),
    db.risk.count({
      where: {
        organizationId,
        status: { in: [RiskStatus.OPEN, RiskStatus.ASSIGNED] },
        severity: Severity.MEDIUM,
      },
    }),
    db.risk.count({
      where: {
        organizationId,
        status: { in: [RiskStatus.OPEN, RiskStatus.ASSIGNED] },
        severity: Severity.LOW,
      },
    }),
  ]);

  // Get recently closed risks (last 10) with who closed them
  // Story 5.4 AC8: Include closedByName
  const closedRisks = await db.risk.findMany({
    where: {
      organizationId,
      status: RiskStatus.CLOSED,
    },
    select: {
      id: true,
      title: true,
      severity: true,
      createdAt: true,
      updatedAt: true,
      // Get the status history to find who closed it
      StatusHistory: {
        where: {
          newStatus: RiskStatus.CLOSED,
        },
        orderBy: { changedAt: "desc" },
        take: 1,
        select: {
          ChangedBy: {
            select: { name: true },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 10,
  });

  // Calculate days-to-close for each
  const recentlyClosed = closedRisks.map((risk) => {
    const closedAt = risk.updatedAt;
    const daysToClose = Math.ceil(
      (closedAt.getTime() - risk.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    // Get the name of who closed it from status history
    const closedByName = risk.StatusHistory[0]?.ChangedBy?.name ?? null;

    return {
      id: risk.id,
      title: risk.title,
      severity: risk.severity,
      closedAt,
      daysToClose,
      closedByName,
    };
  });

  return {
    openRisksCount,
    severityDistribution: {
      HIGH: highCount,
      MEDIUM: mediumCount,
      LOW: lowCount,
    },
    recentlyClosed,
  };
}

/**
 * Helper function to get risk trend data for 30-day chart
 * Story 5.4: AC13-AC17
 */
async function getRiskTrendData(
  organizationId: string,
  db: typeof import("@/server/db").db
): Promise<RiskTrendData> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Get all risks for the organization to calculate daily open counts
  const risks = await db.risk.findMany({
    where: {
      organizationId,
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      StatusHistory: {
        orderBy: { changedAt: "asc" },
        select: {
          oldStatus: true,
          newStatus: true,
          changedAt: true,
        },
      },
    },
  });

  // Calculate open risk count for each day in the last 30 days
  const dailyOpenCounts: Array<{ date: string; count: number }> = [];

  for (let i = 0; i < 30; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - (29 - i)); // Start from 30 days ago
    date.setHours(23, 59, 59, 999); // End of day

    // Count risks that were open on this date
    let openCount = 0;
    for (const risk of risks) {
      // If risk was created after this date, skip
      if (risk.createdAt > date) continue;

      // Find the status at this date by looking at history
      let statusAtDate: RiskStatus = RiskStatus.OPEN; // Default to OPEN when created

      for (const history of risk.StatusHistory) {
        if (history.changedAt <= date) {
          statusAtDate = history.newStatus;
        } else {
          break;
        }
      }

      // If no history, use current status if created before date
      if (risk.StatusHistory.length === 0) {
        statusAtDate = risk.status;
      }

      // Count as open if status was OPEN or ASSIGNED
      if (statusAtDate === RiskStatus.OPEN || statusAtDate === RiskStatus.ASSIGNED) {
        openCount++;
      }
    }

    dailyOpenCounts.push({
      date: date.toISOString().split("T")[0]!, // YYYY-MM-DD
      count: openCount,
    });
  }

  // Calculate closed risks per week (last 5 weeks)
  const weeklyClosedCounts: Array<{ weekStart: string; weekEnd: string; count: number }> = [];

  for (let i = 0; i < 5; i++) {
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() - (i * 7));
    weekEnd.setHours(23, 59, 59, 999);

    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);

    // Count risks closed during this week
    const closedCount = await db.riskStatusHistory.count({
      where: {
        organizationId,
        newStatus: RiskStatus.CLOSED,
        changedAt: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
    });

    weeklyClosedCounts.unshift({
      weekStart: weekStart.toISOString().split("T")[0]!,
      weekEnd: weekEnd.toISOString().split("T")[0]!,
      count: closedCount,
    });
  }

  return {
    dailyOpenCounts,
    weeklyClosedCounts,
  };
}

/**
 * Story 5.8: Calculate remediation velocity data
 *
 * AC7-AC11: Velocity calculation
 * AC22-AC25: Velocity query implementation
 */
async function getRemediationVelocityData(
  organizationId: string,
  timeframeDays: number,
  db: typeof import("@/server/db").db
): Promise<RemediationVelocityData> {
  const now = new Date();
  const cutoffDate = new Date(now);
  cutoffDate.setDate(cutoffDate.getDate() - timeframeDays);

  // Previous period for comparison (AC4)
  const previousCutoffDate = new Date(cutoffDate);
  previousCutoffDate.setDate(previousCutoffDate.getDate() - timeframeDays);

  // Get closed risks in current period
  // AC8: Average calculated across all CLOSED risks in time period
  // AC10: Calculation excludes risks with status != CLOSED
  const closedRisks = await db.risk.findMany({
    where: {
      organizationId,
      status: RiskStatus.CLOSED,
      updatedAt: { gte: cutoffDate },
    },
    select: {
      id: true,
      severity: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // Get previous period closed risks for comparison
  const previousClosedRisks = await db.risk.findMany({
    where: {
      organizationId,
      status: RiskStatus.CLOSED,
      updatedAt: { gte: previousCutoffDate, lt: cutoffDate },
    },
    select: {
      id: true,
      severity: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // AC7: Days-to-close calculated as: (closedAt - createdAt) / (1000 * 60 * 60 * 24)
  // AC11: Calculation handles risks with missing closedAt gracefully (skip them)
  const calculateDaysToClose = (risk: { createdAt: Date; updatedAt: Date }) => {
    return Math.max(
      0,
      Math.floor((risk.updatedAt.getTime() - risk.createdAt.getTime()) / (1000 * 60 * 60 * 24))
    );
  };

  const risksWithDays = closedRisks.map((r) => ({
    ...r,
    daysToClose: calculateDaysToClose(r),
  }));

  const previousRisksWithDays = previousClosedRisks.map((r) => ({
    ...r,
    daysToClose: calculateDaysToClose(r),
  }));

  // Calculate overall average
  const calculateAverage = (risks: Array<{ daysToClose: number }>) => {
    if (risks.length === 0) return 0;
    const sum = risks.reduce((acc, r) => acc + r.daysToClose, 0);
    return Math.round((sum / risks.length) * 10) / 10;
  };

  const overall = calculateAverage(risksWithDays);

  // AC9: Average calculated separately for each severity level
  const highRisks = risksWithDays.filter((r) => r.severity === Severity.HIGH);
  const mediumRisks = risksWithDays.filter((r) => r.severity === Severity.MEDIUM);
  const lowRisks = risksWithDays.filter((r) => r.severity === Severity.LOW);

  const bySeverity: VelocityBySeverity = {
    HIGH: calculateAverage(highRisks),
    MEDIUM: calculateAverage(mediumRisks),
    LOW: calculateAverage(lowRisks),
    highCount: highRisks.length,
    mediumCount: mediumRisks.length,
    lowCount: lowRisks.length,
  };

  // AC4-AC5: Calculate comparison with previous period
  const previousOverall = calculateAverage(previousRisksWithDays);
  const change = previousOverall > 0 ? Math.round((overall - previousOverall) * 10) / 10 : 0;

  let direction: "improving" | "stable" | "degrading";
  if (Math.abs(change) < 1) {
    direction = "stable"; // AC5: stable if change is minimal
  } else if (change < 0) {
    direction = "improving"; // Lower days = better
  } else {
    direction = "degrading";
  }

  const comparison: VelocityComparison = {
    currentPeriod: overall,
    previousPeriod: previousOverall,
    change,
    direction,
  };

  // AC12-AC16: Calculate monthly trend (last 12 months)
  const trend = await calculateMonthlyVelocityTrend(organizationId, db);

  return {
    overall,
    bySeverity,
    trend,
    comparison,
    benchmarks: VELOCITY_BENCHMARKS,
    closedRisksCount: closedRisks.length,
    timeframeDays,
  };
}

/**
 * Story 5.8: Calculate monthly velocity trend for chart
 *
 * AC12-AC16: Velocity Trend Chart
 */
async function calculateMonthlyVelocityTrend(
  organizationId: string,
  db: typeof import("@/server/db").db
): Promise<VelocityTrendPoint[]> {
  const now = new Date();
  const trend: VelocityTrendPoint[] = [];

  // Get last 12 months of data
  for (let i = 11; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);

    // Get closed risks in this month
    const monthRisks = await db.risk.findMany({
      where: {
        organizationId,
        status: RiskStatus.CLOSED,
        updatedAt: { gte: monthStart, lte: monthEnd },
      },
      select: {
        severity: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const calculateDaysToClose = (risk: { createdAt: Date; updatedAt: Date }) => {
      return Math.max(
        0,
        Math.floor((risk.updatedAt.getTime() - risk.createdAt.getTime()) / (1000 * 60 * 60 * 24))
      );
    };

    const risksWithDays = monthRisks.map((r) => ({
      ...r,
      daysToClose: calculateDaysToClose(r),
    }));

    const calculateAverage = (risks: Array<{ daysToClose: number }>) => {
      if (risks.length === 0) return 0;
      const sum = risks.reduce((acc, r) => acc + r.daysToClose, 0);
      return Math.round((sum / risks.length) * 10) / 10;
    };

    const highRisks = risksWithDays.filter((r) => r.severity === Severity.HIGH);
    const mediumRisks = risksWithDays.filter((r) => r.severity === Severity.MEDIUM);
    const lowRisks = risksWithDays.filter((r) => r.severity === Severity.LOW);

    trend.push({
      month: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}`,
      overall: calculateAverage(risksWithDays),
      bySeverity: {
        HIGH: calculateAverage(highRisks),
        MEDIUM: calculateAverage(mediumRisks),
        LOW: calculateAverage(lowRisks),
      },
      count: risksWithDays.length,
    });
  }

  return trend;
}

/**
 * Story 5.8: Get detailed velocity report data
 *
 * AC17-AC21: Detailed Velocity Report
 */
interface VelocityReportData {
  overallAverage: number;
  averageBySeverity: {
    HIGH: number;
    MEDIUM: number;
    LOW: number;
  };
  averageByItOwner: Array<{
    ownerId: string;
    ownerName: string;
    average: number;
    count: number;
  }>;
  averageByFindingSource: Array<{
    source: string;
    average: number;
    count: number;
  }>;
  slowestRisks: Array<{
    id: string;
    title: string;
    severity: Severity;
    daysToClose: number;
    createdAt: Date;
    closedAt: Date;
  }>;
  closedRisks: Array<{
    id: string;
    title: string;
    severity: Severity;
    daysToClose: number;
    createdAt: Date;
    closedAt: Date;
    itOwnerName: string | null;
    businessOwnerName: string | null;
    findingSource: string | null;
  }>;
}

async function getVelocityReportData(
  organizationId: string,
  timeframeDays: number,
  sortBy: "daysToClose" | "closedAt" | "severity",
  sortOrder: "asc" | "desc",
  db: typeof import("@/server/db").db
): Promise<VelocityReportData> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - timeframeDays);

  // Get all closed risks with owner info
  const closedRisks = await db.risk.findMany({
    where: {
      organizationId,
      status: RiskStatus.CLOSED,
      updatedAt: { gte: cutoffDate },
    },
    select: {
      id: true,
      title: true,
      severity: true,
      createdAt: true,
      updatedAt: true,
      findingSource: true,
      itOwnerId: true,
      businessOwnerId: true,
      ITOwner: {
        select: { name: true },
      },
      BusinessOwner: {
        select: { name: true },
      },
    },
  });

  const calculateDaysToClose = (risk: { createdAt: Date; updatedAt: Date }) => {
    return Math.max(
      0,
      Math.floor((risk.updatedAt.getTime() - risk.createdAt.getTime()) / (1000 * 60 * 60 * 24))
    );
  };

  // Map to include calculated days
  let risksWithDays = closedRisks.map((r) => ({
    id: r.id,
    title: r.title,
    severity: r.severity,
    daysToClose: calculateDaysToClose(r),
    createdAt: r.createdAt,
    closedAt: r.updatedAt,
    itOwnerId: r.itOwnerId,
    itOwnerName: r.ITOwner?.name ?? null,
    businessOwnerName: r.BusinessOwner?.name ?? null,
    findingSource: r.findingSource,
  }));

  // Sort based on parameters (AC20)
  risksWithDays.sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case "daysToClose":
        comparison = a.daysToClose - b.daysToClose;
        break;
      case "closedAt":
        comparison = a.closedAt.getTime() - b.closedAt.getTime();
        break;
      case "severity":
        const severityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2, CRITICAL: -1 };
        comparison =
          (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3);
        break;
    }
    return sortOrder === "desc" ? -comparison : comparison;
  });

  const calculateAverage = (risks: Array<{ daysToClose: number }>) => {
    if (risks.length === 0) return 0;
    const sum = risks.reduce((acc, r) => acc + r.daysToClose, 0);
    return Math.round((sum / risks.length) * 10) / 10;
  };

  // Calculate overall average
  const overallAverage = calculateAverage(risksWithDays);

  // Calculate average by severity
  const highRisks = risksWithDays.filter((r) => r.severity === Severity.HIGH);
  const mediumRisks = risksWithDays.filter((r) => r.severity === Severity.MEDIUM);
  const lowRisks = risksWithDays.filter((r) => r.severity === Severity.LOW);

  const averageBySeverity = {
    HIGH: calculateAverage(highRisks),
    MEDIUM: calculateAverage(mediumRisks),
    LOW: calculateAverage(lowRisks),
  };

  // Calculate average by IT owner (top 5)
  const ownerMap = new Map<string, { name: string; risks: Array<{ daysToClose: number }> }>();
  for (const risk of risksWithDays) {
    if (risk.itOwnerId && risk.itOwnerName) {
      const existing = ownerMap.get(risk.itOwnerId) ?? { name: risk.itOwnerName, risks: [] };
      existing.risks.push({ daysToClose: risk.daysToClose });
      ownerMap.set(risk.itOwnerId, existing);
    }
  }

  const averageByItOwner = Array.from(ownerMap.entries())
    .map(([ownerId, { name, risks }]) => ({
      ownerId,
      ownerName: name,
      average: calculateAverage(risks),
      count: risks.length,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Calculate average by finding source
  const sourceMap = new Map<string, Array<{ daysToClose: number }>>();
  for (const risk of risksWithDays) {
    const source = risk.findingSource ?? "Unknown";
    const existing = sourceMap.get(source) ?? [];
    existing.push({ daysToClose: risk.daysToClose });
    sourceMap.set(source, existing);
  }

  const averageByFindingSource = Array.from(sourceMap.entries())
    .map(([source, risks]) => ({
      source,
      average: calculateAverage(risks),
      count: risks.length,
    }))
    .sort((a, b) => b.count - a.count);

  // Get slowest risks (bottom 10 by days-to-close)
  const slowestRisks = [...risksWithDays]
    .sort((a, b) => b.daysToClose - a.daysToClose)
    .slice(0, 10)
    .map((r) => ({
      id: r.id,
      title: r.title,
      severity: r.severity,
      daysToClose: r.daysToClose,
      createdAt: r.createdAt,
      closedAt: r.closedAt,
    }));

  return {
    overallAverage,
    averageBySeverity,
    averageByItOwner,
    averageByFindingSource,
    slowestRisks,
    closedRisks: risksWithDays,
  };
}
