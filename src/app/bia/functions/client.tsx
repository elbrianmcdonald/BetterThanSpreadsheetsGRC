"use client";

/**
 * Business Functions Client Component
 *
 * Epic 10: BIA Core Module
 * Story 10.1: Business Function Data Model & CRUD
 *
 * Features:
 * - List all business functions
 * - Create new business functions
 * - Edit existing business functions
 * - Delete business functions (if no child processes)
 */

import { useState } from "react";
import { AppLayout, PageHeader, StatTile } from "@/components/layout";
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
  Trash2,
  Activity,
  FolderTree,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface BusinessFunction {
  id: string;
  identifier: string;
  name: string;
  description: string | null;
  isActive: boolean;
  processCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export function BusinessFunctionsClient() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingFunction, setEditingFunction] = useState<BusinessFunction | null>(null);
  const [deletingFunction, setDeletingFunction] = useState<BusinessFunction | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });

  const utils = api.useUtils();

  // Queries
  const { data: functions, isLoading, error } = api.businessFunction.list.useQuery({
    includeInactive: showInactive,
  });

  const { data: deleteCheck } = api.businessFunction.canDelete.useQuery(
    { id: deletingFunction?.id ?? "" },
    { enabled: !!deletingFunction }
  );

  // Mutations
  const createMutation = api.businessFunction.create.useMutation({
    onSuccess: () => {
      void utils.businessFunction.list.invalidate();
      toast.success("Business function created");
      closeForm();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateMutation = api.businessFunction.update.useMutation({
    onSuccess: () => {
      void utils.businessFunction.list.invalidate();
      toast.success("Business function updated");
      closeForm();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = api.businessFunction.delete.useMutation({
    onSuccess: () => {
      void utils.businessFunction.list.invalidate();
      toast.success("Business function deleted");
      setIsDeleteOpen(false);
      setDeletingFunction(null);
    },
    onError: (error) => toast.error(error.message),
  });

  // Handlers
  const openCreateForm = () => {
    setEditingFunction(null);
    setFormData({ name: "", description: "" });
    setIsFormOpen(true);
  };

  const openEditForm = (fn: BusinessFunction) => {
    setEditingFunction(fn);
    setFormData({
      name: fn.name,
      description: fn.description ?? "",
    });
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingFunction(null);
    setFormData({ name: "", description: "" });
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }

    if (editingFunction) {
      updateMutation.mutate({
        id: editingFunction.id,
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

  // Stats
  const activeCount = functions?.filter((f) => f.isActive).length ?? 0;
  const totalProcesses = functions?.reduce((sum, f) => sum + f.processCount, 0) ?? 0;

  if (error) {
    return (
      <AppLayout breadcrumbs={[{ label: "Business Impact" }, { label: "Business Functions" }]}>
        <div className="px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-destructive">
            Error loading business functions: {error.message}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout breadcrumbs={[{ label: "Business Impact" }, { label: "Business Functions" }]}>
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <PageHeader
          eyebrow="BUSINESS IMPACT"
          title="Business Functions"
          icon={<FolderTree />}
          description="Organize business processes into logical function groups."
          actions={
            <Button onClick={openCreateForm}>
              <Plus className="h-4 w-4 mr-2" />
              Add Function
            </Button>
          }
        />

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <StatTile
            label="Active Functions"
            value={activeCount}
            icon={<FolderTree />}
            tone="success"
            accent
          />
          <StatTile
            label="Total Processes"
            value={totalProcesses}
            icon={<Activity />}
          />
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Functions</CardTitle>
                <CardDescription>
                  Manage business function categories for organizing processes.
                </CardDescription>
              </div>
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
            ) : functions?.length === 0 ? (
              <div className="text-center py-12">
                <FolderTree className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  No business functions defined
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Create your first business function to start organizing processes.
                </p>
                <Button onClick={openCreateForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Function
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                      Identifier
                    </TableHead>
                    <TableHead className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                      Name
                    </TableHead>
                    <TableHead className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                      Description
                    </TableHead>
                    <TableHead className="text-center font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                      Processes
                    </TableHead>
                    <TableHead className="text-center font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                      Status
                    </TableHead>
                    <TableHead className="text-right font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {functions?.map((fn) => (
                    <TableRow key={fn.id} className="hover:bg-secondary">
                      <TableCell className="font-mono text-sm text-muted-foreground">{fn.identifier}</TableCell>
                      <TableCell className="font-semibold text-foreground">{fn.name}</TableCell>
                      <TableCell className="max-w-md">
                        <span className="text-muted-foreground line-clamp-2">
                          {fn.description ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {fn.processCount > 0 ? (
                          <Link
                            href={`/bia/processes?functionId=${fn.id}`}
                            className="text-primary hover:underline"
                          >
                            <Badge variant="info">{fn.processCount}</Badge>
                          </Link>
                        ) : (
                          <Badge variant="outline">0</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={fn.isActive ? "success" : "neutral"}>
                          {fn.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground/70"
                            onClick={() => openEditForm(fn)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground/70 hover:text-destructive"
                            onClick={() => {
                              setDeletingFunction(fn);
                              setIsDeleteOpen(true);
                            }}
                            disabled={fn.processCount > 0}
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
                {editingFunction ? "Edit Business Function" : "Add Business Function"}
              </DialogTitle>
              <DialogDescription>
                {editingFunction
                  ? "Update the business function details."
                  : "Create a new business function to organize processes."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-[12.5px] font-semibold text-secondary-foreground">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Finance, Human Resources, IT Operations"
                  maxLength={200}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-[12.5px] font-semibold text-secondary-foreground">
                  Description
                </Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe this business function..."
                  rows={3}
                  maxLength={2000}
                />
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
                {editingFunction ? "Save Changes" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                Delete Business Function?
              </AlertDialogTitle>
              <AlertDialogDescription>
                {deleteCheck?.canDelete ? (
                  <>
                    Are you sure you want to delete "{deletingFunction?.name}"? This action cannot
                    be undone.
                  </>
                ) : (
                  <span className="text-destructive">{deleteCheck?.reason}</span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeletingFunction(null)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deletingFunction && deleteMutation.mutate({ id: deletingFunction.id })}
                disabled={!deleteCheck?.canDelete || deleteMutation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
