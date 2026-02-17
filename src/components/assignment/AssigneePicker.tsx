/**
 * Assignee Picker Component
 *
 * Story 7.0.7: Assignee Picker with BU Suggestions
 *
 * A searchable dropdown for selecting an assignee with BU-based suggestions.
 * Users from affected business units (and their descendants) appear in a
 * "Suggested" section for faster assignment.
 *
 * @see AC1-AC8: Assignee Picker Component
 * @see AC9-AC15: BU-Based Suggestions
 * @see AC16-AC20: Visual Design
 */

"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { ChevronsUpDown, Check, X, User, Building2 } from "lucide-react";

// Type for business unit with nested parent hierarchy
interface BusinessUnitNode {
  id: string;
  name: string;
  parentId: string | null;
  parent?: BusinessUnitNode | null;
}

// Type for user from listForAssignment query
interface AssigneeUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string;
  businessUnitId: string | null;
  businessUnit: BusinessUnitNode | null;
}

export interface AssigneePickerProps {
  /** Currently selected user ID */
  value: string | null;
  /** Callback when selection changes */
  onChange: (userId: string | null) => void;
  /** BU IDs to prioritize for suggestions (e.g., from affected findings) */
  suggestedFromBUs?: string[];
  /** Placeholder text when no user selected */
  placeholder?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Custom trigger class name */
  triggerClassName?: string;
}

/**
 * Get initials from a name
 */
function getInitials(name: string | null): string {
  if (!name) return "?";
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}

/**
 * Build BU path from nested structure
 */
function buildBUPath(bu: BusinessUnitNode | null): string {
  if (!bu) return "";
  const path: string[] = [];

  function collectPath(node: BusinessUnitNode | null) {
    if (!node) return;
    if (node.parent) collectPath(node.parent);
    path.push(node.name);
  }

  collectPath(bu);
  return path.join(" > ");
}

export function AssigneePicker({
  value,
  onChange,
  suggestedFromBUs = [],
  placeholder = "Select assignee...",
  disabled = false,
  triggerClassName,
}: AssigneePickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const commandRef = useRef<HTMLDivElement>(null);

  // Fetch users with BU-based suggestions
  const { data, isLoading } = api.user.listForAssignment.useQuery({
    prioritizeBUIds: suggestedFromBUs,
    search: search || undefined,
  });

  // Find selected user from data
  const selectedUser = useMemo(() => {
    if (!value || !data) return null;
    return (
      data.suggested.find((u) => u.id === value) ??
      data.others.find((u) => u.id === value)
    );
  }, [value, data]);

  // Handle selection
  const handleSelect = useCallback(
    (userId: string | null) => {
      onChange(userId);
      setOpen(false);
      setSearch("");
    },
    [onChange]
  );

  // Clear search when popover closes
  useEffect(() => {
    if (!open) {
      setSearch("");
      setFocusedIndex(-1);
    }
  }, [open]);

  // AC15: Check if we should show sections
  const hasSuggestions = (data?.suggested.length ?? 0) > 0;
  const hasOthers = (data?.others.length ?? 0) > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={placeholder}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !selectedUser && "text-muted-foreground",
            triggerClassName
          )}
        >
          {/* AC19/AC20: Trigger display */}
          {selectedUser ? (
            <span className="flex items-center gap-2 truncate">
              <Avatar className="h-5 w-5">
                <AvatarImage src={selectedUser.image ?? undefined} />
                <AvatarFallback className="text-[10px]">
                  {getInitials(selectedUser.name)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">{selectedUser.name || "Unknown"}</span>
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <User className="h-4 w-4" />
              {placeholder}
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command ref={commandRef} shouldFilter={false}>
          {/* AC4: Search input */}
          <CommandInput
            placeholder="Search by name or email..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {/* Empty state */}
            {isLoading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Loading users...
              </div>
            ) : !hasSuggestions && !hasOthers ? (
              <CommandEmpty>No users found.</CommandEmpty>
            ) : (
              <>
                {/* AC6: Clear/unassign option */}
                {value && (
                  <CommandItem
                    onSelect={() => handleSelect(null)}
                    className="text-muted-foreground"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Clear selection
                  </CommandItem>
                )}

                {/* AC11/AC13: Suggested section */}
                {hasSuggestions && (
                  <CommandGroup heading="Suggested from affected Business Units">
                    {data!.suggested.map((user) => (
                      <AssigneeItem
                        key={user.id}
                        user={user}
                        isSelected={value === user.id}
                        onSelect={() => handleSelect(user.id)}
                        isSuggested
                      />
                    ))}
                  </CommandGroup>
                )}

                {/* AC12/AC13: All Users section */}
                {hasOthers && (
                  <CommandGroup heading={hasSuggestions ? "All Users" : undefined}>
                    {data!.others.map((user) => (
                      <AssigneeItem
                        key={user.id}
                        user={user}
                        isSelected={value === user.id}
                        onSelect={() => handleSelect(user.id)}
                        isSuggested={false}
                      />
                    ))}
                  </CommandGroup>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Assignee Item Component
 *
 * @see AC16-AC18: Visual design for each user item
 */
interface AssigneeItemProps {
  user: AssigneeUser;
  isSelected: boolean;
  onSelect: () => void;
  isSuggested: boolean;
}

function AssigneeItem({
  user,
  isSelected,
  onSelect,
  isSuggested,
}: AssigneeItemProps) {
  const buPath = useMemo(() => {
    return buildBUPath(user.businessUnit);
  }, [user.businessUnit]);

  return (
    <CommandItem
      value={user.id}
      onSelect={onSelect}
      className={cn(isSuggested && "bg-primary/5")}
    >
      <div className="flex items-center gap-3 w-full">
        {/* AC18: Avatar with initials */}
        <Avatar className="h-8 w-8">
          <AvatarImage src={user.image ?? undefined} />
          <AvatarFallback className="text-xs">
            {getInitials(user.name)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          {/* Name */}
          <div className="font-medium truncate">
            {user.name || "Unknown User"}
          </div>
          {/* AC17: BU path or email */}
          <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
            {buPath ? (
              <>
                <Building2 className="h-3 w-3 shrink-0" />
                <span className="truncate">{buPath}</span>
              </>
            ) : (
              user.email
            )}
          </div>
        </div>

        {/* Selected indicator */}
        {isSelected && <Check className="h-4 w-4 shrink-0" />}
      </div>
    </CommandItem>
  );
}
