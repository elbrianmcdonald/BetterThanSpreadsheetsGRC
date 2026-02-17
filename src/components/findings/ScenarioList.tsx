"use client";

/**
 * Scenario List Component
 *
 * Story 7.7: Risk Scenario Management (AC15-AC20)
 *
 * Displays a list of risk scenarios for an assessment:
 * - AC15: Scenarios displayed in ordered list below scoring section
 * - AC16: Each scenario shows description text
 * - AC17: Each scenario has edit and delete buttons (DRAFT only)
 * - AC18: "Add Scenario" button below list
 * - AC19: Empty state: "No scenarios defined. Add at least one scenario."
 * - AC20: List updates in real-time when scenarios added/removed
 *
 * @see Story 7.7: Risk Scenario Management
 */

import { useState } from "react";
import { Plus, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/trpc/react";

import { ScenarioCard } from "./ScenarioCard";
import { AddScenarioModal } from "./AddScenarioModal";

interface Scenario {
  id: string;
  description: string;
  order: number;
}

interface ScenarioListProps {
  /** List of scenarios to display */
  scenarios: Scenario[];
  /** Assessment ID for adding scenarios */
  assessmentId: string;
  /** Whether the assessment is read-only (APPROVED/REJECTED) */
  isReadOnly: boolean;
  /** Callback when scenarios are modified */
  onUpdate?: () => void;
}

/**
 * Displays and manages risk scenarios for an assessment.
 *
 * @example
 * ```tsx
 * <ScenarioList
 *   scenarios={assessment.scenarios}
 *   assessmentId={assessment.id}
 *   isReadOnly={assessment.status !== "DRAFT"}
 *   onUpdate={() => refetch()}
 * />
 * ```
 */
export function ScenarioList({
  scenarios,
  assessmentId,
  isReadOnly,
  onUpdate,
}: ScenarioListProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const utils = api.useUtils();

  // Handle successful scenario add
  const handleAddSuccess = () => {
    setIsAddModalOpen(false);
    utils.riskAssessment.getById.invalidate();
    onUpdate?.();
  };

  // Handle scenario update or delete
  const handleScenarioChange = () => {
    utils.riskAssessment.getById.invalidate();
    onUpdate?.();
  };

  // Sort scenarios by order
  const sortedScenarios = [...scenarios].sort((a, b) => a.order - b.order);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium">Risk Scenarios</CardTitle>
          {/* AC18: Add Scenario button (only when not read-only) */}
          {!isReadOnly && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddModalOpen(true)}
              className="gap-1"
            >
              <Plus className="h-4 w-4" />
              Add Scenario
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* AC19: Empty state */}
        {scenarios.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed rounded-lg">
            <AlertTriangle className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm font-medium text-muted-foreground">
              No scenarios defined.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {isReadOnly
                ? "This assessment has no risk scenarios."
                : "Add at least one scenario to describe how this risk could materialize."}
            </p>
            {!isReadOnly && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4 gap-1"
                onClick={() => setIsAddModalOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Add First Scenario
              </Button>
            )}
          </div>
        ) : (
          /* AC15, AC16: Display scenarios in ordered list */
          <div className="space-y-2">
            {sortedScenarios.map((scenario, index) => (
              <ScenarioCard
                key={scenario.id}
                scenario={scenario}
                index={index + 1}
                isReadOnly={isReadOnly}
                onUpdate={handleScenarioChange}
              />
            ))}
          </div>
        )}

        {/* Scenario count indicator */}
        {scenarios.length > 0 && (
          <p className="text-xs text-muted-foreground pt-2 border-t">
            {scenarios.length} scenario{scenarios.length !== 1 ? "s" : ""} defined
          </p>
        )}
      </CardContent>

      {/* Add Scenario Modal */}
      <AddScenarioModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        assessmentId={assessmentId}
        onSuccess={handleAddSuccess}
      />
    </Card>
  );
}
