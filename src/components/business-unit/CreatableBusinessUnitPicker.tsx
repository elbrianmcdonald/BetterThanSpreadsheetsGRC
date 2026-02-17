/**
 * Creatable Business Unit Picker Component
 *
 * A combobox-style picker that allows selecting existing business units
 * or creating new ones inline. Supports both quick create (just name) and
 * advanced create via dialog (name, code, parent).
 */

"use client";

import { useState, useCallback, useMemo } from "react";
import { Check, ChevronsUpDown, Plus, Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface BusinessUnitOption {
  id: string;
  name: string;
  code: string | null;
}

export interface CreatableBusinessUnitPickerProps {
  /** Currently selected business unit ID */
  value: string | null;
  /** Callback when selection changes */
  onChange: (value: string | null, businessUnit?: BusinessUnitOption) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Custom class name */
  className?: string;
}

export function CreatableBusinessUnitPicker({
  value,
  onChange,
  placeholder = "Select business unit...",
  disabled = false,
  className,
}: CreatableBusinessUnitPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogName, setDialogName] = useState("");
  const [dialogCode, setDialogCode] = useState("");
  const [dialogParentId, setDialogParentId] = useState<string | null>(null);

  const utils = api.useUtils();

  // Fetch all business units for the list
  const { data: buData, isLoading: isLoadingBUs } = api.businessUnit.list.useQuery({
    includeInactive: false,
  });

  // Search query for filtering
  const { data: searchResults, isLoading: isSearching } = api.businessUnit.search.useQuery(
    { query: search, limit: 10 },
    { enabled: search.length > 0 }
  );

  // Quick create mutation
  const quickCreateMutation = api.businessUnit.quickCreate.useMutation({
    onSuccess: (data) => {
      if (data.created) {
        toast.success(`Created business unit "${data.name}"`);
      }
      // Select the newly created (or existing) BU
      onChange(data.id, {
        id: data.id,
        name: data.name,
        code: data.code,
      });
      // Invalidate the list to refresh
      void utils.businessUnit.list.invalidate();
      void utils.businessUnit.search.invalidate();
      setSearch("");
      setOpen(false);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create business unit");
    },
  });

  // Flatten tree to get all BUs
  const allBusinessUnits = useMemo(() => {
    if (!buData?.tree) return [];

    const flatten = (nodes: typeof buData.tree): BusinessUnitOption[] => {
      const result: BusinessUnitOption[] = [];
      for (const node of nodes) {
        result.push({
          id: node.id,
          name: node.name,
          code: node.code,
        });
        if (node.children?.length) {
          result.push(...flatten(node.children));
        }
      }
      return result;
    };

    return flatten(buData.tree);
  }, [buData?.tree]);

  // Get the display list based on search
  const displayList = useMemo(() => {
    if (search.length > 0 && searchResults) {
      return searchResults;
    }
    return allBusinessUnits;
  }, [search, searchResults, allBusinessUnits]);

  // Check if search term exactly matches an existing BU
  const exactMatch = useMemo(() => {
    if (!search.trim()) return null;
    const normalized = search.trim().toLowerCase();
    return allBusinessUnits.find(
      (bu) => bu.name.toLowerCase() === normalized
    );
  }, [search, allBusinessUnits]);

  // Get currently selected BU for display
  const selectedBU = useMemo(() => {
    if (!value) return null;
    return allBusinessUnits.find((bu) => bu.id === value) ?? null;
  }, [value, allBusinessUnits]);

  // Handle quick create
  const handleQuickCreate = useCallback(() => {
    const trimmedName = search.trim();
    if (!trimmedName) return;

    quickCreateMutation.mutate({ name: trimmedName });
  }, [search, quickCreateMutation]);

  // Handle advanced create via dialog
  const handleOpenDialog = useCallback(() => {
    setDialogName(search.trim());
    setDialogCode("");
    setDialogParentId(null);
    setDialogOpen(true);
    setOpen(false);
  }, [search]);

  // Handle dialog submit
  const handleDialogSubmit = useCallback(() => {
    if (!dialogName.trim()) return;

    quickCreateMutation.mutate({
      name: dialogName.trim(),
      code: dialogCode.trim() || undefined,
      parentId: dialogParentId || undefined,
    });
    setDialogOpen(false);
  }, [dialogName, dialogCode, dialogParentId, quickCreateMutation]);

  // Handle selection
  const handleSelect = useCallback((bu: BusinessUnitOption) => {
    onChange(bu.id, bu);
    setSearch("");
    setOpen(false);
  }, [onChange]);

  const isCreating = quickCreateMutation.isPending;
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
              !selectedBU && "text-muted-foreground",
              className
            )}
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : selectedBU ? (
              <span className="flex items-center gap-2 truncate">
                <Building2 className="h-4 w-4 shrink-0" />
                <span className="truncate">{selectedBU.name}</span>
                {selectedBU.code && (
                  <span className="text-xs text-muted-foreground font-mono">
                    ({selectedBU.code})
                  </span>
                )}
              </span>
            ) : (
              placeholder
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search or create business unit..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              {isLoadingBUs || isSearching ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : displayList.length === 0 && !showCreateOption ? (
                <CommandEmpty>
                  <div className="flex flex-col items-center py-4 text-muted-foreground">
                    <Building2 className="h-8 w-8 mb-2" />
                    <p>No business units found</p>
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
                          <Plus className="h-4 w-4 mr-2" />
                          More options...
                        </CommandItem>
                      </CommandGroup>
                      {displayList.length > 0 && <CommandSeparator />}
                    </>
                  )}

                  {/* Existing business units */}
                  {displayList.length > 0 && (
                    <CommandGroup heading="Business Units">
                      {displayList.map((bu) => (
                        <CommandItem
                          key={bu.id}
                          value={bu.id}
                          onSelect={() => handleSelect(bu)}
                          className="cursor-pointer"
                        >
                          <Check
                            className={cn(
                              "h-4 w-4 mr-2",
                              value === bu.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className="flex-1 truncate">{bu.name}</span>
                          {bu.code && (
                            <span className="text-xs text-muted-foreground font-mono ml-2">
                              {bu.code}
                            </span>
                          )}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Business Unit</DialogTitle>
            <DialogDescription>
              Add a new business unit to your organization. The code is optional
              and can be used for quick reference.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bu-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="bu-name"
                placeholder="Enter business unit name"
                value={dialogName}
                onChange={(e) => setDialogName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bu-code">Code (optional)</Label>
              <Input
                id="bu-code"
                placeholder="e.g., ENG, SALES, HR"
                value={dialogCode}
                onChange={(e) => setDialogCode(e.target.value)}
                maxLength={20}
              />
              <p className="text-xs text-muted-foreground">
                Short identifier for quick reference (max 20 characters)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bu-parent">Parent Business Unit (optional)</Label>
              <Select
                value={dialogParentId ?? "__none__"}
                onValueChange={(v) => setDialogParentId(v === "__none__" ? null : v)}
              >
                <SelectTrigger id="bu-parent">
                  <SelectValue placeholder="None (top-level)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None (top-level)</SelectItem>
                  {allBusinessUnits.map((bu) => (
                    <SelectItem key={bu.id} value={bu.id}>
                      {bu.name}
                      {bu.code && ` (${bu.code})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Optionally place this under an existing business unit
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
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
                "Create Business Unit"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
