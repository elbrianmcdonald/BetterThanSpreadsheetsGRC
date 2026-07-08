"use client";

/**
 * Crosswalk Coverage Dashboard Client (Epic 26, Story 26.3)
 *
 * Per-family stacked bars (confirmed / suggested / unmapped) with drill-down to
 * a filtered control list. Confirmed vs suggested are rendered distinctly (NFR5).
 */

import { useState } from "react";
import Link from "next/link";
import { api } from "@/trpc/react";
import { AppLayout, PageHeader } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, BarChart3, ArrowLeft, ExternalLink } from "lucide-react";

type DrillStatus = "CONFIRMED" | "SUGGESTED" | "UNMAPPED";

const SEG = {
  CONFIRMED: { label: "Confirmed", bar: "bg-green-500", text: "text-green-700 dark:text-green-400" },
  SUGGESTED: { label: "Suggested", bar: "bg-amber-400", text: "text-amber-700 dark:text-amber-400" },
  UNMAPPED: { label: "Unmapped", bar: "bg-slate-300 dark:bg-slate-600", text: "text-slate-600 dark:text-slate-400" },
} as const;

function StackedBar({
  confirmed,
  suggested,
  unmapped,
  total,
  onSegment,
}: {
  confirmed: number;
  suggested: number;
  unmapped: number;
  total: number;
  onSegment?: (s: DrillStatus) => void;
}) {
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);
  const seg = (status: DrillStatus, n: number) =>
    n > 0 ? (
      <button
        type="button"
        aria-label={`${SEG[status].label} ${n}`}
        title={`${SEG[status].label}: ${n}`}
        onClick={onSegment ? () => onSegment(status) : undefined}
        className={`${SEG[status].bar} h-full ${onSegment ? "cursor-pointer hover:opacity-80" : ""}`}
        style={{ width: `${pct(n)}%` }}
      />
    ) : null;
  return (
    <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
      {seg("CONFIRMED", confirmed)}
      {seg("SUGGESTED", suggested)}
      {seg("UNMAPPED", unmapped)}
    </div>
  );
}

export function CoverageClient({ targetFrameworkId }: { targetFrameworkId: string }) {
  const coverage = api.crosswalk.getFrameworkCoverage.useQuery({ targetFrameworkId });
  const [drill, setDrill] = useState<{ familyId: string; familyLabel: string; status: DrillStatus } | null>(null);

  const drillQuery = api.crosswalk.listFamilyControlsByStatus.useQuery(
    { targetFrameworkId, familyId: drill?.familyId ?? "", status: drill?.status ?? "UNMAPPED" },
    { enabled: !!drill },
  );

  if (coverage.isLoading) {
    return (
      <AppLayout breadcrumbs={[{ label: "Governance" }, { label: "Crosswalks" }]}>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/70" />
        </div>
      </AppLayout>
    );
  }

  if (coverage.isError || !coverage.data) {
    return (
      <AppLayout breadcrumbs={[{ label: "Governance" }, { label: "Crosswalks" }]}>
        <div className="px-4 sm:px-6 lg:px-8 py-8">
          <Card>
            <CardHeader>
              <CardTitle>Coverage unavailable</CardTitle>
              <CardDescription>
                {coverage.error?.message ?? "Framework not found in your organization."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href="/crosswalks">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Crosswalks
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const { framework, overall, families } = coverage.data;

  return (
    <AppLayout
      breadcrumbs={[
        { label: "Governance" },
        { label: "Crosswalks", href: "/crosswalks" },
        { label: `Coverage · ${framework.code}` },
      ]}
    >
      <div className="px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <PageHeader
          eyebrow="GOVERNANCE"
          title="Crosswalk Coverage"
          icon={<BarChart3 />}
          description={`Org-control coverage of ${framework.name} — ${overall.confirmedPct}% confirmed`}
        />

        {/* Overall */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Overall</CardTitle>
            <CardDescription>
              {overall.total} controls · {overall.confirmed} confirmed · {overall.suggested} suggested ·{" "}
              {overall.unmapped} unmapped
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <StackedBar
              confirmed={overall.confirmed}
              suggested={overall.suggested}
              unmapped={overall.unmapped}
              total={overall.total}
            />
            <div className="flex flex-wrap gap-4 text-xs">
              {(["CONFIRMED", "SUGGESTED", "UNMAPPED"] as DrillStatus[]).map((s) => (
                <span key={s} className="flex items-center gap-1.5">
                  <span className={`inline-block h-3 w-3 rounded-sm ${SEG[s].bar}`} />
                  <span className={SEG[s].text}>{SEG[s].label}</span>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Per family */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Coverage by family</CardTitle>
            <CardDescription>Click a bar segment to drill into those controls.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {families.map((f) => (
              <div key={f.familyId} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate">
                    <Badge variant="code" className="mr-2">{f.controlId}</Badge>
                    <span className="text-muted-foreground">{f.title}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                    <span className={SEG.CONFIRMED.text}>{f.confirmed}</span> /{" "}
                    <span className={SEG.SUGGESTED.text}>{f.suggested}</span> /{" "}
                    <span className={SEG.UNMAPPED.text}>{f.unmapped}</span> of {f.total}
                  </span>
                </div>
                <StackedBar
                  confirmed={f.confirmed}
                  suggested={f.suggested}
                  unmapped={f.unmapped}
                  total={f.total}
                  onSegment={(status) =>
                    setDrill({ familyId: f.familyId, familyLabel: `${f.controlId} ${f.title}`, status })
                  }
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Drill-down */}
        {drill && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <span className={`inline-block h-3 w-3 rounded-sm ${SEG[drill.status].bar}`} />
                    {SEG[drill.status].label} controls — {drill.familyLabel}
                  </CardTitle>
                  <CardDescription>
                    <Link href={`/crosswalks/org-controls/${targetFrameworkId}`} className="underline">
                      Open the org-control workbench
                    </Link>{" "}
                    to map or review these.
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setDrill(null)}>
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {drillQuery.isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/70" />
                </div>
              ) : !drillQuery.data || drillQuery.data.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No controls.</p>
              ) : (
                <ul className="divide-y divide-border rounded-md border border-border">
                  {drillQuery.data.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 px-3 py-2">
                      <Badge variant="code">{c.controlId}</Badge>
                      <span className="min-w-0 flex-1 truncate text-sm">{c.title}</span>
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/crosswalks/org-controls/${targetFrameworkId}`}>
                          Map <ExternalLink className="ml-1 h-3 w-3" />
                        </Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
