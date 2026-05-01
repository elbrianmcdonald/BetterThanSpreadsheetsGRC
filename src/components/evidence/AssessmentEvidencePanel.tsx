"use client";

/**
 * Per-control evidence attachment panel for compliance and maturity
 * assessments. Renders the attached evidence list, lets users attach an
 * existing evidence item from the repository, detach attached items, and
 * jump out to upload a new one (links to /admin/evidence in a new tab —
 * after upload the user comes back and uses the picker).
 *
 * The component is intentionally storage-agnostic — the parent supplies
 * `evidenceIds` and the attach/detach callbacks. That way the same
 * component drives compliance ControlAssessmentScore.evidenceLinks,
 * maturity MaturityDomainScore.evidenceLinks, and maturity
 * MaturityQuestionResponse.evidenceIds without knowing about each.
 */

import { useRef, useState } from "react";
import {
  Paperclip,
  Plus,
  Trash2,
  FileText,
  Image as ImageIcon,
  File as FileIcon,
  Search,
  Loader2,
  ExternalLink,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  validateFile,
  formatFileSize as fmtFileSize,
  getAcceptAttribute,
  MAX_FILE_SIZE,
} from "@/utils/file-validation";

/** Read a File into a base64 string (without the data URL prefix). */
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

const FILE_ICONS: Record<string, React.ReactNode> = {
  pdf: <FileText className="h-4 w-4 text-red-500" />,
  png: <ImageIcon className="h-4 w-4 text-blue-500" />,
  jpg: <ImageIcon className="h-4 w-4 text-blue-500" />,
  jpeg: <ImageIcon className="h-4 w-4 text-blue-500" />,
  default: <FileIcon className="h-4 w-4 text-gray-500" />,
};

function getFileIcon(fileType: string) {
  const ext = fileType.split("/").pop()?.toLowerCase() ?? "";
  return FILE_ICONS[ext] ?? FILE_ICONS.default;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface AssessmentEvidencePanelProps {
  /** Currently attached evidence IDs. Component fetches their metadata. */
  evidenceIds: string[];
  /** Whether the parent assessment is editable — hides attach/detach when false. */
  canEdit?: boolean;
  /** Called when user picks an existing evidence row to attach. */
  onAttach: (evidenceId: string) => Promise<unknown> | void;
  /** Called when user removes an attached evidence row. */
  onDetach: (evidenceId: string) => Promise<unknown> | void;
  /** Disabled state — passed in by parent to reflect ongoing mutation. */
  isPending?: boolean;
}

export function AssessmentEvidencePanel({
  evidenceIds,
  canEdit = true,
  onAttach,
  onDetach,
  isPending = false,
}: AssessmentEvidencePanelProps) {
  const utils = api.useUtils();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Inline upload dialog state — keeps the assessor on the assessment page
  // instead of bouncing them out to /admin/evidence.
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const uploadMutation = api.evidence.upload.useMutation({
    onSuccess: async (evidence) => {
      if (!evidence) {
        // The upload route can return null in degraded paths (e.g. when
        // malware scanning is misconfigured). Surface so the user retries
        // or uploads via /admin/evidence.
        setUploadError("Upload returned no record — try again or use the admin evidence page.");
        return;
      }
      try {
        await onAttach(evidence.id);
      } catch {
        // attach errors surface via the parent's mutation toast.
      }
      void utils.evidence.list.invalidate();
      toast.success(`Uploaded "${evidence.title}"`);
      resetUploadForm();
      setUploadOpen(false);
    },
    onError: (e) => {
      setUploadError(e.message);
    },
  });

  function resetUploadForm() {
    setUploadFile(null);
    setUploadTitle("");
    setUploadDescription("");
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFilePick(file: File | null) {
    setUploadError(null);
    if (!file) {
      setUploadFile(null);
      return;
    }
    const validation = validateFile(file.name, file.size, file.type);
    if (!validation.valid) {
      setUploadError(validation.errors.map((err) => err.message).join("; "));
      setUploadFile(null);
      return;
    }
    setUploadFile(file);
    if (!uploadTitle.trim()) {
      // Strip extension for a sensible default title.
      const base = file.name.replace(/\.[^.]+$/, "");
      setUploadTitle(base);
    }
  }

  async function handleUploadSubmit() {
    if (!uploadFile) {
      setUploadError("Pick a file first");
      return;
    }
    if (uploadTitle.trim().length === 0) {
      setUploadError("Title is required");
      return;
    }
    setUploadError(null);
    try {
      const fileContent = await readFileAsBase64(uploadFile);
      uploadMutation.mutate({
        fileContent,
        fileName: uploadFile.name,
        mimeType: uploadFile.type || "application/octet-stream",
        title: uploadTitle.trim(),
        description: uploadDescription.trim() || undefined,
        // Empty array — assessment-scoped uploads aren't required to pick
        // a control domain. Users can tag it later from /admin/evidence.
        controlDomainIds: [],
      });
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Failed to read file");
    }
  }

  // Attached evidence metadata — single round-trip via listByIds.
  const { data: attached, isLoading: isLoadingAttached } =
    api.evidence.listByIds.useQuery(
      { ids: evidenceIds },
      { enabled: evidenceIds.length > 0 }
    );

  // Picker — paginated list of evidence in the org, filtered by search.
  const { data: pickerData, isLoading: isLoadingPicker } =
    api.evidence.list.useQuery(
      { search, pageSize: 20, isActive: true },
      { enabled: pickerOpen }
    );

  const attachedSet = new Set(evidenceIds);
  const pickerCandidates =
    pickerData?.items.filter((e) => !attachedSet.has(e.id)) ?? [];

  const handleAttach = async (id: string) => {
    try {
      await onAttach(id);
    } catch (e) {
      // Parent toasts on error; nothing to do here.
    }
  };

  const handleDetach = async (id: string) => {
    try {
      await onDetach(id);
    } catch (e) {
      // Parent toasts on error.
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">Evidence</span>
          {evidenceIds.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {evidenceIds.length}
            </Badge>
          )}
        </div>
        {canEdit && (
          <div className="flex items-center gap-1">
            <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="h-7 text-xs">
                  <Plus className="h-3 w-3 mr-1" />
                  Attach
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Attach evidence</DialogTitle>
                  <DialogDescription>
                    Pick from your evidence repository. Need to upload first?
                    Open Evidence in a new tab and come back.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search evidence..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <div className="max-h-[320px] overflow-y-auto space-y-2">
                    {isLoadingPicker ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map((i) => (
                          <Skeleton key={i} className="h-14 w-full" />
                        ))}
                      </div>
                    ) : pickerCandidates.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        {search
                          ? "No matching evidence found."
                          : "No evidence available. Upload one first."}
                      </p>
                    ) : (
                      pickerCandidates.map((evidence) => (
                        <div
                          key={evidence.id}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {getFileIcon(evidence.fileType)}
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">
                                {evidence.title}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {evidence.originalFileName} &bull;{" "}
                                {formatFileSize(evidence.fileSize)}
                              </p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              void handleAttach(evidence.id);
                            }}
                            disabled={isPending}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog
              open={uploadOpen}
              onOpenChange={(open) => {
                setUploadOpen(open);
                if (!open) resetUploadForm();
              }}
            >
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="h-7 text-xs">
                  <Upload className="h-3 w-3 mr-1" />
                  Upload
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Upload evidence</DialogTitle>
                  <DialogDescription>
                    Uploads to your evidence repository and attaches to this
                    control automatically. Tag it with a control domain or
                    business unit later from /admin/evidence.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {/* File picker */}
                  <div className="space-y-1.5">
                    <Label htmlFor="evidence-file">File</Label>
                    {uploadFile ? (
                      <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {uploadFile.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {fmtFileSize(uploadFile.size)}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => handleFilePick(null)}
                          disabled={uploadMutation.isPending}
                          aria-label="Remove file"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Input
                        id="evidence-file"
                        type="file"
                        ref={fileInputRef}
                        accept={getAcceptAttribute()}
                        onChange={(e) =>
                          handleFilePick(e.target.files?.[0] ?? null)
                        }
                        disabled={uploadMutation.isPending}
                      />
                    )}
                    <p className="text-xs text-muted-foreground">
                      Max {fmtFileSize(MAX_FILE_SIZE)}.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="evidence-title">
                      Title <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="evidence-title"
                      value={uploadTitle}
                      onChange={(e) => setUploadTitle(e.target.value)}
                      placeholder="e.g., Q2 access review export"
                      maxLength={200}
                      disabled={uploadMutation.isPending}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="evidence-description">Description</Label>
                    <Textarea
                      id="evidence-description"
                      value={uploadDescription}
                      onChange={(e) => setUploadDescription(e.target.value)}
                      placeholder="What this evidence demonstrates (optional)"
                      rows={3}
                      disabled={uploadMutation.isPending}
                    />
                  </div>

                  {uploadError && (
                    <p className="text-sm text-destructive">{uploadError}</p>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setUploadOpen(false);
                      resetUploadForm();
                    }}
                    disabled={uploadMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleUploadSubmit}
                    disabled={
                      !uploadFile ||
                      uploadTitle.trim().length === 0 ||
                      uploadMutation.isPending
                    }
                  >
                    {uploadMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      "Upload & attach"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {evidenceIds.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          No evidence attached.
        </p>
      ) : isLoadingAttached ? (
        <div className="space-y-1.5">
          {evidenceIds.map((id) => (
            <Skeleton key={id} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-1.5">
          {(attached ?? []).map((ev) => (
            <div
              key={ev.id}
              className="flex items-center justify-between p-2 border rounded-md bg-muted/30"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {getFileIcon(ev.fileType)}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{ev.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {ev.originalFileName} &bull; {formatFileSize(ev.fileSize)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <Button size="icon" variant="ghost" className="h-7 w-7" asChild>
                  <a
                    href={`/admin/evidence/${ev.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open evidence"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
                {canEdit && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => void handleDetach(ev.id)}
                    disabled={isPending}
                    title="Detach evidence"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
          {/* Render placeholder rows for IDs that didn't resolve (deleted or
              filtered out) so users notice and can detach if they want. */}
          {(attached?.length ?? 0) < evidenceIds.length &&
            evidenceIds
              .filter((id) => !attached?.some((e) => e.id === id))
              .map((id) => (
                <div
                  key={id}
                  className="flex items-center justify-between p-2 border border-dashed rounded-md bg-muted/10"
                >
                  <span className="text-xs text-muted-foreground italic">
                    Evidence {id.slice(0, 8)}… (unavailable)
                  </span>
                  {canEdit && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => void handleDetach(id)}
                      disabled={isPending}
                      title="Detach"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
        </div>
      )}
    </div>
  );
}
