/**
 * Business Unit Picker Component
 *
 * Story 7.0.5: BU Hierarchy Picker Component
 *
 * A reusable tree-based picker for selecting business units.
 * Supports single-select (radio) and multi-select (checkbox) modes.
 *
 * @see AC1-AC8: Base picker component
 * @see AC15-AC19: Selection behavior
 * @see AC25-AC28: Search/filter functionality
 */

"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { api } from "@/trpc/react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Search,
  Building2,
} from "lucide-react";

// Tree node type matching the businessUnit.list query
interface TreeNode {
  id: string;
  name: string;
  code: string | null;
  parentId: string | null;
  isActive: boolean;
  sortOrder: number;
  depth: number;
  _count: {
    users: number;
    children: number;
  };
  children: TreeNode[];
}

export interface BusinessUnitPickerProps {
  /** Selection mode: single (radio) or multi (checkbox) */
  mode: "single" | "multi";
  /** Selected value(s) - string for single, string[] for multi, null for none */
  value: string | string[] | null;
  /** Callback when selection changes */
  onChange: (value: string | string[] | null) => void;
  /** Placeholder text for search input */
  placeholder?: string;
  /** Maximum selections allowed (multi-mode only) */
  maxSelections?: number;
  /** Disabled state */
  disabled?: boolean;
  /** Custom class name */
  className?: string;
  /** Auto-focus search on mount */
  autoFocus?: boolean;
}

/**
 * Filter tree nodes by search query, keeping ancestors of matches
 */
function filterTreeBySearch(
  nodes: TreeNode[],
  search: string
): { filtered: TreeNode[]; matchedIds: Set<string> } {
  const normalizedSearch = search.toLowerCase().trim();
  const matchedIds = new Set<string>();

  function markMatches(node: TreeNode): boolean {
    const nameMatches = node.name.toLowerCase().includes(normalizedSearch);
    const codeMatches = node.code?.toLowerCase().includes(normalizedSearch);
    const selfMatches = nameMatches || codeMatches;

    // Check children recursively
    let hasMatchingChild = false;
    for (const child of node.children) {
      if (markMatches(child)) {
        hasMatchingChild = true;
      }
    }

    if (selfMatches || hasMatchingChild) {
      matchedIds.add(node.id);
      return true;
    }

    return false;
  }

  // Mark all matching nodes and their ancestors
  nodes.forEach(markMatches);

  // Filter tree keeping only matched nodes
  function filterNodes(nodes: TreeNode[]): TreeNode[] {
    return nodes
      .filter((node) => matchedIds.has(node.id))
      .map((node) => ({
        ...node,
        children: filterNodes(node.children),
      }));
  }

  return {
    filtered: filterNodes(nodes),
    matchedIds,
  };
}

/**
 * Get all ancestor IDs for a set of node IDs
 */
function getAncestorIds(nodes: TreeNode[], targetIds: Set<string>): Set<string> {
  const ancestorIds = new Set<string>();

  function findAncestors(node: TreeNode, path: string[]): void {
    if (targetIds.has(node.id)) {
      path.forEach((id) => ancestorIds.add(id));
    }
    node.children.forEach((child) => {
      findAncestors(child, [...path, node.id]);
    });
  }

  nodes.forEach((node) => findAncestors(node, []));
  return ancestorIds;
}

export function BusinessUnitPicker({
  mode,
  value,
  onChange,
  placeholder = "Search business units...",
  maxSelections,
  disabled = false,
  className,
  autoFocus = false,
}: BusinessUnitPickerProps) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch business unit tree
  const { data, isLoading } = api.businessUnit.list.useQuery({
    includeInactive: false,
  });

  // Convert value to Set for efficient lookup
  const selectedSet = useMemo(() => {
    if (!value) return new Set<string>();
    return new Set(Array.isArray(value) ? value : [value]);
  }, [value]);

  // Filter tree by search
  const { filteredTree, matchedIds } = useMemo(() => {
    if (!data?.tree) return { filteredTree: [], matchedIds: new Set<string>() };
    if (!search.trim()) return { filteredTree: data.tree, matchedIds: new Set<string>() };

    const { filtered, matchedIds } = filterTreeBySearch(data.tree, search);
    return { filteredTree: filtered, matchedIds };
  }, [data?.tree, search]);

  // Add ids to the expanded set, RETURNING THE SAME identity when nothing
  // changed — an unconditional `new Set(prev)` here caused an infinite
  // update loop (React #185) whenever the `value` prop identity was unstable:
  // effect runs → new Set → re-render → effect runs → ... React bails out on
  // identical state, breaking any such cycle (2026-07-06 crash fix).
  const expandIds = useCallback((ids: Iterable<string>) => {
    setExpanded((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const id of ids) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  // Auto-expand ancestors of search matches
  useEffect(() => {
    if (search.trim() && matchedIds.size > 0 && data?.tree) {
      const ancestors = getAncestorIds(data.tree, matchedIds);
      expandIds([...ancestors, ...matchedIds]);
    }
  }, [search, matchedIds, data?.tree, expandIds]);

  // Auto-expand ancestors of selected items on mount
  useEffect(() => {
    if (data?.tree && selectedSet.size > 0) {
      const ancestors = getAncestorIds(data.tree, selectedSet);
      expandIds(ancestors);
    }
  }, [data?.tree, selectedSet, expandIds]);

  // Auto-focus search input
  useEffect(() => {
    if (autoFocus && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [autoFocus]);

  // Build flat list for keyboard navigation
  const flatNodes = useMemo(() => {
    const result: TreeNode[] = [];

    function flatten(nodes: TreeNode[]) {
      nodes.forEach((node) => {
        result.push(node);
        if (expanded.has(node.id) && node.children.length > 0) {
          flatten(node.children);
        }
      });
    }

    flatten(filteredTree);
    return result;
  }, [filteredTree, expanded]);

  // Handle selection
  const handleSelect = useCallback(
    (nodeId: string) => {
      if (disabled) return;

      if (mode === "single") {
        // Single select: replace selection
        onChange(nodeId);
      } else {
        // Multi select: toggle
        const newSelected = new Set(selectedSet);
        if (newSelected.has(nodeId)) {
          newSelected.delete(nodeId);
        } else {
          // Check max selections
          if (maxSelections && newSelected.size >= maxSelections) {
            return;
          }
          newSelected.add(nodeId);
        }
        onChange(newSelected.size > 0 ? Array.from(newSelected) : null);
      }
    },
    [mode, onChange, selectedSet, maxSelections, disabled]
  );

  // Toggle expand/collapse
  const toggleExpand = useCallback((nodeId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  // Keyboard navigation (AC8)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (flatNodes.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setFocusedIndex((prev) =>
            prev < flatNodes.length - 1 ? prev + 1 : prev
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setFocusedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;
        case "ArrowRight": {
          e.preventDefault();
          const focusedNode = flatNodes[focusedIndex];
          if (focusedNode && focusedNode.children.length > 0 && !expanded.has(focusedNode.id)) {
            toggleExpand(focusedNode.id);
          }
          break;
        }
        case "ArrowLeft": {
          e.preventDefault();
          const focusedNode = flatNodes[focusedIndex];
          if (focusedNode && expanded.has(focusedNode.id)) {
            toggleExpand(focusedNode.id);
          }
          break;
        }
        case "Enter":
        case " ":
          e.preventDefault();
          const focusedNode = flatNodes[focusedIndex];
          if (focusedNode) {
            handleSelect(focusedNode.id);
          }
          break;
      }
    },
    [flatNodes, focusedIndex, expanded, toggleExpand, handleSelect]
  );

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0 && containerRef.current) {
      const focusedElement = containerRef.current.querySelector(
        `[data-index="${focusedIndex}"]`
      );
      focusedElement?.scrollIntoView({ block: "nearest" });
    }
  }, [focusedIndex]);

  return (
    <div
      className={cn("border rounded-md", disabled && "opacity-50", className)}
      onKeyDown={handleKeyDown}
      tabIndex={disabled ? -1 : 0}
      role="tree"
      aria-label="Business unit selection"
    >
      {/* Search Input (AC25) */}
      <div className="p-2 border-b">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder={placeholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
            disabled={disabled}
            aria-label="Search business units"
          />
        </div>
      </div>

      {/* Tree Content */}
      <div
        ref={containerRef}
        className="max-h-64 overflow-auto p-2"
        role="group"
      >
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-8 w-4/5" />
          </div>
        ) : filteredTree.length === 0 ? (
          // No results (AC28)
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Building2 className="h-8 w-8 mb-2" />
            <p className="text-sm">
              {search.trim() ? "No business units match your search" : "No business units found"}
            </p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {filteredTree.map((node, index) => (
              <BusinessUnitPickerNode
                key={node.id}
                node={node}
                depth={0}
                mode={mode}
                selectedSet={selectedSet}
                onSelect={handleSelect}
                expanded={expanded}
                onToggleExpand={toggleExpand}
                disabled={disabled}
                maxReached={
                  mode === "multi" &&
                  maxSelections !== undefined &&
                  selectedSet.size >= maxSelections
                }
                focusedIndex={focusedIndex}
                flatIndex={flatNodes.findIndex((n) => n.id === node.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Selection summary */}
      {mode === "multi" && selectedSet.size > 0 && (
        <div className="px-2 py-1.5 border-t bg-muted/50 text-xs text-muted-foreground">
          {selectedSet.size} selected
          {maxSelections && ` (max ${maxSelections})`}
        </div>
      )}
    </div>
  );
}

/**
 * Tree Node Component
 *
 * @see AC9-AC14: Visual design requirements
 */
interface BusinessUnitPickerNodeProps {
  node: TreeNode;
  depth: number;
  mode: "single" | "multi";
  selectedSet: Set<string>;
  onSelect: (id: string) => void;
  expanded: Set<string>;
  onToggleExpand: (id: string, e?: React.MouseEvent) => void;
  disabled: boolean;
  maxReached: boolean;
  focusedIndex: number;
  flatIndex: number;
}

function BusinessUnitPickerNode({
  node,
  depth,
  mode,
  selectedSet,
  onSelect,
  expanded,
  onToggleExpand,
  disabled,
  maxReached,
  focusedIndex,
  flatIndex,
}: BusinessUnitPickerNodeProps) {
  const isSelected = selectedSet.has(node.id);
  const isExpanded = expanded.has(node.id);
  const hasChildren = node.children.length > 0;
  const isFocused = flatIndex === focusedIndex;
  const isDisabled = disabled || (maxReached && !isSelected);

  // Calculate flat indices for children
  let childStartIndex = flatIndex + 1;

  return (
    <div role="treeitem" aria-selected={isSelected} aria-expanded={hasChildren ? isExpanded : undefined}>
      {/* Node Row */}
      <div
        data-index={flatIndex}
        className={cn(
          "flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer transition-colors",
          "hover:bg-muted", // AC12: Hover state
          isSelected && "bg-primary/10", // AC14: Selected background
          isFocused && "ring-2 ring-primary ring-inset",
          isDisabled && "opacity-50 cursor-not-allowed"
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }} // AC9: Indentation
        onClick={() => !isDisabled && onSelect(node.id)}
        tabIndex={-1}
      >
        {/* Expand/Collapse (AC3) */}
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => onToggleExpand(node.id, e)}
            className="p-0.5 hover:bg-muted-foreground/20 rounded"
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          <span className="w-5" aria-hidden="true" />
        )}

        {/* Selection Control (AC4/AC5, AC11) — purely decorative (the row
            handles clicks; the treeitem carries aria-selected). A static
            element replaces the Radix Checkbox here: flipping a controlled
            Radix Checkbox inside this recursive tree triggered an infinite
            ref/setState loop (React #185) that crashed the page on select
            (2026-07-06). */}
        {mode === "multi" ? (
          <div
            className={cn(
              "h-4 w-4 shrink-0 rounded-sm border flex items-center justify-center",
              isSelected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-muted-foreground/50"
            )}
            aria-hidden="true"
          >
            {isSelected && <Check className="h-3 w-3" />}
          </div>
        ) : (
          <div
            className={cn(
              "h-4 w-4 rounded-full border-2 flex items-center justify-center",
              isSelected
                ? "border-primary bg-primary"
                : "border-muted-foreground/50"
            )}
            aria-hidden="true"
          >
            {isSelected && (
              <div className="h-2 w-2 rounded-full bg-primary-foreground" />
            )}
          </div>
        )}

        {/* Name */}
        <span className="flex-1 truncate">{node.name}</span>

        {/* Code badge */}
        {node.code && (
          <span className="text-xs text-muted-foreground font-mono">
            {node.code}
          </span>
        )}
      </div>

      {/* Children (AC10: Parent can be selected independently) */}
      {isExpanded && hasChildren && (
        <div role="group">
          {node.children.map((child, idx) => {
            const childFlatIndex = childStartIndex;
            // Count this child and all its visible descendants
            childStartIndex += 1;
            if (expanded.has(child.id)) {
              const countDescendants = (n: TreeNode): number => {
                let count = n.children.length;
                n.children.forEach((c) => {
                  if (expanded.has(c.id)) {
                    count += countDescendants(c);
                  }
                });
                return count;
              };
              childStartIndex += countDescendants(child);
            }

            return (
              <BusinessUnitPickerNode
                key={child.id}
                node={child}
                depth={depth + 1}
                mode={mode}
                selectedSet={selectedSet}
                onSelect={onSelect}
                expanded={expanded}
                onToggleExpand={onToggleExpand}
                disabled={disabled}
                maxReached={maxReached}
                focusedIndex={focusedIndex}
                flatIndex={childFlatIndex}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
