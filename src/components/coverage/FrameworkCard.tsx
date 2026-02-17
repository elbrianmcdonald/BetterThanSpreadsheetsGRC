"use client";

/**
 * Framework Card Component
 *
 * Simple card showing framework information with actions to:
 * - View framework details
 * - Start a new compliance assessment
 *
 * This is separate from assessment progress/coverage which is shown
 * in assessment-specific cards.
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
import { Badge } from "@/components/ui/badge";
import { Eye, Play, Shield, FileText } from "lucide-react";
import { StartAssessmentDialog } from "@/components/compliance/StartAssessmentDialog";

interface FrameworkCardProps {
  /** Framework database ID */
  frameworkId: string;
  /** Framework code (e.g., "ISO27001") */
  frameworkCode: string;
  /** Framework display name */
  frameworkName: string;
  /** Framework version */
  frameworkVersion?: string;
  /** Total controls in the framework */
  totalControls: number;
  /** Whether framework is active */
  isActive?: boolean;
  /** Number of existing assessments for this framework */
  assessmentCount?: number;
  /** Callback when assessment is created */
  onAssessmentCreated?: () => void;
}

export function FrameworkCard({
  frameworkId,
  frameworkCode,
  frameworkName,
  frameworkVersion = "1.0",
  totalControls,
  isActive = true,
  assessmentCount = 0,
  onAssessmentCreated,
}: FrameworkCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg">{frameworkName}</CardTitle>
              <CardDescription className="font-mono text-xs">
                {frameworkCode} v{frameworkVersion}
              </CardDescription>
            </div>
          </div>
          {isActive ? (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              Active
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-gray-50 text-gray-600">
              Inactive
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Framework Stats */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span>{totalControls} Controls</span>
          </div>
          {assessmentCount > 0 && (
            <Badge variant="secondary">
              {assessmentCount} Assessment{assessmentCount !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Link href={`/admin/frameworks/${frameworkId}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full">
              <Eye className="mr-1 h-4 w-4" />
              View Framework
            </Button>
          </Link>
          <StartAssessmentDialog
            frameworkId={frameworkId}
            frameworkName={frameworkName}
            frameworkCode={frameworkCode}
            onSuccess={onAssessmentCreated}
            trigger={
              <Button size="sm" className="flex-1">
                <Play className="mr-1 h-4 w-4" />
                Start Assessment
              </Button>
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}
