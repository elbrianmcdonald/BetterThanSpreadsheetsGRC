"use client";

/**
 * Business Unit Admin Client Component
 *
 * Story 7.0.3: BU Admin CRUD UI
 *
 * Features:
 * - Tree view of hierarchical business units
 * - Create/Edit/Delete operations
 * - Parent selection with hierarchy display
 * - User count per BU
 * - Deletion protection (users/children)
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Loader2,
  Plus,
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  Building2,
  Users,
  FolderTree,
} from "lucide-react";
import { toast } from "sonner";

// Tree node type from API
interface TreeNode {
  id: string;
  name: string;
  code: string | null;
  parentId: string | null;
  isActive: boolean;
  sortOrder: number;
  depth: number;
  _count: {
    users: number;
    children: number;
  };
  children: TreeNode[];
}

interface FormData {
  name: string;
  code: string;
  parentId: string;
}

export function BusinessUnitsClient() {
  // State
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingBU, setEditingBU] = useState<TreeNode | null>(null);
  const [deletingBU, setDeletingBU] = useState<TreeNode | null>(null);
  const [preselectedParent, setPreselectedParent] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    code: "",
    parentId: "",
  });

  const utils = api.useUtils();

  // Queries
  const { data, isLoading, error } = api.businessUnit.list.useQuery({
    includeInactive: false,
  });

  const { data: parentOptions } = api.businessUnit.getParentOptions.useQuery({
    excludeId: editingBU?.id,
  });

  const { data: deleteCheck } = api.businessUnit.canDelete.useQuery(
    { id: deletingBU?.id ?? "" },
    { enabled: !!deletingBU }
  );

  // Mutations
  const createMutation = api.businessUnit.create.useMutation({
    onSuccess: () => {
      void utils.businessUnit.list.invalidate();
      toast.success("Business Unit created");
      closeForm();
    },
    onError: (error) => {
      toast.error(`Failed to create: ${error.message}`);
    },
  });

  const updateMutation = api.businessUnit.update.useMutation({
    onSuccess: () => {
      void utils.businessUnit.list.invalidate();
      toast.success("Business Unit updated");
      closeForm();
    },
    onError: (error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  const deleteMutation = api.businessUnit.delete.useMutation({
    onSuccess: () => {
      void utils.businessUnit.list.invalidate();
      toast.success("Business Unit deleted");
      setIsDeleteOpen(false);
      setDeletingBU(null);
    },
    onError: (error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  // Handlers
  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const openCreateForm = (parentId?: string) => {
    setEditingBU(null);
    setPreselectedParent(parentId ?? null);
    setFormData({
      name: "",
      code: "",
      parentId: parentId ?? "",
    });
    setIsFormOpen(true);
  };

  const openEditForm = (bu: TreeNode) => {
    setEditingBU(bu);
    setPreselectedParent(null);
    setFormData({
      name: bu.name,
      code: bu.code ?? "",
      parentId: bu.parentId ?? "",
    });
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingBU(null);
    setPreselectedParent(null);
    setFormData({ name: "", code: "", parentId: "" });
  };

  const openDeleteDialog = (bu: TreeNode) => {
    setDeletingBU(bu);
    setIsDeleteOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }

    if (editingBU) {
      updateMutation.mutate({
        id: editingBU.id,
        name: formData.name.trim(),
        code: formData.code.trim() || null,
        parentId: formData.parentId || null,
      });
    } else {
      createMutation.mutate({
        name: formData.name.trim(),
        code: formData.code.trim() || null,
        parentId: formData.parentId || null,
      });
    }
  };

  const handleDelete = () => {
    if (deletingBU) {
      deleteMutation.mutate({ id: deletingBU.id });
    }
  };

  // Expand all by default on first load
  if (data && expandedIds.size === 0 && data.tree.length > 0) {
    const allIds = new Set<string>();
    const collectIds = (nodes: TreeNode[]) => {
      nodes.forEach((node) => {
        if (node.children.length > 0) {
          allIds.add(node.id);
          collectIds(node.children);
        }
      });
    };
    collectIds(data.tree);
    if (allIds.size > 0) {
      setExpandedIds(allIds);
    }
  }

  // Render tree node recursively
  const renderTreeNode = (node: TreeNode, depth: number = 0) => {
    const isExpanded = expandedIds.has(node.id);
    const hasChildren = node.children.length > 0;
    const canAddChild = depth < 4; // Max depth is 5, so depth < 4 means room for child

    return (
      <div key={node.id}>
        <div
          className="flex items-center gap-2 py-2 px-3 hover:bg-muted rounded-md group"
          style={{ paddingLeft: `${depth * 24 + 12}px` }}
        >
          {/* Expand/Collapse */}
          {hasChildren ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => toggleExpand(node.id)}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          ) : (
            <div className="w-6" />
          )}

          {/* Name */}
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1 font-medium">{node.name}</span>

          {/* Code badge */}
          {node.code && (
            <Badge variant="outline" className="font-mono text-xs">
              {node.code}
            </Badge>
          )}

          {/* User count */}
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Users className="h-3 w-3" />
            <span>{node._count.users}</span>
          </div>

          {/* Actions (visible on hover) */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {canAddChild && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => openCreateForm(node.id)}
                title="Add child unit"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Child
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => openEditForm(node)}
              title="Edit"
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              onClick={() => openDeleteDialog(node)}
              title="Delete"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Children */}
        {isExpanded && hasChildren && (
          <div>
            {node.children.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (error) {
    return (
      <AppLayout breadcrumbs={[{ label: "Administration" }, { label: "Business Units" }]}>
        <div className="px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-destructive">
            Error loading business units: {error.message}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout breadcrumbs={[{ label: "Administration" }, { label: "Business Units" }]}>
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="sm:flex sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
              <FolderTree className="h-6 w-6" />
              Business Unit Management
            </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage your organizational hierarchy. Business units are used for
            assignment routing and rollup reporting.
          </p>
        </div>
        <Button onClick={() => openCreateForm()} className="mt-4 sm:mt-0">
          <Plus className="h-4 w-4 mr-2" />
          Add Business Unit
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Units</p>
                <p className="text-2xl font-semibold">{data?.totalCount ?? 0}</p>
              </div>
              <Building2 className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Root Units</p>
                <p className="text-2xl font-semibold text-blue-600">
                  {data?.tree.length ?? 0}
                </p>
              </div>
              <FolderTree className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Max Depth</p>
                <p className="text-2xl font-semibold text-muted-foreground">5 levels</p>
              </div>
              <div className="text-xs text-muted-foreground">Hierarchy limit</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tree View */}
      <Card>
        <CardHeader>
          <CardTitle>Organization Hierarchy</CardTitle>
          <CardDescription>
            Click on units to expand/collapse. Hover to see actions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : data?.tree.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                No business units defined
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first business unit to start building your
                organizational hierarchy.
              </p>
              <Button onClick={() => openCreateForm()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Business Unit
              </Button>
            </div>
          ) : (
            <div className="space-y-1">
              {data?.tree.map((node) => renderTreeNode(node))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingBU ? "Edit Business Unit" : "Add Business Unit"}
            </DialogTitle>
            <DialogDescription>
              {editingBU
                ? "Update the business unit details."
                : "Create a new business unit in your organizational hierarchy."}
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
                placeholder="e.g., Engineering, Finance"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">Code (optional)</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) =>
                  setFormData({ ...formData, code: e.target.value })
                }
                placeholder="e.g., ENG, FIN"
                maxLength={20}
              />
              <p className="text-xs text-muted-foreground">
                Short code for quick reference (max 20 characters)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="parent">Parent Unit</Label>
              <Select
                value={formData.parentId}
                onValueChange={(value) =>
                  setFormData({ ...formData, parentId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="None (Top Level)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None (Top Level)</SelectItem>
                  {parentOptions?.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Maximum hierarchy depth is 5 levels
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
              {editingBU ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deletingBU?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteCheck?.canDelete ? (
                "This action cannot be undone. The business unit will be permanently removed."
              ) : (
                <span className="text-destructive">{deleteCheck?.reason}</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={!deleteCheck?.canDelete || deleteMutation.isPending}
              className={!deleteCheck?.canDelete ? "opacity-50 cursor-not-allowed" : ""}
            >
              {deleteMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
