"use client";

/**
 * Control Picker Component
 *
 * Provides a searchable picker dialog for selecting framework controls.
 * Similar to MitreTechniquePicker but for controls.
 * Supports:
 * - Searching existing controls by ID or title
 * - Filtering by framework
 * - Creating new controls inline
 */

import { useState, useCallback } from "react";
import { Search, Plus, Check, X, Loader2, Shield } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

/**
 * Control option type for the picker
 */
export interface ControlOption {
  id: string;
  controlId: string; // External ID like "AC-1"
  title: string;
  description?: string;
  frameworkId: string;
  frameworkCode: string;
  frameworkName: string;
}

interface ControlPickerProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog closes */
  onOpenChange: (open: boolean) => void;
  /** Callback when a control is selected */
  onSelect: (control: ControlOption) => void;
  /** Already selected control IDs to exclude */
  excludeIds?: string[];
  /** Title for the dialog */
  title?: string;
  /** Description for the dialog */
  description?: string;
}

export function ControlPicker({
  open,
  onOpenChange,
  onSelect,
  excludeIds = [],
  title = "Select Control",
  description = "Search and select a framework control",
}: ControlPickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFrameworkId, setSelectedFrameworkId] = useState<string>("all");
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Create form state
  const [newControlId, setNewControlId] = useState("");
  const [newControlTitle, setNewControlTitle] = useState("");
  const [newControlDescription, setNewControlDescription] = useState("");
  const [newControlFrameworkId, setNewControlFrameworkId] = useState("");

  const utils = api.useUtils();

  // Fetch frameworks for filter dropdown
  const { data: frameworks } = api.framework.list.useQuery(undefined, {
    enabled: open,
  });

  // Search controls using the listControlsWithHealth query
  const { data: searchResults, isLoading } = api.controlLink.listControlsWithHealth.useQuery(
    {
      search: searchQuery || undefined,
      frameworkId: selectedFrameworkId !== "all" ? selectedFrameworkId : undefined,
      limit: 50,
    },
    {
      enabled: open && (searchQuery.length > 0 || selectedFrameworkId !== "all"),
    }
  );

  // Create control mutation
  const createControlMutation = api.framework.createControl.useMutation({
    onSuccess: (newControl) => {
      toast.success("Control created successfully");
      setShowCreateForm(false);
      resetCreateForm();

      // Find the framework to get its code/name
      const framework = frameworks?.find(f => f.id === newControl.frameworkId);

      onSelect({
        id: newControl.id,
        controlId: newControl.controlId,
        title: newControl.title,
        description: newControl.description,
        frameworkId: newControl.frameworkId,
        frameworkCode: framework?.code || "",
        frameworkName: framework?.name || "",
      });
      onOpenChange(false);
      void utils.controlLink.listControlsWithHealth.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create control");
    },
  });

  // Filter out already selected controls
  const filteredControls = searchResults?.controls.filter(
    (c) => !excludeIds.includes(c.id)
  ) || [];

  const handleSelect = useCallback(
    (control: ControlOption) => {
      onSelect(control);
      onOpenChange(false);
      setSearchQuery("");
    },
    [onSelect, onOpenChange]
  );

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setSearchQuery("");
    setShowCreateForm(false);
    resetCreateForm();
  }, [onOpenChange]);

  const resetCreateForm = () => {
    setNewControlId("");
    setNewControlTitle("");
    setNewControlDescription("");
    setNewControlFrameworkId("");
  };

  const handleCreateControl = () => {
    if (!newControlFrameworkId || !newControlId || !newControlTitle || !newControlDescription) {
      toast.error("Please fill in all required fields");
      return;
    }

    createControlMutation.mutate({
      frameworkId: newControlFrameworkId,
      controlId: newControlId,
      title: newControlTitle,
      description: newControlDescription,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {!showCreateForm ? (
          <div className="flex flex-col gap-4">
            {/* Search and Filter */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by control ID or title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={selectedFrameworkId} onValueChange={setSelectedFrameworkId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by framework" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Frameworks</SelectItem>
                  {frameworks?.map((framework) => (
                    <SelectItem key={framework.id} value={framework.id}>
                      {framework.code} - {framework.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Results */}
            <ScrollArea className="h-[350px] border rounded-md">
              {isLoading && (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}

              {!isLoading && filteredControls.length === 0 && (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <Search className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">
                    {searchQuery || selectedFrameworkId !== "all"
                      ? "No controls found"
                      : "Search or select a framework to browse controls"}
                  </p>
                </div>
              )}

              {filteredControls.length > 0 && (
                <div className="divide-y">
                  {filteredControls.map((control) => (
                    <button
                      key={control.id}
                      type="button"
                      className="w-full p-3 text-left hover:bg-muted/50 transition-colors"
                      onClick={() => handleSelect({
                        id: control.id,
                        controlId: control.controlId,
                        title: control.title,
                        description: control.description,
                        frameworkId: control.frameworkId,
                        frameworkCode: control.frameworkCode,
                        frameworkName: control.frameworkName,
                      })}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="font-mono text-xs shrink-0">
                              {control.frameworkCode}
                            </Badge>
                            <span className="font-mono text-sm font-medium text-primary">
                              {control.controlId}
                            </span>
                          </div>
                          <p className="text-sm font-medium truncate">
                            {control.title}
                          </p>
                          {control.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                              {control.description}
                            </p>
                          )}
                        </div>
                        <Check className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>

            <Separator />

            <div className="flex justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowCreateForm(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Create New Control
              </Button>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          /* Create Control Form */
          <div className="flex flex-col gap-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="create-framework">Framework *</Label>
                <Select value={newControlFrameworkId} onValueChange={setNewControlFrameworkId}>
                  <SelectTrigger id="create-framework">
                    <SelectValue placeholder="Select a framework" />
                  </SelectTrigger>
                  <SelectContent>
                    {frameworks?.map((framework) => (
                      <SelectItem key={framework.id} value={framework.id}>
                        {framework.code} - {framework.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-control-id">Control ID *</Label>
                <Input
                  id="create-control-id"
                  placeholder="e.g., AC-1, SC-7.1"
                  value={newControlId}
                  onChange={(e) => setNewControlId(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Alphanumeric with dots and dashes only
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-title">Title *</Label>
                <Input
                  id="create-title"
                  placeholder="Control title"
                  value={newControlTitle}
                  onChange={(e) => setNewControlTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-description">Description *</Label>
                <Textarea
                  id="create-description"
                  placeholder="Control description..."
                  value={newControlDescription}
                  onChange={(e) => setNewControlDescription(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>
            </div>

            <Separator />

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCreateForm(false);
                  resetCreateForm();
                }}
              >
                Back to Search
              </Button>
              <Button
                type="button"
                onClick={handleCreateControl}
                disabled={createControlMutation.isPending}
              >
                {createControlMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-1" />
                    Create Control
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Control Display Badge - shows a selected control with remove action
 */
interface ControlBadgeProps {
  control: ControlOption;
  onRemove?: () => void;
  isReadOnly?: boolean;
}

export function ControlBadge({ control, onRemove, isReadOnly = false }: ControlBadgeProps) {
  return (
    <Badge variant="secondary" className="flex items-center gap-1.5 pr-1 max-w-full">
      <span className="font-mono text-xs text-muted-foreground shrink-0">
        {control.frameworkCode}
      </span>
      <span className="font-mono text-xs font-medium shrink-0">
        {control.controlId}
      </span>
      <span className="text-xs truncate">{control.title}</span>
      {!isReadOnly && onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-4 w-4 hover:bg-destructive/20 shrink-0"
          onClick={onRemove}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </Badge>
  );
}

/**
 * Control Display Card - shows a selected control with more details
 */
interface ControlCardProps {
  controlId: string;
  onRemove?: () => void;
  isReadOnly?: boolean;
}

export function ControlCard({ controlId, onRemove, isReadOnly = false }: ControlCardProps) {
  // Fetch control details
  const { data: controlHealth, isLoading } = api.controlLink.getControlHealth.useQuery(
    { controlId },
    { enabled: !!controlId }
  );

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-2 rounded-md border bg-card">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    );
  }

  if (!controlHealth) {
    return (
      <div className="flex items-center justify-between gap-2 p-2 rounded-md border bg-card">
        <span className="font-mono text-sm text-primary">{controlId}</span>
        {!isReadOnly && onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onRemove}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 p-2 rounded-md border bg-card">
      <div className="flex items-center gap-2 min-w-0">
        <Badge variant="outline" className="font-mono text-xs shrink-0">
          {controlHealth.frameworkCode}
        </Badge>
        <span className="font-mono text-sm font-medium text-primary shrink-0">
          {controlHealth.controlCode}
        </span>
        <span className="text-sm truncate">{controlHealth.title}</span>
      </div>
      {!isReadOnly && onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={onRemove}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
