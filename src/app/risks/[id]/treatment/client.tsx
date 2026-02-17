"use client";

/**
 * Treatment Decision Client Component
 *
 * Story 16.7: Treatment Decision Page
 *
 * Provides the treatment decision form interface.
 * - AC7: Page at /risks/[id]/treatment
 * - AC8: Risk summary card at top
 * - AC9: Treatment decision radio buttons
 * - AC10: Justification textarea
 * - AC11: Display SLA days based on severity
 * - AC12: Display calculated due date
 * - AC13: Submit Decision button
 * - AC14-AC16: After decision handling
 *
 * @see Story 16.7: Treatment Decision Page
 */

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  AlertTriangle,
  Shield,
  ShieldCheck,
  ArrowRightLeft,
  XCircle,
  CheckCircle,
  Calendar,
  Clock,
  Loader2,
  Info,
  ChevronDown,
  ChevronRight,
  TrendingDown,
} from "lucide-react";
import toast from "react-hot-toast";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { type Threshold, type MatrixScales } from "@/lib/matrix";
import { PersonPicker } from "@/components/person/PersonPicker";
import { CreatableBusinessUnitPicker } from "@/components/business-unit/CreatableBusinessUnitPicker";

interface TreatmentDecisionClientProps {
  riskId: string;
}

/** Treatment type configuration */
const treatmentTypes = [
  {
    value: "ACCEPT",
    label: "Accept Risk",
    description: "Acknowledge and accept the risk without further action. Requires justification.",
    icon: CheckCircle,
    color: "text-purple-600",
    requiresJustification: true,
  },
  {
    value: "REMEDIATE",
    label: "Remediate Risk",
    description: "Take action to reduce or eliminate the risk through controls or fixes.",
    icon: ShieldCheck,
    color: "text-green-600",
    requiresJustification: false,
  },
  {
    value: "TRANSFER",
    label: "Transfer Risk",
    description: "Transfer the risk to a third party (e.g., insurance, outsourcing).",
    icon: ArrowRightLeft,
    color: "text-blue-600",
    requiresJustification: false,
  },
  {
    value: "AVOID",
    label: "Avoid Risk",
    description: "Eliminate the risk by removing the source or stopping the activity.",
    icon: XCircle,
    color: "text-red-600",
    requiresJustification: false,
  },
] as const;

type TreatmentType = (typeof treatmentTypes)[number]["value"];

/** Severity badge configuration */
const severityConfig: Record<string, { color: string }> = {
  Critical: { color: "bg-red-600 text-white" },
  High: { color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" },
  Medium: { color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  Low: { color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  Info: { color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
};

export function TreatmentDecisionClient({ riskId }: TreatmentDecisionClientProps) {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

  // Form state
  const [selectedType, setSelectedType] = useState<TreatmentType | null>(null);
  const [justification, setJustification] = useState("");

  // Treatment action details state
  const [detail, setDetail] = useState("");
  const [assignedToId, setAssignedToId] = useState<string | null>(null);
  const [treatmentBusinessUnitId, setTreatmentBusinessUnitId] = useState<string | null>(null);
  const [targetCompletionDate, setTargetCompletionDate] = useState("");

  // Residual severity state
  const [residualExpanded, setResidualExpanded] = useState(false);
  const [residualLikelihood, setResidualLikelihood] = useState<number | null>(null);
  const [residualImpact, setResidualImpact] = useState<number | null>(null);
  const [residualExposure, setResidualExposure] = useState<number | null>(null);

  // Redirect to login if not authenticated
  if (sessionStatus === "unauthenticated") {
    router.push("/login");
    return null;
  }

  // Fetch risk details
  const { data: risk, isLoading: riskLoading, error: riskError } = api.risk.getById.useQuery(
    { id: riskId },
    { enabled: !!riskId }
  );

  // Fetch default matrix template for version ID
  const { data: defaultMatrix } = api.riskMatrix.getDefault.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  // Fetch version details for SLA days (AC4, AC11)
  const { data: versionData } = api.riskMatrix.getVersionForAssessment.useQuery(
    { id: defaultMatrix?.currentVersionId ?? "" },
    {
      enabled: !!defaultMatrix?.currentVersionId,
      staleTime: 5 * 60 * 1000,
    }
  );

  // Create treatment mutation
  const createTreatmentMutation = api.risk.createTreatment.useMutation({
    onSuccess: () => {
      toast.success("Treatment decision recorded successfully");
      router.push(`/risks/${riskId}`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create treatment decision");
    },
  });

  // Get SLA days from severity threshold (AC4, AC11)
  const slaDays = useMemo(() => {
    if (!risk) return null;

    const severityLabel = risk.severity || risk.residualScoreLabel;
    if (!severityLabel) return null;

    // If version data available, use configured SLA days
    if (versionData?.thresholds) {
      const thresholds = versionData.thresholds as Threshold[];
      const threshold = thresholds.find((t) => t.label === severityLabel);
      if (threshold?.slaDays) return threshold.slaDays;
    }

    // Default SLA days based on severity if matrix not configured
    const defaultSlaDays: Record<string, number> = {
      Critical: 7,
      High: 14,
      Medium: 30,
      Low: 90,
      Info: 180,
    };
    return defaultSlaDays[severityLabel] ?? 30;
  }, [risk, versionData]);

  // Calculate due date (AC5, AC12)
  const dueDate = useMemo(() => {
    if (!slaDays) return null;
    const date = new Date();
    date.setDate(date.getDate() + slaDays);
    return date;
  }, [slaDays]);

  // Get matrix scales for residual severity
  const scales = versionData?.scales as MatrixScales | undefined;
  const thresholds = versionData?.thresholds as Threshold[] | undefined;
  const is3DMatrix = (scales?.exposure?.length ?? 0) > 0;

  // Calculate residual score in real-time
  const residualScore = useMemo(() => {
    if (!residualLikelihood || !residualImpact) return null;
    if (is3DMatrix && !residualExposure) return null;
    return is3DMatrix
      ? residualLikelihood * residualImpact * residualExposure!
      : residualLikelihood * residualImpact;
  }, [residualLikelihood, residualImpact, residualExposure, is3DMatrix]);

  // Get residual severity label from score
  const residualSeverity = useMemo(() => {
    if (residualScore === null || !thresholds?.length) return null;
    const threshold = thresholds.find(
      (t) => residualScore >= t.minValue && residualScore < t.maxValue
    );
    if (!threshold) {
      const maxThreshold = thresholds.reduce((max, t) =>
        t.maxValue > max.maxValue ? t : max
      );
      if (residualScore >= maxThreshold.minValue) {
        return { label: maxThreshold.label, color: maxThreshold.color };
      }
    }
    return threshold ? { label: threshold.label, color: threshold.color } : null;
  }, [residualScore, thresholds]);

  // Get selected treatment config
  const selectedTreatment = treatmentTypes.find((t) => t.value === selectedType);

  // Check if form is valid
  const isFormValid = useMemo(() => {
    if (!selectedType) return false;
    if (selectedTreatment?.requiresJustification && !justification.trim()) return false;
    return true;
  }, [selectedType, selectedTreatment, justification]);

  // Handle submit (AC13)
  const handleSubmit = useCallback(() => {
    if (!selectedType || !isFormValid) return;

    createTreatmentMutation.mutate({
      riskId,
      treatmentType: selectedType,
      justification: justification.trim() || `${selectedTreatment?.label} selected`,
      slaDays: slaDays ?? undefined,
      // Treatment action details
      detail: detail.trim() || undefined,
      assignedToId: assignedToId ?? undefined,
      treatmentBusinessUnitId: treatmentBusinessUnitId ?? undefined,
      targetCompletionDate: targetCompletionDate ? new Date(targetCompletionDate) : undefined,
      // Include residual severity if provided
      residualLikelihood: residualLikelihood ?? undefined,
      residualImpact: residualImpact ?? undefined,
      residualExposure: residualExposure ?? undefined,
    });
  }, [riskId, selectedType, justification, slaDays, selectedTreatment, isFormValid, createTreatmentMutation, detail, assignedToId, treatmentBusinessUnitId, targetCompletionDate, residualLikelihood, residualImpact, residualExposure]);

  // Loading state
  if (sessionStatus === "loading" || riskLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Error state
  if (riskError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <AlertTriangle className="h-12 w-12 text-red-500" />
        <p className="text-red-600">{riskError.message}</p>
        <Button variant="outline" onClick={() => router.back()}>
          Go Back
        </Button>
      </div>
    );
  }

  // Not found state
  if (!risk) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <AlertTriangle className="h-12 w-12 text-amber-500" />
        <p className="text-muted-foreground">Risk not found</p>
        <Button variant="outline" onClick={() => router.push("/risks")}>
          Back to Risks
        </Button>
      </div>
    );
  }

  const severityStyle = severityConfig[risk.severity ?? "Medium"] ?? { color: "bg-gray-100 text-gray-800" };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Navigation */}
      <nav className="bg-white dark:bg-gray-900 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between">
            <div className="flex">
              <div className="flex flex-shrink-0 items-center">
                <Link href="/" className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  BetterThanSpreadsheetsGRC
                </Link>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {session?.user?.name} ({session?.user?.role})
              </span>
              <SignOutButton />
            </div>
          </div>
        </div>
      </nav>

      {/* Breadcrumb */}
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Risk
        </Button>
      </div>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 pb-12 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Treatment Decision
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Make a formal treatment decision for this risk
          </p>
        </div>

        {/* Risk Summary Card (AC8) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Risk Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Risk Title</Label>
                <p className="font-medium mt-1">{risk.title}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Severity</Label>
                <div className="mt-1">
                  <Badge className={severityStyle.color}>{risk.severity ?? "Not assessed"}</Badge>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Status</Label>
                <p className="mt-1 capitalize">{risk.status?.toLowerCase().replace("_", " ") ?? "Open"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Owner</Label>
                <p className="mt-1">{risk.ITOwner?.name ?? risk.BusinessOwner?.name ?? "Not assigned"}</p>
              </div>
            </div>
            {risk.description && (
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Description</Label>
                <p className="text-sm mt-1 text-muted-foreground">{risk.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* SLA Information (AC11, AC12) */}
        {slaDays && (
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>
                Based on the <strong>{risk.severity ?? "Medium"}</strong> severity, this risk has a{" "}
                <strong>{slaDays}-day SLA</strong> for treatment.
              </span>
              {dueDate && (
                <span className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4" />
                  Due: {dueDate.toLocaleDateString()}
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Treatment Decision Form (AC9) */}
        <Card>
          <CardHeader>
            <CardTitle>Select Treatment Type</CardTitle>
            <CardDescription>
              Choose how you want to handle this risk. The decision will be tracked and audited.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={selectedType ?? ""}
              onValueChange={(value) => setSelectedType(value as TreatmentType)}
              className="space-y-4"
            >
              {treatmentTypes.map((treatment) => {
                const Icon = treatment.icon;
                const isSelected = selectedType === treatment.value;

                return (
                  <div
                    key={treatment.value}
                    className={cn(
                      "flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-colors",
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-muted-foreground/30"
                    )}
                    onClick={() => setSelectedType(treatment.value)}
                  >
                    <RadioGroupItem value={treatment.value} id={treatment.value} className="mt-1" />
                    <Icon className={cn("h-5 w-5 mt-0.5 shrink-0", treatment.color)} />
                    <div className="flex-1">
                      <Label
                        htmlFor={treatment.value}
                        className="font-medium cursor-pointer flex items-center gap-2"
                      >
                        {treatment.label}
                        {treatment.requiresJustification && (
                          <Badge variant="outline" className="text-xs">
                            Justification Required
                          </Badge>
                        )}
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {treatment.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Justification (AC10) */}
        <Card>
          <CardHeader>
            <CardTitle>
              Justification
              {selectedTreatment?.requiresJustification && (
                <span className="text-red-500 ml-1">*</span>
              )}
            </CardTitle>
            <CardDescription>
              {selectedTreatment?.requiresJustification
                ? "A detailed justification is required for this treatment type."
                : "Optionally provide additional context for your decision."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder={
                selectedType === "ACCEPT"
                  ? "Explain why this risk is being accepted and any compensating controls in place..."
                  : selectedType === "TRANSFER"
                    ? "Describe how the risk will be transferred (e.g., insurance policy, vendor contract)..."
                    : selectedType === "AVOID"
                      ? "Explain how the risk source will be eliminated..."
                      : "Provide any additional context for the treatment decision..."
              }
              rows={4}
              className={cn(
                selectedTreatment?.requiresJustification && !justification.trim() && selectedType
                  ? "border-amber-500"
                  : ""
              )}
            />
            {selectedTreatment?.requiresJustification && !justification.trim() && selectedType && (
              <p className="text-sm text-amber-600 mt-2 flex items-center gap-1">
                <Info className="h-4 w-4" />
                Justification is required for {selectedTreatment.label}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Treatment Action Details */}
        <Card>
          <CardHeader>
            <CardTitle>Treatment Action Details</CardTitle>
            <CardDescription>
              Specify what needs to be done, who is responsible, and when it should be completed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Detail - What needs to be done */}
            <div className="space-y-2">
              <Label htmlFor="detail">What needs to be done?</Label>
              <Textarea
                id="detail"
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder="Describe the specific actions required to address this risk..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Assigned To - Person Picker */}
              <div className="space-y-2">
                <Label>Assigned To</Label>
                <PersonPicker
                  value={assignedToId}
                  onChange={(value) => setAssignedToId(value)}
                  placeholder="Select or create person..."
                />
                <p className="text-xs text-muted-foreground">
                  Person responsible for completing this action
                </p>
              </div>

              {/* Business Unit */}
              <div className="space-y-2">
                <Label>Business Unit</Label>
                <CreatableBusinessUnitPicker
                  value={treatmentBusinessUnitId}
                  onChange={(value) => setTreatmentBusinessUnitId(value)}
                  placeholder="Select business unit..."
                />
                <p className="text-xs text-muted-foreground">
                  Business unit responsible for this treatment
                </p>
              </div>
            </div>

            {/* Target Completion Date */}
            <div className="space-y-2">
              <Label htmlFor="targetDate">Target Completion Date</Label>
              <Input
                id="targetDate"
                type="date"
                value={targetCompletionDate}
                onChange={(e) => setTargetCompletionDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
              />
              <p className="text-xs text-muted-foreground">
                When should this treatment action be completed? (separate from SLA due date)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Expected Residual Severity (optional) */}
        {scales && (
          <Collapsible open={residualExpanded} onOpenChange={setResidualExpanded}>
            <Card>
              <CardHeader className="pb-3">
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-between p-0 h-auto hover:bg-transparent"
                  >
                    <div className="flex items-center gap-2">
                      <TrendingDown className="h-5 w-5 text-green-600" />
                      <div className="text-left">
                        <CardTitle className="text-base">Expected Residual Severity</CardTitle>
                        <CardDescription className="text-sm">
                          Optionally specify the expected severity after treatment is applied
                        </CardDescription>
                      </div>
                    </div>
                    {residualExpanded ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                  </Button>
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Residual Likelihood */}
                    <div className="space-y-2">
                      <Label className="text-sm">Likelihood</Label>
                      <Select
                        value={residualLikelihood?.toString() ?? ""}
                        onValueChange={(v) => setResidualLikelihood(v ? parseFloat(v) : null)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {scales.likelihood.map((level) => (
                            <SelectItem key={level.value} value={level.value.toString()}>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs">{level.value}</span>
                                <span>{level.label}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Residual Impact */}
                    <div className="space-y-2">
                      <Label className="text-sm">Impact</Label>
                      <Select
                        value={residualImpact?.toString() ?? ""}
                        onValueChange={(v) => setResidualImpact(v ? parseFloat(v) : null)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {scales.impact.map((level) => (
                            <SelectItem key={level.value} value={level.value.toString()}>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs">{level.value}</span>
                                <span>{level.label}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Residual Exposure (3D only) */}
                    {is3DMatrix && scales.exposure && (
                      <div className="space-y-2">
                        <Label className="text-sm">Exposure</Label>
                        <Select
                          value={residualExposure?.toString() ?? ""}
                          onValueChange={(v) => setResidualExposure(v ? parseFloat(v) : null)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent>
                            {scales.exposure.map((level) => (
                              <SelectItem key={level.value} value={level.value.toString()}>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs">{level.value}</span>
                                  <span>{level.label}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  {/* Score Display */}
                  {residualScore !== null && residualSeverity && (
                    <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">
                        Expected Residual Score:
                      </div>
                      <Badge
                        style={{ backgroundColor: residualSeverity.color }}
                        className="text-white"
                      >
                        {residualSeverity.label} ({residualScore})
                      </Badge>
                      {risk?.severity && (
                        <div className="text-sm text-muted-foreground">
                          (Current: <strong>{risk.severity}</strong>)
                        </div>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    This represents the expected severity after the treatment is successfully completed.
                    When the treatment is marked complete, these values will be applied to the risk.
                  </p>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}

        {/* Submit Button (AC13) */}
        <div className="flex items-center justify-between pt-4">
          <Button variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isFormValid || createTreatmentMutation.isPending}
            className="min-w-[200px]"
          >
            {createTreatmentMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Submit Decision
              </>
            )}
          </Button>
        </div>

        {/* Due Date Reminder (AC14) */}
        {slaDays && dueDate && selectedType && (
          <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <Calendar className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800 dark:text-blue-200">
              Upon submission, this risk will need to be addressed by{" "}
              <strong>{dueDate.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</strong>{" "}
              ({slaDays} days from today).
            </AlertDescription>
          </Alert>
        )}
      </main>
    </div>
  );
}
