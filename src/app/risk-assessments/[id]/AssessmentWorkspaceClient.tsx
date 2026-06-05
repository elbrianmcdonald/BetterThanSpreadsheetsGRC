"use client";

/**
 * Assessment Workspace — tabbed view of a RiskAssessmentProject.
 *
 * Story 4: scaffolds the tab structure (Overview / Identified Risks /
 * Controls / Evidence / Remediation / Comments / Audit Trail / History).
 * Overview is the only fully-populated tab; Identified Risks is a stub
 * filled in by story 5; the aggregation tabs are filled by story 6.
 */

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { UserRole } from "@prisma/client";
import toast from "react-hot-toast";
import {
  Pencil,
  X as XIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { PersonPicker } from "@/components/person/PersonPicker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import Link from "next/link";
import { format } from "date-fns";
import {
  AlertTriangle,
  Bug,
  Calendar,
  ClipboardCheck,
  FileText,
  FolderOpen,
  History,
  ListTree,
  MessageSquare,
  Shield,
  User,
  Wrench,
  Loader2,
} from "lucide-react";
import { AssessmentProjectStatus } from "@prisma/client";

import { api, type RouterOutputs } from "@/trpc/react";
import { IdentifiedRisksEditor } from "@/components/risk-assessment-project/IdentifiedRisksEditor";
import { AssessmentFindingsTab } from "@/components/risk-assessment-project/AssessmentFindingsTab";
import { QuestionnaireTab } from "@/components/risk-assessment-project/QuestionnaireTab";
import { ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface AssessmentWorkspaceClientProps {
  projectId: string;
}

type Tab =
  | "overview"
  | "questionnaire"
  | "identified-risks"
  | "findings"
  | "controls"
  | "evidence"
  | "remediation"
  | "comments"
  | "audit-trail"
  | "history";

interface TabConfig {
  id: Tab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  countKey?: "identifiedRisksCount" | "questionnaireUnanswered" | "findingsCount";
}

const TABS: TabConfig[] = [
  { id: "overview", label: "Overview", icon: FileText },
  { id: "questionnaire", label: "Questionnaire", icon: ClipboardList, countKey: "questionnaireUnanswered" },
  { id: "identified-risks", label: "Identified Risks", icon: ListTree, countKey: "identifiedRisksCount" },
  { id: "findings", label: "Findings", icon: Bug, countKey: "findingsCount" },
  { id: "controls", label: "Controls", icon: Shield },
  { id: "evidence", label: "Evidence", icon: FolderOpen },
  { id: "remediation", label: "Remediation", icon: Wrench },
  { id: "comments", label: "Comments", icon: MessageSquare },
  { id: "audit-trail", label: "Audit Trail", icon: History },
  { id: "history", label: "History", icon: Calendar },
];

const STATUS_BADGE: Record<AssessmentProjectStatus, string> = {
  IN_PROGRESS: "bg-blue-100 text-blue-800 border-blue-300",
  SUBMITTED: "bg-amber-100 text-amber-800 border-amber-300",
  APPROVED: "bg-green-100 text-green-800 border-green-300",
};

export function AssessmentWorkspaceClient({ projectId }: AssessmentWorkspaceClientProps) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const { data: project, isLoading, error } = api.riskAssessmentProject.getById.useQuery({
    id: projectId,
  });

  // Hooks must be called in the same order every render — keep before any early return.
  const { data: questionnaireCounts } =
    api.riskAssessmentQuestionnaire.getCompletionSummary.useQuery({
      projectId,
    });

  // Drives the Findings tab badge; the same query backs the tab itself (cached).
  const { data: projectFindings } = api.finding.listForProject.useQuery({
    projectId,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-3" />
        <h3 className="text-lg font-semibold">Assessment not found</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {error?.message ?? "This assessment doesn't exist or you don't have access."}
        </p>
        <Link href="/risk-assessments" className="mt-4">
          <Button variant="outline">Back to Risk Assessments</Button>
        </Link>
      </div>
    );
  }

  const counts = {
    identifiedRisksCount: project.discoveredRisks?.length ?? 0,
    findingsCount: projectFindings?.length ?? 0,
    questionnaireUnanswered:
      questionnaireCounts?.attached === true
        ? questionnaireCounts.total - questionnaireCounts.answered
        : 0,
  };

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="rounded-lg bg-primary/10 p-3 shrink-0">
            <ClipboardCheck className="h-7 w-7 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold truncate">{project.subject}</h1>
              <Badge
                variant="outline"
                className={cn("font-medium", STATUS_BADGE[project.status])}
              >
                {project.status.replace("_", " ")}
              </Badge>
            </div>
            <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
              {project.assignee?.name && (
                <span className="flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  {project.assignee.name}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Due {format(new Date(project.dueDate), "PP")}
              </span>
            </div>
          </div>
        </div>
        <WorkflowActions project={project} />
      </div>

      {/* Treatment progress aggregate */}
      <TreatmentProgressCard projectId={projectId} />

      {/* Tabs */}
      <div className="border-b overflow-x-auto" role="tablist">
        <nav className="flex -mb-px min-w-max">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const count = tab.countKey ? counts[tab.countKey] : undefined;
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
                {count !== undefined && count > 0 && (
                  <span
                    className={cn(
                      "ml-1 rounded-full px-2 py-0.5 text-xs font-medium",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab content */}
      <div role="tabpanel">
        {activeTab === "overview" && <OverviewTab project={project} />}
        {activeTab === "questionnaire" && (
          <QuestionnaireTab
            projectId={projectId}
            isReadOnly={project.status !== "IN_PROGRESS"}
          />
        )}
        {activeTab === "identified-risks" && (
          <IdentifiedRisksEditor
            projectId={projectId}
            isReadOnly={project.status !== "IN_PROGRESS"}
          />
        )}
        {activeTab === "findings" && (
          <AssessmentFindingsTab
            projectId={projectId}
            isReadOnly={project.status !== "IN_PROGRESS"}
          />
        )}
        {activeTab === "controls" && <ControlsAggregateTab projectId={projectId} />}
        {activeTab === "evidence" && <EvidenceAggregateTab projectId={projectId} />}
        {activeTab === "remediation" && <RemediationAggregateTab projectId={projectId} />}
        {activeTab === "comments" && <CommentsTab projectId={projectId} />}
        {activeTab === "audit-trail" && <AuditTrailTab projectId={projectId} />}
        {activeTab === "history" && <HistoryTab project={project} />}
      </div>
    </div>
  );
}

function StubTab({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
      <Loader2 className="h-8 w-8 mb-3 opacity-50" />
      <p className="text-sm max-w-md">{message}</p>
    </div>
  );
}

type ProjectData = NonNullable<RouterOutputs["riskAssessmentProject"]["getById"]>;

function OverviewTab({ project }: { project: ProjectData }) {
  const lossRange =
    project.inheritedLossMinimum ||
    project.inheritedLossProbable ||
    project.inheritedLossMaximum
      ? {
          min: project.inheritedLossMinimum,
          probable: project.inheritedLossProbable,
          max: project.inheritedLossMaximum,
          snapshotAt: project.inheritedLossSnapshotAt,
        }
      : null;

  return (
    <div className="space-y-6">
      <EditableAssessmentDetails project={project} />

      {(project.linkedAsset || project.linkedBusinessProcess || lossRange) && (
        <Card>
          <CardHeader>
            <CardTitle>Loss Event Range</CardTitle>
            <CardDescription>
              Inherited from a linked asset and/or business process. Snapshot is frozen at link time and applies to all child risks.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {project.linkedAsset && (
                <Field
                  label="Linked Asset"
                  value={`${project.linkedAsset.identifier} — ${project.linkedAsset.name}`}
                />
              )}
              {project.linkedBusinessProcess && (
                <Field
                  label="Linked Business Process"
                  value={`${project.linkedBusinessProcess.identifier} — ${project.linkedBusinessProcess.name}`}
                />
              )}
            </div>
            {lossRange && (
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Minimum" value={formatMoney(lossRange.min)} />
                <Field label="Probable" value={formatMoney(lossRange.probable)} />
                <Field label="Maximum" value={formatMoney(lossRange.max)} />
              </div>
            )}
            {lossRange?.snapshotAt && (
              <p className="text-xs text-muted-foreground">
                Snapshot taken {format(new Date(lossRange.snapshotAt), "PPp")}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Risk Matrix</CardTitle>
          <CardDescription>
            Locked at creation time. All identified risks are scored against this matrix.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {project.matrixVersion ? (
            <>
              <Field
                label="Template"
                value={project.matrixVersion.template.name}
              />
              <Field
                label="Version"
                value={`v${project.matrixVersion.versionNumber}`}
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No risk matrix linked.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function HistoryTab({ project }: { project: ProjectData }) {
  const hasParent = !!project.parentAssessment;
  const hasChildren = (project.childAssessments?.length ?? 0) > 0;

  if (!hasParent && !hasChildren) {
    return (
      <StubTab message="No reassessment chain. This is a standalone assessment." />
    );
  }

  return (
    <div className="space-y-6">
      {hasParent && project.parentAssessment && (
        <Card>
          <CardHeader>
            <CardTitle>Parent Assessment</CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href={`/risk-assessments/${project.parentAssessment.id}`}
              className="text-primary hover:underline"
            >
              {project.parentAssessment.subject}
            </Link>
            <p className="text-sm text-muted-foreground mt-1">
              Status: {project.parentAssessment.status.replace("_", " ")}
            </p>
          </CardContent>
        </Card>
      )}
      {hasChildren && (
        <Card>
          <CardHeader>
            <CardTitle>Reassessments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {project.childAssessments.map((child) => (
              <div key={child.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                <Link
                  href={`/risk-assessments/${child.id}`}
                  className="text-primary hover:underline"
                >
                  {child.subject}
                </Link>
                <span className="text-sm text-muted-foreground">
                  {child.status.replace("_", " ")} · {format(new Date(child.createdAt), "PP")}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-sm font-medium">{label}</p>
      <div className="text-sm text-muted-foreground mt-0.5 whitespace-pre-wrap">
        {value}
      </div>
    </div>
  );
}

function formatMoney(value: unknown): string {
  if (value === null || value === undefined) return "—";
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

const CONTROL_ROLE_BADGE: Record<string, string> = {
  IN_PLACE: "bg-green-100 text-green-800 border-green-300",
  NEEDED: "bg-amber-100 text-amber-800 border-amber-300",
  MITIGATING: "bg-blue-100 text-blue-800 border-blue-300",
  GAP: "bg-red-100 text-red-800 border-red-300",
  AFFECTED: "bg-slate-100 text-slate-800 border-slate-300",
};

function ControlsAggregateTab({ projectId }: { projectId: string }) {
  const { data, isLoading } = api.riskAssessmentProject.getControlsAggregate.useQuery({
    projectId,
  });
  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground border border-dashed rounded-lg">
        <Shield className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">No controls linked to any identified risk yet.</p>
      </div>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Controls Roll-up</CardTitle>
        <CardDescription>
          Every control linked to any identified risk in this assessment.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground uppercase">
            <tr className="border-b">
              <th className="text-left py-2 font-medium">Control</th>
              <th className="text-left py-2 font-medium">Source</th>
              <th className="text-left py-2 font-medium">Role</th>
              <th className="text-left py-2 font-medium">Risk</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={`${row.source}-${row.controlIdentifier}-${row.riskId}`} className="border-b last:border-0">
                <td className="py-2">
                  <div className="font-medium">{row.controlTitle}</div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {row.controlIdentifier}
                    {row.frameworkCode ? ` · ${row.frameworkCode}` : ""}
                  </div>
                </td>
                <td className="py-2 capitalize text-muted-foreground">{row.source}</td>
                <td className="py-2">
                  <Badge
                    variant="outline"
                    className={cn("font-medium", CONTROL_ROLE_BADGE[row.role] ?? "")}
                  >
                    {row.role.replace("_", " ")}
                  </Badge>
                </td>
                <td className="py-2 text-muted-foreground">
                  {row.riskIdentifier ? (
                    <Link href={`/risks/${row.riskId}`} className="hover:underline text-primary">
                      {row.riskIdentifier}
                    </Link>
                  ) : (
                    <span>—</span>
                  )}
                  <div className="text-xs">{row.riskTitle}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function EvidenceAggregateTab({ projectId }: { projectId: string }) {
  const { data, isLoading } = api.riskAssessmentProject.getEvidenceAggregate.useQuery({
    projectId,
  });
  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground border border-dashed rounded-lg">
        <FolderOpen className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">No evidence attached to any identified risk yet.</p>
      </div>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Evidence Roll-up</CardTitle>
        <CardDescription>
          Every file linked to any identified risk in this assessment.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground uppercase">
            <tr className="border-b">
              <th className="text-left py-2 font-medium">Evidence</th>
              <th className="text-left py-2 font-medium">Type</th>
              <th className="text-left py-2 font-medium">Linked Risk</th>
              <th className="text-left py-2 font-medium">Linked At</th>
            </tr>
          </thead>
          <tbody>
            {data.map((link) => (
              <tr key={link.id} className="border-b last:border-0">
                <td className="py-2">
                  <div className="font-medium">{link.Evidence.title || link.Evidence.originalFileName}</div>
                  <div className="text-xs text-muted-foreground">{link.Evidence.originalFileName}</div>
                </td>
                <td className="py-2 text-muted-foreground capitalize">{link.linkType.toLowerCase()}</td>
                <td className="py-2">
                  {link.Risk.identifier ? (
                    <Link href={`/risks/${link.Risk.id}`} className="hover:underline text-primary">
                      {link.Risk.identifier}
                    </Link>
                  ) : (
                    <span>—</span>
                  )}
                  <div className="text-xs text-muted-foreground">{link.Risk.title}</div>
                </td>
                <td className="py-2 text-muted-foreground">
                  {format(new Date(link.linkedAt), "PP")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

const TREATMENT_BADGE: Record<string, string> = {
  REMEDIATE: "bg-green-100 text-green-800 border-green-300",
  ACCEPT: "bg-blue-100 text-blue-800 border-blue-300",
  TRANSFER: "bg-purple-100 text-purple-800 border-purple-300",
  AVOID: "bg-orange-100 text-orange-800 border-orange-300",
};

function EditableAssessmentDetails({ project }: { project: ProjectData }) {
  const { data: session } = useSession();
  const utils = api.useUtils();
  const userRole = session?.user?.role as UserRole | undefined;
  const userId = session?.user?.id;

  const isAdmin = userRole === UserRole.ORG_ADMIN;
  const isAssignee = project.assigneeId === userId;
  const canEdit =
    project.status === "IN_PROGRESS" && (isAdmin || isAssignee);

  const [isEditing, setIsEditing] = useState(false);
  const [description, setDescription] = useState(project.description ?? "");
  const [riskOwnerId, setRiskOwnerId] = useState<string | null>(
    project.riskOwnerId ?? null
  );
  const [assigneeId, setAssigneeId] = useState<string | null>(
    project.assigneeId ?? null
  );
  const [dueDate, setDueDate] = useState<Date>(new Date(project.dueDate));

  // Hydrate state when project data refreshes
  useEffect(() => {
    setDescription(project.description ?? "");
    setRiskOwnerId(project.riskOwnerId ?? null);
    setAssigneeId(project.assigneeId ?? null);
    setDueDate(new Date(project.dueDate));
  }, [project.description, project.riskOwnerId, project.assigneeId, project.dueDate]);

  const { data: usersData } = api.user.listUsers.useQuery(
    {},
    { enabled: isEditing }
  );

  const updateMutation = api.riskAssessmentProject.updateDetails.useMutation({
    onSuccess: () => {
      toast.success("Assessment details updated");
      void utils.riskAssessmentProject.getById.invalidate({ id: project.id });
      setIsEditing(false);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update");
    },
  });

  const handleCancel = () => {
    setDescription(project.description ?? "");
    setRiskOwnerId(project.riskOwnerId ?? null);
    setAssigneeId(project.assigneeId ?? null);
    setDueDate(new Date(project.dueDate));
    setIsEditing(false);
  };

  const handleSave = () => {
    updateMutation.mutate({
      id: project.id,
      description: description || null,
      riskOwnerId,
      assigneeId,
      dueDate,
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>Assessment Details</CardTitle>
          <CardDescription>
            Description and ownership information for this risk assessment.
          </CardDescription>
        </div>
        {canEdit && !isEditing && (
          <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
            <Pencil className="h-4 w-4 mr-1" />
            Edit
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {!isEditing ? (
          <>
            <Field
              label="Description"
              value={
                project.description ?? (
                  <span className="text-muted-foreground italic">
                    No description provided.
                  </span>
                )
              }
            />
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Created By" value={project.createdBy?.name ?? "—"} />
              <Field
                label="Assigned To"
                value={
                  project.assignee?.name ?? (
                    <span className="text-muted-foreground italic">Unassigned</span>
                  )
                }
              />
              <Field
                label="Risk Owner"
                value={
                  project.riskOwner?.name ?? (
                    <span className="text-muted-foreground italic">
                      No risk owner assigned
                    </span>
                  )
                }
              />
              <Field label="Due Date" value={format(new Date(project.dueDate), "PPP")} />
            </div>
          </>
        ) : (
          <>
            <div className="space-y-1">
              <Label htmlFor="ax-desc">Description</Label>
              <Textarea
                id="ax-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the scope and objectives of this assessment..."
                className="min-h-[100px]"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Assigned To</Label>
                <Select
                  value={assigneeId ?? "__unassigned__"}
                  onValueChange={(v) =>
                    setAssigneeId(v === "__unassigned__" ? null : v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__unassigned__">Unassigned</SelectItem>
                    {usersData?.users?.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name || u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Due Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full pl-3 text-left font-normal",
                        !dueDate && "text-muted-foreground"
                      )}
                    >
                      {dueDate
                        ? format(dueDate, "PPP")
                        : <span>Pick a date</span>}
                      <Calendar className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={dueDate}
                      onSelect={(d) => d && setDueDate(d)}
                      disabled={(d) =>
                        d < new Date(new Date().setHours(0, 0, 0, 0))
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label>Risk Owner</Label>
                <PersonPicker
                  value={riskOwnerId}
                  onChange={(v) => setRiskOwnerId(v ?? null)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={updateMutation.isPending}
              >
                <XIcon className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : null}
                Save
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function TreatmentProgressCard({ projectId }: { projectId: string }) {
  const { data, isLoading } = api.riskAssessmentProject.getTreatmentProgress.useQuery({
    projectId,
  });
  if (isLoading || !data || data.total === 0) return null;

  const planned = data.withPlan + data.accepted;
  const pct = data.total > 0 ? Math.round((planned / data.total) * 100) : 0;

  const items: Array<{ label: string; value: number; tone: string }> = [
    { label: "Total Risks", value: data.total, tone: "text-foreground" },
    { label: "Remediating", value: data.withPlan, tone: "text-green-700 dark:text-green-400" },
    { label: "Accepted", value: data.accepted, tone: "text-blue-700 dark:text-blue-400" },
    { label: "No Decision", value: data.undecided, tone: "text-amber-700 dark:text-amber-400" },
    { label: "SLA Breached", value: data.breached, tone: "text-red-700 dark:text-red-400" },
    { label: "Completed", value: data.completed, tone: "text-emerald-700 dark:text-emerald-400" },
  ];

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-6 flex-wrap">
            {items.map((it) => (
              <div key={it.label} className="flex flex-col">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">
                  {it.label}
                </span>
                <span className={cn("text-2xl font-semibold", it.tone)}>
                  {it.value}
                </span>
              </div>
            ))}
          </div>
          <div className="flex flex-col items-end min-w-[140px]">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">
              Treatment Progress
            </span>
            <span className="text-2xl font-semibold">{pct}%</span>
            <div className="mt-1 h-2 w-32 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RemediationAggregateTab({ projectId }: { projectId: string }) {
  const { data, isLoading } = api.riskAssessmentProject.getRemediationAggregate.useQuery({
    projectId,
  });
  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground border border-dashed rounded-lg">
        <Wrench className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">No identified risks yet.</p>
      </div>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Treatment Roll-up</CardTitle>
        <CardDescription>
          Treatment decision and progress for every identified risk.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground uppercase">
            <tr className="border-b">
              <th className="text-left py-2 font-medium">Risk</th>
              <th className="text-left py-2 font-medium">Treatment</th>
              <th className="text-left py-2 font-medium">Plan / Justification</th>
              <th className="text-left py-2 font-medium">Due / Review</th>
              <th className="text-left py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.riskId} className="border-b last:border-0 align-top">
                <td className="py-2">
                  {row.riskIdentifier && (
                    <Link href={`/risks/${row.riskId}`} className="hover:underline text-primary text-xs font-mono">
                      {row.riskIdentifier}
                    </Link>
                  )}
                  <div className="font-medium">{row.riskTitle}</div>
                </td>
                <td className="py-2">
                  {row.treatmentType ? (
                    <Badge
                      variant="outline"
                      className={cn("font-medium", TREATMENT_BADGE[row.treatmentType] ?? "")}
                    >
                      {row.treatmentType}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground italic">No decision</span>
                  )}
                </td>
                <td className="py-2 text-muted-foreground max-w-md">
                  {row.plan ? (
                    <span className="line-clamp-2">{row.plan}</span>
                  ) : (
                    <span className="italic">—</span>
                  )}
                </td>
                <td className="py-2 text-muted-foreground">
                  {row.dueDate ? format(new Date(row.dueDate), "PP") : "—"}
                </td>
                <td className="py-2">
                  {row.completedAt ? (
                    <Badge className="bg-green-600 text-white">Completed</Badge>
                  ) : row.slaBreached ? (
                    <Badge className="bg-red-600 text-white">SLA Breached</Badge>
                  ) : row.actionStatus ? (
                    <span className="text-xs text-muted-foreground">
                      {row.actionStatus.replace(/_/g, " ").toLowerCase()}
                    </span>
                  ) : (
                    <span className="text-muted-foreground italic">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function WorkflowActions({ project }: { project: ProjectData }) {
  const { data: session } = useSession();
  const utils = api.useUtils();
  const userRole = session?.user?.role as UserRole | undefined;
  const userId = session?.user?.id;

  const isAdmin = userRole === UserRole.ORG_ADMIN;
  const isCiso = userRole === UserRole.CISO;
  const isAssignee = project.assigneeId === userId;
  const riskCount = project.discoveredRisks?.length ?? 0;

  const refreshAll = () => {
    void utils.riskAssessmentProject.getById.invalidate({ id: project.id });
    void utils.riskAssessmentProject.getAuditTrail.invalidate({
      projectId: project.id,
    });
  };

  const submitMutation = api.riskAssessmentProject.submit.useMutation({
    onSuccess: () => {
      toast.success("Assessment submitted for review");
      refreshAll();
    },
    onError: (e) => toast.error(e.message),
  });
  const approveMutation = api.riskAssessmentProject.approve.useMutation({
    onSuccess: (data) => {
      toast.success(
        `Assessment approved! ${data.riskCount} risk${data.riskCount !== 1 ? "s" : ""} published to the register.`
      );
      refreshAll();
    },
    onError: (e) => toast.error(e.message),
  });
  const rejectMutation = api.riskAssessmentProject.reject.useMutation({
    onSuccess: () => {
      toast.success("Assessment rejected — returned to analyst for revision");
      refreshAll();
    },
    onError: (e) => toast.error(e.message),
  });
  const rescindMutation = api.riskAssessmentProject.rescindSubmission.useMutation({
    onSuccess: () => {
      toast.success("Submission rescinded — back to in-progress");
      refreshAll();
    },
    onError: (e) => toast.error(e.message),
  });

  const status = project.status;
  const pending =
    submitMutation.isPending ||
    approveMutation.isPending ||
    rejectMutation.isPending ||
    rescindMutation.isPending;

  // Block submission/approval if a questionnaire is attached but unfinished.
  const { data: questionnaireSummary } =
    api.riskAssessmentQuestionnaire.getCompletionSummary.useQuery({
      projectId: project.id,
    });
  const questionnaireBlocking =
    questionnaireSummary?.attached === true && !questionnaireSummary.isComplete;
  const questionnaireBlockingMessage = questionnaireBlocking
    ? `Questionnaire is ${questionnaireSummary.answered}/${questionnaireSummary.total} answered — answer all questions before submitting`
    : undefined;

  if (status === "APPROVED") {
    return (
      <div className="text-sm text-muted-foreground italic shrink-0">
        Approved {project.reviewedAt ? format(new Date(project.reviewedAt), "PP") : ""}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 shrink-0 flex-wrap">
      {status === "IN_PROGRESS" && (isAssignee || isAdmin) && (
        <Button
          variant={isAdmin ? "outline" : "default"}
          size="sm"
          onClick={() => submitMutation.mutate({ id: project.id })}
          disabled={pending || riskCount === 0 || questionnaireBlocking}
          title={
            riskCount === 0
              ? "Add at least one identified risk first"
              : questionnaireBlockingMessage
          }
        >
          {submitMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
          Submit for Approval
        </Button>
      )}

      {status === "IN_PROGRESS" && isAdmin && (
        <Button
          size="sm"
          onClick={() => {
            if (
              confirm(
                "Approve this assessment now? All identified risks will be published to the risk register."
              )
            ) {
              approveMutation.mutate({ id: project.id });
            }
          }}
          disabled={pending || riskCount === 0}
          title={riskCount === 0 ? "Add at least one identified risk first" : undefined}
        >
          {approveMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
          Approve
        </Button>
      )}

      {status === "SUBMITTED" && (isAdmin || isCiso) && (
        <>
          <Button
            size="sm"
            onClick={() => {
              if (
                confirm(
                  "Approve this assessment? All identified risks will be published to the risk register."
                )
              ) {
                approveMutation.mutate({ id: project.id });
              }
            }}
            disabled={pending}
          >
            {approveMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
            Approve
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const notes = prompt("Reason for rejection (sent to analyst):");
              if (notes && notes.trim().length > 0) {
                rejectMutation.mutate({ id: project.id, rejectionNotes: notes.trim() });
              }
            }}
            disabled={pending}
          >
            Reject
          </Button>
        </>
      )}

      {status === "SUBMITTED" && isAssignee && !isAdmin && !isCiso && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => rescindMutation.mutate({ id: project.id })}
          disabled={pending}
        >
          Rescind Submission
        </Button>
      )}
    </div>
  );
}

function CommentsTab({ projectId }: { projectId: string }) {
  const { data: session } = useSession();
  const utils = api.useUtils();
  const [draft, setDraft] = useState("");
  const userId = session?.user?.id;
  const userRole = session?.user?.role as UserRole | undefined;
  const isAdmin = userRole === UserRole.ORG_ADMIN;

  const { data: comments, isLoading } = api.riskAssessmentProject.listComments.useQuery({
    projectId,
  });

  const addMutation = api.riskAssessmentProject.addComment.useMutation({
    onSuccess: () => {
      setDraft("");
      void utils.riskAssessmentProject.listComments.invalidate({ projectId });
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = api.riskAssessmentProject.deleteComment.useMutation({
    onSuccess: () => {
      void utils.riskAssessmentProject.listComments.invalidate({ projectId });
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 space-y-3">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a comment..."
            className="min-h-[80px]"
            disabled={addMutation.isPending}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => addMutation.mutate({ projectId, content: draft.trim() })}
              disabled={!draft.trim() || addMutation.isPending}
            >
              {addMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Post
            </Button>
          </div>
        </CardContent>
      </Card>

      {(!comments || comments.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground border border-dashed rounded-lg">
          <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
          <p className="text-sm">No comments yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => {
            const canDelete = isAdmin || c.authorId === userId;
            return (
              <Card key={c.id}>
                <CardContent className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">
                          {c.Author?.name ?? c.Author?.email ?? "Deleted user"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(c.createdAt), "PPp")}
                        </span>
                      </div>
                      <p className="mt-1 text-sm whitespace-pre-wrap">{c.content}</p>
                    </div>
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMutation.mutate({ commentId: c.id })}
                        disabled={deleteMutation.isPending}
                      >
                        <XIcon className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AuditTrailTab({ projectId }: { projectId: string }) {
  const { data, isLoading } = api.riskAssessmentProject.getAuditTrail.useQuery({
    projectId,
  });
  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground border border-dashed rounded-lg">
        <History className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">No audit log entries yet.</p>
      </div>
    );
  }
  return (
    <Card>
      <CardContent className="pt-6">
        <ol className="relative border-l border-muted pl-6 space-y-4">
          {data.map((e) => {
            const changes =
              e.changes && typeof e.changes === "object"
                ? (e.changes as Record<string, unknown>)
                : null;
            return (
              <li key={e.id} className="relative">
                <span className="absolute -left-[29px] top-1 inline-block h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background" />
                <div className="text-sm">
                  <span className="font-medium">
                    {e.User?.name ?? e.actorName ?? "Unknown"}
                  </span>
                  <span className="text-muted-foreground"> · </span>
                  <span className="text-muted-foreground">
                    {format(new Date(e.timestamp), "PPp")}
                  </span>
                </div>
                <div className="text-sm mt-0.5">
                  <Badge variant="outline" className="font-mono text-xs">
                    {String(e.action).replace(/_/g, " ")}
                  </Badge>
                  {changes?.action ? (
                    <span className="ml-2 text-muted-foreground">
                      {String(changes.action)}
                    </span>
                  ) : null}
                </div>
                {changes && Object.keys(changes).length > 0 && (
                  <pre className="mt-2 text-xs bg-muted/50 rounded-md p-2 overflow-auto whitespace-pre-wrap break-all">
                    {JSON.stringify(changes, null, 2)}
                  </pre>
                )}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
