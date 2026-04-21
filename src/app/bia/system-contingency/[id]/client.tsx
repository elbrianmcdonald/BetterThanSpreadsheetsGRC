"use client";

/**
 * System Contingency BIA editor — one long page covering all NIST SP 800-34
 * template sections. Children (processes/resources/priorities) use a
 * replace-style save: user edits the full array locally, we send it on save
 * and the server rebuilds the child rows transactionally.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Download,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import {
  ContingencyBIAStatus,
  ContingencyImpactLevel,
  HasBCP,
} from "@prisma/client";
import { api, type RouterOutputs } from "@/trpc/react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type BIA = RouterOutputs["biaSystemContingency"]["getById"];
type ImpactCategory = RouterOutputs["biaSystemContingency"]["getImpactCategories"][number];

interface ProcessRow {
  id?: string;
  businessProcessId?: string | null;
  name: string;
  description: string;
  mtdHours: string;
  rtoHours: string;
  rpoHours: string;
  rpoNote: string;
  impacts: Record<string, ContingencyImpactLevel | "">; // categoryId → level
}

interface ResourceRow {
  id?: string;
  name: string;
  platformOsVersion: string;
  description: string;
}

interface PriorityRow {
  id?: string;
  priority: number;
  resourceName: string;
  component: string;
  rtoDescription: string;
  alternateStrategy: string;
}

function emptyProcess(): ProcessRow {
  return {
    name: "",
    description: "",
    mtdHours: "",
    rtoHours: "",
    rpoHours: "",
    rpoNote: "",
    impacts: {},
  };
}
function emptyResource(): ResourceRow {
  return { name: "", platformOsVersion: "", description: "" };
}
function emptyPriority(nextIdx: number): PriorityRow {
  return {
    priority: nextIdx,
    resourceName: "",
    component: "",
    rtoDescription: "",
    alternateStrategy: "",
  };
}

function toDateInput(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = new Date(d);
  return date.toISOString().slice(0, 10);
}

function parseIntOrNull(v: string): number | null {
  if (!v.trim()) return null;
  const n = parseInt(v.trim(), 10);
  return Number.isFinite(n) ? n : null;
}

export function SystemContingencyEditClient({ id }: { id: string }) {
  const router = useRouter();
  const utils = api.useUtils();

  const { data: bia, isLoading, error } =
    api.biaSystemContingency.getById.useQuery({ id });
  const { data: categories = [] } =
    api.biaSystemContingency.getImpactCategories.useQuery();

  const [status, setStatus] = useState<ContingencyBIAStatus>(
    ContingencyBIAStatus.DRAFT
  );
  const [hasBCP, setHasBCP] = useState<HasBCP | "">("");
  const [completionDate, setCompletionDate] = useState("");
  const [overview, setOverview] = useState("");
  const [systemDescription, setSystemDescription] = useState("");
  const [downtimeDrivers, setDowntimeDrivers] = useState("");
  const [alternateMeans, setAlternateMeans] = useState("");
  const [alternateStrategies, setAlternateStrategies] = useState("");

  const [processes, setProcesses] = useState<ProcessRow[]>([]);
  const [resources, setResources] = useState<ResourceRow[]>([]);
  const [priorities, setPriorities] = useState<PriorityRow[]>([]);

  // Hydrate state when the query lands
  useEffect(() => {
    if (!bia) return;
    setStatus(bia.status);
    setHasBCP(bia.hasBCP ?? "");
    setCompletionDate(toDateInput(bia.completionDate));
    setOverview(bia.overview ?? "");
    setSystemDescription(bia.systemDescription ?? "");
    setDowntimeDrivers(bia.downtimeDrivers ?? "");
    setAlternateMeans(bia.alternateMeans ?? "");
    setAlternateStrategies(bia.alternateStrategies ?? "");

    setProcesses(
      bia.processes.map((p): ProcessRow => {
        const impactMap: Record<string, ContingencyImpactLevel | ""> = {};
        for (const imp of p.impacts) {
          impactMap[imp.biaImpactCategoryId] = imp.level;
        }
        return {
          id: p.id,
          businessProcessId: p.businessProcessId,
          name: p.name,
          description: p.description ?? "",
          mtdHours: p.mtdHours?.toString() ?? "",
          rtoHours: p.rtoHours?.toString() ?? "",
          rpoHours: p.rpoHours?.toString() ?? "",
          rpoNote: p.rpoNote ?? "",
          impacts: impactMap,
        };
      })
    );

    setResources(
      bia.resources.map((r) => ({
        id: r.id,
        name: r.name,
        platformOsVersion: r.platformOsVersion ?? "",
        description: r.description ?? "",
      }))
    );

    setPriorities(
      bia.recoveryPriorities.map((p) => ({
        id: p.id,
        priority: p.priority,
        resourceName: p.resourceName,
        component: p.component ?? "",
        rtoDescription: p.rtoDescription ?? "",
        alternateStrategy: p.alternateStrategy ?? "",
      }))
    );
  }, [bia]);

  const updateMutation = api.biaSystemContingency.update.useMutation({
    onSuccess: () => {
      toast.success("Saved");
      void utils.biaSystemContingency.getById.invalidate({ id });
      void utils.biaSystemContingency.list.invalidate();
      router.push("/bia/processes");
    },
    onError: (e) => toast.error(e.message || "Save failed"),
  });

  const deleteMutation = api.biaSystemContingency.delete.useMutation({
    onSuccess: () => {
      toast.success("Deleted");
      router.push("/bia/processes");
    },
    onError: (e) => toast.error(e.message || "Delete failed"),
  });

  const handleSave = () => {
    if (!bia) return;
    updateMutation.mutate({
      id,
      data: {
        assetId: bia.assetId,
        businessProcessId: bia.businessProcessId,
        status,
        hasBCP: hasBCP || null,
        completionDate: completionDate ? new Date(completionDate) : null,
        overview: overview.trim() || null,
        systemDescription: systemDescription.trim() || null,
        downtimeDrivers: downtimeDrivers.trim() || null,
        alternateMeans: alternateMeans.trim() || null,
        alternateStrategies: alternateStrategies.trim() || null,
        processes: processes
          .filter((p) => p.name.trim())
          .map((p, i) => ({
            id: p.id,
            businessProcessId: p.businessProcessId ?? null,
            name: p.name.trim(),
            description: p.description.trim() || null,
            mtdHours: parseIntOrNull(p.mtdHours),
            rtoHours: parseIntOrNull(p.rtoHours),
            rpoHours: parseIntOrNull(p.rpoHours),
            rpoNote: p.rpoNote.trim() || null,
            sortOrder: i,
            impacts: Object.entries(p.impacts)
              .filter(([, lvl]) => !!lvl)
              .map(([biaImpactCategoryId, level]) => ({
                biaImpactCategoryId,
                level: level as ContingencyImpactLevel,
              })),
          })),
        resources: resources
          .filter((r) => r.name.trim())
          .map((r, i) => ({
            id: r.id,
            name: r.name.trim(),
            platformOsVersion: r.platformOsVersion.trim() || null,
            description: r.description.trim() || null,
            sortOrder: i,
          })),
        recoveryPriorities: priorities
          .filter((p) => p.resourceName.trim())
          .map((p, i) => ({
            id: p.id,
            priority: p.priority,
            resourceName: p.resourceName.trim(),
            component: p.component.trim() || null,
            rtoDescription: p.rtoDescription.trim() || null,
            alternateStrategy: p.alternateStrategy.trim() || null,
            sortOrder: i,
          })),
      },
    });
  };

  if (isLoading) {
    return (
      <AppLayout breadcrumbs={[{ label: "Business Impact" }]}>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </AppLayout>
    );
  }
  if (error || !bia) {
    return (
      <AppLayout breadcrumbs={[{ label: "Business Impact" }]}>
        <div className="container max-w-3xl mx-auto py-6">
          <p className="text-destructive">
            {error?.message ?? "BIA not found"}
          </p>
        </div>
      </AppLayout>
    );
  }

  const anchorLabel = bia.asset
    ? `${bia.asset.identifier} — ${bia.asset.name}`
    : bia.businessProcess
      ? `${bia.businessProcess.identifier} — ${bia.businessProcess.name}`
      : "—";

  return (
    <AppLayout
      breadcrumbs={[
        { label: "Assessments" },
        { label: "BIA Assessment", href: "/bia/processes" },
        { label: anchorLabel },
      ]}
    >
      <div className="container max-w-5xl mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              BIA Assessment
            </h1>
            <p className="text-muted-foreground mt-1 flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {bia.asset ? "Asset" : "Process"}
              </Badge>
              {bia.asset ? (
                <Link
                  href={`/assets/${bia.asset.id}`}
                  className="font-mono text-sm hover:underline"
                >
                  {anchorLabel}
                </Link>
              ) : bia.businessProcess ? (
                <Link
                  href={`/bia/processes/${bia.businessProcess.id}`}
                  className="font-mono text-sm hover:underline"
                >
                  {anchorLabel}
                </Link>
              ) : (
                <span className="font-mono text-sm">{anchorLabel}</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <a
                href={`/api/bia/system-contingency/${id}/pdf`}
                target="_blank"
                rel="noreferrer"
              >
                <Download className="h-4 w-4 mr-2" />
                Export PDF
              </a>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/bia/processes">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Link>
            </Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Header */}
        <Card>
          <CardHeader>
            <CardTitle>1. Overview</CardTitle>
            <CardDescription>
              Describe when the BIA was prepared and for which system/process.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Status</Label>
                <Select
                  value={status}
                  onValueChange={(v) =>
                    setStatus(v as ContingencyBIAStatus)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ContingencyBIAStatus.DRAFT}>
                      Draft
                    </SelectItem>
                    <SelectItem value={ContingencyBIAStatus.FINAL}>
                      Final
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Completion date</Label>
                <Input
                  type="date"
                  value={completionDate}
                  onChange={(e) => setCompletionDate(e.target.value)}
                />
              </div>
              <div>
                <Label>Business Continuity Plan in place?</Label>
                <Select
                  value={hasBCP || "UNSET"}
                  onValueChange={(v) =>
                    setHasBCP(v === "UNSET" ? "" : (v as HasBCP))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UNSET">Not yet evaluated</SelectItem>
                    <SelectItem value={HasBCP.YES}>Yes</SelectItem>
                    <SelectItem value={HasBCP.NO}>No</SelectItem>
                    <SelectItem value={HasBCP.NA}>N/A</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>1.1 Purpose — overview narrative</Label>
              <Textarea
                rows={5}
                value={overview}
                onChange={(e) => setOverview(e.target.value)}
                placeholder="Describe the purpose of this BIA and how it supports the ISCP."
              />
            </div>
          </CardContent>
        </Card>

        {/* System description */}
        <Card>
          <CardHeader>
            <CardTitle>2. System Description</CardTitle>
            <CardDescription>
              Architecture, operating environment, physical location, users,
              external partnerships, backup procedures, diagrams (reference
              the SSP here or attach).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              rows={6}
              value={systemDescription}
              onChange={(e) => setSystemDescription(e.target.value)}
              placeholder="General system description…"
            />
          </CardContent>
        </Card>

        {/* Processes */}
        <Card>
          <CardHeader>
            <CardTitle>3.1 Processes & Criticality</CardTitle>
            <CardDescription>
              Mission/business processes that depend on this system, with MTD,
              RTO, RPO, and per-category impact levels.
              {categories.length === 0 && (
                <span className="block mt-2 text-amber-700">
                  No active BIA impact categories configured — set them up in{" "}
                  <Link
                    href="/admin/bia-config"
                    className="underline"
                  >
                    BIA Configuration
                  </Link>{" "}
                  to enable the impact matrix.
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {processes.map((p, idx) => (
              <ProcessEditor
                key={idx}
                value={p}
                categories={categories}
                onChange={(patch) =>
                  setProcesses((list) =>
                    list.map((row, i) =>
                      i === idx ? { ...row, ...patch } : row
                    )
                  )
                }
                onRemove={() =>
                  setProcesses((list) => list.filter((_, i) => i !== idx))
                }
              />
            ))}
            <Button
              variant="outline"
              onClick={() =>
                setProcesses((list) => [...list, emptyProcess()])
              }
            >
              <Plus className="h-4 w-4 mr-2" />
              Add process
            </Button>
          </CardContent>
        </Card>

        {/* MTD/RTO/RPO drivers */}
        <Card>
          <CardHeader>
            <CardTitle>Downtime drivers & alternate means</CardTitle>
            <CardDescription>
              Drivers behind the MTDs/RTOs/RPOs above, and any alternate means
              (secondary processing or manual work-around).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Drivers (mandate, workload, performance measure…)</Label>
              <Textarea
                rows={3}
                value={downtimeDrivers}
                onChange={(e) => setDowntimeDrivers(e.target.value)}
              />
            </div>
            <div>
              <Label>Alternate means of recovery</Label>
              <Textarea
                rows={3}
                value={alternateMeans}
                onChange={(e) => setAlternateMeans(e.target.value)}
                placeholder="If none exist, so state."
              />
            </div>
          </CardContent>
        </Card>

        {/* Resources */}
        <Card>
          <CardHeader>
            <CardTitle>3.2 Resource Requirements</CardTitle>
            <CardDescription>
              Hardware, software, and other resources that compose the system.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>System Resource / Component</TableHead>
                  <TableHead>Platform / OS / Version</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-[40px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resources.map((r, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Input
                        value={r.name}
                        onChange={(e) =>
                          setResources((list) =>
                            list.map((row, i) =>
                              i === idx ? { ...row, name: e.target.value } : row
                            )
                          )
                        }
                        placeholder="Web Server 1"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={r.platformOsVersion}
                        onChange={(e) =>
                          setResources((list) =>
                            list.map((row, i) =>
                              i === idx
                                ? { ...row, platformOsVersion: e.target.value }
                                : row
                            )
                          )
                        }
                        placeholder="Optiplex GX280"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={r.description}
                        onChange={(e) =>
                          setResources((list) =>
                            list.map((row, i) =>
                              i === idx
                                ? { ...row, description: e.target.value }
                                : row
                            )
                          )
                        }
                        placeholder="Web Site Host"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setResources((list) =>
                            list.filter((_, i) => i !== idx)
                          )
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Button
              variant="outline"
              onClick={() =>
                setResources((list) => [...list, emptyResource()])
              }
            >
              <Plus className="h-4 w-4 mr-2" />
              Add resource
            </Button>
          </CardContent>
        </Card>

        {/* Recovery priorities */}
        <Card>
          <CardHeader>
            <CardTitle>3.3 Recovery Priorities</CardTitle>
            <CardDescription>
              Order of recovery following a worst-case disruption.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Priority</TableHead>
                  <TableHead>System Resource</TableHead>
                  <TableHead>Component</TableHead>
                  <TableHead>RTO</TableHead>
                  <TableHead>Alternate Strategy</TableHead>
                  <TableHead className="w-[40px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {priorities.map((p, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        value={p.priority}
                        onChange={(e) =>
                          setPriorities((list) =>
                            list.map((row, i) =>
                              i === idx
                                ? {
                                    ...row,
                                    priority: parseInt(e.target.value, 10) || 1,
                                  }
                                : row
                            )
                          )
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={p.resourceName}
                        onChange={(e) =>
                          setPriorities((list) =>
                            list.map((row, i) =>
                              i === idx
                                ? { ...row, resourceName: e.target.value }
                                : row
                            )
                          )
                        }
                        placeholder="Web Server 1"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={p.component}
                        onChange={(e) =>
                          setPriorities((list) =>
                            list.map((row, i) =>
                              i === idx
                                ? { ...row, component: e.target.value }
                                : row
                            )
                          )
                        }
                        placeholder="Optiplex GX280"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={p.rtoDescription}
                        onChange={(e) =>
                          setPriorities((list) =>
                            list.map((row, i) =>
                              i === idx
                                ? { ...row, rtoDescription: e.target.value }
                                : row
                            )
                          )
                        }
                        placeholder="24 hours to rebuild or replace"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={p.alternateStrategy}
                        onChange={(e) =>
                          setPriorities((list) =>
                            list.map((row, i) =>
                              i === idx
                                ? { ...row, alternateStrategy: e.target.value }
                                : row
                            )
                          )
                        }
                        placeholder="Spare server; vendor support contract"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setPriorities((list) =>
                            list.filter((_, i) => i !== idx)
                          )
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Button
              variant="outline"
              onClick={() =>
                setPriorities((list) => [
                  ...list,
                  emptyPriority(list.length + 1),
                ])
              }
            >
              <Plus className="h-4 w-4 mr-2" />
              Add priority
            </Button>

            <div className="mt-4">
              <Label>Alternate recovery strategies (narrative)</Label>
              <Textarea
                rows={3}
                value={alternateStrategies}
                onChange={(e) => setAlternateStrategies(e.target.value)}
                placeholder="Spare equipment, vendor contracts, failover sites…"
              />
            </div>
          </CardContent>
        </Card>

        {/* Bottom save bar — mirrors the top Save button for long-scroll forms */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" asChild>
            <Link href="/bia/processes">Cancel</Link>
          </Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save
              </>
            )}
          </Button>
        </div>

        {/* Danger zone */}
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Danger zone</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirm("Delete this BIA permanently?")) {
                  deleteMutation.mutate({ id });
                }
              }}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete BIA
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

function ProcessEditor(props: {
  value: ProcessRow;
  categories: ImpactCategory[];
  onChange: (patch: Partial<ProcessRow>) => void;
  onRemove: () => void;
}) {
  const { value, categories, onChange, onRemove } = props;

  return (
    <div className="rounded-md border p-4 space-y-3 bg-muted/30">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs uppercase">Name</Label>
            <Input
              value={value.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="Pay vendor invoice"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs uppercase">MTD (hrs)</Label>
              <Input
                type="number"
                min={0}
                value={value.mtdHours}
                onChange={(e) => onChange({ mtdHours: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs uppercase">RTO (hrs)</Label>
              <Input
                type="number"
                min={0}
                value={value.rtoHours}
                onChange={(e) => onChange({ rtoHours: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs uppercase">RPO (hrs)</Label>
              <Input
                type="number"
                min={0}
                value={value.rpoHours}
                onChange={(e) => onChange({ rpoHours: e.target.value })}
              />
            </div>
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs uppercase">Description</Label>
            <Input
              value={value.description}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="Process of obligating funds, issuing check or electronic payment…"
            />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs uppercase">RPO note</Label>
            <Input
              value={value.rpoNote}
              onChange={(e) => onChange({ rpoNote: e.target.value })}
              placeholder="e.g., last backup"
            />
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          aria-label="Remove process"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {categories.length > 0 && (
        <div>
          <Label className="text-xs uppercase">Impact by category</Label>
          <div className="mt-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between gap-2 rounded border bg-background p-2"
              >
                <span className="text-sm truncate" title={cat.description ?? undefined}>
                  {cat.name}
                </span>
                <Select
                  value={value.impacts[cat.id] ?? "NONE"}
                  onValueChange={(v) =>
                    onChange({
                      impacts: {
                        ...value.impacts,
                        [cat.id]:
                          v === "NONE" ? "" : (v as ContingencyImpactLevel),
                      },
                    })
                  }
                >
                  <SelectTrigger className="w-[130px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">—</SelectItem>
                    <SelectItem value={ContingencyImpactLevel.SEVERE}>
                      Severe
                    </SelectItem>
                    <SelectItem value={ContingencyImpactLevel.MODERATE}>
                      Moderate
                    </SelectItem>
                    <SelectItem value={ContingencyImpactLevel.MINIMAL}>
                      Minimal
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
