"use client";

/**
 * Home Page Metrics Cards
 *
 * Three KPI tiles (consulting-grade): mono label + faint icon, big tabular
 * value, muted sub, navy "View →" footer link. The lead tile carries the
 * navy top accent rule. Each tile is a whole-card link into a pre-filtered view.
 * - Open risks count
 * - Open findings count
 * - Framework coverage average
 */

import Link from "next/link";
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
} from "lucide-react";

import { api } from "@/trpc/react";
import { StatTile } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";

function ViewLink({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary">
      {label}
      <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
    </span>
  );
}

export function HomeMetricsCards() {
  // Fetch risk stats
  const { data: complianceData, isLoading: isComplianceLoading } =
    api.compliance.getComplianceSummary.useQuery({});

  // Fetch findings stats
  const { data: findingStats, isLoading: isFindingLoading } =
    api.finding.getStats.useQuery();

  const openRisksCount = complianceData?.riskMetrics?.openRisksCount ?? 0;
  const openFindingsCount = findingStats?.openCount ?? 0;
  const avgCoverage =
    complianceData?.frameworks && complianceData.frameworks.length > 0
      ? Math.round(
          complianceData.frameworks.reduce(
            (sum, f) => sum + f.coveragePercentage,
            0
          ) / complianceData.frameworks.length
        )
      : 0;

  const tileClass =
    "h-full transition-colors hover:bg-secondary/60 hover:border-primary/30";

  return (
    <div className="grid grid-cols-1 gap-[18px] md:grid-cols-3">
      {/* Open Risks — whole card clickable, drops into /risks pre-filtered. */}
      <Link href="/risks?status=OPEN,ASSIGNED" className="block">
        <StatTile
          className={tileClass}
          accent
          label="Open Risks"
          icon={<ShieldAlert />}
          value={
            isComplianceLoading ? <Skeleton className="h-9 w-16" /> : openRisksCount
          }
          sub="Requiring attention"
          footer={<ViewLink label="View risks" />}
        />
      </Link>

      {/* Open Findings */}
      <Link href="/findings?status=NEW,NEEDS_INFO,TRIAGED" className="block">
        <StatTile
          className={tileClass}
          label="Open Findings"
          icon={<AlertTriangle />}
          value={
            isFindingLoading ? <Skeleton className="h-9 w-16" /> : openFindingsCount
          }
          sub="Awaiting triage"
          footer={<ViewLink label="View findings" />}
        />
      </Link>

      {/* Compliance Coverage */}
      <Link href="/compliance/dashboard" className="block">
        <StatTile
          className={tileClass}
          label="Avg. Compliance"
          icon={<CheckCircle />}
          value={
            isComplianceLoading ? <Skeleton className="h-9 w-16" /> : `${avgCoverage}%`
          }
          sub="Framework coverage"
          footer={<ViewLink label="View dashboard" />}
        />
      </Link>
    </div>
  );
}
