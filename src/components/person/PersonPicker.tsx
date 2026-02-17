/**
 * Person Picker Component
 *
 * A combobox-style picker that allows selecting existing persons
 * or creating new ones inline. Used for accountability assignment
 * in risk assessments and treatment actions.
 */

"use client";

import { useState, useCallback, useMemo } from "react";
import { Check, ChevronsUpDown, Plus, User, Loader2, X } from "lucide-react";
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

interface PersonOption {
  id: string;
  name: string;
  email: string | null;
  jobTitle: string | null;
  businessUnitId: string | null;
  businessUnit?: {
    id: string;
    name: string;
  } | null;
}

export interface PersonPickerProps {
  /** Currently selected person ID */
  value: string | null;
  /** Callback when selection changes */
  onChange: (value: string | null, person?: PersonOption) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Custom class name */
  className?: string;
  /** Whether to show clear button */
  clearable?: boolean;
}

export function PersonPicker({
  value,
  onChange,
  placeholder = "Select person...",
  disabled = false,
  className,
  clearable = true,
}: PersonPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogName, setDialogName] = useState("");
  const [dialogEmail, setDialogEmail] = useState("");
  const [dialogJobTitle, setDialogJobTitle] = useState("");
  const [dialogBusinessUnitId, setDialogBusinessUnitId] = useState<string | null>(null);

  const utils = api.useUtils();

  // Fetch all persons for the list
  const { data: personData, isLoading: isLoadingPersons } = api.person.getAll.useQuery();

  // Search query for filtering
  const { data: searchResults, isLoading: isSearching } = api.person.search.useQuery(
    { query: search, limit: 10 },
    { enabled: search.length > 0 }
  );

  // Fetch business units for the dialog
  const { data: buData } = api.businessUnit.getAll.useQuery();

  // Quick create mutation
  const quickCreateMutation = api.person.quickCreate.useMutation({
    onSuccess: (data) => {
      if (data.created) {
        toast.success(`Created person "${data.name}"`);
      }
      // Select the newly created (or existing) person
      onChange(data.id, {
        id: data.id,
        name: data.name,
        email: data.email,
        jobTitle: data.jobTitle,
        businessUnitId: data.businessUnitId,
      });
      // Invalidate the list to refresh
      void utils.person.getAll.invalidate();
      void utils.person.search.invalidate();
      setSearch("");
      setOpen(false);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create person");
    },
  });

  // Get the display list based on search
  const displayList = useMemo(() => {
    if (search.length > 0 && searchResults) {
      return searchResults;
    }
    return personData ?? [];
  }, [search, searchResults, personData]);

  // Check if search term exactly matches an existing person
  const exactMatch = useMemo(() => {
    if (!search.trim()) return null;
    const normalized = search.trim().toLowerCase();
    return displayList.find(
      (p) =>
        p.name.toLowerCase() === normalized ||
        p.email?.toLowerCase() === normalized
    );
  }, [search, displayList]);

  // Get currently selected person for display
  const selectedPerson = useMemo(() => {
    if (!value) return null;
    return personData?.find((p) => p.id === value) ?? null;
  }, [value, personData]);

  // Handle quick create
  const handleQuickCreate = useCallback(() => {
    const trimmedName = search.trim();
    if (!trimmedName) return;

    quickCreateMutation.mutate({ name: trimmedName });
  }, [search, quickCreateMutation]);

  // Handle advanced create via dialog
  const handleOpenDialog = useCallback(() => {
    setDialogName(search.trim());
    setDialogEmail("");
    setDialogJobTitle("");
    setDialogBusinessUnitId(null);
    setDialogOpen(true);
    setOpen(false);
  }, [search]);

  // Handle dialog submit
  const handleDialogSubmit = useCallback(() => {
    if (!dialogName.trim()) return;

    quickCreateMutation.mutate({
      name: dialogName.trim(),
      email: dialogEmail.trim() || undefined,
      jobTitle: dialogJobTitle.trim() || undefined,
      businessUnitId: dialogBusinessUnitId || undefined,
    });
    setDialogOpen(false);
  }, [dialogName, dialogEmail, dialogJobTitle, dialogBusinessUnitId, quickCreateMutation]);

  // Handle selection
  const handleSelect = useCallback(
    (person: PersonOption) => {
      onChange(person.id, person);
      setSearch("");
      setOpen(false);
    },
    [onChange]
  );

  // Handle clear
  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(null);
    },
    [onChange]
  );

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
              !selectedPerson && "text-muted-foreground",
              className
            )}
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : selectedPerson ? (
              <span className="flex items-center gap-2 truncate flex-1">
                <User className="h-4 w-4 shrink-0" />
                <span className="truncate">{selectedPerson.name}</span>
                {selectedPerson.jobTitle && (
                  <span className="text-xs text-muted-foreground truncate">
                    ({selectedPerson.jobTitle})
                  </span>
                )}
              </span>
            ) : (
              placeholder
            )}
            <div className="flex items-center gap-1 shrink-0">
              {clearable && selectedPerson && !disabled && (
                <X
                  className="h-4 w-4 opacity-50 hover:opacity-100 cursor-pointer"
                  onClick={handleClear}
                />
              )}
              <ChevronsUpDown className="h-4 w-4 opacity-50" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search or create person..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              {isLoadingPersons || isSearching ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : displayList.length === 0 && !showCreateOption ? (
                <CommandEmpty>
                  <div className="flex flex-col items-center py-4 text-muted-foreground">
                    <User className="h-8 w-8 mb-2" />
                    <p>No persons found</p>
                    <p className="text-xs mt-1">Type a name to create one</p>
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

                  {/* Clear option */}
                  {clearable && value && (
                    <>
                      <CommandGroup>
                        <CommandItem
                          onSelect={() => {
                            onChange(null);
                            setOpen(false);
                          }}
                          className="cursor-pointer text-muted-foreground"
                        >
                          <X className="h-4 w-4 mr-2" />
                          Clear selection
                        </CommandItem>
                      </CommandGroup>
                      {displayList.length > 0 && <CommandSeparator />}
                    </>
                  )}

                  {/* Existing persons */}
                  {displayList.length > 0 && (
                    <CommandGroup heading="Persons">
                      {displayList.map((person) => (
                        <CommandItem
                          key={person.id}
                          value={person.id}
                          onSelect={() => handleSelect(person)}
                          className="cursor-pointer"
                        >
                          <Check
                            className={cn(
                              "h-4 w-4 mr-2 shrink-0",
                              value === person.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col flex-1 min-w-0">
                            <span className="truncate">{person.name}</span>
                            <span className="text-xs text-muted-foreground truncate">
                              {[person.jobTitle, person.businessUnit?.name, person.email]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </div>
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
            <DialogTitle>Create Person</DialogTitle>
            <DialogDescription>
              Add a new person for accountability tracking. Email is optional
              but recommended for identification.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="person-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="person-name"
                placeholder="Enter full name"
                value={dialogName}
                onChange={(e) => setDialogName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="person-email">Email (optional)</Label>
              <Input
                id="person-email"
                type="email"
                placeholder="email@example.com"
                value={dialogEmail}
                onChange={(e) => setDialogEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Used for identification and potential notifications
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="person-job-title">Job Title (optional)</Label>
              <Input
                id="person-job-title"
                placeholder="e.g., IT Manager, CISO, Developer"
                value={dialogJobTitle}
                onChange={(e) => setDialogJobTitle(e.target.value)}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="person-bu">Business Unit (optional)</Label>
              <select
                id="person-bu"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={dialogBusinessUnitId ?? ""}
                onChange={(e) =>
                  setDialogBusinessUnitId(e.target.value || null)
                }
              >
                <option value="">None</option>
                {buData?.map((bu) => (
                  <option key={bu.id} value={bu.id}>
                    {bu.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Primary business unit for this person
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
                "Create Person"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
