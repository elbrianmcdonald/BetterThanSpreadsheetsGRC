"use client";

/**
 * Org-Control Crosswalk Workbench Client (Epic 25, Story 25.4)
 *
 * Left pane = organizational custom controls; right pane = a framework.
 * Mappings persist to OrgControlFrameworkMapping with StandardMappingType (OLIR).
 * Mirrors the framework workbench (Story 25.3) with org-control endpoints.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/trpc/react";
import { AppLayout, PageHeader } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, GitCompare, ArrowRight, ArrowLeft, X, Sparkles, Check, BarChart3, Download } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { downloadExportFile } from "@/lib/download-file";
import { toast } from "sonner";
import { ControlPane, type PaneControl } from "@/components/crosswalk/ControlPane";
import {
  MAPPING_TYPE_OPTIONS,
  labelForMappingType,
} from "@/components/organizational-control/enum-labels";
import { MappingStatus, type StandardMappingType } from "@prisma/client";

interface Props {
  targetFrameworkId: string;
}

export function OrgControlCrosswalkClient({ targetFrameworkId }: Props) {
  const utils = api.useUtils();
  const headerQuery = api.crosswalk.getOrgControlTarget.useQuery({ targetFrameworkId });

  const [source, setSource] = useState<PaneControl | null>(null);
  const [targetIds, setTargetIds] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());
  const [stagedTypes, setStagedTypes] = useState<Record<string, StandardMappingType>>({});
  const orgControlId = source?.id ?? null;

  const currentMappings = api.crosswalk.listOrgControlMappingsForSource.useQuery(
    { orgControlId: orgControlId ?? "", targetFrameworkId, statuses: [MappingStatus.CONFIRMED] },
    { enabled: !!orgControlId },
  );

  const suggestions = api.crosswalk.listSuggestions.useQuery({
    targetFrameworkId,
    status: MappingStatus.SUGGESTED,
  });

  const mappedTargetIds = useMemo(
    () => new Set((currentMappings.data ?? []).map((m) => m.FrameworkControl.id)),
    [currentMappings.data],
  );

  const refresh = () => {
    void utils.crosswalk.listOrgControlMappingsForSource.invalidate();
    void utils.crosswalk.getOrgControlTarget.invalidate();
    void utils.crosswalk.listSuggestions.invalidate();
    // Coverage is a sibling view that reflects these mappings — mark it stale
    // so navigating there (within the 30s cache window) shows fresh numbers.
    void utils.crosswalk.getFrameworkCoverage.invalidate();
    void utils.crosswalk.listFamilyControlsByStatus.invalidate();
  };

  const createMappings = api.crosswalk.createOrgControlMappings.useMutation({
    onSuccess: (res) => {
      setTargetIds(new Set());
      setNotes("");
      refresh();
      toast.success(
        res.created > 0
          ? `Added ${res.created} mapping${res.created === 1 ? "" : "s"}`
          : "No new mappings (already mapped)",
      );
    },
    onError: (e) => toast.error(e.message || "Failed to add mappings"),
  });
  const updateMapping = api.crosswalk.updateOrgControlMapping.useMutation({
    onSuccess: refresh,
    onError: (e) => toast.error(e.message || "Failed to update mapping"),
  });
  const deleteMapping = api.crosswalk.deleteOrgControlMapping.useMutation({
    onSuccess: refresh,
    onError: (e) => toast.error(e.message || "Failed to remove mapping"),
  });

  const generate = api.crosswalk.generateSuggestions.useMutation({
    onSuccess: (res) => {
      refresh();
      toast.success(
        res.generated > 0
          ? `Generated ${res.generated} suggestion${res.generated === 1 ? "" : "s"}`
          : "No new suggestions found",
      );
    },
    onError: (e) => toast.error(e.message || "Failed to generate suggestions"),
  });
  const unselectSuggestion = (id: string) =>
    setSelectedSuggestions((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  const confirmSuggestion = api.crosswalk.confirmSuggestion.useMutation({
    onSuccess: (_res, vars) => {
      unselectSuggestion(vars.id); // it left the SUGGESTED list — don't leave a phantom selection
      refresh();
      toast.success("Suggestion confirmed");
    },
    onError: (e) => toast.error(e.message || "Failed to confirm"),
  });
  const rejectSuggestion = api.crosswalk.rejectSuggestion.useMutation({
    onSuccess: (_res, vars) => {
      unselectSuggestion(vars.id);
      refresh();
      toast.success("Suggestion rejected");
    },
    onError: (e) => toast.error(e.message || "Failed to reject"),
  });
  const bulkReview = api.crosswalk.bulkReviewSuggestions.useMutation({
    onSuccess: (res, vars) => {
      setSelectedSuggestions(new Set());
      refresh();
      toast.success(`${vars.action === "CONFIRM" ? "Confirmed" : "Rejected"} ${res.updated}`);
    },
    onError: (e) => toast.error(e.message || "Bulk review failed"),
  });

  const [exporting, setExporting] = useState<null | "csv" | "xlsx">(null);
  const handleExport = async (format: "csv" | "xlsx") => {
    setExporting(format);
    try {
      const res = await utils.crosswalk.exportOrgControlCrosswalk.fetch(
        { targetFrameworkId, format, scope: "complete" },
        { staleTime: 0 }, // always export the current data, never a 30s-cached file
      );
      downloadExportFile(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(null);
    }
  };

  const toggleSuggestion = (id: string) => {
    setSelectedSuggestions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectSource = (control: PaneControl) => {
    setSource((prev) => (prev?.id === control.id ? null : control));
    setTargetIds(new Set());
  };
  const toggleTarget = (control: PaneControl) => {
    setTargetIds((prev) => {
      const next = new Set(prev);
      if (next.has(control.id)) next.delete(control.id);
      else next.add(control.id);
      return next;
    });
  };

  const applyRelationship = (mappingType: StandardMappingType) => {
    if (!orgControlId || targetIds.size === 0) return;
    createMappings.mutate({
      orgControlId,
      frameworkControlIds: Array.from(targetIds),
      mappingType,
      notes: notes.trim() || undefined,
    });
  };

  if (headerQuery.isLoading) {
    return (
      <AppLayout breadcrumbs={[{ label: "Governance" }, { label: "Crosswalks" }]}>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/70" />
        </div>
      </AppLayout>
    );
  }

  if (headerQuery.isError || !headerQuery.data) {
    return (
      <AppLayout breadcrumbs={[{ label: "Governance" }, { label: "Crosswalks" }]}>
        <div className="px-4 sm:px-6 lg:px-8 py-8">
          <Card>
            <CardHeader>
              <CardTitle>Crosswalk unavailable</CardTitle>
              <CardDescription>
                {headerQuery.error?.message ??
                  "The target framework was not found in your organization."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href="/crosswalks">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Crosswalks
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const header = headerQuery.data;

  return (
    <AppLayout
      breadcrumbs={[
        { label: "Governance" },
        { label: "Crosswalks", href: "/crosswalks" },
        { label: `Org Controls ↔ ${header.target.code}` },
      ]}
    >
      <div className="px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <PageHeader
            eyebrow="GOVERNANCE"
            title="Org Control Crosswalk"
            icon={<GitCompare />}
            description={`${header.orgControlCount} organizational controls → ${header.target.name} · ${header.mappingCount} mapping${header.mappingCount === 1 ? "" : "s"}`}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="ghost">
              <Link href={`/crosswalks/coverage/${targetFrameworkId}`}>
                <BarChart3 className="h-4 w-4 mr-2" />
                Coverage
              </Link>
            </Button>
            <Button variant="ghost" disabled={exporting !== null} onClick={() => handleExport("csv")}>
              {exporting === "csv" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              CSV
            </Button>
            <Button variant="ghost" disabled={exporting !== null} onClick={() => handleExport("xlsx")}>
              {exporting === "xlsx" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              XLSX
            </Button>
            <Button
              variant="outline"
              onClick={() => generate.mutate({ targetFrameworkId })}
              disabled={generate.isPending}
            >
              {generate.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Generate suggestions
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <ControlPane
            source={{ type: "orgControls" }}
            mode="source"
            selectedIds={orgControlId ? new Set([orgControlId]) : new Set()}
            onToggle={selectSource}
          />
          <ControlPane
            source={{ type: "framework", frameworkId: targetFrameworkId }}
            mode="target"
            selectedIds={targetIds}
            onToggle={toggleTarget}
            mappedTargetIds={mappedTargetIds}
          />
        </div>

        {orgControlId && targetIds.size > 0 && (
          <Card className="border-primary/40 bg-primary/5">
            <CardContent className="flex flex-wrap items-center gap-3 py-4">
              <span className="text-sm font-medium">
                Relationship for {targetIds.size} selected target{targetIds.size === 1 ? "" : "s"}:
              </span>
              <div className="flex flex-wrap gap-2">
                {MAPPING_TYPE_OPTIONS.map((o) => (
                  <Button
                    key={o.value}
                    size="sm"
                    variant="outline"
                    disabled={createMappings.isPending}
                    onClick={() => applyRelationship(o.value)}
                  >
                    {o.label}
                  </Button>
                ))}
              </div>
              <Input
                placeholder="Optional rationale (applies to all)…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={500}
                className="min-w-[220px] flex-1"
              />
              {createMappings.isPending && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              Current mappings
              {source && (
                <>
                  {" for "}
                  <Badge variant="code">{source.controlId}</Badge>
                  <span className="truncate text-sm font-normal text-muted-foreground">
                    {source.title}
                  </span>
                </>
              )}
            </CardTitle>
            <CardDescription>
              {orgControlId
                ? "Select framework controls on the right and pick a relationship. Edit type or notes, or remove, in place."
                : "Select an organizational control on the left to see and edit its framework mappings."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!orgControlId ? (
              <div className="rounded-md border border-dashed border-border py-10 text-center text-muted-foreground">
                No organizational control selected.
              </div>
            ) : currentMappings.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/70" />
              </div>
            ) : !currentMappings.data || currentMappings.data.length === 0 ? (
              <div className="rounded-md border border-dashed border-border py-10 text-center text-muted-foreground">
                No mappings yet for this control.
              </div>
            ) : (
              <div className="overflow-hidden rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Framework control</TableHead>
                      <TableHead className="w-[180px]">Relationship</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="w-[60px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentMappings.data.map((m) => (
                      <TableRow key={m.id} className="hover:bg-secondary">
                        <TableCell>
                          <Badge variant="code" className="mr-2">{m.FrameworkControl.controlId}</Badge>
                          <span className="text-sm">{m.FrameworkControl.title}</span>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={m.mappingType}
                            onValueChange={(v) =>
                              updateMapping.mutate({ id: m.id, mappingType: v as StandardMappingType })
                            }
                          >
                            <SelectTrigger className="h-8" aria-label="Relationship type">
                              <SelectValue>{labelForMappingType(m.mappingType)}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {MAPPING_TYPE_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            defaultValue={m.notes ?? ""}
                            placeholder="—"
                            className="h-8"
                            maxLength={500}
                            onBlur={(e) => {
                              const val = e.target.value.trim();
                              if (val !== (m.notes ?? "")) {
                                updateMapping.mutate({ id: m.id, notes: val || null });
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Remove mapping"
                            disabled={deleteMapping.isPending}
                            onClick={() => deleteMapping.mutate({ id: m.id })}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Suggested mappings review panel (Story 26.2) */}
        <Card className="border-amber-300/60 dark:border-amber-500/30">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  Suggested mappings
                  {suggestions.data && suggestions.data.length > 0 && (
                    <Badge variant="secondary">{suggestions.data.length}</Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  System-derived one-hop suggestions. Confirm to promote to a real mapping, or reject
                  (rejected suggestions are never re-proposed). Nothing is confirmed automatically.
                </CardDescription>
              </div>
              {selectedSuggestions.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{selectedSuggestions.size} selected</span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={bulkReview.isPending}
                    onClick={() =>
                      bulkReview.mutate({ ids: Array.from(selectedSuggestions), action: "CONFIRM" })
                    }
                  >
                    <Check className="h-4 w-4 mr-1" /> Confirm selected
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={bulkReview.isPending}
                    onClick={() =>
                      bulkReview.mutate({ ids: Array.from(selectedSuggestions), action: "REJECT" })
                    }
                  >
                    <X className="h-4 w-4 mr-1" /> Reject selected
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {suggestions.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/70" />
              </div>
            ) : !suggestions.data || suggestions.data.length === 0 ? (
              <div className="rounded-md border border-dashed border-border py-10 text-center text-muted-foreground">
                No suggestions. Use “Generate suggestions” after mapping org controls to other frameworks that
                crosswalk to {header.target.code}.
              </div>
            ) : (
              <div className="overflow-hidden rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[36px]" />
                      <TableHead>Org control</TableHead>
                      <TableHead>Framework control</TableHead>
                      <TableHead className="w-[150px]">Relationship</TableHead>
                      <TableHead className="w-[90px]">Confidence</TableHead>
                      <TableHead>Lineage</TableHead>
                      <TableHead className="w-[140px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suggestions.data.map((s) => {
                      const chain = (s.derivedVia as { chain?: string } | null)?.chain;
                      const conf = s.confidence;
                      const confClass =
                        conf >= 85
                          ? "bg-green-100 text-green-800 border-green-200"
                          : conf >= 60
                            ? "bg-amber-100 text-amber-800 border-amber-200"
                            : "bg-slate-100 text-slate-700 border-slate-200";
                      return (
                        <TableRow key={s.id} className="hover:bg-secondary">
                          <TableCell>
                            <Checkbox
                              checked={selectedSuggestions.has(s.id)}
                              onCheckedChange={() => toggleSuggestion(s.id)}
                              aria-label="Select suggestion"
                            />
                          </TableCell>
                          <TableCell>
                            <Badge variant="code" className="mr-2">{s.OrgControl.localControlId}</Badge>
                            <span className="text-sm">{s.OrgControl.name}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="code" className="mr-2">{s.FrameworkControl.controlId}</Badge>
                            <span className="text-sm">{s.FrameworkControl.title}</span>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={stagedTypes[s.id] ?? s.mappingType}
                              onValueChange={(v) =>
                                setStagedTypes((prev) => ({ ...prev, [s.id]: v as StandardMappingType }))
                              }
                            >
                              <SelectTrigger className="h-8" aria-label="Adjust relationship before confirming">
                                <SelectValue>{labelForMappingType(s.mappingType)}</SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {MAPPING_TYPE_OPTIONS.map((o) => (
                                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={confClass}>{conf}%</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {chain ? `via ${chain}` : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={confirmSuggestion.isPending}
                              onClick={() =>
                                confirmSuggestion.mutate({
                                  id: s.id,
                                  ...(stagedTypes[s.id] && stagedTypes[s.id] !== s.mappingType
                                    ? { mappingType: stagedTypes[s.id] }
                                    : {}),
                                })
                              }
                            >
                              <Check className="h-4 w-4 mr-1" /> Confirm
                            </Button>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              aria-label="Reject suggestion"
                              disabled={rejectSuggestion.isPending}
                              onClick={() => rejectSuggestion.mutate({ id: s.id })}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowRight className="h-4 w-4" />
          Mapping organizational controls → {header.target.code}. Relationships use NIST OLIR semantics.
        </div>
      </div>
    </AppLayout>
  );
}
