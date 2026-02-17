"use client";

/**
 * Base Mappings Panel
 *
 * Main panel for base-centric control mapping feature:
 * - Select base (framework OR standard)
 * - View base controls with their mapped source controls
 * - Add/edit/delete mappings
 * - Coverage statistics and gap analysis
 */

import { useState, useMemo, useEffect } from "react";
import { api } from "@/trpc/react";
import { BaseType, FrameworkMappingType } from "@prisma/client";
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
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Loader2,
  Target,
  CheckCircle2,
  AlertTriangle,
  Download,
  Plus,
  Search,
  X,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { AddMappingDialog } from "./AddMappingDialog";
import { ControlDomainSelect } from "@/components/taxonomy/ControlDomainSelect";
import { cn } from "@/lib/utils";

// Domain color mapping for badges
const DOMAIN_COLORS: Record<string, string> = {
  ACCESS_CONTROL: "bg-blue-100 text-blue-800 border-blue-200",
  AUTHENTICATION: "bg-purple-100 text-purple-800 border-purple-200",
  DATA_PROTECTION: "bg-green-100 text-green-800 border-green-200",
  ENCRYPTION: "bg-yellow-100 text-yellow-800 border-yellow-200",
  NETWORK_SECURITY: "bg-red-100 text-red-800 border-red-200",
  LOGGING_MONITORING: "bg-indigo-100 text-indigo-800 border-indigo-200",
  INCIDENT_RESPONSE: "bg-orange-100 text-orange-800 border-orange-200",
  BUSINESS_CONTINUITY: "bg-teal-100 text-teal-800 border-teal-200",
  PHYSICAL_SECURITY: "bg-gray-100 text-gray-800 border-gray-200",
  THIRD_PARTY_RISK: "bg-pink-100 text-pink-800 border-pink-200",
  SECURITY_AWARENESS: "bg-cyan-100 text-cyan-800 border-cyan-200",
  CHANGE_MANAGEMENT: "bg-lime-100 text-lime-800 border-lime-200",
};

type FilterMode = "all" | "mapped" | "unmapped";

// Mapping type badge variant
function getMappingTypeBadge(type: FrameworkMappingType) {
  switch (type) {
    case "COVERS":
      return { variant: "default" as const, className: "bg-green-100 text-green-800 border-green-200" };
    case "PARTIAL":
      return { variant: "secondary" as const, className: "bg-yellow-100 text-yellow-800 border-yellow-200" };
    case "EXCEEDS":
      return { variant: "secondary" as const, className: "bg-blue-100 text-blue-800 border-blue-200" };
    default:
      return { variant: "secondary" as const, className: "" };
  }
}

export function BaseMappingsPanel() {
  const [showChangeBaseDialog, setShowChangeBaseDialog] = useState(false);
  const [pendingBase, setPendingBase] = useState<{ type: BaseType; id: string } | null>(null);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [page, setPage] = useState(1);
  const [selectedControlId, setSelectedControlId] = useState<string | null>(null);
  const [editingMapping, setEditingMapping] = useState<{
    id: string;
    mappingType: FrameworkMappingType;
    notes: string | null;
  } | null>(null);
  const [deletingMappingId, setDeletingMappingId] = useState<string | null>(null);
  // Local state for base type selection (allows switching before selecting a base)
  const [selectedBaseType, setSelectedBaseType] = useState<BaseType>(BaseType.FRAMEWORK);
  // Domain filter
  const [filterDomainIds, setFilterDomainIds] = useState<string[]>([]);
  // Control tagging dialog
  const [taggingControlId, setTaggingControlId] = useState<string | null>(null);
  const [taggingControlDomains, setTaggingControlDomains] = useState<string[]>([]);
  const pageSize = 25;

  const utils = api.useUtils();

  // Fetch current base
  const { data: base, isLoading: baseLoading } =
    api.baseFrameworkMapping.getBase.useQuery();

  // Fetch active frameworks for base selection
  const { data: frameworksData } = api.framework.list.useQuery({
    isActive: true,
    includeControlCount: true,
  });

  // Fetch standards for base selection
  const { data: standardsData } = api.standard.list.useQuery({});

  // Sync local base type state with server state
  useEffect(() => {
    if (base?.baseType) {
      setSelectedBaseType(base.baseType);
    }
  }, [base?.baseType]);

  // Fetch base controls with mappings
  const { data: baseControlsData, isLoading: controlsLoading } =
    api.baseFrameworkMapping.getBaseControlsWithMappings.useQuery(
      {
        search: search || undefined,
        page,
        pageSize,
        showMappedOnly: filterMode === "mapped" ? true : undefined,
        showUnmappedOnly: filterMode === "unmapped" ? true : undefined,
        domainIds: filterDomainIds.length > 0 ? filterDomainIds : undefined,
      },
      { enabled: !!base }
    );

  // Fetch coverage statistics
  const { data: coverageStats } =
    api.baseFrameworkMapping.getCoverageStatistics.useQuery(undefined, {
      enabled: !!base,
    });

  // Set base mutation
  const setBaseMutation = api.baseFrameworkMapping.setBase.useMutation({
    onSuccess: () => {
      void utils.baseFrameworkMapping.invalidate();
      setShowChangeBaseDialog(false);
      setPendingBase(null);
      setPage(1);
    },
  });

  // Clear base mutation
  const clearBaseMutation = api.baseFrameworkMapping.clearBase.useMutation({
    onSuccess: () => {
      void utils.baseFrameworkMapping.invalidate();
      setPage(1);
    },
  });

  // Update mapping mutation
  const updateMappingMutation = api.baseFrameworkMapping.updateMapping.useMutation({
    onSuccess: () => {
      void utils.baseFrameworkMapping.invalidate();
      setEditingMapping(null);
    },
  });

  // Delete mapping mutation
  const deleteMappingMutation = api.baseFrameworkMapping.deleteMapping.useMutation({
    onSuccess: () => {
      void utils.baseFrameworkMapping.invalidate();
      setDeletingMappingId(null);
    },
  });

  // Set control domains mutation (for framework controls)
  const setControlDomainsMutation = api.controlDomain.setControlDomains.useMutation({
    onSuccess: () => {
      void utils.baseFrameworkMapping.invalidate();
      setTaggingControlId(null);
      setTaggingControlDomains([]);
    },
  });

  // Set standard control domains mutation
  const setStandardControlDomainsMutation = api.controlDomain.setStandardControlDomains.useMutation({
    onSuccess: () => {
      void utils.baseFrameworkMapping.invalidate();
      setTaggingControlId(null);
      setTaggingControlDomains([]);
    },
  });

  // Export mappings
  const { refetch: exportMappings, isFetching: isExporting } =
    api.baseFrameworkMapping.exportMappings.useQuery(
      { frameworkId: undefined },
      { enabled: false }
    );

  const handleExport = async () => {
    const result = await exportMappings();
    if (result.data?.content) {
      const blob = new Blob([result.data.content], { type: result.data.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.data.filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleSetBase = (type: BaseType, id: string) => {
    if (base) {
      // Changing base - show confirmation
      setPendingBase({ type, id });
      setShowChangeBaseDialog(true);
    } else {
      // Setting base for first time
      setBaseMutation.mutate({ baseType: type, baseId: id });
    }
  };

  const confirmChangeBase = () => {
    if (pendingBase) {
      setBaseMutation.mutate({ baseType: pendingBase.type, baseId: pendingBase.id });
    }
  };

  // Selected control for add mapping dialog
  const selectedControl = useMemo(() => {
    if (!selectedControlId || !baseControlsData) return null;
    return baseControlsData.controls.find((c) => c.id === selectedControlId);
  }, [selectedControlId, baseControlsData]);

  const isLoading = baseLoading || controlsLoading;

  return (
    <div className="space-y-6">
      {/* Base Selector */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Base Selection
              </CardTitle>
              <CardDescription>
                Select a framework or standard as your base for control mappings
              </CardDescription>
            </div>
            {base && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => clearBaseMutation.mutate()}
                disabled={clearBaseMutation.isPending}
              >
                <X className="h-4 w-4 mr-2" />
                Clear Base
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {baseLoading ? (
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : (
            <div className="space-y-4">
              {/* Base Type Selection */}
              <RadioGroup
                value={selectedBaseType}
                onValueChange={(value: BaseType) => {
                  setSelectedBaseType(value);
                  // Clear current base when switching type
                  if (base && value !== base.baseType) {
                    clearBaseMutation.mutate();
                  }
                }}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value={BaseType.FRAMEWORK} id="base-framework" />
                  <Label htmlFor="base-framework">Framework</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value={BaseType.STANDARD} id="base-standard" />
                  <Label htmlFor="base-standard">Standard</Label>
                </div>
              </RadioGroup>

              {/* Framework/Standard Selector */}
              <div className="flex items-center gap-4">
                {selectedBaseType === BaseType.FRAMEWORK && (
                  <Select
                    value={base?.baseType === BaseType.FRAMEWORK ? base.id : ""}
                    onValueChange={(id) => handleSetBase(BaseType.FRAMEWORK, id)}
                    disabled={setBaseMutation.isPending}
                  >
                    <SelectTrigger className="w-[400px]">
                      <SelectValue placeholder="Select a framework..." />
                    </SelectTrigger>
                    <SelectContent>
                      {frameworksData?.map((fw) => (
                        <SelectItem key={fw.id} value={fw.id}>
                          {fw.name} ({fw.code} v{fw.version})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {selectedBaseType === BaseType.STANDARD && (
                  <Select
                    value={base?.baseType === BaseType.STANDARD ? base.id : ""}
                    onValueChange={(id) => handleSetBase(BaseType.STANDARD, id)}
                    disabled={setBaseMutation.isPending}
                  >
                    <SelectTrigger className="w-[400px]">
                      <SelectValue placeholder="Select a standard..." />
                    </SelectTrigger>
                    <SelectContent>
                      {standardsData?.standards.map((std) => (
                        <SelectItem key={std.id} value={std.id}>
                          {std.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {base && (
                  <Badge variant="secondary" className="text-sm">
                    {base.controlCount} controls
                  </Badge>
                )}
                {setBaseMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Show rest only if base is set */}
      {base ? (
        <>
          {/* Coverage Statistics */}
          {coverageStats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Base Controls</p>
                      <p className="text-2xl font-semibold">
                        {coverageStats.totalBaseControls}
                      </p>
                    </div>
                    <Target className="h-8 w-8 text-gray-400" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Covered</p>
                      <p className="text-2xl font-semibold text-green-600">
                        {coverageStats.coveredControls}
                      </p>
                    </div>
                    <CheckCircle2 className="h-8 w-8 text-green-400" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Gaps</p>
                      <p className="text-2xl font-semibold text-orange-600">
                        {coverageStats.uncoveredControls}
                      </p>
                    </div>
                    <AlertTriangle className="h-8 w-8 text-orange-400" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div>
                    <p className="text-sm text-gray-500 mb-2">Coverage</p>
                    <div className="flex items-center gap-3">
                      <Progress
                        value={coverageStats.coveragePercentage}
                        className="flex-1"
                      />
                      <span className="text-xl font-semibold">
                        {coverageStats.coveragePercentage}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Filters and Actions Bar */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search controls..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>

            <Select
              value={filterMode}
              onValueChange={(value: FilterMode) => {
                setFilterMode(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Controls</SelectItem>
                <SelectItem value="mapped">Mapped Only</SelectItem>
                <SelectItem value="unmapped">Unmapped Only</SelectItem>
              </SelectContent>
            </Select>

            {/* Domain Filter */}
            <div className="w-[200px]">
              <ControlDomainSelect
                mode="multi"
                values={filterDomainIds}
                onChangeMulti={(values) => {
                  setFilterDomainIds(values);
                  setPage(1);
                }}
                placeholder="Filter by domain..."
                showTooltips={false}
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Export CSV
            </Button>
          </div>

          {/* Base Controls Table */}
          <Card>
            <CardHeader>
              <CardTitle>Base Controls</CardTitle>
              <CardDescription>
                {base.name} - {base.controlCount} controls
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : baseControlsData?.controls.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p>No controls found matching your criteria.</p>
                </div>
              ) : (
                <>
                  <div className="overflow-hidden rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[100px]">ID</TableHead>
                          <TableHead className="w-[150px]">Name</TableHead>
                          <TableHead className="w-[200px]">Description</TableHead>
                          <TableHead className="w-[150px]">Domains</TableHead>
                          <TableHead>Mapped Controls</TableHead>
                          <TableHead className="w-[80px] text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {baseControlsData?.controls.map((control) => (
                          <TableRow key={control.id}>
                            <TableCell className="font-mono text-sm">
                              {control.controlId}
                            </TableCell>
                            <TableCell className="font-medium">
                              {control.title}
                            </TableCell>
                            <TableCell className="text-sm text-gray-600">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="line-clamp-2 cursor-help">
                                      {control.description || "-"}
                                    </span>
                                  </TooltipTrigger>
                                  {control.description && (
                                    <TooltipContent className="max-w-md">
                                      <p>{control.description}</p>
                                    </TooltipContent>
                                  )}
                                </Tooltip>
                              </TooltipProvider>
                            </TableCell>
                            <TableCell>
                              {control.domains && control.domains.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {control.domains.map((domain) => (
                                    <Badge
                                      key={domain.id}
                                      variant="outline"
                                      className={cn(
                                        "text-xs cursor-pointer",
                                        DOMAIN_COLORS[domain.code] || "bg-gray-100 text-gray-800"
                                      )}
                                      onClick={() => {
                                        setTaggingControlId(control.id);
                                        setTaggingControlDomains(control.domains?.map((d) => d.id) ?? []);
                                      }}
                                    >
                                      {domain.code.replace(/_/g, " ")}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs text-gray-400 hover:text-gray-600"
                                  onClick={() => {
                                    setTaggingControlId(control.id);
                                    setTaggingControlDomains([]);
                                  }}
                                >
                                  + Add tags
                                </Button>
                              )}
                            </TableCell>
                            <TableCell>
                              {control.mappings.length === 0 ? (
                                <span className="text-gray-400">No mappings</span>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {control.mappings.map((mapping) => {
                                    const badgeStyle = getMappingTypeBadge(mapping.mappingType);
                                    return (
                                      <TooltipProvider key={mapping.id}>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Badge
                                              variant={badgeStyle.variant}
                                              className={cn(
                                                "cursor-pointer text-xs",
                                                badgeStyle.className
                                              )}
                                            >
                                              {mapping.sourceFramework?.code ?? "STD"}:{" "}
                                              {mapping.sourceControl.controlId}
                                              <span className="ml-1 opacity-70">
                                                ({mapping.mappingType})
                                              </span>
                                            </Badge>
                                          </TooltipTrigger>
                                          <TooltipContent className="max-w-sm">
                                            <div className="space-y-1">
                                              <p className="font-medium">
                                                {mapping.sourceFramework?.name ?? "Standard Control"}
                                              </p>
                                              <p>
                                                {mapping.sourceControl.controlId} -{" "}
                                                {mapping.sourceControl.title}
                                              </p>
                                              <p className="text-xs opacity-80">
                                                Type: {mapping.mappingType}
                                              </p>
                                              {mapping.notes && (
                                                <p className="text-xs opacity-80">
                                                  Notes: {mapping.notes}
                                                </p>
                                              )}
                                              <div className="flex gap-2 pt-2">
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-6 text-xs"
                                                  onClick={() =>
                                                    setEditingMapping({
                                                      id: mapping.id,
                                                      mappingType: mapping.mappingType,
                                                      notes: mapping.notes,
                                                    })
                                                  }
                                                >
                                                  <Pencil className="h-3 w-3 mr-1" />
                                                  Edit
                                                </Button>
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-6 text-xs text-red-600 hover:text-red-700"
                                                  onClick={() =>
                                                    setDeletingMappingId(mapping.id)
                                                  }
                                                >
                                                  <Trash2 className="h-3 w-3 mr-1" />
                                                  Delete
                                                </Button>
                                              </div>
                                            </div>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    );
                                  })}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedControlId(control.id)}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  {baseControlsData && baseControlsData.pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-sm text-gray-500">
                        Page {baseControlsData.pagination.page} of{" "}
                        {baseControlsData.pagination.totalPages} ({baseControlsData.pagination.total}{" "}
                        total)
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={page === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setPage((p) =>
                              Math.min(baseControlsData.pagination.totalPages, p + 1)
                            )
                          }
                          disabled={page === baseControlsData.pagination.totalPages}
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <Target className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">No Base Selected</p>
            <p className="text-sm mt-2">
              Select a framework or standard above to start mapping controls.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Add Mapping Dialog */}
      {selectedControl && base && (
        <AddMappingDialog
          open={!!selectedControlId}
          onOpenChange={(open) => !open && setSelectedControlId(null)}
          baseControl={{
            id: selectedControl.id,
            controlId: selectedControl.controlId,
            title: selectedControl.title,
            description: selectedControl.description,
          }}
          baseType={base.baseType}
        />
      )}

      {/* Edit Mapping Dialog */}
      {editingMapping && (
        <AlertDialog open={!!editingMapping} onOpenChange={(open) => !open && setEditingMapping(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Edit Mapping</AlertDialogTitle>
              <AlertDialogDescription>
                Update the mapping type or notes.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Mapping Type</Label>
                <Select
                  value={editingMapping.mappingType}
                  onValueChange={(value: FrameworkMappingType) =>
                    setEditingMapping((prev) =>
                      prev ? { ...prev, mappingType: value } : null
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COVERS">COVERS - Fully covers</SelectItem>
                    <SelectItem value="PARTIAL">PARTIAL - Partially covers</SelectItem>
                    <SelectItem value="EXCEEDS">EXCEEDS - Exceeds requirements</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Input
                  value={editingMapping.notes ?? ""}
                  onChange={(e) =>
                    setEditingMapping((prev) =>
                      prev ? { ...prev, notes: e.target.value || null } : null
                    )
                  }
                  placeholder="Add notes..."
                />
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  updateMappingMutation.mutate({
                    id: editingMapping.id,
                    mappingType: editingMapping.mappingType,
                    notes: editingMapping.notes,
                  })
                }
                disabled={updateMappingMutation.isPending}
              >
                {updateMappingMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Save Changes
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Delete Mapping Confirmation */}
      <AlertDialog
        open={!!deletingMappingId}
        onOpenChange={(open) => !open && setDeletingMappingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Mapping?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the mapping. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() =>
                deletingMappingId && deleteMappingMutation.mutate({ id: deletingMappingId })
              }
              disabled={deleteMappingMutation.isPending}
            >
              {deleteMappingMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Change Base Confirmation Dialog */}
      <AlertDialog open={showChangeBaseDialog} onOpenChange={setShowChangeBaseDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change Base?</AlertDialogTitle>
            <AlertDialogDescription>
              Changing the base will affect how mappings are interpreted.
              Existing mappings will remain but may need to be reviewed. Are you sure
              you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingBase(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmChangeBase}>
              Change Base
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Domain Tagging Dialog */}
      <AlertDialog
        open={!!taggingControlId}
        onOpenChange={(open) => {
          if (!open) {
            setTaggingControlId(null);
            setTaggingControlDomains([]);
          }
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Tag Control with Domains</AlertDialogTitle>
            <AlertDialogDescription>
              Select control domains to categorize this control. This helps with filtering and reporting.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <ControlDomainSelect
              mode="multi"
              values={taggingControlDomains}
              onChangeMulti={setTaggingControlDomains}
              placeholder="Select domains..."
              showTooltips={true}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (taggingControlId && base) {
                  if (base.baseType === BaseType.FRAMEWORK) {
                    setControlDomainsMutation.mutate({
                      controlId: taggingControlId,
                      domainIds: taggingControlDomains,
                    });
                  } else {
                    setStandardControlDomainsMutation.mutate({
                      standardControlId: taggingControlId,
                      domainIds: taggingControlDomains,
                    });
                  }
                }
              }}
              disabled={setControlDomainsMutation.isPending || setStandardControlDomainsMutation.isPending}
            >
              {(setControlDomainsMutation.isPending || setStandardControlDomainsMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Save Domains
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
