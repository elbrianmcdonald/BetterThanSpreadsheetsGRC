"use client";

/**
 * Version History Display Component
 *
 * Displays version history for an evidence record including:
 * - All versions with version number, filename, uploader, date, size
 * - Change reason for each version
 * - Download button for each version
 * - Current version highlighted
 *
 * @see Story 3.5: AC18-AC21 - Version history UI
 */

import { useState } from "react";
import { api } from "@/trpc/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  GitBranch,
  Download,
  Loader2,
  AlertCircle,
  FileText,
  Clock,
} from "lucide-react";
import { formatFileSize } from "@/utils/file-validation";
import { cn } from "@/lib/utils";

interface VersionHistoryProps {
  /** Evidence ID to show version history for */
  evidenceId: string;
  /** Whether the component is in a dialog/modal (uses different layout) */
  inDialog?: boolean;
}

/**
 * Format date for display
 */
function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function VersionHistory({ evidenceId, inDialog = false }: VersionHistoryProps) {
  const [downloadingVersionId, setDownloadingVersionId] = useState<string | null>(null);

  const {
    data: versionHistory,
    isLoading,
    isError,
    error,
  } = api.evidence.getVersionHistory.useQuery(
    { evidenceId },
    {
      staleTime: 30 * 1000, // 30 seconds
    }
  );

  /**
   * Handle version download
   */
  const handleDownload = async (versionId: string, filename: string, isCurrent: boolean) => {
    setDownloadingVersionId(versionId);
    try {
      // Use appropriate download endpoint based on whether it's current or previous version
      const url = isCurrent
        ? `/api/evidence/${evidenceId}/download`
        : `/api/evidence/version/${versionId}/download`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Download failed");
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error("Download failed:", err);
    } finally {
      setDownloadingVersionId(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-purple-500" />
            Version History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading version history...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-purple-500" />
            Version History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-red-600">
            <AlertCircle className="h-5 w-5 mr-2" />
            {error?.message || "Failed to load version history"}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!versionHistory) {
    return null;
  }

  // Combine current version with previous versions for display
  const allVersions = [
    versionHistory.currentVersion,
    ...versionHistory.versions,
  ];

  return (
    <Card className={cn(inDialog && "border-0 shadow-none")}>
      <CardHeader className={cn("pb-3", inDialog && "px-0")}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-purple-500" />
            Version History
          </CardTitle>
          <Badge variant="outline" className="text-purple-600">
            {versionHistory.totalVersions} version{versionHistory.totalVersions !== 1 ? "s" : ""}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className={cn(inDialog && "px-0")}>
        {allVersions.length === 1 ? (
          <div className="text-center py-6 text-gray-500">
            <Clock className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p>No previous versions</p>
            <p className="text-sm">This is the original version of the evidence.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Version</TableHead>
                  <TableHead>Filename</TableHead>
                  <TableHead>Uploaded By</TableHead>
                  <TableHead>Uploaded At</TableHead>
                  <TableHead className="text-right">Size</TableHead>
                  <TableHead>Change Reason</TableHead>
                  <TableHead className="w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allVersions.map((version) => (
                  <TableRow
                    key={version.id}
                    className={cn(
                      version.isCurrent && "bg-purple-50 hover:bg-purple-100"
                    )}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium">
                          v{version.versionNumber}
                        </span>
                        {version.isCurrent && (
                          <Badge
                            variant="secondary"
                            className="bg-purple-100 text-purple-700 text-xs"
                          >
                            Current
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-400" />
                        <span className="truncate max-w-[200px]" title={version.filename}>
                          {version.filename}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {version.uploader?.name || version.uploader?.email || "Unknown"}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {formatDate(version.uploadedAt)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatFileSize(version.fileSize)}
                    </TableCell>
                    <TableCell>
                      <span
                        className="text-sm text-gray-600 truncate max-w-[200px] block"
                        title={version.changeReason}
                      >
                        {version.changeReason}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleDownload(version.id, version.filename, version.isCurrent)
                        }
                        disabled={downloadingVersionId === version.id}
                      >
                        {downloadingVersionId === version.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Download className="h-4 w-4 mr-1" />
                            Download
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
