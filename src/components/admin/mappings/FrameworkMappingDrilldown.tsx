"use client";

/**
 * Framework Mapping Drilldown
 *
 * Detailed view for mapping controls from a source framework
 * to the base framework.
 */

import { useState } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  ArrowLeft,
  Search,
  Link2,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { FrameworkMappingType } from "@prisma/client";

interface FrameworkMappingDrilldownProps {
  frameworkId: string;
  frameworkName: string;
  frameworkCode: string;
  onBack: () => void;
}

type MappingDialogMode = "create" | "edit" | null;

interface MappingDialogState {
  mode: MappingDialogMode;
  sourceControlId: string;
  sourceControlName: string;
  mappingId?: string;
  targetControlId: string;
  mappingType: FrameworkMappingType;
  confidence: number;
  notes: string;
}

export function FrameworkMappingDrilldown({
  frameworkId,
  frameworkName,
  frameworkCode,
  onBack,
}: FrameworkMappingDrilldownProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [mappingDialog, setMappingDialog] = useState<MappingDialogState | null>(null);
  const [targetSearch, setTargetSearch] = useState("");

  const utils = api.useUtils();

  // Fetch source controls with mapping status
  const { data: controlsData, isLoading } =
    api.baseFrameworkMapping.getSourceControlsWithMappingStatus.useQuery({
      frameworkId,
      search: searchTerm || undefined,
      page,
      pageSize: 50,
    });

  // Fetch base controls for target selection
  const { data: baseControls } = api.baseFrameworkMapping.getBaseControls.useQuery({
    search: targetSearch || undefined,
  });

  // Create mapping mutation
  const createMapping = api.baseFrameworkMapping.createMapping.useMutation({
    onSuccess: () => {
      void utils.baseFrameworkMapping.getSourceControlsWithMappingStatus.invalidate();
      void utils.baseFrameworkMapping.listMappingSummary.invalidate();
      void utils.baseFrameworkMapping.getCoverageStatistics.invalidate();
      setMappingDialog(null);
    },
  });

  // Update mapping mutation
  const updateMapping = api.baseFrameworkMapping.updateMapping.useMutation({
    onSuccess: () => {
      void utils.baseFrameworkMapping.getSourceControlsWithMappingStatus.invalidate();
      setMappingDialog(null);
    },
  });

  // Delete mapping mutation
  const deleteMapping = api.baseFrameworkMapping.deleteMapping.useMutation({
    onSuccess: () => {
      void utils.baseFrameworkMapping.getSourceControlsWithMappingStatus.invalidate();
      void utils.baseFrameworkMapping.listMappingSummary.invalidate();
      void utils.baseFrameworkMapping.getCoverageStatistics.invalidate();
    },
  });

  const openCreateDialog = (sourceControlId: string, sourceControlName: string) => {
    setMappingDialog({
      mode: "create",
      sourceControlId,
      sourceControlName,
      targetControlId: "",
      mappingType: FrameworkMappingType.COVERS,
      confidence: 100,
      notes: "",
    });
    setTargetSearch("");
  };

  const openEditDialog = (
    sourceControlId: string,
    sourceControlName: string,
    mapping: {
      id: string;
      targetControlId: string;
      mappingType: FrameworkMappingType;
      confidence: number;
      TargetControl: { controlId: string; title: string };
    }
  ) => {
    setMappingDialog({
      mode: "edit",
      sourceControlId,
      sourceControlName,
      mappingId: mapping.id,
      targetControlId: mapping.targetControlId,
      mappingType: mapping.mappingType,
      confidence: mapping.confidence,
      notes: "",
    });
  };

  const handleSaveMapping = () => {
    if (!mappingDialog) return;

    if (mappingDialog.mode === "create") {
      createMapping.mutate({
        sourceControlId: mappingDialog.sourceControlId,
        targetControlId: mappingDialog.targetControlId,
        mappingType: mappingDialog.mappingType,
        confidence: mappingDialog.confidence,
        notes: mappingDialog.notes || null,
      });
    } else if (mappingDialog.mode === "edit" && mappingDialog.mappingId) {
      updateMapping.mutate({
        id: mappingDialog.mappingId,
        mappingType: mappingDialog.mappingType,
        confidence: mappingDialog.confidence,
        notes: mappingDialog.notes || null,
      });
    }
  };

  const handleDeleteMapping = (mappingId: string) => {
    if (confirm("Are you sure you want to delete this mapping?")) {
      deleteMapping.mutate({ id: mappingId });
    }
  };

  const getMappingTypeBadgeVariant = (type: FrameworkMappingType) => {
    switch (type) {
      case FrameworkMappingType.COVERS:
        return "default";
      case FrameworkMappingType.PARTIAL:
        return "secondary";
      case FrameworkMappingType.EXCEEDS:
        return "outline";
      default:
        return "secondary";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h2 className="text-xl font-semibold">
            {frameworkName} ({frameworkCode})
          </h2>
          <p className="text-sm text-gray-500">
            Map controls from this framework to the base framework
          </p>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search controls..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Controls Table */}
      <Card>
        <CardHeader>
          <CardTitle>Source Controls</CardTitle>
          <CardDescription>
            {controlsData?.pagination.total ?? 0} controls in {frameworkName}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              <div className="overflow-hidden rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[150px]">Control ID</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Mapped To</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {controlsData?.controls.map((control) => (
                      <TableRow key={control.id}>
                        <TableCell className="font-mono text-sm">
                          {control.controlId}
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate">
                          {control.title}
                        </TableCell>
                        <TableCell>
                          {control.isMapped ? (
                            <Badge variant="default" className="gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Mapped
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              <XCircle className="h-3 w-3" />
                              Not Mapped
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {control.mappings.length > 0 ? (
                            <div className="space-y-1">
                              {control.mappings.map((mapping) => (
                                <div
                                  key={mapping.id}
                                  className="flex items-center gap-2 text-sm"
                                >
                                  <code className="text-xs bg-gray-100 px-1 rounded">
                                    {mapping.TargetControl.controlId}
                                  </code>
                                  <Badge
                                    variant={getMappingTypeBadgeVariant(
                                      mapping.mappingType
                                    )}
                                    className="text-xs"
                                  >
                                    {mapping.mappingType}
                                  </Badge>
                                  <span className="text-gray-500 text-xs">
                                    {mapping.confidence}%
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={() =>
                                      openEditDialog(
                                        control.id,
                                        `${control.controlId} - ${control.title}`,
                                        mapping
                                      )
                                    }
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                    onClick={() => handleDeleteMapping(mapping.id)}
                                    disabled={deleteMapping.isPending}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              openCreateDialog(
                                control.id,
                                `${control.controlId} - ${control.title}`
                              )
                            }
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Mapping
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {controlsData && controlsData.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-gray-500">
                    Page {page} of {controlsData.pagination.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPage((p) =>
                          Math.min(controlsData.pagination.totalPages, p + 1)
                        )
                      }
                      disabled={page === controlsData.pagination.totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Mapping Dialog */}
      <Dialog
        open={!!mappingDialog}
        onOpenChange={(open) => !open && setMappingDialog(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              {mappingDialog?.mode === "create" ? "Create Mapping" : "Edit Mapping"}
            </DialogTitle>
            <DialogDescription>
              {mappingDialog?.sourceControlName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Target Control Selection (only for create) */}
            {mappingDialog?.mode === "create" && (
              <div className="space-y-2">
                <Label>Target Base Control</Label>
                <div className="space-y-2">
                  <Input
                    placeholder="Search base controls..."
                    value={targetSearch}
                    onChange={(e) => setTargetSearch(e.target.value)}
                  />
                  <Select
                    value={mappingDialog.targetControlId}
                    onValueChange={(value) =>
                      setMappingDialog((prev) =>
                        prev ? { ...prev, targetControlId: value } : null
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a base control..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {baseControls?.map((control) => (
                        <SelectItem key={control.id} value={control.id}>
                          <span className="font-mono text-xs mr-2">
                            {control.controlId}
                          </span>
                          <span className="text-sm truncate">
                            {control.title}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Mapping Type */}
            <div className="space-y-2">
              <Label>Mapping Type</Label>
              <Select
                value={mappingDialog?.mappingType}
                onValueChange={(value) =>
                  setMappingDialog((prev) =>
                    prev
                      ? { ...prev, mappingType: value as FrameworkMappingType }
                      : null
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FrameworkMappingType.COVERS}>
                    COVERS - Source fully covers base control
                  </SelectItem>
                  <SelectItem value={FrameworkMappingType.PARTIAL}>
                    PARTIAL - Source partially covers base control
                  </SelectItem>
                  <SelectItem value={FrameworkMappingType.EXCEEDS}>
                    EXCEEDS - Source exceeds base control requirements
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Confidence */}
            <div className="space-y-2">
              <Label htmlFor="confidence">Confidence (%)</Label>
              <Input
                id="confidence"
                type="number"
                min={0}
                max={100}
                value={mappingDialog?.confidence ?? 100}
                onChange={(e) =>
                  setMappingDialog((prev) =>
                    prev
                      ? {
                          ...prev,
                          confidence: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)),
                        }
                      : null
                  )
                }
                className="w-[100px]"
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Add any notes about this mapping..."
                value={mappingDialog?.notes ?? ""}
                onChange={(e) =>
                  setMappingDialog((prev) =>
                    prev ? { ...prev, notes: e.target.value } : null
                  )
                }
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMappingDialog(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveMapping}
              disabled={
                createMapping.isPending ||
                updateMapping.isPending ||
                (mappingDialog?.mode === "create" && !mappingDialog?.targetControlId)
              }
            >
              {(createMapping.isPending || updateMapping.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {mappingDialog?.mode === "create" ? "Create Mapping" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
