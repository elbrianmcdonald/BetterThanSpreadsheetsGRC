"use client";

/**
 * ControlPane (Epic 25, Story 25.3)
 *
 * One side of the dual-pane crosswalk workbench: a framework's controls with
 * server-side search, family filter, and pagination (NFR1). Source mode is
 * single-select (radio behaviour); target mode is multi-select (checkboxes).
 */

import { useEffect, useState } from "react";
import { api } from "@/trpc/react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Search, ChevronLeft, ChevronRight } from "lucide-react";

const ALL_FAMILIES = "__all__";
const PAGE_SIZE = 25;

export interface PaneControl {
  id: string;
  controlId: string;
  title: string;
  familyId: string;
}

export type PaneSource =
  | { type: "framework"; frameworkId: string }
  | { type: "orgControls" }
  | { type: "standard"; standardId: string; standardName?: string };

interface Props {
  source: PaneSource;
  mode: "source" | "target";
  /** Selected control ids (source: 0-1; target: 0-n) */
  selectedIds: Set<string>;
  onToggle: (control: PaneControl) => void;
  /** Controls already mapped from the selected source — badged in target mode */
  mappedTargetIds?: Set<string>;
}

export function ControlPane({ source, mode, selectedIds, onToggle, mappedTargetIds }: Props) {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [familyId, setFamilyId] = useState<string>(ALL_FAMILIES);
  const [page, setPage] = useState(1);

  // Debounce the search box (~250ms) so we don't query per keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const commonInput = {
    search: search || undefined,
    familyId: familyId === ALL_FAMILIES ? undefined : familyId,
    page,
    pageSize: PAGE_SIZE,
  };
  const fwQuery = api.crosswalk.listFrameworkControls.useQuery(
    { frameworkId: source.type === "framework" ? source.frameworkId : "", ...commonInput },
    { enabled: source.type === "framework", placeholderData: (prev) => prev },
  );
  const ocQuery = api.crosswalk.listOrgControls.useQuery(commonInput, {
    enabled: source.type === "orgControls",
    placeholderData: (prev) => prev,
  });
  const stdQuery = api.crosswalk.listStandardControls.useQuery(
    { standardId: source.type === "standard" ? source.standardId : "", ...commonInput },
    { enabled: source.type === "standard", placeholderData: (prev) => prev },
  );
  const active =
    source.type === "framework" ? fwQuery : source.type === "standard" ? stdQuery : ocQuery;
  const { data, isLoading, isFetching } = active;
  const fwData = source.type === "framework" ? fwQuery.data : undefined;
  const paneTitle =
    source.type === "orgControls"
      ? "Organizational Controls"
      : source.type === "standard"
        ? (source.standardName ?? "Standard Controls")
        : (fwData?.framework?.name ?? null);
  const paneCode = fwData?.framework?.code ?? null;

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {paneTitle ? (
            <>
              {paneTitle}
              {paneCode && <Badge variant="outline">{paneCode}</Badge>}
            </>
          ) : (
            <span className="text-muted-foreground">Loading…</span>
          )}
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            {mode === "source" ? "Source" : "Target"}
          </span>
        </CardTitle>
        <div className="flex flex-col gap-2 pt-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
            <Input
              placeholder="Search control ID or title…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
              aria-label={`Search ${mode} controls`}
            />
          </div>
          <Select
            value={familyId}
            onValueChange={(v) => {
              setFamilyId(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="sm:w-48" aria-label={`Filter ${mode} by family`}>
              <SelectValue placeholder="All families" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FAMILIES}>All families</SelectItem>
              {(data?.families ?? []).map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.controlId} — {f.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/70" />
          </div>
        ) : !data || data.controls.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No controls match your filters.
          </p>
        ) : (
          <div className="max-h-[420px] space-y-1 overflow-y-auto pr-1">
            {data.controls.map((c) => {
              const selected = selectedIds.has(c.id);
              const alreadyMapped = mappedTargetIds?.has(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onToggle(c)}
                  className={`flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors ${
                    selected
                      ? "border-primary bg-primary/5"
                      : "border-transparent hover:bg-secondary"
                  }`}
                >
                  {mode === "target" ? (
                    <Checkbox checked={selected} className="pointer-events-none" />
                  ) : (
                    <span
                      className={`h-3.5 w-3.5 shrink-0 rounded-full border ${
                        selected ? "border-primary bg-primary" : "border-muted-foreground/40"
                      }`}
                    />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <Badge variant="code" className="shrink-0">{c.controlId}</Badge>
                      {alreadyMapped && (
                        <Badge variant="secondary" className="shrink-0 text-[10px]">mapped</Badge>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-sm text-foreground">{c.title}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
      {data && data.total > PAGE_SIZE && (
        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
          <span>
            {data.total} control{data.total === 1 ? "" : "s"}
            {isFetching && <Loader2 className="ml-2 inline h-3 w-3 animate-spin" />}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>
              {page} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
