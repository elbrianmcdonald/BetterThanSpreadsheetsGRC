"use client";

import { useState } from "react";
import { AlertCircle, ClipboardCheck, Loader2, Plus, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import {
  DeficiencySeverity,
  RemediationStatus,
  UserRole,
} from "@prisma/client";
import { api, type RouterOutputs } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PersonPicker } from "@/components/person/PersonPicker";
import {
  DEFICIENCY_SEVERITY_OPTIONS,
  REMEDIATION_STATUS_OPTIONS,
  labelForDeficiencySeverity,
  labelForRemediationStatus,
  severityBadgeColor,
  remediationStatusBadgeColor,
} from "./enum-labels";

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

type Deficiency = RouterOutputs["orgControlDeficiency"]["list"][number];
type TestRecord = RouterOutputs["orgControlTestRecord"]["list"][number];

export function DeficienciesTab({ controlId }: { controlId: string }) {
  const { data: session } = useSession();
  const userRole = session?.user?.role as UserRole | undefined;
  const canMutate = !!userRole && CAN_MUTATE.includes(userRole);

  const [showResolved, setShowResolved] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Deficiency | null>(null);

  const { data: deficiencies, isLoading } = api.orgControlDeficiency.list.useQuery({
    orgControlId: controlId,
    includeResolved: showResolved,
  });

  const { data: testRecords } = api.orgControlTestRecord.list.useQuery({
    orgControlId: controlId,
    limit: 50,
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-medium">Deficiencies</h3>
          <p className="text-sm text-muted-foreground">
            Gaps identified during testing and their remediation status.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(e) => setShowResolved(e.target.checked)}
              className="h-4 w-4"
            />
            Show resolved
          </label>
          {canMutate && (
            <Button onClick={() => setCreateOpen(true)} disabled={!testRecords?.length}>
              <Plus className="h-4 w-4 mr-2" />
              Log deficiency
            </Button>
          )}
        </div>
      </div>

      {!testRecords?.length && canMutate && (
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="py-4 flex items-center gap-2 text-sm text-amber-900">
            <AlertCircle className="h-4 w-4" />
            Deficiencies are tied to test records. Record a test before logging a deficiency.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : !deficiencies?.length ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <ClipboardCheck className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              {showResolved
                ? "No deficiencies have been logged for this control."
                : "No open deficiencies."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Severity</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>From test</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deficiencies.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <Badge variant="outline" className={severityBadgeColor(d.severity)}>
                        {labelForDeficiencySeverity(d.severity)}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[360px]">
                      <p className="text-sm text-gray-700 line-clamp-2">{d.description}</p>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={remediationStatusBadgeColor(d.remediationStatus)}
                      >
                        {labelForRemediationStatus(d.remediationStatus)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {d.RemediationOwner?.name ?? d.RemediationOwner?.email ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(d.remediationDueDate)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {d.TestRecord ? formatDate(d.TestRecord.testedAt) : "—"}
                    </TableCell>
                    <TableCell>
                      {canMutate && (
                        <Button variant="ghost" size="sm" onClick={() => setEditTarget(d)}>
                          Edit
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CreateDeficiencyDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        controlId={controlId}
        testRecords={testRecords ?? []}
      />
      {editTarget && (
        <EditDeficiencyDialog
          deficiency={editTarget}
          onClose={() => setEditTarget(null)}
          controlId={controlId}
        />
      )}
    </div>
  );
}

function CreateDeficiencyDialog({
  open,
  onOpenChange,
  controlId,
  testRecords,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  controlId: string;
  testRecords: TestRecord[];
}) {
  const utils = api.useUtils();
  const [testRecordId, setTestRecordId] = useState<string>(testRecords[0]?.id ?? "");
  const [severity, setSeverity] = useState<DeficiencySeverity>(DeficiencySeverity.MEDIUM);
  const [description, setDescription] = useState("");
  const [ownerId, setOwnerId] = useState<string>("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  const createMutation = api.orgControlDeficiency.create.useMutation({
    onSuccess: () => {
      toast.success("Deficiency logged");
      void utils.orgControlDeficiency.list.invalidate({ orgControlId: controlId });
      void utils.organizationalControl.getById.invalidate({ id: controlId });
      onOpenChange(false);
      setDescription("");
      setNotes("");
      setDueDate("");
      setOwnerId("");
      setSeverity(DeficiencySeverity.MEDIUM);
    },
    onError: (e) => toast.error(e.message || "Failed to log deficiency"),
  });

  const handleSubmit = () => {
    if (!testRecordId) {
      toast.error("Select a test record");
      return;
    }
    if (!description.trim()) {
      toast.error("Description is required");
      return;
    }
    createMutation.mutate({
      testRecordId,
      description: description.trim(),
      severity,
      remediationOwnerId: ownerId || null,
      remediationDueDate: dueDate ? new Date(dueDate) : null,
      remediationNotes: notes.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Log deficiency</DialogTitle>
          <DialogDescription>
            Record a gap found during testing. Every deficiency must reference the test run where it was found.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label>Test record</Label>
            <Select value={testRecordId} onValueChange={setTestRecordId}>
              <SelectTrigger>
                <SelectValue placeholder="Select the test run" />
              </SelectTrigger>
              <SelectContent>
                {testRecords.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {formatDate(r.testedAt)} — {r.result} ({r.TestedBy?.name ?? r.TestedBy?.email ?? "unknown"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Severity</Label>
            <Select value={severity} onValueChange={(v) => setSeverity(v as DeficiencySeverity)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEFICIENCY_SEVERITY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="description">
              Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="description"
              rows={3}
              placeholder="What exactly is the gap..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Remediation owner</Label>
              <PersonPicker
                value={ownerId || null}
                onChange={(id) => setOwnerId(id ?? "")}
                placeholder="Unassigned"
                clearable
              />
            </div>

            <div>
              <Label htmlFor="dueDate">Due date</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              rows={2}
              placeholder="Remediation plan, dependencies, context..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={createMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Log deficiency"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDeficiencyDialog({
  deficiency,
  onClose,
  controlId,
}: {
  deficiency: Deficiency;
  onClose: () => void;
  controlId: string;
}) {
  const utils = api.useUtils();
  const [severity, setSeverity] = useState<DeficiencySeverity>(deficiency.severity);
  const [status, setStatus] = useState<RemediationStatus>(deficiency.remediationStatus);
  const [description, setDescription] = useState(deficiency.description);
  const [ownerId, setOwnerId] = useState<string>(deficiency.remediationOwnerId ?? "");
  const [dueDate, setDueDate] = useState(
    deficiency.remediationDueDate
      ? new Date(deficiency.remediationDueDate).toISOString().slice(0, 10)
      : ""
  );
  const [notes, setNotes] = useState(deficiency.remediationNotes ?? "");

  const invalidate = () => {
    void utils.orgControlDeficiency.list.invalidate({ orgControlId: controlId });
    void utils.organizationalControl.getById.invalidate({ id: controlId });
  };

  const updateMutation = api.orgControlDeficiency.update.useMutation({
    onSuccess: () => {
      toast.success("Deficiency updated");
      invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message || "Failed to update"),
  });

  const resolveMutation = api.orgControlDeficiency.resolve.useMutation({
    onSuccess: () => {
      toast.success("Deficiency resolved");
      invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message || "Failed to resolve"),
  });

  const handleSave = () => {
    updateMutation.mutate({
      id: deficiency.id,
      data: {
        description: description.trim(),
        severity,
        remediationStatus: status,
        remediationOwnerId: ownerId || null,
        remediationDueDate: dueDate ? new Date(dueDate) : null,
        remediationNotes: notes.trim() || null,
      },
    });
  };

  const isSaving = updateMutation.isPending || resolveMutation.isPending;
  const isResolved = deficiency.remediationStatus === RemediationStatus.COMPLETED;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit deficiency</DialogTitle>
          <DialogDescription>
            Update remediation status, ownership, or notes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Severity</Label>
              <Select value={severity} onValueChange={(v) => setSeverity(v as DeficiencySeverity)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEFICIENCY_SEVERITY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Remediation status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as RemediationStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REMEDIATION_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="desc">Description</Label>
            <Textarea
              id="desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Remediation owner</Label>
              <PersonPicker
                value={ownerId || null}
                onChange={(id) => setOwnerId(id ?? "")}
                placeholder="Unassigned"
                clearable
              />
            </div>
            <div>
              <Label htmlFor="dueDate2">Due date</Label>
              <Input
                id="dueDate2"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="notes2">Remediation notes</Label>
            <Textarea
              id="notes2"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {deficiency.resolvedAt && (
            <p className="text-xs text-green-700">
              Resolved on {formatDate(deficiency.resolvedAt)}.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          {!isResolved && (
            <Button
              variant="outline"
              onClick={() => resolveMutation.mutate({ id: deficiency.id })}
              disabled={isSaving}
              className="text-green-700 border-green-200 hover:bg-green-50"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Mark resolved
            </Button>
          )}
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
