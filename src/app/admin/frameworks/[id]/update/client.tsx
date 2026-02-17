"use client";

/**
 * Framework Update Client Component
 *
 * Multi-step update workflow:
 * 1. Upload new OSCAL catalog file
 * 2. Preview migration impact (version comparison, control diff)
 * 3. Confirm update by typing framework name
 * 4. Apply update with progress indicator
 * 5. Redirect to reconciliation report
 *
 * @see Story 2.7: OSCAL Catalog Update Workflow (AC32-AC37)
 */

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Upload,
  FileJson,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Plus,
  Minus,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { AppLayout } from "@/components/layout";

interface FrameworkUpdateClientProps {
  frameworkId: string;
}

type UpdateStep = "upload" | "preview" | "confirm" | "updating" | "complete";

export function FrameworkUpdateClient({ frameworkId }: FrameworkUpdateClientProps) {
  const router = useRouter();
  const [step, setStep] = useState<UpdateStep>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [confirmationName, setConfirmationName] = useState("");
  const [previewData, setPreviewData] = useState<{
    detection: {
      currentVersion: string;
      newVersion: string;
    };
    summary: {
      controlsAdded: number;
      controlsRemoved: number;
      controlsModified: number;
      controlsUnchanged: number;
    };
    affectedEvidenceCount: number;
    validationErrors: string[];
  } | null>(null);

  // Fetch framework details
  const { data: framework, isLoading: isLoadingFramework } =
    api.framework.getById.useQuery({ id: frameworkId });

  // Preview mutation
  const previewMutation = api.framework.previewOSCALUpdate.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setPreviewData({
          detection: data.detection,
          summary: data.summary,
          affectedEvidenceCount: data.affectedEvidenceCount,
          validationErrors: data.validationErrors,
        });
        setStep("preview");
      } else {
        alert(`Preview failed: ${data.validationErrors.join(", ")}`);
      }
    },
    onError: (error) => {
      alert(`Preview failed: ${error.message}`);
    },
  });

  // Apply update mutation
  const updateMutation = api.framework.applyOSCALUpdate.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setStep("complete");
        // Redirect to reconciliation report after short delay
        setTimeout(() => {
          router.push(`/admin/frameworks/${frameworkId}/reconciliation`);
        }, 2000);
      }
    },
    onError: (error) => {
      alert(`Update failed: ${error.message}`);
      setStep("preview");
    },
  });

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setSelectedFile(file);

      try {
        const content = await file.text();
        setFileContent(content);
      } catch {
        alert("Failed to read file");
      }
    },
    []
  );

  const handlePreview = useCallback(() => {
    if (!fileContent) {
      alert("Please select a file");
      return;
    }

    previewMutation.mutate({
      frameworkId,
      content: fileContent,
      filename: selectedFile?.name,
    });
  }, [fileContent, frameworkId, selectedFile?.name, previewMutation]);

  const handleApplyUpdate = useCallback(() => {
    if (!framework || confirmationName !== framework.name) {
      alert("Please type the exact framework name to confirm");
      return;
    }

    setStep("updating");
    updateMutation.mutate({
      frameworkId,
      content: fileContent,
      filename: selectedFile?.name,
      confirmationName,
    });
  }, [framework, confirmationName, frameworkId, fileContent, selectedFile?.name, updateMutation]);

  const breadcrumbs = [
    { label: "Frameworks", href: "/admin/frameworks" },
    { label: framework?.name || "Loading...", href: `/admin/frameworks/${frameworkId}` },
    { label: "Update" },
  ];

  if (isLoadingFramework) {
    return (
      <AppLayout breadcrumbs={breadcrumbs}>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      </AppLayout>
    );
  }

  if (!framework) {
    return (
      <AppLayout breadcrumbs={breadcrumbs}>
        <div className="text-center py-16">
          <AlertTriangle className="mx-auto h-12 w-12 text-yellow-500" />
          <p className="mt-4 text-gray-500">Framework not found</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Update Framework</h1>
        <p className="text-gray-500 mt-1">
          <span className="font-mono">{framework.code}</span> - {framework.name} (v{framework.version})
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-4">
        {["upload", "preview", "confirm", "updating", "complete"].map((s, i) => (
          <div key={s} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === s
                  ? "bg-blue-500 text-white"
                  : ["upload", "preview", "confirm", "updating", "complete"].indexOf(step) > i
                  ? "bg-green-500 text-white"
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              {i + 1}
            </div>
            {i < 4 && <div className="w-8 h-0.5 bg-gray-200 mx-2" />}
          </div>
        ))}
      </div>

      {/* Step: Upload */}
      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload New OSCAL Catalog
            </CardTitle>
            <CardDescription>
              Select the updated OSCAL catalog file (JSON or YAML)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file">OSCAL Catalog File</Label>
              <Input
                id="file"
                type="file"
                accept=".json,.yaml,.yml"
                onChange={handleFileChange}
              />
              <p className="text-sm text-gray-500">
                The new catalog must have a higher version than {framework.version}
              </p>
            </div>

            {selectedFile && (
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <FileJson className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="font-medium">{selectedFile.name}</p>
                  <p className="text-sm text-gray-500">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button
                onClick={handlePreview}
                disabled={!selectedFile || previewMutation.isPending}
              >
                {previewMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    Preview Update
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Preview */}
      {step === "preview" && previewData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Update Preview
            </CardTitle>
            <CardDescription>
              Review the changes before applying the update
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Version Comparison */}
            <div className="flex items-center justify-center gap-8 p-4 bg-gray-50 rounded-lg">
              <div className="text-center">
                <p className="text-sm text-gray-500">Current Version</p>
                <p className="text-2xl font-bold">{previewData.detection.currentVersion}</p>
              </div>
              <ArrowRight className="h-6 w-6 text-gray-400" />
              <div className="text-center">
                <p className="text-sm text-gray-500">New Version</p>
                <p className="text-2xl font-bold text-blue-600">{previewData.detection.newVersion}</p>
              </div>
            </div>

            {/* Control Changes */}
            <div className="grid grid-cols-4 gap-4">
              <Card className="bg-green-50">
                <CardContent className="pt-4 text-center">
                  <Plus className="h-6 w-6 mx-auto text-green-600" />
                  <p className="text-2xl font-bold text-green-700 mt-2">
                    {previewData.summary.controlsAdded}
                  </p>
                  <p className="text-sm text-green-600">Controls Added</p>
                </CardContent>
              </Card>

              <Card className="bg-red-50">
                <CardContent className="pt-4 text-center">
                  <Minus className="h-6 w-6 mx-auto text-red-600" />
                  <p className="text-2xl font-bold text-red-700 mt-2">
                    {previewData.summary.controlsRemoved}
                  </p>
                  <p className="text-sm text-red-600">Controls Deprecated</p>
                </CardContent>
              </Card>

              <Card className="bg-yellow-50">
                <CardContent className="pt-4 text-center">
                  <RefreshCw className="h-6 w-6 mx-auto text-yellow-600" />
                  <p className="text-2xl font-bold text-yellow-700 mt-2">
                    {previewData.summary.controlsModified}
                  </p>
                  <p className="text-sm text-yellow-600">Controls Modified</p>
                </CardContent>
              </Card>

              <Card className="bg-gray-50">
                <CardContent className="pt-4 text-center">
                  <CheckCircle2 className="h-6 w-6 mx-auto text-gray-600" />
                  <p className="text-2xl font-bold text-gray-700 mt-2">
                    {previewData.summary.controlsUnchanged}
                  </p>
                  <p className="text-sm text-gray-600">Controls Unchanged</p>
                </CardContent>
              </Card>
            </div>

            {/* Impact Warning */}
            {previewData.affectedEvidenceCount > 0 && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-800">Evidence Impact</p>
                  <p className="text-sm text-yellow-700">
                    {previewData.affectedEvidenceCount} evidence items are linked to controls that will be deprecated.
                    These will be flagged for review after the update.
                  </p>
                </div>
              </div>
            )}

            {/* Validation Errors */}
            {previewData.validationErrors.length > 0 && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="font-medium text-red-800 mb-2">Validation Errors</p>
                <ul className="list-disc list-inside text-sm text-red-700">
                  {previewData.validationErrors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("upload")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={() => setStep("confirm")}>
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Confirm */}
      {step === "confirm" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              Confirm Update
            </CardTitle>
            <CardDescription>
              This action will update the framework and cannot be undone
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                To confirm this update, please type the framework name exactly as shown:
              </p>
              <p className="font-mono font-bold text-lg mt-2 text-yellow-900">
                {framework.name}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmation">Framework Name</Label>
              <Input
                id="confirmation"
                value={confirmationName}
                onChange={(e) => setConfirmationName(e.target.value)}
                placeholder="Type framework name to confirm"
              />
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("preview")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                variant="destructive"
                onClick={handleApplyUpdate}
                disabled={confirmationName !== framework.name || updateMutation.isPending}
              >
                Apply Update
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Updating */}
      {step === "updating" && (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto" />
            <p className="mt-4 text-lg font-medium">Applying Update...</p>
            <p className="text-gray-500">
              Please wait while the framework is being updated
            </p>
          </CardContent>
        </Card>
      )}

      {/* Step: Complete */}
      {step === "complete" && (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
            <p className="mt-4 text-lg font-medium text-green-700">Update Complete!</p>
            <p className="text-gray-500">
              Redirecting to reconciliation report...
            </p>
          </CardContent>
        </Card>
      )}
      </div>
    </AppLayout>
  );
}
