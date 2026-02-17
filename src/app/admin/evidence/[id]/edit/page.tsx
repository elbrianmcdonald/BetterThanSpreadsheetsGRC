"use client";

/**
 * Evidence Edit Page
 *
 * Allows users to:
 * - Update evidence description and control domain tags
 * - Replace the evidence file with a new version
 * - Enter a change reason when replacing the file
 *
 * @see Story 3.5: AC22-AC26 - Evidence update workflow
 */

import { useState, useCallback, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Save,
  Loader2,
  FileText,
  Upload,
  X,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { ControlDomainSelector } from "@/components/evidence/ControlDomainSelector";
import { EvidenceMetadata } from "@/components/evidence/EvidenceMetadata";
import { VersionHistory } from "@/components/evidence/VersionHistory";
import { AuditTrail } from "@/components/evidence/AuditTrail";
import { formatFileSize, validateFile } from "@/utils/file-validation";
import { toast } from "sonner";
import { useUserPermissions } from "@/hooks/useUserPermissions";

export default function EvidenceEditPage() {
  const params = useParams();
  const router = useRouter();
  const evidenceId = params.id as string;

  // Story 3.8: Check permissions - redirect auditors (AC6)
  const { canEditEvidence, isAuthenticated } = useUserPermissions();

  // Redirect unauthorized users
  useEffect(() => {
    if (isAuthenticated && !canEditEvidence) {
      toast.error("You don't have permission to edit evidence");
      router.push("/admin/evidence");
    }
  }, [isAuthenticated, canEditEvidence, router]);

  // Form state
  const [description, setDescription] = useState("");
  const [selectedDomainIds, setSelectedDomainIds] = useState<string[]>([]);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [changeReason, setChangeReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Fetch evidence data
  const {
    data: evidence,
    isLoading,
    isError,
    error,
    refetch,
  } = api.evidence.getById.useQuery(
    { id: evidenceId },
    {
      enabled: !!evidenceId,
    }
  );

  // Initialize form when data loads
  useEffect(() => {
    if (evidence && !initialized) {
      setDescription(evidence.description || "");
      const domains = evidence.EvidenceControlDomain || [];
      setSelectedDomainIds(
        domains.map((ecd) => ecd.ControlDomain.id)
      );
      setInitialized(true);
    }
  }, [evidence, initialized]);

  // Mutations
  const updateMutation = api.evidence.update.useMutation({
    onSuccess: () => {
      toast.success("Evidence description updated");
    },
    onError: (err) => {
      toast.error(`Failed to update: ${err.message}`);
    },
  });

  const updateTagsMutation = api.evidence.updateTags.useMutation({
    onSuccess: () => {
      toast.success("Control domains updated");
    },
    onError: (err) => {
      toast.error(`Failed to update tags: ${err.message}`);
    },
  });

  const replaceFileMutation = api.evidence.replaceFile.useMutation({
    onSuccess: () => {
      toast.success("Evidence file replaced successfully");
      setNewFile(null);
      setChangeReason("");
      refetch();
    },
    onError: (err) => {
      toast.error(`Failed to replace file: ${err.message}`);
    },
  });

  // Handle file selection
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validation = validateFile(file.name, file.size, file.type);
      if (!validation.valid) {
        toast.error(validation.errors.map((e) => e.message).join("; "));
        e.target.value = "";
        return;
      }
      setNewFile(file);
      setHasChanges(true);
    }
  }, []);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evidence) return;

    setIsSubmitting(true);

    try {
      // Check if description changed
      const descriptionChanged = description !== (evidence.description || "");

      // Check if tags changed
      const originalDomainIds = evidence.EvidenceControlDomain?.map(
        (ecd) => ecd.ControlDomain.id
      ) || [];
      const tagsChanged =
        selectedDomainIds.length !== originalDomainIds.length ||
        !selectedDomainIds.every((id: string) => originalDomainIds.includes(id));

      // Update description if changed
      if (descriptionChanged) {
        await updateMutation.mutateAsync({
          id: evidenceId,
          description,
        });
      }

      // Update tags if changed (AC26: Tag updates logged to audit trail, does not create version)
      if (tagsChanged) {
        await updateTagsMutation.mutateAsync({
          id: evidenceId,
          controlDomainIds: selectedDomainIds,
        });
      }

      // Replace file if new file selected (AC23-AC25)
      if (newFile) {
        if (changeReason.length < 10) {
          toast.error("Change reason must be at least 10 characters");
          setIsSubmitting(false);
          return;
        }

        // Read file as base64
        const fileContent = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            // Remove data URL prefix
            const base64 = result.split(",")[1];
            resolve(base64 || "");
          };
          reader.onerror = reject;
          reader.readAsDataURL(newFile);
        });

        await replaceFileMutation.mutateAsync({
          evidenceId,
          fileContent,
          fileName: newFile.name,
          mimeType: newFile.type,
          changeReason,
        });
      }

      // Redirect to evidence list on success
      router.push("/admin/evidence");
    } catch {
      // Errors are handled by mutation callbacks
    } finally {
      setIsSubmitting(false);
    }
  };

  // Breadcrumbs for layout
  const breadcrumbs = [
    { label: "Compliance" },
    { label: "Evidence", href: "/admin/evidence" },
    { label: evidence?.title || "Loading...", href: evidence ? `/admin/evidence/${evidenceId}` : undefined },
    { label: "Edit" },
  ];

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

  if (isError || !evidence) {
    return (
      <AppLayout breadcrumbs={breadcrumbs}>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-3 py-6">
            <AlertCircle className="h-6 w-6 text-red-600" />
            <div>
              <p className="font-medium text-red-800">Failed to load evidence</p>
              <p className="text-sm text-red-600">{error?.message}</p>
            </div>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <div className="space-y-6">
      {/* Header */}
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
            <h1 className="text-2xl font-bold">Edit Evidence</h1>
            <p className="text-gray-500">{evidence.title}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Edit Form */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSubmit}>
            {/* Description Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Evidence Details</CardTitle>
                <CardDescription>
                  Update the description and control domain tags
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      setHasChanges(true);
                    }}
                    placeholder="Enter a description for this evidence..."
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Control Domains</Label>
                  <ControlDomainSelector
                    value={selectedDomainIds}
                    onChange={(ids) => {
                      setSelectedDomainIds(ids);
                      setHasChanges(true);
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* File Replacement Section */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Replace File (Optional)
                </CardTitle>
                <CardDescription>
                  Upload a new version of the evidence file. This will create a new version
                  and preserve the previous file in version history.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Current File Info */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-blue-500" />
                    <div>
                      <p className="font-medium">{evidence.originalFileName}</p>
                      <p className="text-sm text-gray-500">
                        {formatFileSize(evidence.fileSize)} • Version {evidence.currentVersion || 1}
                      </p>
                    </div>
                  </div>
                </div>

                {/* File Upload */}
                <div className="space-y-2">
                  <Label htmlFor="newFile">New File</Label>
                  <Input
                    id="newFile"
                    type="file"
                    onChange={handleFileChange}
                    className="cursor-pointer"
                  />
                  {newFile && (
                    <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <div>
                          <p className="font-medium text-green-800">{newFile.name}</p>
                          <p className="text-sm text-green-600">
                            {formatFileSize(newFile.size)}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setNewFile(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Change Reason (required when file is selected) */}
                {newFile && (
                  <div className="space-y-2">
                    <Label htmlFor="changeReason">
                      Change Reason <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      id="changeReason"
                      value={changeReason}
                      onChange={(e) => setChangeReason(e.target.value)}
                      placeholder="Explain why you're replacing this file (minimum 10 characters)..."
                      rows={3}
                      required
                      minLength={10}
                    />
                    <p className="text-xs text-gray-500">
                      {changeReason.length}/10 minimum characters
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Submit Button */}
            <div className="flex justify-end gap-3 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/admin/evidence")}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || (!hasChanges && !newFile)}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>

        {/* Right Column: Metadata, Version History & Audit Trail */}
        <div className="space-y-6">
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
          />

          <VersionHistory evidenceId={evidenceId} />

          {/* Story 3.9: Audit Trail - AC14-AC19 */}
          <AuditTrail evidenceId={evidenceId} />
        </div>
      </div>
      </div>
    </AppLayout>
  );
}
