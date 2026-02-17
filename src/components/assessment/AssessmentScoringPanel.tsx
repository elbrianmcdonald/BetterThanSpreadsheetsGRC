"use client";

/**
 * AssessmentScoringPanel Component
 *
 * Story 7.8.9: Assessment Form Matrix Integration (AC11-AC22)
 *
 * Integrated panel for risk scoring in assessment forms.
 * Combines scale selectors, score display, and matrix preview.
 */

import { Info, Lock } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useRiskScore } from "@/hooks/useRiskScore";
import type { MatrixScales, Threshold } from "@/lib/matrix";
import { ScaleLevelSelector } from "./ScaleLevelSelector";
import { ScoreDisplay } from "./ScoreDisplay";
import { MatrixPreview } from "./MatrixPreview";

interface AssessmentScoringPanelProps {
  /** Matrix scales from the version */
  scales: MatrixScales | null | undefined;
  /** Thresholds from the matrix version */
  thresholds: Threshold[] | null | undefined;
  /** Maximum output scale value */
  outputScaleMax: number | null | undefined;
  /** Matrix version display label (e.g., "Standard Risk Matrix v2") */
  matrixLabel?: string;
  /** Whether the matrix version is locked */
  isLocked?: boolean;
  /** Current likelihood value */
  likelihoodValue: number | null | undefined;
  /** Current impact value */
  impactValue: number | null | undefined;
  /** Current exposure value (for 3D matrices) */
  exposureValue?: number | null | undefined;
  /** Callback when likelihood changes */
  onLikelihoodChange: (value: number) => void;
  /** Callback when impact changes */
  onImpactChange: (value: number) => void;
  /** Callback when exposure changes (for 3D matrices) */
  onExposureChange?: (value: number) => void;
  /** Whether selectors are disabled */
  disabled?: boolean;
  /** Optional CSS class */
  className?: string;
}

/**
 * Complete scoring panel for assessment forms
 *
 * Implements:
 * - AC11: Likelihood selector shows scale levels from selected matrix
 * - AC12: Impact selector shows scale levels from selected matrix
 * - AC13: Exposure selector shown only for 3D matrices
 * - AC14: Each selector shows label and description
 * - AC15: Selectors disabled until matrix selected
 * - AC16: Current selection clearly indicated
 * - AC17: Can change selections before final save
 * - AC18: Score preview updates as selections change
 * - AC19: Shows numeric score, threshold label, and color
 * - AC20: "Incomplete" state when not all required values selected
 * - AC21: Score appears prominently in form
 * - AC22: Matrix preview grid shows current position highlighted
 */
export function AssessmentScoringPanel({
  scales,
  thresholds,
  outputScaleMax,
  matrixLabel,
  isLocked = false,
  likelihoodValue,
  impactValue,
  exposureValue,
  onLikelihoodChange,
  onImpactChange,
  onExposureChange,
  disabled = false,
  className,
}: AssessmentScoringPanelProps) {
  // Calculate score in real-time
  const score = useRiskScore({
    scales,
    thresholds,
    outputScaleMax,
    likelihoodValue,
    impactValue,
    exposureValue,
  });

  // Check if this is a 3D matrix
  const is3D = scales?.exposure && scales.exposure.length > 0;

  // If no matrix data, show placeholder
  if (!scales || !thresholds || !outputScaleMax) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Risk Scoring</CardTitle>
          <CardDescription>
            Select a risk matrix to enable scoring
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            No matrix selected
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={className}>
      {/* Score Display Card */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>Inherent Risk Score</CardTitle>
            {isLocked && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Lock className="h-3 w-3" />
                      <span>Locked</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Scored using {matrixLabel} (locked for audit integrity)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          {matrixLabel && (
            <CardDescription className="flex items-center gap-1">
              {matrixLabel}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Risk score calculated using this matrix version</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <ScoreDisplay score={score} size="lg" />
        </CardContent>
      </Card>

      {/* Scale Selectors */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Risk Factors</CardTitle>
          <CardDescription>
            Select the appropriate level for each risk factor
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Likelihood */}
          <div>
            <h4 className="font-medium mb-3">Likelihood</h4>
            <ScaleLevelSelector
              levels={scales.likelihood}
              value={likelihoodValue}
              onChange={onLikelihoodChange}
              disabled={disabled}
            />
          </div>

          {/* Impact */}
          <div>
            <h4 className="font-medium mb-3">Impact</h4>
            <ScaleLevelSelector
              levels={scales.impact}
              value={impactValue}
              onChange={onImpactChange}
              disabled={disabled}
            />
          </div>

          {/* Exposure (3D only) */}
          {is3D && scales.exposure && onExposureChange && (
            <div>
              <h4 className="font-medium mb-3">Exposure</h4>
              <ScaleLevelSelector
                levels={scales.exposure}
                value={exposureValue}
                onChange={onExposureChange}
                disabled={disabled}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Matrix Preview (2D only - 3D would need different visualization) */}
      {!is3D && (
        <Card>
          <CardHeader>
            <CardTitle>Risk Matrix</CardTitle>
            <CardDescription>
              Visual representation of the risk matrix
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MatrixPreview
              scales={scales}
              thresholds={thresholds}
              outputScaleMax={outputScaleMax}
              highlightLikelihood={likelihoodValue}
              highlightImpact={impactValue}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
