"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Loader2, ChevronLeft, Save, ClipboardCheck, Pencil, X, Tags } from "lucide-react";
import { UserRole } from "@prisma/client";
import toast from "react-hot-toast";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppLayout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MatrixSelector } from "@/components/assessment/MatrixSelector";
import { RiskScoreHeatmap, type HeatmapItem } from "@/components/risk/RiskScoreHeatmap";
import { TagItemsDialog } from "@/components/enterprise-risk/TagItemsDialog";
import { calculateInherentScore, isScoreResult } from "@/lib/matrix/scoring";
import { score2D, thresholdForScore } from "@/lib/matrix/heatmap";

const WRITE_ROLES: UserRole[] = [UserRole.ADMINISTRATOR, UserRole.ANALYST, UserRole.ANALYST];

function TrendChart({ snapshots }: { snapshots: Array<{ score: unknown; capturedAt: Date }> }) {
  const valid = snapshots
    .map((s) => ({ score: s.score === null || s.score === undefined ? null : Number(s.score), capturedAt: new Date(s.capturedAt) }))
    .filter((s) => s.score !== null) as Array<{ score: number; capturedAt: Date }>;
  if (valid.length === 0) {
    return <div className="text-sm text-muted-foreground py-8 text-center">No score history yet.</div>;
  }
  if (valid.length === 1) {
    const only = valid[0]!;
    return <div className="text-sm py-4">Single snapshot: {only.score.toFixed(2)} on {only.capturedAt.toLocaleDateString()}</div>;
  }
  const max = Math.max(...valid.map((p) => p.score));
  const min = Math.min(...valid.map((p) => p.score));
  const range = max - min || 1;
  const width = 600;
  const height = 160;
  const stepX = width / (valid.length - 1);
  const path = valid
    .map((p, i) => {
      const x = i * stepX;
      const y = height - ((p.score - min) / range) * height;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height + 20}`} className="text-blue-500">
      <path d={path} stroke="currentColor" fill="none" strokeWidth={2} />
      {valid.map((p, i) => {
        const x = i * stepX;
        const y = height - ((p.score - min) / range) * height;
        return <circle key={i} cx={x} cy={y} r={3} fill="currentColor" />;
      })}
      <text x="0" y={height + 15} className="text-xs" fill="#888">
        {valid[0]!.capturedAt.toLocaleDateString()}
      </text>
      <text x={width} y={height + 15} textAnchor="end" className="text-xs" fill="#888">
        {valid[valid.length - 1]!.capturedAt.toLocaleDateString()}
      </text>
    </svg>
  );
}

export function EnterpriseRiskDetailClient({ id }: { id: string }) {
  const { data: session } = useSession();
  const userRole = session?.user?.role;
  const canWrite = userRole && WRITE_ROLES.includes(userRole);

  const { data, isLoading, refetch } = api.enterpriseRisk.byId.useQuery({ id });
  const personList = api.person.getAll.useQuery(undefined, { enabled: !!canWrite });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [matrixVersionId, setMatrixVersionId] = useState<string | null>(null);
  const [useManualScore, setUseManualScore] = useState(false);
  const [manualLikelihood, setManualLikelihood] = useState<number | null>(null);
  const [manualImpact, setManualImpact] = useState<number | null>(null);
  const [reviewIntervalDays, setReviewIntervalDays] = useState<string>("");
  const [editing, setEditing] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);

  // Org's default published matrix — used to pre-select when a risk has none yet.
  const defaultMatrix = api.riskMatrix.getOrgPublishedMatrix.useQuery();

  // Resolve scales/thresholds for the currently-selected matrix version so the
  // L/I selectors and the live score preview reflect the chosen matrix.
  const selectedVersion = api.riskMatrix.getVersionForAssessment.useQuery(
    { id: matrixVersionId ?? "" },
    { enabled: !!matrixVersionId },
  );
  const matrix = selectedVersion.data
    ? {
        versionId: selectedVersion.data.id,
        templateName: selectedVersion.data.template.name,
        scales: selectedVersion.data.scales,
        thresholds: selectedVersion.data.thresholds,
        outputScaleMax: selectedVersion.data.template.outputScaleMax,
      }
    : null;

  useEffect(() => {
    if (!data) return;
    const er = data.enterpriseRisk;
    setName(er.name);
    setDescription(er.description ?? "");
    setOwnerId(er.ownerId ?? null);
    setMatrixVersionId(er.matrixVersionId ?? null);
    setUseManualScore(er.useManualScore);
    setManualLikelihood(er.manualLikelihood ? Number(er.manualLikelihood) : null);
    setManualImpact(er.manualImpact ? Number(er.manualImpact) : null);
    setReviewIntervalDays(er.reviewIntervalDays ? String(er.reviewIntervalDays) : "");
  }, [data]);

  // When the risk has no matrix selected yet, default to the org's published matrix.
  useEffect(() => {
    if (matrixVersionId === null && data && !data.enterpriseRisk.matrixVersionId && defaultMatrix.data) {
      setMatrixVersionId(defaultMatrix.data.versionId);
    }
  }, [matrixVersionId, data, defaultMatrix.data]);

  // Live-compute manual score using the org's published matrix
  const manualScorePreview = useMemo(() => {
    if (!matrix || manualLikelihood === null || manualImpact === null) return null;
    const result = calculateInherentScore(
      matrix.scales,
      matrix.thresholds,
      matrix.outputScaleMax,
      manualLikelihood,
      manualImpact,
    );
    if (!isScoreResult(result)) return null;
    return result;
  }, [matrix, manualLikelihood, manualImpact]);

  // Tagged child risks plotted on the view heatmap (risks only, per spec).
  // Story 22.4: position by the DERIVED score's inputs — manual L/I when the
  // override is active, else the legacy residual ?? inherent chain (children
  // scored purely by the findings rollup have no single L/I pair and fall to
  // the unscored list, still labeled with their effective label).
  const viewMatrix = data?.viewMatrix ?? null;
  const riskHeatmapRows: HeatmapItem[] = useMemo(() => {
    if (!data) return [];
    return data.childRisks.map((r) => {
      const lRaw = r.useManualScore
        ? (r.manualLikelihood ?? r.residualLikelihood ?? r.inherentLikelihood)
        : (r.residualLikelihood ?? r.inherentLikelihood);
      const iRaw = r.useManualScore
        ? (r.manualImpact ?? r.residualImpact ?? r.inherentImpact)
        : (r.residualImpact ?? r.inherentImpact);
      const likelihood = lRaw !== null && lRaw !== undefined ? Number(lRaw) : null;
      const impact = iRaw !== null && iRaw !== undefined ? Number(iRaw) : null;
      let score: number | null = null;
      let scoreLabel: string | null =
        r.effectiveScoreLabel ?? r.residualScoreLabel ?? r.inherentScoreLabel ?? null;
      let color = "#CCCCCC";
      if (viewMatrix && likelihood !== null && impact !== null) {
        score = score2D(likelihood, impact, viewMatrix.scales, viewMatrix.outputScaleMax);
        const band = thresholdForScore(score, viewMatrix.thresholds);
        if (band) {
          scoreLabel = band.label;
          color = band.color;
        }
      }
      return {
        id: r.id,
        label: r.identifier,
        title: r.title,
        likelihood,
        impact,
        score,
        scoreLabel,
        color,
        href: `/risks/${r.id}`,
      };
    });
  }, [data, viewMatrix]);

  const resetForm = () => {
    if (!data) return;
    const er = data.enterpriseRisk;
    setName(er.name);
    setDescription(er.description ?? "");
    setOwnerId(er.ownerId ?? null);
    setMatrixVersionId(er.matrixVersionId ?? null);
    setUseManualScore(er.useManualScore);
    setManualLikelihood(er.manualLikelihood ? Number(er.manualLikelihood) : null);
    setManualImpact(er.manualImpact ? Number(er.manualImpact) : null);
    setReviewIntervalDays(er.reviewIntervalDays ? String(er.reviewIntervalDays) : "");
  };

  const update = api.enterpriseRisk.update.useMutation({
    onSuccess: () => {
      toast.success("Saved");
      setEditing(false);
      void refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AppLayout>
    );
  }
  if (!data) return null;
  const { enterpriseRisk: er, snapshots, reviews, childRisks, childFindings } = data;
  const overdue = er.nextReviewDue && new Date(er.nextReviewDue) < new Date();

  return (
    <AppLayout>
      <div className="container mx-auto py-6 space-y-6 max-w-5xl">
        <div className="flex items-center gap-2">
          <Link href="/risks/enterprise" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ChevronLeft className="h-4 w-4" /> Back to Enterprise Risks
          </Link>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{er.name}</h1>
            <div className="flex items-center gap-2 mt-2">
              {er.effectiveScoreLabel && <Badge variant="secondary">{er.effectiveScoreLabel}</Badge>}
              {er.effectiveScoreSource && (
                <span className="text-xs text-muted-foreground">
                  Source: {er.effectiveScoreSource === "MANUAL" ? "Manual override" : "Calculated from children"}
                </span>
              )}
              {overdue && <Badge variant="destructive">Review overdue</Badge>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canWrite && !editing && (
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4 mr-2" /> Edit
              </Button>
            )}
            {canWrite && editing && (
              <Button variant="outline" onClick={() => { resetForm(); setEditing(false); }}>
                <X className="h-4 w-4 mr-2" /> Cancel
              </Button>
            )}
            {canWrite && <RecordReviewButton id={id} onRecorded={() => void refetch()} />}
          </div>
        </div>

        {editing ? (
        <>
        <Card>
          <CardHeader>
            <CardTitle>Editable Fields</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <fieldset disabled={!canWrite} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="owner">Risk Owner</Label>
                  <Select value={ownerId ?? "__none"} onValueChange={(v) => setOwnerId(v === "__none" ? null : v)}>
                    <SelectTrigger id="owner">
                      <SelectValue placeholder="Select owner" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">— None —</SelectItem>
                      {personList.data?.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}{p.jobTitle ? ` (${p.jobTitle})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="description">Risk Description</Label>
                <Textarea id="description" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <Card className="bg-muted/30">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Risk Score</p>
                      <p className="text-xs text-muted-foreground">
                        {matrix
                          ? `Using ${matrix.templateName}`
                          : "No published risk matrix — set one up under Admin → Risk Matrices."}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={useManualScore} onCheckedChange={setUseManualScore} />
                      <span className="text-sm text-muted-foreground">
                        {useManualScore ? "Manual" : "Calculated"}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="matrix">Risk Matrix</Label>
                    <MatrixSelector
                      value={matrixVersionId}
                      onChange={(v) => {
                        setMatrixVersionId(v);
                        // Reset L/I since a different matrix may have different scales.
                        setManualLikelihood(null);
                        setManualImpact(null);
                      }}
                      placeholder="Select a risk matrix..."
                    />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="lik">Likelihood</Label>
                      <Select
                        disabled={!useManualScore || !matrix}
                        value={manualLikelihood !== null ? String(manualLikelihood) : ""}
                        onValueChange={(v) => setManualLikelihood(v ? Number(v) : null)}
                      >
                        <SelectTrigger id="lik">
                          <SelectValue placeholder="Select likelihood" />
                        </SelectTrigger>
                        <SelectContent>
                          {matrix?.scales.likelihood.map((level) => (
                            <SelectItem key={level.value} value={String(level.value)}>
                              <span className="font-mono text-xs mr-2">{level.value}</span>
                              {level.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="imp">Impact</Label>
                      <Select
                        disabled={!useManualScore || !matrix}
                        value={manualImpact !== null ? String(manualImpact) : ""}
                        onValueChange={(v) => setManualImpact(v ? Number(v) : null)}
                      >
                        <SelectTrigger id="imp">
                          <SelectValue placeholder="Select impact" />
                        </SelectTrigger>
                        <SelectContent>
                          {matrix?.scales.impact.map((level) => (
                            <SelectItem key={level.value} value={String(level.value)}>
                              <span className="font-mono text-xs mr-2">{level.value}</span>
                              {level.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="pt-2 border-t flex items-center justify-between">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Manual Score: </span>
                      {useManualScore && manualScorePreview ? (
                        <>
                          <span className="font-mono">
                            {manualLikelihood} × {manualImpact} ={" "}
                          </span>
                          <span className="font-mono font-bold">
                            {manualScorePreview.normalizedScore.toFixed(2)}
                          </span>
                          <Badge
                            variant="secondary"
                            className="ml-2"
                            style={{ backgroundColor: manualScorePreview.color, color: "#fff" }}
                          >
                            {manualScorePreview.label}
                          </Badge>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                    {er.effectiveScore !== null && er.effectiveScore !== undefined && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Current Effective: </span>
                        <span className="font-mono font-bold">
                          {Number(er.effectiveScore).toFixed(2)}
                        </span>
                        {er.effectiveScoreLabel && (
                          <Badge variant="outline" className="ml-2">
                            {er.effectiveScoreLabel}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              <div className="space-y-1">
                <Label htmlFor="interval">Review interval (days)</Label>
                <Input id="interval" type="number" value={reviewIntervalDays} onChange={(e) => setReviewIntervalDays(e.target.value)} placeholder="e.g. 90" />
              </div>
              {canWrite && (
                <div className="pt-2">
                  <Button
                    disabled={update.isPending}
                    onClick={() =>
                      update.mutate({
                        id,
                        name: name.trim() || undefined,
                        description: description.trim() || null,
                        ownerId: ownerId,
                        matrixVersionId: matrixVersionId,
                        useManualScore,
                        manualLikelihood,
                        manualImpact,
                        reviewIntervalDays: reviewIntervalDays ? Number(reviewIntervalDays) : null,
                      })
                    }
                  >
                    {update.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <Save className="h-4 w-4 mr-2" /> Save
                  </Button>
                </div>
              )}
            </fieldset>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tagged Risks &amp; Findings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {childRisks.length} risk{childRisks.length === 1 ? "" : "s"} · {childFindings.length} finding
              {childFindings.length === 1 ? "" : "s"} tagged to this enterprise risk.
            </p>
            {canWrite && (
              <Button variant="outline" onClick={() => setTagOpen(true)}>
                <Tags className="h-4 w-4 mr-2" /> Tag risks &amp; findings
              </Button>
            )}
          </CardContent>
        </Card>
        </>
        ) : (
        <>
        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              <p className="eyebrow mb-0.5">Owner</p>
              <p>{er.Owner?.name ?? "—"}{er.Owner?.jobTitle ? ` (${er.Owner.jobTitle})` : ""}</p>
            </div>
            <div>
              <p className="eyebrow mb-0.5">Effective Score</p>
              <p>
                {er.effectiveScore !== null && er.effectiveScore !== undefined
                  ? Number(er.effectiveScore).toFixed(2)
                  : "—"}
                {er.effectiveScoreLabel && (
                  <Badge variant="outline" className="ml-2">{er.effectiveScoreLabel}</Badge>
                )}
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="eyebrow mb-0.5">Description</p>
              <p className="whitespace-pre-wrap">{er.description || "—"}</p>
            </div>
            <div>
              <p className="eyebrow mb-0.5">Risk Matrix</p>
              <p>{viewMatrix?.templateName ?? "—"}</p>
            </div>
            <div>
              <p className="eyebrow mb-0.5">Review cadence</p>
              <p>
                {er.reviewIntervalDays ? `Every ${er.reviewIntervalDays} days` : "No schedule"}
                {er.nextReviewDue && (
                  <span className="text-muted-foreground"> · next {new Date(er.nextReviewDue).toLocaleDateString()}</span>
                )}
              </p>
            </div>
          </CardContent>
        </Card>

        {viewMatrix ? (
          <RiskScoreHeatmap
            matrix={{
              scales: viewMatrix.scales,
              thresholds: viewMatrix.thresholds,
              outputScaleMax: viewMatrix.outputScaleMax,
            }}
            rows={riskHeatmapRows}
            title="Risk Heatmap"
            subtitle={`Tagged risks plotted on ${viewMatrix.templateName}`}
            emptyLabel="No risks tagged to this enterprise risk yet."
          />
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No published risk matrix — set one up under Admin → Risk Matrices to see the heatmap.
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Tagged Risks ({childRisks.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {childRisks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No risks tagged yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Risk</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {childRisks.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <Link href={`/risks/${r.id}`} className="hover:underline text-sm">
                            {r.identifier ?? r.title}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{r.severity}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {r.effectiveScoreLabel ?? r.residualScoreLabel ?? r.inherentScoreLabel ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tagged Findings ({childFindings.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {childFindings.length === 0 ? (
                <p className="text-sm text-muted-foreground">No findings tagged yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Finding</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {childFindings.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell>
                          <Link href={`/findings/${f.id}`} className="hover:underline text-sm">
                            {f.identifier ?? f.title}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{f.severityLabel ?? f.severity}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{f.status}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Severity Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <TrendChart snapshots={snapshots} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Review History</CardTitle>
            </CardHeader>
            <CardContent>
              {reviews.length === 0 ? (
                <p className="text-sm text-muted-foreground">No reviews recorded yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Reviewer</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reviews.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-sm">{new Date(r.reviewedAt).toLocaleString()}</TableCell>
                        <TableCell className="text-sm">{r.Reviewer?.name ?? r.Reviewer?.email ?? "—"}</TableCell>
                        <TableCell className="text-sm whitespace-pre-wrap">{r.notes ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
        </>
        )}

        {tagOpen && (
          <TagItemsDialog
            enterpriseRiskId={id}
            open={tagOpen}
            onOpenChange={setTagOpen}
            onChanged={() => void refetch()}
          />
        )}
      </div>
    </AppLayout>
  );
}

function RecordReviewButton({ id, onRecorded }: { id: string; onRecorded: () => void }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const record = api.enterpriseRisk.recordReview.useMutation({
    onSuccess: () => {
      toast.success("Review recorded");
      setOpen(false);
      setNotes("");
      onRecorded();
    },
    onError: (err) => toast.error(err.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <ClipboardCheck className="h-4 w-4 mr-2" /> Record Review
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Review</DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <DialogFooter>
          <Button disabled={record.isPending} onClick={() => record.mutate({ id, notes: notes.trim() || undefined })}>
            {record.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
