"use client";

/**
 * Engagement Pathways panel (Epic 19 — exploitation pathways).
 *
 * The rich `ExploitationPathwayView` IS the main content of this tab. The panel
 * provides:
 *   - a compact header (eyebrow + one-line description),
 *   - a horizontal pathway SELECTOR bar (one pill per pathway from
 *     `api.pathway.listByAssessment`, showing name + step count), plus an inline
 *     "+ New pathway" control (`pathway.create`) and a delete control
 *     (`pathway.remove`) for the selected pathway,
 *   - the selected pathway's full `ExploitationPathwayView` (editable), which
 *     hosts inline "Add step" authoring in every flow mode.
 *
 * The first pathway is auto-selected on load. There is no separate "Open" step:
 * the view is always shown for the selected pathway.
 */

import { useEffect, useState } from "react";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Loader2, Plus, Trash2, Route, X } from "lucide-react";
import { ExploitationPathwayView } from "@/components/pathway/ExploitationPathwayView";
import { FindingDrawerProvider } from "@/components/deliverable/FindingDrawerProvider";
import type { PathwayLike } from "@/components/pathway/types";
import type { AssessmentKind } from "./types";

interface Props {
  assessmentKind: AssessmentKind;
  assessmentId: string;
  readOnly?: boolean;
}

/** Minimal shape of a pathway in the selector list. */
interface PathwayListItem {
  id: string;
  name: string;
  steps: { id: string }[];
}

export function EngagementPathways({
  assessmentKind,
  assessmentId,
  readOnly,
}: Props) {
  const utils = api.useUtils();
  const listQuery = api.pathway.listByAssessment.useQuery({
    assessmentKind,
    assessmentId,
  });

  const pathways = (listQuery.data ?? []) as unknown as PathwayListItem[];

  const invalidateList = () =>
    utils.pathway.listByAssessment.invalidate({ assessmentKind, assessmentId });

  // ---- Selection ----
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Default-select the first pathway once loaded; keep selection valid if the
  // selected pathway is removed.
  useEffect(() => {
    if (pathways.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (!selectedId || !pathways.some((p) => p.id === selectedId)) {
      setSelectedId(pathways[0]!.id);
    }
  }, [pathways, selectedId]);

  // ---- New pathway ----
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const createPathway = api.pathway.create.useMutation({
    onSuccess: async (created) => {
      setNewName("");
      setAdding(false);
      await invalidateList();
      // Select the freshly created pathway.
      const id = (created as { id?: string } | undefined)?.id;
      if (id) setSelectedId(id);
    },
  });

  const removePathway = api.pathway.remove.useMutation({
    onSuccess: async () => {
      await invalidateList();
    },
  });

  // ---- Selected pathway detail ----
  const detailQuery = api.pathway.getById.useQuery(
    { id: selectedId ?? "" },
    { enabled: !!selectedId },
  );

  const refetchDetail = () => {
    if (selectedId) void utils.pathway.getById.invalidate({ id: selectedId });
    void invalidateList();
  };

  function submitNew() {
    const name = newName.trim();
    if (!name) return;
    createPathway.mutate({ assessmentKind, assessmentId, name });
  }

  return (
    <Card className="p-5">
      {/* Header */}
      <div className="mb-1 flex items-center gap-2">
        <Route className="h-4 w-4 text-primary" />
        <p className="eyebrow">Exploitation pathways</p>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Chain findings into MITRE ATT&amp;CK kill chains for this assessment.
        Select a pathway to view and edit its full narrative.
      </p>

      {listQuery.isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading pathways…
        </div>
      ) : (
        <>
          {/* Selector bar */}
          <div className="mb-5 flex flex-wrap items-center gap-2">
            {pathways.map((p) => {
              const selected = p.id === selectedId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors"
                  style={{
                    borderColor: selected ? "var(--primary)" : "var(--border)",
                    color: selected ? "var(--primary)" : "var(--foreground)",
                    background: selected
                      ? "color-mix(in oklch, var(--primary) 10%, transparent)"
                      : "var(--card)",
                  }}
                  aria-pressed={selected}
                >
                  <span className="max-w-[14rem] truncate">{p.name}</span>
                  <span
                    className="tnum rounded-full px-1.5 text-[11px]"
                    style={{
                      background: selected
                        ? "color-mix(in oklch, var(--primary) 16%, transparent)"
                        : "var(--muted)",
                      color: "var(--muted-foreground)",
                    }}
                  >
                    {p.steps.length}
                  </span>
                </button>
              );
            })}

            {/* New pathway control */}
            {!readOnly ? (
              adding ? (
                <div className="inline-flex items-center gap-1.5">
                  <Input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitNew();
                      if (e.key === "Escape") {
                        setAdding(false);
                        setNewName("");
                      }
                    }}
                    placeholder="Pathway name…"
                    className="h-8 w-56"
                  />
                  <Button
                    size="sm"
                    onClick={submitNew}
                    disabled={!newName.trim() || createPathway.isPending}
                  >
                    {createPathway.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Add"
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      setAdding(false);
                      setNewName("");
                    }}
                    aria-label="Cancel"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-dashed px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                  style={{ borderColor: "var(--border)" }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  New pathway
                </button>
              )
            ) : null}

            {/* Delete selected */}
            {!readOnly && selectedId ? (
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto h-8 w-8"
                onClick={() => removePathway.mutate({ id: selectedId })}
                disabled={removePathway.isPending}
                aria-label="Delete selected pathway"
              >
                {removePathway.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            ) : null}
          </div>

          {createPathway.error ? (
            <p className="mb-3 text-sm text-destructive">
              {createPathway.error.message}
            </p>
          ) : null}

          {/* Main content: the selected pathway's full view */}
          {pathways.length === 0 ? (
            <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
              Create your first exploitation pathway to start mapping a kill
              chain.
            </div>
          ) : detailQuery.isLoading || !detailQuery.data ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading pathway…
            </div>
          ) : (
            <FindingDrawerProvider>
              <ExploitationPathwayView
                pathway={detailQuery.data as unknown as PathwayLike}
                editable={!readOnly}
                assessmentKind={assessmentKind}
                assessmentId={assessmentId}
                onChanged={refetchDetail}
              />
            </FindingDrawerProvider>
          )}
        </>
      )}
    </Card>
  );
}
