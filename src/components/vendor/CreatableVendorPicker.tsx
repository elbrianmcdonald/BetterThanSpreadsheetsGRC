"use client";

import { useState, useCallback, useMemo } from "react";
import { Check, ChevronsUpDown, Plus, Building2, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

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

interface VendorOption {
  id: string;
  name: string;
  identifier: string;
  category?: string | null;
}

export interface CreatableVendorPickerProps {
  value: string | null;
  onChange: (value: string | null, vendor?: VendorOption) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function CreatableVendorPicker({
  value,
  onChange,
  placeholder = "Select vendor...",
  disabled = false,
  className,
}: CreatableVendorPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogName, setDialogName] = useState("");
  const [dialogCategory, setDialogCategory] = useState("");

  const utils = api.useUtils();

  const { data: vendorsData, isLoading } = api.vendor.list.useQuery({
    page: 1,
    limit: 100,
    status: ["ACTIVE", "UNDER_REVIEW"],
  });

  const createMutation = api.vendor.create.useMutation({
    onSuccess: (vendor) => {
      toast.success(`Created vendor "${vendor.name}"`);
      onChange(vendor.id, {
        id: vendor.id,
        name: vendor.name,
        identifier: vendor.identifier,
        category: vendor.category,
      });
      void utils.vendor.list.invalidate();
      setSearch("");
      setOpen(false);
      setDialogOpen(false);
      setDialogName("");
      setDialogCategory("");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create vendor");
    },
  });

  const allVendors = useMemo<VendorOption[]>(
    () =>
      (vendorsData?.items ?? []).map((v) => ({
        id: v.id,
        name: v.name,
        identifier: v.identifier,
        category: v.category,
      })),
    [vendorsData?.items]
  );

  const filteredVendors = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return allVendors;
    return allVendors.filter(
      (v) =>
        v.name.toLowerCase().includes(normalized) ||
        v.identifier.toLowerCase().includes(normalized) ||
        (v.category?.toLowerCase().includes(normalized) ?? false)
    );
  }, [search, allVendors]);

  const exactMatch = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return null;
    return allVendors.find((v) => v.name.toLowerCase() === normalized) ?? null;
  }, [search, allVendors]);

  const selectedVendor = useMemo(() => {
    if (!value) return null;
    return allVendors.find((v) => v.id === value) ?? null;
  }, [value, allVendors]);

  const handleQuickCreate = useCallback(() => {
    const trimmed = search.trim();
    if (!trimmed) return;
    createMutation.mutate({ name: trimmed });
  }, [search, createMutation]);

  const handleOpenDialog = useCallback(() => {
    setDialogName(search.trim());
    setDialogCategory("");
    setDialogOpen(true);
    setOpen(false);
  }, [search]);

  const handleDialogSubmit = useCallback(() => {
    const trimmed = dialogName.trim();
    if (!trimmed) return;
    createMutation.mutate({
      name: trimmed,
      category: dialogCategory.trim() || undefined,
    });
  }, [dialogName, dialogCategory, createMutation]);

  const handleSelect = useCallback(
    (vendor: VendorOption) => {
      onChange(vendor.id, vendor);
      setSearch("");
      setOpen(false);
    },
    [onChange]
  );

  const isCreating = createMutation.isPending;
  const showCreateOption = search.trim().length > 0 && !exactMatch;

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
              !selectedVendor && "text-muted-foreground",
              className
            )}
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : selectedVendor ? (
              <span className="flex items-center gap-2 truncate">
                <Building2 className="h-4 w-4 shrink-0" />
                <span className="truncate">{selectedVendor.name}</span>
                <span className="text-xs text-muted-foreground font-mono">
                  ({selectedVendor.identifier})
                </span>
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
              placeholder="Search or create vendor..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              {isLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredVendors.length === 0 && !showCreateOption ? (
                <CommandEmpty>
                  <div className="flex flex-col items-center py-4 text-muted-foreground">
                    <Building2 className="h-8 w-8 mb-2" />
                    <p>No vendors found</p>
                  </div>
                </CommandEmpty>
              ) : (
                <>
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
                      {filteredVendors.length > 0 && <CommandSeparator />}
                    </>
                  )}

                  {filteredVendors.length > 0 && (
                    <CommandGroup heading="Vendors">
                      {filteredVendors.map((vendor) => (
                        <CommandItem
                          key={vendor.id}
                          value={vendor.id}
                          onSelect={() => handleSelect(vendor)}
                          className="cursor-pointer"
                        >
                          <Check
                            className={cn(
                              "h-4 w-4 mr-2",
                              value === vendor.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className="flex-1 truncate">{vendor.name}</span>
                          <span className="text-xs text-muted-foreground font-mono ml-2">
                            {vendor.identifier}
                          </span>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Vendor</DialogTitle>
            <DialogDescription>
              Add a new vendor to your registry. You can add additional details (risk tier, contacts, owners) from the vendor page later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="vendor-name">
                Vendor Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="vendor-name"
                placeholder="Enter vendor name"
                value={dialogName}
                onChange={(e) => setDialogName(e.target.value)}
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor-category">Category (optional)</Label>
              <Input
                id="vendor-category"
                placeholder="e.g., Cloud Services, Security Tools"
                value={dialogCategory}
                onChange={(e) => setDialogCategory(e.target.value)}
                maxLength={100}
              />
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
                "Create Vendor"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
