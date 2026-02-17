"use client";

/**
 * Approval Gate Checklist Component
 *
 * Story 7.6: Risk Assessment Form with Auto-Save (AC28-AC30)
 *
 * Displays approval gates status:
 * - AC28: Component displays below form
 * - AC29: Shows all 4 gates with check/uncheck status
 * - AC30: Updates in real-time as fields are completed
 *
 * Gates (from Story 7.5):
 * 1. Score populated (likelihood AND impact set)
 * 2. Scenario defined (at least one)
 * 3. Treatment selected
 * 4. Owner assigned
 *
 * @see Story 7.6: Risk Assessment Form with Auto-Save
 * @see Story 7.5: assessmentStateMachine.ts for gate definitions
 */

import { CheckCircle2, Circle, ShieldCheck } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * All 4 approval gates with their descriptions
 */
const APPROVAL_GATES = [
  {
    id: "score",
    label: "Score Populated",
    description: "Likelihood and impact values must be set",
  },
  {
    id: "scenario",
    label: "Scenario Defined",
    description: "At least one risk scenario required",
  },
  {
    id: "treatment",
    label: "Treatment Selected",
    description: "Risk treatment option must be chosen",
  },
  {
    id: "owner",
    label: "Owner Assigned",
    description: "Risk owner must be assigned",
  },
] as const;

interface ApprovalGateChecklistProps {
  /** Approval gates status from API */
  gates: {
    canApprove: boolean;
    missingGates: string[];
  };
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays the 4 approval gates with their completion status.
 *
 * @example
 * ```tsx
 * <ApprovalGateChecklist
 *   gates={{
 *     canApprove: false,
 *     missingGates: ["Score populated", "Owner assigned"]
 *   }}
 * />
 * ```
 */
export function ApprovalGateChecklist({
  gates,
  className,
}: ApprovalGateChecklistProps) {
  /**
   * Check if a gate is completed by checking if it's NOT in missingGates
   */
  const isGateCompleted = (gateLabel: string): boolean => {
    // The missingGates array contains full descriptions like:
    // "Score populated (likelihood and impact values required)"
    // We need to check if any missing gate starts with the gate label
    return !gates.missingGates.some((missing) =>
      missing.toLowerCase().startsWith(gateLabel.toLowerCase())
    );
  };

  const completedCount = APPROVAL_GATES.filter((gate) =>
    isGateCompleted(gate.label)
  ).length;

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Approval Requirements
          <span className="ml-auto text-sm font-normal text-muted-foreground">
            {completedCount}/{APPROVAL_GATES.length} complete
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {APPROVAL_GATES.map((gate) => {
            const completed = isGateCompleted(gate.label);

            return (
              <div
                key={gate.id}
                className={cn(
                  "flex items-start gap-3 rounded-md p-2 transition-colors",
                  completed
                    ? "bg-green-50 dark:bg-green-900/10"
                    : "bg-muted/50"
                )}
              >
                {completed ? (
                  <CheckCircle2 className="h-5 w-5 mt-0.5 text-green-600 dark:text-green-400 shrink-0" />
                ) : (
                  <Circle className="h-5 w-5 mt-0.5 text-muted-foreground shrink-0" />
                )}
                <div className="min-w-0">
                  <p
                    className={cn(
                      "font-medium text-sm",
                      completed
                        ? "text-green-700 dark:text-green-300"
                        : "text-foreground"
                    )}
                  >
                    {gate.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {gate.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {gates.canApprove && (
          <div className="mt-4 p-3 rounded-md bg-green-100 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <p className="text-sm font-medium text-green-700 dark:text-green-300 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              All requirements met - ready for approval
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
