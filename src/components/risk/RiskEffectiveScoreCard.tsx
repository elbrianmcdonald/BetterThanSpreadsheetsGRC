"use client";

/**
 * Effective severity card on the risk detail page (Stories 22.1 + 22.2).
 *
 * Shows the risk's derived score: calculated = max inherent score across OPEN
 * linked findings; effective = manual override when useManualScore, else
 * calculated. The Override dialog (22.2) captures a manual L×I(×E) against
 * the risk's locked matrix version (org default fallback); removing the
 * override reverts effective to the calculated rollup.
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Calculator, Loader2, Pencil } from "lucide-react";

import { api } from "@/trpc/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { SeverityCalculator } from "@/components/risk/SeverityCalculator";
import type { MatrixScales, Threshold } from "@/lib/matrix";

const num = (v: number | string | null | undefined): number | null =>
  v == null ? null : Number(v);

interface RiskEffectiveScoreCardProps {
  riskId: string;
  matrixVersionId?: string | null;
  canManage?: boolean;
  useManualScore: boolean;
  manualScore: number | string | null;
  manualScoreLabel: string | null;
  manualLikelihood?: number | string | null;
  manualImpact?: number | string | null;
  manualExposure?: number | string | null;
  calculatedScore: number | string | null;
  calculatedScoreLabel: string | null;
  effectiveScore: number | string | null;
  effectiveScoreLabel: string | null;
  effectiveScoreSource: "CALCULATED" | "MANUAL" | null;
  /** Called after the override changes (refetch). */
  onChanged?: () => void;
}

interface OverrideFormValues {
  likelihood: number | null;
  impact: number | null;
  exposure: number | null;
}

export function RiskEffectiveScoreCard(props: RiskEffectiveScoreCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const effective = num(props.effectiveScore);
  const calculated = num(props.calculatedScore);
  const manual = num(props.manualScore);

  // Locked matrix version for the override pickers (org default fallback).
  const { data: lockedVersion } = api.riskMatrix.getVersion.useQuery(
    { id: props.matrixVersionId! },
    { enabled: dialogOpen && !!props.matrixVersionId }
  );
  const { data: defaultMatrix } = api.riskMatrix.getDefault.useQuery(undefined, {
    enabled: dialogOpen && !props.matrixVersionId,
  });
  const scales = (lockedVersion?.scales ?? defaultMatrix?.scales ?? null) as MatrixScales | null;
  const thresholds = (lockedVersion?.thresholds ?? defaultMatrix?.thresholds ?? []) as Threshold[];
  const is3DMatrix = !!scales?.exposure && scales.exposure.length > 0;

  const form = useForm<OverrideFormValues>({
    defaultValues: {
      likelihood: num(props.manualLikelihood),
      impact: num(props.manualImpact),
      exposure: num(props.manualExposure),
    },
  });

  const utils = api.useUtils();
  const setManualMutation = api.risk.setManualScore.useMutation({
    onSuccess: (r) => {
      toast.success(
        r?.useManualScore ? "Manual score set" : "Override removed — back to calculated"
      );
      void utils.risk.getById.invalidate({ id: props.riskId });
      setDialogOpen(false);
      props.onChanged?.();
    },
    onError: (e) => toast.error(e.message || "Failed to update manual score"),
  });

  const openDialog = () => {
    form.reset({
      likelihood: num(props.manualLikelihood),
      impact: num(props.manualImpact),
      exposure: num(props.manualExposure),
    });
    setDialogOpen(true);
  };

  const onSubmit = (values: OverrideFormValues) => {
    if (values.likelihood == null || values.impact == null) {
      toast.error("Select likelihood and impact for the manual score.");
      return;
    }
    setManualMutation.mutate({
      riskId: props.riskId,
      enabled: true,
      likelihood: values.likelihood,
      impact: values.impact,
      exposure: is3DMatrix ? values.exposure ?? undefined : undefined,
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calculator className="h-4 w-4 text-purple-500" />
            Effective Severity
            {props.effectiveScoreSource && (
              <Badge variant="outline" className="font-normal">
                {props.effectiveScoreSource === "MANUAL" ? "Manual override" : "Calculated"}
              </Badge>
            )}
          </CardTitle>
          {props.canManage && (
            <Button variant="outline" size="sm" onClick={openDialog}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Override
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Calculated from the highest-scored open linked finding; a manual
          override wins when set.
        </p>
      </CardHeader>
      <CardContent>
        {effective === null ? (
          <p className="text-sm text-muted-foreground">
            Not scored yet — link scored findings (or set a manual score) to
            derive this risk&apos;s severity.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Effective</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-2xl font-semibold">{Number(effective.toFixed(2))}</span>
                {props.effectiveScoreLabel && (
                  <Badge>{props.effectiveScoreLabel}</Badge>
                )}
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Calculated</p>
              <p className="text-sm mt-1">
                {calculated === null ? "—" : Number(calculated.toFixed(2))}
                {props.calculatedScoreLabel ? ` · ${props.calculatedScoreLabel}` : ""}
              </p>
            </div>
            {props.useManualScore && (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Manual</p>
                <p className="text-sm mt-1">
                  {manual === null ? "—" : Number(manual.toFixed(2))}
                  {props.manualScoreLabel ? ` · ${props.manualScoreLabel}` : ""}
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Manual score override</DialogTitle>
            <DialogDescription>
              Your matrix-anchored judgment for this risk. The calculated
              rollup stays tracked; the manual score drives the effective
              severity until removed.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <SeverityCalculator
                title="Manual Severity"
                description="Judgment score — overrides the calculated rollup"
                control={form.control}
                likelihoodName="likelihood"
                impactName="impact"
                exposureName="exposure"
                scales={scales}
                thresholds={thresholds}
                is3DMatrix={is3DMatrix}
              />

              <DialogFooter className="gap-2">
                {props.useManualScore && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="mr-auto text-destructive"
                    disabled={setManualMutation.isPending}
                    onClick={() =>
                      setManualMutation.mutate({ riskId: props.riskId, enabled: false })
                    }
                  >
                    Remove override
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={setManualMutation.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={setManualMutation.isPending}>
                  {setManualMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save override"
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
