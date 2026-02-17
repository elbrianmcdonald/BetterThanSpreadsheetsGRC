"use client";

/**
 * ApprovalGateChecklist Component
 *
 * Story 7.9: Approval Gates & Assessment Approval (AC1-AC6)
 *
 * Displays a checklist of approval gates that must be met before
 * an assessment can be approved.
 *
 * Gates:
 * - AC2: Score populated (likelihood + impact set)
 * - AC3: Scenario defined (at least one scenario)
 * - AC4: Treatment selected (treatment enum set)
 * - AC5: Owner assigned (ownerId set)
 */

import { CheckCircle2, Circle } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * All approval gates in display order
 * AC2-AC5: Gate definitions
 */
export const ALL_GATES = [
  "Score populated (likelihood and impact values required)",
  "Scenario defined (at least one risk scenario required)",
  "Treatment selected (ACCEPT, MITIGATE, TRANSFER, or AVOID)",
  "Owner assigned",
] as const;

/**
 * Short labels for gates (for compact display)
 */
export const GATE_SHORT_LABELS: Record<string, string> = {
  "Score populated (likelihood and impact values required)": "Score populated",
  "Scenario defined (at least one risk scenario required)": "Scenario defined",
  "Treatment selected (ACCEPT, MITIGATE, TRANSFER, or AVOID)": "Treatment selected",
  "Owner assigned": "Owner assigned",
};

export interface ApprovalGateResult {
  canApprove: boolean;
  missingGates: string[];
}

interface ApprovalGateChecklistProps {
  /** The gate check result from the assessment query */
  gates: ApprovalGateResult;
  /** Optional CSS class */
  className?: string;
  /** Use compact labels */
  compact?: boolean;
}

/**
 * Renders the approval gate checklist
 * AC1: Approval gate checklist displayed on assessment form
 * AC6: Each gate shows check or circle based on status
 */
export function ApprovalGateChecklist({
  gates,
  className,
  compact = false,
}: ApprovalGateChecklistProps) {
  return (
    <div className={cn("space-y-2 rounded-md border p-4", className)}>
      <h4 className="text-sm font-medium">Approval Requirements</h4>
      <div className="space-y-1.5">
        {ALL_GATES.map((gate) => {
          const isPassed = !gates.missingGates.some((mg) =>
            mg.includes(GATE_SHORT_LABELS[gate] ?? gate)
          );
          const displayLabel = compact ? GATE_SHORT_LABELS[gate] ?? gate : gate;

          return (
            <div
              key={gate}
              className="flex items-center gap-2 text-sm"
            >
              {/* AC6: Check (green) or circle (gray) based on status */}
              {isPassed ? (
                <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-500" />
              ) : (
                <Circle className="h-4 w-4 flex-shrink-0 text-gray-300" />
              )}
              <span
                className={cn(
                  isPassed ? "text-green-700 dark:text-green-400" : "text-gray-500"
                )}
              >
                {displayLabel}
              </span>
            </div>
          );
        })}
      </div>
      {gates.canApprove && (
        <p className="mt-2 text-xs text-green-600 dark:text-green-400">
          All requirements met - ready for approval
        </p>
      )}
    </div>
  );
}

/**
 * Compact version for inline display
 */
export function ApprovalGateSummary({
  gates,
  className,
}: Omit<ApprovalGateChecklistProps, "compact">) {
  const passedCount = ALL_GATES.length - gates.missingGates.length;
  const totalCount = ALL_GATES.length;

  return (
    <div className={cn("flex items-center gap-2 text-sm", className)}>
      <span className="text-muted-foreground">
        Approval gates: {passedCount}/{totalCount}
      </span>
      {gates.canApprove ? (
        <CheckCircle2 className="h-4 w-4 text-green-500" />
      ) : (
        <Circle className="h-4 w-4 text-amber-500" />
      )}
    </div>
  );
}
