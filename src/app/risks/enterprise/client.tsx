"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Loader2, Plus, ShieldAlert, AlertCircle, ChevronRight } from "lucide-react";
import { UserRole } from "@prisma/client";
import toast from "react-hot-toast";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppLayout, PageHeader } from "@/components/layout";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MatrixSelector } from "@/components/assessment/MatrixSelector";
import { RiskScoreHeatmap, type HeatmapItem } from "@/components/risk/RiskScoreHeatmap";

const WRITE_ROLES: UserRole[] = [UserRole.ORG_ADMIN, UserRole.GRC_ANALYST, UserRole.SECURITY_ENGINEER];

function Sparkline({ points }: { points: Array<{ score: number | null; capturedAt: Date }> }) {
  const valid = points.filter((p) => p.score !== null) as Array<{ score: number; capturedAt: Date }>;
  if (valid.length < 2) return <span className="text-xs text-muted-foreground">—</span>;
  const max = Math.max(...valid.map((p) => p.score));
  const min = Math.min(...valid.map((p) => p.score));
  const range = max - min || 1;
  const width = 80;
  const height = 24;
  const stepX = width / (valid.length - 1);
  const path = valid
    .map((p, i) => {
      const x = i * stepX;
      const y = height - ((p.score - min) / range) * height;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={width} height={height} className="text-primary">
      <path d={path} stroke="currentColor" fill="none" strokeWidth={1.5} />
    </svg>
  );
}

export function EnterpriseRisksClient() {
  const { data: session } = useSession();
  const userRole = session?.user?.role;
  const canWrite = userRole && WRITE_ROLES.includes(userRole);

  const { data: items, isLoading, refetch } = api.enterpriseRisk.list.useQuery();
  const heatmap = api.enterpriseRisk.heatmap.useQuery();
  const [createOpen, setCreateOpen] = useState(false);

  const heatmapRows: HeatmapItem[] = (heatmap.data?.rows ?? []).map((r) => ({
    id: r.id,
    label: null,
    title: r.name,
    likelihood: r.likelihood,
    impact: r.impact,
    score: r.score,
    scoreLabel: r.scoreLabel,
    color: r.color,
    href: `/risks/enterprise/${r.id}`,
  }));

  return (
    <AppLayout>
      <div className="container mx-auto py-6 space-y-6">
        <PageHeader
          eyebrow="RISK"
          title="Enterprise Risks"
          icon={<ShieldAlert />}
          description="Top-level rollup risks. Each individual risk can be aligned to one of these."
          actions={
            canWrite && (
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    New Enterprise Risk
                  </Button>
                </DialogTrigger>
                <CreateEnterpriseRiskDialog
                  onCreated={() => {
                    setCreateOpen(false);
                    void refetch();
                  }}
                />
              </Dialog>
            )
          }
        />

        {heatmap.data?.matrix && (
          <RiskScoreHeatmap
            matrix={{
              scales: heatmap.data.matrix.scales,
              thresholds: heatmap.data.matrix.thresholds,
              outputScaleMax: heatmap.data.matrix.outputScaleMax,
            }}
            rows={heatmapRows}
            title="Enterprise Risk Heatmap"
            subtitle={`All enterprise risks plotted on ${heatmap.data.matrix.templateName}`}
            emptyLabel="No scored enterprise risks yet."
          />
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : !items || items.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No enterprise risks defined yet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {items.map((er) => {
              const overdue = er.nextReviewDue && new Date(er.nextReviewDue) < new Date();
              return (
                <Link key={er.id} href={`/risks/enterprise/${er.id}`}>
                  <Card className="hover:bg-secondary transition-colors">
                    <CardContent className="py-4">
                      <div className="flex items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-foreground truncate">{er.name}</h3>
                            {er.effectiveScoreLabel && (
                              <Badge variant="neutral">{er.effectiveScoreLabel}</Badge>
                            )}
                            {overdue && (
                              <Badge variant="critical" className="gap-1">
                                <AlertCircle className="h-3 w-3" />
                                Review overdue
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {er.description ?? "No description"}
                          </p>
                          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span>Owner: {er.Owner?.name ?? "—"}</span>
                            <span>Children: {er._count.ChildRisks}</span>
                            {Object.entries(er.childCountsByLabel).map(([label, count]) => (
                              <span key={label} className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em]">
                                {label}: {count}
                              </span>
                            ))}
                            {er.nextReviewDue && (
                              <span className="font-mono">
                                Next review: {new Date(er.nextReviewDue).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Sparkline points={er.sparkline} />
                          <span className="eyebrow">trend</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/70 self-center" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function CreateEnterpriseRiskDialog({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [matrixVersionId, setMatrixVersionId] = useState<string | null>(null);
  const [reviewIntervalDays, setReviewIntervalDays] = useState<string>("");

  // Pre-select the org's default published matrix.
  const defaultMatrix = api.riskMatrix.getOrgPublishedMatrix.useQuery();
  useEffect(() => {
    if (matrixVersionId === null && defaultMatrix.data) {
      setMatrixVersionId(defaultMatrix.data.versionId);
    }
  }, [matrixVersionId, defaultMatrix.data]);

  const create = api.enterpriseRisk.create.useMutation({
    onSuccess: () => {
      toast.success("Enterprise risk created");
      onCreated();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>New Enterprise Risk</DialogTitle>
        <DialogDescription>
          Top-level risk that individual risks can be aligned to.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="matrix">Risk Matrix</Label>
          <MatrixSelector
            value={matrixVersionId}
            onChange={setMatrixVersionId}
            placeholder="Select a risk matrix..."
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="interval">Review interval (days)</Label>
          <Input
            id="interval"
            type="number"
            placeholder="e.g. 90"
            value={reviewIntervalDays}
            onChange={(e) => setReviewIntervalDays(e.target.value)}
          />
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={!name.trim() || create.isPending}
          onClick={() =>
            create.mutate({
              name: name.trim(),
              description: description.trim() || undefined,
              matrixVersionId: matrixVersionId,
              reviewIntervalDays: reviewIntervalDays ? Number(reviewIntervalDays) : null,
            })
          }
        >
          {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Create
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
