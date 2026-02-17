"use client";

/**
 * Bulk Control Upload Component
 *
 * Story 12.4 AC33-AC38: Bulk import controls with preview and duplicate handling
 *
 * Features:
 * - Template download
 * - Drag-and-drop file upload
 * - File validation
 * - Import preview before execution (AC35)
 * - Duplicate handling options: skip/update/error (AC36)
 * - Detailed import summary (AC37)
 * - Error display with row numbers
 * - Progress indication
 */

import { useState, useCallback, useRef } from "react";
import {
  Upload,
  Download,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  X,
  Eye,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { toast } from "react-hot-toast";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/trpc/react";
import { validateExcelFile, MAX_FILE_SIZE_BYTES } from "@/lib/excel-parser";

interface BulkControlUploadProps {
  standardId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type UploadState = "idle" | "selected" | "previewing" | "preview" | "uploading" | "success" | "error";
type DuplicateMode = "error" | "skip" | "update";

interface PreviewData {
  valid: boolean;
  errors: Array<{ row: number; field: string; message: string }>;
  totalRows: number;
  preview: Array<{
    code: string;
    title: string;
    description?: string;
    guidance?: string;
    criticality?: string;
  }>;
  duplicates: Array<{ code: string; title: string; existingId: string }>;
  newControls: number;
  existingControls: number;
}

interface ImportSummary {
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; code: string; message: string }>;
}

export function BulkControlUpload({
  standardId,
  open,
  onOpenChange,
  onSuccess,
}: BulkControlUploadProps) {
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [duplicateMode, setDuplicateMode] = useState<DuplicateMode>("error");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Template download query
  const templateQuery = api.standard.downloadControlTemplate.useQuery(undefined, {
    enabled: false,
  });

  // Preview mutation (Story 12.4 AC35)
  const previewMutation = api.standard.previewBulkUpload.useMutation({
    onSuccess: (data) => {
      setPreviewData(data);
      if (data.valid) {
        setUploadState("preview");
      } else {
        setUploadState("error");
        setErrorMessage(
          data.errors.map((e) => `Row ${e.row}: ${e.message}`).join("\n")
        );
      }
    },
    onError: (error) => {
      setUploadState("error");
      setErrorMessage(error.message);
    },
  });

  // Bulk upload mutation
  const bulkCreateMutation = api.standard.bulkCreateControls.useMutation({
    onSuccess: (data) => {
      setUploadState("success");
      setImportSummary(data.summary);
      toast.success(
        `Import complete: ${data.summary.created} created, ${data.summary.updated} updated, ${data.summary.skipped} skipped`
      );
      onSuccess();
    },
    onError: (error) => {
      setUploadState("error");
      setErrorMessage(error.message);
      toast.error("Failed to import controls");
    },
  });

  // Handle template download
  const handleDownloadTemplate = useCallback(async () => {
    let url: string | null = null;
    let link: HTMLAnchorElement | null = null;

    try {
      const result = await templateQuery.refetch();
      if (result.data) {
        const byteCharacters = atob(result.data.content);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: result.data.mimeType });

        url = URL.createObjectURL(blob);
        link = document.createElement("a");
        link.href = url;
        link.download = result.data.fileName;
        document.body.appendChild(link);
        link.click();

        toast.success("Template downloaded");
      }
    } catch (err) {
      console.error("Template download error:", err);
      toast.error("Failed to download template");
    } finally {
      if (link && document.body.contains(link)) {
        document.body.removeChild(link);
      }
      if (url) {
        URL.revokeObjectURL(url);
      }
    }
  }, [templateQuery]);

  // Handle file selection
  const handleFileSelect = useCallback((file: File) => {
    const error = validateExcelFile(file.name, file.size);
    if (error) {
      setErrorMessage(error);
      setUploadState("error");
      return;
    }

    setSelectedFile(file);
    setErrorMessage(null);
    setPreviewData(null);
    setImportSummary(null);
    setUploadState("selected");
  }, []);

  // Handle file input change
  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // Handle drag events
  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // Handle preview (Story 12.4 AC35)
  const handlePreview = useCallback(async () => {
    if (!selectedFile) return;

    setUploadState("previewing");
    setErrorMessage(null);

    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        const base64Content = base64.split(",")[1] ?? base64;
        setFileContent(base64Content);

        previewMutation.mutate({
          standardId,
          fileContent: base64Content,
          fileName: selectedFile.name,
        });
      };
      reader.onerror = (err) => {
        console.error("FileReader error:", err);
        setUploadState("error");
        setErrorMessage("Failed to read file. Please try again.");
      };
      reader.readAsDataURL(selectedFile);
    } catch (err) {
      console.error("Preview error:", err);
      setUploadState("error");
      setErrorMessage("Failed to process file. Please ensure it's a valid Excel file.");
    }
  }, [selectedFile, standardId, previewMutation]);

  // Handle upload
  const handleUpload = useCallback(async () => {
    if (!fileContent || !selectedFile) return;

    setUploadState("uploading");
    setErrorMessage(null);

    bulkCreateMutation.mutate({
      standardId,
      fileContent,
      fileName: selectedFile.name,
      duplicateMode,
    });
  }, [fileContent, selectedFile, standardId, duplicateMode, bulkCreateMutation]);

  // Reset state when dialog closes
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setUploadState("idle");
      setSelectedFile(null);
      setFileContent(null);
      setErrorMessage(null);
      setPreviewData(null);
      setImportSummary(null);
      setDuplicateMode("error");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
    onOpenChange(open);
  };

  // Handle click on drop zone
  const handleDropZoneClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Bulk Upload Controls
          </DialogTitle>
          <DialogDescription>
            Upload an Excel file to import multiple controls at once
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Template download */}
          <div className="flex items-center justify-between rounded-lg border border-dashed p-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium">Download Template</p>
                <p className="text-xs text-muted-foreground">
                  Get the Excel template with column headers and examples
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              disabled={templateQuery.isFetching}
            >
              <Download className="mr-2 h-4 w-4" />
              {templateQuery.isFetching ? "Downloading..." : "Download"}
            </Button>
          </div>

          {/* File upload zone - only show if not in preview/success state */}
          {!["preview", "success"].includes(uploadState) && (
            <div
              className={`relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : uploadState === "error"
                    ? "border-destructive bg-destructive/5"
                    : "border-muted-foreground/25 hover:border-muted-foreground/50"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={handleDropZoneClick}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                onChange={handleFileInputChange}
                className="sr-only"
              />

              {selectedFile ? (
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                      setFileContent(null);
                      setUploadState("idle");
                      setErrorMessage(null);
                      setPreviewData(null);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-medium">
                    Drop your Excel file here or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Only .xlsx files up to {MAX_FILE_SIZE_BYTES / 1024 / 1024}MB
                  </p>
                </>
              )}
            </div>
          )}

          {/* Preview results (Story 12.4 AC35) */}
          {uploadState === "preview" && previewData && (
            <div className="space-y-4">
              {/* Summary badges */}
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="bg-green-50 text-green-700">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  {previewData.newControls} new controls
                </Badge>
                {previewData.existingControls > 0 && (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700">
                    <AlertTriangle className="mr-1 h-3 w-3" />
                    {previewData.existingControls} duplicates
                  </Badge>
                )}
                <Badge variant="secondary">
                  {previewData.totalRows} total rows
                </Badge>
              </div>

              {/* Duplicate handling mode (Story 12.4 AC36) */}
              {previewData.existingControls > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <div className="flex items-start gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-800">
                        {previewData.existingControls} control code(s) already exist
                      </p>
                      <p className="text-xs text-amber-700">
                        {previewData.duplicates.slice(0, 3).map(d => d.code).join(", ")}
                        {previewData.duplicates.length > 3 && ` and ${previewData.duplicates.length - 3} more`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="duplicate-mode" className="text-sm text-amber-800">
                      When duplicates found:
                    </Label>
                    <Select
                      value={duplicateMode}
                      onValueChange={(v) => setDuplicateMode(v as DuplicateMode)}
                    >
                      <SelectTrigger id="duplicate-mode" className="w-[180px] h-8 bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="error">
                          <span className="flex items-center gap-1">
                            <AlertCircle className="h-3 w-3 text-red-500" />
                            Stop import (error)
                          </span>
                        </SelectItem>
                        <SelectItem value="skip">
                          <span className="flex items-center gap-1">
                            <RefreshCw className="h-3 w-3 text-amber-500" />
                            Skip duplicates
                          </span>
                        </SelectItem>
                        <SelectItem value="update">
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                            Update existing
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Preview table */}
              <div className="rounded-lg border">
                <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/50">
                  <Eye className="h-4 w-4" />
                  <span className="text-sm font-medium">Preview (first 20 rows)</span>
                </div>
                <div className="max-h-[200px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">Code</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead className="w-[80px]">Criticality</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.preview.map((row, idx) => {
                        const isDuplicate = previewData.duplicates.some(
                          d => d.code.toUpperCase() === row.code.toUpperCase()
                        );
                        return (
                          <TableRow
                            key={idx}
                            className={isDuplicate ? "bg-amber-50" : undefined}
                          >
                            <TableCell className="font-mono text-xs">
                              {row.code}
                              {isDuplicate && (
                                <Badge variant="outline" className="ml-1 text-[10px] py-0 bg-amber-100">
                                  exists
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-sm truncate max-w-[200px]">
                              {row.title}
                            </TableCell>
                            <TableCell>
                              {row.criticality && (
                                <Badge variant="outline" className="text-xs">
                                  {row.criticality}
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}

          {/* Error message */}
          {uploadState === "error" && errorMessage && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div className="text-sm whitespace-pre-wrap">{errorMessage}</div>
            </div>
          )}

          {/* Success message with detailed summary (Story 12.4 AC37) */}
          {uploadState === "success" && importSummary && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-lg bg-green-100 p-3 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                <CheckCircle2 className="h-5 w-5" />
                <div>
                  <p className="font-medium">Import Complete</p>
                  <p className="text-sm">
                    Successfully processed {importSummary.totalRows} rows
                  </p>
                </div>
              </div>

              {/* Detailed summary */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">{importSummary.created}</p>
                  <p className="text-xs text-muted-foreground">Created</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold text-blue-600">{importSummary.updated}</p>
                  <p className="text-xs text-muted-foreground">Updated</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold text-amber-600">{importSummary.skipped}</p>
                  <p className="text-xs text-muted-foreground">Skipped</p>
                </div>
              </div>

              {/* Show errors if any */}
              {importSummary.errors.length > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-sm font-medium text-red-800 mb-2">
                    {importSummary.errors.length} error(s) encountered:
                  </p>
                  <ul className="text-xs text-red-700 space-y-1">
                    {importSummary.errors.slice(0, 5).map((err, idx) => (
                      <li key={idx}>
                        Row {err.row}: {err.message}
                      </li>
                    ))}
                    {importSummary.errors.length > 5 && (
                      <li>...and {importSummary.errors.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          {uploadState === "success" ? (
            <Button onClick={() => handleOpenChange(false)}>Close</Button>
          ) : uploadState === "preview" ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setUploadState("selected");
                  setPreviewData(null);
                }}
              >
                Back
              </Button>
              <Button
                onClick={handleUpload}
                disabled={bulkCreateMutation.isPending}
              >
                {bulkCreateMutation.isPending ? (
                  <>
                    <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Import {previewData?.newControls ?? 0} Controls
                    {duplicateMode === "update" && previewData?.existingControls
                      ? ` (+ update ${previewData.existingControls})`
                      : ""}
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handlePreview}
                disabled={!selectedFile || uploadState === "previewing"}
              >
                {uploadState === "previewing" ? (
                  <>
                    <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Validating...
                  </>
                ) : (
                  <>
                    <Eye className="mr-2 h-4 w-4" />
                    Preview Import
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
