"use client";

/**
 * Compliance Assessment Detail Client Component
 *
 * Redesigned to mirror the maturity assessment UX with:
 * - Expandable control group cards (grouped by parent control)
 * - Two-column layout with sidebar
 * - Richer scoring UI with status badges
 * - Radar chart visualization
 * - Progress tracking per control group
 */

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Loader2,
  ChevronDown,
  ChevronRight,
  Gauge,
  Target,
  Calendar,
  User,
  Play,
  Send,
  Check,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  Info,
  HelpCircle,
  TrendingUp,
  Trash2,
  Edit,
  Shield,
  Building2,
  AlertTriangle,
  Bug,
  Users,
  FolderOpen,
  Network,
  BarChart3,
  ShieldAlert,
  ListChecks,
} from "lucide-react";
import { ComplianceStatus, ComplianceAssessmentStatus } from "@prisma/client";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Cell,
  ReferenceLine,
} from "recharts";

import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";
import {
  allScores,
  ancestorsOfMatches,
  buildControlTree,
  flattenTree,
  type ControlGroupTree,
} from "@/lib/compliance/control-tree";
import { AppLayout } from "@/components/layout/AppLayout";
import { CreateFindingDialog } from "@/components/findings/CreateFindingDialog";
import { AssessmentFindingsList } from "@/components/findings/AssessmentFindingsList";
import { AssessmentRisksList } from "@/components/risk/AssessmentRisksList";
import { AssessmentEvidencePanel } from "@/components/evidence/AssessmentEvidencePanel";
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
import { WrapperTabPanel } from "@/components/engagement/WrapperTabs";
import { ExecutiveSummaryTab } from "@/components/deliverable/ExecutiveSummaryTab";

// =============================================================================
// Types
// =============================================================================

interface ControlScore {
  id: string;
  controlId: string;
  status: ComplianceStatus;
  notes: string | null;
  gapDescription: string | null;
  evidenceLinks: string[];
  control: {
    id: string;
    controlId: string;
    title: string;
    description: string | null;
    /** NIST's Discussion — how to judge the control, not just what it says. */
    guidance: string | null;
    parentControlId: string | null;
    testInstructions: string | null;
    acceptanceCriteria: string | null;
  };
}

// =============================================================================
// Constants
// =============================================================================

const STATUS_CONFIG: Record<
  ComplianceAssessmentStatus,
  { label: string; color: string; icon: typeof Clock }
> = {
  DRAFT: { label: "Draft", color: "bg-gray-100 text-gray-700", icon: FileText },
  IN_PROGRESS: { label: "In Progress", color: "bg-blue-100 text-blue-700", icon: Clock },
  IN_REVIEW: { label: "In Review", color: "bg-amber-100 text-amber-700", icon: AlertCircle },
  COMPLETED: { label: "Completed", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  ARCHIVED: { label: "Archived", color: "bg-slate-100 text-slate-700", icon: FileText },
};

/**
 * Compliance status levels - styled like maturity implementation levels
 */
const COMPLIANCE_LEVELS = [
  {
    value: ComplianceStatus.COMPLIANT,
    label: "Compliant",
    shortLabel: "Compliant",
    color: "bg-green-100 text-green-700 border-green-200",
    isPass: true,
    description: "Control requirements are fully met"
  },
  {
    value: ComplianceStatus.PARTIALLY_COMPLIANT,
    label: "Partially Compliant",
    shortLabel: "Partial",
    color: "bg-amber-100 text-amber-700 border-amber-200",
    isPass: false,
    description: "Control requirements are partially met with gaps"
  },
  {
    value: ComplianceStatus.NON_COMPLIANT,
    label: "Non-Compliant",
    shortLabel: "Non-Compliant",
    color: "bg-red-100 text-red-700 border-red-200",
    isPass: false,
    description: "Control requirements are not met"
  },
  {
    value: ComplianceStatus.NOT_APPLICABLE,
    label: "Not Applicable",
    shortLabel: "N/A",
    color: "bg-slate-100 text-slate-500 border-slate-200",
    isPass: true,
    description: "Control is not applicable to this assessment"
  },
  {
    value: ComplianceStatus.NOT_ASSESSED,
    label: "Not Assessed",
    shortLabel: "Unscored",
    color: "bg-gray-100 text-gray-500 border-gray-200",
    isPass: false,
    description: "Control has not been assessed yet"
  },
] as const;

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

function getComplianceColorClass(percentage: number | null): string {
  if (percentage === null) return "bg-gray-100 text-gray-600";
  if (percentage >= 80) return "bg-green-100 text-green-700";
  if (percentage >= 60) return "bg-lime-100 text-lime-700";
  if (percentage >= 40) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

function getStatusLevel(status: ComplianceStatus) {
  return COMPLIANCE_LEVELS.find(l => l.value === status);
}

/**
 * Calculate compliance percentage for a group of controls
 */
function calculateGroupCompliance(controls: ControlScore[]): {
  percentage: number | null;
  compliant: number;
  partial: number;
  nonCompliant: number;
  notApplicable: number;
  notAssessed: number;
  total: number;
} {
  const total = controls.length;
  const compliant = controls.filter(c => c.status === ComplianceStatus.COMPLIANT).length;
  const partial = controls.filter(c => c.status === ComplianceStatus.PARTIALLY_COMPLIANT).length;
  const nonCompliant = controls.filter(c => c.status === ComplianceStatus.NON_COMPLIANT).length;
  const notApplicable = controls.filter(c => c.status === ComplianceStatus.NOT_APPLICABLE).length;
  const notAssessed = controls.filter(c => c.status === ComplianceStatus.NOT_ASSESSED).length;

  const assessed = total - notApplicable - notAssessed;
  const percentage = assessed > 0
    ? ((compliant * 100) + (partial * 50)) / assessed
    : null;

  return { percentage, compliant, partial, nonCompliant, notApplicable, notAssessed, total };
}

// =============================================================================
// Sub-Components
// =============================================================================

/**
 * Compliance Status Badge
 */
function ComplianceStatusBadge({ status }: { status: ComplianceStatus }) {
  const level = getStatusLevel(status);
  if (!level) return null;

  return (
    <Badge variant="outline" className={cn("text-xs", level.color)}>
      {level.shortLabel}
      {level.isPass && status !== ComplianceStatus.NOT_APPLICABLE ? " ✓" : status === ComplianceStatus.NOT_ASSESSED ? "" : " ✗"}
    </Badge>
  );
}

/**
 * Control Scoring Item - Individual control within expanded group
 */
function ControlScoringItem({
  score,
  depth,
  hasChildren,
  isExpanded,
  onToggleExpand,
  assessmentId,
  onUpdate,
  isSaving,
  isEditable,
  onCreateFinding,
}: {
  score: ControlScore;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  assessmentId: string;
  onUpdate: (controlId: string, status: ComplianceStatus, notes?: string | null) => void;
  isSaving: boolean;
  isEditable: boolean;
  onCreateFinding?: () => void;
}) {
  const level = getStatusLevel(score.status);
  const isScored = score.status !== ComplianceStatus.NOT_ASSESSED;
  const utils = api.useUtils();

  // Evidence attach/detach. Keep local to the item so the mutation only
  // re-renders this control's panel — invalidates the parent assessment
  // query so the list of evidenceLinks updates everywhere it's read.
  const evidenceMutation = api.complianceAssessment.attachEvidenceToControl.useMutation({
    onSuccess: () => {
      void utils.complianceAssessment.getById.invalidate({ id: assessmentId });
    },
    onError: (e) => {
      toast.error(`Evidence update failed: ${e.message}`);
    },
  });

  return (
    <div
      // Indent by depth so an enhancement (AC-02(01)) sits visibly under its
      // base control (AC-02). 800-53 nests; ISO 27001 is flat and depth is 0.
      style={{ marginLeft: `${depth * 1.5}rem` }}
      className={cn(
        "p-4 rounded-lg border transition-colors",
        score.status === ComplianceStatus.COMPLIANT
          ? "bg-green-50 border-green-200"
          : score.status === ComplianceStatus.PARTIALLY_COMPLIANT
          ? "bg-amber-50 border-amber-200"
          : score.status === ComplianceStatus.NON_COMPLIANT
          ? "bg-red-50 border-red-200"
          : score.status === ComplianceStatus.NOT_APPLICABLE
          ? "bg-slate-50 border-slate-200"
          : "bg-gray-50 border-gray-200",
        isSaving && "opacity-50"
      )}
    >
      {/* Control Header */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {hasChildren ? (
              <button
                type="button"
                aria-label={`${isExpanded ? "Collapse" : "Expand"} ${score.control.controlId}`}
                aria-expanded={isExpanded}
                onClick={onToggleExpand}
                className="shrink-0 rounded-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            ) : (
              <span className="w-4 shrink-0" />
            )}
            <span className="font-mono text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
              {score.control.controlId}
            </span>
            {isScored && <ComplianceStatusBadge status={score.status} />}
          </div>
          <p className="text-sm font-medium">{score.control.title}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onCreateFinding && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 shrink-0 text-amber-700 hover:text-amber-800 border-amber-200 hover:bg-amber-50"
              onClick={onCreateFinding}
              title="Create finding linked to this control"
            >
              <AlertTriangle className="h-3 w-3" />
              Finding
            </Button>
          )}
        </div>
      </div>

      {/* Control Description — the control's real NIST statement. Collapsible. */}
      {score.control.description && (
        <Collapsible className="mb-3">
          <CollapsibleTrigger asChild>
            <button className="w-full p-2 bg-muted border border-border rounded-lg hover:bg-muted/70 transition-colors">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-xs font-medium text-foreground">
                  Control Details
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto transition-transform [[data-state=open]>&]:rotate-90" />
              </div>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-1 p-3 bg-muted border border-t-0 border-border rounded-b-lg">
              {/* whitespace-pre-wrap: the description is NIST's structured
                  statement — lettered clauses on their own indented lines. HTML
                  collapses every newline and indent, so without this AC-02 reads
                  as one unbroken run-on paragraph. */}
              <p className="text-xs text-foreground whitespace-pre-wrap">
                {score.control.description}
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Guidance — NIST's Discussion for this control. It is the text that tells
          the assessor how to JUDGE the control, so it belongs on the page where
          they score it, not only in the framework admin. Collapsible: it runs to
          several paragraphs and would bury the scoring controls if always open. */}
      {score.control.guidance && (
        <Collapsible className="mb-3">
          <CollapsibleTrigger asChild>
            <button className="w-full p-2 bg-muted border border-border rounded-lg hover:bg-muted/70 transition-colors">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-xs font-medium text-foreground">
                  Guidance
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto transition-transform [[data-state=open]>&]:rotate-90" />
              </div>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-1 p-3 bg-muted border border-t-0 border-border rounded-b-lg">
              <p className="text-xs text-foreground whitespace-pre-wrap">
                {score.control.guidance}
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Test Instructions — read-only, defaults open so the assessor sees
          the test steps while documenting. Authored at /admin/frameworks. */}
      {score.control.testInstructions && (
        <Collapsible defaultOpen className="mb-3">
          <CollapsibleTrigger asChild>
            <button className="w-full p-2 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-colors">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-indigo-600 shrink-0" />
                <span className="text-xs font-medium text-indigo-800">
                  Test Instructions
                </span>
                <ChevronRight className="h-4 w-4 text-indigo-600 ml-auto transition-transform [[data-state=open]>&]:rotate-90" />
              </div>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-1 p-3 bg-indigo-50 border border-t-0 border-indigo-100 rounded-b-lg">
              <p className="text-xs text-indigo-800 whitespace-pre-wrap">
                {score.control.testInstructions}
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Acceptance Criteria — read-only, defaults open */}
      {score.control.acceptanceCriteria && (
        <Collapsible defaultOpen className="mb-3">
          <CollapsibleTrigger asChild>
            <button className="w-full p-2 bg-emerald-50 border border-emerald-100 rounded-lg hover:bg-emerald-100 transition-colors">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="text-xs font-medium text-emerald-800">
                  Acceptance Criteria
                </span>
                <ChevronRight className="h-4 w-4 text-emerald-600 ml-auto transition-transform [[data-state=open]>&]:rotate-90" />
              </div>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-1 p-3 bg-emerald-50 border border-t-0 border-emerald-100 rounded-b-lg">
              <p className="text-xs text-emerald-800 whitespace-pre-wrap">
                {score.control.acceptanceCriteria}
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Scoring Controls */}
      {isEditable ? (
        <div className="space-y-3">
          {/* Compliance Status */}
          <div className="space-y-1.5 sm:max-w-xs">
            <Label className="text-xs font-medium">Compliance Status</Label>
            <Select
              value={score.status}
              onValueChange={(value) => {
                onUpdate(score.controlId, value as ComplianceStatus, score.notes);
              }}
              disabled={isSaving}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select status..." />
              </SelectTrigger>
              <SelectContent>
                {COMPLIANCE_LEVELS.map((level) => (
                  <SelectItem key={level.value} value={level.value}>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "w-2 h-2 rounded-full",
                          level.value === ComplianceStatus.COMPLIANT
                            ? "bg-green-500"
                            : level.value === ComplianceStatus.PARTIALLY_COMPLIANT
                            ? "bg-amber-500"
                            : level.value === ComplianceStatus.NON_COMPLIANT
                            ? "bg-red-500"
                            : level.value === ComplianceStatus.NOT_APPLICABLE
                            ? "bg-slate-400"
                            : "bg-gray-400"
                        )}
                      />
                      <span>{level.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes — full width, taller, resizable so the assessor can read
              and write longer evidence narratives during the assessment */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Notes / Evidence</Label>
            <Textarea
              key={`notes-${score.id}-${score.notes ?? ""}`}
              placeholder="Document evidence or rationale..."
              defaultValue={score.notes ?? ""}
              onBlur={(e) => {
                if (e.target.value !== (score.notes ?? "")) {
                  onUpdate(score.controlId, score.status, e.target.value || null);
                }
              }}
              disabled={isSaving}
              className="min-h-[160px] text-sm resize-y"
              rows={6}
            />
          </div>

          {/* Per-control evidence attachment — pull from the org's
              evidence repo or upload a new one from /admin/evidence. */}
          <AssessmentEvidencePanel
            evidenceIds={score.evidenceLinks ?? []}
            canEdit={isEditable}
            isPending={evidenceMutation.isPending}
            onAttach={(evidenceId) =>
              evidenceMutation.mutateAsync({
                assessmentId,
                controlId: score.controlId,
                evidenceId,
                action: "attach",
              })
            }
            onDetach={(evidenceId) =>
              evidenceMutation.mutateAsync({
                assessmentId,
                controlId: score.controlId,
                evidenceId,
                action: "detach",
              })
            }
          />
        </div>
      ) : (
        /* Read-only view */
        score.notes && (
          <div className="mt-2 pt-2 border-t">
            <Label className="text-xs font-medium text-muted-foreground">Notes</Label>
            <p className="text-xs mt-1">{score.notes}</p>
          </div>
        )
      )}

      {/* Gap Description for non-compliant/partial */}
      {(score.status === ComplianceStatus.NON_COMPLIANT ||
        score.status === ComplianceStatus.PARTIALLY_COMPLIANT) &&
        score.gapDescription && (
          <div className="mt-2 pt-2 border-t border-red-200">
            <Label className="text-xs font-medium text-red-700">Gap Description</Label>
            <p className="text-xs mt-1 text-red-700">{score.gapDescription}</p>
          </div>
        )}
    </div>
  );
}

/**
 * Control Group Card - Expandable card for a group of controls
 */
function ControlGroupCard({
  group,
  assessmentId,
  statusFilter,
  isExpanded,
  onToggle,
  onUpdate,
  isSaving,
  isEditable,
  onCreateFinding,
}: {
  group: ControlGroupTree<ControlScore>;
  assessmentId: string;
  statusFilter: ComplianceStatus | "ALL";
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (controlId: string, status: ComplianceStatus, notes?: string | null) => void;
  isSaving: boolean;
  isEditable: boolean;
  onCreateFinding?: (score: ControlScore) => void;
}) {
  // Which nested controls have their children revealed. Keyed by control id.
  //
  // The group's root (the family, or a base control in a baseline-scoped
  // assessment) is a scoreable row of its own, so its members hang one level
  // below it. Start it open: the card is already a disclosure, and hiding every
  // base control behind a second chevron inside it would make the assessor click
  // twice to see anything.
  const [expandedControls, setExpandedControls] = useState<Set<string>>(
    () => new Set(group.nodes.map((node) => node.score.control.id)),
  );

  // Filtering keeps this group because something in it matches — but the match
  // can be an enhancement three levels down, hidden inside a collapsed base
  // control. Open the chain above every match so the rows the filter promised
  // are on screen the moment the group opens.
  //
  // Only on a filter change: a union, never a reset, and never re-run on a
  // re-render, so it cannot fight the chevrons the user clicks afterwards.
  useEffect(() => {
    if (statusFilter === "ALL") return;
    const reveal = ancestorsOfMatches(
      group.nodes,
      (score: ControlScore) => score.status === statusFilter,
    );
    if (reveal.size === 0) return;
    setExpandedControls((prev) => new Set([...prev, ...reveal]));
    // group.nodes is read fresh on each filter change; re-running when the tree
    // is rebuilt (after any score edit) would re-open what the user collapsed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const visibleRows = flattenTree(group.nodes, expandedControls);

  // Stats over every descendant, not just the top row — this is what turns the
  // old, lying "0/25 controls" into an honest "0/175".
  const stats = calculateGroupCompliance(allScores(group.nodes));
  const scoredCount = stats.total - stats.notAssessed;

  return (
    <Card
      className={cn(
        "transition-all duration-200",
        isExpanded && "ring-2 ring-primary shadow-md",
        stats.percentage !== null && stats.percentage >= 80 && !isExpanded && "border-l-4 border-l-green-500",
        stats.percentage !== null && stats.percentage < 80 && stats.percentage >= 50 && !isExpanded && "border-l-4 border-l-amber-500",
        stats.percentage !== null && stats.percentage < 50 && !isExpanded && "border-l-4 border-l-red-500"
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
              {group.parent.control.controlId}
            </Badge>
            <span className="font-medium">{group.parent.control.title}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {scoredCount}/{stats.total} controls
            </span>
            {stats.percentage !== null ? (
              <Badge className={getComplianceColorClass(stats.percentage)}>
                {stats.percentage.toFixed(0)}%
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                Not Assessed
              </Badge>
            )}
          </div>
        </div>
        {!isExpanded && group.parent.control.description && (
          <p className="text-sm text-muted-foreground ml-11 line-clamp-1">
            {group.parent.control.description}
          </p>
        )}
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4 pt-0">
          {/* The root's description is not repeated here: the root is now its own
              row below, with its full statement behind its Control Details
              disclosure. Printing it twice on one open card is just noise. */}

          {/* Group Stats */}
          <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Group Compliance</p>
                <p className="text-xs text-muted-foreground">Based on control assessments</p>
              </div>
              <div className="text-right">
                <div className={cn(
                  "inline-flex items-center justify-center px-4 py-2 rounded-lg font-bold",
                  getComplianceColorClass(stats.percentage)
                )}>
                  {stats.percentage !== null ? `${stats.percentage.toFixed(0)}%` : "?"}
                </div>
              </div>
            </div>
            {/* Status breakdown */}
            <div className="grid grid-cols-5 gap-2 mt-3 text-xs">
              <div className="text-center p-2 bg-green-100 rounded">
                <div className="font-bold text-green-700">{stats.compliant}</div>
                <div className="text-green-600">Compliant</div>
              </div>
              <div className="text-center p-2 bg-amber-100 rounded">
                <div className="font-bold text-amber-700">{stats.partial}</div>
                <div className="text-amber-600">Partial</div>
              </div>
              <div className="text-center p-2 bg-red-100 rounded">
                <div className="font-bold text-red-700">{stats.nonCompliant}</div>
                <div className="text-red-600">Non-Compl.</div>
              </div>
              <div className="text-center p-2 bg-slate-100 rounded">
                <div className="font-bold text-slate-700">{stats.notApplicable}</div>
                <div className="text-slate-600">N/A</div>
              </div>
              <div className="text-center p-2 bg-gray-100 rounded">
                <div className="font-bold text-gray-700">{stats.notAssessed}</div>
                <div className="text-gray-600">Unscored</div>
              </div>
            </div>
          </div>

          {/* Member controls, nested. A base control with enhancements gets an
              expand chevron; its enhancements appear indented beneath it. */}
          <div className="space-y-3">
            {visibleRows.map((node) => (
              <ControlScoringItem
                key={node.score.id}
                score={node.score}
                depth={node.depth}
                hasChildren={node.children.length > 0}
                isExpanded={expandedControls.has(node.score.control.id)}
                onToggleExpand={() =>
                  setExpandedControls((prev) => {
                    const next = new Set(prev);
                    const id = node.score.control.id;
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  })
                }
                assessmentId={assessmentId}
                onUpdate={onUpdate}
                isSaving={isSaving}
                isEditable={isEditable}
                onCreateFinding={
                  onCreateFinding
                    ? () => onCreateFinding(node.score)
                    : undefined
                }
              />
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

/**
 * Overall Compliance Score Card (sidebar)
 */
function OverallScoreCard({
  score,
  compliant,
  partial,
  nonCompliant,
  notApplicable,
  notAssessed,
  total,
}: {
  score: number | null;
  compliant: number;
  partial: number;
  nonCompliant: number;
  notApplicable: number;
  notAssessed: number;
  total: number;
}) {
  const assessed = total - notApplicable - notAssessed;
  const progress = total > 0 ? (assessed / total) * 100 : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Gauge className="h-4 w-4" />
          Overall Compliance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center py-4">
          {score !== null ? (
            <>
              <div
                className={cn(
                  "inline-flex items-center justify-center w-20 h-20 rounded-xl text-2xl font-bold mb-2",
                  getComplianceColorClass(score)
                )}
              >
                {score.toFixed(0)}%
              </div>
              <p className="font-medium">
                {score >= 80 ? "Good" : score >= 60 ? "Fair" : score >= 40 ? "Needs Work" : "Critical"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Compliance Score
              </p>
            </>
          ) : (
            <>
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-xl text-2xl font-bold mb-2 bg-gray-100 text-gray-400">
                ?
              </div>
              <p className="font-medium text-muted-foreground">Not Assessed</p>
              <p className="text-xs text-muted-foreground mt-1">
                Score controls to calculate
              </p>
            </>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">
              {assessed} / {total} controls
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Status breakdown */}
        <div className="space-y-2 pt-2 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              Compliant
            </span>
            <span className="font-medium">{compliant}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Partial
            </span>
            <span className="font-medium">{partial}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              Non-Compliant
            </span>
            <span className="font-medium">{nonCompliant}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              N/A
            </span>
            <span className="font-medium">{notApplicable}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gray-400" />
              Not Assessed
            </span>
            <span className="font-medium">{notAssessed}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Actions Card (sidebar)
 */
function ActionsCard({
  status,
  onStart,
  onSubmit,
  onApprove,
  isStarting,
  isSubmitting,
  isApproving,
  canSubmit,
}: {
  status: ComplianceAssessmentStatus;
  onStart: () => void;
  onSubmit: () => void;
  onApprove: () => void;
  isStarting: boolean;
  isSubmitting: boolean;
  isApproving: boolean;
  canSubmit: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {status === ComplianceAssessmentStatus.DRAFT && (
          <Button
            className="w-full justify-start"
            onClick={onStart}
            disabled={isStarting}
          >
            {isStarting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Start Assessment
          </Button>
        )}
        {status === ComplianceAssessmentStatus.IN_PROGRESS && (
          <Button
            className="w-full justify-start"
            onClick={onSubmit}
            disabled={isSubmitting || !canSubmit}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Submit for Review
          </Button>
        )}
        {status === ComplianceAssessmentStatus.IN_REVIEW && (
          <Button
            className="w-full justify-start"
            onClick={onApprove}
            disabled={isApproving}
          >
            {isApproving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Check className="h-4 w-4 mr-2" />
            )}
            Approve Assessment
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Tabbed-workspace scaffolding
// =============================================================================

type AssessmentTab =
  | "overview"
  | "controls"
  | "findings"
  | "risks"
  | "schedule"
  | "stakeholders"
  | "evidence"
  | "pathways"
  | "action-plans"
  | "summary";

const TABS: Array<{
  id: AssessmentTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  // 2026-07-06: tab order aligned across assessments (risk-assessment order):
  // Executive Summary leads, Schedule + Stakeholders follow Overview.
  { id: "summary", label: "Executive Summary", icon: BarChart3 },
  { id: "overview", label: "Overview", icon: FileText },
  { id: "schedule", label: "Schedule", icon: Calendar },
  { id: "stakeholders", label: "Stakeholders", icon: Users },
  { id: "controls", label: "Controls", icon: Shield },
  { id: "findings", label: "Findings", icon: Bug },
  { id: "risks", label: "Risks", icon: ShieldAlert },
  { id: "evidence", label: "Evidence", icon: FolderOpen },
  { id: "pathways", label: "Exploitation Pathways", icon: Network },
  { id: "action-plans", label: "Action Plans", icon: ListChecks },
];

// =============================================================================
// Main Component
// =============================================================================

interface ComplianceAssessmentDetailClientProps {
  assessmentId: string;
}

export function ComplianceAssessmentDetailClient({
  assessmentId,
}: ComplianceAssessmentDetailClientProps) {
  const router = useRouter();
  const utils = api.useUtils();

  const [isMounted, setIsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<AssessmentTab>("summary");
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ComplianceStatus | "ALL">(
    "ALL"
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  // Inline finding creation state — captures which control the dialog is for
  const [findingDialogOpen, setFindingDialogOpen] = useState(false);
  const [findingContext, setFindingContext] = useState<{
    controlId: string;
    controlCode: string;
    controlTitle: string;
    controlDescription: string | null;
  } | null>(null);
  // Inline risk creation state — mirrors findingContext.

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Fetch assessment data
  const {
    data: assessment,
    isLoading,
    error,
  } = api.complianceAssessment.getById.useQuery(
    { id: assessmentId },
    { enabled: !!assessmentId }
  );

  // Mutations
  const updateControlMutation = api.complianceAssessment.updateControlScore.useMutation({
    onSuccess: () => {
      void utils.complianceAssessment.getById.invalidate({ id: assessmentId });
    },
    onError: (error) => {
      toast.error(`Failed to save: ${error.message}`);
    },
  });

  const startMutation = api.complianceAssessment.start.useMutation({
    onSuccess: () => {
      toast.success("Assessment started");
      void utils.complianceAssessment.getById.invalidate({ id: assessmentId });
    },
    onError: (error) => {
      toast.error(`Failed to start: ${error.message}`);
    },
  });

  const submitMutation = api.complianceAssessment.submitForReview.useMutation({
    onSuccess: () => {
      toast.success("Assessment submitted for review");
      void utils.complianceAssessment.getById.invalidate({ id: assessmentId });
    },
    onError: (error) => {
      toast.error(`Failed to submit: ${error.message}`);
    },
  });

  const approveMutation = api.complianceAssessment.approve.useMutation({
    onSuccess: () => {
      toast.success("Assessment approved");
      void utils.complianceAssessment.getById.invalidate({ id: assessmentId });
    },
    onError: (error) => {
      toast.error(`Failed to approve: ${error.message}`);
    },
  });

  const deleteMutation = api.complianceAssessment.delete.useMutation({
    onSuccess: () => {
      toast.success("Assessment deleted");
      router.push("/compliance/assessments");
    },
    onError: (error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  // Group controls into a real tree. 800-53 is three levels deep (family ->
  // base control -> enhancement); the old two-level grouping dropped all 872
  // enhancements on the floor.
  const controlGroups = useMemo(
    () => buildControlTree(assessment?.controlScores ?? []),
    [assessment?.controlScores],
  );

  // Status filter: show only groups that contain at least one control with the
  // selected status — at ANY depth, so a matching enhancement keeps its family
  // visible. The group renders its full tree once opened, so the assessor can
  // still see a match in the context of its siblings and parent — and the card
  // auto-expands the chain above every match so none of them stays buried.
  const filteredControlGroups = useMemo(() => {
    if (statusFilter === "ALL") return controlGroups;
    return controlGroups.filter((group) =>
      allScores(group.nodes).some((score) => score.status === statusFilter)
    );
  }, [controlGroups, statusFilter]);

  // Calculate bar chart data
  const barData = useMemo(() => {
    return controlGroups.map(group => {
      const stats = calculateGroupCompliance(allScores(group.nodes));
      const compliance = stats.percentage ?? 0;
      return {
        name: group.parent.control.title,
        code: group.parent.control.controlId,
        compliance,
        fill: compliance >= 80 ? "#22c55e" : compliance >= 60 ? "#84cc16" : compliance >= 40 ? "#f59e0b" : "#ef4444",
      };
    });
  }, [controlGroups]);

  // Handlers
  const handleUpdateControl = (controlId: string, status: ComplianceStatus, notes?: string | null) => {
    updateControlMutation.mutate({
      assessmentId,
      controlId,
      status,
      notes,
    });
  };

  const handleStart = () => {
    startMutation.mutate({ id: assessmentId });
    // Expand first group
    if (controlGroups.length > 0 && !expandedGroup) {
      setExpandedGroup(controlGroups[0]!.parent.control.id);
    }
  };

  const handleDelete = () => {
    deleteMutation.mutate({ id: assessmentId });
  };

  // Check if assessment is editable
  const isEditable = assessment?.status === ComplianceAssessmentStatus.DRAFT ||
    assessment?.status === ComplianceAssessmentStatus.IN_PROGRESS;

  // Breadcrumbs
  const breadcrumbs = [
    { label: "Compliance", href: "/compliance/assessments" },
    { label: "Assessments", href: "/compliance/assessments" },
    { label: assessment?.identifier || "Assessment" },
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
            <Button variant="outline" onClick={() => router.push("/compliance/assessments")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Assessments
            </Button>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  // Extract data
  const statusConfig = STATUS_CONFIG[assessment.status];
  const StatusIcon = statusConfig.icon;

  // Calculate overall metrics
  const complianceScore = assessment.complianceScore
    ? Number(assessment.complianceScore)
    : null;

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <div className="container mx-auto py-6 space-y-6">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/compliance/assessments")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Assessments
        </Button>

        {/* Tab nav — underline style (matches risk workspace) */}
        <div className="border-b overflow-x-auto" role="tablist">
          <nav className="flex -mb-px min-w-max">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-colors whitespace-nowrap",
                    isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab content */}
        <div role="tabpanel">
          {/* ---- Overview ---- */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Header Card */}
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Badge variant="outline">
                          {assessment.framework.name}
                        </Badge>
                        <Badge className={statusConfig.color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusConfig.label}
                        </Badge>
                        {assessment.businessUnit && (
                          <Badge variant="secondary">
                            <Building2 className="h-3 w-3 mr-1" />
                            {assessment.businessUnit.code || assessment.businessUnit.name}
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-2xl">{assessment.name}</CardTitle>
                      <CardDescription>
                        {assessment.identifier} | {assessment.framework.code} v{assessment.framework.version}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href={`/api/compliance/assessments/${assessmentId}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Export PDF
                        </a>
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
                    {assessment.dueDate && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>Due {format(new Date(assessment.dueDate), "MMM d, yyyy")}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Score / stats summary + actions */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                  {/* Bar Chart */}
                  {barData.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Target className="h-4 w-4" />
                          Compliance by Control Group
                        </CardTitle>
                        <CardDescription>
                          Visual overview of compliance across control groups
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {(() => {
                          const hasData = barData.some(d => d.compliance > 0);

                          if (!hasData) {
                            return (
                              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                                <div className="text-center">
                                  <Target className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                  <p>No compliance data yet</p>
                                  <p className="text-sm mt-1">Score controls to see the chart</p>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div className="h-[350px]">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                  data={barData}
                                  layout="vertical"
                                  margin={{ top: 10, right: 30, left: 60, bottom: 10 }}
                                >
                                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                  <XAxis
                                    type="number"
                                    domain={[0, 100]}
                                    tickFormatter={(value) => `${value}%`}
                                    tick={{ fontSize: 11 }}
                                  />
                                  <YAxis
                                    type="category"
                                    dataKey="code"
                                    tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }}
                                    width={50}
                                  />
                                  <ReferenceLine x={80} stroke="#22c55e" strokeDasharray="3 3" label={{ value: "Target", fontSize: 10, fill: "#22c55e" }} />
                                  <RechartsTooltip
                                    content={({ active, payload }) => {
                                      if (!active || !payload?.length) return null;
                                      const data = payload[0]?.payload as { name: string; code: string; compliance: number; fill: string };
                                      return (
                                        <div className="bg-popover border rounded-lg shadow-lg p-3 text-sm">
                                          <p className="font-medium mb-1">{data.name}</p>
                                          <p className="text-xs text-muted-foreground">{data.code}</p>
                                          <div className="mt-2 flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: data.fill }} />
                                            <span>Compliance: {data.compliance.toFixed(0)}%</span>
                                          </div>
                                        </div>
                                      );
                                    }}
                                  />
                                  <Bar dataKey="compliance" radius={[0, 4, 4, 0]}>
                                    {barData.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          );
                        })()}
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Sidebar */}
                <div className="space-y-4">
                  <OverallScoreCard
                    score={complianceScore}
                    compliant={assessment.compliantCount}
                    partial={assessment.partialCount}
                    nonCompliant={assessment.nonCompliantCount}
                    notApplicable={assessment.notApplicableCount}
                    notAssessed={assessment.notAssessedCount}
                    total={assessment.totalControls}
                  />

                  <ActionsCard
                    status={assessment.status}
                    onStart={handleStart}
                    onSubmit={() => submitMutation.mutate({ id: assessmentId })}
                    onApprove={() => approveMutation.mutate({ id: assessmentId })}
                    isStarting={startMutation.isPending}
                    isSubmitting={submitMutation.isPending}
                    isApproving={approveMutation.isPending}
                    canSubmit={assessment.notAssessedCount === 0}
                  />

                  {/* Baseline Info */}
                  {assessment.baseline && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          Baseline
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Badge variant="outline">
                          {assessment.baseline.charAt(0) + assessment.baseline.slice(1).toLowerCase()} Baseline
                        </Badge>
                      </CardContent>
                    </Card>
                  )}

                  {/* Assessment Info */}
                  {assessment.assessor && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Assessor
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-xs">
                              {getInitials(assessment.assessor.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">
                            {assessment.assessor.name || assessment.assessor.email}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ---- Controls ---- */}
          {activeTab === "controls" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Control Assessments ({filteredControlGroups.length}
                  {statusFilter !== "ALL" && ` of ${controlGroups.length}`}{" "}
                  groups)
                </h2>
                {assessment.status === ComplianceAssessmentStatus.DRAFT && (
                  <Button onClick={handleStart} disabled={startMutation.isPending}>
                    {startMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4 mr-2" />
                    )}
                    Start Assessment
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground shrink-0">
                  Filter by status:
                </Label>
                <Select
                  value={statusFilter}
                  onValueChange={(v) =>
                    setStatusFilter(v as ComplianceStatus | "ALL")
                  }
                >
                  <SelectTrigger className="w-[220px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All ({controlGroups.length})</SelectItem>
                    {COMPLIANCE_LEVELS.map((level) => (
                      <SelectItem key={level.value} value={level.value}>
                        {level.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                {filteredControlGroups.length === 0 ? (
                  <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                    No controls match the selected status.
                  </div>
                ) : (
                  filteredControlGroups.map((group) => (
                    <ControlGroupCard
                      key={group.parent.control.id}
                      group={group}
                      assessmentId={assessmentId}
                      statusFilter={statusFilter}
                      isExpanded={expandedGroup === group.parent.control.id}
                      onToggle={() =>
                        setExpandedGroup(
                          expandedGroup === group.parent.control.id
                            ? null
                            : group.parent.control.id
                        )
                      }
                      onUpdate={handleUpdateControl}
                      isSaving={updateControlMutation.isPending}
                      isEditable={isEditable}
                      onCreateFinding={(childScore) => {
                        setFindingContext({
                          controlId: childScore.control.id,
                          controlCode: childScore.control.controlId,
                          controlTitle: childScore.control.title,
                          controlDescription: childScore.control.description,
                        });
                        setFindingDialogOpen(true);
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          )}

          {/* ---- Findings ---- */}
          {activeTab === "findings" && (
            <AssessmentFindingsList
              assessmentId={assessmentId}
              assessmentType="COMPLIANCE"
            />
          )}

          {/* ---- Risks ---- */}
          {activeTab === "risks" && (
            <AssessmentRisksList
              assessmentId={assessmentId}
              assessmentType="COMPLIANCE"
            />
          )}

          {/* ---- Consulting wrapper tabs (Schedule / Stakeholders / Evidence /
                  Exploitation Pathways / Action Plans) — shared module ---- */}
          {(activeTab === "schedule" ||
            activeTab === "stakeholders" ||
            activeTab === "evidence" ||
            activeTab === "pathways" ||
            activeTab === "action-plans") && (
            <WrapperTabPanel
              tab={activeTab}
              assessmentKind="COMPLIANCE"
              assessmentId={assessmentId}
              clientName={assessment.name}
            />
          )}

          {/* ---- Executive Summary (deliverable inline) ---- */}
          {activeTab === "summary" && (
            <ExecutiveSummaryTab
              assessmentKind="COMPLIANCE"
              assessmentId={assessmentId}
            />
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Assessment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{assessment.name}" and all associated
              control scores. This action cannot be undone.
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

      {/* Inline "Create Finding" dialog — one instance, context swapped per
          control via findingContext state. */}
      {findingContext && (
        <CreateFindingDialog
          open={findingDialogOpen}
          onOpenChange={setFindingDialogOpen}
          initialTitle={`${findingContext.controlCode} — ${findingContext.controlTitle}`}
          initialDescription={
            findingContext.controlDescription
              ? `Observed during assessment "${assessment.name}" (${assessment.identifier}):\n\n${findingContext.controlDescription}`
              : `Observed during assessment "${assessment.name}" (${assessment.identifier}) against ${findingContext.controlCode} — ${findingContext.controlTitle}.`
          }
          contextLabel={`Linked to ${findingContext.controlCode} — ${findingContext.controlTitle}`}
          controlId={findingContext.controlId}
          complianceAssessmentId={assessment.id}
        />
      )}

    </AppLayout>
  );
}
