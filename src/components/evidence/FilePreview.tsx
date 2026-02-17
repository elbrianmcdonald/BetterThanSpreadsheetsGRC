"use client";

/**
 * File Preview Component
 *
 * Displays a preview of evidence files based on their MIME type:
 * - Images: Rendered as img element with zoom capability
 * - PDFs: Rendered in iframe (browser native PDF viewer)
 * - Other files: Display file icon with filename
 *
 * @see Story 3.11: Evidence Detail Page with Framework Mappings
 */

import { useState } from "react";
import {
  File,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  Maximize2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface FilePreviewProps {
  /** Evidence ID for download URL */
  evidenceId: string;
  /** Original filename */
  fileName: string;
  /** MIME type of the file */
  mimeType: string;
  /** File size in bytes */
  fileSize: number;
  /** Optional CSS class */
  className?: string;
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Get file icon based on MIME type
 */
function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) {
    return <ImageIcon className="h-16 w-16 text-green-500" />;
  }
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) {
    return <FileSpreadsheet className="h-16 w-16 text-emerald-500" />;
  }
  if (mimeType.includes("pdf") || mimeType.includes("word")) {
    return <FileText className="h-16 w-16 text-red-500" />;
  }
  return <File className="h-16 w-16 text-gray-500" />;
}

/**
 * Check if file type is previewable
 */
function isPreviewable(mimeType: string): boolean {
  return mimeType.startsWith("image/") || mimeType === "application/pdf";
}

export function FilePreview({
  evidenceId,
  fileName,
  mimeType,
  fileSize,
  className,
}: FilePreviewProps) {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const downloadUrl = `/api/evidence/${evidenceId}/download`;

  const isImage = mimeType.startsWith("image/");
  const isPdf = mimeType === "application/pdf";
  const canPreview = isPreviewable(mimeType);

  return (
    <div className={cn("rounded-lg border bg-gray-50", className)}>
      {/* Preview Area */}
      <div className="relative flex items-center justify-center min-h-[200px] p-4">
        {isImage ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={downloadUrl}
              alt={fileName}
              className="max-h-[300px] max-w-full object-contain rounded"
            />
            <Button
              variant="secondary"
              size="icon"
              className="absolute top-2 right-2"
              onClick={() => setIsFullScreen(true)}
              title="View full size"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </>
        ) : isPdf ? (
          <div className="w-full">
            <iframe
              src={downloadUrl}
              title={fileName}
              className="w-full h-[400px] rounded border"
            />
            <Button
              variant="secondary"
              size="sm"
              className="absolute top-2 right-2"
              onClick={() => window.open(downloadUrl, "_blank")}
              title="Open in new tab"
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              Full View
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 py-8">
            {getFileIcon(mimeType)}
            <div className="text-center">
              <p className="font-medium text-gray-900">{fileName}</p>
              <p className="text-sm text-gray-500">{formatFileSize(fileSize)}</p>
              <p className="text-xs text-gray-400 mt-1">{mimeType}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(downloadUrl, "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Download to View
            </Button>
          </div>
        )}
      </div>

      {/* File Info Bar */}
      {canPreview && (
        <div className="flex items-center justify-between px-4 py-2 border-t bg-white rounded-b-lg">
          <div className="text-sm text-gray-500">
            {fileName} • {formatFileSize(fileSize)}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open(downloadUrl, "_blank")}
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            Open in New Tab
          </Button>
        </div>
      )}

      {/* Full Screen Dialog for Images */}
      {isImage && (
        <Dialog open={isFullScreen} onOpenChange={setIsFullScreen}>
          <DialogContent className="max-w-[90vw] max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>{fileName}</DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-center overflow-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={downloadUrl}
                alt={fileName}
                className="max-w-full max-h-[80vh] object-contain"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
