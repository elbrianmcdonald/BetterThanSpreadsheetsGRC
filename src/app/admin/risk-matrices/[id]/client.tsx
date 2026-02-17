"use client";

/**
 * Matrix Builder Client Component
 *
 * Story 7.8.5: Matrix Builder UI - Scales
 * Story 7.8.6: Matrix Builder UI - Thresholds
 * Story 7.8.7: Matrix Version Publishing
 * Story 11.2: Risk Matrix Create/Edit Form (gridSize display)
 *
 * Features (AC1-AC23 from 7.8.5, AC1-AC25 from 7.8.6, AC1-AC20 from 7.8.7, AC16-AC18 from 11.2):
 * - AC2: Shows template name, dimension count, output scale in header
 * - AC3: Tabs for Scales, Thresholds, Preview
 * - AC4: Version selector dropdown (draft editable, published read-only)
 * - AC5: "Create New Version" button
 * - AC6-AC12: Scale Editor with add/remove levels, inline editing
 * - AC13-AC17: Real-time validation feedback
 * - AC18-AC20: Auto-save with debouncing
 * - AC21-AC23: Common scale templates
 * - 7.8.6 AC1-AC7: Threshold Editor with add/remove/color picker
 * - 7.8.6 AC8-AC14: Draggable boundaries with validation
 * - 7.8.6 AC15-AC22: Visual threshold bar with templates
 * - 7.8.6 AC23-AC25: Matrix Preview with calculated scores
 * - 7.8.7 AC1-AC7: Publish flow with confirmation dialog
 * - 7.8.7 AC8-AC13: Version history panel
 * - 7.8.7 AC14-AC17: Version comparison dialog
 * - 11.2 AC16: Grid size displayed in header
 * - 11.2 AC17-AC18: Scale editor expected level count
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { api } from "@/trpc/react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Grid3X3,
  Scale,
  Gauge,
  Eye,
  Save,
  AlertCircle,
  CheckCircle,
  Lock,
  Upload,
  History,
} from "lucide-react";
import { toast } from "sonner";
import { ScaleEditor } from "@/components/matrix/ScaleEditor";
import { ThresholdEditor } from "@/components/matrix/ThresholdEditor";
import { MatrixPreview } from "@/components/matrix/MatrixPreview";
import { PublishConfirmationDialog } from "@/components/matrix/PublishConfirmationDialog";
import { VersionHistoryPanel } from "@/components/matrix/VersionHistoryPanel";
import { VersionCompareDialog } from "@/components/matrix/VersionCompareDialog";
import { validateMatrixVersion, type MatrixScales, type Threshold, type ScaleLevel } from "@/lib/matrix";

interface MatrixBuilderClientProps {
  templateId: string;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function MatrixBuilderClient({ templateId }: MatrixBuilderClientProps) {
  // State
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"scales" | "thresholds" | "preview">("scales");
  const [showCreateVersionDialog, setShowCreateVersionDialog] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  // Story 7.8.7: Publishing and version comparison dialogs
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [showCompareDialog, setShowCompareDialog] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(true);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Local state for editing (will be synced with server)
  const [localScales, setLocalScales] = useState<MatrixScales | null>(null);
  const [localThresholds, setLocalThresholds] = useState<Threshold[] | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const utils = api.useUtils();

  // Fetch template with versions
  const { data: template, isLoading, error } = api.riskMatrix.getTemplate.useQuery(
    { id: templateId },
    { refetchOnWindowFocus: false }
  );

  // Find selected version
  const selectedVersion = useMemo(() => {
    if (!template?.versions || !selectedVersionId) return null;
    return template.versions.find((v) => v.id === selectedVersionId) ?? null;
  }, [template?.versions, selectedVersionId]);

  // Check if current version is editable (draft only)
  const isReadOnly = useMemo(() => {
    if (!selectedVersion) return true;
    return !!selectedVersion.publishedAt;
  }, [selectedVersion]);

  // Story 7.8.7: Find current published version for comparison
  const currentPublishedVersion = useMemo(() => {
    if (!template?.versions) return null;
    return template.versions.find((v) => v.id === template.currentVersionId && v.publishedAt) ?? null;
  }, [template?.versions, template?.currentVersionId]);

  // Story 7.8.7: Prepare versions for history panel and compare dialog
  const versionsForPanel = useMemo(() => {
    if (!template?.versions) return [];
    return template.versions.map((v) => ({
      id: v.id,
      versionNumber: v.versionNumber,
      isActive: v.id === template.currentVersionId,
      publishedAt: v.publishedAt,
      createdAt: v.createdAt,
      publisher: v.publisher,
      scales: v.scales,
      thresholds: v.thresholds,
    }));
  }, [template?.versions, template?.currentVersionId]);

  // Initialize local state when version changes
  useEffect(() => {
    if (selectedVersion) {
      setLocalScales(selectedVersion.scales);
      setLocalThresholds(selectedVersion.thresholds);
      setHasUnsavedChanges(false);
      setSaveStatus("idle");
    }
  }, [selectedVersion]);

  // Auto-select version when template loads
  useEffect(() => {
    if (template?.versions && template.versions.length > 0 && !selectedVersionId) {
      // Prefer latest draft, otherwise current version
      const latestDraft = template.versions.find((v) => !v.publishedAt);
      const currentVersion = template.versions.find((v) => v.id === template.currentVersionId);
      setSelectedVersionId(latestDraft?.id ?? currentVersion?.id ?? template.versions[0]!.id);
    }
  }, [template?.versions, template?.currentVersionId, selectedVersionId]);

  // Mutations
  const createVersionMutation = api.riskMatrix.createVersion.useMutation({
    onSuccess: (newVersion) => {
      void utils.riskMatrix.getTemplate.invalidate({ id: templateId });
      setSelectedVersionId(newVersion.id);
      toast.success(`Created version ${newVersion.versionNumber} (Draft)`);
      setShowCreateVersionDialog(false);
    },
    onError: (error) => {
      toast.error(`Failed to create version: ${error.message}`);
    },
  });

  const updateVersionMutation = api.riskMatrix.updateVersion.useMutation({
    onSuccess: () => {
      setSaveStatus("saved");
      setHasUnsavedChanges(false);
      // Reset to idle after 2 seconds
      setTimeout(() => setSaveStatus("idle"), 2000);
    },
    onError: (error) => {
      setSaveStatus("error");
      toast.error(`Failed to save: ${error.message}`);
    },
  });

  // Story 7.8.7: Publish version mutation (AC5-AC7)
  const publishVersionMutation = api.riskMatrix.publishVersion.useMutation({
    onSuccess: (result) => {
      void utils.riskMatrix.getTemplate.invalidate({ id: templateId });
      setShowPublishDialog(false);
      toast.success(`Version ${result.versionNumber} published successfully`);
    },
    onError: (error) => {
      toast.error(`Failed to publish: ${error.message}`);
    },
  });

  // Refs for debounced auto-save (AC18-AC20)
  // Using refs to avoid stale closures and memory leaks
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingDataRef = useRef<{ scales: MatrixScales; thresholds: Threshold[] } | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Debounced auto-save function
  const debouncedSave = useCallback(
    (scales: MatrixScales, thresholds: Threshold[]) => {
      // Clear any pending save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Store data for save
      pendingDataRef.current = { scales, thresholds };

      saveTimeoutRef.current = setTimeout(() => {
        if (!selectedVersionId || isReadOnly || !pendingDataRef.current) return;

        setSaveStatus("saving");
        updateVersionMutation.mutate({
          id: selectedVersionId,
          scales: pendingDataRef.current.scales,
          thresholds: pendingDataRef.current.thresholds,
        });
        pendingDataRef.current = null;
      }, 500); // AC19: 500ms debounce
    },
    [selectedVersionId, isReadOnly, updateVersionMutation]
  );

  // Handle scale changes
  const handleScaleChange = useCallback(
    (scaleName: "likelihood" | "impact" | "exposure", levels: ScaleLevel[]) => {
      if (!localScales) return;

      const newScales = {
        ...localScales,
        [scaleName]: levels,
      };

      setLocalScales(newScales);
      setHasUnsavedChanges(true);

      if (!isReadOnly && localThresholds) {
        debouncedSave(newScales, localThresholds);
      }
    },
    [localScales, localThresholds, isReadOnly, debouncedSave]
  );

  // Handle threshold changes (placeholder for Story 7.8.6)
  const handleThresholdChange = useCallback(
    (thresholds: Threshold[]) => {
      setLocalThresholds(thresholds);
      setHasUnsavedChanges(true);

      if (!isReadOnly && localScales) {
        debouncedSave(localScales, thresholds);
      }
    },
    [localScales, isReadOnly, debouncedSave]
  );

  // Create new version from current or copy existing
  const handleCreateVersion = () => {
    if (selectedVersion) {
      createVersionMutation.mutate({
        templateId,
        copyFromVersionId: selectedVersion.id,
      });
    } else {
      createVersionMutation.mutate({ templateId });
    }
  };

  // Story 7.8.7: Create new version from a specific published version (AC12)
  const handleCreateFromVersion = useCallback(
    (versionId: string) => {
      createVersionMutation.mutate({
        templateId,
        copyFromVersionId: versionId,
      });
    },
    [createVersionMutation, templateId]
  );

  // Story 7.8.7: Handle publish confirmation (AC3-AC4)
  const handlePublish = useCallback(() => {
    if (!selectedVersionId) return;
    publishVersionMutation.mutate({ id: selectedVersionId });
  }, [selectedVersionId, publishVersionMutation]);

  // Manual save handler - bypasses debounce for immediate save
  const handleManualSave = useCallback(() => {
    if (!selectedVersionId || isReadOnly || !localScales || !localThresholds) return;
    if (!hasUnsavedChanges) return;

    // Clear any pending debounced save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    pendingDataRef.current = null;

    setSaveStatus("saving");
    updateVersionMutation.mutate({
      id: selectedVersionId,
      scales: localScales,
      thresholds: localThresholds,
    });
  }, [selectedVersionId, isReadOnly, localScales, localThresholds, hasUnsavedChanges, updateVersionMutation]);

  // Story 7.8.7: Validate before publish (AC2)
  useEffect(() => {
    if (!localScales || !localThresholds || !template) {
      setValidationErrors([]);
      return;
    }
    const result = validateMatrixVersion(
      localScales,
      localThresholds,
      template.dimensionCount,
      template.outputScaleMax
    );
    setValidationErrors(result.errors);
  }, [localScales, localThresholds, template]);

  // Story 7.8.7: Check if can publish (AC1-AC2)
  const canPublish = useMemo(() => {
    if (!selectedVersion) return false;
    if (isReadOnly) return false; // Already published
    if (hasUnsavedChanges) return false; // Needs save first
    if (validationErrors.length > 0) return false;
    return true;
  }, [selectedVersion, isReadOnly, hasUnsavedChanges, validationErrors]);

  // Save status indicator component
  const SaveIndicator = () => {
    switch (saveStatus) {
      case "saving":
        return (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Saving...</span>
          </div>
        );
      case "saved":
        return (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm">Saved</span>
          </div>
        );
      case "error":
        return (
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Error saving</span>
          </div>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <AppLayout breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Risk Matrices", href: "/admin/risk-matrices" }, { label: "Loading..." }]}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (error || !template) {
    return (
      <AppLayout breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Risk Matrices", href: "/admin/risk-matrices" }, { label: "Error" }]}>
        <div className="rounded-md bg-destructive/10 p-4">
          <div className="text-sm text-destructive">
            {error?.message || "Risk matrix template not found"}
          </div>
        </div>
        <Link
          href="/admin/risk-matrices"
          className="mt-4 inline-flex items-center text-primary hover:underline"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Risk Matrices
        </Link>
      </AppLayout>
    );
  }

  return (
    <AppLayout breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Risk Matrices", href: "/admin/risk-matrices" }, { label: template.name }]}>
      <div className="space-y-6">

      {/* Header - AC2 */}
      <div className="mb-8">
        <div className="sm:flex sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Grid3X3 className="h-6 w-6" />
              <h1 className="text-2xl font-semibold text-foreground">{template.name}</h1>
              {template.isDefault && (
                <Badge variant="secondary">Default</Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {template.description || "No description"}
            </p>
            {/* Story 11.2 AC16: Grid size displayed in header */}
            <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
              <span>{template.gridSize ?? 5}×{template.gridSize ?? 5}</span>
              <span>•</span>
              <span>{template.dimensionCount === 2 ? "2D (Likelihood × Impact)" : "3D (L × I × Exposure)"}</span>
              <span>•</span>
              <span>Max Score: {template.outputScaleMax}</span>
              <span>•</span>
              <span>{template.versionCount} version(s)</span>
            </div>
          </div>

          <div className="mt-4 sm:mt-0 flex items-center gap-3">
            {/* Save Status Indicator - AC20 */}
            <SaveIndicator />

            {/* Manual Save Button */}
            {!isReadOnly && selectedVersion && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleManualSave}
                disabled={!hasUnsavedChanges || saveStatus === "saving"}
              >
                {saveStatus === "saving" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span className="ml-2">Save</span>
              </Button>
            )}

            {/* Version Selector - AC4 */}
            <div className="flex items-center gap-2">
              <Select
                value={selectedVersionId ?? undefined}
                onValueChange={setSelectedVersionId}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select version" />
                </SelectTrigger>
                <SelectContent>
                  {template.versions.map((version) => (
                    <SelectItem key={version.id} value={version.id}>
                      <div className="flex items-center gap-2">
                        <span>v{version.versionNumber}</span>
                        {version.publishedAt ? (
                          <Badge variant="default" className="text-xs">Published</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Draft</Badge>
                        )}
                        {version.id === template.currentVersionId && (
                          <Badge variant="outline" className="text-xs">Current</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Create Version Button - AC5 */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateVersionDialog(true)}
                disabled={createVersionMutation.isPending}
              >
                {createVersionMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                <span className="ml-2 hidden sm:inline">New Version</span>
              </Button>

              {/* Story 7.8.7: Publish Button - AC1 */}
              {!isReadOnly && selectedVersion && (
                <Button
                  size="sm"
                  onClick={() => setShowPublishDialog(true)}
                  disabled={!canPublish || publishVersionMutation.isPending}
                  title={
                    hasUnsavedChanges
                      ? "Save changes before publishing"
                      : validationErrors.length > 0
                        ? "Fix validation errors before publishing"
                        : "Publish this version"
                  }
                >
                  {publishVersionMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  <span className="ml-2">Publish</span>
                </Button>
              )}

              {/* Story 7.8.7: History Toggle - AC8 */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHistoryPanel(!showHistoryPanel)}
                aria-label={showHistoryPanel ? "Hide version history" : "Show version history"}
              >
                <History className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Read-only indicator */}
        {isReadOnly && selectedVersion && (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground bg-muted px-4 py-2 rounded-md">
            <Lock className="h-4 w-4" />
            <span>
              This version is published and cannot be edited.{" "}
              <button
                onClick={() => setShowCreateVersionDialog(true)}
                className="text-primary hover:underline"
              >
                Create a new version
              </button>{" "}
              to make changes.
            </span>
          </div>
        )}
      </div>

      {/* Main content area with sidebar - Story 7.8.7 */}
      <div className="flex gap-6">
        {/* Tabs - AC3 */}
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as typeof activeTab)}
          className="flex-1 min-w-0"
        >
          <TabsList className="mb-4">
            <TabsTrigger value="scales" className="flex items-center gap-2">
              <Scale className="h-4 w-4" />
              Scales
            </TabsTrigger>
            <TabsTrigger value="thresholds" className="flex items-center gap-2">
              <Gauge className="h-4 w-4" />
              Thresholds
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Preview
            </TabsTrigger>
          </TabsList>

          {/* Scales Tab - AC6-AC12 */}
          <TabsContent value="scales">
            {localScales ? (
              <div className="space-y-6">
                {/* Likelihood Scale - Story 11.3: GridSize-constrained mode with position indicator */}
                <ScaleEditor
                  name="Likelihood"
                  levels={localScales.likelihood}
                  onChange={(levels) => handleScaleChange("likelihood", levels)}
                  readOnly={isReadOnly}
                  expectedLevelCount={template.gridSize ?? 5}
                  constrainToGridSize={true}
                  scaleType="likelihood"
                />

                {/* Impact Scale - Story 11.4: GridSize-constrained mode with position indicator */}
                <ScaleEditor
                  name="Impact"
                  levels={localScales.impact}
                  onChange={(levels) => handleScaleChange("impact", levels)}
                  readOnly={isReadOnly}
                  expectedLevelCount={template.gridSize ?? 5}
                  constrainToGridSize={true}
                  scaleType="impact"
                />

                {/* Exposure Scale (3D only) - AC6, Story 11.5: GridSize-constrained mode */}
                {template.dimensionCount === 3 && localScales.exposure && (
                  <ScaleEditor
                    name="Exposure"
                    levels={localScales.exposure}
                    onChange={(levels) => handleScaleChange("exposure", levels)}
                    readOnly={isReadOnly}
                    expectedLevelCount={template.gridSize ?? 5}
                    constrainToGridSize={true}
                    scaleType="exposure"
                  />
                )}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Select a version to edit scales
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Thresholds Tab - Story 7.8.6, Story 11.6: GridSize awareness */}
          <TabsContent value="thresholds">
            {localThresholds !== null ? (
              <ThresholdEditor
                thresholds={localThresholds}
                outputScaleMax={template.outputScaleMax}
                onChange={handleThresholdChange}
                readOnly={isReadOnly}
                gridSize={template.gridSize ?? 5}
              />
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Select a version to edit thresholds
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Preview Tab - Story 7.8.6, Story 11.7: Canvas Heatmap */}
          <TabsContent value="preview">
            {localScales && localThresholds ? (
              <MatrixPreview
                scales={localScales}
                thresholds={localThresholds}
                outputScaleMax={template.outputScaleMax}
                dimensionCount={template.dimensionCount as 2 | 3}
                matrixName={template.name}
              />
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Select a version to preview the matrix
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Story 7.8.7: Version History Panel - AC8-AC13 */}
        {showHistoryPanel && (
          <VersionHistoryPanel
            versions={versionsForPanel}
            currentVersionId={template.currentVersionId}
            selectedVersionId={selectedVersionId}
            onSelectVersion={setSelectedVersionId}
            onCreateFromVersion={handleCreateFromVersion}
            onCompareVersions={versionsForPanel.length > 1 ? () => setShowCompareDialog(true) : undefined}
          />
        )}
      </div>

      {/* Create Version Dialog */}
      <AlertDialog open={showCreateVersionDialog} onOpenChange={setShowCreateVersionDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create New Version</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedVersion ? (
                <>
                  This will create a new draft version (v{(template.versions[0]?.versionNumber ?? 0) + 1})
                  copied from version {selectedVersion.versionNumber}.
                  You can edit the new draft before publishing.
                </>
              ) : (
                <>
                  This will create a new draft version with empty scales.
                  Configure the scales before publishing.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCreateVersion}
              disabled={createVersionMutation.isPending}
            >
              {createVersionMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Create Version
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Story 7.8.7: Publish Confirmation Dialog - AC1-AC4 */}
      {selectedVersion && localScales && localThresholds && (
        <PublishConfirmationDialog
          open={showPublishDialog}
          onOpenChange={setShowPublishDialog}
          version={{
            versionNumber: selectedVersion.versionNumber,
            scales: localScales,
            thresholds: localThresholds,
          }}
          previousVersion={
            currentPublishedVersion && currentPublishedVersion.id !== selectedVersion.id
              ? {
                  versionNumber: currentPublishedVersion.versionNumber,
                  scales: currentPublishedVersion.scales,
                  thresholds: currentPublishedVersion.thresholds,
                }
              : undefined
          }
          onConfirm={handlePublish}
          isPending={publishVersionMutation.isPending}
          validationErrors={validationErrors}
        />
      )}

      {/* Story 7.8.7: Version Compare Dialog - AC14-AC17 */}
      <VersionCompareDialog
        open={showCompareDialog}
        onOpenChange={setShowCompareDialog}
        versions={versionsForPanel}
      />
      </div>
    </AppLayout>
  );
}
