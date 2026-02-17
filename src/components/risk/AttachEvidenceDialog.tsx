"use client";

/**
 * Attach Evidence Dialog Component
 *
 * A dialog that combines evidence upload with risk linkage in a single step.
 * Uploads new evidence and automatically links it to the specified risk.
 *
 * @see Story 4.4: AC16-AC21 - Evidence Upload from Risk Page
 */

import { useState, useCallback, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Upload,
  X,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  FileText,
} from "lucide-react";
import toast from "react-hot-toast";
import { RiskEvidenceLinkType } from "@prisma/client";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
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
import { ControlDomainSelector } from "@/components/evidence/ControlDomainSelector";
import { FrameworkMappingPreview } from "@/components/evidence/FrameworkMappingPreview";

// Form schema for evidence metadata with link type
const attachEvidenceSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(5000).optional(),
  controlDomainIds: z
    .array(z.string())
    .min(1, "At least one control domain is required")
    .max(5, "Maximum 5 control domains allowed"),
  linkType: z.nativeEnum(RiskEvidenceLinkType),
});

type AttachEvidenceFormData = z.infer<typeof attachEvidenceSchema>;

interface AttachEvidenceDialogProps {
  /** Risk ID to link evidence to */
  riskId: string;
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog is closed */
  onOpenChange: (open: boolean) => void;
  /** Callback when upload and link is successful */
  onSuccess?: () => void;
}

type UploadStatus = "idle" | "uploading" | "linking" | "success" | "error";

/**
 * Read file as base64 string
 */
function readFileAsBase64(file: File): Promise<string> {
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
}

export function AttachEvidenceDialog({
  riskId,
  open,
  onOpenChange,
  onSuccess,
}: AttachEvidenceDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = api.useUtils();

  const form = useForm<AttachEvidenceFormData>({
    resolver: zodResolver(attachEvidenceSchema),
    defaultValues: {
      title: "",
      description: "",
      controlDomainIds: [],
      linkType: RiskEvidenceLinkType.FINDING,
    },
  });

  // Upload mutation
  const uploadMutation = api.evidence.upload.useMutation();

  // Link mutation
  const linkMutation = api.risk.linkEvidenceToRisk.useMutation();

  // Handle file selection
  const handleFileSelect = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const file = files[0];
      if (!file) return;

      // Clear previous state
      setErrorMessage(null);
      setUploadStatus("idle");
      setProgress(0);

      // Validate file
      const validation = validateFile(file.name, file.size, file.type);
      if (!validation.valid) {
        const errors = validation.errors.map((e) => e.message).join(", ");
        setErrorMessage(errors);
        toast.error(errors);
        return;
      }

      setSelectedFile(file);
      // Set default title from filename (without extension)
      const titleWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      form.setValue("title", titleWithoutExt);
    },
    [form]
  );

  // Drag handlers
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

  // Remove selected file
  const handleRemoveFile = useCallback(() => {
    setSelectedFile(null);
    setErrorMessage(null);
    setUploadStatus("idle");
    setProgress(0);
    form.reset();
  }, [form]);

  // Handle form submission - upload and link
  const handleSubmit = useCallback(
    async (data: AttachEvidenceFormData) => {
      if (!selectedFile) {
        toast.error("Please select a file to upload");
        return;
      }

      setErrorMessage(null);
      setUploadStatus("uploading");
      setProgress(10);

      try {
        // Step 1: Read file as base64
        const fileContent = await readFileAsBase64(selectedFile);
        setProgress(30);

        // Step 2: Upload evidence
        const evidence = await uploadMutation.mutateAsync({
          fileContent,
          fileName: selectedFile.name,
          mimeType: selectedFile.type,
          title: data.title,
          description: data.description,
          controlDomainIds: data.controlDomainIds,
        });

        if (!evidence?.id) {
          throw new Error("Failed to upload evidence - no ID returned");
        }
        setProgress(70);

        // Step 3: Link evidence to risk
        setUploadStatus("linking");
        await linkMutation.mutateAsync({
          riskId,
          evidenceId: evidence.id,
          linkType: data.linkType,
        });
        setProgress(100);

        // Success!
        setUploadStatus("success");
        toast.success("Evidence uploaded and linked to risk");

        // Invalidate queries
        void utils.evidence.list.invalidate();
        void utils.evidence.getStatistics.invalidate();
        void utils.risk.getRiskEvidence.invalidate({ riskId });
        void utils.risk.getById.invalidate({ id: riskId });

        // Call success callback and close
        onSuccess?.();
        setTimeout(() => {
          onOpenChange(false);
          // Reset state after dialog closes
          setSelectedFile(null);
          setUploadStatus("idle");
          setProgress(0);
          form.reset();
        }, 500);
      } catch (error) {
        setUploadStatus("error");
        const message = error instanceof Error ? error.message : "Operation failed";

        // Provide helpful message if upload succeeded but linking failed
        if (progress >= 70) {
          // Upload succeeded (progress was at 70), linking failed
          const helpfulMessage = `${message}. The evidence was uploaded but linking failed. You can link it using the "Link Evidence" button.`;
          setErrorMessage(helpfulMessage);
          toast.error("Linking failed - evidence was uploaded. Use 'Link Evidence' to retry.");
        } else {
          setErrorMessage(message);
          toast.error(message);
        }
      }
    },
    [
      selectedFile,
      riskId,
      uploadMutation,
      linkMutation,
      utils,
      onSuccess,
      onOpenChange,
      form,
    ]
  );

  // Handle dialog close
  const handleClose = useCallback(() => {
    if (uploadStatus === "uploading" || uploadStatus === "linking") {
      return; // Prevent closing during upload
    }
    setSelectedFile(null);
    setUploadStatus("idle");
    setProgress(0);
    setErrorMessage(null);
    form.reset();
    onOpenChange(false);
  }, [uploadStatus, form, onOpenChange]);

  const isProcessing = uploadStatus === "uploading" || uploadStatus === "linking";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-blue-500" />
            Attach Evidence to Risk
          </DialogTitle>
          <DialogDescription>
            Upload a new evidence file and link it to this risk. The evidence will
            be available in the evidence repository.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <div className="space-y-6 py-4">
            {/* File Drop Zone */}
            {!selectedFile ? (
              <div
                role="button"
                tabIndex={0}
                aria-label="Upload file. Click or press Enter to select a file, or drag and drop"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                className={`
                  border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                  focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
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
                  accept={getAcceptAttribute()}
                  onChange={(e) => handleFileSelect(e.target.files)}
                  className="hidden"
                />
                <Upload className="mx-auto h-10 w-10 text-gray-400 mb-3" />
                <p className="text-sm font-medium">
                  Drag and drop a file, or click to select
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Supported: {SUPPORTED_EXTENSIONS.join(", ")}
                </p>
                <p className="text-xs text-gray-500">
                  Max size: {formatFileSize(MAX_FILE_SIZE)}
                </p>
              </div>
            ) : (
              /* Selected File Display */
              <div className="border rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <FileText className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{selectedFile.name}</p>
                    <p className="text-sm text-gray-500">
                      {formatFileSize(selectedFile.size)}
                    </p>
                    {uploadStatus === "uploading" && (
                      <div className="mt-2">
                        <Progress value={progress} className="h-2" />
                        <p className="text-xs text-gray-500 mt-1">
                          Uploading... {progress}%
                        </p>
                      </div>
                    )}
                    {uploadStatus === "linking" && (
                      <div className="mt-2">
                        <Progress value={progress} className="h-2" />
                        <p className="text-xs text-gray-500 mt-1">
                          Linking to risk...
                        </p>
                      </div>
                    )}
                    {uploadStatus === "success" && (
                      <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                        <CheckCircle2 className="h-4 w-4" />
                        Uploaded and linked successfully
                      </p>
                    )}
                    {uploadStatus === "error" && (
                      <p className="text-sm text-red-500 mt-1">
                        {errorMessage}
                      </p>
                    )}
                  </div>
                  {!isProcessing && uploadStatus !== "success" && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={handleRemoveFile}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Error message */}
            {errorMessage && !selectedFile && (
              <div className="text-sm text-red-500">{errorMessage}</div>
            )}

            {/* Only show form fields when file is selected */}
            {selectedFile && (
              <>
                {/* Title */}
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    {...form.register("title")}
                    placeholder="Enter evidence title"
                    disabled={isProcessing}
                  />
                  {form.formState.errors.title && (
                    <p className="text-sm text-red-500">
                      {form.formState.errors.title.message}
                    </p>
                  )}
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    {...form.register("description")}
                    placeholder="Optional description"
                    rows={2}
                    disabled={isProcessing}
                  />
                </div>

                {/* Link Type Selection - AC19 */}
                <div className="space-y-2">
                  <Label>Evidence Type *</Label>
                  <RadioGroup
                    value={form.watch("linkType")}
                    onValueChange={(value) =>
                      form.setValue("linkType", value as RiskEvidenceLinkType)
                    }
                    className="flex gap-4"
                    disabled={isProcessing}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="FINDING" id="finding" />
                      <Label
                        htmlFor="finding"
                        className="flex items-center gap-2 cursor-pointer font-normal"
                      >
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        Finding Evidence
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="REMEDIATION" id="remediation" />
                      <Label
                        htmlFor="remediation"
                        className="flex items-center gap-2 cursor-pointer font-normal"
                      >
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        Remediation Evidence
                      </Label>
                    </div>
                  </RadioGroup>
                  <p className="text-xs text-gray-500 mt-1">
                    {form.watch("linkType") === "FINDING"
                      ? "Finding evidence documents the risk (e.g., scan reports, screenshots)"
                      : "Remediation evidence proves the risk has been addressed (e.g., config changes, patches)"}
                  </p>
                </div>

                {/* Control Domain Selection */}
                <div className="space-y-2">
                  <Label>Control Domains *</Label>
                  <p className="text-xs text-muted-foreground">
                    Select 1-5 control domains that this evidence demonstrates
                    compliance with.
                  </p>
                  <ControlDomainSelector
                    value={form.watch("controlDomainIds")}
                    onChange={(ids) =>
                      form.setValue("controlDomainIds", ids, {
                        shouldValidate: true,
                      })
                    }
                    error={form.formState.errors.controlDomainIds?.message}
                    disabled={isProcessing}
                  />
                </div>

                {/* Framework Mapping Preview */}
                {form.watch("controlDomainIds").length > 0 && (
                  <div className="pt-2 border-t">
                    <FrameworkMappingPreview
                      controlDomainIds={form.watch("controlDomainIds")}
                      compact
                    />
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!selectedFile || isProcessing || uploadStatus === "success"}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {uploadStatus === "uploading" ? "Uploading..." : "Linking..."}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload and Link
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
