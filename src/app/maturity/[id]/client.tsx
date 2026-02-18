"use client";

/**
 * Maturity Assessment Detail Client Component
 *
 * Provides the full assessment detail UI with:
 * - Assessment header with metadata
 * - Domain scoring cards with tier selection
 * - Overall score sidebar with progress
 * - Action buttons for workflow transitions
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Loader2,
  ChevronDown,
  ChevronRight,
  Gauge,
  Target,
  Calendar,
  User,
  Edit,
  Trash2,
  Camera,
  Send,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  Info,
  Square,
  CheckSquare,
  HelpCircle,
  TrendingUp,
} from "lucide-react";
import {
  MaturityFrameworkType,
  MaturityAssessmentStatus,
  AssessmentDepth,
  AssessmentMode,
  UserRole,
} from "@prisma/client";

import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from "recharts";
import { SammChecklist } from "@/components/maturity/samm-checklist";

// =============================================================================
// Types
// =============================================================================

interface ScoringLevel {
  value: number;
  label: string;
  description: string;
  criteria?: string[];
}

// =============================================================================
// Constants
// =============================================================================

const STATUS_CONFIG: Record<
  MaturityAssessmentStatus,
  { label: string; color: string; icon: typeof Clock }
> = {
  DRAFT: { label: "Draft", color: "bg-gray-100 text-gray-700", icon: FileText },
  IN_PROGRESS: { label: "In Progress", color: "bg-blue-100 text-blue-700", icon: Clock },
  IN_REVIEW: { label: "In Review", color: "bg-amber-100 text-amber-700", icon: AlertCircle },
  COMPLETED: { label: "Completed", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  ARCHIVED: { label: "Archived", color: "bg-slate-100 text-slate-700", icon: FileText },
};

const FRAMEWORK_LABELS: Record<MaturityFrameworkType, string> = {
  NIST_CSF_2: "NIST CSF 2.0",
  C2M2: "C2M2",
  OWASP_SAMM: "OWASP SAMM",
};

const DEPTH_LABELS: Record<AssessmentDepth, string> = {
  FUNCTION: "Function Level",
  CATEGORY: "Category Level",
  SUBCATEGORY: "Subcategory Level",
};

const MODE_LABELS: Record<AssessmentMode, string> = {
  SELF: "Self-Assessment",
  GUIDED: "Guided Wizard",
  HYBRID: "Hybrid",
};

/**
 * Implementation level options for C2M2 practices
 * Fully/Largely = pass (counts toward MIL achievement)
 * Partially/Not = fail (doesn't count)
 */
const IMPLEMENTATION_LEVELS = [
  {
    value: 3,
    label: "Fully Implemented",
    shortLabel: "Fully",
    color: "bg-green-100 text-green-700 border-green-200",
    isPass: true,
    description: "Practice is fully implemented across the organization"
  },
  {
    value: 2,
    label: "Largely Implemented",
    shortLabel: "Largely",
    color: "bg-lime-100 text-lime-700 border-lime-200",
    isPass: true,
    description: "Practice is mostly implemented with minor gaps"
  },
  {
    value: 1,
    label: "Partially Implemented",
    shortLabel: "Partially",
    color: "bg-amber-100 text-amber-700 border-amber-200",
    isPass: false,
    description: "Practice is partially implemented with significant gaps"
  },
  {
    value: 0,
    label: "Not Implemented",
    shortLabel: "Not",
    color: "bg-red-100 text-red-700 border-red-200",
    isPass: false,
    description: "Practice is not implemented or ad hoc only"
  },
] as const;

const CONFIDENCE_OPTIONS = [
  { value: "LOW", label: "Low", color: "bg-red-100 text-red-700" },
  { value: "MEDIUM", label: "Medium", color: "bg-amber-100 text-amber-700" },
  { value: "HIGH", label: "High", color: "bg-green-100 text-green-700" },
];

const CAN_MANAGE_ROLES: UserRole[] = [
  UserRole.CISO,
  UserRole.GRC_ANALYST,
  UserRole.ORG_ADMIN,
];

// =============================================================================
// Helper Functions
// =============================================================================

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getTierColorClass(level: number | null | undefined, maxLevel: number): string {
  if (level === null || level === undefined) return "bg-gray-100 text-gray-600";
  const ratio = level / maxLevel;
  if (ratio <= 0.25) return "bg-red-100 text-red-700";
  if (ratio <= 0.5) return "bg-amber-100 text-amber-700";
  if (ratio <= 0.75) return "bg-blue-100 text-blue-700";
  return "bg-green-100 text-green-700";
}

// =============================================================================
// Sub-Components
// =============================================================================

/**
 * Get the level prefix based on framework type
 */
function getLevelPrefix(frameworkType: MaturityFrameworkType): string {
  switch (frameworkType) {
    case "C2M2":
      return ""; // C2M2 uses "MIL0", "MIL1" etc in label
    case "OWASP_SAMM":
      return "Level ";
    case "NIST_CSF_2":
    default:
      return "Tier ";
  }
}

/**
 * Get the overall score label based on framework type
 */
function getScoreTypeLabel(frameworkType: MaturityFrameworkType): string {
  switch (frameworkType) {
    case "C2M2":
      return "Maturity Indicator Level";
    case "OWASP_SAMM":
      return "Maturity Level";
    case "NIST_CSF_2":
    default:
      return "Implementation Tier";
  }
}

/**
 * Tier Badge - Displays a maturity tier level
 */
function TierBadge({
  level,
  levels,
  maxLevel,
  frameworkType,
}: {
  level: number | null | undefined;
  levels: ScoringLevel[];
  maxLevel: number;
  frameworkType: MaturityFrameworkType;
}) {
  if (level === null || level === undefined) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Not Assessed
      </Badge>
    );
  }

  const levelInfo = levels.find((l) => l.value === level);
  const prefix = getLevelPrefix(frameworkType);
  return (
    <Badge className={getTierColorClass(level, maxLevel)}>
      {prefix}{level}: {levelInfo?.label || "Unknown"}
    </Badge>
  );
}

/**
 * Tier Selector - Horizontal button group for selecting tier
 */
function TierSelector({
  label,
  value,
  onChange,
  levels,
  disabled,
  frameworkType,
}: {
  label: string;
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  levels: ScoringLevel[];
  disabled?: boolean;
  frameworkType: MaturityFrameworkType;
}) {
  const prefix = getLevelPrefix(frameworkType);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {value !== null && value !== undefined && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs text-muted-foreground"
            onClick={() => onChange(null)}
            disabled={disabled}
          >
            Clear
          </Button>
        )}
      </div>
      <div className="flex gap-2">
        {levels.map((level) => (
          <TooltipProvider key={level.value}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={value === level.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => onChange(level.value)}
                  disabled={disabled}
                  className={cn(
                    "flex-1 flex-col h-auto py-2",
                    value === level.value && "ring-2 ring-primary ring-offset-2"
                  )}
                >
                  <span className="font-bold">{prefix}{level.value}</span>
                  <span className="text-xs opacity-80">{level.label}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent className="max-w-sm">
                <p className="font-medium mb-1">{level.label}</p>
                <p className="text-sm text-muted-foreground">{level.description}</p>
                {level.criteria && level.criteria.length > 0 && (
                  <ul className="mt-2 text-xs space-y-1">
                    {level.criteria.map((c, i) => (
                      <li key={i} className="flex items-start gap-1">
                        <span className="text-primary">•</span>
                        {c}
                      </li>
                    ))}
                  </ul>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </div>
    </div>
  );
}

/**
 * Confidence Selector - Radio-style buttons for confidence level
 */
function ConfidenceSelector({
  value,
  onChange,
  disabled,
}: {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>Confidence Level</Label>
      <div className="flex gap-2">
        {CONFIDENCE_OPTIONS.map((option) => (
          <Button
            key={option.value}
            variant={value === option.value ? "default" : "outline"}
            size="sm"
            onClick={() => onChange(value === option.value ? null : option.value)}
            disabled={disabled}
            className="flex-1"
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

/**
 * Domain Score Card - Expandable card for scoring a single domain
 */
function DomainScoreCard({
  domain,
  score,
  levels,
  maxLevel,
  assessmentId,
  onSave,
  isSaving,
  isExpanded,
  onToggle,
  frameworkType,
}: {
  domain: { id: string; code: string; name: string; description: string | null };
  score?: {
    currentLevel: number | null;
    targetLevel: number | null;
    confidence: string | null;
    notes: string | null;
  };
  levels: ScoringLevel[];
  maxLevel: number;
  assessmentId: string;
  onSave: (data: {
    domainId: string;
    currentLevel: number | null;
    targetLevel: number | null;
    confidence: string | null;
    notes: string | null;
  }) => void;
  isSaving: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  frameworkType: MaturityFrameworkType;
}) {
  const [currentLevel, setCurrentLevel] = useState<number | null>(score?.currentLevel ?? null);
  const [targetLevel, setTargetLevel] = useState<number | null>(score?.targetLevel ?? null);
  const [confidence, setConfidence] = useState<string | null>(score?.confidence ?? null);
  const [notes, setNotes] = useState(score?.notes || "");
  const [hasChanges, setHasChanges] = useState(false);

  // Update local state when score changes from server
  useEffect(() => {
    setCurrentLevel(score?.currentLevel ?? null);
    setTargetLevel(score?.targetLevel ?? null);
    setConfidence(score?.confidence ?? null);
    setNotes(score?.notes || "");
    setHasChanges(false);
  }, [score]);

  const handleChange = () => {
    setHasChanges(true);
  };

  const handleSave = () => {
    onSave({
      domainId: domain.id,
      currentLevel,
      targetLevel,
      confidence,
      notes: notes.trim() || null,
    });
    setHasChanges(false);
  };

  const gap = targetLevel !== null && currentLevel !== null
    ? targetLevel - currentLevel
    : null;

  return (
    <Card
      className={cn(
        "transition-all duration-200",
        isExpanded && "ring-2 ring-primary shadow-md",
        score?.currentLevel !== null && score?.currentLevel !== undefined && !isExpanded && "border-l-4 border-l-primary"
      )}
    >
      <CardHeader
        className="cursor-pointer select-none"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isExpanded ? (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            )}
            <Badge variant="outline" className="font-mono">
              {domain.code}
            </Badge>
            <span className="font-medium">{domain.name}</span>
          </div>
          <div className="flex items-center gap-2">
            {gap !== null && gap > 0 && (
              <Badge variant="outline" className="text-amber-600 border-amber-300">
                Gap: +{gap}
              </Badge>
            )}
            <TierBadge level={currentLevel} levels={levels} maxLevel={maxLevel} frameworkType={frameworkType} />
          </div>
        </div>
        {!isExpanded && domain.description && (
          <p className="text-sm text-muted-foreground ml-11 line-clamp-1">
            {domain.description}
          </p>
        )}
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-6 pt-0">
          {domain.description && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{domain.description}</p>
              </div>
            </div>
          )}

          <TierSelector
            label="Current Level"
            value={currentLevel}
            onChange={(v) => {
              setCurrentLevel(v);
              handleChange();
            }}
            levels={levels}
            disabled={isSaving}
            frameworkType={frameworkType}
          />

          <TierSelector
            label="Target Level"
            value={targetLevel}
            onChange={(v) => {
              setTargetLevel(v);
              handleChange();
            }}
            levels={levels}
            disabled={isSaving}
            frameworkType={frameworkType}
          />

          <ConfidenceSelector
            value={confidence}
            onChange={(v) => {
              setConfidence(v);
              handleChange();
            }}
            disabled={isSaving}
          />

          <div className="space-y-2">
            <Label>Assessment Notes</Label>
            <Textarea
              placeholder="Document your assessment rationale, evidence references, or improvement recommendations..."
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                handleChange();
              }}
              disabled={isSaving}
              className="min-h-[100px]"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-muted-foreground">
              {hasChanges ? "Unsaved changes" : "All changes saved"}
            </p>
            <Button
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Score"
              )}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

/**
 * Practice Checklist Component - For C2M2 practice-level assessment
 * Shows practices grouped by capability level with checkboxes
 */
function PracticeChecklist({
  assessmentId,
  domain,
  levels,
  maxLevel,
  isExpanded,
  onToggle,
  frameworkType = "C2M2",
  targetLevel = null,
  onTargetLevelChange,
  isSavingTarget = false,
}: {
  assessmentId: string;
  domain: { id: string; code: string; name: string; description: string | null };
  levels: ScoringLevel[];
  maxLevel: number;
  isExpanded: boolean;
  onToggle: () => void;
  frameworkType?: MaturityFrameworkType;
  targetLevel?: number | null;
  onTargetLevelChange?: (targetLevel: number | null) => void;
  isSavingTarget?: boolean;
}) {
  // Get labels based on framework type
  const levelPrefix = "MIL";
  const levelLabel = "Achieved MIL";
  const [expandedMil, setExpandedMil] = useState<number | null>(1);
  const utils = api.useUtils();

  // Fetch practices for this domain
  const { data: practiceData, isLoading } = api.maturity.getDomainPractices.useQuery(
    { assessmentId, domainId: domain.id },
    { enabled: isExpanded }
  );

  // Mutation to save practice response
  const savePracticeMutation = api.maturity.savePracticeResponse.useMutation({
    onSuccess: () => {
      void utils.maturity.getDomainPractices.invalidate({ assessmentId, domainId: domain.id });
      void utils.maturity.getById.invalidate({ id: assessmentId });
    },
    onError: (error) => {
      toast.error(`Failed to save: ${error.message}`);
    },
  });

  const handlePracticeUpdate = (
    practiceId: string,
    implementationLevel: number,
    notes?: string | null
  ) => {
    savePracticeMutation.mutate({
      assessmentId,
      practiceId,
      implementationLevel,
      notes,
    });
  };

  const achievedMIL = practiceData?.achievedMIL ?? 0;
  const levelInfo = levels.find((l) => l.value === achievedMIL);

  // Calculate completion stats per MIL level
  const getMilStats = (milLevel: number) => {
    const practices = practiceData?.practices[milLevel] ?? [];
    const completed = practices.filter((p) => p.isPerformed).length;
    return { total: practices.length, completed };
  };

  return (
    <Card
      className={cn(
        "transition-all duration-200",
        isExpanded && "ring-2 ring-primary shadow-md",
        achievedMIL > 0 && !isExpanded && "border-l-4 border-l-primary"
      )}
    >
      <CardHeader
        className="cursor-pointer select-none"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isExpanded ? (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            )}
            <Badge variant="outline" className="font-mono">
              {domain.code}
            </Badge>
            <span className="font-medium">{domain.name}</span>
          </div>
          <div className="flex items-center gap-2">
            {practiceData && (
              <span className="text-sm text-muted-foreground">
                {practiceData.completedPractices}/{practiceData.totalPractices} practices
              </span>
            )}
            {targetLevel !== null && targetLevel !== undefined && achievedMIL < targetLevel && (
              <Badge variant="outline" className="text-amber-600 border-amber-300">
                Gap: +{targetLevel - achievedMIL}
              </Badge>
            )}
            <TierBadge
              level={achievedMIL}
              levels={levels}
              maxLevel={maxLevel}
              frameworkType={frameworkType}
            />
          </div>
        </div>
        {!isExpanded && domain.description && (
          <p className="text-sm text-muted-foreground ml-11 line-clamp-1">
            {domain.description}
          </p>
        )}
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4 pt-0">
          {domain.description && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{domain.description}</p>
              </div>
            </div>
          )}

          {/* Current Level & Target Level Status */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{levelLabel}</p>
                  <p className="text-xs text-muted-foreground">Based on practice completion</p>
                </div>
                <div className="text-right">
                  <div className={cn(
                    "inline-flex items-center justify-center px-4 py-2 rounded-lg font-bold",
                    getTierColorClass(achievedMIL, maxLevel)
                  )}>
                    {levelPrefix}{achievedMIL}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{levelInfo?.label}</p>
                </div>
              </div>
            </div>

            {/* Target MIL Selector */}
            <div className="p-4 bg-muted/30 rounded-lg border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Target MIL</p>
                  <p className="text-xs text-muted-foreground">Set your target maturity level</p>
                </div>
                <Select
                  value={targetLevel !== null && targetLevel !== undefined ? String(targetLevel) : "none"}
                  onValueChange={(value) => {
                    onTargetLevelChange?.(value === "none" ? null : parseInt(value));
                  }}
                  disabled={isSavingTarget}
                >
                  <SelectTrigger className="w-[120px] h-9">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not Set</SelectItem>
                    {levels.filter((l) => l.value > 0).map((level) => (
                      <SelectItem key={level.value} value={String(level.value)}>
                        {levelPrefix}{level.value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Loading state */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            /* Practice lists by capability level */
            <div className="space-y-3">
              {[1, 2, 3].map((capLevel) => {
                const practices = practiceData?.practices[capLevel] ?? [];
                if (practices.length === 0) return null;

                const stats = getMilStats(capLevel);
                const isComplete = stats.completed === stats.total;
                const canAchieve = capLevel === 1 ||
                  (capLevel === 2 && achievedMIL >= 1) ||
                  (capLevel === 3 && achievedMIL >= 2);

                return (
                  <Collapsible
                    key={capLevel}
                    open={expandedMil === capLevel}
                    onOpenChange={(open) => setExpandedMil(open ? capLevel : null)}
                  >
                    <CollapsibleTrigger asChild>
                      <div className={cn(
                        "flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors",
                        isComplete && "bg-green-50 border-green-200",
                        !canAchieve && "opacity-60"
                      )}>
                        <div className="flex items-center gap-3">
                          {expandedMil === capLevel ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <Badge variant={isComplete ? "default" : "outline"} className={cn(
                            isComplete && "bg-green-600"
                          )}>
                            {levelPrefix}{capLevel}
                          </Badge>
                          <span className="text-sm font-medium">
                            {levels.find(l => l.value === capLevel)?.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {isComplete ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              {stats.completed}/{stats.total}
                            </span>
                          )}
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-2 ml-4 space-y-3 border-l-2 pl-4">
                        {practices.map((practice) => {
                          const implLevel = IMPLEMENTATION_LEVELS.find(
                            (l) => l.value === practice.implementationLevel
                          );
                          const isScored = practice.implementationLevel !== null;

                          return (
                            <div
                              key={practice.id}
                              className={cn(
                                "p-4 rounded-lg border transition-colors",
                                practice.isPerformed
                                  ? "bg-green-50 border-green-200"
                                  : isScored
                                  ? "bg-amber-50 border-amber-200"
                                  : "bg-gray-50 border-gray-200",
                                savePracticeMutation.isPending && "opacity-50"
                              )}
                            >
                              {/* Practice Header */}
                              <div className="flex items-start justify-between gap-4 mb-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-mono text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
                                      {practice.code}
                                    </span>
                                    {isScored && (
                                      <Badge
                                        variant="outline"
                                        className={cn("text-xs", implLevel?.color)}
                                      >
                                        {implLevel?.shortLabel}
                                        {implLevel?.isPass ? " ✓" : " ✗"}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-sm">{practice.text}</p>
                                </div>
                              </div>

                              {/* Implementation Guidance - Collapsible */}
                              {practice.guidance && (
                                <Collapsible className="mb-3">
                                  <CollapsibleTrigger asChild>
                                    <button className="w-full p-2 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 transition-colors">
                                      <div className="flex items-center gap-2">
                                        <HelpCircle className="h-4 w-4 text-blue-600 shrink-0" />
                                        <span className="text-xs font-medium text-blue-800">
                                          Implementation Guidance
                                        </span>
                                        <ChevronRight className="h-4 w-4 text-blue-600 ml-auto transition-transform [[data-state=open]>&]:rotate-90" />
                                      </div>
                                    </button>
                                  </CollapsibleTrigger>
                                  <CollapsibleContent>
                                    <div className="mt-1 p-3 bg-blue-50 border border-t-0 border-blue-100 rounded-b-lg">
                                      <div className="text-xs text-blue-700 space-y-1">
                                        {practice.guidance
                                          .split(/(?=·)|(?=-\s)/)
                                          .map((part, idx) => {
                                            const trimmed = part.trim();
                                            if (!trimmed) return null;
                                            const isBullet = trimmed.startsWith('·') || trimmed.startsWith('-');
                                            return (
                                              <p key={idx} className={isBullet ? "pl-4" : ""}>
                                                {trimmed}
                                              </p>
                                            );
                                          })}
                                      </div>
                                    </div>
                                  </CollapsibleContent>
                                </Collapsible>
                              )}

                              {/* Scoring Controls */}
                              <div className="grid gap-3 sm:grid-cols-2">
                                {/* Implementation Level */}
                                <div className="space-y-1.5">
                                  <Label className="text-xs font-medium">
                                    Implementation Level
                                  </Label>
                                  <Select
                                    value={
                                      practice.implementationLevel !== null
                                        ? String(practice.implementationLevel)
                                        : ""
                                    }
                                    onValueChange={(value) => {
                                      handlePracticeUpdate(
                                        practice.id,
                                        parseInt(value, 10),
                                        practice.notes
                                      );
                                    }}
                                    disabled={savePracticeMutation.isPending}
                                  >
                                    <SelectTrigger className="h-9">
                                      <SelectValue placeholder="Select level..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {IMPLEMENTATION_LEVELS.map((level) => (
                                        <SelectItem
                                          key={level.value}
                                          value={String(level.value)}
                                        >
                                          <div className="flex items-center gap-2">
                                            <span
                                              className={cn(
                                                "w-2 h-2 rounded-full",
                                                level.isPass
                                                  ? "bg-green-500"
                                                  : "bg-red-500"
                                              )}
                                            />
                                            <span>{level.label}</span>
                                            <span className="text-xs text-muted-foreground">
                                              ({level.isPass ? "Pass" : "Fail"})
                                            </span>
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                {/* Notes */}
                                <div className="space-y-1.5">
                                  <Label className="text-xs font-medium">
                                    Notes / Evidence
                                  </Label>
                                  <Textarea
                                    key={`notes-${practice.id}-${practice.notes ?? ""}`}
                                    placeholder="Describe how this practice is or isn't being met..."
                                    defaultValue={practice.notes ?? ""}
                                    onBlur={(e) => {
                                      if (
                                        e.target.value !== (practice.notes ?? "") &&
                                        practice.implementationLevel !== null
                                      ) {
                                        handlePracticeUpdate(
                                          practice.id,
                                          practice.implementationLevel,
                                          e.target.value || null
                                        );
                                      }
                                    }}
                                    disabled={savePracticeMutation.isPending}
                                    className="h-9 min-h-[36px] text-xs resize-none"
                                    rows={1}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          )}

          {/* Info about cumulative scoring */}
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 text-blue-600" />
              <div className="text-xs text-blue-700">
                <p className="font-medium mb-1">C2M2 Cumulative MIL Scoring</p>
                <p>
                  To achieve a MIL level, you must complete ALL practices at that level AND all practices at predecessor levels.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

/**
 * Subcategory Checklist Component - For NIST CSF subcategory-level assessment
 * Shows subcategories grouped by category with implementation scoring
 */
function SubcategoryChecklist({
  assessmentId,
  domain,
  levels,
  maxLevel,
  isExpanded,
  onToggle,
  targetLevel = null,
  onTargetLevelChange,
  isSavingTarget = false,
}: {
  assessmentId: string;
  domain: { id: string; code: string; name: string; description: string | null };
  levels: ScoringLevel[];
  maxLevel: number;
  isExpanded: boolean;
  onToggle: () => void;
  targetLevel?: number | null;
  onTargetLevelChange?: (targetLevel: number | null) => void;
  isSavingTarget?: boolean;
}) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const utils = api.useUtils();

  // Fetch subcategories for this function
  const { data: subcategoryData, isLoading } = api.maturity.getSubcategoriesForFunction.useQuery(
    { assessmentId, domainId: domain.id },
    { enabled: isExpanded }
  );

  // Mutation to save subcategory response
  const saveSubcategoryMutation = api.maturity.saveSubcategoryResponse.useMutation({
    onSuccess: () => {
      void utils.maturity.getSubcategoriesForFunction.invalidate({ assessmentId, domainId: domain.id });
      void utils.maturity.getById.invalidate({ id: assessmentId });
    },
    onError: (error) => {
      toast.error(`Failed to save: ${error.message}`);
    },
  });

  const handleSubcategoryUpdate = (
    subcategoryId: string,
    implementationLevel: number,
    notes?: string | null,
    confidence?: string | null
  ) => {
    saveSubcategoryMutation.mutate({
      assessmentId,
      subcategoryId,
      implementationLevel,
      notes,
      confidence: confidence as "LOW" | "MEDIUM" | "HIGH" | null | undefined,
    });
  };

  const averageTier = subcategoryData?.averageTier ?? null;
  const levelInfo = levels.find((l) => l.value === averageTier);

  return (
    <Card
      className={cn(
        "transition-all duration-200",
        isExpanded && "ring-2 ring-primary shadow-md",
        averageTier !== null && !isExpanded && "border-l-4 border-l-primary"
      )}
    >
      <CardHeader
        className="cursor-pointer select-none"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isExpanded ? (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            )}
            <Badge variant="outline" className="font-mono">
              {domain.code}
            </Badge>
            <span className="font-medium">{domain.name}</span>
          </div>
          <div className="flex items-center gap-2">
            {subcategoryData && (
              <span className="text-sm text-muted-foreground">
                {subcategoryData.scoredSubcategories}/{subcategoryData.totalSubcategories} scored
              </span>
            )}
            {targetLevel !== null && targetLevel !== undefined && averageTier !== null && averageTier < targetLevel && (
              <Badge variant="outline" className="text-amber-600 border-amber-300">
                Gap: +{targetLevel - averageTier}
              </Badge>
            )}
            <TierBadge
              level={averageTier}
              levels={levels}
              maxLevel={maxLevel}
              frameworkType="NIST_CSF_2"
            />
          </div>
        </div>
        {!isExpanded && domain.description && (
          <p className="text-sm text-muted-foreground ml-11 line-clamp-1">
            {domain.description}
          </p>
        )}
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4 pt-0">
          {domain.description && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{domain.description}</p>
              </div>
            </div>
          )}

          {/* Current Tier & Target Tier Status */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Average Implementation Tier</p>
                  <p className="text-xs text-muted-foreground">Based on subcategory scoring</p>
                </div>
                <div className="text-right">
                  <div className={cn(
                    "inline-flex items-center justify-center px-4 py-2 rounded-lg font-bold",
                    getTierColorClass(averageTier, maxLevel)
                  )}>
                    Tier {averageTier ?? "?"}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{levelInfo?.label ?? "Not Assessed"}</p>
                </div>
              </div>
            </div>

            {/* Target Tier Selector */}
            <div className="p-4 bg-muted/30 rounded-lg border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Target Tier</p>
                  <p className="text-xs text-muted-foreground">Set your target implementation tier</p>
                </div>
                <Select
                  value={targetLevel !== null && targetLevel !== undefined ? String(targetLevel) : "none"}
                  onValueChange={(value) => {
                    onTargetLevelChange?.(value === "none" ? null : parseInt(value));
                  }}
                  disabled={isSavingTarget}
                >
                  <SelectTrigger className="w-[120px] h-9">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not Set</SelectItem>
                    {levels.filter((l) => l.value > 0).map((level) => (
                      <SelectItem key={level.value} value={String(level.value)}>
                        Tier {level.value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Loading state */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            /* Subcategory lists by category */
            <div className="space-y-3">
              {subcategoryData?.categories.map((categoryData) => {
                const { category, subcategories } = categoryData;
                if (subcategories.length === 0) return null;

                const scoredCount = subcategories.filter((s) => s.implementationLevel !== null).length;
                const passCount = subcategories.filter((s) => s.isPerformed).length;
                const isAllScored = scoredCount === subcategories.length;

                return (
                  <Collapsible
                    key={category.id}
                    open={expandedCategory === category.id}
                    onOpenChange={(open) => setExpandedCategory(open ? category.id : null)}
                  >
                    <CollapsibleTrigger asChild>
                      <div className={cn(
                        "flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors",
                        isAllScored && "bg-green-50 border-green-200"
                      )}>
                        <div className="flex items-center gap-3">
                          {expandedCategory === category.id ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <Badge variant={isAllScored ? "default" : "outline"} className={cn(
                            "font-mono",
                            isAllScored && "bg-green-600"
                          )}>
                            {category.code}
                          </Badge>
                          <span className="text-sm font-medium">
                            {category.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {isAllScored ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              {scoredCount}/{subcategories.length}
                            </span>
                          )}
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-2 ml-4 space-y-3 border-l-2 pl-4">
                        {subcategories.map((subcategory) => {
                          const implLevel = IMPLEMENTATION_LEVELS.find(
                            (l) => l.value === subcategory.implementationLevel
                          );
                          const isScored = subcategory.implementationLevel !== null;

                          return (
                            <div
                              key={subcategory.id}
                              className={cn(
                                "p-4 rounded-lg border transition-colors",
                                subcategory.isPerformed
                                  ? "bg-green-50 border-green-200"
                                  : isScored
                                  ? "bg-amber-50 border-amber-200"
                                  : "bg-gray-50 border-gray-200",
                                saveSubcategoryMutation.isPending && "opacity-50"
                              )}
                            >
                              {/* Subcategory Header */}
                              <div className="flex items-start justify-between gap-4 mb-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-mono text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
                                      {subcategory.code}
                                    </span>
                                    {isScored && (
                                      <Badge
                                        variant="outline"
                                        className={cn("text-xs", implLevel?.color)}
                                      >
                                        {implLevel?.shortLabel}
                                        {implLevel?.isPass ? " ✓" : " ✗"}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-sm">{subcategory.name}</p>
                                </div>
                              </div>

                              {/* Subcategory Description - Collapsible */}
                              {subcategory.description && (
                                <Collapsible className="mb-3">
                                  <CollapsibleTrigger asChild>
                                    <button className="w-full p-2 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 transition-colors">
                                      <div className="flex items-center gap-2">
                                        <HelpCircle className="h-4 w-4 text-blue-600 shrink-0" />
                                        <span className="text-xs font-medium text-blue-800">
                                          Additional Guidance
                                        </span>
                                        <ChevronRight className="h-4 w-4 text-blue-600 ml-auto transition-transform [[data-state=open]>&]:rotate-90" />
                                      </div>
                                    </button>
                                  </CollapsibleTrigger>
                                  <CollapsibleContent>
                                    <div className="mt-1 p-3 bg-blue-50 border border-t-0 border-blue-100 rounded-b-lg">
                                      <p className="text-xs text-blue-700 whitespace-pre-line">
                                        {subcategory.description}
                                      </p>
                                    </div>
                                  </CollapsibleContent>
                                </Collapsible>
                              )}

                              {/* Scoring Controls */}
                              <div className="grid gap-3 sm:grid-cols-2">
                                {/* Implementation Level */}
                                <div className="space-y-1.5">
                                  <Label className="text-xs font-medium">
                                    Implementation Level
                                  </Label>
                                  <Select
                                    value={
                                      subcategory.implementationLevel !== null
                                        ? String(subcategory.implementationLevel)
                                        : ""
                                    }
                                    onValueChange={(value) => {
                                      handleSubcategoryUpdate(
                                        subcategory.id,
                                        parseInt(value, 10),
                                        subcategory.notes,
                                        subcategory.confidence
                                      );
                                    }}
                                    disabled={saveSubcategoryMutation.isPending}
                                  >
                                    <SelectTrigger className="h-9">
                                      <SelectValue placeholder="Select level..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {IMPLEMENTATION_LEVELS.map((level) => (
                                        <SelectItem
                                          key={level.value}
                                          value={String(level.value)}
                                        >
                                          <div className="flex items-center gap-2">
                                            <span
                                              className={cn(
                                                "w-2 h-2 rounded-full",
                                                level.isPass
                                                  ? "bg-green-500"
                                                  : "bg-red-500"
                                              )}
                                            />
                                            <span>{level.label}</span>
                                            <span className="text-xs text-muted-foreground">
                                              ({level.isPass ? "Pass" : "Fail"})
                                            </span>
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                {/* Notes */}
                                <div className="space-y-1.5">
                                  <Label className="text-xs font-medium">
                                    Notes / Evidence
                                  </Label>
                                  <Textarea
                                    key={`notes-${subcategory.id}-${subcategory.notes ?? ""}`}
                                    placeholder="Document evidence or rationale..."
                                    defaultValue={subcategory.notes ?? ""}
                                    onBlur={(e) => {
                                      if (
                                        e.target.value !== (subcategory.notes ?? "") &&
                                        subcategory.implementationLevel !== null
                                      ) {
                                        handleSubcategoryUpdate(
                                          subcategory.id,
                                          subcategory.implementationLevel,
                                          e.target.value || null,
                                          subcategory.confidence
                                        );
                                      }
                                    }}
                                    disabled={saveSubcategoryMutation.isPending}
                                    className="h-9 min-h-[36px] text-xs resize-none"
                                    rows={1}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          )}

          {/* Info about NIST CSF scoring */}
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 text-blue-600" />
              <div className="text-xs text-blue-700">
                <p className="font-medium mb-1">NIST CSF Implementation Tiers</p>
                <p>Score each subcategory based on your implementation level. Fully/Largely Implemented counts as achieving the control.</p>
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

/**
 * Overall Score Card - Displays the calculated overall score
 */
function OverallScoreCard({
  level,
  levels,
  maxLevel,
  scoredCount,
  totalCount,
  frameworkType,
}: {
  level: number | null | undefined;
  levels: ScoringLevel[];
  maxLevel: number;
  scoredCount: number;
  totalCount: number;
  frameworkType: MaturityFrameworkType;
}) {
  const levelInfo = levels.find((l) => l.value === level);
  const progress = totalCount > 0 ? (scoredCount / totalCount) * 100 : 0;
  const scoreTypeLabel = getScoreTypeLabel(frameworkType);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Gauge className="h-4 w-4" />
          Overall Score
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center py-4">
          {level !== null && level !== undefined ? (
            <>
              <div
                className={cn(
                  "inline-flex items-center justify-center w-20 h-20 rounded-xl text-2xl font-bold mb-2",
                  getTierColorClass(level, maxLevel)
                )}
              >
                {level}
              </div>
              <p className="font-medium">{levelInfo?.label || "Unknown"}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {scoreTypeLabel}
              </p>
            </>
          ) : (
            <>
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-xl text-2xl font-bold mb-2 bg-gray-100 text-gray-400">
                ?
              </div>
              <p className="font-medium text-muted-foreground">Not Assessed</p>
              <p className="text-xs text-muted-foreground mt-1">
                Score domains to calculate
              </p>
            </>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">
              {scoredCount} / {totalCount} domains
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Target Planning Card - Shows target level and gap analysis
 */
function TargetPlanningCard({
  targetLevel,
  targetDate,
  currentLevel,
  levels,
  maxLevel,
  frameworkType,
}: {
  targetLevel: number | null | undefined;
  targetDate: Date | string | null | undefined;
  currentLevel: number | null | undefined;
  levels: ScoringLevel[];
  maxLevel: number;
  frameworkType: MaturityFrameworkType;
}) {
  const gap =
    targetLevel !== null &&
    targetLevel !== undefined &&
    currentLevel !== null &&
    currentLevel !== undefined
      ? targetLevel - currentLevel
      : null;

  const targetLevelInfo = levels.find((l) => l.value === targetLevel);

  if (!targetLevel) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Target className="h-4 w-4" />
            Target Planning
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No target set</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Target className="h-4 w-4" />
          Target Planning
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Target Level</span>
          <Badge className={getTierColorClass(targetLevel, maxLevel)}>
            {getLevelPrefix(frameworkType)}{frameworkType === "C2M2" ? `MIL${targetLevel}` : targetLevel}: {targetLevelInfo?.label}
          </Badge>
        </div>

        {targetDate && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Target Date</span>
            <span className="text-sm font-medium">
              {format(new Date(targetDate), "MMM d, yyyy")}
            </span>
          </div>
        )}

        {gap !== null && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Gap to Target</span>
            <Badge
              variant="outline"
              className={cn(
                gap > 0 && "text-amber-600 border-amber-300",
                gap === 0 && "text-green-600 border-green-300",
                gap < 0 && "text-blue-600 border-blue-300"
              )}
            >
              {gap > 0 ? `+${gap} levels` : gap === 0 ? "Target reached!" : `${gap} levels`}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Main Component
// =============================================================================

interface MaturityAssessmentDetailClientProps {
  assessmentId: string;
}

export function MaturityAssessmentDetailClient({
  assessmentId,
}: MaturityAssessmentDetailClientProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const utils = api.useUtils();

  const [isMounted, setIsMounted] = useState(false);
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [snapshotDialogOpen, setSnapshotDialogOpen] = useState(false);
  const [snapshotReason, setSnapshotReason] = useState("");

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Fetch assessment data
  const {
    data: assessment,
    isLoading,
    error,
  } = api.maturity.getById.useQuery(
    { id: assessmentId },
    { enabled: !!assessmentId }
  );

  // Mutations
  const updateScoreMutation = api.maturity.updateDomainScore.useMutation({
    onSuccess: () => {
      void utils.maturity.getById.invalidate({ id: assessmentId });
      toast.success("Score saved successfully");
    },
    onError: (error) => {
      toast.error(`Failed to save score: ${error.message}`);
    },
  });

  const deleteMutation = api.maturity.delete.useMutation({
    onSuccess: () => {
      toast.success("Assessment deleted");
      router.push("/maturity");
    },
    onError: (error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  const createSnapshotMutation = api.maturity.createSnapshot.useMutation({
    onSuccess: () => {
      void utils.maturity.getById.invalidate({ id: assessmentId });
      toast.success("Snapshot created");
      setSnapshotDialogOpen(false);
      setSnapshotReason("");
    },
    onError: (error) => {
      toast.error(`Failed to create snapshot: ${error.message}`);
    },
  });

  const updateStatusMutation = api.maturity.update.useMutation({
    onSuccess: () => {
      void utils.maturity.getById.invalidate({ id: assessmentId });
      toast.success("Status updated");
    },
    onError: (error) => {
      toast.error(`Failed to update status: ${error.message}`);
    },
  });

  // Permissions
  const userRole = isMounted ? (session?.user?.role as UserRole | undefined) : undefined;
  const canManage = userRole && CAN_MANAGE_ROLES.includes(userRole);

  // Breadcrumbs
  const breadcrumbs = [
    { label: "Maturity", href: "/maturity" },
    { label: assessment?.name || "Assessment" },
  ];

  // Loading state
  if (!isMounted || isLoading) {
    return (
      <AppLayout breadcrumbs={breadcrumbs}>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  // Error state
  if (error || !assessment) {
    return (
      <AppLayout breadcrumbs={breadcrumbs}>
        <Card className="max-w-md mx-auto mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Assessment Not Found
            </CardTitle>
            <CardDescription>
              {error?.message || "The requested assessment could not be loaded."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => router.push("/maturity")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Assessments
            </Button>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  // Extract data
  const framework = assessment.framework as typeof assessment.framework & {
    scoringLevels: ScoringLevel[];
  };
  const levels: ScoringLevel[] = framework.scoringLevels || [];
  const maxLevel = framework.maxLevel;

  // Filter domains based on assessment depth
  // C2M2 always uses FUNCTION-level domains (practices are stored as MaturityQuestion)
  const domainLevel = (assessment.framework.type === "C2M2" || assessment.framework.type === "OWASP_SAMM")
    ? "FUNCTION"
    : assessment.assessmentDepth;
  const domains = framework.domains.filter(
    (d) => d.level === domainLevel
  );

  // Build score map for quick lookup
  const scoreMap = new Map(
    assessment.domainScores.map((s) => [s.domainId, s])
  );

  // Calculate progress
  const scoredCount = assessment.domainScores.filter(
    (s) => s.currentLevel !== null
  ).length;
  const totalCount = domains.length;

  // Status config
  const statusConfig = STATUS_CONFIG[assessment.status];
  const StatusIcon = statusConfig.icon;

  // Handlers
  const handleSaveScore = (data: {
    domainId: string;
    currentLevel: number | null;
    targetLevel: number | null;
    confidence: string | null;
    notes: string | null;
  }) => {
    updateScoreMutation.mutate({
      assessmentId,
      domainId: data.domainId,
      currentLevel: data.currentLevel,
      targetLevel: data.targetLevel,
      confidence: data.confidence as "HIGH" | "MEDIUM" | "LOW" | null | undefined,
      notes: data.notes,
    });
  };

  const handleDelete = () => {
    deleteMutation.mutate({ id: assessmentId });
  };

  const handleCreateSnapshot = () => {
    createSnapshotMutation.mutate({
      assessmentId,
      reason: snapshotReason.trim() || null,
    });
  };

  const handleStartAssessment = () => {
    if (assessment.status === "DRAFT") {
      updateStatusMutation.mutate({
        id: assessmentId,
        status: MaturityAssessmentStatus.IN_PROGRESS,
      });
    }
    // Expand the first domain
    if (domains.length > 0 && !expandedDomain) {
      setExpandedDomain(domains[0]!.id);
    }
  };

  const handleSubmitForReview = () => {
    updateStatusMutation.mutate({
      id: assessmentId,
      status: MaturityAssessmentStatus.IN_REVIEW,
    });
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <div className="container mx-auto py-6 space-y-6">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/maturity")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Assessments
        </Button>

        {/* Header Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline">
                    {FRAMEWORK_LABELS[framework.type as MaturityFrameworkType]}
                  </Badge>
                  <Badge className={statusConfig.color}>
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {statusConfig.label}
                  </Badge>
                </div>
                <CardTitle className="text-2xl">{assessment.name}</CardTitle>
                <CardDescription>
                  {assessment.identifier} | {DEPTH_LABELS[assessment.assessmentDepth]} |{" "}
                  {MODE_LABELS[assessment.assessmentMode]}
                </CardDescription>
              </div>
              {canManage && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-xs">
                    {getInitials(assessment.owner.name)}
                  </AvatarFallback>
                </Avatar>
                <span>{assessment.owner.name || assessment.owner.email}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>Created {format(new Date(assessment.createdAt), "MMM d, yyyy")}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Domain Scoring Section */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Domain Scoring ({domains.length} domains)
              </h2>
              {assessment.status === "DRAFT" && (
                <Button onClick={handleStartAssessment}>
                  Start Assessment
                </Button>
              )}
            </div>

            <div className="space-y-3">
              {domains.map((domain) => {
                const score = scoreMap.get(domain.id);

                // Use PracticeChecklist for C2M2
                if (assessment.framework.type === "C2M2") {
                  return (
                    <PracticeChecklist
                      key={domain.id}
                      assessmentId={assessmentId}
                      domain={domain}
                      levels={levels}
                      maxLevel={maxLevel}
                      isExpanded={expandedDomain === domain.id}
                      onToggle={() =>
                        setExpandedDomain(
                          expandedDomain === domain.id ? null : domain.id
                        )
                      }
                      frameworkType={assessment.framework.type}
                      targetLevel={score?.targetLevel ?? null}
                      onTargetLevelChange={(targetLevel) => {
                        updateScoreMutation.mutate({
                          assessmentId,
                          domainId: domain.id,
                          targetLevel,
                        });
                      }}
                      isSavingTarget={updateScoreMutation.isPending}
                    />
                  );
                }

                // Use SubcategoryChecklist for NIST CSF 2.0
                if (assessment.framework.type === "NIST_CSF_2") {
                  return (
                    <SubcategoryChecklist
                      key={domain.id}
                      assessmentId={assessmentId}
                      domain={domain}
                      levels={levels}
                      maxLevel={maxLevel}
                      isExpanded={expandedDomain === domain.id}
                      onToggle={() =>
                        setExpandedDomain(
                          expandedDomain === domain.id ? null : domain.id
                        )
                      }
                      targetLevel={score?.targetLevel ?? null}
                      onTargetLevelChange={(targetLevel) => {
                        updateScoreMutation.mutate({
                          assessmentId,
                          domainId: domain.id,
                          targetLevel,
                        });
                      }}
                      isSavingTarget={updateScoreMutation.isPending}
                    />
                  );
                }

                // Use SammChecklist for OWASP SAMM
                if (assessment.framework.type === "OWASP_SAMM") {
                  return (
                    <SammChecklist
                      key={domain.id}
                      assessmentId={assessmentId}
                      domain={domain}
                      isExpanded={expandedDomain === domain.id}
                      onToggle={() =>
                        setExpandedDomain(
                          expandedDomain === domain.id ? null : domain.id
                        )
                      }
                      targetLevel={score?.targetLevel ?? null}
                      onTargetLevelChange={(targetLevel) => {
                        updateScoreMutation.mutate({
                          assessmentId,
                          domainId: domain.id,
                          targetLevel,
                        });
                      }}
                      isSavingTarget={updateScoreMutation.isPending}
                    />
                  );
                }

                // Use DomainScoreCard for other frameworks
                return (
                  <DomainScoreCard
                    key={domain.id}
                    domain={domain}
                    score={score}
                    levels={levels}
                    maxLevel={maxLevel}
                    assessmentId={assessmentId}
                    onSave={handleSaveScore}
                    isSaving={updateScoreMutation.isPending}
                    isExpanded={expandedDomain === domain.id}
                    onToggle={() =>
                      setExpandedDomain(
                        expandedDomain === domain.id ? null : domain.id
                      )
                    }
                    frameworkType={assessment.framework.type}
                  />
                );
              })}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <OverallScoreCard
              level={assessment.overallLevel}
              levels={levels}
              maxLevel={maxLevel}
              scoredCount={scoredCount}
              totalCount={totalCount}
              frameworkType={assessment.framework.type}
            />

            <TargetPlanningCard
              targetLevel={assessment.targetLevel}
              targetDate={assessment.targetDate}
              currentLevel={assessment.overallLevel}
              levels={levels}
              maxLevel={maxLevel}
              frameworkType={assessment.framework.type}
            />

            {/* Actions Card */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setSnapshotDialogOpen(true)}
                  disabled={scoredCount === 0}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Create Snapshot
                </Button>
                {(assessment.status === "IN_PROGRESS" ||
                  assessment.status === "DRAFT") && (
                  <Button
                    className="w-full justify-start"
                    onClick={handleSubmitForReview}
                    disabled={scoredCount < totalCount}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Submit for Review
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Snapshots */}
            {assessment.snapshots && assessment.snapshots.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    History ({assessment.snapshots.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {assessment.snapshots.slice(0, 5).map((snapshot) => (
                      <div
                        key={snapshot.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-muted-foreground">
                          {format(new Date(snapshot.snapshotDate), "MMM d, yyyy")}
                        </span>
                        <Badge variant="outline">
                          {getLevelPrefix(assessment.framework.type)}{snapshot.overallLevel}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Spider Chart - Domain Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4" />
                Domain Maturity
              </CardTitle>
              <CardDescription>
                Current vs Target levels across domains
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                // Build spider chart data from domain scores
                const spiderData = domains.map((domain) => {
                  const score = scoreMap.get(domain.id);
                  return {
                    name: domain.name,
                    code: domain.code,
                    currentLevel: score?.currentLevel ?? 0,
                    targetLevel: score?.targetLevel ?? assessment.targetLevel ?? 0,
                  };
                });

                if (spiderData.length === 0 || scoredCount === 0) {
                  return (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <Target className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>No scores yet</p>
                        <p className="text-sm mt-1">Score domains to see progress</p>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={spiderData} cx="50%" cy="50%" outerRadius="80%">
                        <PolarGrid strokeDasharray="3 3" />
                        <PolarAngleAxis
                          dataKey="code"
                          tick={{ fontSize: 10, fill: "hsl(var(--foreground))" }}
                          tickLine={false}
                        />
                        <PolarRadiusAxis
                          angle={90}
                          domain={[0, maxLevel]}
                          tick={{ fontSize: 9 }}
                          tickCount={maxLevel + 1}
                        />
                        <Radar
                          name="Target"
                          dataKey="targetLevel"
                          stroke="hsl(142, 76%, 36%)"
                          fill="hsl(142, 76%, 36%)"
                          fillOpacity={0.15}
                          strokeWidth={2}
                          strokeDasharray="5 5"
                        />
                        <Radar
                          name="Current"
                          dataKey="currentLevel"
                          stroke="hsl(221, 83%, 53%)"
                          fill="hsl(221, 83%, 53%)"
                          fillOpacity={0.4}
                          strokeWidth={2}
                        />
                        <Legend
                          wrapperStyle={{ paddingTop: "10px" }}
                          formatter={(value) => <span className="text-xs">{value}</span>}
                        />
                        <RechartsTooltip
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const data = payload[0]?.payload as { name: string; code: string; currentLevel: number; targetLevel: number };
                            return (
                              <div className="bg-popover border rounded-lg shadow-lg p-3 text-sm">
                                <p className="font-medium mb-2">{data.name}</p>
                                <div className="space-y-1 text-xs">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                                    <span>Current: {data.currentLevel}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-green-500" />
                                    <span>Target: {data.targetLevel}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          }}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Maturity Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Maturity Trend
              </CardTitle>
              <CardDescription>
                Historical maturity levels from snapshots
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                // Build trend data from snapshots
                const trendData = assessment.snapshots
                  ?.sort((a, b) => new Date(a.snapshotDate).getTime() - new Date(b.snapshotDate).getTime())
                  .map((snapshot) => ({
                    date: format(new Date(snapshot.snapshotDate), "MMM d"),
                    level: snapshot.overallLevel ?? 0,
                  })) ?? [];

                // Add current assessment score as latest point if not in snapshots
                if (assessment.overallLevel !== null) {
                  const lastSnapshotDate = trendData.length > 0
                    ? trendData[trendData.length - 1]?.date
                    : null;
                  const currentDate = format(new Date(), "MMM d");

                  if (lastSnapshotDate !== currentDate) {
                    trendData.push({
                      date: "Current",
                      level: assessment.overallLevel,
                    });
                  }
                }

                if (trendData.length === 0) {
                  return (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>No trend data yet</p>
                        <p className="text-sm mt-1">Create snapshots to track progress</p>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis domain={[0, maxLevel]} tick={{ fontSize: 10 }} />
                        <RechartsTooltip
                          formatter={(value: number) => [value.toFixed(1), "Level"]}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="level"
                          name="Maturity Level"
                          stroke="hsl(221, 83%, 53%)"
                          strokeWidth={2}
                          dot={{ fill: "hsl(221, 83%, 53%)", strokeWidth: 2, r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                        {/* Target line */}
                        {assessment.targetLevel && (
                          <Line
                            type="monotone"
                            dataKey={() => assessment.targetLevel}
                            name="Target"
                            stroke="hsl(142, 76%, 36%)"
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            dot={false}
                          />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Assessment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{assessment.name}" and all associated
              scores and snapshots. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Snapshot Dialog */}
      <Dialog open={snapshotDialogOpen} onOpenChange={setSnapshotDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Snapshot</DialogTitle>
            <DialogDescription>
              Create a point-in-time snapshot of the current assessment scores
              for historical tracking.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Textarea
                placeholder="e.g., Quarterly review, Pre-audit checkpoint..."
                value={snapshotReason}
                onChange={(e) => setSnapshotReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSnapshotDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateSnapshot}
              disabled={createSnapshotMutation.isPending}
            >
              {createSnapshotMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Camera className="h-4 w-4 mr-2" />
              )}
              Create Snapshot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
