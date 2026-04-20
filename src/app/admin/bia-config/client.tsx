"use client";

/**
 * BIA Configuration Admin Client Component
 *
 * Epic 9: BIA Configuration Admin
 *
 * Features:
 * - Story 9.2: Impact Categories Management
 * - Story 9.3: Score Scale Configuration
 * - Story 9.4: Tier Definitions Management
 * - Story 9.5: Tier Criteria Configuration (matrix)
 * - Story 9.6: Time Period Configuration
 * - Story 9.7: Tier Threshold Rules Configuration
 */

import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Activity,
  Layers,
  Clock,
  Grid3X3,
  Sliders,
  Settings,
  GripVertical,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

// ============================================================================
// Types
// ============================================================================

interface ImpactCategory {
  id: string;
  name: string;
  description: string | null;
  weight: number;
  sortOrder: number;
  isActive: boolean;
  assessmentCount?: number;
}

interface TierDefinition {
  id: string;
  name: string;
  tierLevel: number;
  rtoText: string;
  rpoText: string;
  colorHex: string;
  sortOrder: number;
  isActive: boolean;
}

interface TimePeriod {
  id: string;
  label: string;
  durationMinutes: number;
  sortOrder: number;
  isActive: boolean;
}

interface TierCriteria {
  id: string;
  categoryId: string;
  tierId: string;
  description: string;
  category?: { name: string };
  tier?: { name: string };
}

interface TierThreshold {
  tierId: string;
  tierName: string;
  minScore: number;
  maxScore: number;
}

// ============================================================================
// Impact Categories Tab (Story 9.2)
// ============================================================================

function ImpactCategoriesTab() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ImpactCategory | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<ImpactCategory | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    weight: 25,
  });

  const utils = api.useUtils();

  const { data: config, isLoading } = api.biaConfig.get.useQuery();
  const categories = config?.impactCategories ?? [];

  const createMutation = api.biaConfig.createImpactCategory.useMutation({
    onSuccess: () => {
      void utils.biaConfig.get.invalidate();
      toast.success("Impact category created");
      closeForm();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateMutation = api.biaConfig.updateImpactCategory.useMutation({
    onSuccess: () => {
      void utils.biaConfig.get.invalidate();
      toast.success("Impact category updated");
      closeForm();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = api.biaConfig.deleteImpactCategory.useMutation({
    onSuccess: () => {
      void utils.biaConfig.get.invalidate();
      toast.success("Impact category deleted");
      setIsDeleteOpen(false);
      setDeletingCategory(null);
    },
    onError: (error) => toast.error(error.message),
  });

  const openCreateForm = () => {
    setEditingCategory(null);
    setFormData({ name: "", description: "", weight: 25 });
    setIsFormOpen(true);
  };

  const openEditForm = (category: ImpactCategory) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description ?? "",
      weight: category.weight,
    });
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingCategory(null);
    setFormData({ name: "", description: "", weight: 25 });
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }

    if (editingCategory) {
      updateMutation.mutate({
        id: editingCategory.id,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        weight: formData.weight,
      });
    } else {
      createMutation.mutate({
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        weight: formData.weight,
      });
    }
  };

  const totalWeight = categories.reduce((sum, c) => sum + c.weight, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Impact Categories</h3>
          <p className="text-sm text-muted-foreground">
            Define the dimensions used to assess business impact (e.g., Financial, Operational, Compliance).
          </p>
        </div>
        <Button onClick={openCreateForm}>
          <Plus className="h-4 w-4 mr-2" />
          Add Category
        </Button>
      </div>

      {totalWeight !== 100 && categories.length > 0 && (
        <div className="flex items-center gap-2 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <span className="text-sm text-amber-800">
            Category weights total {totalWeight}%. They should sum to 100%.
          </span>
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          {categories.length === 0 ? (
            <div className="text-center py-12">
              <Layers className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h4 className="text-lg font-medium mb-2">No Impact Categories</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first impact category to define how business impact is measured.
              </p>
              <Button onClick={openCreateForm}>
                <Plus className="h-4 w-4 mr-2" />
                Add Category
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-center">Weight</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell>
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                    </TableCell>
                    <TableCell className="font-medium">{category.name}</TableCell>
                    <TableCell className="max-w-md">
                      <span className="text-muted-foreground line-clamp-2">
                        {category.description ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{category.weight}%</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={category.isActive ? "default" : "outline"}>
                        {category.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => openEditForm(category)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          onClick={() => {
                            setDeletingCategory(category);
                            setIsDeleteOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "Edit Impact Category" : "Add Impact Category"}
            </DialogTitle>
            <DialogDescription>
              {editingCategory
                ? "Update the impact category details."
                : "Create a new impact category for BIA assessments."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Financial, Operational, Compliance"
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe what this category measures..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="weight">Weight (%)</Label>
              <Input
                id="weight"
                type="number"
                min={1}
                max={100}
                value={formData.weight}
                onChange={(e) => setFormData({ ...formData, weight: parseInt(e.target.value) || 0 })}
              />
              <p className="text-xs text-muted-foreground">
                All category weights should sum to 100%.
              </p>
            </div>
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
              {editingCategory ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Impact Category?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingCategory?.name}"? This cannot be undone
              if there are no assessments using this category.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingCategory(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingCategory && deleteMutation.mutate({ id: deletingCategory.id })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================================
// Score Scale Tab (Story 9.3)
// ============================================================================

function ScoreScaleTab() {
  const [isEditing, setIsEditing] = useState(false);
  const [minScore, setMinScore] = useState(1);
  const [maxScore, setMaxScore] = useState(5);

  const utils = api.useUtils();
  const { data: config, isLoading } = api.biaConfig.get.useQuery();

  const updateMutation = api.biaConfig.updateScoreScale.useMutation({
    onSuccess: () => {
      void utils.biaConfig.get.invalidate();
      toast.success("Score scale updated");
      setIsEditing(false);
    },
    onError: (error) => toast.error(error.message),
  });

  const startEditing = () => {
    setMinScore(config?.scoreScaleMin ?? 1);
    setMaxScore(config?.scoreScaleMax ?? 5);
    setIsEditing(true);
  };

  const handleSave = () => {
    if (minScore >= maxScore) {
      toast.error("Minimum score must be less than maximum score");
      return;
    }
    updateMutation.mutate({ scoreScaleMin: minScore, scoreScaleMax: maxScore });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Score Scale</h3>
        <p className="text-sm text-muted-foreground">
          Define the numeric range used for impact scoring. Default is 1-5.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {!isEditing ? (
            <div className="flex items-center justify-between">
              <div className="space-y-4">
                <div className="flex items-center gap-8">
                  <div>
                    <p className="text-sm text-muted-foreground">Minimum Score</p>
                    <p className="text-3xl font-semibold">{config?.scoreScaleMin ?? 1}</p>
                  </div>
                  <div className="text-2xl text-muted-foreground">to</div>
                  <div>
                    <p className="text-sm text-muted-foreground">Maximum Score</p>
                    <p className="text-3xl font-semibold">{config?.scoreScaleMax ?? 5}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Process Owners will use this scale when scoring impact assessments.
                </p>
              </div>
              <Button onClick={startEditing}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit Scale
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-8">
                <div className="space-y-2">
                  <Label htmlFor="minScore">Minimum Score</Label>
                  <Input
                    id="minScore"
                    type="number"
                    value={minScore}
                    onChange={(e) => setMinScore(parseInt(e.target.value) || 0)}
                    className="w-24"
                  />
                </div>
                <div className="text-2xl text-muted-foreground pt-6">to</div>
                <div className="space-y-2">
                  <Label htmlFor="maxScore">Maximum Score</Label>
                  <Input
                    id="maxScore"
                    type="number"
                    value={maxScore}
                    onChange={(e) => setMaxScore(parseInt(e.target.value) || 0)}
                    className="w-24"
                  />
                </div>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-medium">Important</p>
                    <p>Changing the score scale will only affect future assessments. Existing assessment scores will not be modified.</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={updateMutation.isPending}>
                  {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Changes
                </Button>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Tier Definitions Tab (Story 9.4)
// ============================================================================

function TierDefinitionsTab() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<TierDefinition | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    tierLevel: 0,
    rtoText: "",
    rpoText: "",
    colorHex: "#ef4444",
  });

  const utils = api.useUtils();
  const { data: config, isLoading } = api.biaConfig.get.useQuery();
  const tiers = config?.tierDefinitions ?? [];

  const createMutation = api.biaConfig.createTierDefinition.useMutation({
    onSuccess: () => {
      void utils.biaConfig.get.invalidate();
      toast.success("Tier definition created");
      closeForm();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateMutation = api.biaConfig.updateTierDefinition.useMutation({
    onSuccess: () => {
      void utils.biaConfig.get.invalidate();
      toast.success("Tier definition updated");
      closeForm();
    },
    onError: (error) => toast.error(error.message),
  });

  const openCreateForm = () => {
    setEditingTier(null);
    setFormData({
      name: "",
      tierLevel: tiers.length,
      rtoText: "",
      rpoText: "",
      colorHex: "#ef4444",
    });
    setIsFormOpen(true);
  };

  const openEditForm = (tier: TierDefinition) => {
    setEditingTier(tier);
    setFormData({
      name: tier.name,
      tierLevel: tier.tierLevel,
      rtoText: tier.rtoText,
      rpoText: tier.rpoText,
      colorHex: tier.colorHex,
    });
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingTier(null);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!formData.rtoText.trim()) {
      toast.error("RTO is required");
      return;
    }
    if (!formData.rpoText.trim()) {
      toast.error("RPO is required");
      return;
    }

    if (editingTier) {
      updateMutation.mutate({
        id: editingTier.id,
        name: formData.name.trim(),
        rtoText: formData.rtoText.trim(),
        rpoText: formData.rpoText.trim(),
        colorHex: formData.colorHex,
      });
    } else {
      createMutation.mutate({
        name: formData.name.trim(),
        tierLevel: formData.tierLevel,
        rtoText: formData.rtoText.trim(),
        rpoText: formData.rpoText.trim(),
        colorHex: formData.colorHex,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Tier Definitions</h3>
          <p className="text-sm text-muted-foreground">
            Define criticality tiers with RTO/RPO targets (e.g., Mission Critical, High, Medium, Low).
          </p>
        </div>
        <Button onClick={openCreateForm}>
          <Plus className="h-4 w-4 mr-2" />
          Add Tier
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {tiers.length === 0 ? (
            <div className="text-center py-12">
              <Layers className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h4 className="text-lg font-medium mb-2">No Tier Definitions</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Create tier definitions to classify business process criticality.
              </p>
              <Button onClick={openCreateForm}>
                <Plus className="h-4 w-4 mr-2" />
                Add Tier
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>RTO</TableHead>
                  <TableHead>RPO</TableHead>
                  <TableHead className="text-center">Color</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tiers.map((tier) => (
                  <TableRow key={tier.id}>
                    <TableCell>
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: tier.colorHex }}
                        />
                        <span className="font-medium">{tier.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{tier.rtoText}</TableCell>
                    <TableCell>{tier.rpoText}</TableCell>
                    <TableCell className="text-center">
                      <Badge
                        style={{ backgroundColor: tier.colorHex, color: "#fff" }}
                      >
                        {tier.colorHex}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => openEditForm(tier)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTier ? "Edit Tier Definition" : "Add Tier Definition"}
            </DialogTitle>
            <DialogDescription>
              Define the criticality tier with recovery objectives.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tierName">Name *</Label>
              <Input
                id="tierName"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Mission Critical, High, Medium, Low"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rto">RTO (Recovery Time Objective) *</Label>
                <Input
                  id="rto"
                  value={formData.rtoText}
                  onChange={(e) => setFormData({ ...formData, rtoText: e.target.value })}
                  placeholder="e.g., 4 hours, 24 hours"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rpo">RPO (Recovery Point Objective) *</Label>
                <Input
                  id="rpo"
                  value={formData.rpoText}
                  onChange={(e) => setFormData({ ...formData, rpoText: e.target.value })}
                  placeholder="e.g., 1 hour, 24 hours"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
              <div className="flex items-center gap-4">
                <Input
                  id="color"
                  type="color"
                  value={formData.colorHex}
                  onChange={(e) => setFormData({ ...formData, colorHex: e.target.value })}
                  className="w-16 h-10 p-1"
                />
                <Badge style={{ backgroundColor: formData.colorHex, color: "#fff" }}>
                  {formData.name || "Preview"}
                </Badge>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingTier ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// Tier Criteria Tab (Story 9.5)
// ============================================================================

function TierCriteriaTab() {
  const [editingCriteria, setEditingCriteria] = useState<TierCriteria | null>(null);
  const [description, setDescription] = useState("");

  const utils = api.useUtils();
  const { data: config, isLoading } = api.biaConfig.get.useQuery();
  const { data: criteriaData } = api.biaConfig.getTierCriteria.useQuery();

  const updateMutation = api.biaConfig.updateTierCriteria.useMutation({
    onSuccess: () => {
      void utils.biaConfig.getTierCriteria.invalidate();
      toast.success("Criteria updated");
      setEditingCriteria(null);
    },
    onError: (error) => toast.error(error.message),
  });

  const categories = config?.impactCategories ?? [];
  const tiers = config?.tierDefinitions ?? [];

  // Flatten criteria from nested structure
  const criteria: TierCriteria[] = criteriaData?.impactCategories?.flatMap((cat) =>
    cat.tierCriteria?.map((tc) => ({
      id: tc.id,
      categoryId: tc.categoryId,
      tierId: tc.tierId,
      description: tc.description,
    })) ?? []
  ) ?? [];

  const getCriteria = (categoryId: string, tierId: string) => {
    return criteria.find((c) => c.categoryId === categoryId && c.tierId === tierId);
  };

  const handleEditClick = (categoryId: string, tierId: string) => {
    const existing = getCriteria(categoryId, tierId);
    setEditingCriteria({
      id: existing?.id ?? "",
      categoryId,
      tierId,
      description: existing?.description ?? "",
    });
    setDescription(existing?.description ?? "");
  };

  const handleSave = () => {
    if (editingCriteria) {
      updateMutation.mutate({
        categoryId: editingCriteria.categoryId,
        tierId: editingCriteria.tierId,
        description: description.trim(),
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Tier Criteria Matrix</h3>
        <p className="text-sm text-muted-foreground">
          Define criteria descriptions for each category/tier intersection. These guide Process Owners during scoring.
        </p>
      </div>

      {categories.length === 0 || tiers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Grid3X3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h4 className="text-lg font-medium mb-2">Configure Categories and Tiers First</h4>
            <p className="text-sm text-muted-foreground">
              You need at least one impact category and one tier definition to configure criteria.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Tier / Category</TableHead>
                  {categories.map((cat) => (
                    <TableHead key={cat.id} className="text-center min-w-48">
                      {cat.name}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {tiers.map((tier) => (
                  <TableRow key={tier.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: tier.colorHex }}
                        />
                        <span className="font-medium">{tier.name}</span>
                      </div>
                    </TableCell>
                    {categories.map((cat) => {
                      const cellCriteria = getCriteria(cat.id, tier.id);
                      return (
                        <TableCell
                          key={`${cat.id}-${tier.id}`}
                          className="text-center cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handleEditClick(cat.id, tier.id)}
                        >
                          {cellCriteria?.description ? (
                            <p className="text-sm text-left line-clamp-3">
                              {cellCriteria.description}
                            </p>
                          ) : (
                            <span className="text-muted-foreground text-sm italic">
                              Click to add criteria...
                            </span>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Edit Criteria Dialog */}
      <Dialog open={!!editingCriteria} onOpenChange={(open) => !open && setEditingCriteria(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tier Criteria</DialogTitle>
            <DialogDescription>
              Define what constitutes this level of impact for this category.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex gap-4">
              <Badge variant="outline">
                {categories.find((c) => c.id === editingCriteria?.categoryId)?.name}
              </Badge>
              <Badge
                style={{
                  backgroundColor:
                    tiers.find((t) => t.id === editingCriteria?.tierId)?.colorHex ?? "#888",
                  color: "#fff",
                }}
              >
                {tiers.find((t) => t.id === editingCriteria?.tierId)?.name}
              </Badge>
            </div>

            <div className="space-y-2">
              <Label htmlFor="criteria">Criteria Description</Label>
              <Textarea
                id="criteria"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the conditions that would qualify for this tier..."
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCriteria(null)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// Time Periods Tab (Story 9.6)
// ============================================================================

function TimePeriodsTab() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<TimePeriod | null>(null);
  const [formData, setFormData] = useState({
    label: "",
    durationMinutes: 60,
  });

  const utils = api.useUtils();
  const { data: config, isLoading } = api.biaConfig.get.useQuery();
  const periods = config?.timePeriods ?? [];

  const createMutation = api.biaConfig.createTimePeriod.useMutation({
    onSuccess: () => {
      void utils.biaConfig.get.invalidate();
      toast.success("Time period created");
      closeForm();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateMutation = api.biaConfig.updateTimePeriod.useMutation({
    onSuccess: () => {
      void utils.biaConfig.get.invalidate();
      toast.success("Time period updated");
      closeForm();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = api.biaConfig.deleteTimePeriod.useMutation({
    onSuccess: () => {
      void utils.biaConfig.get.invalidate();
      toast.success("Time period deleted");
    },
    onError: (error) => toast.error(error.message),
  });

  const openCreateForm = () => {
    setEditingPeriod(null);
    setFormData({ label: "", durationMinutes: 60 });
    setIsFormOpen(true);
  };

  const openEditForm = (period: TimePeriod) => {
    setEditingPeriod(period);
    setFormData({
      label: period.label,
      durationMinutes: period.durationMinutes,
    });
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingPeriod(null);
  };

  const handleSubmit = () => {
    if (!formData.label.trim()) {
      toast.error("Label is required");
      return;
    }

    if (editingPeriod) {
      updateMutation.mutate({
        id: editingPeriod.id,
        label: formData.label.trim(),
        durationMinutes: formData.durationMinutes,
      });
    } else {
      createMutation.mutate({
        label: formData.label.trim(),
        durationMinutes: formData.durationMinutes,
      });
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    if (minutes < 1440) return `${minutes / 60} hr`;
    if (minutes < 10080) return `${minutes / 1440} days`;
    return `${minutes / 10080} weeks`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Time Periods</h3>
          <p className="text-sm text-muted-foreground">
            Define time periods for the time-to-impact matrix (e.g., 30 min, 4 hrs, 24 hrs).
          </p>
        </div>
        <Button onClick={openCreateForm}>
          <Plus className="h-4 w-4 mr-2" />
          Add Period
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {periods.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h4 className="text-lg font-medium mb-2">No Time Periods</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Create time periods for the time-to-impact assessment matrix.
              </p>
              <Button onClick={openCreateForm}>
                <Plus className="h-4 w-4 mr-2" />
                Add Period
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.map((period) => (
                  <TableRow key={period.id}>
                    <TableCell>
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                    </TableCell>
                    <TableCell className="font-medium">{period.label}</TableCell>
                    <TableCell>{formatDuration(period.durationMinutes)}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={period.isActive ? "default" : "outline"}>
                        {period.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => openEditForm(period)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          onClick={() => deleteMutation.mutate({ id: period.id })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPeriod ? "Edit Time Period" : "Add Time Period"}
            </DialogTitle>
            <DialogDescription>
              Define a time period for the time-to-impact matrix.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="periodLabel">Label *</Label>
              <Input
                id="periodLabel"
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                placeholder="e.g., 30 minutes, 4 hours, 24 hours"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                min={1}
                value={formData.durationMinutes}
                onChange={(e) =>
                  setFormData({ ...formData, durationMinutes: parseInt(e.target.value) || 60 })
                }
              />
              <p className="text-xs text-muted-foreground">
                {formatDuration(formData.durationMinutes)}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingPeriod ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// Tier Thresholds Tab (Story 9.7)
// ============================================================================

function TierThresholdsTab() {
  const [isEditing, setIsEditing] = useState(false);
  const [thresholds, setThresholds] = useState<TierThreshold[]>([]);

  const utils = api.useUtils();
  const { data: config, isLoading } = api.biaConfig.get.useQuery();

  const updateMutation = api.biaConfig.updateTierThresholds.useMutation({
    onSuccess: () => {
      void utils.biaConfig.get.invalidate();
      toast.success("Tier thresholds updated");
      setIsEditing(false);
    },
    onError: (error) => toast.error(error.message),
  });

  const tiers = config?.tierDefinitions ?? [];
  // tierThresholds is a Json column. Prisma default "[]" comes back as an
  // array on fresh installs; the update mutation stringifies before writing,
  // so post-save it comes back as a string. Handle both.
  const savedThresholds: TierThreshold[] = (() => {
    const raw = config?.tierThresholds;
    if (!raw) return [];
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw) as TierThreshold[];
      } catch {
        return [];
      }
    }
    return raw as unknown as TierThreshold[];
  })();

  const startEditing = () => {
    // Initialize thresholds from saved data or defaults
    const initialThresholds = tiers.map((tier, index) => {
      const saved = savedThresholds.find((t) => t.tierId === tier.id);
      if (saved) return saved;
      // Default: divide scale evenly
      const scaleRange = (config?.scoreScaleMax ?? 5) - (config?.scoreScaleMin ?? 1);
      const step = scaleRange / tiers.length;
      return {
        tierId: tier.id,
        tierName: tier.name,
        minScore: (config?.scoreScaleMin ?? 1) + step * (tiers.length - 1 - index),
        maxScore: (config?.scoreScaleMin ?? 1) + step * (tiers.length - index),
      };
    });
    setThresholds(initialThresholds);
    setIsEditing(true);
  };

  const handleSave = () => {
    // Validate no gaps or overlaps
    const sorted = [...thresholds].sort((a, b) => b.maxScore - a.maxScore);
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];
      if (current && next && Math.abs(current.minScore - next.maxScore) > 0.01) {
        toast.error("There are gaps or overlaps in the threshold ranges");
        return;
      }
    }

    updateMutation.mutate({
      thresholds: thresholds.map((t) => ({
        tierId: t.tierId,
        minScore: t.minScore,
        maxScore: t.maxScore,
      })),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (tiers.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">Tier Thresholds</h3>
          <p className="text-sm text-muted-foreground">
            Define score ranges that map to each tier for auto-calculation.
          </p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <Sliders className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h4 className="text-lg font-medium mb-2">Configure Tiers First</h4>
            <p className="text-sm text-muted-foreground">
              You need tier definitions before configuring thresholds.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Tier Thresholds</h3>
          <p className="text-sm text-muted-foreground">
            Define score ranges that map aggregate scores to tier assignments.
          </p>
        </div>
        {!isEditing && (
          <Button onClick={startEditing}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit Thresholds
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 p-4 bg-muted rounded-lg">
            <p className="text-sm">
              <span className="font-medium">Score Scale:</span> {config?.scoreScaleMin ?? 1} to{" "}
              {config?.scoreScaleMax ?? 5}
            </p>
          </div>

          {!isEditing ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tier</TableHead>
                  <TableHead className="text-center">Min Score</TableHead>
                  <TableHead className="text-center">Max Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tiers.map((tier) => {
                  const threshold = savedThresholds.find((t) => t.tierId === tier.id);
                  return (
                    <TableRow key={tier.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: tier.colorHex }}
                          />
                          <span className="font-medium">{tier.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {threshold?.minScore ?? "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        {threshold?.maxScore ?? "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="space-y-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tier</TableHead>
                    <TableHead className="text-center">Min Score</TableHead>
                    <TableHead className="text-center">Max Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {thresholds.map((threshold, index) => {
                    const tier = tiers.find((t) => t.id === threshold.tierId);
                    return (
                      <TableRow key={threshold.tierId}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: tier?.colorHex ?? "#888" }}
                            />
                            <span className="font-medium">{tier?.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            step="0.1"
                            value={threshold.minScore}
                            onChange={(e) => {
                              const updated = [...thresholds];
                              updated[index] = {
                                ...threshold,
                                minScore: parseFloat(e.target.value) || 0,
                              };
                              setThresholds(updated);
                            }}
                            className="w-24 mx-auto"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            step="0.1"
                            value={threshold.maxScore}
                            onChange={(e) => {
                              const updated = [...thresholds];
                              updated[index] = {
                                ...threshold,
                                maxScore: parseFloat(e.target.value) || 0,
                              };
                              setThresholds(updated);
                            }}
                            className="w-24 mx-auto"
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={updateMutation.isPending}>
                  {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Thresholds
                </Button>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function BIAConfigClient() {
  return (
    <AppLayout breadcrumbs={[{ label: "Administration" }, { label: "BIA Configuration" }]}>
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Settings className="h-6 w-6" />
            BIA Configuration
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Customize your organization's Business Impact Assessment methodology.
          </p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="categories" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="categories" className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              <span className="hidden sm:inline">Categories</span>
            </TabsTrigger>
            <TabsTrigger value="scale" className="flex items-center gap-2">
              <Sliders className="h-4 w-4" />
              <span className="hidden sm:inline">Scale</span>
            </TabsTrigger>
            <TabsTrigger value="tiers" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">Tiers</span>
            </TabsTrigger>
            <TabsTrigger value="criteria" className="flex items-center gap-2">
              <Grid3X3 className="h-4 w-4" />
              <span className="hidden sm:inline">Criteria</span>
            </TabsTrigger>
            <TabsTrigger value="periods" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Periods</span>
            </TabsTrigger>
            <TabsTrigger value="thresholds" className="flex items-center gap-2">
              <Sliders className="h-4 w-4" />
              <span className="hidden sm:inline">Thresholds</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="categories">
            <ImpactCategoriesTab />
          </TabsContent>

          <TabsContent value="scale">
            <ScoreScaleTab />
          </TabsContent>

          <TabsContent value="tiers">
            <TierDefinitionsTab />
          </TabsContent>

          <TabsContent value="criteria">
            <TierCriteriaTab />
          </TabsContent>

          <TabsContent value="periods">
            <TimePeriodsTab />
          </TabsContent>

          <TabsContent value="thresholds">
            <TierThresholdsTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
