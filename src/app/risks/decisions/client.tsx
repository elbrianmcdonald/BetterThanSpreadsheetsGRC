"use client";

/**
 * Decisions Client Component (Business Stakeholder View)
 *
 * Displays a list of risks assigned to the current user as business owner,
 * highlighting risks requiring business decision.
 *
 * Story 4.9: Role-Based Risk Views - Business Stakeholder Risk List (AC7-AC12)
 * AC9: Risk list highlights risks requiring business decision (status = ASSIGNED with remediation options)
 * AC10: Risk list shows business impact statement preview
 * AC11: Risk list filterable by decision status (Pending Decision, Approved, Rejected)
 * AC35: BUSINESS_STAKEHOLDER with no assigned risks sees "No decisions pending" message
 *
 * @see Story 4.9: Role-Based Risk Views
 */

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Loader2,
  ShieldAlert,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  Gauge,
  ArrowRight,
  AlertCircle,
} from "lucide-react";

import { api } from "@/trpc/react";
import { PageHeader, StatTile } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SignOutButton } from "@/components/auth/SignOutButton";

/** Severity badge variants */
const severityConfig = {
  HIGH: { variant: "high" as const, label: "High" },
  MEDIUM: { variant: "warning" as const, label: "Medium" },
  LOW: { variant: "success" as const, label: "Low" },
};

/** Status badge variants */
const statusConfig = {
  OPEN: { variant: "info" as const, label: "Open", icon: AlertTriangle },
  ASSIGNED: { variant: "info" as const, label: "Pending Decision", icon: Clock },
  REMEDIATED: { variant: "success" as const, label: "Approved", icon: CheckCircle },
  CLOSED: { variant: "neutral" as const, label: "Closed", icon: XCircle },
};

/** Impact score color based on value */
function getImpactScoreColor(score: number | null): string {
  if (score === null) return "text-muted-foreground/70";
  if (score >= 75) return "text-destructive";
  if (score >= 50) return "text-severity-high";
  if (score >= 25) return "text-warning";
  return "text-success";
}

/** Extract first paragraph of business impact for preview */
function getBusinessImpactPreview(statement: string | null | undefined): string {
  if (!statement) return "No business impact statement available.";

  // Extract first section (Regulatory Impact) or first paragraph
  const regulatoryMatch = statement.match(/## Regulatory Impact\n\n([\s\S]*?)(?=## |$)/);
  if (regulatoryMatch?.[1]) {
    const firstParagraph = regulatoryMatch[1].trim().split("\n\n")[0] ?? "";
    // Remove markdown bold markers
    const cleaned = firstParagraph.replace(/\*\*/g, "");
    return cleaned.length > 150 ? cleaned.substring(0, 150) + "..." : cleaned;
  }

  // Fallback to first 150 chars
  const cleaned = statement.replace(/\*\*/g, "").replace(/## .+\n\n/g, "");
  return cleaned.length > 150 ? cleaned.substring(0, 150) + "..." : cleaned;
}

type DecisionFilter = "all" | "pending" | "approved" | "rejected";

export function DecisionsClient() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const [decisionFilter, setDecisionFilter] = useState<DecisionFilter>("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Redirect to login if not authenticated
  if (sessionStatus === "unauthenticated") {
    router.push("/login");
    return null;
  }

  // Map decision filter to status
  const statusFromFilter =
    decisionFilter === "pending" ? "ASSIGNED" :
    decisionFilter === "approved" ? "REMEDIATED" :
    decisionFilter === "rejected" ? "CLOSED" :
    undefined;

  // Fetch risks (automatically filtered by role in the backend)
  // Story 5.5: Updated to use array-based status filter
  const { data, isLoading, error } = api.risk.list.useQuery({
    page,
    pageSize,
    status: statusFromFilter ? [statusFromFilter as "DRAFT" | "PENDING_REVIEW" | "OPEN" | "ASSIGNED" | "REMEDIATED" | "CLOSED"] : undefined,
    sortBy: "impactScore",
    sortOrder: "desc",
  });

  // Calculate stats
  const pendingCount = data?.risks.filter(r => r.status === "ASSIGNED").length ?? 0;
  const approvedCount = data?.risks.filter(r => r.status === "REMEDIATED").length ?? 0;
  const highestImpact = data?.risks.reduce((max, r) =>
    (r.impactScore ?? 0) > max ? (r.impactScore ?? 0) : max, 0) ?? 0;

  // Loading state
  if (sessionStatus === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary">
      {/* Navigation */}
      <nav className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between">
            <div className="flex">
              <div className="flex flex-shrink-0 items-center">
                <Link href="/" className="text-xl font-bold text-foreground">
                  BetterThanSpreadsheetsGRC
                </Link>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <Link href="/risks/decisions" className="inline-flex items-center border-b-2 border-primary px-1 pt-1 text-sm font-medium text-foreground">
                  Decisions Pending
                </Link>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground">
                {session?.user?.name} ({session?.user?.role})
              </span>
              <SignOutButton />
            </div>
          </div>
        </div>
      </nav>

      {/* Breadcrumbs */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
        <nav className="flex" aria-label="Breadcrumb">
          <ol className="flex items-center space-x-2">
            <li>
              <Link href="/" className="text-muted-foreground/70 hover:text-muted-foreground">
                Home
              </Link>
            </li>
            <li>
              <div className="flex items-center">
                <svg className="h-5 w-5 flex-shrink-0 text-muted-foreground/70" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M5.555 17.776l8-16 .894.448-8 16-.894-.448z" />
                </svg>
                <span className="ml-2 text-sm font-medium text-muted-foreground">
                  Decisions Pending
                </span>
              </div>
            </li>
          </ol>
        </nav>
      </div>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <PageHeader
          eyebrow="DECISIONS"
          title="Risks Requiring Your Decision"
          icon={<FileText />}
          description="Review security risks and approve or reject remediation plans. Your decisions help prioritize security investments."
        />

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <StatTile
            label="TOTAL RISKS"
            value={data?.total ?? 0}
            icon={<ShieldAlert />}
            accent
          />

          <StatTile
            label="PENDING DECISION"
            value={pendingCount}
            tone="primary"
            icon={<Clock />}
            filled={pendingCount > 0}
          />

          <StatTile
            label="APPROVED"
            value={approvedCount}
            tone="success"
            icon={<CheckCircle />}
          />

          <StatTile
            label="HIGHEST IMPACT"
            value={<span className={getImpactScoreColor(highestImpact)}>{highestImpact}</span>}
            icon={<Gauge />}
          />
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Filter by Decision Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value={decisionFilter}
              onValueChange={(value) => {
                setDecisionFilter(value as DecisionFilter);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Filter by decision status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Risks</SelectItem>
                <SelectItem value="pending">Pending Decision</SelectItem>
                <SelectItem value="approved">Approved (Remediated)</SelectItem>
                <SelectItem value="rejected">Rejected (Closed)</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Risk Cards */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/70" />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-destructive">{error.message}</p>
          </div>
        ) : data?.risks.length === 0 ? (
          /* AC35: Empty state for Business Stakeholder with no assigned risks */
          <Card className="border-dashed">
            <CardContent className="py-12">
              <div className="text-center">
                <FileText className="h-12 w-12 text-muted-foreground/70 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No decisions pending</h3>
                <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                  {decisionFilter !== "all"
                    ? "No risks match the selected filter. Try adjusting your filter."
                    : "You currently have no risks requiring your business decision. When security findings need your approval, they will appear here with full business impact analysis."}
                </p>
                {decisionFilter !== "all" && (
                  <Button variant="outline" onClick={() => setDecisionFilter("all")}>
                    Clear Filter
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4">
              {data?.risks.map((risk) => {
                const severityStyle = severityConfig[risk.severity as keyof typeof severityConfig];
                const statusStyle = statusConfig[risk.status as keyof typeof statusConfig];
                const StatusIcon = statusStyle?.icon;
                const needsDecision = risk.status === "ASSIGNED";

                return (
                  <Card
                    key={risk.id}
                    className={`cursor-pointer transition-colors hover:bg-secondary ${
                      needsDecision ? "border-l-2 border-l-primary" : ""
                    }`}
                    onClick={() => router.push(`/risks/${risk.id}`)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {/* AC9: Highlight risks requiring business decision */}
                            {needsDecision && (
                              <Badge variant="info">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Decision Required
                              </Badge>
                            )}
                            <Badge variant={severityStyle?.variant}>
                              {severityStyle?.label}
                            </Badge>
                            <Badge variant={statusStyle?.variant}>
                              {StatusIcon && <StatusIcon className="h-3 w-3 mr-1" />}
                              {statusStyle?.label}
                            </Badge>
                          </div>
                          <CardTitle className="text-lg">{risk.title}</CardTitle>
                          <CardDescription className="mt-1">
                            {risk.description.substring(0, 200)}
                            {risk.description.length > 200 ? "..." : ""}
                          </CardDescription>
                        </div>
                        <div className="text-right ml-4">
                          <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Impact Score</div>
                          <div className={`tnum text-2xl font-bold ${getImpactScoreColor(risk.impactScore)}`}>
                            {risk.impactScore ?? "N/A"}
                          </div>
                        </div>
                      </div>
                    </CardHeader>

                    {/* AC10: Business Impact Preview */}
                    <CardContent className="pt-2">
                      <div className="bg-muted/50 rounded-md p-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-1">
                          <FileText className="h-4 w-4" />
                          Business Impact
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {getBusinessImpactPreview(risk.businessImpactStatement)}
                        </p>
                      </div>
                    </CardContent>

                    <CardFooter className="pt-2">
                      <Button variant="ghost" size="sm" className="ml-auto">
                        View Details
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>

            {/* Pagination */}
            {data && data.totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-muted-foreground">
                  Showing {(page - 1) * pageSize + 1} to{" "}
                  {Math.min(page * pageSize, data.total)} of {data.total} risks
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === data.totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
