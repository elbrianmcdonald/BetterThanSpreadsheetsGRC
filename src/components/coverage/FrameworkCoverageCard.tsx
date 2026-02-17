"use client";

/**
 * Framework Coverage Card Component
 *
 * Displays coverage statistics for a single framework with:
 * - Framework name and code
 * - Coverage percentage with progress bar
 * - Total and satisfied control counts
 * - View Gaps button
 *
 * @see Story 2.6: AC19-AC24
 */

import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CoverageProgressBar, getCoverageColor } from "./CoverageProgressBar";
import { AlertTriangle, CheckCircle2, Eye, Target, Play } from "lucide-react";
import { StartAssessmentDialog } from "@/components/compliance/StartAssessmentDialog";

interface FrameworkCoverageCardProps {
  /** Framework database ID */
  frameworkId: string;
  /** Framework code (e.g., "ISO27001") */
  frameworkCode: string;
  /** Framework display name */
  frameworkName: string;
  /** Total controls in the framework */
  totalControls: number;
  /** Controls with evidence (satisfied) */
  satisfiedControls: number;
  /** Coverage percentage (0-100) */
  coveragePercentage: number;
  /** Whether framework is active */
  isActive?: boolean;
  /** Framework version */
  frameworkVersion?: string;
  /** Callback when assessment is created */
  onAssessmentCreated?: () => void;
}

export function FrameworkCoverageCard({
  frameworkId,
  frameworkCode,
  frameworkName,
  totalControls,
  satisfiedControls,
  coveragePercentage,
  isActive = true,
  frameworkVersion = "1.0",
  onAssessmentCreated,
}: FrameworkCoverageCardProps) {
  const gapCount = totalControls - satisfiedControls;
  const colors = getCoverageColor(coveragePercentage);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              {frameworkName}
              {isActive ? (
                <span className="text-xs font-normal px-2 py-0.5 bg-green-100 text-green-700 rounded">
                  Active
                </span>
              ) : (
                <span className="text-xs font-normal px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                  Inactive
                </span>
              )}
            </CardTitle>
            <CardDescription className="font-mono">{frameworkCode}</CardDescription>
          </div>
          <div className={`text-2xl font-bold ${colors.text}`}>
            {coveragePercentage.toFixed(1)}%
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Coverage Progress Bar */}
        <CoverageProgressBar percentage={coveragePercentage} size="lg" />

        {/* Control Statistics */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-2 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-center gap-1 text-gray-500 text-xs mb-1">
              <Target className="h-3 w-3" />
              Total
            </div>
            <div className="text-lg font-semibold">{totalControls}</div>
          </div>
          <div className="p-2 bg-green-50 rounded-lg">
            <div className="flex items-center justify-center gap-1 text-green-600 text-xs mb-1">
              <CheckCircle2 className="h-3 w-3" />
              Satisfied
            </div>
            <div className="text-lg font-semibold text-green-700">{satisfiedControls}</div>
          </div>
          <div className="p-2 bg-red-50 rounded-lg">
            <div className="flex items-center justify-center gap-1 text-red-600 text-xs mb-1">
              <AlertTriangle className="h-3 w-3" />
              Gaps
            </div>
            <div className="text-lg font-semibold text-red-700">{gapCount}</div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Link href={`/admin/frameworks/${frameworkId}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full">
              <Eye className="mr-1 h-4 w-4" />
              View Framework
            </Button>
          </Link>
          <Link href={`/admin/frameworks/${frameworkId}/gaps`} className="flex-1">
            <Button
              variant={gapCount > 0 ? "default" : "outline"}
              size="sm"
              className="w-full"
            >
              <AlertTriangle className="mr-1 h-4 w-4" />
              View Gaps ({gapCount})
            </Button>
          </Link>
        </div>

        {/* Start Assessment */}
        <div className="pt-2 border-t">
          <StartAssessmentDialog
            frameworkId={frameworkId}
            frameworkName={frameworkName}
            frameworkCode={frameworkCode}
            onSuccess={onAssessmentCreated}
            trigger={
              <Button variant="outline" size="sm" className="w-full gap-1">
                <Play className="h-4 w-4" />
                Start Compliance Assessment
              </Button>
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}
