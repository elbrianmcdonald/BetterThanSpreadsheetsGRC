"use client";

/**
 * MITRE Technique Picker Component
 *
 * Story 16.2: Risk Form MITRE Integration
 *
 * Provides a searchable picker dialog for selecting MITRE ATT&CK techniques.
 * Supports filtering by tactic and shows technique details.
 *
 * @see Story 16.2: Risk Form MITRE Integration
 */

import { useState, useCallback } from "react";
import { Search, ExternalLink, Check, X, Loader2 } from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

/**
 * Technique type for picker
 */
export interface TechniqueOption {
  id: string;
  externalId: string;
  name: string;
  isSubTechnique?: boolean;
  parent?: { id: string; externalId: string; name: string } | null;
  tactics?: { id: string; externalId: string; name: string; shortName: string }[];
}

interface MitreTechniquePickerProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog closes */
  onOpenChange: (open: boolean) => void;
  /** Callback when a technique is selected */
  onSelect: (technique: TechniqueOption) => void;
  /** Optional tactic filter (e.g., only show "Initial Access" techniques) */
  tacticFilter?: string[];
  /** Already selected technique IDs to exclude */
  excludeIds?: string[];
  /** Title for the dialog */
  title?: string;
  /** Description for the dialog */
  description?: string;
}

/**
 * Tactic badge colors
 */
function getTacticColor(shortName: string): string {
  const colors: Record<string, string> = {
    reconnaissance: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    "resource-development": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
    "initial-access": "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    execution: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    persistence: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    "privilege-escalation": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    "defense-evasion": "bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300",
    "credential-access": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    discovery: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    "lateral-movement": "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
    collection: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
    "command-and-control": "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
    exfiltration: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    impact: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  };
  return colors[shortName] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
}

export function MitreTechniquePicker({
  open,
  onOpenChange,
  onSelect,
  tacticFilter,
  excludeIds = [],
  title = "Select MITRE Technique",
  description = "Search and select a MITRE ATT&CK technique",
}: MitreTechniquePickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTacticId, setSelectedTacticId] = useState<string>("all");

  // Fetch tactics for filter dropdown
  const { data: tactics } = api.mitre.getTactics.useQuery(undefined, {
    enabled: open,
  });

  // Search techniques
  const { data: searchResults, isLoading } = api.mitre.searchTechniques.useQuery(
    {
      query: searchQuery || "",
      tacticId: selectedTacticId !== "all" ? selectedTacticId : undefined,
      includeSubTechniques: true,
      limit: 30,
    },
    {
      enabled: open && searchQuery.length > 0,
    }
  );

  // Get techniques by tactic when no search query
  const { data: tacticTechniques, isLoading: isLoadingTactic } = api.mitre.getTechniquesByTactic.useQuery(
    {
      tacticId: selectedTacticId,
      includeSubTechniques: true,
    },
    {
      enabled: open && !searchQuery && selectedTacticId !== "all",
    }
  );

  // Filter tactics if tacticFilter is provided
  const filteredTactics = tacticFilter?.length
    ? tactics?.filter((t) => tacticFilter.includes(t.shortName))
    : tactics;

  // Combine results
  const techniques = searchQuery
    ? searchResults?.filter((t) => !excludeIds.includes(t.id))
    : selectedTacticId !== "all"
    ? tacticTechniques?.filter((t) => !excludeIds.includes(t.id))
    : [];

  const handleSelect = useCallback(
    (technique: TechniqueOption) => {
      onSelect(technique);
      onOpenChange(false);
      setSearchQuery("");
    },
    [onSelect, onOpenChange]
  );

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setSearchQuery("");
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Search and Filter */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by technique ID or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={selectedTacticId} onValueChange={setSelectedTacticId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by tactic" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tactics</SelectItem>
                {filteredTactics?.map((tactic) => (
                  <SelectItem key={tactic.id} value={tactic.id}>
                    {tactic.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Results */}
          <ScrollArea className="h-[400px] border rounded-md">
            {(isLoading || isLoadingTactic) && (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {!isLoading && !isLoadingTactic && techniques?.length === 0 && (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <Search className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">
                  {searchQuery
                    ? "No techniques found"
                    : "Search or select a tactic to browse techniques"}
                </p>
              </div>
            )}

            {techniques && techniques.length > 0 && (
              <div className="divide-y">
                {techniques.map((technique) => (
                  <button
                    key={technique.id}
                    type="button"
                    className="w-full p-3 text-left hover:bg-muted/50 transition-colors"
                    onClick={() => handleSelect({
                      id: technique.id,
                      externalId: technique.externalId,
                      name: technique.name,
                      isSubTechnique: "isSubTechnique" in technique ? technique.isSubTechnique : false,
                      parent: "parent" in technique ? technique.parent : null,
                      tactics: "tactics" in technique ? technique.tactics : undefined,
                    })}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm font-medium text-primary">
                            {technique.externalId}
                          </span>
                          <span className="font-medium truncate">
                            {technique.name}
                          </span>
                          {"isSubTechnique" in technique && technique.isSubTechnique && "parent" in technique && technique.parent && (
                            <Badge variant="outline" className="text-xs">
                              Sub-technique of {technique.parent.externalId}
                            </Badge>
                          )}
                        </div>
                        {"tactics" in technique && technique.tactics && (
                          <div className="flex flex-wrap gap-1">
                            {technique.tactics.map((tactic) => (
                              <Badge
                                key={tactic.id}
                                variant="secondary"
                                className={cn("text-xs", getTacticColor(tactic.shortName))}
                              >
                                {tactic.name}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <Check className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Technique Card - displays a selected technique with remove action
 */
interface TechniqueCardProps {
  technique: TechniqueOption;
  onRemove?: () => void;
  isReadOnly?: boolean;
  className?: string;
}

export function TechniqueCard({
  technique,
  onRemove,
  isReadOnly = false,
  className,
}: TechniqueCardProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 p-2 rounded-md border bg-card",
        className
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-mono text-sm font-medium text-primary shrink-0">
          {technique.externalId}
        </span>
        <span className="text-sm truncate">{technique.name}</span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <a
          href={`https://attack.mitre.org/techniques/${technique.externalId.replace(".", "/")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1 hover:bg-muted rounded"
          title="View on MITRE ATT&CK"
        >
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
        </a>
        {!isReadOnly && onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1 hover:bg-destructive/10 rounded"
            title="Remove"
          >
            <X className="h-3.5 w-3.5 text-destructive" />
          </button>
        )}
      </div>
    </div>
  );
}
