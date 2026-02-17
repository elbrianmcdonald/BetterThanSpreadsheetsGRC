"use client";

/**
 * Assessment Type Admin Client Component
 *
 * Story 7.8.1: AssessmentType Schema & CRUD
 *
 * Features (AC13-AC18):
 * - AC13: Assessment Types page in Platform Admin section
 * - AC14: Table listing all types with name, description, status, assessment count
 * - AC15: "Add Type" button opens creation modal
 * - AC16: Edit inline or via modal
 * - AC17: Toggle active/inactive with confirmation if has assessments
 * - AC18: Filter by active/inactive status
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
import { Switch } from "@/components/ui/switch";
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
import {
  Loader2,
  Plus,
  Pencil,
  FileStack,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

interface FormData {
  name: string;
  description: string;
}

interface AssessmentType {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  assessmentCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export function AssessmentTypesClient() {
  // State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeactivateOpen, setIsDeactivateOpen] = useState(false);
  const [editingType, setEditingType] = useState<AssessmentType | null>(null);
  const [toggleType, setToggleType] = useState<AssessmentType | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    description: "",
  });

  const utils = api.useUtils();

  // Queries
  const { data: types, isLoading, error } = api.assessmentType.list.useQuery({
    includeInactive: showInactive,
  });

  const { data: deactivateCheck } = api.assessmentType.canDeactivate.useQuery(
    { id: toggleType?.id ?? "" },
    { enabled: !!toggleType && toggleType.isActive }
  );

  // Mutations
  const createMutation = api.assessmentType.create.useMutation({
    onSuccess: () => {
      void utils.assessmentType.list.invalidate();
      toast.success("Assessment type created");
      closeForm();
    },
    onError: (error) => {
      toast.error(`Failed to create: ${error.message}`);
    },
  });

  const updateMutation = api.assessmentType.update.useMutation({
    onSuccess: () => {
      void utils.assessmentType.list.invalidate();
      toast.success("Assessment type updated");
      closeForm();
    },
    onError: (error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  // Handlers
  const openCreateForm = () => {
    setEditingType(null);
    setFormData({ name: "", description: "" });
    setIsFormOpen(true);
  };

  const openEditForm = (type: AssessmentType) => {
    setEditingType(type);
    setFormData({
      name: type.name,
      description: type.description ?? "",
    });
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingType(null);
    setFormData({ name: "", description: "" });
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

    if (editingType) {
      updateMutation.mutate({
        id: editingType.id,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
      });
    } else {
      createMutation.mutate({
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
      });
    }
  };

  const handleToggleActive = (type: AssessmentType) => {
    if (type.isActive && type.assessmentCount > 0) {
      // Show confirmation dialog for deactivation with assessments
      setToggleType(type);
      setIsDeactivateOpen(true);
    } else {
      // Direct toggle for activation or deactivation without assessments
      updateMutation.mutate({
        id: type.id,
        isActive: !type.isActive,
      });
    }
  };

  const confirmDeactivate = () => {
    if (toggleType) {
      updateMutation.mutate({
        id: toggleType.id,
        isActive: false,
      });
    }
    setIsDeactivateOpen(false);
    setToggleType(null);
  };

  // Stats
  const activeCount = types?.filter((t) => t.isActive).length ?? 0;
  const inactiveCount = types?.filter((t) => !t.isActive).length ?? 0;
  const totalAssessments = types?.reduce((sum, t) => sum + t.assessmentCount, 0) ?? 0;

  if (error) {
    return (
      <AppLayout breadcrumbs={[{ label: "Administration" }, { label: "Assessment Types" }]}>
        <div className="px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-destructive">
            Error loading assessment types: {error.message}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout breadcrumbs={[{ label: "Administration" }, { label: "Assessment Types" }]}>
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="sm:flex sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
              <FileStack className="h-6 w-6" />
              Assessment Type Management
            </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Define types to categorize risk assessments (IT Risk, Vendor Risk, Compliance Risk, etc.)
          </p>
        </div>
        <Button onClick={openCreateForm} className="mt-4 sm:mt-0">
          <Plus className="h-4 w-4 mr-2" />
          Add Type
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Types</p>
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
                <p className="text-sm text-muted-foreground">Inactive Types</p>
                <p className="text-2xl font-semibold text-muted-foreground">{inactiveCount}</p>
              </div>
              <XCircle className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Assessments</p>
                <p className="text-2xl font-semibold">{totalAssessments}</p>
              </div>
              <FileStack className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Assessment Types</CardTitle>
              <CardDescription>
                Manage the types available for categorizing risk assessments.
              </CardDescription>
            </div>
            {/* AC18: Filter by active/inactive */}
            <div className="flex items-center gap-2">
              <Label htmlFor="show-inactive" className="text-sm">
                Show inactive
              </Label>
              <Switch
                id="show-inactive"
                checked={showInactive}
                onCheckedChange={setShowInactive}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : types?.length === 0 ? (
            <div className="text-center py-12">
              <FileStack className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                No assessment types defined
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first assessment type to start categorizing risk assessments.
              </p>
              <Button onClick={openCreateForm}>
                <Plus className="h-4 w-4 mr-2" />
                Add Type
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-center">Assessments</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {types?.map((type) => (
                  <TableRow key={type.id}>
                    <TableCell className="font-medium">{type.name}</TableCell>
                    <TableCell className="max-w-md">
                      <span className="text-muted-foreground line-clamp-2">
                        {type.description ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{type.assessmentCount}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={type.isActive ? "default" : "outline"}>
                        {type.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => openEditForm(type)}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Switch
                          checked={type.isActive}
                          onCheckedChange={() => handleToggleActive(type)}
                          disabled={updateMutation.isPending}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog - AC15, AC16 */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingType ? "Edit Assessment Type" : "Add Assessment Type"}
            </DialogTitle>
            <DialogDescription>
              {editingType
                ? "Update the assessment type details."
                : "Create a new type for categorizing risk assessments."}
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
                placeholder="e.g., IT Risk, Vendor Risk, Compliance Risk"
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
                placeholder="Describe when this assessment type should be used..."
                rows={3}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">
                {formData.description.length}/500 characters
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
              {editingType ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivation Confirmation Dialog - AC17 */}
      <AlertDialog open={isDeactivateOpen} onOpenChange={setIsDeactivateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Deactivate {toggleType?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deactivateCheck?.canDeactivate ? (
                "This assessment type will no longer be available for new assessments. Existing assessments will not be affected."
              ) : (
                <span className="text-destructive">
                  {deactivateCheck?.reason}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setToggleType(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeactivate}
              disabled={!deactivateCheck?.canDeactivate || updateMutation.isPending}
              className={!deactivateCheck?.canDeactivate ? "opacity-50 cursor-not-allowed" : ""}
            >
              {updateMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
