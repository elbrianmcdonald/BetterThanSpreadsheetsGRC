"use client";

/**
 * The one table every framework detail page renders.
 *
 * Purely presentational: it takes a normalized FrameworkNode tree, a column
 * config, and controlled expansion state. It does not fetch, and it does not
 * know whether it is showing a compliance framework or a maturity one.
 */

import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  Shield,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { flattenVisible, type FrameworkNode } from "@/lib/frameworks/framework-node";

export type NodeHealth = "HEALTHY" | "AT_RISK" | "CRITICAL";

export interface NodeHealthInfo {
  health: NodeHealth;
  riskCount: number;
  findingCount: number;
}

export interface FrameworkNodeTableColumns {
  level?: boolean;
  health?: boolean;
  domains?: boolean;
  testing?: boolean;
  children?: boolean;
  actions?: boolean;
}

export interface FrameworkNodeTableProps {
  nodes: FrameworkNode[];
  columns: FrameworkNodeTableColumns;
  expanded: ReadonlySet<string>;
  onToggleExpand: (node: FrameworkNode) => void;
  loadingChildIds?: ReadonlySet<string>;
  healthByNodeId?: ReadonlyMap<string, NodeHealthInfo>;
  onRowClick?: (node: FrameworkNode) => void;
  onEditTesting?: (node: FrameworkNode, focus: "ti" | "ac") => void;
  onEditDomains?: (node: FrameworkNode) => void;
  renderActions?: (node: FrameworkNode) => ReactNode;
  /** Flat search results: no chevrons, no indentation. */
  flat?: boolean;
  /** Header of the leftmost column. Compliance says "Control ID"; maturity says "Code". */
  idHeader?: string;
}

/** A node with no health data is unknown, never "compliant". */
function EmptyCell() {
  return <span className="text-muted-foreground">—</span>;
}

function HealthBadge({ health }: { health: NodeHealth }) {
  if (health === "CRITICAL") {
    return (
      <Badge variant="critical" className="gap-1">
        <ShieldAlert className="h-3 w-3" />
        Critical
      </Badge>
    );
  }
  if (health === "AT_RISK") {
    return (
      <Badge variant="warning" className="gap-1">
        <Shield className="h-3 w-3" />
        At Risk
      </Badge>
    );
  }
  return (
    <Badge variant="success" className="gap-1">
      <ShieldCheck className="h-3 w-3" />
      Healthy
    </Badge>
  );
}

/**
 * Colour a maturity row by its level so the hierarchy reads at a glance.
 * Token-based so both themes work; the chart tokens are the project's
 * categorical (non-semantic) palette, which is what a level is.
 */
function levelBadgeClass(levelLabel: string | null): string {
  if (levelLabel === "FUNCTION") return "border-transparent bg-chart-1/10 text-chart-1";
  if (levelLabel === "CATEGORY") return "border-transparent bg-chart-2/10 text-chart-2";
  return "";
}

function TestingCell({
  value,
  label,
  onEdit,
}: {
  value: string | null;
  label: string;
  onEdit: () => void;
}) {
  const handleClick = (e: MouseEvent) => {
    e.stopPropagation();
    onEdit();
  };

  if (value) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-6 max-w-[130px] px-1 text-xs"
        title={value}
        onClick={handleClick}
      >
        <Badge variant="secondary" className="max-w-full truncate text-xs">
          {value}
        </Badge>
      </Button>
    );
  }
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 px-2 text-xs text-muted-foreground"
      onClick={handleClick}
    >
      <Plus className="h-3 w-3 mr-1" />
      {label}
    </Button>
  );
}

export function FrameworkNodeTable({
  nodes,
  columns,
  expanded,
  onToggleExpand,
  loadingChildIds,
  healthByNodeId,
  onRowClick,
  onEditTesting,
  onEditDomains,
  renderActions,
  flat = false,
  idHeader = "Control ID",
}: FrameworkNodeTableProps) {
  const rows = flat ? nodes : flattenVisible(nodes, expanded);
  const columnCount =
    2 +
    (columns.level ? 1 : 0) +
    (columns.health ? 3 : 0) +
    (columns.domains ? 1 : 0) +
    (columns.testing ? 2 : 0) +
    (columns.children ? 1 : 0) +
    (columns.actions ? 1 : 0);

  return (
    <div className="overflow-hidden rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[180px]">{idHeader}</TableHead>
            <TableHead>Title</TableHead>
            {columns.level && <TableHead className="w-[120px]">Level</TableHead>}
            {columns.health && <TableHead className="w-[80px] text-center">Risks</TableHead>}
            {columns.health && <TableHead className="w-[80px] text-center">Findings</TableHead>}
            {columns.health && <TableHead className="w-[100px]">Health</TableHead>}
            {columns.domains && <TableHead className="w-[120px]">Domains</TableHead>}
            {columns.testing && <TableHead className="w-[140px]">Test Instructions</TableHead>}
            {columns.testing && <TableHead className="w-[140px]">Acceptance Criteria</TableHead>}
            {columns.children && <TableHead className="w-[100px]">Children</TableHead>}
            {columns.actions && <TableHead className="w-[80px]">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={columnCount} className="h-24 text-center text-muted-foreground">
                No matching rows.
              </TableCell>
            </TableRow>
          )}
          {rows.map((node) => {
            const isExpandable = !flat && node.childCount > 0;
            const isOpen = expanded.has(node.id);
            const isLoadingChildren = loadingChildIds?.has(node.id) ?? false;
            const healthInfo = healthByNodeId?.get(node.id);

            const handleRowKeyDown = onRowClick
              ? (e: KeyboardEvent<HTMLTableRowElement>) => {
                  if (e.key !== "Enter" && e.key !== " ") return;
                  // Space would otherwise scroll the page.
                  e.preventDefault();
                  onRowClick(node);
                }
              : undefined;

            return (
              <TableRow
                key={node.id}
                className={
                  onRowClick
                    ? "cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    : undefined
                }
                tabIndex={onRowClick ? 0 : undefined}
                role={onRowClick ? "button" : undefined}
                onClick={onRowClick ? () => onRowClick(node) : undefined}
                onKeyDown={handleRowKeyDown}
              >
                <TableCell className="font-mono text-sm">
                  <div
                    className="flex items-center gap-1.5"
                    style={{ paddingLeft: flat ? 0 : `${node.depth * 1.25}rem` }}
                  >
                    {isLoadingChildren ? (
                      <Loader2
                        aria-label={`Loading children of ${node.code}`}
                        className="h-4 w-4 shrink-0 animate-spin text-muted-foreground"
                      />
                    ) : isExpandable ? (
                      <button
                        type="button"
                        aria-label={`${isOpen ? "Collapse" : "Expand"} ${node.code}`}
                        aria-expanded={isOpen}
                        className="shrink-0 rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleExpand(node);
                        }}
                      >
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                    ) : (
                      <span className="w-4 shrink-0" />
                    )}
                    <span>{node.code}</span>
                  </div>
                </TableCell>

                <TableCell>
                  <p className="font-medium">{node.title}</p>
                  {node.description && (
                    <p className="text-sm text-muted-foreground truncate max-w-md">
                      {node.description}
                    </p>
                  )}
                </TableCell>

                {columns.level && (
                  <TableCell>
                    {node.levelLabel && (
                      <Badge variant="secondary" className={`text-xs ${levelBadgeClass(node.levelLabel)}`}>
                        {node.levelLabel}
                      </Badge>
                    )}
                  </TableCell>
                )}

                {columns.health && (
                  <TableCell className="text-center">
                    {healthInfo && healthInfo.riskCount > 0 ? (
                      <Badge variant="outline" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {healthInfo.riskCount}
                      </Badge>
                    ) : (
                      <EmptyCell />
                    )}
                  </TableCell>
                )}

                {columns.health && (
                  <TableCell className="text-center">
                    {healthInfo && healthInfo.findingCount > 0 ? (
                      <Badge variant="outline" className="gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {healthInfo.findingCount}
                      </Badge>
                    ) : (
                      <EmptyCell />
                    )}
                  </TableCell>
                )}

                {columns.health && (
                  <TableCell>
                    {/* No health data means unknown. Never assert "Healthy". */}
                    {healthInfo ? <HealthBadge health={healthInfo.health} /> : <EmptyCell />}
                  </TableCell>
                )}

                {columns.domains && (
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {node.domains && node.domains.length > 0 ? (
                        node.domains.map((d) => (
                          <Button
                            key={d.id}
                            variant="ghost"
                            size="sm"
                            className="h-6 px-1 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditDomains?.(node);
                            }}
                          >
                            <Badge variant="secondary" className="text-xs">
                              {d.code}
                            </Badge>
                          </Button>
                        ))
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-muted-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditDomains?.(node);
                          }}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add
                        </Button>
                      )}
                    </div>
                  </TableCell>
                )}

                {columns.testing && (
                  <TableCell>
                    <TestingCell
                      value={node.testInstructions}
                      label="TI"
                      onEdit={() => onEditTesting?.(node, "ti")}
                    />
                  </TableCell>
                )}

                {columns.testing && (
                  <TableCell>
                    <TestingCell
                      value={node.acceptanceCriteria}
                      label="AC"
                      onEdit={() => onEditTesting?.(node, "ac")}
                    />
                  </TableCell>
                )}

                {columns.children && (
                  <TableCell>
                    {node.childCount > 0 && (
                      <span className="text-sm text-muted-foreground">
                        {node.childCount} sub-controls
                      </span>
                    )}
                  </TableCell>
                )}

                {columns.actions && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {renderActions?.(node)}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
