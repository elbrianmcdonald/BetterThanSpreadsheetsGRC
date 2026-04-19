"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ClipboardList,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { EvidenceArtifactType, UserRole } from "@prisma/client";
import { useSession } from "next-auth/react";
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
import { validateFile } from "@/utils/file-validation";

const CAN_MUTATE: UserRole[] = [
  UserRole.ORG_ADMIN,
  UserRole.GRC_ANALYST,
  UserRole.SECURITY_ENGINEER,
];

const ARTIFACT_TYPE_OPTIONS: { value: EvidenceArtifactType; label: string }[] = [
  { value: EvidenceArtifactType.LOG, label: "Log" },
  { value: EvidenceArtifactType.TICKET, label: "Ticket" },
  { value: EvidenceArtifactType.SCREENSHOT, label: "Screenshot" },
  { value: EvidenceArtifactType.APPROVAL, label: "Approval" },
  { value: EvidenceArtifactType.POLICY_DOCUMENT, label: "Policy document" },
  { value: EvidenceArtifactType.CONFIGURATION, label: "Configuration" },
  { value: EvidenceArtifactType.OTHER, label: "Other" },
];

function artifactTypeLabel(v: EvidenceArtifactType): string {
  return ARTIFACT_TYPE_OPTIONS.find((o) => o.value === v)?.label ?? v;
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let i = 0;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(size < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

export function EvidenceTab({ controlId }: { controlId: string }) {
  const { data: session } = useSession();
  const userRole = session?.user?.role as UserRole | undefined;
  const canMutate = !!userRole && CAN_MUTATE.includes(userRole);

  return (
    <div className="space-y-6">
      <RequirementsSection controlId={controlId} canMutate={canMutate} />
      <AttachedEvidenceSection controlId={controlId} canMutate={canMutate} />
    </div>
  );
}

// -------------------------------------------------------------------
// Requirements
// -------------------------------------------------------------------

function RequirementsSection({
  controlId,
  canMutate,
}: {
  controlId: string;
  canMutate: boolean;
}) {
  const [addOpen, setAddOpen] = useState(false);

  const { data: requirements, isLoading } =
    api.orgControlEvidenceRequirement.list.useQuery({ orgControlId: controlId });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle>Evidence requirements</CardTitle>
          <CardDescription>
            What kind of evidence proves this control is operating. Evidence items are linked to
            these requirements below.
          </CardDescription>
        </div>
        {canMutate && (
          <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add requirement
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !requirements?.length ? (
          <p className="text-sm text-muted-foreground">
            No evidence requirements yet. Define what evidence auditors should expect to see.
          </p>
        ) : (
          <ul className="space-y-2">
            {requirements.map((r) => (
              <RequirementRow
                key={r.id}
                requirement={r}
                controlId={controlId}
                canMutate={canMutate}
              />
            ))}
          </ul>
        )}
      </CardContent>

      <AddRequirementDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        controlId={controlId}
      />
    </Card>
  );
}

function RequirementRow({
  requirement,
  controlId,
  canMutate,
}: {
  requirement: {
    id: string;
    description: string;
    artifactType: EvidenceArtifactType;
    required: boolean;
    Owner: { id: string; name: string; email: string | null; jobTitle: string | null } | null;
    _count: { Evidence: number };
  };
  controlId: string;
  canMutate: boolean;
}) {
  const utils = api.useUtils();
  const deleteMutation = api.orgControlEvidenceRequirement.delete.useMutation({
    onSuccess: () => {
      toast.success("Requirement removed");
      void utils.orgControlEvidenceRequirement.list.invalidate({ orgControlId: controlId });
      void utils.organizationalControl.getById.invalidate({ id: controlId });
    },
    onError: (e) => toast.error(e.message || "Failed to remove"),
  });

  const [editOpen, setEditOpen] = useState(false);

  return (
    <>
      <li className="flex items-start gap-3 p-3 rounded-md border bg-gray-50">
        <ClipboardList className="h-4 w-4 text-gray-500 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline">{artifactTypeLabel(requirement.artifactType)}</Badge>
            {requirement.required ? (
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                Required
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
                Optional
              </Badge>
            )}
            <Badge variant="secondary">
              {requirement._count.Evidence} fulfilled
            </Badge>
            {requirement.Owner && (
              <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200">
                Owner: {requirement.Owner.name}
              </Badge>
            )}
          </div>
          <p className="mt-2 text-sm text-gray-800 whitespace-pre-wrap">{requirement.description}</p>
        </div>
        {canMutate && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditOpen(true)}
              aria-label="Edit requirement"
            >
              Edit
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-red-600 hover:text-red-700"
              onClick={() => deleteMutation.mutate({ id: requirement.id })}
              disabled={deleteMutation.isPending}
              aria-label="Delete requirement"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </li>
      {editOpen && (
        <EditRequirementDialog
          requirement={requirement}
          onClose={() => setEditOpen(false)}
          controlId={controlId}
        />
      )}
    </>
  );
}

function AddRequirementDialog({
  open,
  onOpenChange,
  controlId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  controlId: string;
}) {
  const utils = api.useUtils();
  const [description, setDescription] = useState("");
  const [artifactType, setArtifactType] = useState<EvidenceArtifactType>(
    EvidenceArtifactType.LOG
  );
  const [required, setRequired] = useState(true);
  const [ownerId, setOwnerId] = useState<string | null>(null);

  const createMutation = api.orgControlEvidenceRequirement.create.useMutation({
    onSuccess: () => {
      toast.success("Requirement added");
      void utils.orgControlEvidenceRequirement.list.invalidate({ orgControlId: controlId });
      void utils.organizationalControl.getById.invalidate({ id: controlId });
      onOpenChange(false);
      setDescription("");
      setArtifactType(EvidenceArtifactType.LOG);
      setRequired(true);
      setOwnerId(null);
    },
    onError: (e) => toast.error(e.message || "Failed to add requirement"),
  });

  const handleSubmit = () => {
    if (!description.trim()) {
      toast.error("Description is required");
      return;
    }
    createMutation.mutate({
      orgControlId: controlId,
      description: description.trim(),
      artifactType,
      required,
      ownerId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add evidence requirement</DialogTitle>
          <DialogDescription>
            Describe what evidence auditors should expect to see for this control.
          </DialogDescription>
        </DialogHeader>
        <RequirementFormFields
          description={description}
          setDescription={setDescription}
          artifactType={artifactType}
          setArtifactType={setArtifactType}
          required={required}
          setRequired={setRequired}
          ownerId={ownerId}
          setOwnerId={setOwnerId}
        />
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createMutation.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending ? "Saving..." : "Add requirement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditRequirementDialog({
  requirement,
  onClose,
  controlId,
}: {
  requirement: {
    id: string;
    description: string;
    artifactType: EvidenceArtifactType;
    required: boolean;
    Owner: { id: string; name: string } | null;
  };
  onClose: () => void;
  controlId: string;
}) {
  const utils = api.useUtils();
  const [description, setDescription] = useState(requirement.description);
  const [artifactType, setArtifactType] = useState(requirement.artifactType);
  const [required, setRequired] = useState(requirement.required);
  const [ownerId, setOwnerId] = useState<string | null>(requirement.Owner?.id ?? null);

  const updateMutation = api.orgControlEvidenceRequirement.update.useMutation({
    onSuccess: () => {
      toast.success("Requirement updated");
      void utils.orgControlEvidenceRequirement.list.invalidate({ orgControlId: controlId });
      void utils.organizationalControl.getById.invalidate({ id: controlId });
      onClose();
    },
    onError: (e) => toast.error(e.message || "Failed to update"),
  });

  const handleSave = () => {
    if (!description.trim()) {
      toast.error("Description is required");
      return;
    }
    updateMutation.mutate({
      id: requirement.id,
      data: {
        description: description.trim(),
        artifactType,
        required,
        ownerId,
      },
    });
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit evidence requirement</DialogTitle>
          <DialogDescription>Update the requirement fields or reassign the owner.</DialogDescription>
        </DialogHeader>
        <RequirementFormFields
          description={description}
          setDescription={setDescription}
          artifactType={artifactType}
          setArtifactType={setArtifactType}
          required={required}
          setRequired={setRequired}
          ownerId={ownerId}
          setOwnerId={setOwnerId}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={updateMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RequirementFormFields({
  description,
  setDescription,
  artifactType,
  setArtifactType,
  required,
  setRequired,
  ownerId,
  setOwnerId,
}: {
  description: string;
  setDescription: (v: string) => void;
  artifactType: EvidenceArtifactType;
  setArtifactType: (v: EvidenceArtifactType) => void;
  required: boolean;
  setRequired: (v: boolean) => void;
  ownerId: string | null;
  setOwnerId: (v: string | null) => void;
}) {
  return (
    <div className="space-y-4 py-2">
      <div>
        <Label htmlFor="req-desc">
          Description <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="req-desc"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g., Monthly access review report showing privileged accounts reviewed..."
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Artifact type</Label>
          <Select
            value={artifactType}
            onValueChange={(v) => setArtifactType(v as EvidenceArtifactType)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ARTIFACT_TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              className="h-4 w-4"
            />
            Required (not optional)
          </label>
        </div>
      </div>
      <div>
        <Label>Owner</Label>
        <PersonPicker
          value={ownerId}
          onChange={(id) => setOwnerId(id ?? null)}
          placeholder="Unassigned"
          clearable
        />
      </div>
    </div>
  );
}

// -------------------------------------------------------------------
// Attached Evidence
// -------------------------------------------------------------------

function AttachedEvidenceSection({
  controlId,
  canMutate,
}: {
  controlId: string;
  canMutate: boolean;
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const { data: links, isLoading } = api.orgControlEvidence.list.useQuery({
    orgControlId: controlId,
  });

  const utils = api.useUtils();

  const unlinkMutation = api.orgControlEvidence.unlink.useMutation({
    onSuccess: () => {
      toast.success("Evidence unlinked");
      void utils.orgControlEvidence.list.invalidate({ orgControlId: controlId });
      void utils.orgControlEvidenceRequirement.list.invalidate({ orgControlId: controlId });
      void utils.organizationalControl.getById.invalidate({ id: controlId });
    },
    onError: (e) => toast.error(e.message || "Failed to unlink"),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle>Attached evidence</CardTitle>
          <CardDescription>
            Evidence artifacts linked to this control. One file can back multiple controls.
          </CardDescription>
        </div>
        {canMutate && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Upload new
            </Button>
            <Button size="sm" onClick={() => setLinkOpen(true)}>
              <Link2 className="h-4 w-4 mr-2" />
              Link existing
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !links?.length ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <FileText className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            No evidence linked yet. Upload a new file or link one that already exists.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Requirement</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Linked</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {links.map((l) => {
                const evidenceGone = !l.Evidence || !l.Evidence.isActive || l.Evidence.deletedAt;
                return (
                  <TableRow key={l.id}>
                    <TableCell>
                      <Link
                        href={`/admin/evidence/${l.evidenceId}`}
                        className="text-blue-700 hover:underline inline-flex items-center gap-1"
                      >
                        <span className="truncate max-w-[280px]">
                          {l.Evidence?.title ?? l.Evidence?.originalFileName ?? "Evidence removed"}
                        </span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </Link>
                      {l.Evidence?.originalFileName && l.Evidence.title !== l.Evidence.originalFileName && (
                        <p className="text-xs text-muted-foreground truncate max-w-[280px]">
                          {l.Evidence.originalFileName}
                        </p>
                      )}
                      {evidenceGone && (
                        <Badge variant="outline" className="mt-1 bg-gray-100 text-gray-600">
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatFileSize(l.Evidence?.fileSize ?? null)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {l.EvidenceRequirement ? (
                        <>
                          <Badge variant="outline">
                            {artifactTypeLabel(l.EvidenceRequirement.artifactType)}
                          </Badge>
                          <p className="text-muted-foreground truncate max-w-[220px] mt-1">
                            {l.EvidenceRequirement.description}
                          </p>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {l.periodCovered ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(l.createdAt)}
                      {l.CreatedBy && (
                        <p>by {l.CreatedBy.name ?? l.CreatedBy.email}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      {canMutate && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => unlinkMutation.mutate({ id: l.id })}
                          disabled={unlinkMutation.isPending}
                          aria-label="Unlink evidence"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <LinkEvidenceDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        controlId={controlId}
        existingLinkedIds={(links ?? []).map((l) => l.evidenceId)}
      />

      <UploadEvidenceDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        controlId={controlId}
      />
    </Card>
  );
}

function LinkEvidenceDialog({
  open,
  onOpenChange,
  controlId,
  existingLinkedIds,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  controlId: string;
  existingLinkedIds: string[];
}) {
  const utils = api.useUtils();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [requirementId, setRequirementId] = useState<string>("");
  const [periodCovered, setPeriodCovered] = useState("");

  const { data: evidenceData, isLoading } = api.evidence.list.useQuery(
    {
      page: 1,
      pageSize: 25,
      search: search.trim() || undefined,
      isActive: true,
      sortBy: "createdAt",
      sortDir: "desc",
    },
    { enabled: open }
  );

  const { data: requirements } = api.orgControlEvidenceRequirement.list.useQuery(
    { orgControlId: controlId },
    { enabled: open }
  );

  const linkMutation = api.orgControlEvidence.link.useMutation({
    onSuccess: () => {
      toast.success("Evidence linked");
      void utils.orgControlEvidence.list.invalidate({ orgControlId: controlId });
      void utils.orgControlEvidenceRequirement.list.invalidate({ orgControlId: controlId });
      void utils.organizationalControl.getById.invalidate({ id: controlId });
      onOpenChange(false);
      setSelectedId(null);
      setRequirementId("");
      setPeriodCovered("");
      setSearch("");
    },
    onError: (e) => toast.error(e.message || "Failed to link"),
  });

  const alreadyLinked = useMemo(() => new Set(existingLinkedIds), [existingLinkedIds]);
  const items = evidenceData?.items ?? [];

  const handleLink = () => {
    if (!selectedId) {
      toast.error("Select evidence to link");
      return;
    }
    linkMutation.mutate({
      orgControlId: controlId,
      evidenceId: selectedId,
      evidenceRequirementId: requirementId || null,
      periodCovered: periodCovered.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Link existing evidence</DialogTitle>
          <DialogDescription>
            Browse the organization evidence library and link an item to this control.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <Input
            placeholder="Search by title or filename..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="border rounded-md max-h-[320px] overflow-y-auto">
            {isLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : items.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">
                No evidence matches. Try a different search, or upload new evidence first.
              </p>
            ) : (
              <ul className="divide-y">
                {items.map((e) => {
                  const linked = alreadyLinked.has(e.id);
                  const isSelected = selectedId === e.id;
                  return (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => !linked && setSelectedId(e.id)}
                        disabled={linked}
                        className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${isSelected ? "bg-blue-50" : ""} ${linked ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{e.title}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {e.originalFileName} · {formatFileSize(e.fileSize)} · {formatDate(e.createdAt)}
                            </p>
                          </div>
                          {linked && (
                            <Badge variant="outline" className="shrink-0">
                              Already linked
                            </Badge>
                          )}
                          {isSelected && !linked && (
                            <Badge variant="default" className="shrink-0">
                              Selected
                            </Badge>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Fulfills requirement (optional)</Label>
              <Select
                value={requirementId || "__none__"}
                onValueChange={(v) => setRequirementId(v === "__none__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {requirements?.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {artifactTypeLabel(r.artifactType)} —{" "}
                      {r.description.length > 60
                        ? r.description.slice(0, 60) + "…"
                        : r.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="period">Period covered</Label>
              <Input
                id="period"
                placeholder='e.g., "Q1 2026" or "Jan 2026"'
                value={periodCovered}
                onChange={(e) => setPeriodCovered(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={linkMutation.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleLink} disabled={!selectedId || linkMutation.isPending}>
            {linkMutation.isPending ? "Linking..." : "Link evidence"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Single-file uploader scoped to a control. Pipeline: read file → base64 →
 * evidence.upload → orgControlEvidence.link (requirement + period). Skips the
 * generic EvidenceUpload's business-unit + control-domain metadata since
 * those aren't relevant in the control context.
 */
function UploadEvidenceDialog({
  open,
  onOpenChange,
  controlId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  controlId: string;
}) {
  const utils = api.useUtils();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requirementId, setRequirementId] = useState<string>("");
  const [periodCovered, setPeriodCovered] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const { data: requirements } = api.orgControlEvidenceRequirement.list.useQuery(
    { orgControlId: controlId },
    { enabled: open }
  );

  const uploadMutation = api.evidence.upload.useMutation();
  const linkMutation = api.orgControlEvidence.link.useMutation();

  const resetForm = () => {
    setFile(null);
    setTitle("");
    setDescription("");
    setRequirementId("");
    setPeriodCovered("");
  };

  const handleFile = (f: File | null) => {
    setFile(f);
    if (f && !title) {
      // Default title = filename without extension
      setTitle(f.name.replace(/\.[^/.]+$/, ""));
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Select a file to upload");
      return;
    }
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    const validation = validateFile(file.name, file.size, file.type);
    if (!validation.valid) {
      toast.error(validation.errors.map((e) => e.message).join(", "));
      return;
    }

    setIsUploading(true);
    try {
      const fileContent = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(",")[1] ?? "";
          resolve(base64);
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });

      const uploaded = await uploadMutation.mutateAsync({
        fileContent,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        title: title.trim(),
        description: description.trim() || undefined,
        controlDomainIds: [],
      });

      if (!uploaded) {
        throw new Error("Upload succeeded but no evidence record was returned");
      }

      await linkMutation.mutateAsync({
        orgControlId: controlId,
        evidenceId: uploaded.id,
        evidenceRequirementId: requirementId || null,
        periodCovered: periodCovered.trim() || null,
      });

      toast.success("Evidence uploaded and linked");
      void utils.orgControlEvidence.list.invalidate({ orgControlId: controlId });
      void utils.orgControlEvidenceRequirement.list.invalidate({ orgControlId: controlId });
      void utils.organizationalControl.getById.invalidate({ id: controlId });
      void utils.evidence.list.invalidate();
      resetForm();
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      toast.error(message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload evidence</DialogTitle>
          <DialogDescription>
            Upload a file and attach it to this control. Optionally tie it to a requirement and
            reporting period.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="ev-file">
              File <span className="text-destructive">*</span>
            </Label>
            <Input
              id="ev-file"
              type="file"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
            {file && (
              <p className="text-xs text-muted-foreground mt-1">
                {file.name} · {formatFileSize(file.size)}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="ev-title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="ev-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Human-readable title for this evidence..."
              maxLength={200}
            />
          </div>

          <div>
            <Label htmlFor="ev-desc">Description</Label>
            <Textarea
              id="ev-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this evidence shows..."
            />
          </div>

          <div>
            <Label>Fulfills requirement</Label>
            <Select
              value={requirementId || "__none__"}
              onValueChange={(v) => setRequirementId(v === "__none__" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {requirements?.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {artifactTypeLabel(r.artifactType)} —{" "}
                    {r.description.length > 60
                      ? r.description.slice(0, 60) + "…"
                      : r.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="ev-period">Period covered</Label>
            <Input
              id="ev-period"
              placeholder='e.g., "Q1 2026" or "Jan 2026"'
              value={periodCovered}
              onChange={(e) => setPeriodCovered(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUploading}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={isUploading || !file}>
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              "Upload evidence"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
