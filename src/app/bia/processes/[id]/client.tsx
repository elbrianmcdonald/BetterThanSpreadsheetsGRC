"use client";

/**
 * Business Process Detail Client Component
 *
 * Epic 10: BIA Core Module
 * Story 10.5: Process Detail Page
 * Story 10.6: Process Status & Workaround Management
 * Story 10.7: Owner-Based Edit Permissions
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppLayout } from "@/components/layout";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  Activity,
  ArrowLeft,
  Pencil,
  Trash2,
  UserCircle,
  FolderTree,
  Clock,
  AlertTriangle,
  Building2,
  ShieldAlert,
  History,
  GitMerge,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { BusinessProcessStatus } from "@prisma/client";
import { ImpactAssessmentTab } from "@/components/bia/ImpactAssessmentTab";
import { DependenciesTab } from "@/components/bia/DependenciesTab";
import {
  WRAPPER_TAB_DEFS,
  WrapperTabPanel,
} from "@/components/engagement/WrapperTabs";
import type { AssessmentKind } from "@/components/engagement/types";
import { ExecutiveSummaryTab } from "@/components/deliverable/ExecutiveSummaryTab";

interface ProcessDetailClientProps {
  processId: string;
}

const STATUS_LABELS: Record<BusinessProcessStatus, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  UNDER_REVIEW: "Under Review",
  DELETED: "Deleted",
};

const STATUS_COLORS: Record<BusinessProcessStatus, string> = {
  ACTIVE: "bg-green-100 text-green-800 border-green-200",
  INACTIVE: "bg-gray-100 text-gray-800 border-gray-200",
  UNDER_REVIEW: "bg-amber-100 text-amber-800 border-amber-200",
  DELETED: "bg-red-100 text-red-800 border-red-200",
};

export function ProcessDetailClient({ processId }: ProcessDetailClientProps) {
  const router = useRouter();

  // Dialog states
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isOwnerOpen, setIsOwnerOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Form states
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    workaroundProcedure: "",
    lossMinimum: "",
    lossProbable: "",
    lossMaximum: "",
  });
  const [newStatus, setNewStatus] = useState<BusinessProcessStatus | "">("");
  const [newOwnerId, setNewOwnerId] = useState("");
  const [ownerSearch, setOwnerSearch] = useState("");

  const utils = api.useUtils();

  // Queries
  const { data, isLoading, error } = api.businessProcess.getById.useQuery({
    id: processId,
  });

  // Destructure for convenience - use type assertion to preserve Prisma relations
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const process = data?.process as any;
  const permissions = data?.permissions;
  // Compute effective tier (override takes precedence over calculated)
  const effectiveTier = process?.overrideTier ?? process?.calculatedTier;

  const { data: owners } = api.businessProcess.getAvailableOwners.useQuery(
    { search: ownerSearch || undefined },
    { enabled: isOwnerOpen }
  );

  const { data: auditLogs } = api.businessProcess.getAuditHistory.useQuery({
    id: processId,
  });

  // Mutations
  const updateMutation = api.businessProcess.update.useMutation({
    onSuccess: () => {
      void utils.businessProcess.getById.invalidate({ id: processId });
      toast.success("Process updated");
      setIsEditOpen(false);
    },
    onError: (error) => toast.error(error.message),
  });

  const updateStatusMutation = api.businessProcess.updateStatus.useMutation({
    onSuccess: () => {
      void utils.businessProcess.getById.invalidate({ id: processId });
      toast.success("Status updated");
      setIsStatusOpen(false);
    },
    onError: (error) => toast.error(error.message),
  });

  const updateOwnerMutation = api.businessProcess.updateOwner.useMutation({
    onSuccess: () => {
      void utils.businessProcess.getById.invalidate({ id: processId });
      toast.success("Owner updated");
      setIsOwnerOpen(false);
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = api.businessProcess.delete.useMutation({
    onSuccess: () => {
      toast.success("Process deleted");
      router.push("/bia/processes");
    },
    onError: (error) => toast.error(error.message),
  });

  // Handlers
  const openEditDialog = () => {
    if (process) {
      setEditForm({
        name: process.name,
        description: process.description ?? "",
        workaroundProcedure: process.workaroundProcedure ?? "",
        lossMinimum: process.lossMinimum ? String(process.lossMinimum) : "",
        lossProbable: process.lossProbable ? String(process.lossProbable) : "",
        lossMaximum: process.lossMaximum ? String(process.lossMaximum) : "",
      });
      setIsEditOpen(true);
    }
  };

  const openStatusDialog = () => {
    if (process) {
      setNewStatus(process.status);
      setIsStatusOpen(true);
    }
  };

  const openOwnerDialog = () => {
    if (process) {
      setNewOwnerId(process.ownerId ?? "");
      setIsOwnerOpen(true);
    }
  };

  if (isLoading) {
    return (
      <AppLayout breadcrumbs={[{ label: "Business Impact" }, { label: "Business Processes" }]}>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (error || !process) {
    return (
      <AppLayout breadcrumbs={[{ label: "Business Impact" }, { label: "Business Processes" }]}>
        <div className="px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h2 className="text-lg font-medium">Process not found</h2>
            <p className="text-muted-foreground mt-2">
              {error?.message ?? "The requested process could not be found."}
            </p>
            <Link href="/bia/processes">
              <Button className="mt-4">Back to Processes</Button>
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      breadcrumbs={[
        { label: "Business Impact" },
        { label: "Business Processes", href: "/bia/processes" },
        { label: process.identifier },
      ]}
    >
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/bia/processes">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Processes
            </Button>
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <Activity className="h-8 w-8" />
                <div>
                  <h1 className="text-2xl font-semibold text-foreground">{process.name}</h1>
                  <p className="text-sm text-muted-foreground font-mono">{process.identifier}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Badge className={STATUS_COLORS[process.status as BusinessProcessStatus]}>
                  {STATUS_LABELS[process.status as BusinessProcessStatus]}
                </Badge>
                {effectiveTier && (
                  <Badge
                    style={{
                      backgroundColor: effectiveTier.colorHex,
                      color: "#fff",
                    }}
                  >
                    {effectiveTier.name}
                  </Badge>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {permissions?.canEdit && (
                <Button variant="outline" onClick={openEditDialog}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
              {permissions?.canChangeOwner && (
                <>
                  <Button variant="outline" onClick={openStatusDialog}>
                    Change Status
                  </Button>
                  <Button variant="outline" onClick={openOwnerDialog}>
                    <UserCircle className="h-4 w-4 mr-2" />
                    Change Owner
                  </Button>
                </>
              )}
              {permissions?.canDelete && (
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setIsDeleteOpen(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Content Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="assessment">Impact Assessment</TabsTrigger>
            <TabsTrigger value="dependencies">Dependencies</TabsTrigger>
            <TabsTrigger value="audit">Audit History</TabsTrigger>
            {WRAPPER_TAB_DEFS.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger key={tab.id} value={tab.id}>
                  <Icon className="h-4 w-4 mr-2" />
                  {tab.label}
                </TabsTrigger>
              );
            })}
            <TabsTrigger value="summary">
              <BarChart3 className="h-4 w-4 mr-2" />
              Executive Summary
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Info */}
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Description</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {process.description ? (
                      <p className="whitespace-pre-wrap">{process.description}</p>
                    ) : (
                      <p className="text-muted-foreground italic">No description provided</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Workaround Procedure</CardTitle>
                    <CardDescription>
                      Manual procedures if this process is unavailable
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {process.workaroundProcedure ? (
                      <p className="whitespace-pre-wrap">{process.workaroundProcedure}</p>
                    ) : (
                      <p className="text-muted-foreground italic">
                        No workaround procedure documented
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Loss Event Range</CardTitle>
                    <CardDescription>Estimated financial loss in USD if a loss event occurs.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {process.lossMinimum || process.lossProbable || process.lossMaximum ? (
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Minimum</p>
                          <p className="font-mono text-lg">
                            {process.lossMinimum ? `$${Number(process.lossMinimum).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Probable</p>
                          <p className="font-mono text-lg">
                            {process.lossProbable ? `$${Number(process.lossProbable).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Maximum</p>
                          <p className="font-mono text-lg">
                            {process.lossMaximum ? `$${Number(process.lossMaximum).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted-foreground italic">Not yet estimated</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Business Function</p>
                      <div className="flex items-center gap-2 mt-1">
                        <FolderTree className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {process.businessFunction?.name ?? "Not assigned"}
                        </span>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm text-muted-foreground">Process Owner</p>
                      <div className="flex items-center gap-2 mt-1">
                        <UserCircle className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {process.owner?.name ?? "Unassigned"}
                        </span>
                      </div>
                      {process.owner?.email && (
                        <p className="text-xs text-muted-foreground ml-6">
                          {process.owner.email}
                        </p>
                      )}
                    </div>

                    <div>
                      <p className="text-sm text-muted-foreground">Assessment Status</p>
                      <Badge variant="outline" className="mt-1">
                        {process.assessmentStatus.replace("_", " ")}
                      </Badge>
                    </div>

                    <div>
                      <p className="text-sm text-muted-foreground">Last Updated</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>{new Date(process.updatedAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* RTO/RPO if tier assigned */}
                {effectiveTier && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Recovery Objectives</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <p className="text-sm text-muted-foreground">RTO (Recovery Time)</p>
                        <p className="font-medium">{effectiveTier.rtoText}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">RPO (Recovery Point)</p>
                        <p className="font-medium">{effectiveTier.rpoText}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Assessment Tab */}
          <TabsContent value="assessment">
            <ImpactAssessmentTab
              processId={processId}
              canEdit={permissions?.canEdit ?? false}
            />
          </TabsContent>

          {/* Dependencies Tab */}
          <TabsContent value="dependencies">
            <DependenciesTab
              processId={processId}
              canEdit={permissions?.canEdit ?? false}
            />
          </TabsContent>

          {/* Audit Tab */}
          <TabsContent value="audit">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Audit History
                </CardTitle>
                <CardDescription>
                  Complete change history for this process
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!auditLogs || auditLogs.length === 0 ? (
                  <p className="text-muted-foreground">No audit history available</p>
                ) : (
                  <div className="space-y-4">
                    {auditLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-start gap-4 pb-4 border-b last:border-0"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{log.User?.name ?? log.actorName ?? "System"}</span>
                            <Badge variant="outline" className="text-xs">
                              {log.action.replace(/_/g, " ")}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {new Date(log.timestamp).toLocaleString()}
                          </p>
                          {log.changes && (
                            <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-x-auto">
                              {JSON.stringify(log.changes, null, 2)}
                            </pre>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Consulting wrapper tabs (Schedule / Stakeholders / Evidence /
              Exploitation Pathways / Action Plans) */}
          {WRAPPER_TAB_DEFS.map((tab) => (
            <TabsContent key={tab.id} value={tab.id}>
              <WrapperTabPanel
                tab={tab.id}
                assessmentKind={"BIA" as AssessmentKind}
                assessmentId={processId}
                clientName={process.name}
              />
            </TabsContent>
          ))}

          {/* Executive Summary (shared deliverable) */}
          <TabsContent value="summary">
            <ExecutiveSummaryTab assessmentKind="BIA" assessmentId={processId} />
          </TabsContent>
        </Tabs>

        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Business Process</DialogTitle>
              <DialogDescription>Update the process details.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  maxLength={200}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={4}
                  maxLength={4000}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-workaround">Workaround Procedure</Label>
                <Textarea
                  id="edit-workaround"
                  value={editForm.workaroundProcedure}
                  onChange={(e) =>
                    setEditForm({ ...editForm, workaroundProcedure: e.target.value })
                  }
                  rows={6}
                  maxLength={10000}
                />
              </div>

              <div className="space-y-2">
                <Label>Loss Event Range (USD)</Label>
                <p className="text-xs text-muted-foreground">
                  Estimated financial loss if a loss event occurs.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label htmlFor="edit-loss-min" className="text-xs">Minimum</Label>
                    <Input
                      id="edit-loss-min"
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="$"
                      value={editForm.lossMinimum}
                      onChange={(e) => setEditForm({ ...editForm, lossMinimum: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-loss-prob" className="text-xs">Probable</Label>
                    <Input
                      id="edit-loss-prob"
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="$"
                      value={editForm.lossProbable}
                      onChange={(e) => setEditForm({ ...editForm, lossProbable: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-loss-max" className="text-xs">Maximum</Label>
                    <Input
                      id="edit-loss-max"
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="$"
                      value={editForm.lossMaximum}
                      onChange={(e) => setEditForm({ ...editForm, lossMaximum: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  updateMutation.mutate({
                    id: processId,
                    name: editForm.name,
                    description: editForm.description || null,
                    workaroundProcedure: editForm.workaroundProcedure || null,
                    lossMinimum: editForm.lossMinimum === "" ? null : Number(editForm.lossMinimum),
                    lossProbable: editForm.lossProbable === "" ? null : Number(editForm.lossProbable),
                    lossMaximum: editForm.lossMaximum === "" ? null : Number(editForm.lossMaximum),
                  })
                }
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Status Dialog */}
        <Dialog open={isStatusOpen} onOpenChange={setIsStatusOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change Status</DialogTitle>
              <DialogDescription>Update the process status.</DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <Select
                value={newStatus}
                onValueChange={(v) => setNewStatus(v as BusinessProcessStatus)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={BusinessProcessStatus.ACTIVE}>Active</SelectItem>
                  <SelectItem value={BusinessProcessStatus.INACTIVE}>Inactive</SelectItem>
                  <SelectItem value={BusinessProcessStatus.UNDER_REVIEW}>Under Review</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsStatusOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  newStatus && updateStatusMutation.mutate({ id: processId, status: newStatus })
                }
                disabled={updateStatusMutation.isPending || !newStatus}
              >
                {updateStatusMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Update Status
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Owner Dialog */}
        <Dialog open={isOwnerOpen} onOpenChange={setIsOwnerOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change Owner</DialogTitle>
              <DialogDescription>Reassign the process owner.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <Input
                placeholder="Search users..."
                value={ownerSearch}
                onChange={(e) => setOwnerSearch(e.target.value)}
              />
              <Select value={newOwnerId} onValueChange={setNewOwnerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an owner..." />
                </SelectTrigger>
                <SelectContent>
                  {owners?.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      <div>
                        <div className="font-medium">{user.name}</div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsOwnerOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  updateOwnerMutation.mutate({ id: processId, ownerId: newOwnerId || null })
                }
                disabled={updateOwnerMutation.isPending}
              >
                {updateOwnerMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Update Owner
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Business Process?</AlertDialogTitle>
              <AlertDialogDescription>
                This will mark the process as deleted. The audit history will be preserved.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteMutation.mutate({ id: processId })}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
