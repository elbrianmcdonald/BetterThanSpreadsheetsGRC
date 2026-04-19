/**
 * Creatable Control Picker Component
 *
 * A combobox-style picker that allows selecting existing organizational controls
 * or creating new ones inline. Supports both quick create (just name) and
 * advanced create via dialog (name, description, type, framework mapping).
 */

"use client";

import { useState, useCallback, useMemo } from "react";
import { Check, ChevronsUpDown, Plus, Shield, Loader2, Link2 } from "lucide-react";
import { toast } from "sonner";
import { ControlType } from "@prisma/client";

import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
interface ControlOption {
  id: string;
  name: string;
  controlType: ControlType;
  // NOTE: framework mapping is a many-to-many junction
  // (OrgControlFrameworkMapping); UI rendering deferred to next sprint.
}

export interface CreatableControlPickerProps {
  /** Currently selected control ID */
  value: string | null;
  /** Callback when selection changes */
  onChange: (value: string | null, control?: ControlOption) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Custom class name */
  className?: string;
  /** IDs to exclude from the list (e.g., already selected controls) */
  excludeIds?: string[];
  /** Default control type for new controls */
  defaultControlType?: ControlType;
}

export function CreatableControlPicker({
  value,
  onChange,
  placeholder = "Select or create control...",
  disabled = false,
  className,
  excludeIds = [],
  defaultControlType = ControlType.PREVENTIVE,
}: CreatableControlPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogName, setDialogName] = useState("");
  const [dialogDescription, setDialogDescription] = useState("");
  const [dialogControlType, setDialogControlType] = useState<ControlType>(defaultControlType);
  const [dialogFrameworkId, setDialogFrameworkId] = useState<string | null>(null);
  const [dialogFrameworkControlId, setDialogFrameworkControlId] = useState<string | null>(null);

  const utils = api.useUtils();

  // Fetch all controls
  const { data: controlsData, isLoading: isLoadingControls } = api.organizationalControl.list.useQuery({
    limit: 100,
  });

  // Search query for filtering
  const { data: searchResults, isLoading: isSearching } = api.organizationalControl.search.useQuery(
    { query: search, limit: 10, excludeIds },
    { enabled: search.length > 0 }
  );

  // Fetch frameworks for the dialog
  const { data: frameworksData } = api.framework.list.useQuery({});

  // Fetch controls for selected framework
  const { data: frameworkControlsData } = api.framework.getControls.useQuery(
    { frameworkId: dialogFrameworkId!, page: 0, pageSize: 100 },
    { enabled: !!dialogFrameworkId }
  );

  // Quick create mutation
  const quickCreateMutation = api.organizationalControl.quickCreate.useMutation({
    onSuccess: (data) => {
      if (data.created) {
        toast.success(`Created control "${data.name}"`);
      }
      onChange(data.id, {
        id: data.id,
        name: data.name,
        controlType: data.controlType,
      });
      void utils.organizationalControl.list.invalidate();
      void utils.organizationalControl.search.invalidate();
      setSearch("");
      setOpen(false);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create control");
    },
  });

  // Advanced create mutation
  const createMutation = api.organizationalControl.create.useMutation({
    onSuccess: (data) => {
      toast.success(`Created control "${data.name}"`);
      onChange(data.id, {
        id: data.id,
        name: data.name,
        controlType: data.controlType,
      });
      void utils.organizationalControl.list.invalidate();
      void utils.organizationalControl.search.invalidate();
      setDialogOpen(false);
      resetDialog();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create control");
    },
  });

  const resetDialog = () => {
    setDialogName("");
    setDialogDescription("");
    setDialogControlType(defaultControlType);
    setDialogFrameworkId(null);
    setDialogFrameworkControlId(null);
  };

  // Get all controls as flat list
  const allControls = useMemo(() => {
    if (!controlsData?.controls) return [];
    return controlsData.controls.filter((c) => !excludeIds.includes(c.id));
  }, [controlsData?.controls, excludeIds]);

  // Get the display list based on search
  const displayList = useMemo(() => {
    if (search.length > 0 && searchResults) {
      return searchResults;
    }
    return allControls;
  }, [search, searchResults, allControls]);

  // Check if search term exactly matches an existing control
  const exactMatch = useMemo(() => {
    if (!search.trim()) return null;
    const normalized = search.trim().toLowerCase();
    return allControls.find((c) => c.name.toLowerCase() === normalized);
  }, [search, allControls]);

  // Get currently selected control for display
  const selectedControl = useMemo(() => {
    if (!value) return null;
    return allControls.find((c) => c.id === value) ?? null;
  }, [value, allControls]);

  // Handle quick create
  const handleQuickCreate = useCallback(() => {
    const trimmedName = search.trim();
    if (!trimmedName) return;
    quickCreateMutation.mutate({ name: trimmedName, controlType: defaultControlType });
  }, [search, quickCreateMutation, defaultControlType]);

  // Handle opening advanced dialog
  const handleOpenDialog = useCallback(() => {
    setDialogName(search.trim());
    setDialogControlType(defaultControlType);
    setDialogOpen(true);
    setOpen(false);
  }, [search, defaultControlType]);

  // Handle dialog submit
  const handleDialogSubmit = useCallback(() => {
    if (!dialogName.trim()) return;
    createMutation.mutate({
      name: dialogName.trim(),
      description: dialogDescription.trim() || undefined,
      controlType: dialogControlType,
      ...(dialogFrameworkControlId && {
        frameworkMappings: [{ frameworkControlId: dialogFrameworkControlId, mappingType: "COVERS" as const }],
      }),
    });
  }, [dialogName, dialogDescription, dialogControlType, dialogFrameworkControlId, createMutation]);

  // Handle selection
  const handleSelect = useCallback((control: ControlOption) => {
    onChange(control.id, control);
    setSearch("");
    setOpen(false);
  }, [onChange]);

  const isCreating = quickCreateMutation.isPending || createMutation.isPending;
  const showCreateOption = search.trim() && !exactMatch && !isSearching;

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled || isCreating}
            className={cn(
              "w-full justify-between font-normal",
              !selectedControl && "text-muted-foreground",
              className
            )}
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : selectedControl ? (
              <span className="flex items-center gap-2 truncate">
                <Shield className="h-4 w-4 shrink-0" />
                <span className="truncate">{selectedControl.name}</span>
              </span>
            ) : (
              placeholder
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[450px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search or create control..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              {isLoadingControls || isSearching ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : displayList.length === 0 && !showCreateOption ? (
                <CommandEmpty>
                  <div className="flex flex-col items-center py-4 text-muted-foreground">
                    <Shield className="h-8 w-8 mb-2" />
                    <p>No controls found</p>
                    <p className="text-sm">Type to create a new control</p>
                  </div>
                </CommandEmpty>
              ) : (
                <>
                  {/* Create options */}
                  {showCreateOption && (
                    <>
                      <CommandGroup heading="Create new">
                        <CommandItem
                          onSelect={handleQuickCreate}
                          className="cursor-pointer"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Create &quot;{search.trim()}&quot;
                        </CommandItem>
                        <CommandItem
                          onSelect={handleOpenDialog}
                          className="cursor-pointer text-muted-foreground"
                        >
                          <Link2 className="h-4 w-4 mr-2" />
                          More options (link to framework)...
                        </CommandItem>
                      </CommandGroup>
                      {displayList.length > 0 && <CommandSeparator />}
                    </>
                  )}

                  {/* Existing controls */}
                  {displayList.length > 0 && (
                    <CommandGroup heading="Controls">
                      {displayList.map((control) => (
                        <CommandItem
                          key={control.id}
                          value={control.id}
                          onSelect={() => handleSelect(control)}
                          className="cursor-pointer"
                        >
                          <Check
                            className={cn(
                              "h-4 w-4 mr-2",
                              value === control.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className="flex-1 truncate">{control.name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Advanced Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Control</DialogTitle>
            <DialogDescription>
              Add a new organizational control. Optionally link it to a framework control for compliance mapping.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="control-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="control-name"
                placeholder="e.g., MFA on Admin Accounts"
                value={dialogName}
                onChange={(e) => setDialogName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="control-description">Description (optional)</Label>
              <Textarea
                id="control-description"
                placeholder="Describe what this control does..."
                value={dialogDescription}
                onChange={(e) => setDialogDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="control-type">Control Type</Label>
              <Select
                value={dialogControlType}
                onValueChange={(v) => setDialogControlType(v as ControlType)}
              >
                <SelectTrigger id="control-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ControlType.PREVENTIVE}>
                    Preventive - Stops a threat before it occurs
                  </SelectItem>
                  <SelectItem value={ControlType.DETECTIVE}>
                    Detective - Identifies when something has occurred
                  </SelectItem>
                  <SelectItem value={ControlType.CORRECTIVE}>
                    Corrective - Fixes damage after an event
                  </SelectItem>
                  <SelectItem value={ControlType.COMPENSATING}>
                    Compensating - Alternative when primary control isn&apos;t feasible
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="border-t pt-4 space-y-4">
              <p className="text-sm font-medium">Link to Framework Control (optional)</p>
              <p className="text-xs text-muted-foreground">
                Map this control to a specific framework control for compliance tracking
              </p>

              <div className="space-y-2">
                <Label htmlFor="framework-select">Framework</Label>
                <Select
                  value={dialogFrameworkId ?? "__none__"}
                  onValueChange={(v) => {
                    setDialogFrameworkId(v === "__none__" ? null : v);
                    setDialogFrameworkControlId(null);
                  }}
                >
                  <SelectTrigger id="framework-select">
                    <SelectValue placeholder="Select framework..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {frameworksData?.map((fw) => (
                      <SelectItem key={fw.id} value={fw.id}>
                        {fw.name} ({fw.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {dialogFrameworkId && (
                <div className="space-y-2">
                  <Label htmlFor="framework-control-select">Framework Control</Label>
                  <Select
                    value={dialogFrameworkControlId ?? "__none__"}
                    onValueChange={(v) => setDialogFrameworkControlId(v === "__none__" ? null : v)}
                  >
                    <SelectTrigger id="framework-control-select">
                      <SelectValue placeholder="Select control..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {frameworkControlsData?.controls?.map((ctrl) => (
                        <SelectItem key={ctrl.id} value={ctrl.id}>
                          {ctrl.controlId} - {ctrl.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                resetDialog();
              }}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDialogSubmit}
              disabled={!dialogName.trim() || isCreating}
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Control"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
