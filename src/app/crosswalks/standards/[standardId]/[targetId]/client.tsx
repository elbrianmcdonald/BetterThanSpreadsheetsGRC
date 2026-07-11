"use client";

/**
 * Standard Crosswalk Workbench Client
 *
 * Left pane = a selected standard's controls; right pane = a framework.
 * Mappings persist to StandardControlMapping with StandardMappingType (OLIR).
 * Mirrors the org-control workbench, parameterized by standardId. Each Standard
 * is its own crosswalk source.
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
import { Loader2, GitCompare, ArrowRight, ArrowLeft, X, Download } from "lucide-react";
import { downloadExportFile } from "@/lib/download-file";
import { toast } from "sonner";
import { ControlPane, type PaneControl } from "@/components/crosswalk/ControlPane";
import {
  MAPPING_TYPE_OPTIONS,
  labelForMappingType,
} from "@/components/organizational-control/enum-labels";
import { type StandardMappingType } from "@prisma/client";

interface Props {
  standardId: string;
  targetFrameworkId: string;
}

export function StandardCrosswalkClient({ standardId, targetFrameworkId }: Props) {
  const utils = api.useUtils();
  const headerQuery = api.crosswalk.getStandardTarget.useQuery({ standardId, targetFrameworkId });

  const [source, setSource] = useState<PaneControl | null>(null);
  const [targetIds, setTargetIds] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");
  const standardControlId = source?.id ?? null;

  const currentMappings = api.crosswalk.listStandardControlMappingsForSource.useQuery(
    { standardControlId: standardControlId ?? "", targetFrameworkId },
    { enabled: !!standardControlId },
  );

  const mappedTargetIds = useMemo(
    () => new Set((currentMappings.data ?? []).map((m) => m.FrameworkControl.id)),
    [currentMappings.data],
  );

  const refresh = () => {
    void utils.crosswalk.listStandardControlMappingsForSource.invalidate();
    void utils.crosswalk.getStandardTarget.invalidate();
  };

  const createMappings = api.crosswalk.createStandardControlMappings.useMutation({
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
  const updateMapping = api.crosswalk.updateStandardControlMapping.useMutation({
    onSuccess: refresh,
    onError: (e) => toast.error(e.message || "Failed to update mapping"),
  });
  const deleteMapping = api.crosswalk.deleteStandardControlMapping.useMutation({
    onSuccess: refresh,
    onError: (e) => toast.error(e.message || "Failed to remove mapping"),
  });

  const [exporting, setExporting] = useState<null | "csv" | "xlsx">(null);
  const handleExport = async (format: "csv" | "xlsx") => {
    setExporting(format);
    try {
      const res = await utils.crosswalk.exportStandardCrosswalk.fetch(
        { standardId, targetFrameworkId, format, scope: "complete" },
        { staleTime: 0 }, // always export the current data, never a 30s-cached file
      );
      downloadExportFile(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(null);
    }
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
    if (!standardControlId || targetIds.size === 0) return;
    createMappings.mutate({
      standardControlId,
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
                  "The standard or target framework was not found in your organization."}
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
        { label: `${header.standard.name} ↔ ${header.target.code}` },
      ]}
    >
      <div className="px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <PageHeader
            eyebrow="GOVERNANCE"
            title="Standard Crosswalk"
            icon={<GitCompare />}
            description={`${header.standard.name} · ${header.standard.controlCount} controls → ${header.target.name} · ${header.mappingCount} mapping${header.mappingCount === 1 ? "" : "s"}`}
          />
          <div className="flex flex-wrap items-center gap-2">
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
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <ControlPane
            source={{ type: "standard", standardId, standardName: header.standard.name }}
            mode="source"
            selectedIds={standardControlId ? new Set([standardControlId]) : new Set()}
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

        {standardControlId && targetIds.size > 0 && (
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
              {standardControlId
                ? "Select framework controls on the right and pick a relationship. Edit type or notes, or remove, in place."
                : "Select a standard control on the left to see and edit its framework mappings."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!standardControlId ? (
              <div className="rounded-md border border-dashed border-border py-10 text-center text-muted-foreground">
                No standard control selected.
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

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowRight className="h-4 w-4" />
          Mapping {header.standard.name} → {header.target.code}. Relationships use NIST OLIR semantics.
        </div>
      </div>
    </AppLayout>
  );
}
