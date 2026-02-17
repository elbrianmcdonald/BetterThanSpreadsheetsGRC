"use client";

/**
 * Impact Assessment Tab Component
 *
 * Epic 11: BIA Impact Assessment
 * Stories 11.2-11.6: Impact scoring, time-to-impact matrix, tier calculation,
 * manual override, and assessment workflow
 */

import { useState } from "react";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Activity,
  CheckCircle,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Save,
  Send,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ImpactAssessmentTabProps {
  processId: string;
  canEdit: boolean;
}

type AssessmentStep = "scoring" | "matrix" | "review";

const STEPS: { key: AssessmentStep; label: string }[] = [
  { key: "scoring", label: "Impact Scoring" },
  { key: "matrix", label: "Time-to-Impact Matrix" },
  { key: "review", label: "Review & Submit" },
];

export function ImpactAssessmentTab({
  processId,
  canEdit,
}: ImpactAssessmentTabProps) {
  const [isAssessmentOpen, setIsAssessmentOpen] = useState(false);
  const [isOverrideOpen, setIsOverrideOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<AssessmentStep>("scoring");
  const [overrideTierId, setOverrideTierId] = useState("");
  const [overrideJustification, setOverrideJustification] = useState("");

  // Local state for scores during assessment
  const [impactScores, setImpactScores] = useState<
    Record<string, { score: number; description: string }>
  >({});
  const [timeImpactScores, setTimeImpactScores] = useState<
    Record<string, number>
  >({});

  const utils = api.useUtils();

  // Query assessment data
  const { data, isLoading, error } = api.biaAssessment.getAssessmentData.useQuery(
    { processId },
    { enabled: !!processId }
  );

  // Mutations
  const saveImpactScoresMutation = api.biaAssessment.saveImpactScores.useMutation({
    onSuccess: () => {
      void utils.biaAssessment.getAssessmentData.invalidate({ processId });
      toast.success("Impact scores saved");
    },
    onError: (error) => toast.error(error.message),
  });

  const saveTimeMatrixMutation = api.biaAssessment.saveTimeImpactMatrix.useMutation({
    onSuccess: () => {
      void utils.biaAssessment.getAssessmentData.invalidate({ processId });
      toast.success("Time-to-impact matrix saved");
    },
    onError: (error) => toast.error(error.message),
  });

  const submitAssessmentMutation = api.biaAssessment.submitAssessment.useMutation({
    onSuccess: () => {
      void utils.biaAssessment.getAssessmentData.invalidate({ processId });
      void utils.businessProcess.getById.invalidate({ id: processId });
      toast.success("Assessment submitted successfully");
      setIsAssessmentOpen(false);
    },
    onError: (error) => toast.error(error.message),
  });

  const overrideTierMutation = api.biaAssessment.overrideTier.useMutation({
    onSuccess: () => {
      void utils.biaAssessment.getAssessmentData.invalidate({ processId });
      void utils.businessProcess.getById.invalidate({ id: processId });
      toast.success("Tier override applied");
      setIsOverrideOpen(false);
    },
    onError: (error) => toast.error(error.message),
  });

  const clearOverrideMutation = api.biaAssessment.clearOverride.useMutation({
    onSuccess: () => {
      void utils.biaAssessment.getAssessmentData.invalidate({ processId });
      void utils.businessProcess.getById.invalidate({ id: processId });
      toast.success("Tier override cleared");
    },
    onError: (error) => toast.error(error.message),
  });

  // Initialize local state from fetched data
  const initializeScores = () => {
    if (data) {
      const scores: Record<string, { score: number; description: string }> = {};
      data.impactScores.forEach((s) => {
        scores[s.categoryId] = {
          score: s.score,
          description: s.description ?? "",
        };
      });
      setImpactScores(scores);

      const timeScores: Record<string, number> = {};
      data.timeImpactScores.forEach((s) => {
        timeScores[`${s.categoryId}-${s.timePeriodId}`] = s.score;
      });
      setTimeImpactScores(timeScores);
    }
  };

  const openAssessmentWizard = () => {
    initializeScores();
    setCurrentStep("scoring");
    setIsAssessmentOpen(true);
  };

  const handleSaveAndNext = async () => {
    if (currentStep === "scoring") {
      // Save impact scores
      const scores = Object.entries(impactScores)
        .filter(([_, v]) => v.score > 0)
        .map(([categoryId, v]) => ({
          categoryId,
          score: v.score,
          description: v.description,
        }));

      if (scores.length > 0) {
        await saveImpactScoresMutation.mutateAsync({ processId, scores });
      }
      setCurrentStep("matrix");
    } else if (currentStep === "matrix") {
      // Save time-to-impact matrix
      const scores = Object.entries(timeImpactScores)
        .filter(([_, score]) => score > 0)
        .map(([key, score]) => {
          const [categoryId, timePeriodId] = key.split("-");
          return { categoryId: categoryId!, timePeriodId: timePeriodId!, score };
        });

      if (scores.length > 0) {
        await saveTimeMatrixMutation.mutateAsync({ processId, scores });
      }
      setCurrentStep("review");
    }
  };

  const handleSubmitAssessment = () => {
    submitAssessmentMutation.mutate({ processId });
  };

  const handleOverrideTier = () => {
    if (!overrideTierId || overrideJustification.length < 50) {
      toast.error("Please select a tier and provide justification (min 50 characters)");
      return;
    }
    overrideTierMutation.mutate({
      processId,
      tierId: overrideTierId,
      justification: overrideJustification,
    });
  };

  const currentStepIndex = STEPS.findIndex((s) => s.key === currentStep);
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <AlertTriangle className="h-12 w-12 mx-auto text-destructive mb-4" />
          <h3 className="text-lg font-medium mb-2">Error Loading Assessment</h3>
          <p className="text-muted-foreground">{error.message}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const { config, effectiveTier, calculatedTier, overrideTier, process } = data;
  const isCompleted = process.assessmentStatus === "COMPLETED";
  const hasScores = data.impactScores.length > 0;

  return (
    <>
      <div className="space-y-6">
        {/* Summary Card */}
        <Card>
          <CardHeader>
            <CardTitle>Impact Assessment</CardTitle>
            <CardDescription>
              Impact scores and tier calculation for this process
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!hasScores ? (
              <div className="text-center py-12">
                <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Assessment Completed</h3>
                <p className="text-muted-foreground mb-4">
                  An impact assessment has not been started for this process.
                </p>
                {canEdit && (
                  <Button onClick={openAssessmentWizard}>Start Assessment</Button>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {/* Tier Display */}
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Assigned Tier</p>
                    <div className="flex items-center gap-3">
                      {effectiveTier ? (
                        <>
                          <Badge
                            style={{
                              backgroundColor: effectiveTier.colorHex,
                              color: "#fff",
                            }}
                            className="text-lg py-1 px-3"
                          >
                            {effectiveTier.name}
                          </Badge>
                          <div className="text-sm">
                            <p>RTO: {effectiveTier.rtoText}</p>
                            <p>RPO: {effectiveTier.rpoText}</p>
                          </div>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Not calculated</span>
                      )}
                    </div>
                    {overrideTier && calculatedTier && (
                      <p className="text-xs text-muted-foreground mt-2">
                        <span className="font-medium">Override active</span> - Calculated tier was{" "}
                        {calculatedTier.name}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {canEdit && (
                      <>
                        <Button variant="outline" size="sm" onClick={openAssessmentWizard}>
                          Edit Assessment
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setOverrideTierId(overrideTier?.id ?? "");
                            setOverrideJustification(process.overrideJustification ?? "");
                            setIsOverrideOpen(true);
                          }}
                        >
                          {overrideTier ? "Edit Override" : "Override Tier"}
                        </Button>
                        {overrideTier && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => clearOverrideMutation.mutate({ processId })}
                            disabled={clearOverrideMutation.isPending}
                          >
                            Clear Override
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Override Justification */}
                {overrideTier && process.overrideJustification && (
                  <Card className="border-amber-200 bg-amber-50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Shield className="h-4 w-4 text-amber-600" />
                        Override Justification
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm">{process.overrideJustification}</p>
                      {process.overrideAt && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Overridden on {new Date(process.overrideAt).toLocaleString()}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Impact Scores */}
                <div>
                  <h4 className="font-medium mb-3">Impact Scores by Category</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {config.impactCategories.map((category) => {
                      const score = data.impactScores.find(
                        (s) => s.categoryId === category.id
                      );
                      return (
                        <div
                          key={category.id}
                          className="p-4 border rounded-lg flex items-start justify-between"
                        >
                          <div>
                            <p className="font-medium">{category.name}</p>
                            {score?.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {score.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {score ? (
                              <Badge variant="outline" className="text-lg">
                                {score.score}/{config.scoreMax}
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Not scored</Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Assessment Status */}
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center gap-2">
                    {isCompleted ? (
                      <>
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <span className="text-sm text-green-600 font-medium">
                          Assessment Complete
                        </span>
                      </>
                    ) : (
                      <>
                        <Activity className="h-5 w-5 text-amber-600" />
                        <span className="text-sm text-amber-600 font-medium">
                          Assessment In Progress
                        </span>
                      </>
                    )}
                  </div>
                  {process.lastAssessedAt && (
                    <p className="text-sm text-muted-foreground">
                      Last assessed: {new Date(process.lastAssessedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Time-to-Impact Matrix Preview (if scores exist) */}
        {data.timeImpactScores.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Time-to-Impact Matrix</CardTitle>
              <CardDescription>
                How impact severity changes over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left p-2 border-b">Category</th>
                      {config.timePeriods.map((tp) => (
                        <th key={tp.id} className="text-center p-2 border-b">
                          {tp.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {config.impactCategories.map((cat) => (
                      <tr key={cat.id}>
                        <td className="p-2 border-b font-medium">{cat.name}</td>
                        {config.timePeriods.map((tp) => {
                          const score = data.timeImpactScores.find(
                            (s) => s.categoryId === cat.id && s.timePeriodId === tp.id
                          );
                          return (
                            <td key={tp.id} className="text-center p-2 border-b">
                              {score ? (
                                <span
                                  className={cn(
                                    "inline-block w-8 h-8 rounded flex items-center justify-center",
                                    score.score >= 4
                                      ? "bg-red-100 text-red-800"
                                      : score.score >= 3
                                      ? "bg-amber-100 text-amber-800"
                                      : score.score >= 2
                                      ? "bg-yellow-100 text-yellow-800"
                                      : "bg-green-100 text-green-800"
                                  )}
                                >
                                  {score.score}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Assessment Wizard Dialog */}
      <Dialog open={isAssessmentOpen} onOpenChange={setIsAssessmentOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Impact Assessment</DialogTitle>
            <DialogDescription>
              Complete the impact assessment for this business process
            </DialogDescription>
          </DialogHeader>

          {/* Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              {STEPS.map((step, idx) => (
                <span
                  key={step.key}
                  className={cn(
                    "flex items-center gap-1",
                    idx <= currentStepIndex
                      ? "text-primary font-medium"
                      : "text-muted-foreground"
                  )}
                >
                  {idx < currentStepIndex ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <span className="w-4 h-4 rounded-full border flex items-center justify-center text-xs">
                      {idx + 1}
                    </span>
                  )}
                  {step.label}
                </span>
              ))}
            </div>
            <Progress value={progress} />
          </div>

          {/* Step Content */}
          <div className="py-4">
            {currentStep === "scoring" && (
              <div className="space-y-6">
                <p className="text-sm text-muted-foreground">
                  Score the impact for each category. View the tier criteria to help
                  determine appropriate scores.
                </p>
                {config.impactCategories.map((category) => (
                  <div key={category.id} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium">{category.name}</h4>
                        {category.description && (
                          <p className="text-sm text-muted-foreground">
                            {category.description}
                          </p>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Weight: {category.weight}%
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Label className="shrink-0">Score:</Label>
                      <div className="flex gap-1">
                        {Array.from(
                          { length: config.scoreMax - config.scoreMin + 1 },
                          (_, i) => i + config.scoreMin
                        ).map((score) => (
                          <button
                            key={score}
                            type="button"
                            onClick={() =>
                              setImpactScores({
                                ...impactScores,
                                [category.id]: {
                                  ...impactScores[category.id],
                                  score,
                                  description: impactScores[category.id]?.description ?? "",
                                },
                              })
                            }
                            className={cn(
                              "w-10 h-10 rounded border flex items-center justify-center font-medium transition-colors",
                              impactScores[category.id]?.score === score
                                ? "bg-primary text-primary-foreground border-primary"
                                : "hover:bg-muted"
                            )}
                          >
                            {score}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label>Impact Description</Label>
                      <Textarea
                        placeholder="Describe the specific impact..."
                        value={impactScores[category.id]?.description ?? ""}
                        onChange={(e) =>
                          setImpactScores({
                            ...impactScores,
                            [category.id]: {
                              ...impactScores[category.id],
                              score: impactScores[category.id]?.score ?? 0,
                              description: e.target.value,
                            },
                          })
                        }
                        rows={2}
                        className="mt-1"
                      />
                    </div>

                    {/* Tier Criteria Hints */}
                    <div className="text-xs bg-muted p-2 rounded">
                      <p className="font-medium mb-1">Scoring Guide:</p>
                      {config.tierCriteria
                        .filter((c) => c.categoryId === category.id)
                        .slice(0, 4)
                        .map((criteria) => (
                          <p key={criteria.id} className="text-muted-foreground">
                            <span className="font-medium">{criteria.tier.name}:</span>{" "}
                            {criteria.description}
                          </p>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {currentStep === "matrix" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Score how impact severity changes over different time periods.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="text-left p-2 border-b">Category</th>
                        {config.timePeriods.map((tp) => (
                          <th key={tp.id} className="text-center p-2 border-b min-w-[80px]">
                            {tp.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {config.impactCategories.map((cat) => (
                        <tr key={cat.id}>
                          <td className="p-2 border-b font-medium">{cat.name}</td>
                          {config.timePeriods.map((tp) => {
                            const key = `${cat.id}-${tp.id}`;
                            return (
                              <td key={tp.id} className="text-center p-2 border-b">
                                <Select
                                  value={timeImpactScores[key]?.toString() ?? ""}
                                  onValueChange={(v) =>
                                    setTimeImpactScores({
                                      ...timeImpactScores,
                                      [key]: parseInt(v),
                                    })
                                  }
                                >
                                  <SelectTrigger className="w-16 mx-auto">
                                    <SelectValue placeholder="-" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Array.from(
                                      { length: config.scoreMax - config.scoreMin + 1 },
                                      (_, i) => i + config.scoreMin
                                    ).map((score) => (
                                      <SelectItem key={score} value={score.toString()}>
                                        {score}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {currentStep === "review" && (
              <div className="space-y-6">
                <p className="text-sm text-muted-foreground">
                  Review your assessment before submitting.
                </p>

                {/* Impact Scores Summary */}
                <div>
                  <h4 className="font-medium mb-2">Impact Scores</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {config.impactCategories.map((cat) => {
                      const score = impactScores[cat.id];
                      return (
                        <div key={cat.id} className="flex justify-between p-2 bg-muted rounded">
                          <span>{cat.name}</span>
                          <Badge variant="outline">
                            {score?.score ?? 0}/{config.scoreMax}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Calculated Tier Preview */}
                {calculatedTier && (
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Calculated Tier</p>
                    <Badge
                      style={{
                        backgroundColor: calculatedTier.colorHex,
                        color: "#fff",
                      }}
                      className="text-lg py-1 px-3"
                    >
                      {calculatedTier.name}
                    </Badge>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="flex justify-between">
            <div>
              {currentStepIndex > 0 && (
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(STEPS[currentStepIndex - 1]!.key)}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsAssessmentOpen(false)}>
                Cancel
              </Button>
              {currentStep !== "review" ? (
                <Button
                  onClick={handleSaveAndNext}
                  disabled={
                    saveImpactScoresMutation.isPending || saveTimeMatrixMutation.isPending
                  }
                >
                  {(saveImpactScoresMutation.isPending ||
                    saveTimeMatrixMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  <Save className="h-4 w-4 mr-1" />
                  Save & Continue
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmitAssessment}
                  disabled={submitAssessmentMutation.isPending}
                >
                  {submitAssessmentMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  <Send className="h-4 w-4 mr-1" />
                  Submit Assessment
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Override Tier Dialog */}
      <Dialog open={isOverrideOpen} onOpenChange={setIsOverrideOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override Tier</DialogTitle>
            <DialogDescription>
              Manually override the calculated tier with justification
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {calculatedTier && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Calculated Tier</p>
                <Badge
                  style={{ backgroundColor: calculatedTier.colorHex, color: "#fff" }}
                >
                  {calculatedTier.name}
                </Badge>
              </div>
            )}

            <div className="space-y-2">
              <Label>Override To</Label>
              <Select value={overrideTierId} onValueChange={setOverrideTierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select tier..." />
                </SelectTrigger>
                <SelectContent>
                  {config.tierDefinitions.map((tier) => (
                    <SelectItem key={tier.id} value={tier.id}>
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: tier.colorHex }}
                        />
                        {tier.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>
                Justification <span className="text-muted-foreground">(min 50 characters)</span>
              </Label>
              <Textarea
                placeholder="Explain why this tier override is necessary..."
                value={overrideJustification}
                onChange={(e) => setOverrideJustification(e.target.value)}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                {overrideJustification.length}/50 characters
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOverrideOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleOverrideTier}
              disabled={
                overrideTierMutation.isPending ||
                !overrideTierId ||
                overrideJustification.length < 50
              }
            >
              {overrideTierMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Apply Override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
