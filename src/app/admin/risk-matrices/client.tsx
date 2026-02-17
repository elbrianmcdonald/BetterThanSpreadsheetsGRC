"use client";

/**
 * Risk Matrix Admin Client Component
 *
 * Story 7.8.2: RiskMatrixTemplate Schema
 * Story 11.2: Risk Matrix Create/Edit Form (gridSize support)
 * Story 11.8: Risk Matrix Activation & Defaults
 *
 * Features (AC15-AC20 from 7.8.2, AC1-AC18 from 11.2, AC1-AC26 from 11.8):
 * - AC15: Risk Matrices page in Platform Admin section
 * - AC16: Card or table view showing matrix name, dimensions, output scale, version count
 * - AC17: "Create Matrix" button opens creation form
 * - AC18: Matrix creation: name, description, dimension count selector, output scale input
 * - AC19: Click matrix to open Matrix Builder (Story 7.8.5)
 * - AC20: Status indicator: Draft (no versions), Active (has published version)
 * - 11.2 AC1-AC4: Grid size selector (3x3, 4x4, 5x5) in create dialog
 * - 11.2 AC9-AC11: Grid size read-only in edit mode
 * - 11.2 AC11: Template cards display grid size
 * - 11.8 AC1-AC7: Set as Default button and confirmation
 * - 11.8 AC8-AC13: Activate/Deactivate with warnings
 * - 11.8 AC14-AC18: Default star icon, quick actions dropdown
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Loader2,
  Plus,
  Grid3X3,
  Pencil,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Layers,
  Star,
  MoreHorizontal,
  Power,
  PowerOff,
} from "lucide-react";
import { toast } from "sonner";

interface FormData {
  name: string;
  description: string;
  dimensionCount: 2 | 3;
  gridSize: 3 | 4 | 5; // Story 11.2: Grid size selector
  outputScaleMax: string;
}

interface RiskMatrixTemplate {
  id: string;
  name: string;
  description: string | null;
  dimensionCount: number;
  gridSize: number; // Story 11.2: Grid size field
  outputScaleMax: number;
  currentVersionId: string | null;
  isActive: boolean;
  isDefault: boolean; // Story 11.8: Default flag
  versionCount: number;
  hasPublishedVersion: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function RiskMatricesClient() {
  const router = useRouter();

  // State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeactivateOpen, setIsDeactivateOpen] = useState(false);
  const [isSetDefaultOpen, setIsSetDefaultOpen] = useState(false); // Story 11.8
  const [editingTemplate, setEditingTemplate] = useState<RiskMatrixTemplate | null>(null);
  const [toggleTemplate, setToggleTemplate] = useState<RiskMatrixTemplate | null>(null);
  const [setDefaultTemplate, setSetDefaultTemplate] = useState<RiskMatrixTemplate | null>(null); // Story 11.8
  const [showInactive, setShowInactive] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    description: "",
    dimensionCount: 2,
    gridSize: 5, // Story 11.2: Default to 5x5 (AC3)
    outputScaleMax: "100",
  });

  const utils = api.useUtils();

  // Queries
  const { data: templates, isLoading, error } = api.riskMatrix.listTemplates.useQuery({
    includeInactive: showInactive,
  });

  const { data: deactivateCheck } = api.riskMatrix.checkDeactivationImpact.useQuery(
    { templateId: toggleTemplate?.id ?? "" },
    { enabled: !!toggleTemplate && toggleTemplate.isActive }
  );

  // Get current default for display in set default dialog
  const currentDefault = templates?.find((t) => t.isDefault);

  // Mutations
  const createMutation = api.riskMatrix.createTemplate.useMutation({
    onSuccess: (data) => {
      void utils.riskMatrix.listTemplates.invalidate();
      toast.success("Risk matrix template created with pre-seeded scales and thresholds");
      closeForm();
      // Navigate to the matrix builder to configure scales/thresholds
      router.push(`/admin/risk-matrices/${data.id}`);
    },
    onError: (error) => {
      toast.error(`Failed to create: ${error.message}`);
    },
  });

  const updateMutation = api.riskMatrix.updateTemplate.useMutation({
    onSuccess: () => {
      void utils.riskMatrix.listTemplates.invalidate();
      toast.success("Risk matrix template updated");
      closeForm();
    },
    onError: (error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  // Story 11.8: Set as Default mutation
  const setAsDefaultMutation = api.riskMatrix.setAsDefault.useMutation({
    onSuccess: () => {
      void utils.riskMatrix.listTemplates.invalidate();
      toast.success("Default matrix updated");
      setIsSetDefaultOpen(false);
      setSetDefaultTemplate(null);
    },
    onError: (error) => {
      toast.error(`Failed to set default: ${error.message}`);
    },
  });

  // Story 11.8: Activate mutation
  const activateMutation = api.riskMatrix.activate.useMutation({
    onSuccess: () => {
      void utils.riskMatrix.listTemplates.invalidate();
      toast.success("Matrix activated");
    },
    onError: (error) => {
      toast.error(`Failed to activate: ${error.message}`);
    },
  });

  // Story 11.8: Deactivate mutation
  const deactivateMutation = api.riskMatrix.deactivate.useMutation({
    onSuccess: () => {
      void utils.riskMatrix.listTemplates.invalidate();
      toast.success("Matrix deactivated");
      setIsDeactivateOpen(false);
      setToggleTemplate(null);
    },
    onError: (error) => {
      toast.error(`Failed to deactivate: ${error.message}`);
    },
  });

  // Handlers
  const openCreateForm = () => {
    setEditingTemplate(null);
    setFormData({
      name: "",
      description: "",
      dimensionCount: 2,
      gridSize: 5, // Story 11.2: Default to 5x5 (AC3)
      outputScaleMax: "100",
    });
    setIsFormOpen(true);
  };

  const openEditForm = (template: RiskMatrixTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description ?? "",
      dimensionCount: template.dimensionCount as 2 | 3,
      gridSize: (template.gridSize ?? 5) as 3 | 4 | 5, // Story 11.2: Load gridSize from template
      outputScaleMax: template.outputScaleMax.toString(),
    });
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingTemplate(null);
    setFormData({
      name: "",
      description: "",
      dimensionCount: 2,
      gridSize: 5, // Story 11.2: Reset to default 5x5
      outputScaleMax: "100",
    });
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }

    if (formData.name.length > 100) {
      toast.error("Name must be 100 characters or less");
      return;
    }

    if (formData.description.length > 500) {
      toast.error("Description must be 500 characters or less");
      return;
    }

    const outputScaleMax = parseFloat(formData.outputScaleMax);
    if (isNaN(outputScaleMax) || outputScaleMax <= 0 || outputScaleMax > 1000) {
      toast.error("Output scale must be between 0.01 and 1000");
      return;
    }

    if (editingTemplate) {
      // Can only update name and description
      updateMutation.mutate({
        id: editingTemplate.id,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
      });
    } else {
      // Story 11.2: Pass gridSize to create mutation (AC8)
      createMutation.mutate({
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        dimensionCount: formData.dimensionCount,
        gridSize: formData.gridSize,
        outputScaleMax: outputScaleMax,
      });
    }
  };

  // Story 11.8: Toggle active handler with new mutations
  const handleToggleActive = (template: RiskMatrixTemplate) => {
    if (template.isActive) {
      // Check if it's the default matrix (cannot deactivate)
      if (template.isDefault) {
        toast.error("Cannot deactivate the default matrix. Set another matrix as default first.");
        return;
      }
      // Show confirmation dialog for deactivation
      setToggleTemplate(template);
      setIsDeactivateOpen(true);
    } else {
      // Direct activation
      activateMutation.mutate({ templateId: template.id });
    }
  };

  // Story 11.8: Set as Default handler
  const handleSetAsDefault = (template: RiskMatrixTemplate) => {
    if (!template.isActive) {
      toast.error("Cannot set inactive template as default. Activate it first.");
      return;
    }
    if (!template.hasPublishedVersion) {
      toast.error("Template must have a published version to be set as default.");
      return;
    }
    setSetDefaultTemplate(template);
    setIsSetDefaultOpen(true);
  };

  const confirmSetDefault = () => {
    if (setDefaultTemplate) {
      setAsDefaultMutation.mutate({ templateId: setDefaultTemplate.id });
    }
  };

  const confirmDeactivate = (force = false) => {
    if (toggleTemplate) {
      deactivateMutation.mutate({
        templateId: toggleTemplate.id,
        force,
      });
    }
  };

  const handleMatrixClick = (template: RiskMatrixTemplate) => {
    // AC19: Navigate to Matrix Builder (Story 7.8.5)
    router.push(`/admin/risk-matrices/${template.id}`);
  };

  // Stats
  const activeCount = templates?.filter((t) => t.isActive).length ?? 0;
  const publishedCount = templates?.filter((t) => t.hasPublishedVersion).length ?? 0;
  const defaultMatrix = templates?.find((t) => t.isDefault);

  if (error) {
    return (
      <AppLayout breadcrumbs={[{ label: "Administration" }, { label: "Risk Matrices" }]}>
        <div className="px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-destructive">
            Error loading risk matrices: {error.message}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout breadcrumbs={[{ label: "Administration" }, { label: "Risk Matrices" }]}>
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="sm:flex sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
              <Grid3X3 className="h-6 w-6" />
              Risk Matrix Management
            </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Define risk scoring matrices for different assessment types (2D or 3D).
          </p>
        </div>
        <Button onClick={openCreateForm} className="mt-4 sm:mt-0">
          <Plus className="h-4 w-4 mr-2" />
          Create Matrix
        </Button>
      </div>

      {/* Summary Cards - Story 11.8: Include Default Matrix info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Matrices</p>
                <p className="text-2xl font-semibold text-green-600">{activeCount}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">With Published Versions</p>
                <p className="text-2xl font-semibold text-blue-600">{publishedCount}</p>
              </div>
              <Layers className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Default Matrix</p>
                <p className="text-lg font-semibold text-amber-600 truncate">
                  {defaultMatrix?.name ?? "Not set"}
                </p>
              </div>
              <Star className="h-8 w-8 text-amber-500 fill-amber-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 mb-4">
        <Label htmlFor="show-inactive" className="text-sm">
          Show inactive
        </Label>
        <Switch
          id="show-inactive"
          checked={showInactive}
          onCheckedChange={setShowInactive}
        />
      </div>

      {/* Matrix Cards Grid - AC16 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : templates?.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Grid3X3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                No risk matrices defined
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first risk matrix to start scoring assessments.
              </p>
              <Button onClick={openCreateForm}>
                <Plus className="h-4 w-4 mr-2" />
                Create Matrix
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates?.map((template) => (
            <Card
              key={template.id}
              className={`cursor-pointer hover:border-primary transition-colors ${
                !template.isActive ? "opacity-60" : ""
              }`}
              onClick={() => handleMatrixClick(template)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {/* Story 11.8 AC4/AC14: Star icon for default */}
                    {template.isDefault && (
                      <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                    )}
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                  </div>
                  {/* AC20: Status indicator */}
                  <div className="flex items-center gap-2">
                    {template.isDefault && (
                      <Badge variant="outline" className="text-amber-600 border-amber-600">
                        Default
                      </Badge>
                    )}
                    <Badge variant={template.hasPublishedVersion ? "default" : "secondary"}>
                      {template.hasPublishedVersion ? "Published" : "Draft"}
                    </Badge>
                  </div>
                </div>
                <CardDescription className="line-clamp-2">
                  {template.description ?? "No description"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {/* Story 11.2: Combined grid size and dimension display (AC11) */}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Grid:</span>
                    <span className="font-medium">
                      {template.gridSize ?? 5}×{template.gridSize ?? 5}{" "}
                      {template.dimensionCount === 2 ? "2D" : "3D"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Max Score:</span>
                    <span className="font-medium">{template.outputScaleMax}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Versions:</span>
                    <span className="font-medium">{template.versionCount}</span>
                  </div>
                </div>

                {/* Actions - Story 11.8: Quick actions dropdown */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditForm(template);
                      }}
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    {/* Story 11.8 AC18: Quick actions dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem
                          onClick={() => handleSetAsDefault(template)}
                          disabled={template.isDefault || !template.isActive || !template.hasPublishedVersion}
                        >
                          <Star className="h-4 w-4 mr-2" />
                          Set as Default
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {template.isActive ? (
                          <DropdownMenuItem
                            onClick={() => handleToggleActive(template)}
                            disabled={template.isDefault}
                            className="text-destructive"
                          >
                            <PowerOff className="h-4 w-4 mr-2" />
                            Deactivate
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => handleToggleActive(template)}
                          >
                            <Power className="h-4 w-4 mr-2" />
                            Activate
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {/* Story 11.8 AC15: Active toggle switch */}
                  <Switch
                    checked={template.isActive}
                    onCheckedChange={() => handleToggleActive(template)}
                    onClick={(e) => e.stopPropagation()}
                    disabled={template.isDefault || activateMutation.isPending || deactivateMutation.isPending}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog - AC17, AC18 */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Edit Risk Matrix" : "Create Risk Matrix"}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate
                ? "Update the matrix name and description. Dimension count and output scale cannot be changed."
                : "Create a new risk matrix template. Once created, dimension count and output scale cannot be changed."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., IT Risk Matrix, Vendor Risk Matrix"
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground">
                {formData.name.length}/100 characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Describe when this matrix should be used..."
                rows={3}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">
                {formData.description.length}/500 characters
              </p>
            </div>

            {/* AC25: Immutable fields warning - Story 11.2: Added gridSize (AC9-AC10) */}
            {editingTemplate ? (
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm text-muted-foreground">
                  <strong>Note:</strong> Grid size ({editingTemplate.gridSize ?? 5}×{editingTemplate.gridSize ?? 5}),
                  dimension count ({editingTemplate.dimensionCount}D), and
                  output scale ({editingTemplate.outputScaleMax}) cannot be changed after creation.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="dimensionCount">Dimension Count *</Label>
                  <Select
                    value={formData.dimensionCount.toString()}
                    onValueChange={(value) =>
                      setFormData({ ...formData, dimensionCount: parseInt(value) as 2 | 3 })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2D - Likelihood × Impact</SelectItem>
                      <SelectItem value="3">3D - Likelihood × Impact × Exposure</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {formData.dimensionCount === 3 && "Includes exposure dimension. "}
                    Cannot be changed after creation
                  </p>
                </div>

                {/* Story 11.2: Grid Size Selector (AC1-AC4, AC6-AC7) */}
                <div className="space-y-2">
                  <Label htmlFor="gridSize">Grid Size *</Label>
                  <Select
                    value={formData.gridSize.toString()}
                    onValueChange={(value) =>
                      setFormData({ ...formData, gridSize: parseInt(value) as 3 | 4 | 5 })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3×3 (3 levels per scale)</SelectItem>
                      <SelectItem value="4">4×4 (4 levels per scale)</SelectItem>
                      <SelectItem value="5">5×5 (5 levels per scale)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Each scale will have {formData.gridSize} levels. Cannot be changed after creation.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="outputScaleMax">Maximum Score *</Label>
                  <Input
                    id="outputScaleMax"
                    type="number"
                    value={formData.outputScaleMax}
                    onChange={(e) =>
                      setFormData({ ...formData, outputScaleMax: e.target.value })
                    }
                    placeholder="e.g., 100, 25, 1000"
                    min={0.01}
                    max={1000}
                    step="any"
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum calculated risk score (0.01-1000). Cannot be changed after creation.
                  </p>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending || !formData.name.trim()}
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingTemplate ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Story 11.8 AC6: Set Default Confirmation Dialog */}
      <AlertDialog open={isSetDefaultOpen} onOpenChange={setIsSetDefaultOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-500" />
              Set as Default Matrix?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  <strong>{setDefaultTemplate?.name}</strong> will become the default risk matrix for your organization.
                </p>
                {currentDefault && currentDefault.id !== setDefaultTemplate?.id && (
                  <p className="text-amber-600">
                    This will replace <strong>{currentDefault.name}</strong> as the default matrix.
                  </p>
                )}
                <p className="text-muted-foreground">
                  New risk assessments will use this matrix by default.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSetDefaultTemplate(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmSetDefault}
              disabled={setAsDefaultMutation.isPending}
            >
              {setAsDefaultMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Set as Default
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Story 11.8 AC11: Deactivation Confirmation Dialog */}
      <AlertDialog open={isDeactivateOpen} onOpenChange={setIsDeactivateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Deactivate {toggleTemplate?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                {deactivateCheck?.isDefault ? (
                  <p className="text-destructive font-medium">
                    Cannot deactivate the default matrix. Set another matrix as default first.
                  </p>
                ) : deactivateCheck?.activeAssessmentCount && deactivateCheck.activeAssessmentCount > 0 ? (
                  <>
                    <p className="text-amber-600">
                      Warning: {deactivateCheck.activeAssessmentCount} active assessment(s) use this matrix.
                    </p>
                    <p>
                      This matrix will no longer be available for new assessments. Existing assessments will not be affected.
                    </p>
                  </>
                ) : (
                  <p>
                    This matrix will no longer be available for new assessments. Existing assessments will not be affected.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setToggleTemplate(null)}>
              Cancel
            </AlertDialogCancel>
            {deactivateCheck?.activeAssessmentCount && deactivateCheck.activeAssessmentCount > 0 ? (
              <AlertDialogAction
                onClick={() => confirmDeactivate(true)}
                disabled={!deactivateCheck?.canDeactivate || deactivateMutation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deactivateMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Deactivate Anyway
              </AlertDialogAction>
            ) : (
              <AlertDialogAction
                onClick={() => confirmDeactivate(false)}
                disabled={!deactivateCheck?.canDeactivate || deactivateMutation.isPending}
              >
                {deactivateMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Deactivate
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
