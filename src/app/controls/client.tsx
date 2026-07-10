"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Shield,
  Plus,
  Search,
  Loader2,
  Filter,
  ShieldAlert,
  AlertCircle,
  X,
  FileSpreadsheet,
} from "lucide-react";
import {
  ControlType,
  ControlNature,
  AutomationLevel,
  OrgControlStatus,
  UserRole,
} from "@prisma/client";
import { api, type RouterOutputs } from "@/trpc/react";
import { AppLayout, PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BulkImportPanel } from "@/components/organizational-control/BulkImportPanel";
import type { OrgControlImportRow } from "@/lib/excel-org-control-import";
import {
  CONTROL_TYPE_OPTIONS,
  CONTROL_NATURE_OPTIONS,
  AUTOMATION_LEVEL_OPTIONS,
  ORG_CONTROL_STATUS_OPTIONS,
  labelForControlType,
  labelForOrgControlStatus,
} from "@/components/organizational-control/enum-labels";

const CAN_CREATE_CONTROL_ROLES: UserRole[] = [
  UserRole.ADMINISTRATOR,
  UserRole.ANALYST,
  UserRole.ANALYST,
];

const ANY = "__any__";
const PAGE_SIZE = 50;

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function isOverdue(date: Date | string | null | undefined): boolean {
  if (!date) return false;
  return new Date(date).getTime() < Date.now();
}

function initials(name: string | null | undefined, email: string | null | undefined): string {
  const src = name?.trim() || email?.trim() || "?";
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function orgControlStatusBadgeVariant(
  status: OrgControlStatus
): "success" | "warning" | "info" | "neutral" {
  switch (status) {
    case OrgControlStatus.IMPLEMENTED:
      return "success";
    case OrgControlStatus.PARTIALLY_IMPLEMENTED:
      return "warning";
    case OrgControlStatus.PLANNED:
      return "info";
    default:
      return "neutral";
  }
}

export function ControlsListClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const userRole = session?.user?.role as UserRole | undefined;
  const canCreate = !!userRole && CAN_CREATE_CONTROL_ROLES.includes(userRole);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<OrgControlStatus | typeof ANY>(ANY);
  const [controlType, setControlType] = useState<ControlType | typeof ANY>(ANY);
  const [nature, setNature] = useState<ControlNature | typeof ANY>(ANY);
  const [automationLevel, setAutomationLevel] = useState<AutomationLevel | typeof ANY>(ANY);
  const [family, setFamily] = useState<string>("");
  const [ownerId, setOwnerId] = useState<string>("");
  const [overdueOnly, setOverdueOnly] = useState(
    searchParams.get("overdue") === "true"
  );
  const [showArchived, setShowArchived] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([undefined]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<OrgControlImportRow[]>([]);
  const [importOwnerId, setImportOwnerId] = useState<string | null>(null);

  const utils = api.useUtils();

  const bulkCreateMutation = api.organizationalControl.bulkCreate.useMutation({
    onSuccess: (result) => {
      toast.success(
        `Imported ${result.count} control${result.count === 1 ? "" : "s"}`
      );
      void utils.organizationalControl.list.invalidate();
      void utils.organizationalControl.distinctFamilies.invalidate();
      setImportOpen(false);
      setImportRows([]);
      setImportOwnerId(null);
    },
    onError: (e) => toast.error(e.message || "Import failed"),
  });

  const { data: familiesData } = api.organizationalControl.distinctFamilies.useQuery();

  // Users list for owner filter
  const { data: ownerPool } = api.person.getAll.useQuery();

  const { data, isLoading, error } = api.organizationalControl.list.useQuery({
    search: search || undefined,
    status: status !== ANY ? status : undefined,
    controlType: controlType !== ANY ? controlType : undefined,
    nature: nature !== ANY ? nature : undefined,
    automationLevel: automationLevel !== ANY ? automationLevel : undefined,
    family: family || undefined,
    ownerId: ownerId || undefined,
    overdueTestsOnly: overdueOnly || undefined,
    hideDeprecated: !showArchived && status === ANY ? true : undefined,
    limit: PAGE_SIZE,
    cursor,
  });

  const hasActiveFilters =
    !!search ||
    status !== ANY ||
    controlType !== ANY ||
    nature !== ANY ||
    automationLevel !== ANY ||
    !!family ||
    !!ownerId ||
    overdueOnly;

  const resetFilters = () => {
    setSearch("");
    setStatus(ANY);
    setControlType(ANY);
    setNature(ANY);
    setAutomationLevel(ANY);
    setFamily("");
    setOwnerId("");
    setOverdueOnly(false);
    setCursor(undefined);
    setCursorStack([undefined]);
  };

  const goNext = () => {
    if (!data?.nextCursor) return;
    setCursorStack((s) => [...s, data.nextCursor]);
    setCursor(data.nextCursor);
  };

  const goPrev = () => {
    setCursorStack((s) => {
      if (s.length <= 1) return s;
      const next = s.slice(0, -1);
      setCursor(next[next.length - 1]);
      return next;
    });
  };

  const resetPagination = () => {
    setCursor(undefined);
    setCursorStack([undefined]);
  };

  const onFilterChange = (fn: () => void) => {
    fn();
    resetPagination();
  };

  return (
    <AppLayout breadcrumbs={[{ label: "Controls" }]}>
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          eyebrow="GOVERNANCE"
          title="Organizational Controls"
          icon={<Shield />}
          description="Author, classify, and operate the controls your organization runs."
          actions={
            canCreate && (
              <>
                <Button variant="outline" onClick={() => setImportOpen(true)}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Import from Excel
                </Button>
                <Button asChild>
                  <Link href="/controls/new">
                    <Plus className="h-4 w-4 mr-2" />
                    New Control
                  </Link>
                </Button>
              </>
            )
          }
        />

        {canCreate && (
          <Dialog open={importOpen} onOpenChange={setImportOpen}>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Import controls from Excel</DialogTitle>
                <DialogDescription>
                  Upload an .xlsx file to create multiple organizational
                  controls at once. Any row error blocks the entire import.
                </DialogDescription>
              </DialogHeader>

              <BulkImportPanel
                onRowsChange={setImportRows}
                onDefaultOwnerChange={setImportOwnerId}
                defaultOwnerId={importOwnerId}
              />

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setImportOpen(false)}
                  disabled={bulkCreateMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  disabled={
                    importRows.length === 0 || bulkCreateMutation.isPending
                  }
                  onClick={() =>
                    bulkCreateMutation.mutate({
                      controls: importRows,
                      defaultOwnerId: importOwnerId ?? undefined,
                    })
                  }
                >
                  {bulkCreateMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    `Import ${importRows.length || ""} control${importRows.length === 1 ? "" : "s"}`
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Search + filter toggle */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[260px] max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
              <Input
                placeholder="Search by ID, name, or description..."
                value={search}
                onChange={(e) => onFilterChange(() => setSearch(e.target.value))}
                className="pl-9"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setFiltersOpen((o) => !o)}
              className="gap-2"
            >
              <Filter className="h-4 w-4" />
              Filters
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-1">
                  On
                </Badge>
              )}
            </Button>
            {hasActiveFilters && (
              <Button variant="ghost" onClick={resetFilters} className="gap-2">
                <X className="h-4 w-4" />
                Clear
              </Button>
            )}
            <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={overdueOnly}
                onChange={(e) => onFilterChange(() => setOverdueOnly(e.target.checked))}
                className="h-4 w-4"
              />
              Overdue tests only
            </label>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => onFilterChange(() => setShowArchived(e.target.checked))}
                className="h-4 w-4"
              />
              Show archived
            </label>
          </div>

          {filtersOpen && (
            <Card>
              <CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="text-[12.5px] font-semibold text-secondary-foreground">Status</label>
                  <Select
                    value={status}
                    onValueChange={(v) =>
                      onFilterChange(() => setStatus(v as OrgControlStatus | typeof ANY))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ANY}>Any status</SelectItem>
                      {ORG_CONTROL_STATUS_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[12.5px] font-semibold text-secondary-foreground">Type</label>
                  <Select
                    value={controlType}
                    onValueChange={(v) =>
                      onFilterChange(() => setControlType(v as ControlType | typeof ANY))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ANY}>Any type</SelectItem>
                      {CONTROL_TYPE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[12.5px] font-semibold text-secondary-foreground">Nature</label>
                  <Select
                    value={nature}
                    onValueChange={(v) =>
                      onFilterChange(() => setNature(v as ControlNature | typeof ANY))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any nature" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ANY}>Any nature</SelectItem>
                      {CONTROL_NATURE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[12.5px] font-semibold text-secondary-foreground">Automation</label>
                  <Select
                    value={automationLevel}
                    onValueChange={(v) =>
                      onFilterChange(() => setAutomationLevel(v as AutomationLevel | typeof ANY))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any automation" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ANY}>Any automation</SelectItem>
                      {AUTOMATION_LEVEL_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[12.5px] font-semibold text-secondary-foreground">Family</label>
                  <Select
                    value={family || ANY}
                    onValueChange={(v) =>
                      onFilterChange(() => setFamily(v === ANY ? "" : v))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any family" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ANY}>Any family</SelectItem>
                      {familiesData?.map((f) => (
                        <SelectItem key={f} value={f}>
                          {f}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[12.5px] font-semibold text-secondary-foreground">Owner</label>
                  <Select
                    value={ownerId || ANY}
                    onValueChange={(v) =>
                      onFilterChange(() => setOwnerId(v === ANY ? "" : v))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any owner" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ANY}>Any owner</SelectItem>
                      {ownerPool?.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                          {p.email && <span className="text-xs text-muted-foreground ml-2">{p.email}</span>}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Controls</CardTitle>
            <CardDescription>
              Click any row to open its detail view.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/70" />
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-2" />
                <p className="text-destructive">{error.message}</p>
              </div>
            ) : !data?.controls.length ? (
              <div className="text-center py-12">
                <ShieldAlert className="h-12 w-12 text-muted-foreground/70 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  {hasActiveFilters ? "No controls match these filters" : "No controls yet"}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {hasActiveFilters
                    ? "Try relaxing the filters above."
                    : "Define the first organizational control to start tracking ownership, testing, and evidence."}
                </p>
                {!hasActiveFilters && canCreate && (
                  <Button asChild>
                    <Link href="/controls/new">
                      <Plus className="h-4 w-4 mr-2" />
                      New Control
                    </Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Local ID</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Name</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Type</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Status</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Owners</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Frameworks</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Last tested</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Next due</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.controls.map((c) => (
                      <ControlRow key={c.id} control={c} onClick={() => router.push(`/controls/${c.id}`)} />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Pagination */}
            {data?.controls.length ? (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Page {cursorStack.length} · {data.controls.length} results
                  {data.nextCursor ? " (more available)" : ""}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={cursorStack.length === 1}
                    onClick={goPrev}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!data.nextCursor}
                    onClick={goNext}
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

type ListedControl = RouterOutputs["organizationalControl"]["list"]["controls"][number];

function ControlRow({
  control,
  onClick,
}: {
  control: ListedControl;
  onClick: () => void;
}) {
  const isDeprecated = control.status === OrgControlStatus.DEPRECATED;
  const overdue = isOverdue(control.nextTestDueDate);

  return (
    <TableRow
      className={`cursor-pointer hover:bg-secondary ${isDeprecated ? "opacity-60" : ""}`}
      onClick={onClick}
    >
      <TableCell>
        <Badge variant="code">{control.localControlId}</Badge>
      </TableCell>
      <TableCell className="max-w-[320px]">
        <div className="font-semibold text-foreground truncate">{control.name}</div>
        {control.family && (
          <div className="text-xs text-muted-foreground truncate">{control.family}</div>
        )}
      </TableCell>
      <TableCell>
        <Badge variant="neutral">
          {labelForControlType(control.controlType)}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant={orgControlStatusBadgeVariant(control.status)}>
          {labelForOrgControlStatus(control.status)}
        </Badge>
      </TableCell>
      <TableCell>
        <OwnerAvatars owners={control.Assignments} />
      </TableCell>
      <TableCell>
        {control._count.FrameworkMappings > 0 ? (
          <Badge variant="secondary">
            {control._count.FrameworkMappings} mapped
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground/70">—</span>
        )}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatDate(control.lastTestedDate)}
      </TableCell>
      <TableCell className={`text-sm ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
        {control.nextTestDueDate ? formatDate(control.nextTestDueDate) : "—"}
        {overdue && (
          <Badge variant="critical" className="ml-2">
            Overdue
          </Badge>
        )}
      </TableCell>
    </TableRow>
  );
}

function OwnerAvatars({ owners }: { owners: ListedControl["Assignments"] }) {
  if (!owners.length) {
    return <span className="text-xs text-muted-foreground/70">Unassigned</span>;
  }

  const shown = owners.slice(0, 3);
  const extra = owners.length - shown.length;

  return (
    <TooltipProvider>
      <div className="flex -space-x-2">
        {shown.map((a) => (
          <Tooltip key={a.id}>
            <TooltipTrigger asChild>
              <Avatar className="h-7 w-7 border-2 border-card">
                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                  {initials(a.Person.name, a.Person.email)}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>{a.Person.name}</TooltipContent>
          </Tooltip>
        ))}
        {extra > 0 && (
          <Avatar className="h-7 w-7 border-2 border-card">
            <AvatarFallback className="text-xs bg-muted text-secondary-foreground">
              +{extra}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </TooltipProvider>
  );
}
