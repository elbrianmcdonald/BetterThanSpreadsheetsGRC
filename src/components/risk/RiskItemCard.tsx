"use client";

/**
 * Risk Item Card Component
 *
 * Collapsible card for individual risk items within a risk assessment.
 * Includes MITRE ATT&CK integration, severity calculators, controls, treatment, and evidence.
 */

import { useState, useMemo, useCallback } from "react";
import { type Control, useWatch } from "react-hook-form";
import { format } from "date-fns";
import {
  ChevronDown,
  ChevronRight,
  Trash2,
  Target,
  Shield,
  Calculator,
  FileCheck,
  Upload,
  Calendar,
  Plus,
  X,
  ExternalLink,
} from "lucide-react";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { MitreTechniquePicker, TechniqueCard, type TechniqueOption } from "./MitreTechniquePicker";
import { CreatableControlPicker } from "@/components/control/CreatableControlPicker";
import { RemediationOptionsEditor } from "./RemediationOptionsEditor";
import { SeverityCalculator } from "./SeverityCalculator";
import type { MatrixScales, Threshold } from "@/lib/matrix";

// ============================================================================
// Types
// ============================================================================

interface RiskItemCardProps {
  index: number;
  control: Control<any>;
  isExpanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
  canRemove: boolean;
  matrixScales: MatrixScales | null;
  matrixThresholds: Threshold[];
  is3DMatrix: boolean;
  /**
   * Story 20.1 follow-up: "finding" renders the same card for capturing a
   * Finding — labels say Finding/Description, the Enterprise Risk picker is
   * replaced by a link-to-register-risks picker (`linkedRiskIds`), and the
   * Treatment (Remediate/Accept) section is omitted because acceptance
   * attaches to the Risk, never the finding.
   */
  variant?: "risk" | "finding";
}

// ============================================================================
// Component
// ============================================================================

export function RiskItemCard({
  index,
  control,
  isExpanded,
  onToggle,
  onRemove,
  canRemove,
  matrixScales,
  matrixThresholds,
  is3DMatrix,
  variant = "risk",
}: RiskItemCardProps) {
  const isFinding = variant === "finding";
  const hideTreatment = isFinding;
  // MITRE picker state
  const [showInitialAccessPicker, setShowInitialAccessPicker] = useState(false);
  const [showThreatStepPicker, setShowThreatStepPicker] = useState(false);
  const [showObjectivePicker, setShowObjectivePicker] = useState(false);

  // Control picker state
  // CreatableControlPicker is always visible inline; reset to null after each
  // selection so it acts like an "Add" picker.
  const [mitigatingPickerValue, setMitigatingPickerValue] = useState<string | null>(null);
  const [gapPickerValue, setGapPickerValue] = useState<string | null>(null);

  // Watch form values for display
  const title = useWatch({ control, name: `risks.${index}.title` });
  const riskStatement = useWatch({ control, name: `risks.${index}.riskStatement` });
  const inherentLikelihood = useWatch({ control, name: `risks.${index}.inherentLikelihood` });
  const inherentImpact = useWatch({ control, name: `risks.${index}.inherentImpact` });
  const inherentExposure = useWatch({ control, name: `risks.${index}.inherentExposure` });
  const treatment = useWatch({ control, name: `risks.${index}.treatment` });
  const residualEliminated = useWatch({ control, name: `risks.${index}.residualEliminated` });

  // Fetch control domain taxonomy for risk category
  const { data: controlDomains } = api.controlDomain.listAll.useQuery();

  // Enterprise risks for the alignment picker (risk variant only)
  const { data: enterpriseRisks } = api.enterpriseRisk.list.useQuery(undefined, {
    enabled: !isFinding,
  });

  // Register risks for the link picker (finding variant only)
  const { data: pickerRisks } = api.risk.listForPicker.useQuery(undefined, {
    enabled: isFinding,
  });

  // Calculate inherent score for display
  const inherentScore = useMemo(() => {
    if (!inherentLikelihood || !inherentImpact) return null;
    if (is3DMatrix && !inherentExposure) return null;
    return is3DMatrix
      ? inherentLikelihood * inherentImpact * inherentExposure!
      : inherentLikelihood * inherentImpact;
  }, [inherentLikelihood, inherentImpact, inherentExposure, is3DMatrix]);

  // Get severity label from score
  const getSeverityLabel = useCallback(
    (score: number | null): { label: string; color: string } | null => {
      if (score === null || !matrixThresholds.length) return null;
      const threshold = matrixThresholds.find(
        (t) => score >= t.minValue && score < t.maxValue
      );
      return threshold ? { label: threshold.label, color: threshold.color } : null;
    },
    [matrixThresholds]
  );

  const inherentSeverity = getSeverityLabel(inherentScore);

  // Truncate risk statement for collapsed view
  const truncatedStatement = useMemo(() => {
    if (!riskStatement) return isFinding ? "No description" : "No risk statement";
    return riskStatement.length > 80
      ? riskStatement.substring(0, 80) + "..."
      : riskStatement;
  }, [riskStatement, isFinding]);

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <Card className={cn("transition-all", isExpanded && "ring-2 ring-primary/20")}>
        {/* Collapsed Header */}
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">
                      {isFinding ? "Finding" : `Risk ${index + 1}`}
                      {title ? `: ${title}` : ""}
                    </span>
                    {inherentSeverity && (
                      <Badge
                        style={{ backgroundColor: inherentSeverity.color }}
                        className="text-white text-xs"
                      >
                        {inherentSeverity.label}
                      </Badge>
                    )}
                    {residualEliminated && (
                      <Badge className="bg-emerald-600 text-white text-xs">
                        Eliminated
                      </Badge>
                    )}
                    {treatment && (
                      <Badge variant="outline" className="text-xs">
                        {treatment === "ACCEPT" ? "Accept" : "Remediate"}
                      </Badge>
                    )}
                  </div>
                  {!isExpanded && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {truncatedStatement}
                    </p>
                  )}
                </div>
              </div>
              {canRemove && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove();
                  }}
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        {/* Expanded Content */}
        <CollapsibleContent>
          <CardContent className="space-y-6 pt-0">
            <Separator />

            {/* Title + Category */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              <FormField
                control={control}
                name={`risks.${index}.title`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{isFinding ? "Finding Title *" : "Risk Title *"}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={
                          isFinding
                            ? "Short, specific finding label..."
                            : "Short, specific risk label..."
                        }
                        maxLength={200}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name={`risks.${index}.controlDomainId`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{isFinding ? "Finding Category" : "Risk Category"}</FormLabel>
                    <Select
                      value={field.value ?? "__none__"}
                      onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">Uncategorized</SelectItem>
                        {(controlDomains ?? [])
                          .filter((d) => d.isActive)
                          .map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Aligned to the taxonomy managed in Administration → Taxonomy.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Risk Statement / Description */}
            <FormField
              control={control}
              name={`risks.${index}.riskStatement`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{isFinding ? "Description *" : "Risk Statement *"}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={
                        isFinding
                          ? "Describe the finding in detail. Include what was observed, why it matters, and the potential consequences..."
                          : "Describe the risk in detail. Include what could happen, why it matters, and the potential consequences..."
                      }
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isFinding ? (
              /* Link to register risks (RiskFindingLink M:N) — replaces the
                 Enterprise Risk picker on the finding variant. */
              <FormField
                control={control}
                name={`risks.${index}.linkedRiskIds`}
                render={({ field }) => {
                  const ids: string[] = field.value ?? [];
                  const available = (pickerRisks ?? []).filter((r) => !ids.includes(r.id));
                  return (
                    <FormItem>
                      <FormLabel>Linked Risks</FormLabel>
                      <FormDescription>
                        Link this finding to one or more risks from the risk register.
                      </FormDescription>
                      <div className="space-y-2">
                        {ids.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {ids.map((riskId) => {
                              const risk = pickerRisks?.find((r) => r.id === riskId);
                              return (
                                <Badge key={riskId} variant="secondary" className="gap-1 pr-1">
                                  <span>
                                    {risk ? `${risk.identifier ?? ""} ${risk.title}`.trim() : riskId}
                                  </span>
                                  <button
                                    type="button"
                                    aria-label="Remove linked risk"
                                    className="ml-1 rounded-sm hover:bg-muted p-0.5"
                                    onClick={() =>
                                      field.onChange(ids.filter((id) => id !== riskId))
                                    }
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </Badge>
                              );
                            })}
                          </div>
                        )}
                        <Select
                          value="__placeholder__"
                          onValueChange={(v) => {
                            if (v !== "__placeholder__") field.onChange([...ids, v]);
                          }}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Link a risk..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="__placeholder__" className="hidden">
                              Link a risk...
                            </SelectItem>
                            {available.length === 0 ? (
                              <SelectItem value="__empty__" disabled>
                                No more risks to link
                              </SelectItem>
                            ) : (
                              available.map((r) => (
                                <SelectItem key={r.id} value={r.id}>
                                  {r.identifier ? `${r.identifier} — ` : ""}
                                  {r.title}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            ) : (
              /* Enterprise Risk alignment (risk variant) */
              <FormField
                control={control}
                name={`risks.${index}.enterpriseRiskId`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Enterprise Risk</FormLabel>
                    <Select
                      value={field.value ?? "__none__"}
                      onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Not aligned to an enterprise risk" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">Not aligned</SelectItem>
                        {enterpriseRisks?.map((er) => (
                          <SelectItem key={er.id} value={er.id}>
                            {er.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Optional roll-up parent. Used for executive-level reporting.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* MITRE ATT&CK Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-red-500" />
                <h4 className="font-medium">MITRE ATT&CK Mapping</h4>
              </div>

              {/* Initial Access Vector (single) */}
              <FormField
                control={control}
                name={`risks.${index}.initialAccessVectorId`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Initial Access Vector</FormLabel>
                    <FormDescription>
                      How would a threat actor initially gain access?
                    </FormDescription>
                    <div className="space-y-2">
                      {field.value ? (
                        <InitialAccessDisplay
                          techniqueId={field.value}
                          onRemove={() => field.onChange(null)}
                        />
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setShowInitialAccessPicker(true)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Select Initial Access Technique
                        </Button>
                      )}
                      <MitreTechniquePicker
                        open={showInitialAccessPicker}
                        onOpenChange={setShowInitialAccessPicker}
                        onSelect={(technique) => field.onChange(technique.id)}
                        tacticFilter={["initial-access"]}
                        title="Select Initial Access Technique"
                        description="Choose how the threat actor would initially gain access"
                      />
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Threat Actor Steps (multiple) */}
              <FormField
                control={control}
                name={`risks.${index}.threatStepIds`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Threat Actor Steps</FormLabel>
                    <FormDescription>
                      What techniques might be used during the attack?
                    </FormDescription>
                    <div className="space-y-2">
                      {field.value?.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {field.value.map((id: string) => (
                            <TechniqueDisplay
                              key={id}
                              techniqueId={id}
                              onRemove={() =>
                                field.onChange(field.value.filter((v: string) => v !== id))
                              }
                            />
                          ))}
                        </div>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowThreatStepPicker(true)}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Technique
                      </Button>
                      <MitreTechniquePicker
                        open={showThreatStepPicker}
                        onOpenChange={setShowThreatStepPicker}
                        onSelect={(technique) =>
                          field.onChange([...(field.value || []), technique.id])
                        }
                        excludeIds={field.value || []}
                        title="Select Threat Actor Technique"
                        description="Choose techniques the threat actor might use"
                      />
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Threat Actor Objectives (multiple) */}
              <FormField
                control={control}
                name={`risks.${index}.threatObjectiveIds`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Threat Actor Objectives</FormLabel>
                    <FormDescription>
                      What is the threat actor trying to achieve?
                    </FormDescription>
                    <div className="space-y-2">
                      {field.value?.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {field.value.map((id: string) => (
                            <TechniqueDisplay
                              key={id}
                              techniqueId={id}
                              onRemove={() =>
                                field.onChange(field.value.filter((v: string) => v !== id))
                              }
                            />
                          ))}
                        </div>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowObjectivePicker(true)}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Objective
                      </Button>
                      <MitreTechniquePicker
                        open={showObjectivePicker}
                        onOpenChange={setShowObjectivePicker}
                        onSelect={(technique) =>
                          field.onChange([...(field.value || []), technique.id])
                        }
                        excludeIds={field.value || []}
                        tacticFilter={["impact", "exfiltration", "collection"]}
                        title="Select Threat Actor Objective"
                        description="Choose the objectives or goals of the threat actor"
                      />
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Controls Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-blue-500" />
                <h4 className="font-medium">Controls</h4>
              </div>

              {/* Mitigating Controls (controls in place) — org controls from /controls */}
              <FormField
                control={control}
                name={`risks.${index}.mitigatingControlIds`}
                render={({ field }) => {
                  const ids: string[] = field.value ?? [];
                  return (
                    <FormItem>
                      <FormLabel>Mitigating Controls</FormLabel>
                      <FormDescription>
                        Controls currently in place that reduce this risk. Pulls from the
                        organizational control library at /controls.
                      </FormDescription>
                      <div className="space-y-2">
                        {ids.length > 0 && (
                          <div className="space-y-2">
                            {ids.map((controlId) => (
                              <OrgControlChip
                                key={controlId}
                                controlId={controlId}
                                onRemove={() =>
                                  field.onChange(ids.filter((id) => id !== controlId))
                                }
                              />
                            ))}
                          </div>
                        )}
                        <CreatableControlPicker
                          value={mitigatingPickerValue}
                          onChange={(value) => {
                            if (value) {
                              field.onChange([...ids, value]);
                              setMitigatingPickerValue(null);
                            }
                          }}
                          excludeIds={ids}
                          placeholder="Add mitigating control..."
                        />
                      </div>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              {/* Control Gaps (controls needed) — also org controls */}
              <FormField
                control={control}
                name={`risks.${index}.controlGapIds`}
                render={({ field }) => {
                  const ids: string[] = field.value ?? [];
                  return (
                    <FormItem>
                      <FormLabel>Control Gaps</FormLabel>
                      <FormDescription>
                        Controls that are missing or insufficient and need to be implemented
                      </FormDescription>
                      <div className="space-y-2">
                        {ids.length > 0 && (
                          <div className="space-y-2">
                            {ids.map((controlId) => (
                              <OrgControlChip
                                key={controlId}
                                controlId={controlId}
                                onRemove={() =>
                                  field.onChange(ids.filter((id) => id !== controlId))
                                }
                              />
                            ))}
                          </div>
                        )}
                        <CreatableControlPicker
                          value={gapPickerValue}
                          onChange={(value) => {
                            if (value) {
                              field.onChange([...ids, value]);
                              setGapPickerValue(null);
                            }
                          }}
                          excludeIds={ids}
                          placeholder="Add control gap..."
                        />
                      </div>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            </div>

            <Separator />

            {/* Severity Scoring Section */}
            <div className="space-y-4">
              {/* Header row: the "eliminated" toggle sits inline with the
                  section heading so the inherent and residual calculators
                  start at the same height (no column offset). */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-purple-500" />
                  <h4 className="font-medium">Severity Scoring</h4>
                </div>
                <FormField
                  control={control}
                  name={`risks.${index}.residualEliminated`}
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={field.value ?? false}
                          onChange={(e) => field.onChange(e.target.checked)}
                        />
                      </FormControl>
                      <FormLabel
                        className="cursor-pointer font-normal text-sm text-muted-foreground"
                        title={
                          isFinding
                            ? "Controls fully remove this finding — no residual score required."
                            : "Controls fully remove this risk — no residual score required."
                        }
                      >
                        {isFinding
                          ? "Finding eliminated"
                          : "Risk eliminated — controls fully remove this risk"}
                      </FormLabel>
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Inherent Severity */}
                <SeverityCalculator
                  title="Inherent Severity"
                  description="Risk severity before controls are applied"
                  control={control}
                  likelihoodName={`risks.${index}.inherentLikelihood`}
                  impactName={`risks.${index}.inherentImpact`}
                  exposureName={`risks.${index}.inherentExposure`}
                  scales={matrixScales}
                  thresholds={matrixThresholds}
                  is3DMatrix={is3DMatrix}
                />

                {/* Residual Severity */}
                {residualEliminated ? (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 self-start">
                    Residual severity is marked <strong>Eliminated</strong>. Likelihood,
                    impact, and exposure fields are disabled.
                  </div>
                ) : (
                  <SeverityCalculator
                    title="Residual Severity"
                    description="Risk severity after controls are applied"
                    control={control}
                    likelihoodName={`risks.${index}.residualLikelihood`}
                    impactName={`risks.${index}.residualImpact`}
                    exposureName={`risks.${index}.residualExposure`}
                    scales={matrixScales}
                    thresholds={matrixThresholds}
                    is3DMatrix={is3DMatrix}
                  />
                )}
              </div>
            </div>

            <Separator />

            {/* Remediation Options Section — per-risk options, stored in
                RemediationOption and linked by riskId. */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-indigo-500" />
                <h4 className="font-medium">Remediation Options</h4>
              </div>
              <p className="text-xs text-muted-foreground">
                {isFinding
                  ? "Document the treatment alternatives evaluated for this finding. Each option is saved against the finding and available on its detail page."
                  : "Document the treatment alternatives evaluated for this specific risk. Each option is saved against the risk and available on its detail page."}
              </p>
              <RemediationOptionsEditor control={control} index={index} />
            </div>

            {!hideTreatment && (
              <>
            <Separator />

            {/* Treatment Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-green-500" />
                <h4 className="font-medium">Treatment</h4>
              </div>

              {/* Treatment toggle */}
              <FormField
                control={control}
                name={`risks.${index}.treatment`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Treatment Decision</FormLabel>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={field.value === "REMEDIATE" ? "default" : "outline"}
                        size="sm"
                        onClick={() => field.onChange("REMEDIATE")}
                      >
                        Remediate
                      </Button>
                      <Button
                        type="button"
                        variant={field.value === "ACCEPT" ? "default" : "outline"}
                        size="sm"
                        onClick={() => field.onChange("ACCEPT")}
                      >
                        Accept
                      </Button>
                      {field.value && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => field.onChange(null)}
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                    <FormDescription>
                      Switching between Remediate and Accept preserves data on
                      both forms — only the active form&apos;s fields render.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Remediate fields */}
              {treatment === "REMEDIATE" && (
                <div className="space-y-4 border-l-2 border-green-500/30 pl-4">
                  <FormField
                    control={control}
                    name={`risks.${index}.treatmentDueDate`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Treatment Due Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "PPP")
                                ) : (
                                  <span>Select due date</span>
                                )}
                                <Calendar className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={field.value ?? undefined}
                              onSelect={field.onChange}
                              disabled={(date) => date < new Date()}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={control}
                    name={`risks.${index}.treatmentPlan`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Treatment Plan</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe the treatment plan, including specific actions to be taken, responsible parties, and expected outcomes..."
                            className="min-h-[100px]"
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value || null)}
                          />
                        </FormControl>
                        <FormDescription>
                          Detail the steps required to address this risk.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Accept fields */}
              {treatment === "ACCEPT" && (
                <div className="space-y-4 border-l-2 border-blue-500/30 pl-4">
                  <FormField
                    control={control}
                    name={`risks.${index}.acceptanceJustification`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Justification *</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Why is this risk being formally accepted? Reference business context, cost/benefit, or compensating posture..."
                            className="min-h-[100px]"
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value || null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={control}
                    name={`risks.${index}.acceptanceReviewDate`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Review / Expiration Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "PPP")
                                ) : (
                                  <span>Select review date</span>
                                )}
                                <Calendar className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={field.value ?? undefined}
                              onSelect={field.onChange}
                              disabled={(date) => date < new Date()}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormDescription>
                          When does this acceptance need to be re-reviewed?
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={control}
                    name={`risks.${index}.acceptanceCompensatingControls`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Compensating Controls (optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Any controls that mitigate residual exposure even though the risk is accepted..."
                            className="min-h-[80px]"
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value || null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>
              </>
            )}

            <Separator />

            {/* Evidence Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-amber-500" />
                <h4 className="font-medium">Evidence</h4>
              </div>
              <FormField
                control={control}
                name={`risks.${index}.evidenceIds`}
                render={({ field }) => (
                  <FormItem>
                    <FormDescription>
                      Evidence files will be uploaded after the assessment is created.
                    </FormDescription>
                    <div className="border-2 border-dashed rounded-lg p-6 text-center text-muted-foreground">
                      <Upload className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">
                        Evidence upload will be available after creating the assessment
                      </p>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

function InitialAccessDisplay({
  techniqueId,
  onRemove,
}: {
  techniqueId: string;
  onRemove: () => void;
}) {
  // Fetch technique details to display name
  const { data: technique, isLoading } = api.mitre.getTechniqueById.useQuery(
    { id: techniqueId },
    { enabled: !!techniqueId }
  );

  return (
    <div className="flex items-center gap-2 p-2 rounded-md border bg-card">
      {isLoading ? (
        <span className="text-sm text-muted-foreground">Loading...</span>
      ) : technique ? (
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">{technique.externalId}</span>
          <span className="text-sm font-medium">{technique.name}</span>
        </div>
      ) : (
        <span className="font-mono text-sm text-primary">{techniqueId}</span>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 ml-auto"
        onClick={onRemove}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function TechniqueDisplay({
  techniqueId,
  onRemove,
}: {
  techniqueId: string;
  onRemove: () => void;
}) {
  // Fetch technique details to display name
  const { data: technique, isLoading } = api.mitre.getTechniqueById.useQuery(
    { id: techniqueId },
    { enabled: !!techniqueId }
  );

  return (
    <Badge variant="secondary" className="flex items-center gap-1 pr-1">
      {isLoading ? (
        <span className="text-xs">...</span>
      ) : technique ? (
        <>
          <span className="font-mono text-xs text-muted-foreground">{technique.externalId}</span>
          <span className="text-xs">{technique.name}</span>
        </>
      ) : (
        <span className="font-mono text-xs">{techniqueId}</span>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-4 w-4 hover:bg-destructive/20"
        onClick={onRemove}
      >
        <X className="h-3 w-3" />
      </Button>
    </Badge>
  );
}

/**
 * Inline chip that resolves an OrganizationalControl id to its local ID + name.
 * Uses the shared list endpoint (tRPC dedupes the call across siblings).
 */
function OrgControlChip({ controlId, onRemove }: { controlId: string; onRemove: () => void }) {
  const { data } = api.organizationalControl.list.useQuery({ limit: 100 });
  const ctrl = data?.controls.find((c) => c.id === controlId);
  return (
    <div className="flex items-center justify-between gap-2 p-2 rounded-md border bg-card">
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-mono text-sm font-medium text-blue-700 shrink-0">
          {ctrl?.localControlId ?? controlId.slice(0, 8)}
        </span>
        <span className="text-sm truncate">{ctrl?.name ?? "…"}</span>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        onClick={onRemove}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
