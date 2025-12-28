"use client";

/**
 * Link Evidence Modal Component
 *
 * Modal dialog for selecting and linking evidence files to a risk.
 * Supports search/filter and link type selection (Finding/Remediation).
 *
 * Story 16.11: Enhanced with "Upload New" tab for direct evidence upload.
 * - AC3: "Attach Existing Evidence" button opens evidence picker
 * - AC4: "Upload New Evidence" button opens upload dialog
 * - AC5: Evidence type selector (Finding evidence, Remediation evidence)
 *
 * @see Story 3.6: AC11-AC13 - Evidence Selection Modal
 * @see Story 16.11: Evidence Attachment in Risk Assessment
 */

import { useState, useCallback, useRef } from "react";
import { api } from "@/trpc/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  FileText,
  Search,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Upload,
  X,
  Plus,
} from "lucide-react";
import { formatFileSize, validateFile, getAcceptAttribute, MAX_FILE_SIZE } from "@/utils/file-validation";
import { formatDate } from "@/utils/date-format";
import { RiskEvidenceLinkType } from "@prisma/client";
import { toast } from "sonner";
import { ControlDomainSelector } from "@/components/evidence/ControlDomainSelector";

interface LinkEvidenceModalProps {
  /** Risk ID to link evidence to */
  riskId: string;
  /** Close callback */
  onClose: () => void;
  /** Success callback */
  onSuccess: () => void;
}

export function LinkEvidenceModal({
  riskId,
  onClose,
  onSuccess,
}: LinkEvidenceModalProps) {
  // Tab state
  const [activeTab, setActiveTab] = useState<"existing" | "upload">("existing");

  // Existing evidence selection state
  const [search, setSearch] = useState("");
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);
  const [linkType, setLinkType] = useState<RiskEvidenceLinkType>(
    RiskEvidenceLinkType.FINDING
  );

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [selectedDomainIds, setSelectedDomainIds] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch available evidence
  // Note: Using fixed pageSize of 50 with search as overflow mechanism.
  // If org has >50 evidence files, users can use search to find specific items.
  // Pagination could be added in future if needed.
  const { data, isLoading, error } = api.evidence.list.useQuery({
    page: 1,
    pageSize: 50,
    search: search || undefined,
    isActive: true,
  });

  // Upload evidence mutation
  const uploadEvidence = api.evidence.upload.useMutation();

  // Link mutation
  const linkMutation = api.risk.linkEvidenceToRisk.useMutation({
    onSuccess: () => {
      toast.success("Evidence linked successfully");
      onSuccess();
    },
    onError: (err) => {
      if (err.message.includes("already linked")) {
        toast.error("This evidence is already linked to this risk");
      } else {
        toast.error(err.message || "Failed to link evidence");
      }
    },
  });

  // Handle file selection
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateFile(file.name, file.size, file.type);
    if (!validation.valid) {
      toast.error(validation.errors.map(err => err.message).join(", "));
      return;
    }

    setUploadFile(file);
    // Auto-fill title from filename if empty
    if (!uploadTitle) {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      setUploadTitle(nameWithoutExt);
    }
  }, [uploadTitle]);

  // Handle drag and drop
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const validation = validateFile(file.name, file.size, file.type);
    if (!validation.valid) {
      toast.error(validation.errors.map(err => err.message).join(", "));
      return;
    }

    setUploadFile(file);
    if (!uploadTitle) {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      setUploadTitle(nameWithoutExt);
    }
  }, [uploadTitle]);

  // Read file as base64
  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix (e.g., "data:application/pdf;base64,")
        const base64 = result.split(",")[1];
        resolve(base64 ?? "");
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  };

  // Handle upload and link
  const handleUploadAndLink = async () => {
    if (!uploadFile || !uploadTitle.trim()) {
      toast.error("Please select a file and provide a title");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Step 1: Read file as base64
      setUploadProgress(10);
      const fileContent = await readFileAsBase64(uploadFile);

      // Step 2: Upload evidence via tRPC
      setUploadProgress(40);
      const evidence = await uploadEvidence.mutateAsync({
        fileContent,
        fileName: uploadFile.name,
        mimeType: uploadFile.type,
        title: uploadTitle.trim(),
        description: uploadDescription.trim() || undefined,
        controlDomainIds: selectedDomainIds,
      });

      if (!evidence) {
        throw new Error("Failed to create evidence record");
      }

      // Step 3: Link to risk
      setUploadProgress(80);
      await linkMutation.mutateAsync({
        riskId,
        evidenceId: evidence.id,
        linkType,
      });

      setUploadProgress(100);
      // Success handled by linkMutation.onSuccess
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to upload and link evidence");
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleSubmit = () => {
    if (activeTab === "upload") {
      handleUploadAndLink();
      return;
    }

    if (!selectedEvidenceId) {
      toast.error("Please select evidence to link");
      return;
    }

    linkMutation.mutate({
      riskId,
      evidenceId: selectedEvidenceId,
      linkType,
    });
  };

  const evidenceList = data?.items || [];
  const canSubmit = activeTab === "existing"
    ? !!selectedEvidenceId
    : !!uploadFile && !!uploadTitle.trim();

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-500" />
            Link Evidence to Risk
          </DialogTitle>
          <DialogDescription>
            Attach existing evidence or upload a new file to link to this risk.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4 py-4">
          {/* Link Type Selection (shared by both tabs) */}
          <div className="space-y-2">
            <Label>Evidence Type</Label>
            <RadioGroup
              value={linkType}
              onValueChange={(value) =>
                setLinkType(value as RiskEvidenceLinkType)
              }
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="FINDING" id="finding" />
                <Label
                  htmlFor="finding"
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Finding Evidence
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="REMEDIATION" id="remediation" />
                <Label
                  htmlFor="remediation"
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Remediation Evidence
                </Label>
              </div>
            </RadioGroup>
            <p className="text-xs text-gray-500 mt-1">
              {linkType === "FINDING"
                ? "Finding evidence documents the risk or vulnerability (e.g., scan reports, screenshots)"
                : "Remediation evidence proves the risk has been addressed (e.g., config changes, patches)"}
            </p>
          </div>

          {/* Tabs for existing vs upload */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "existing" | "upload")} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="existing" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Select Existing
              </TabsTrigger>
              <TabsTrigger value="upload" className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Upload New
              </TabsTrigger>
            </TabsList>

            {/* Existing Evidence Tab */}
            <TabsContent value="existing" className="flex-1 flex flex-col gap-3 overflow-hidden mt-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="search"
                  placeholder="Search evidence by title or filename..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Evidence List */}
              <div className="flex-1 overflow-auto border rounded-lg">
                {isLoading ? (
                  <div className="p-4 space-y-3">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : error ? (
                  <div className="p-4 text-center text-red-500">
                    Failed to load evidence: {error.message}
                  </div>
                ) : evidenceList.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p>No evidence found</p>
                    {search && (
                      <p className="text-sm text-gray-400 mt-2">
                        Try a different search term
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="divide-y">
                    {evidenceList.map((evidence) => (
                      <button
                        key={evidence.id}
                        onClick={() => setSelectedEvidenceId(evidence.id)}
                        className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                          selectedEvidenceId === evidence.id
                            ? "bg-blue-50 border-l-4 border-blue-500"
                            : ""
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`p-2 rounded-lg ${
                              selectedEvidenceId === evidence.id
                                ? "bg-blue-100"
                                : "bg-gray-100"
                            }`}
                          >
                            <FileText
                              className={`h-5 w-5 ${
                                selectedEvidenceId === evidence.id
                                  ? "text-blue-600"
                                  : "text-gray-500"
                              }`}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">
                              {evidence.title}
                            </p>
                            <p className="text-sm text-gray-500 truncate">
                              {evidence.originalFileName} ({formatFileSize(evidence.fileSize)})
                            </p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                              <span>Uploaded {formatDate(evidence.createdAt)}</span>
                              {evidence.EvidenceControlDomain && evidence.EvidenceControlDomain.length > 0 && (
                                <Badge variant="secondary" className="text-xs">
                                  {evidence.EvidenceControlDomain.length} domain
                                  {evidence.EvidenceControlDomain.length !== 1 ? "s" : ""}
                                </Badge>
                              )}
                            </div>
                          </div>
                          {selectedEvidenceId === evidence.id && (
                            <CheckCircle2 className="h-5 w-5 text-blue-500 flex-shrink-0" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Pagination info */}
              {data && data.total > 50 && (
                <p className="text-xs text-gray-500 text-center">
                  Showing 50 of {data.total} evidence files. Use search to find more.
                </p>
              )}
            </TabsContent>

            {/* Upload New Tab */}
            <TabsContent value="upload" className="flex-1 flex flex-col gap-4 overflow-auto mt-3">
              {/* File Drop Zone */}
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  uploadFile ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                }`}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={getAcceptAttribute()}
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {uploadFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileText className="h-8 w-8 text-blue-500" />
                    <div className="text-left">
                      <p className="font-medium text-gray-900">{uploadFile.name}</p>
                      <p className="text-sm text-gray-500">{formatFileSize(uploadFile.size)}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setUploadFile(null)}
                      className="ml-2"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Upload className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 mb-1">
                      Drag and drop a file here, or{" "}
                      <button
                        type="button"
                        className="text-blue-600 hover:underline"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        browse
                      </button>
                    </p>
                    <p className="text-xs text-gray-400">
                      Max file size: {formatFileSize(MAX_FILE_SIZE)}
                    </p>
                  </>
                )}
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="upload-title">Title *</Label>
                <Input
                  id="upload-title"
                  placeholder="Enter evidence title..."
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="upload-description">Description (optional)</Label>
                <Textarea
                  id="upload-description"
                  placeholder="Describe the evidence..."
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  rows={2}
                />
              </div>

              {/* Control Domains */}
              <div className="space-y-2">
                <Label>Control Domains (optional)</Label>
                <ControlDomainSelector
                  value={selectedDomainIds}
                  onChange={setSelectedDomainIds}
                />
              </div>

              {/* Upload Progress */}
              {isUploading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Uploading...</span>
                    <span className="text-gray-500">{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} />
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || linkMutation.isPending || isUploading}
          >
            {linkMutation.isPending || isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {isUploading ? "Uploading..." : "Linking..."}
              </>
            ) : activeTab === "upload" ? (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload & Link
              </>
            ) : (
              "Link Evidence"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
