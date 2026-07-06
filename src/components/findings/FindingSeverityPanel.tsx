"use client";

/**
 * Finding Severity Panel + Rescore dialog (Story 20.2).
 *
 * Shows the finding's inherent and residual matrix scores (with the locked
 * matrix version's name) and offers a Rescore action. Rescoring always runs
 * against the finding's LOCKED matrixVersionId — the dialog fetches that
 * exact version's scales/thresholds via riskMatrix.getVersion, never the org
 * default (legacy unscored findings fall back to the default for their first
 * score). Terminal-status findings (DUPLICATE/REJECTED/CLOSED) render
 * read-only with no rescore affordance; the server enforces the same guard.
 */

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Calculator, Pencil } from "lucide-react";
import type { FindingStatus } from "@prisma/client";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Loader2 } from "lucide-react";
import { SeverityCalculator } from "@/components/risk/SeverityCalculator";
import type { MatrixScales, Threshold } from "@/lib/matrix";

/** Statuses whose scoring is read-only (shared with the server state machine). */
import { TERMINAL_FINDING_STATUSES as TERMINAL_STATUSES } from "@/lib/findings/terminal-statuses";

interface FindingSeverityPanelProps {
  findingId: string;
  status: FindingStatus;
  severityLabel: string | null;
  matrixVersionId: string | null;
  inherentLikelihood: number | string | null;
  inherentImpact: number | string | null;
  inherentExposure: number | string | null;
  inherentScore: number | string | null;
  residualLikelihood: number | string | null;
  residualImpact: number | string | null;
  residualExposure: number | string | null;
  residualScore: number | string | null;
  residualScoreLabel: string | null;
  residualEliminated: boolean;
  /**
   * Story 23.5 (review MJ-5): whether the viewer may rescore — must mirror
   * the server's FINDING_TRIAGE_ROLES; the panel is read-only otherwise.
   */
  canRescore: boolean;
  /** Called after a successful rescore (invalidate/refresh). */
  onRescored: () => void;
}

interface RescoreFormValues {
  likelihood: number | null;
  impact: number | null;
  exposure: number | null;
  residualLikelihood: number | null;
  residualImpact: number | null;
  residualExposure: number | null;
  residualEliminated: boolean;
}

const num = (v: number | string | null): number | null =>
  v == null ? null : Number(v);

export function FindingSeverityPanel(props: FindingSeverityPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const isTerminal = TERMINAL_STATUSES.includes(props.status);
  const showRescore = props.canRescore && !isTerminal;

  // Locked matrix version — fetched by id so a superseded version still
  // drives the pickers (AC1). Legacy unscored findings use the org default.
  const { data: lockedVersion } = api.riskMatrix.getVersion.useQuery(
    { id: props.matrixVersionId! },
    { enabled: !!props.matrixVersionId }
  );
  const { data: defaultMatrix } = api.riskMatrix.getDefault.useQuery(undefined, {
    enabled: !props.matrixVersionId,
  });

  const scales = (lockedVersion?.scales ??
    defaultMatrix?.scales ??
    null) as MatrixScales | null;
  const thresholds = (lockedVersion?.thresholds ??
    defaultMatrix?.thresholds ??
    []) as Threshold[];
  const is3DMatrix = !!scales?.exposure && scales.exposure.length > 0;
  const matrixName =
    lockedVersion?.template?.name ?? defaultMatrix?.name ?? null;

  const form = useForm<RescoreFormValues>({
    defaultValues: {
      likelihood: num(props.inherentLikelihood),
      impact: num(props.inherentImpact),
      exposure: num(props.inherentExposure),
      residualLikelihood: num(props.residualLikelihood),
      residualImpact: num(props.residualImpact),
      residualExposure: num(props.residualExposure),
      residualEliminated: props.residualEliminated,
    },
  });
  const residualEliminated = form.watch("residualEliminated");

  const utils = api.useUtils();
  const rescoreMutation = api.finding.rescore.useMutation({
    onSuccess: () => {
      toast.success("Finding rescored");
      void utils.finding.getById.invalidate({ id: props.findingId });
      setDialogOpen(false);
      props.onRescored();
    },
    onError: (e) => toast.error(e.message || "Failed to rescore finding"),
  });

  const openDialog = () => {
    form.reset({
      likelihood: num(props.inherentLikelihood),
      impact: num(props.inherentImpact),
      exposure: num(props.inherentExposure),
      residualLikelihood: num(props.residualLikelihood),
      residualImpact: num(props.residualImpact),
      residualExposure: num(props.residualExposure),
      residualEliminated: props.residualEliminated,
    });
    setDialogOpen(true);
  };

  const onSubmit = (values: RescoreFormValues) => {
    if (values.likelihood == null || values.impact == null) {
      toast.error("Select inherent likelihood and impact.");
      return;
    }
    if (is3DMatrix && values.exposure == null) {
      toast.error("Select inherent exposure.");
      return;
    }
    rescoreMutation.mutate({
      findingId: props.findingId,
      likelihood: values.likelihood,
      impact: values.impact,
      exposure: is3DMatrix ? values.exposure ?? undefined : undefined,
      residualLikelihood: values.residualEliminated
        ? undefined
        : values.residualLikelihood ?? undefined,
      residualImpact: values.residualEliminated
        ? undefined
        : values.residualImpact ?? undefined,
      residualExposure: values.residualEliminated
        ? undefined
        : values.residualExposure ?? undefined,
      residualEliminated: values.residualEliminated,
    });
  };

  const inherentSummary = useMemo(() => {
    const l = num(props.inherentLikelihood);
    const i = num(props.inherentImpact);
    const s = num(props.inherentScore);
    if (s == null) return "Not scored";
    const dims = [l, i, num(props.inherentExposure)].filter((v) => v != null);
    return `${dims.join(" × ")} = ${Number(s.toFixed(2))}`;
  }, [props.inherentLikelihood, props.inherentImpact, props.inherentExposure, props.inherentScore]);

  const residualSummary = useMemo(() => {
    if (props.residualEliminated) return null;
    const s = num(props.residualScore);
    if (s == null) return "Not scored";
    const dims = [
      num(props.residualLikelihood),
      num(props.residualImpact),
      num(props.residualExposure),
    ].filter((v) => v != null);
    return `${dims.join(" × ")} = ${Number(s.toFixed(2))}`;
  }, [props.residualEliminated, props.residualLikelihood, props.residualImpact, props.residualExposure, props.residualScore]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calculator className="h-4 w-4 text-purple-500" />
            Severity Scoring
          </CardTitle>
          {showRescore && (
            <Button variant="outline" size="sm" onClick={openDialog}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Rescore
            </Button>
          )}
        </div>
        {matrixName && (
          <p className="text-xs text-muted-foreground">
            Scored against <span className="font-medium">{matrixName}</span>
            {props.matrixVersionId ? " (locked at creation)" : " (org default)"}
          </p>
        )}
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-md border p-3 space-y-1">
          <p className="text-sm font-medium text-muted-foreground">Inherent</p>
          <div className="flex items-center gap-2">
            <span className="text-sm">{inherentSummary}</span>
            {props.severityLabel && (
              <Badge variant="outline">{props.severityLabel}</Badge>
            )}
          </div>
        </div>
        <div className="rounded-md border p-3 space-y-1">
          <p className="text-sm font-medium text-muted-foreground">Residual</p>
          {props.residualEliminated ? (
            <Badge className="bg-emerald-600 text-white">Eliminated</Badge>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm">{residualSummary}</span>
              {props.residualScoreLabel && (
                <Badge variant="outline">{props.residualScoreLabel}</Badge>
              )}
            </div>
          )}
        </div>
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>Rescore finding</DialogTitle>
            <DialogDescription>
              Scores are computed against{" "}
              {matrixName ? <strong>{matrixName}</strong> : "the org default matrix"} —
              the version locked when this finding was created.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Eliminated toggle inline with the section header (matches the
                  finding-variant card layout) */}
              <div className="flex items-center justify-end">
                <FormField
                  control={form.control}
                  name="residualEliminated"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={field.value ?? false}
                          onChange={(e) => field.onChange(e.target.checked)}
                        />
                      </FormControl>
                      <FormLabel
                        className="cursor-pointer font-normal text-sm text-muted-foreground"
                        title="Controls fully remove this finding — no residual score required."
                      >
                        Finding eliminated
                      </FormLabel>
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SeverityCalculator
                  title="Inherent Severity"
                  description="Severity before controls are applied"
                  control={form.control}
                  likelihoodName="likelihood"
                  impactName="impact"
                  exposureName="exposure"
                  scales={scales}
                  thresholds={thresholds}
                  is3DMatrix={is3DMatrix}
                />
                {residualEliminated ? (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 self-start">
                    Residual severity is marked <strong>Eliminated</strong>.
                  </div>
                ) : (
                  <SeverityCalculator
                    title="Residual Severity"
                    description="Severity after controls are applied"
                    control={form.control}
                    likelihoodName="residualLikelihood"
                    impactName="residualImpact"
                    exposureName="residualExposure"
                    scales={scales}
                    thresholds={thresholds}
                    is3DMatrix={is3DMatrix}
                  />
                )}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={rescoreMutation.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={rescoreMutation.isPending}>
                  {rescoreMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save score"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
