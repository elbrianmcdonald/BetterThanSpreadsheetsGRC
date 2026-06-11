"use client";

/**
 * Evidence Management Client Component
 *
 * Client-side component for evidence listing and upload.
 *
 * @see Story 3.1: Evidence File Upload and Processing
 * @see Story 3.10: Evidence Repository Page with TanStack Table
 */

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  File,
  Plus,
  FileText,
  Image,
  FileSpreadsheet,
  Eye,
  Pencil,
  Download,
} from "lucide-react";

import { AppLayout, PageHeader, StatTile } from "@/components/layout";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EvidenceUpload } from "@/components/evidence/EvidenceUpload";
import { EvidenceTable } from "@/components/evidence/EvidenceTable";
import { ControlDomainBadgeList } from "@/components/evidence/ControlDomainBadge";
import { FrameworkMappingPreview } from "@/components/evidence/FrameworkMappingPreview";
import { ControlDetailModal } from "@/components/evidence/ControlDetailModal";
import { AuditTrail } from "@/components/evidence/AuditTrail";
import { formatFileSize } from "@/utils/file-validation";
import { useUserPermissions } from "@/hooks/useUserPermissions";

export function EvidenceManagementClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Dialog state
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);

  // Story 3.8: Role-based permissions for UI element visibility
  const { canUploadEvidence, canEditEvidence, isAuditor } = useUserPermissions();

  // Story 3.4: Control detail modal state
  const [selectedControl, setSelectedControl] = useState<{
    controlId: string;
    title: string;
    description: string;
    guidance?: string | null;
    confidence?: number;
  } | null>(null);
  const [selectedFramework, setSelectedFramework] = useState<{
    name: string;
    code: string;
    version?: string;
  } | undefined>(undefined);

  // Story 3.3: Control domain filter from URL query param
  const controlDomainId = searchParams.get("domain") ?? undefined;

  // Fetch statistics
  const { data: stats } = api.evidence.getStatistics.useQuery();

  // Story 3.4: Fetch selected evidence details for detail dialog
  const { data: selectedEvidence } = api.evidence.getById.useQuery(
    { id: selectedEvidenceId! },
    { enabled: !!selectedEvidenceId && showDetailDialog }
  );

  // Handle domain filter click from table
  const handleDomainFilterClick = (domainId: string) => {
    router.push(`/admin/evidence?domain=${domainId}`);
  };

  // Handle view details from table
  const handleViewDetails = (evidenceId: string) => {
    setSelectedEvidenceId(evidenceId);
    setShowDetailDialog(true);
  };

  // Get file icon based on MIME type
  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) {
      return <Image className="h-4 w-4 text-success" />;
    }
    if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) {
      return <FileSpreadsheet className="h-4 w-4 text-success" />;
    }
    if (mimeType.includes("pdf") || mimeType.includes("word")) {
      return <FileText className="h-4 w-4 text-destructive" />;
    }
    return <File className="h-4 w-4 text-muted-foreground/70" />;
  };

  // Format date
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <AppLayout breadcrumbs={[{ label: "Compliance" }, { label: "Evidence" }]}>
      <div className="mt-8 space-y-6">
        <PageHeader
          eyebrow="COMPLIANCE"
          title="Evidence Library"
          icon={<File />}
          description="Upload, tag, and map compliance evidence to control domains and frameworks."
          actions={
            canUploadEvidence ? (
              <Button onClick={() => setShowUploadDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Upload Evidence
              </Button>
            ) : undefined
          }
        />

        {/* Story 3.8: Auditor role indicator banner */}
        {isAuditor && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20 text-primary">
          <Eye className="h-5 w-5" />
          <span className="font-medium">Auditor View</span>
          <span className="text-sm text-muted-foreground">You have read-only access to evidence assigned to your frameworks</span>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatTile
          label="TOTAL EVIDENCE"
          value={stats?.total ?? 0}
          sub={`${stats?.active ?? 0} active, ${stats?.inactive ?? 0} archived`}
          icon={<File />}
          accent
        />
        <StatTile
          label="STORAGE USED"
          value={stats?.totalStorageFormatted ?? "0 Bytes"}
          sub="Across all evidence files"
          icon={<FileText />}
        />
        <StatTile
          label="FILE TYPES"
          value={stats?.byFileType?.length ?? 0}
          sub="Different formats uploaded"
          icon={<Image />}
        />
        <StatTile
          label="ACTIVE FILES"
          value={stats?.active ?? 0}
          sub="Available for compliance"
          icon={<FileSpreadsheet />}
        />
      </div>

      {/* Story 3.10: Evidence Table with TanStack Table */}
      <Card>
        <CardContent className="pt-6">
          <EvidenceTable
            onViewDetails={handleViewDetails}
            onDomainFilterClick={handleDomainFilterClick}
            activeDomainId={controlDomainId}
          />
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload Evidence</DialogTitle>
            <DialogDescription>
              Upload compliance evidence files. Supported formats: PDF, PNG, JPG,
              XLSX, DOCX, TXT. Maximum file size: 50MB.
            </DialogDescription>
          </DialogHeader>
          <EvidenceUpload
            onUploadComplete={() => {
              setShowUploadDialog(false);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Story 3.4: Evidence Detail Dialog with Framework Mapping */}
      <Dialog
        open={showDetailDialog}
        onOpenChange={(open) => {
          setShowDetailDialog(open);
          if (!open) {
            setSelectedEvidenceId(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedEvidence && getFileIcon(selectedEvidence.fileType)}
              {selectedEvidence?.title ?? "Evidence Details"}
            </DialogTitle>
            <DialogDescription>
              {selectedEvidence?.originalFileName}
            </DialogDescription>
          </DialogHeader>

          {selectedEvidence && (
            <div className="space-y-6">
              {/* Story 3.8: Action buttons - Download for all, Edit only for permitted roles */}
              <div className="flex gap-2 border-b pb-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    window.open(`/api/evidence/${selectedEvidence.id}/download`, "_blank");
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download File
                </Button>
                {canEditEvidence && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowDetailDialog(false);
                      router.push(`/admin/evidence/${selectedEvidence.id}/edit`);
                    }}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                )}
              </div>

              {/* Evidence Metadata */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">File Size:</span>
                  <span className="ml-2 font-medium tnum">
                    {formatFileSize(selectedEvidence.fileSize)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Uploaded:</span>
                  <span className="ml-2 font-mono text-muted-foreground">
                    {formatDate(selectedEvidence.createdAt)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Uploaded By:</span>
                  <span className="ml-2 font-medium">
                    {selectedEvidence.User?.name ??
                      selectedEvidence.User?.email ??
                      "Unknown"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">File Type:</span>
                  <span className="ml-2 font-mono text-muted-foreground">
                    {selectedEvidence.fileType}
                  </span>
                </div>
              </div>

              {/* Description */}
              {selectedEvidence.description && (
                <div>
                  <h4 className="text-sm font-medium text-secondary-foreground mb-2">
                    Description
                  </h4>
                  <p className="text-sm text-muted-foreground bg-secondary rounded p-3">
                    {selectedEvidence.description}
                  </p>
                </div>
              )}

              {/* Control Domain Tags */}
              <div>
                <h4 className="text-sm font-medium text-secondary-foreground mb-2">
                  Control Domain Tags
                </h4>
                <ControlDomainBadgeList
                  domains={selectedEvidence.EvidenceControlDomain}
                  maxDisplay={10}
                />
              </div>

              {/* Framework Mapping Preview - AC13-AC17 */}
              <div className="border-t pt-4">
                <FrameworkMappingPreview
                  controlDomainIds={selectedEvidence.EvidenceControlDomain.map(
                    (cd) => cd.controlDomainId
                  )}
                  onControlClick={(control) => {
                    setSelectedControl(control);
                  }}
                />
              </div>

              {/* Story 3.9: Audit Trail - AC14-AC19 */}
              <div className="border-t pt-4">
                <AuditTrail evidenceId={selectedEvidence.id} inDialog />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

        {/* Story 3.4: Control Detail Modal - AC15-AC16 */}
        <ControlDetailModal
          open={!!selectedControl}
          onClose={() => {
            setSelectedControl(null);
            setSelectedFramework(undefined);
          }}
          control={selectedControl}
          framework={selectedFramework}
        />
      </div>
    </AppLayout>
  );
}
