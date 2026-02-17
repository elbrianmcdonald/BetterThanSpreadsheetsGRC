"use client";

/**
 * Evidence Metadata Display Component
 *
 * Displays complete evidence metadata including:
 * - File information (name, size, type)
 * - Upload information (uploader, timestamp)
 * - Description
 * - Control domain tags
 * - Version information
 *
 * @see Story 3.5: AC13-AC17 - Metadata display UI
 */

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FileText,
  User,
  Calendar,
  FileType,
  HardDrive,
  Tag,
  GitBranch,
  FolderOpen,
} from "lucide-react";
import { formatFileSize } from "@/utils/file-validation";

interface ControlDomainTag {
  id: string;
  code: string;
  name: string;
}

interface EvidenceMetadataProps {
  /** Evidence title */
  title: string;
  /** Original file name */
  originalFileName: string;
  /** File size in bytes */
  fileSize: number;
  /** MIME type */
  fileType: string;
  /** Optional description */
  description?: string | null;
  /** Uploader information */
  uploader?: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  /** Upload timestamp */
  createdAt: Date | string;
  /** Current version number */
  currentVersion?: number;
  /** Control domain tags */
  controlDomains?: {
    ControlDomain: ControlDomainTag;
  }[];
  /** Total framework controls satisfied */
  frameworkControlCount?: number;
  /** Whether to show in compact mode */
  compact?: boolean;
  /** Whether to show storage path (for admin troubleshooting) - Story 3.11 AC10 */
  showStoragePath?: boolean;
  /** Storage path */
  storagePath?: string;
  /** Whether to hide the card wrapper (for use in accordions) */
  noCard?: boolean;
}

/**
 * Format date for display
 */
function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Get domain badge color based on domain code
 */
function getDomainColor(code: string): string {
  const colors: Record<string, string> = {
    ACCESS_CONTROL: "bg-blue-100 text-blue-700",
    AUTHENTICATION: "bg-purple-100 text-purple-700",
    DATA_PROTECTION: "bg-green-100 text-green-700",
    ENCRYPTION: "bg-yellow-100 text-yellow-700",
    NETWORK_SECURITY: "bg-orange-100 text-orange-700",
    LOGGING_MONITORING: "bg-cyan-100 text-cyan-700",
    INCIDENT_RESPONSE: "bg-red-100 text-red-700",
    BUSINESS_CONTINUITY: "bg-indigo-100 text-indigo-700",
    PHYSICAL_SECURITY: "bg-pink-100 text-pink-700",
    THIRD_PARTY_RISK: "bg-amber-100 text-amber-700",
    SECURITY_AWARENESS: "bg-teal-100 text-teal-700",
    CHANGE_MANAGEMENT: "bg-gray-100 text-gray-700",
  };
  return colors[code] || "bg-gray-100 text-gray-700";
}

export function EvidenceMetadata({
  title,
  originalFileName,
  fileSize,
  fileType,
  description,
  uploader,
  createdAt,
  currentVersion = 1,
  controlDomains = [],
  frameworkControlCount,
  compact = false,
  showStoragePath = false,
  storagePath,
  noCard = false,
}: EvidenceMetadataProps) {
  if (compact) {
    return (
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-gray-600">
          <FileText className="h-4 w-4" />
          <span className="font-medium">{originalFileName}</span>
          <span className="text-gray-400">({formatFileSize(fileSize)})</span>
        </div>
        {uploader && (
          <div className="flex items-center gap-2 text-gray-500">
            <User className="h-4 w-4" />
            <span>{uploader.name || uploader.email}</span>
            <span className="text-gray-400">• {formatDate(createdAt)}</span>
          </div>
        )}
      </div>
    );
  }

  const content = (
    <div className="space-y-4">
      {/* File Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">
                File Name
              </p>
              <p className="font-medium break-all">{originalFileName}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <HardDrive className="h-5 w-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">
                File Size
              </p>
              <p className="font-medium">{formatFileSize(fileSize)}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <FileType className="h-5 w-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">
                File Type
              </p>
              <p className="font-medium">{fileType}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <User className="h-5 w-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">
                Uploaded By
              </p>
              <p className="font-medium">
                {uploader?.name || uploader?.email || "Unknown"}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">
                Uploaded At
              </p>
              <p className="font-medium">{formatDate(createdAt)}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <GitBranch className="h-5 w-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">
                Version
              </p>
              <p className="font-medium">Version {currentVersion}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Storage Path (AC10 - Admin troubleshooting) */}
      {showStoragePath && storagePath && (
        <div className="pt-3 border-t">
          <div className="flex items-start gap-3">
            <FolderOpen className="h-5 w-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">
                Storage Path
              </p>
              <p className="font-medium text-xs font-mono break-all text-gray-600">
                {storagePath}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Description */}
      {description && (
        <div className="pt-3 border-t">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">
            Description
          </p>
          <p className="text-gray-700 whitespace-pre-wrap">{description}</p>
        </div>
      )}

      {/* Control Domain Tags */}
      {controlDomains.length > 0 && (
        <div className="pt-3 border-t">
          <div className="flex items-center gap-2 mb-2">
            <Tag className="h-4 w-4 text-gray-400" />
            <p className="text-xs text-gray-500 uppercase tracking-wide">
              Control Domains ({controlDomains.length})
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {controlDomains.map(({ ControlDomain }) => (
              <Badge
                key={ControlDomain.id}
                variant="secondary"
                className={getDomainColor(ControlDomain.code)}
              >
                {ControlDomain.name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Framework Controls Count */}
      {frameworkControlCount !== undefined && frameworkControlCount > 0 && (
        <div className="pt-3 border-t">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg">
            <span className="font-semibold">{frameworkControlCount}</span>
            <span className="text-sm">
              framework control{frameworkControlCount !== 1 ? "s" : ""} satisfied
            </span>
          </div>
        </div>
      )}
    </div>
  );

  // Return without Card wrapper when used in accordion
  if (noCard) {
    return content;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-500" />
          Evidence Details
        </CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
