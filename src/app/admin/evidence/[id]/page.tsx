"use client";

/**
 * Evidence Detail Page
 *
 * Comprehensive view of evidence including:
 * - File preview (images/PDFs) or file icon
 * - Metadata section with download/edit actions
 * - Framework mappings showing all satisfied controls
 * - Linked risks with severity and link type
 * - Version history with download per version
 * - Audit trail showing all operations
 *
 * All sections are collapsible/expandable for user preference.
 *
 * @see Story 3.11: Evidence Detail Page with Framework Mappings
 */

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Download,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FilePreview } from "@/components/evidence/FilePreview";
import { EvidenceMetadata } from "@/components/evidence/EvidenceMetadata";
import { FrameworkMappingPreview } from "@/components/evidence/FrameworkMappingPreview";
import { LinkedRisksSection } from "@/components/evidence/LinkedRisksSection";
import { VersionHistory } from "@/components/evidence/VersionHistory";
import { AuditTrail } from "@/components/evidence/AuditTrail";
import { ControlDetailModal } from "@/components/evidence/ControlDetailModal";
import { useUserPermissions } from "@/hooks/useUserPermissions";

export default function EvidenceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const evidenceId = params.id as string;

  // Permissions for action buttons (AC34)
  const { canEditEvidence, canDeleteEvidence } = useUserPermissions();

  // Delete confirmation dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Control detail modal state (AC16)
  const [selectedControl, setSelectedControl] = useState<{
    controlId: string;
    title: string;
    description: string;
    guidance?: string | null;
    confidence?: number;
  } | null>(null);

  // Default open sections (AC4)
  const [openSections, setOpenSections] = useState<string[]>([
    "metadata",
    "framework-mappings",
    "linked-risks",
  ]);

  // Fetch evidence data
  const {
    data: evidence,
    isLoading,
    isError,
    error,
  } = api.evidence.getById.useQuery(
    { id: evidenceId },
    { enabled: !!evidenceId }
  );

  // Delete mutation
  const utils = api.useUtils();
  const deleteMutation = api.evidence.delete.useMutation({
    onSuccess: () => {
      toast.success("Evidence deleted successfully");
      router.push("/admin/evidence");
    },
    onError: (err) => {
      toast.error(`Failed to delete evidence: ${err.message}`);
    },
  });

  // Handle delete (AC33)
  const handleDelete = () => {
    if (evidenceId) {
      deleteMutation.mutate({ id: evidenceId });
    }
  };

  // Handle download (AC11, AC35)
  const handleDownload = () => {
    window.open(`/api/evidence/${evidenceId}/download`, "_blank");
  };

  // Breadcrumbs for layout
  const breadcrumbs = [
    { label: "Compliance" },
    { label: "Evidence", href: "/admin/evidence" },
    { label: evidence?.originalFileName || "Loading..." },
  ];

  // Loading state
  if (isLoading) {
    return (
      <AppLayout breadcrumbs={breadcrumbs}>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Loading evidence...</span>
        </div>
      </AppLayout>
    );
  }

  // Error state
  if (isError || !evidence) {
    return (
      <AppLayout breadcrumbs={breadcrumbs}>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-3 py-6">
            <AlertCircle className="h-6 w-6 text-red-600" />
            <div>
              <p className="font-medium text-red-800">Evidence not found</p>
              <p className="text-sm text-red-600">
                {error?.message || "The requested evidence could not be found."}
              </p>
            </div>
            <Button
              variant="outline"
              className="ml-auto"
              onClick={() => router.push("/admin/evidence")}
            >
              Back to Evidence
            </Button>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <div className="space-y-6">
      {/* Action Bar (AC32-AC35) */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/admin/evidence")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{evidence.title}</h1>
            <p className="text-gray-500">{evidence.originalFileName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Download (AC11, AC35) */}
          <Button variant="outline" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          {/* Edit (AC12, AC34) */}
          {canEditEvidence && (
            <Button
              variant="outline"
              onClick={() => router.push(`/admin/evidence/${evidenceId}/edit`)}
            >
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
          {/* Delete (AC33, AC34) */}
          {canDeleteEvidence && (
            <Button
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: File Preview */}
        <div className="lg:col-span-1">
          <FilePreview
            evidenceId={evidenceId}
            fileName={evidence.originalFileName}
            mimeType={evidence.fileType}
            fileSize={evidence.fileSize}
          />
        </div>

        {/* Right Column: All Sections */}
        <div className="lg:col-span-2">
          <Accordion
            type="multiple"
            value={openSections}
            onValueChange={setOpenSections}
            className="space-y-4"
          >
            {/* Metadata Section (AC6-AC12) */}
            <AccordionItem value="metadata" className="border rounded-lg">
              <AccordionTrigger className="px-4 hover:no-underline">
                <span className="text-lg font-semibold">Evidence Details</span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <EvidenceMetadata
                  title={evidence.title}
                  originalFileName={evidence.originalFileName}
                  fileSize={evidence.fileSize}
                  fileType={evidence.fileType}
                  description={evidence.description}
                  uploader={evidence.User}
                  createdAt={evidence.createdAt}
                  currentVersion={evidence.currentVersion || 1}
                  controlDomains={evidence.EvidenceControlDomain}
                  showStoragePath
                  storagePath={evidence.filePath}
                  noCard
                />
              </AccordionContent>
            </AccordionItem>

            {/* Framework Mappings Section (AC13-AC17) */}
            <AccordionItem value="framework-mappings" className="border rounded-lg">
              <AccordionTrigger className="px-4 hover:no-underline">
                <span className="text-lg font-semibold">
                  Framework Controls Satisfied
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <FrameworkMappingPreview
                  controlDomainIds={evidence.EvidenceControlDomain.map(
                    (cd) => cd.controlDomainId
                  )}
                  onControlClick={(control) => setSelectedControl(control)}
                />
              </AccordionContent>
            </AccordionItem>

            {/* Linked Risks Section (AC18-AC22) */}
            <AccordionItem value="linked-risks" className="border rounded-lg">
              <AccordionTrigger className="px-4 hover:no-underline">
                <span className="text-lg font-semibold">Linked Risks</span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <LinkedRisksSection evidenceId={evidenceId} />
              </AccordionContent>
            </AccordionItem>

            {/* Version History Section (AC23-AC27) */}
            <AccordionItem value="version-history" className="border rounded-lg">
              <AccordionTrigger className="px-4 hover:no-underline">
                <span className="text-lg font-semibold">Version History</span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <VersionHistory evidenceId={evidenceId} />
              </AccordionContent>
            </AccordionItem>

            {/* Audit Trail Section (AC28-AC31) */}
            <AccordionItem value="audit-trail" className="border rounded-lg">
              <AccordionTrigger className="px-4 hover:no-underline">
                <span className="text-lg font-semibold">Audit Trail</span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <AuditTrail evidenceId={evidenceId} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>

      {/* Delete Confirmation Dialog (AC33) */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Evidence</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{evidence.title}&quot;? This
              action will archive the file and it will no longer be available
              for compliance tracking.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Control Detail Modal (AC16) */}
      <ControlDetailModal
        open={!!selectedControl}
        onClose={() => setSelectedControl(null)}
        control={selectedControl}
      />
      </div>
    </AppLayout>
  );
}
