"use client";

/**
 * Crosswalks Landing Client (Epic 25, Story 25.2)
 *
 * - Existing crosswalk pairs (source → target) with mapping count + last-updated.
 * - "New Crosswalk" picker: choose any two loaded frameworks → open the workbench.
 *
 * The dual-pane mapping workbench itself is Story 25.3; here "Open" routes to the
 * read-only workbench shell at /crosswalks/[sourceId]/[targetId].
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import { AppLayout, PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, GitCompare, ArrowRight, Plus } from "lucide-react";

// Sentinel source value for crosswalking org custom controls (Story 25.4).
const ORG_CONTROLS = "__org_controls__";
// Sentinel prefix for crosswalking a specific standard's controls. The selected
// source value is `${STANDARD_PREFIX}${standardId}` so it carries which standard.
const STANDARD_PREFIX = "__standard__:";

function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function CrosswalksClient() {
  const router = useRouter();
  const [sourceId, setSourceId] = useState<string>("");
  const [targetId, setTargetId] = useState<string>("");

  const { data: frameworks, isLoading: frameworksLoading } =
    api.framework.list.useQuery({ isActive: true, includeControlCount: true });

  const { data: crosswalks, isLoading: crosswalksLoading } =
    api.crosswalk.listCrosswalks.useQuery();

  const { data: standardsData } = api.standard.list.useQuery({
    status: "ACTIVE",
    pageSize: 100,
  });
  const standards = standardsData?.standards ?? [];

  const isOrgSource = sourceId === ORG_CONTROLS;
  const isStandardSource = sourceId.startsWith(STANDARD_PREFIX);
  const canOpen =
    sourceId !== "" &&
    targetId !== "" &&
    (isOrgSource || isStandardSource || sourceId !== targetId);

  const openWorkbench = (s: string, t: string) => {
    router.push(`/crosswalks/${s}/${t}`);
  };
  const openSelectedWorkbench = () => {
    if (isOrgSource) router.push(`/crosswalks/org-controls/${targetId}`);
    else if (isStandardSource) {
      const standardId = sourceId.slice(STANDARD_PREFIX.length);
      router.push(`/crosswalks/standards/${standardId}/${targetId}`);
    } else openWorkbench(sourceId, targetId);
  };

  return (
    <AppLayout breadcrumbs={[{ label: "Governance" }, { label: "Crosswalks" }]}>
      <div className="px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <PageHeader
          eyebrow="GOVERNANCE"
          title="Crosswalks"
          icon={<GitCompare />}
          description="Map controls between any two loaded frameworks with NIST OLIR relationship semantics."
        />

        {/* New crosswalk picker */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Start a New Crosswalk</CardTitle>
            <CardDescription>
              Choose a source and a target framework. Both seeded and imported
              frameworks are available.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Source framework</label>
                <Select value={sourceId} onValueChange={setSourceId} disabled={frameworksLoading}>
                  <SelectTrigger aria-label="Source framework">
                    <SelectValue placeholder="Select source…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ORG_CONTROLS}>Organizational Controls</SelectItem>
                    {standards.length > 0 && (
                      <>
                        <SelectSeparator />
                        <SelectGroup>
                          <SelectLabel>Standards</SelectLabel>
                          {standards.map((s) => (
                            <SelectItem key={s.id} value={`${STANDARD_PREFIX}${s.id}`}>
                              {s.title}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                        <SelectSeparator />
                      </>
                    )}
                    <SelectGroup>
                      <SelectLabel>Frameworks</SelectLabel>
                      {(frameworks ?? []).map((f) => (
                        <SelectItem key={f.id} value={f.id} disabled={f.id === targetId}>
                          {f.name} ({f.code})
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <ArrowRight className="hidden sm:block h-5 w-5 mb-2.5 text-muted-foreground/70" />

              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Target framework</label>
                <Select value={targetId} onValueChange={setTargetId} disabled={frameworksLoading}>
                  <SelectTrigger aria-label="Target framework">
                    <SelectValue placeholder="Select target…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(frameworks ?? []).map((f) => (
                      <SelectItem key={f.id} value={f.id} disabled={f.id === sourceId}>
                        {f.name} ({f.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={openSelectedWorkbench}
                disabled={!canOpen}
                className="sm:mb-0"
              >
                <Plus className="h-4 w-4 mr-2" />
                Open Workbench
              </Button>
            </div>
            {frameworks && frameworks.length < 2 && (
              <p className="mt-3 text-sm text-muted-foreground">
                You need at least two active frameworks to build a crosswalk.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Existing crosswalks */}
        <Card>
          <CardHeader>
            <CardTitle>Existing Crosswalks</CardTitle>
            <CardDescription>
              Framework pairs that already have control mappings in your organization.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {crosswalksLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/70" />
              </div>
            ) : !crosswalks || crosswalks.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No crosswalks yet. Start one above.
              </p>
            ) : (
              <div className="overflow-hidden rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead className="text-right">Mappings</TableHead>
                      <TableHead>Last updated</TableHead>
                      <TableHead className="w-[100px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {crosswalks.map((c) => (
                      <TableRow
                        key={`${c.sourceFrameworkId}-${c.targetFrameworkId}`}
                        className="hover:bg-secondary"
                      >
                        <TableCell className="font-medium">
                          {c.source.name}{" "}
                          <Badge variant="outline" className="ml-1">{c.source.code}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {c.target.name}{" "}
                          <Badge variant="outline" className="ml-1">{c.target.code}</Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{c.mappingCount}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(c.lastUpdated)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              openWorkbench(c.sourceFrameworkId, c.targetFrameworkId)
                            }
                          >
                            Open
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
      </div>
    </AppLayout>
  );
}
