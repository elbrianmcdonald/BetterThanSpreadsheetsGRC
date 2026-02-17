"use client";

/**
 * Evidence Upload Component
 *
 * Provides drag-and-drop file upload with:
 * - Multiple file selection
 * - Client-side validation
 * - Upload progress tracking
 * - Error handling
 *
 * @see Story 3.1: Evidence File Upload and Processing
 */

import { useState, useCallback, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Upload, X, File, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  validateFile,
  formatFileSize,
  getAcceptAttribute,
  SUPPORTED_EXTENSIONS,
  MAX_FILE_SIZE,
} from "@/utils/file-validation";
import { ControlDomainSelector } from "./ControlDomainSelector";
import { FrameworkMappingPreview } from "./FrameworkMappingPreview";
import { SingleBUDropdown } from "@/components/business-unit/BusinessUnitDropdown";

// Form schema for evidence metadata
// Story 3.3: Added controlDomainIds for control taxonomy tagging
// BU-Scoped Compliance: Added businessUnitId for BU assignment
const evidenceFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(5000).optional(),
  controlDomainIds: z
    .array(z.string())
    .min(1, "At least one control domain is required")
    .max(5, "Maximum 5 control domains allowed"),
  businessUnitId: z.string().optional(),
});

type EvidenceFormData = z.infer<typeof evidenceFormSchema>;

interface FileWithPreview extends File {
  preview?: string;
}

interface UploadingFile {
  file: FileWithPreview;
  title: string;
  description?: string;
  controlDomainIds: string[];
  businessUnitId?: string;
  status: "pending" | "uploading" | "success" | "error";
  progress: number;
  error?: string;
}

interface EvidenceUploadProps {
  /** Callback when upload is complete */
  onUploadComplete?: () => void;
  /** Maximum number of files to upload at once */
  maxFiles?: number;
}

export function EvidenceUpload({
  onUploadComplete,
  maxFiles = 10,
}: EvidenceUploadProps) {
  const [files, setFiles] = useState<UploadingFile[]>([]);
  const [showMetadataDialog, setShowMetadataDialog] = useState(false);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = api.useUtils();

  const uploadMutation = api.evidence.upload.useMutation({
    onSuccess: () => {
      void utils.evidence.list.invalidate();
      void utils.evidence.getStatistics.invalidate();
    },
  });

  const form = useForm<EvidenceFormData>({
    resolver: zodResolver(evidenceFormSchema),
    defaultValues: {
      title: "",
      description: "",
      controlDomainIds: [],
      businessUnitId: undefined,
    },
  });

  // File selection handler
  const handleFileSelect = useCallback(
    (selectedFiles: FileList | null) => {
      if (!selectedFiles) return;

      const newFiles: UploadingFile[] = [];
      const errors: string[] = [];

      for (let i = 0; i < Math.min(selectedFiles.length, maxFiles - files.length); i++) {
        const file = selectedFiles[i];
        if (!file) continue;

        // Client-side validation
        const validation = validateFile(file.name, file.size, file.type);

        if (!validation.valid) {
          errors.push(`${file.name}: ${validation.errors.map((e) => e.message).join(", ")}`);
          continue;
        }

        newFiles.push({
          file: file as FileWithPreview,
          title: file.name.replace(/\.[^/.]+$/, ""), // Default title from filename without extension
          controlDomainIds: [], // Story 3.3: Initialize empty control domains
          status: "pending",
          progress: 0,
        });
      }

      if (errors.length > 0) {
        errors.forEach((error) => toast.error(error));
      }

      if (newFiles.length > 0) {
        setFiles((prev) => [...prev, ...newFiles]);
        // Open metadata dialog for first new file
        setCurrentFileIndex(files.length);
        setShowMetadataDialog(true);
      }
    },
    [files.length, maxFiles]
  );

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFileSelect(e.dataTransfer.files);
    },
    [handleFileSelect]
  );

  // Remove file from list
  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Save metadata and move to next file
  // Story 3.3: Updated to include controlDomainIds
  // BU-Scoped Compliance: Updated to include businessUnitId
  const handleSaveMetadata = useCallback(
    (data: EvidenceFormData) => {
      setFiles((prev) =>
        prev.map((f, i) =>
          i === currentFileIndex
            ? {
                ...f,
                title: data.title,
                description: data.description,
                controlDomainIds: data.controlDomainIds,
                businessUnitId: data.businessUnitId,
              }
            : f
        )
      );

      // If there are more files to configure, move to next
      if (currentFileIndex < files.length - 1) {
        setCurrentFileIndex((prev) => prev + 1);
        const nextFile = files[currentFileIndex + 1];
        form.reset({
          title: nextFile?.file.name.replace(/\.[^/.]+$/, "") ?? "",
          description: "",
          controlDomainIds: nextFile?.controlDomainIds ?? [],
          businessUnitId: nextFile?.businessUnitId,
        });
      } else {
        // All files configured, close dialog
        setShowMetadataDialog(false);
        form.reset();
      }
    },
    [currentFileIndex, files, form]
  );

  // Upload all files
  const handleUploadAll = useCallback(async () => {
    const pendingFiles = files.filter((f) => f.status === "pending");
    if (pendingFiles.length === 0) return;

    // Process files sequentially
    for (let i = 0; i < files.length; i++) {
      const uploadFile = files[i];
      if (!uploadFile || uploadFile.status !== "pending") continue;

      // Update status to uploading
      setFiles((prev) =>
        prev.map((f, idx) => (idx === i ? { ...f, status: "uploading" as const, progress: 10 } : f))
      );

      try {
        // Read file as base64
        const fileContent = await readFileAsBase64(uploadFile.file);

        // Update progress
        setFiles((prev) =>
          prev.map((f, idx) => (idx === i ? { ...f, progress: 50 } : f))
        );

        // Upload via tRPC
        // Story 3.3: Include controlDomainIds for tagging
        // BU-Scoped Compliance: Include businessUnitId
        await uploadMutation.mutateAsync({
          fileContent,
          fileName: uploadFile.file.name,
          mimeType: uploadFile.file.type,
          title: uploadFile.title,
          description: uploadFile.description,
          controlDomainIds: uploadFile.controlDomainIds,
          businessUnitId: uploadFile.businessUnitId,
        });

        // Mark as success
        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, status: "success" as const, progress: 100 } : f
          )
        );

        toast.success(`Uploaded: ${uploadFile.title}`);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Upload failed";

        // Mark as error
        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, status: "error" as const, error: errorMessage } : f
          )
        );

        toast.error(`Failed to upload ${uploadFile.title}: ${errorMessage}`);
      }
    }

    // Callback after all uploads complete
    onUploadComplete?.();
  }, [files, uploadMutation, onUploadComplete]);

  // Clear all files
  const handleClearAll = useCallback(() => {
    setFiles([]);
  }, []);

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

  // Get file icon based on status
  const getStatusIcon = (status: UploadingFile["status"]) => {
    switch (status) {
      case "uploading":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case "success":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <File className="h-4 w-4 text-gray-500" />;
    }
  };

  const pendingCount = files.filter((f) => f.status === "pending").length;
  const uploadingCount = files.filter((f) => f.status === "uploading").length;

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-gray-300 hover:border-gray-400"
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={getAcceptAttribute()}
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />
        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <p className="text-lg font-medium">
          Drag and drop files here, or click to select
        </p>
        <p className="text-sm text-gray-500 mt-2">
          Supported types: {SUPPORTED_EXTENSIONS.join(", ")}
        </p>
        <p className="text-sm text-gray-500">
          Maximum file size: {formatFileSize(MAX_FILE_SIZE)}
        </p>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-medium">
                {files.length} file{files.length !== 1 ? "s" : ""} selected
              </h3>
              <div className="space-x-2">
                {pendingCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCurrentFileIndex(0);
                      const firstFile = files[0];
                      form.reset({
                        title: firstFile?.title ?? "",
                        description: firstFile?.description ?? "",
                        controlDomainIds: firstFile?.controlDomainIds ?? [],
                        businessUnitId: firstFile?.businessUnitId,
                      });
                      setShowMetadataDialog(true);
                    }}
                  >
                    Edit Metadata
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearAll}
                  disabled={uploadingCount > 0}
                >
                  Clear All
                </Button>
                <Button
                  size="sm"
                  onClick={handleUploadAll}
                  disabled={pendingCount === 0 || uploadingCount > 0}
                >
                  {uploadingCount > 0 ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload All ({pendingCount})
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {files.map((uploadFile, index) => (
                <div
                  key={`${uploadFile.file.name}-${index}`}
                  className="flex items-center gap-4 p-3 rounded-lg bg-gray-50"
                >
                  {getStatusIcon(uploadFile.status)}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{uploadFile.title}</p>
                    <p className="text-sm text-gray-500">
                      {uploadFile.file.name} ({formatFileSize(uploadFile.file.size)})
                    </p>
                    {uploadFile.error && (
                      <p className="text-sm text-red-500">{uploadFile.error}</p>
                    )}
                    {uploadFile.status === "uploading" && (
                      <Progress value={uploadFile.progress} className="mt-2 h-2" />
                    )}
                  </div>
                  {uploadFile.status === "pending" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFile(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metadata dialog */}
      <Dialog open={showMetadataDialog} onOpenChange={setShowMetadataDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              File Details ({currentFileIndex + 1} of {files.length})
            </DialogTitle>
            <DialogDescription>
              Enter a title and optional description for this evidence file.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(handleSaveMetadata)}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="fileName">File</Label>
                <p className="text-sm text-gray-600">
                  {files[currentFileIndex]?.file.name ?? "No file selected"}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  {...form.register("title")}
                  placeholder="Enter evidence title"
                />
                {form.formState.errors.title && (
                  <p className="text-sm text-red-500">
                    {form.formState.errors.title.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  {...form.register("description")}
                  placeholder="Optional description"
                  rows={3}
                />
              </div>

              {/* BU-Scoped Compliance: Business Unit Selection */}
              <div className="space-y-2">
                <Label>Business Unit</Label>
                <p className="text-xs text-muted-foreground">
                  Select the business unit this evidence belongs to for compliance tracking.
                </p>
                <SingleBUDropdown
                  value={form.watch("businessUnitId") ?? null}
                  onChange={(id) => form.setValue("businessUnitId", id ?? undefined)}
                  placeholder="Select Business Unit"
                  clearable
                />
              </div>

              {/* Story 3.3: Control Domain Selection */}
              <div className="space-y-2">
                <Label>Control Domains *</Label>
                <p className="text-xs text-muted-foreground">
                  Select 1-5 control domains that this evidence demonstrates compliance with.
                </p>
                <ControlDomainSelector
                  value={form.watch("controlDomainIds")}
                  onChange={(ids) => form.setValue("controlDomainIds", ids, { shouldValidate: true })}
                  error={form.formState.errors.controlDomainIds?.message}
                />
              </div>

              {/* Story 3.4: Framework Mapping Preview */}
              {form.watch("controlDomainIds").length > 0 && (
                <div className="pt-2 border-t">
                  <FrameworkMappingPreview
                    controlDomainIds={form.watch("controlDomainIds")}
                    compact={false}
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowMetadataDialog(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {currentFileIndex < files.length - 1 ? "Next" : "Done"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
