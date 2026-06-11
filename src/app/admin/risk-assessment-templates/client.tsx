"use client";

import { useState } from "react";
import Link from "next/link";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  ClipboardList,
  ExternalLink,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { CsvImportDialog } from "./csv-import-dialog";

type FormState = { name: string; description: string };
const EMPTY: FormState = { name: "", description: "" };

export function RiskAssessmentTemplatesClient() {
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<{
    id: string;
    name: string;
    description: string | null;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
    instanceCount: number;
  } | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);

  const utils = api.useUtils();
  const { data: templates, isLoading, error } =
    api.riskAssessmentTemplate.list.useQuery({ includeInactive: false });

  const createMutation = api.riskAssessmentTemplate.create.useMutation({
    onSuccess: () => {
      void utils.riskAssessmentTemplate.list.invalidate();
      toast.success("Template created");
      setCreateOpen(false);
      setForm(EMPTY);
    },
    onError: (e) => toast.error(`Failed to create: ${e.message}`),
  });

  const updateMutation = api.riskAssessmentTemplate.update.useMutation({
    onSuccess: () => {
      void utils.riskAssessmentTemplate.list.invalidate();
      toast.success("Template updated");
      setEditTarget(null);
      setForm(EMPTY);
    },
    onError: (e) => toast.error(`Failed to update: ${e.message}`),
  });

  const deleteMutation = api.riskAssessmentTemplate.delete.useMutation({
    onSuccess: (res) => {
      void utils.riskAssessmentTemplate.list.invalidate();
      toast.success(res.soft ? "Template deactivated (had instances)" : "Template deleted");
      setDeleteTarget(null);
    },
    onError: (e) => toast.error(`Failed to delete: ${e.message}`),
  });

  const handleCreate = () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    createMutation.mutate({
      name: form.name.trim(),
      description: form.description.trim() || null,
    });
  };

  const handleUpdate = () => {
    if (!editTarget) return;
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    updateMutation.mutate({
      id: editTarget.id,
      name: form.name.trim(),
      description: form.description.trim() || null,
    });
  };

  return (
    <AppLayout breadcrumbs={[{ label: "Administration" }, { label: "RA Templates" }]}>
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          eyebrow="ADMINISTRATION"
          title="Risk Assessment Templates"
          icon={<ClipboardList />}
          description="Reusable questionnaires that can be cloned into a risk assessment. Pick a template when creating an assessment to seed its questions."
          actions={
            <>
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Import CSV
              </Button>
              <Button
                onClick={() => {
                  setForm(EMPTY);
                  setCreateOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                New Template
              </Button>
            </>
          }
        />

        <CsvImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          existingTemplates={templates?.map((t) => ({ id: t.id, name: t.name })) ?? []}
        />

        <Card>
          <CardHeader>
            <CardTitle>Templates</CardTitle>
            <CardDescription>
              Each template has sections and questions. Click a template name to manage
              its content.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="text-destructive">Error: {error.message}</div>
            ) : isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !templates || templates.length === 0 ? (
              <div className="text-center py-12">
                <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No templates yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Create a template to start building reusable risk-assessment questionnaires.
                </p>
                <Button
                  onClick={() => {
                    setForm(EMPTY);
                    setCreateOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Template
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Name</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Description</TableHead>
                    <TableHead className="text-center font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Sections</TableHead>
                    <TableHead className="text-center font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Questions</TableHead>
                    <TableHead className="text-center font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">In Use</TableHead>
                    <TableHead className="text-right font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((t) => (
                    <TableRow key={t.id} className="hover:bg-secondary">
                      <TableCell className="font-semibold text-foreground">
                        <Link
                          href={`/admin/risk-assessment-templates/${t.id}`}
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          {t.name}
                          <ExternalLink className="h-3 w-3 text-muted-foreground/70" />
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-md">
                        <span className="text-muted-foreground line-clamp-2">
                          {t.description ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-center tnum">
                        <Badge variant="code">{t.sectionCount}</Badge>
                      </TableCell>
                      <TableCell className="text-center tnum">
                        <Badge variant="code">{t.questionCount}</Badge>
                      </TableCell>
                      <TableCell className="text-center tnum">
                        <Badge variant={t.instanceCount > 0 ? "info" : "neutral"}>
                          {t.instanceCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground/70"
                            onClick={() => {
                              setEditTarget({
                                id: t.id,
                                name: t.name,
                                description: t.description,
                              });
                              setForm({ name: t.name, description: t.description ?? "" });
                            }}
                            title="Edit metadata"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground/70 hover:text-destructive"
                            onClick={() =>
                              setDeleteTarget({
                                id: t.id,
                                name: t.name,
                                instanceCount: t.instanceCount,
                              })
                            }
                            title="Delete"
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

        <Dialog
          open={createOpen || editTarget !== null}
          onOpenChange={(open) => {
            if (!open) {
              setCreateOpen(false);
              setEditTarget(null);
              setForm(EMPTY);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editTarget ? "Edit Template" : "New Template"}
              </DialogTitle>
              <DialogDescription>
                {editTarget
                  ? "Update the template's name and description."
                  : "Create a new risk-assessment questionnaire template. You'll add sections and questions next."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., NIST 800-53 Moderate Baseline"
                  maxLength={255}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  rows={3}
                  maxLength={2000}
                  placeholder="Optional context for assessors"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setCreateOpen(false);
                  setEditTarget(null);
                  setForm(EMPTY);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={editTarget ? handleUpdate : handleCreate}
                disabled={
                  !form.name.trim() ||
                  createMutation.isPending ||
                  updateMutation.isPending
                }
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {editTarget ? "Save Changes" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog
          open={deleteTarget !== null}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteTarget && deleteTarget.instanceCount > 0
                  ? `This template has been cloned into ${deleteTarget.instanceCount} risk assessment${deleteTarget.instanceCount > 1 ? "s" : ""}. It will be deactivated (existing assessments keep their snapshot). It will no longer appear in the template picker.`
                  : "This template has not been used. It will be permanently deleted along with all its sections and questions."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  deleteTarget && deleteMutation.mutate({ id: deleteTarget.id })
                }
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {deleteTarget && deleteTarget.instanceCount > 0
                  ? "Deactivate"
                  : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
