"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Shield,
  Edit,
  Archive,
  Trash2,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { UserRole, OrgControlStatus, AssignmentRole } from "@prisma/client";
import { api, type RouterOutputs } from "@/trpc/react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  labelForControlType,
  labelForControlNature,
  labelForOrgControlStatus,
  labelForControlFrequency,
  labelForAssignmentRole,
  labelForMappingType,
  statusBadgeColor,
  controlTypeBadgeColor,
} from "@/components/organizational-control/enum-labels";
import { TestingTab } from "@/components/organizational-control/TestingTab";
import { DeficienciesTab } from "@/components/organizational-control/DeficienciesTab";
import { EvidenceTab } from "@/components/organizational-control/EvidenceTab";
import { ExceptionsTab } from "@/components/organizational-control/ExceptionsTab";
import { DependenciesTab } from "@/components/organizational-control/DependenciesTab";

const CAN_MUTATE: UserRole[] = [
  UserRole.ORG_ADMIN,
  UserRole.GRC_ANALYST,
  UserRole.SECURITY_ENGINEER,
];

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initials(name: string | null | undefined, email: string | null | undefined): string {
  const src = name?.trim() || email?.trim() || "?";
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function ControlDetailClient({ controlId }: { controlId: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  const userRole = session?.user?.role as UserRole | undefined;
  const canMutate = !!userRole && CAN_MUTATE.includes(userRole);
  const isAdmin = userRole === UserRole.ORG_ADMIN;

  const utils = api.useUtils();
  const [tab, setTab] = useState("overview");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);

  const { data: control, isLoading, error } = api.organizationalControl.getById.useQuery({
    id: controlId,
  });

  const archiveMutation = api.organizationalControl.archive.useMutation({
    onSuccess: () => {
      toast.success("Control archived");
      void utils.organizationalControl.getById.invalidate({ id: controlId });
      void utils.organizationalControl.list.invalidate();
      setArchiveOpen(false);
    },
    onError: (e) => toast.error(e.message || "Failed to archive"),
  });

  const deleteMutation = api.organizationalControl.delete.useMutation({
    onSuccess: () => {
      toast.success("Control deleted");
      void utils.organizationalControl.list.invalidate();
      router.push("/controls");
    },
    onError: (e) => toast.error(e.message || "Failed to delete"),
  });

  if (isLoading) {
    return (
      <AppLayout breadcrumbs={[{ label: "Controls", href: "/controls" }, { label: "Loading..." }]}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </AppLayout>
    );
  }

  if (error || !control) {
    return (
      <AppLayout breadcrumbs={[{ label: "Controls", href: "/controls" }, { label: "Not found" }]}>
        <div className="text-center py-12">
          <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-2" />
          <p className="text-red-600">{error?.message ?? "Control not found"}</p>
          <Button variant="outline" asChild className="mt-4">
            <Link href="/controls">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to controls
            </Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  const isDeprecated = control.status === OrgControlStatus.DEPRECATED;
  const owners = control.Assignments.filter((a) => a.role === AssignmentRole.OWNER);
  const operators = control.Assignments.filter((a) => a.role === AssignmentRole.OPERATOR);
  const reviewers = control.Assignments.filter((a) => a.role === AssignmentRole.REVIEWER);

  return (
    <AppLayout
      breadcrumbs={[
        { label: "Controls", href: "/controls" },
        { label: control.name },
      ]}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start gap-4 justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <Shield className="h-6 w-6 text-gray-700" />
              <span className="font-mono text-lg text-blue-700">{control.localControlId}</span>
              <h1 className="text-2xl font-semibold text-gray-900">{control.name}</h1>
              <Badge variant="outline" className={statusBadgeColor(control.status)}>
                {labelForOrgControlStatus(control.status)}
              </Badge>
              <Badge variant="outline" className={controlTypeBadgeColor(control.controlType)}>
                {labelForControlType(control.controlType)}
              </Badge>
              {control._count.FrameworkMappings > 0 && (
                <Badge variant="secondary">
                  {control._count.FrameworkMappings} framework mapping
                  {control._count.FrameworkMappings === 1 ? "" : "s"}
                </Badge>
              )}
              {isDeprecated && (
                <Badge variant="outline" className="bg-gray-100 text-gray-700">
                  Retired {control.retirementDate ? formatDate(control.retirementDate) : ""}
                </Badge>
              )}
            </div>
            <p className="text-sm text-gray-500">
              Created {formatDate(control.createdAt)}
              {control.CreatedBy ? ` by ${control.CreatedBy.name ?? control.CreatedBy.email}` : ""}
              {" · v"}
              {control.version}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Admins can still edit DEPRECATED controls (correction path); non-admins cannot */}
            {(canMutate && !isDeprecated) || (isAdmin && isDeprecated) ? (
              <Button variant="outline" asChild>
                <Link href={`/controls/${control.id}/edit`}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Link>
              </Button>
            ) : null}
            {isAdmin && !isDeprecated && (
              <Button variant="outline" onClick={() => setPublishOpen(true)}>
                <Send className="h-4 w-4 mr-2" />
                Publish v{control.version + 1}
              </Button>
            )}
            {canMutate && !isDeprecated && (
              <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="outline">
                    <Archive className="h-4 w-4 mr-2" />
                    Archive
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Archive this control?</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-3">
                        <p>
                          Marks the control as <strong>DEPRECATED</strong> with today&apos;s
                          retirement date. All linkages stay intact for audit history.
                        </p>
                        <ArchiveImpactSummary counts={control._count} />
                        <p className="text-xs">
                          Pending exceptions block archive — resolve them first.
                        </p>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(e) => {
                        e.preventDefault();
                        archiveMutation.mutate({ id: control.id });
                      }}
                      disabled={archiveMutation.isPending}
                    >
                      {archiveMutation.isPending ? "Archiving..." : "Archive control"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {canMutate && (
              <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this control permanently?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Hard-delete is only allowed if the control has no risk links, objectives,
                      test records, deficiencies, exceptions, or dependents. Otherwise archive it instead.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(e) => {
                        e.preventDefault();
                        deleteMutation.mutate({ id: control.id });
                      }}
                      disabled={deleteMutation.isPending}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {deleteMutation.isPending ? "Deleting..." : "Delete control"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex flex-wrap gap-1">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="frameworks">
              Frameworks ({control._count.FrameworkMappings})
            </TabsTrigger>
            <TabsTrigger value="assignments">
              Assignments ({control._count.Assignments})
            </TabsTrigger>
            <TabsTrigger value="testing">Testing</TabsTrigger>
            <TabsTrigger value="deficiencies">
              Deficiencies ({control._count.Deficiencies})
            </TabsTrigger>
            <TabsTrigger value="evidence">
              Evidence ({control._count.EvidenceLinks})
            </TabsTrigger>
            <TabsTrigger value="exceptions">
              Exceptions ({control._count.Exceptions})
            </TabsTrigger>
            <TabsTrigger value="dependencies">
              Dependencies ({control._count.DependenciesFrom + control._count.DependenciesTo})
            </TabsTrigger>
            <TabsTrigger value="risks">Risks ({control._count.RiskLinks})</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <OverviewTab control={control} />
          </TabsContent>

          <TabsContent value="frameworks" className="mt-4">
            <FrameworksTab control={control} />
          </TabsContent>

          <TabsContent value="assignments" className="mt-4">
            <AssignmentsTab owners={owners} operators={operators} reviewers={reviewers} />
          </TabsContent>

          <TabsContent value="testing" className="mt-4">
            <TestingTab controlId={control.id} />
          </TabsContent>

          <TabsContent value="deficiencies" className="mt-4">
            <DeficienciesTab controlId={control.id} />
          </TabsContent>

          <TabsContent value="evidence" className="mt-4">
            <EvidenceTab controlId={control.id} />
          </TabsContent>

          <TabsContent value="exceptions" className="mt-4">
            <ExceptionsTab controlId={control.id} />
          </TabsContent>

          <TabsContent value="dependencies" className="mt-4">
            <DependenciesTab controlId={control.id} />
          </TabsContent>

          <TabsContent value="risks" className="mt-4">
            <LinkedRisksTab controlId={control.id} />
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <HistoryTab controlId={control.id} />
          </TabsContent>
        </Tabs>

        {isAdmin && (
          <PublishDialog
            open={publishOpen}
            onOpenChange={setPublishOpen}
            control={control}
          />
        )}
      </div>
    </AppLayout>
  );
}

type Control = RouterOutputs["organizationalControl"]["getById"];

function OverviewTab({ control }: { control: Control }) {
  return (
    <div className="space-y-4">
      {control.description && (
        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm text-gray-700">
            {control.description}
          </CardContent>
        </Card>
      )}
      {control.objective && (
        <Card>
          <CardHeader>
            <CardTitle>Objective</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm text-gray-700">
            {control.objective}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Classification</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <Field label="Type" value={labelForControlType(control.controlType)} />
          <Field label="Nature" value={labelForControlNature(control.nature)} />
        </CardContent>
      </Card>

      {(control.implementationNarrative || control.scope) && (
        <Card>
          <CardHeader>
            <CardTitle>Implementation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {control.implementationNarrative && (
              <div>
                <p className="text-xs uppercase text-gray-500 mb-1">Narrative</p>
                <p className="whitespace-pre-wrap text-gray-700">{control.implementationNarrative}</p>
              </div>
            )}
            {control.scope && (
              <div>
                <p className="text-xs uppercase text-gray-500 mb-1">Scope</p>
                <p className="whitespace-pre-wrap text-gray-700">{control.scope}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Test cadence</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <Field label="Review cycle" value={labelForControlFrequency(control.frequency)} />
          <Field label="Last tested" value={formatDate(control.lastTestedDate)} />
          <Field
            label="Next due"
            value={control.nextTestDueDate ? formatDate(control.nextTestDueDate) : "—"}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase text-gray-500">{label}</p>
      <p className="text-gray-900">{value}</p>
    </div>
  );
}

function FrameworksTab({ control }: { control: Control }) {
  if (control.FrameworkMappings.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-gray-500">
          No framework mappings yet. Edit this control to map it to framework requirements.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Framework mappings</CardTitle>
        <CardDescription>
          This control satisfies (in whole, in part, or beyond) the listed framework controls.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Framework</TableHead>
              <TableHead>Control ID</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Mapping</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {control.FrameworkMappings.map((m) => (
              <TableRow key={m.id}>
                <TableCell>
                  <Badge variant="outline">{m.FrameworkControl.Framework.code}</Badge>
                  <span className="ml-2 text-xs text-gray-500">
                    {m.FrameworkControl.Framework.name}
                  </span>
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {m.FrameworkControl.controlId}
                </TableCell>
                <TableCell className="text-sm">{m.FrameworkControl.title}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{labelForMappingType(m.mappingType)}</Badge>
                </TableCell>
                <TableCell className="text-xs text-gray-500">{m.notes ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function AssignmentsTab({
  owners,
  operators,
  reviewers,
}: {
  owners: Control["Assignments"];
  operators: Control["Assignments"];
  reviewers: Control["Assignments"];
}) {
  const sections: { label: string; role: AssignmentRole; items: Control["Assignments"]; hint: string }[] = [
    { label: "Owners", role: AssignmentRole.OWNER, items: owners, hint: "Accountable — approves control operations" },
    { label: "Operators", role: AssignmentRole.OPERATOR, items: operators, hint: "Responsible — performs the control" },
    { label: "Reviewers", role: AssignmentRole.REVIEWER, items: reviewers, hint: "Consulted/Informed — approves or audits" },
  ];

  return (
    <div className="space-y-4">
      {sections.map((s) => (
        <Card key={s.role}>
          <CardHeader>
            <CardTitle>
              {s.label}{" "}
              <span className="text-sm font-normal text-gray-500">({s.items.length})</span>
            </CardTitle>
            <CardDescription>{s.hint}</CardDescription>
          </CardHeader>
          <CardContent>
            {s.items.length === 0 ? (
              <p className="text-sm text-gray-500">None assigned.</p>
            ) : (
              <ul className="space-y-2">
                {s.items.map((a) => (
                  <li key={a.id} className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
                        {initials(a.Person.name, a.Person.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{a.Person.name}</p>
                      <p className="text-xs text-gray-500">
                        {a.Person.jobTitle ?? a.Person.email ?? ""}
                      </p>
                    </div>
                    <Badge variant="outline" className="ml-auto">
                      {labelForAssignmentRole(s.role)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function LinkedRisksTab({ controlId }: { controlId: string }) {
  const { data, isLoading } = api.organizationalControl.getLinkedRisks.useQuery({ controlId });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-10 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  if (!data?.length) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-gray-500">
          This control isn&apos;t linked to any risks yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Linked risks</CardTitle>
        <CardDescription>
          Risks that reference this control (either in-place or needed).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((l) => (
              <TableRow
                key={l.linkId}
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => {
                  window.location.href = `/risks/${l.risk.id}`;
                }}
              >
                <TableCell className="font-mono text-sm text-blue-700">
                  {l.risk.identifier ?? l.risk.id.slice(0, 8)}
                </TableCell>
                <TableCell className="text-sm">{l.risk.title}</TableCell>
                <TableCell>
                  <Badge variant="outline">{l.risk.severity}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{l.risk.status}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={l.role === "IN_PLACE" ? "default" : "secondary"}>
                    {l.role === "IN_PLACE" ? "In place" : "Needed"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

const HISTORY_ACTION_LABELS: Record<string, string> = {
  CREATE: "Created",
  UPDATE: "Updated",
  ARCHIVE: "Archived",
  DELETE: "Deleted",
  QUICK_CREATE: "Quick-created",
  VERSION_PUBLISHED: "Version published",
  TEST_RECORDED: "Test recorded",
  TEST_RECORD_UPDATED: "Test updated",
  TEST_RECORD_DELETED: "Test deleted",
  DEFICIENCY_CREATED: "Deficiency logged",
  DEFICIENCY_UPDATED: "Deficiency updated",
  DEFICIENCY_RESOLVED: "Deficiency resolved",
  EVIDENCE_REQUIREMENT_CREATED: "Evidence requirement added",
  EVIDENCE_REQUIREMENT_UPDATED: "Evidence requirement updated",
  EVIDENCE_REQUIREMENT_DELETED: "Evidence requirement deleted",
  EVIDENCE_LINKED: "Evidence linked",
  EVIDENCE_LINK_UPDATED: "Evidence link updated",
  EVIDENCE_UNLINKED: "Evidence unlinked",
  EXCEPTION_REQUESTED: "Exception requested",
  EXCEPTION_APPROVED: "Exception approved",
  EXCEPTION_DENIED: "Exception denied",
  EXCEPTION_RENEWED: "Exception renewed",
  DEPENDENCY_ADDED: "Dependency added",
  DEPENDENCY_UPDATED: "Dependency updated",
  DEPENDENCY_REMOVED: "Dependency removed",
};

function HistoryTab({ controlId }: { controlId: string }) {
  const { data, isLoading } = api.organizationalControl.getHistory.useQuery({ controlId });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-10 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  if (!data?.length) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-gray-500">
          No audit history yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit history</CardTitle>
        <CardDescription>Most recent first.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-4">
          {data.map((entry) => (
            <HistoryEntry key={entry.id} entry={entry} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

type HistoryEntryRow = RouterOutputs["organizationalControl"]["getHistory"][number];

function HistoryEntry({ entry }: { entry: HistoryEntryRow }) {
  const changes = entry.changes as
    | {
        action?: string;
        before?: Record<string, unknown>;
        after?: Record<string, unknown>;
        snapshot?: Record<string, unknown>;
        publishedVersion?: number;
        previousVersion?: number;
        notes?: string | null;
        frameworkMappingsReplaced?: boolean;
        assignmentsReplaced?: boolean;
        [k: string]: unknown;
      }
    | null;

  const action = changes?.action ?? entry.action;
  const label = HISTORY_ACTION_LABELS[action] ?? action;

  return (
    <li className="border-l-2 border-gray-200 pl-4 pb-2">
      <div className="flex items-center gap-2 text-sm flex-wrap">
        <Badge variant="outline">{label}</Badge>
        <span className="text-gray-500">{formatDateTime(entry.timestamp)}</span>
        {entry.actorName && (
          <span className="text-gray-700">by {entry.actorName}</span>
        )}
        {entry.actorRole && (
          <Badge variant="secondary" className="text-xs">
            {entry.actorRole}
          </Badge>
        )}
        {typeof changes?.publishedVersion === "number" && (
          <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200">
            v{changes.publishedVersion}
          </Badge>
        )}
      </div>

      {changes?.before && changes?.after && (
        <BeforeAfterDiff before={changes.before} after={changes.after} />
      )}

      {changes?.notes && (
        <p className="mt-2 text-xs text-gray-700 whitespace-pre-wrap">
          <span className="font-medium">Notes:</span> {changes.notes}
        </p>
      )}

      {/* Surface non-diff payload fields in a compact summary (skip before/after/snapshot) */}
      {changes && <ExtraChangeFields changes={changes} />}
    </li>
  );
}

function BeforeAfterDiff({
  before,
  after,
}: {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}) {
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  const diffKeys = keys.filter((k) => !shallowEqual(before[k], after[k]));
  if (diffKeys.length === 0) return null;

  return (
    <div className="mt-2 rounded border bg-gray-50 p-2 space-y-1">
      {diffKeys.map((k) => (
        <div key={k} className="text-xs">
          <span className="font-medium text-gray-700">{k}:</span>{" "}
          <span className="line-through text-red-600">{renderValue(before[k])}</span>{" "}
          <span className="text-gray-400">→</span>{" "}
          <span className="text-green-700">{renderValue(after[k])}</span>
        </div>
      ))}
    </div>
  );
}

const EXTRA_FIELD_SKIP = new Set([
  "action",
  "before",
  "after",
  "snapshot",
  "notes",
  "publishedVersion",
  "previousVersion",
]);

function ExtraChangeFields({
  changes,
}: {
  changes: Record<string, unknown>;
}) {
  const entries = Object.entries(changes).filter(
    ([k, v]) => !EXTRA_FIELD_SKIP.has(k) && v !== null && v !== undefined && v !== false && v !== ""
  );
  if (entries.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600">
      {entries.map(([k, v]) => (
        <span key={k}>
          <span className="text-gray-500">{k}:</span>{" "}
          <span className="text-gray-800">{renderValue(v)}</span>
        </span>
      ))}
    </div>
  );
}

function ArchiveImpactSummary({
  counts,
}: {
  counts: Control["_count"];
}) {
  const rows: { label: string; count: number }[] = [
    { label: "Linked risks", count: counts.RiskLinks },
    { label: "Linked objectives", count: counts.linkedObjectives },
    { label: "Assignments", count: counts.Assignments },
    { label: "Framework mappings", count: counts.FrameworkMappings },
    { label: "Evidence items", count: counts.EvidenceLinks },
    { label: "Evidence requirements", count: counts.EvidenceRequirements },
    { label: "Test records", count: counts.TestRecords },
    { label: "Deficiencies", count: counts.Deficiencies },
    { label: "Exceptions", count: counts.Exceptions },
    { label: "Controls that depend on this", count: counts.DependenciesTo },
  ];
  const nonZero = rows.filter((r) => r.count > 0);

  if (nonZero.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No linkages will be affected.
      </p>
    );
  }

  return (
    <div className="rounded-md border bg-amber-50 border-amber-200 p-3">
      <p className="text-xs font-medium text-amber-900 mb-2">
        Preserved after archive:
      </p>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-amber-900">
        {nonZero.map((r) => (
          <li key={r.label} className="flex justify-between">
            <span>{r.label}</span>
            <span className="font-semibold">{r.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PublishDialog({
  open,
  onOpenChange,
  control,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  control: Control;
}) {
  const utils = api.useUtils();
  const [notes, setNotes] = useState("");

  const { data: snapshotData } = api.organizationalControl.getLatestPublishedSnapshot.useQuery(
    { controlId: control.id },
    { enabled: open }
  );

  const publishMutation = api.organizationalControl.publish.useMutation({
    onSuccess: () => {
      toast.success(`Published v${control.version + 1}`);
      void utils.organizationalControl.getById.invalidate({ id: control.id });
      void utils.organizationalControl.getHistory.invalidate({ controlId: control.id });
      void utils.organizationalControl.getLatestPublishedSnapshot.invalidate({
        controlId: control.id,
      });
      onOpenChange(false);
      setNotes("");
    },
    onError: (e) => toast.error(e.message || "Failed to publish"),
  });

  const previousSnapshot = (snapshotData?.latest?.changes as
    | { snapshot?: Record<string, unknown>; publishedVersion?: number }
    | null
    | undefined)?.snapshot;
  const previousVersion = (snapshotData?.latest?.changes as
    | { publishedVersion?: number }
    | null
    | undefined)?.publishedVersion;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Publish v{control.version + 1}</DialogTitle>
          <DialogDescription>
            Snapshots the current control state to the audit log and bumps the
            version. Use this to mark an official release.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {previousSnapshot ? (
            <VersionDiff
              previous={previousSnapshot}
              current={snapshotableFrom(control)}
              previousVersion={previousVersion ?? control.version}
              currentVersion={control.version + 1}
            />
          ) : (
            <p className="text-xs text-muted-foreground">
              No previous published snapshot — this will be the first one.
            </p>
          )}

          <div>
            <Label htmlFor="publishNotes">Release notes (optional)</Label>
            <Textarea
              id="publishNotes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What changed in this version..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={publishMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() =>
              publishMutation.mutate({ id: control.id, notes: notes.trim() || undefined })
            }
            disabled={publishMutation.isPending}
          >
            {publishMutation.isPending ? "Publishing..." : `Publish v${control.version + 1}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function snapshotableFrom(control: Control): Record<string, unknown> {
  return {
    localControlId: control.localControlId,
    name: control.name,
    description: control.description,
    objective: control.objective,
    family: control.family,
    controlType: control.controlType,
    nature: control.nature,
    automationLevel: control.automationLevel,
    status: control.status,
    implementationNarrative: control.implementationNarrative,
    scope: control.scope,
    frequency: control.frequency,
    procedureRunbookLink: control.procedureRunbookLink,
    reviewCycleMonths: control.reviewCycleMonths,
    retirementDate: control.retirementDate,
  };
}

function VersionDiff({
  previous,
  current,
  previousVersion,
  currentVersion,
}: {
  previous: Record<string, unknown>;
  current: Record<string, unknown>;
  previousVersion: number;
  currentVersion: number;
}) {
  const keys = [
    "name",
    "localControlId",
    "description",
    "objective",
    "family",
    "controlType",
    "nature",
    "automationLevel",
    "status",
    "implementationNarrative",
    "scope",
    "frequency",
    "procedureRunbookLink",
    "reviewCycleMonths",
    "retirementDate",
  ];
  const changes = keys.filter((k) => !shallowEqual(previous[k], current[k]));

  return (
    <div className="rounded-md border bg-gray-50 p-3 text-sm">
      <p className="text-xs font-medium mb-2">
        Changes since v{previousVersion} → v{currentVersion}
      </p>
      {changes.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No field-level changes. Publishing creates a checkpoint anyway.
        </p>
      ) : (
        <ul className="space-y-2">
          {changes.map((k) => (
            <li key={k} className="text-xs">
              <p className="font-medium">{k}</p>
              <p className="text-muted-foreground line-through truncate">
                {renderValue(previous[k])}
              </p>
              <p className="text-gray-900 truncate">{renderValue(current[k])}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a == b;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof Date || b instanceof Date) {
    const at = a instanceof Date ? a.getTime() : new Date(String(a)).getTime();
    const bt = b instanceof Date ? b.getTime() : new Date(String(b)).getTime();
    return at === bt;
  }
  return String(a) === String(b);
}

function renderValue(v: unknown): string {
  if (v == null) return "—";
  if (v instanceof Date) return v.toLocaleDateString();
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

