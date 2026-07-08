"use client";

/**
 * Finding matrix scoring section (Story 20.1 — Risk Model Cleanup Epic 20).
 *
 * The one scoring UI shared by every finding-creation entry point: renders
 * L×I(×E) selectors driven by the org's default risk matrix with a live
 * score preview, or falls back to a categorical severity dropdown (with
 * matrix threshold tiers when available, legacy HIGH/MEDIUM/LOW otherwise).
 *
 * Reports a normalized FindingScoringValue via onChange; callers map it to
 * mutation fields with buildScoringSubmitFields. The live score is advisory —
 * the server recomputes authoritatively in finding.create.
 *
 * Extracted from CreateFindingDialog (compliance/maturity), which is now a
 * consumer alongside CreateFindingForm and the vendor
 * questionnaire client.
 */

import { useEffect, useMemo, useState } from "react";
import type { Severity } from "@prisma/client";
import { api } from "@/trpc/react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScaleLevelSelector } from "@/components/assessment/ScaleLevelSelector";
import { calculateInherentScore, isScoreResult } from "@/lib/matrix/scoring";
import type { MatrixScales, Threshold } from "@/lib/matrix/types";
import {
  buildSeverityOptions,
  severityFromLabel,
  type FindingScoringValue,
} from "@/lib/findings/scoring-options";

export type { FindingScoringValue };
export { buildScoringSubmitFields } from "@/lib/findings/scoring-options";

export interface FindingMatrixScoringSectionProps {
  /** Gate the matrix query (e.g., only fetch while a dialog is open). */
  enabled?: boolean;
  /** Preselects the categorical dropdown option with a matching enum. */
  initialSeverity?: Severity;
  /** Local state re-initializes whenever this value changes (dialog reopen). */
  resetKey?: unknown;
  /** Fired with the normalized scoring state on every change. */
  onChange: (value: FindingScoringValue) => void;
}

export function FindingMatrixScoringSection({
  enabled = true,
  initialSeverity,
  resetKey,
  onChange,
}: FindingMatrixScoringSectionProps) {
  // Matrix L×I(×E) scoring inputs. Null until the user picks each axis.
  const [likelihood, setLikelihood] = useState<number | null>(null);
  const [impact, setImpact] = useState<number | null>(null);
  const [exposure, setExposure] = useState<number | null>(null);
  // Selected categorical option key (threshold label or enum value).
  const [severityKey, setSeverityKey] = useState<string | null>(null);

  // Pull the org's default risk matrix. When it has `scales`, we score the
  // finding via L×I(×E); otherwise we fall back to the categorical severity
  // dropdown so every form still works with no configured matrix (AC3).
  const { data: defaultMatrix, isLoading } = api.riskMatrix.getDefault.useQuery(
    undefined,
    { enabled }
  );

  const scales = (defaultMatrix?.scales ?? null) as MatrixScales | null;
  // 3D when the matrix declares dimensionCount 3 AND ships an exposure scale.
  const is3D =
    defaultMatrix?.dimensionCount === 3 &&
    !!scales?.exposure &&
    scales.exposure.length > 0;
  // Use matrix scoring only when scales are present; else categorical fallback.
  const useMatrixScoring =
    !!scales && scales.likelihood.length > 0 && scales.impact.length > 0;

  // Live inherent score from the picked L/I/(E). Same calculateInherentScore
  // the server uses — this preview stays advisory (server is authoritative).
  const liveScore = useMemo(() => {
    if (!useMatrixScoring || !scales || !defaultMatrix) return null;
    if (likelihood == null || impact == null) return null;
    if (is3D && exposure == null) return null;
    const result = calculateInherentScore(
      scales,
      (defaultMatrix.thresholds ?? []) as Threshold[],
      defaultMatrix.outputScaleMax,
      likelihood,
      impact,
      is3D ? exposure : undefined
    );
    return isScoreResult(result) ? result : null;
  }, [useMatrixScoring, scales, defaultMatrix, likelihood, impact, exposure, is3D]);

  const severityOptions = useMemo(
    () => buildSeverityOptions((defaultMatrix?.thresholds ?? null) as Threshold[] | null),
    [defaultMatrix?.thresholds]
  );

  const selectedSeverityOption =
    severityOptions.find((o) => o.key === severityKey) ??
    severityOptions[Math.floor(severityOptions.length / 2)] ??
    severityOptions[0]!;

  // Re-initialize when the consumer signals a reset (e.g., dialog reopened).
  useEffect(() => {
    const initialEnum = initialSeverity ?? "MEDIUM";
    const match = severityOptions.find((o) => o.severity === initialEnum);
    setSeverityKey(
      match?.key ??
        severityOptions[Math.floor(severityOptions.length / 2)]?.key ??
        null
    );
    setLikelihood(null);
    setImpact(null);
    setExposure(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, severityOptions]);

  // Report the normalized scoring state upward on every relevant change.
  useEffect(() => {
    if (useMatrixScoring) {
      onChange({
        mode: "matrix",
        likelihood,
        impact,
        exposure,
        is3D,
        severity: liveScore ? severityFromLabel(liveScore.label) : "MEDIUM",
        severityLabel: liveScore?.label ?? null,
        matrixVersionId: defaultMatrix?.currentVersionId ?? null,
        isComplete: liveScore !== null,
      });
    } else {
      onChange({
        mode: "categorical",
        likelihood: null,
        impact: null,
        exposure: null,
        is3D: false,
        severity: selectedSeverityOption.severity,
        severityLabel: selectedSeverityOption.severityLabel,
        matrixVersionId: defaultMatrix?.currentVersionId ?? null,
        isComplete: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    useMatrixScoring,
    likelihood,
    impact,
    exposure,
    is3D,
    liveScore,
    selectedSeverityOption,
    defaultMatrix?.currentVersionId,
  ]);

  if (isLoading && enabled) {
    return (
      <p className="text-xs text-muted-foreground">Loading risk matrix…</p>
    );
  }

  if (useMatrixScoring && scales) {
    // Matrix scoring: L × I (× E) selectors + live score preview.
    return (
      <div className="space-y-4">
        <div>
          <Label className="mb-2 block">
            Likelihood <span className="text-destructive">*</span>
          </Label>
          <ScaleLevelSelector
            levels={scales.likelihood}
            value={likelihood}
            onChange={setLikelihood}
            variant="compact"
          />
        </div>
        <div>
          <Label className="mb-2 block">
            Impact <span className="text-destructive">*</span>
          </Label>
          <ScaleLevelSelector
            levels={scales.impact}
            value={impact}
            onChange={setImpact}
            variant="compact"
          />
        </div>
        {is3D && scales.exposure ? (
          <div>
            <Label className="mb-2 block">
              Exposure <span className="text-destructive">*</span>
            </Label>
            <ScaleLevelSelector
              levels={scales.exposure}
              value={exposure}
              onChange={setExposure}
              variant="compact"
            />
          </div>
        ) : null}

        {/* Live score + threshold label/color, or a hint to finish picking. */}
        {liveScore ? (
          <div
            className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
            style={{ borderColor: "var(--border)" }}
          >
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: liveScore.color }}
            />
            <span className="font-medium">
              Score {Number(liveScore.normalizedScore.toFixed(2))}
            </span>
            <span className="text-muted-foreground">· {liveScore.label}</span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Select {is3D ? "likelihood, impact, and exposure" : "likelihood and impact"} to
            compute the score
            {defaultMatrix?.name ? (
              <>
                {" "}
                from <span className="font-medium">{defaultMatrix.name}</span>
              </>
            ) : null}
            .
          </p>
        )}
      </div>
    );
  }

  // Fallback: categorical severity dropdown (no configured matrix scales).
  return (
    <div>
      <Label>Severity</Label>
      <Select
        value={selectedSeverityOption.key}
        onValueChange={(v) => setSeverityKey(v)}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {severityOptions.map((o) => (
            <SelectItem key={o.key} value={o.key}>
              <div className="flex items-center gap-2">
                {o.color && (
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: o.color }}
                  />
                )}
                <span>{o.label}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {defaultMatrix?.thresholds ? (
        <p className="text-xs text-muted-foreground mt-1">
          Tiers from <span className="font-medium">{defaultMatrix.name}</span>
        </p>
      ) : (
        <p className="text-xs text-muted-foreground mt-1">
          No risk matrix configured — using basic severity. Configure one under
          Admin → Risk Matrices to score findings the same way as risks.
        </p>
      )}
    </div>
  );
}
