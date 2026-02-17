"use client";

/**
 * Add Mapping Dialog
 *
 * Dialog for adding mappings to a base control:
 * - Shows controls from ALL frameworks and standards at once
 * - Controls grouped by source (framework/standard)
 * - Multi-select across different sources
 * - Set mapping type (applies to all selected)
 * - Optional notes (applies to all selected)
 */

import { useState, useMemo } from "react";
import { api } from "@/trpc/react";
import { BaseType, FrameworkMappingType } from "@prisma/client";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Loader2, Search, CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";

interface AddMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  baseControl: {
    id: string;
    controlId: string;
    title: string;
    description: string | null;
  };
  baseType: BaseType;
}

// Track selected controls with their source info
interface SelectedControl {
  controlId: string;
  sourceType: BaseType;
  sourceId: string;
}

export function AddMappingDialog({
  open,
  onOpenChange,
  baseControl,
}: AddMappingDialogProps) {
  const [selectedControls, setSelectedControls] = useState<Map<string, SelectedControl>>(new Map());
  const [mappingType, setMappingType] = useState<FrameworkMappingType>(
    FrameworkMappingType.COVERS
  );
  const [notes, setNotes] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());

  const utils = api.useUtils();

  // Fetch ALL available source frameworks
  const { data: sourceFrameworks, isLoading: frameworksLoading } =
    api.baseFrameworkMapping.getAvailableSourceFrameworks.useQuery(undefined, {
      enabled: open,
    });

  // Fetch ALL available source standards
  const { data: sourceStandards, isLoading: standardsLoading } =
    api.baseFrameworkMapping.getAvailableSourceStandards.useQuery(undefined, {
      enabled: open,
    });

  // Fetch controls for all frameworks
  const frameworkControlsQueries = api.useQueries((t) =>
    (sourceFrameworks ?? []).map((fw) =>
      t.baseFrameworkMapping.getAvailableSourceControls(
        { sourceType: BaseType.FRAMEWORK, sourceId: fw.id },
        { enabled: open && !!sourceFrameworks }
      )
    )
  );

  // Fetch controls for all standards
  const standardControlsQueries = api.useQueries((t) =>
    (sourceStandards ?? []).map((std) =>
      t.baseFrameworkMapping.getAvailableSourceControls(
        { sourceType: BaseType.STANDARD, sourceId: std.id },
        { enabled: open && !!sourceStandards }
      )
    )
  );

  // Create mappings mutation
  const createMappings = api.baseFrameworkMapping.createMappings.useMutation({
    onSuccess: () => {
      void utils.baseFrameworkMapping.invalidate();
      handleClose();
    },
  });

  // Combine all sources with their controls
  const allSources = useMemo(() => {
    const sources: Array<{
      id: string;
      name: string;
      code: string;
      type: BaseType;
      controls: Array<{ id: string; controlId: string; title: string; description: string | null }>;
      isLoading: boolean;
    }> = [];

    // Add frameworks
    sourceFrameworks?.forEach((fw, index) => {
      const query = frameworkControlsQueries[index];
      sources.push({
        id: fw.id,
        name: fw.name,
        code: fw.code,
        type: BaseType.FRAMEWORK,
        controls: query?.data ?? [],
        isLoading: query?.isLoading ?? true,
      });
    });

    // Add standards
    sourceStandards?.forEach((std, index) => {
      const query = standardControlsQueries[index];
      sources.push({
        id: std.id,
        name: std.title,
        code: "STD",
        type: BaseType.STANDARD,
        controls: query?.data ?? [],
        isLoading: query?.isLoading ?? true,
      });
    });

    return sources;
  }, [sourceFrameworks, sourceStandards, frameworkControlsQueries, standardControlsQueries]);

  // Filter sources and controls based on search
  const filteredSources = useMemo(() => {
    if (!searchTerm) return allSources;

    const term = searchTerm.toLowerCase();
    return allSources
      .map((source) => ({
        ...source,
        controls: source.controls.filter(
          (c) =>
            c.controlId.toLowerCase().includes(term) ||
            c.title.toLowerCase().includes(term) ||
            (c.description && c.description.toLowerCase().includes(term))
        ),
      }))
      .filter((source) => source.controls.length > 0 || source.name.toLowerCase().includes(term));
  }, [allSources, searchTerm]);

  // Count total available controls
  const totalControls = useMemo(() => {
    return filteredSources.reduce((sum, source) => sum + source.controls.length, 0);
  }, [filteredSources]);

  const handleClose = () => {
    setSelectedControls(new Map());
    setMappingType(FrameworkMappingType.COVERS);
    setNotes("");
    setSearchTerm("");
    setExpandedSources(new Set());
    onOpenChange(false);
  };

  const handleToggleControl = (
    controlId: string,
    controlDbId: string,
    sourceType: BaseType,
    sourceId: string
  ) => {
    setSelectedControls((prev) => {
      const next = new Map(prev);
      if (next.has(controlDbId)) {
        next.delete(controlDbId);
      } else {
        next.set(controlDbId, { controlId, sourceType, sourceId });
      }
      return next;
    });
  };

  const handleToggleSource = (source: typeof allSources[0]) => {
    const sourceControlIds = source.controls.map((c) => c.id);
    const allSelected = sourceControlIds.every((id) => selectedControls.has(id));

    setSelectedControls((prev) => {
      const next = new Map(prev);
      if (allSelected) {
        // Deselect all from this source
        sourceControlIds.forEach((id) => next.delete(id));
      } else {
        // Select all from this source
        source.controls.forEach((c) => {
          next.set(c.id, {
            controlId: c.id,
            sourceType: source.type,
            sourceId: source.id,
          });
        });
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedControls.size === totalControls) {
      setSelectedControls(new Map());
    } else {
      const newSelection = new Map<string, SelectedControl>();
      filteredSources.forEach((source) => {
        source.controls.forEach((c) => {
          newSelection.set(c.id, {
            controlId: c.id,
            sourceType: source.type,
            sourceId: source.id,
          });
        });
      });
      setSelectedControls(newSelection);
    }
  };

  const toggleSourceExpanded = (sourceId: string) => {
    setExpandedSources((prev) => {
      const next = new Set(prev);
      if (next.has(sourceId)) {
        next.delete(sourceId);
      } else {
        next.add(sourceId);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedSources(new Set(filteredSources.map((s) => s.id)));
  };

  const collapseAll = () => {
    setExpandedSources(new Set());
  };

  const handleSubmit = () => {
    if (selectedControls.size === 0) return;

    createMappings.mutate({
      targetControlId: baseControl.id,
      mappings: Array.from(selectedControls.entries()).map(([id, info]) => ({
        sourceType: info.sourceType,
        sourceControlId: id,
        mappingType,
        notes: notes || undefined,
      })),
    });
  };

  const isLoading = frameworksLoading || standardsLoading;

  // Count selected per source
  const getSourceSelectedCount = (source: typeof allSources[0]) => {
    return source.controls.filter((c) => selectedControls.has(c.id)).length;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Mappings</DialogTitle>
          <DialogDescription>
            Select controls from any framework or standard to map to this base control
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {/* Base Control Info */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <Label className="text-sm text-gray-500">Base Control</Label>
            <div className="mt-1">
              <span className="font-mono font-medium">{baseControl.controlId}</span>
              <span className="mx-2">-</span>
              <span>{baseControl.title}</span>
            </div>
            {baseControl.description && (
              <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                {baseControl.description}
              </p>
            )}
          </div>

          {/* Search and Actions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Select Source Controls</Label>
              <div className="flex items-center gap-2">
                {selectedControls.size > 0 && (
                  <Badge variant="secondary">
                    {selectedControls.size} selected
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search controls across all sources..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button variant="outline" size="sm" onClick={expandAll}>
                Expand All
              </Button>
              <Button variant="outline" size="sm" onClick={collapseAll}>
                Collapse
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                disabled={totalControls === 0}
              >
                {selectedControls.size === totalControls && totalControls > 0
                  ? "Deselect All"
                  : "Select All"}
              </Button>
            </div>
          </div>

          {/* Sources with Controls */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-500">Loading sources...</span>
            </div>
          ) : filteredSources.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchTerm ? "No controls match your search" : "No source controls available"}
            </div>
          ) : (
            <ScrollArea className="h-[300px] border rounded-md">
              <div className="p-2 space-y-1">
                {filteredSources.map((source) => {
                  const isExpanded = expandedSources.has(source.id);
                  const selectedCount = getSourceSelectedCount(source);
                  const allSourceSelected = selectedCount === source.controls.length && source.controls.length > 0;

                  return (
                    <Collapsible
                      key={source.id}
                      open={isExpanded}
                      onOpenChange={() => toggleSourceExpanded(source.id)}
                    >
                      <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-md">
                        <Checkbox
                          checked={allSourceSelected}
                          onCheckedChange={() => handleToggleSource(source)}
                          disabled={source.isLoading || source.controls.length === 0}
                        />
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="flex-1 justify-start p-0 h-auto hover:bg-transparent"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 mr-2" />
                            ) : (
                              <ChevronRight className="h-4 w-4 mr-2" />
                            )}
                            <span className="font-medium">{source.name}</span>
                            <Badge variant="outline" className="ml-2">
                              {source.code}
                            </Badge>
                            <span className="ml-auto text-sm text-gray-500">
                              {source.isLoading ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <>
                                  {selectedCount > 0 && (
                                    <span className="text-blue-600 mr-2">
                                      {selectedCount} selected
                                    </span>
                                  )}
                                  {source.controls.length} controls
                                </>
                              )}
                            </span>
                          </Button>
                        </CollapsibleTrigger>
                      </div>
                      <CollapsibleContent>
                        <div className="pl-8 pr-2 py-1 space-y-1">
                          {source.controls.map((control) => (
                            <div
                              key={control.id}
                              className={`flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-gray-50 ${
                                selectedControls.has(control.id) ? "bg-blue-50" : ""
                              }`}
                              onClick={() =>
                                handleToggleControl(
                                  control.controlId,
                                  control.id,
                                  source.type,
                                  source.id
                                )
                              }
                            >
                              <Checkbox
                                checked={selectedControls.has(control.id)}
                                onCheckedChange={() =>
                                  handleToggleControl(
                                    control.controlId,
                                    control.id,
                                    source.type,
                                    source.id
                                  )
                                }
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-sm font-medium">
                                    {control.controlId}
                                  </span>
                                  {selectedControls.has(control.id) && (
                                    <CheckCircle2 className="h-4 w-4 text-blue-600" />
                                  )}
                                </div>
                                <p className="text-sm font-medium text-gray-700">
                                  {control.title}
                                </p>
                                {control.description && (
                                  <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">
                                    {control.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          {/* Mapping Type (shown when controls selected) */}
          {selectedControls.size > 0 && (
            <>
              <div className="space-y-2">
                <Label>Mapping Type (applies to all {selectedControls.size} selected)</Label>
                <Select
                  value={mappingType}
                  onValueChange={(value) => setMappingType(value as FrameworkMappingType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COVERS">
                      COVERS - Source fully covers base control
                    </SelectItem>
                    <SelectItem value="PARTIAL">
                      PARTIAL - Source partially covers base control
                    </SelectItem>
                    <SelectItem value="EXCEEDS">
                      EXCEEDS - Source exceeds base control requirements
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Notes (optional, applies to all)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes about these mappings..."
                  rows={2}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={selectedControls.size === 0 || createMappings.isPending}
          >
            {createMappings.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
            Add {selectedControls.size} Mapping{selectedControls.size !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
