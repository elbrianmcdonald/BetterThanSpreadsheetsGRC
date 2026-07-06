"use client";

/**
 * Risk Registry Client Component
 *
 * Displays a searchable, filterable list of all risks with pagination.
 * Features TanStack Table with column visibility toggle and drag-and-drop reordering.
 *
 * Story 4.1: Risk Creation - Risk Registry list view
 * Story 5.5: Risk Filtering UI - Multi-select filters with URL state
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Plus,
  Search,
  Loader2,
  ShieldAlert,
  Clock,
  CheckCircle,
  XCircle,
  Download,
  Settings2,
  GripVertical,
  BarChart3,
} from "lucide-react";
import { UserRole } from "@prisma/client";
import toast from "react-hot-toast";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type VisibilityState,
  type ColumnOrderState,
} from "@tanstack/react-table";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Badge } from "@/components/ui/badge";
import { AppLayout, PageHeader, StatTile } from "@/components/layout";
import {
  RiskFilterPanel,
  type RiskFilters,
  parseFiltersFromURL,
} from "@/components/risk/RiskFilterPanel";
import { AssignAssessmentDialog } from "@/components/risk/AssignAssessmentDialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// localStorage keys for column persistence
const COLUMN_VISIBILITY_KEY = "risk-table-column-visibility";
const COLUMN_ORDER_KEY = "risk-table-column-order";

/**
 * Story 6.3: Roles that can create risks directly (without assessment)
 * Only ORG_ADMIN can create risks directly - all other users must use the
 * assessment workflow to discover and document risks.
 */
const CAN_CREATE_RISK_ROLES: UserRole[] = [
  UserRole.ORG_ADMIN,
];

/** Story 5.6 AC18: Roles that can export risks */
const CAN_EXPORT_RISK_ROLES: UserRole[] = [
  UserRole.GRC_ANALYST,
  UserRole.SECURITY_ENGINEER,
  UserRole.ORG_ADMIN,
  UserRole.AUDITOR,
];

/** Roles that can assign risk assessments to other users */
const CAN_ASSIGN_ASSESSMENT_ROLES: UserRole[] = [
  UserRole.GRC_ANALYST,
  UserRole.ORG_ADMIN,
];

/** Severity badge variants */
const severityConfig = {
  HIGH: { variant: "high" as const, label: "High" },
  MEDIUM: { variant: "warning" as const, label: "Medium" },
  LOW: { variant: "success" as const, label: "Low" },
};

/** Status badge variants */
const statusConfig = {
  DRAFT: { variant: "neutral" as const, label: "Draft", icon: Clock },
  PENDING_REVIEW: { variant: "warning" as const, label: "Pending Review", icon: Clock },
  OPEN: { variant: "info" as const, label: "Open", icon: AlertTriangle },
  ASSIGNED: { variant: "info" as const, label: "Assigned", icon: Clock },
  REMEDIATED: { variant: "success" as const, label: "Remediated", icon: CheckCircle },
  CLOSED: { variant: "neutral" as const, label: "Closed", icon: XCircle },
};

/** Impact score color based on value */
function getImpactScoreColor(score: number | null): string {
  if (score === null) return "text-muted-foreground/70";
  if (score >= 75) return "text-destructive";
  if (score >= 50) return "text-severity-high";
  if (score >= 25) return "text-warning";
  return "text-success";
}

/** Format date for display */
function formatDate(date: Date | string | null): string {
  if (!date) return "—";
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Truncate text with ellipsis */
function truncateText(text: string | null | undefined, maxLength: number): string {
  if (!text) return "—";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

// Risk data type from API
interface RiskData {
  id: string;
  identifier: string | null;
  title: string;
  description: string;
  affectedSystems: string | null;
  severity: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  discoveryDate: Date | null;
  assignedAt: Date | null;
  nextAuditDate: Date | null;
  assessmentDueDate: Date | null;
  impactScore: number | null;
  assetCriticality: string;
  inherentScore: unknown;
  inherentScoreLabel: string | null;
  residualScore: unknown;
  residualScoreLabel: string | null;
  // Story 22.4: derived scoring — the register reads effective
  effectiveScore: unknown;
  effectiveScoreLabel: string | null;
  effectiveScoreSource: string | null;
  findingSource: string | null;
  cveId: string | null;
  technicalDetails: string | null;
  businessImpactStatement: string | null;
  businessUnitId: string | null;
  itOwnerId: string | null;
  businessOwnerId: string | null;
  ITOwner: { id: string; name: string | null; email: string | null } | null;
  BusinessOwner: { id: string; name: string | null; email: string | null } | null;
  Assessor: { id: string; name: string | null; email: string | null } | null;
  remediationOptionsCount: number;
}

/** All available column IDs */
const ALL_COLUMN_IDS = [
  "identifier",
  "title",
  "severity",
  "impactScore",
  "status",
  "createdAt",
  "updatedAt",
  "description",
  "findingSource",
  "cveId",
  "discoveryDate",
  "itOwner",
  "businessOwner",
  "assessor",
  "assignedAt",
  "assetCriticality",
  "nextAuditDate",
  "inherentScore",
  "residualScore",
  "businessImpactStatement",
  "technicalDetails",
  "affectedSystems",
  "assessmentDueDate",
  "remediationOptionsCount",
] as const;

/** Default column visibility */
const DEFAULT_VISIBILITY: VisibilityState = {
  title: true,
  severity: true,
  impactScore: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  description: false,
  findingSource: false,
  cveId: false,
  discoveryDate: false,
  itOwner: false,
  businessOwner: false,
  assessor: false,
  assignedAt: false,
  assetCriticality: false,
  nextAuditDate: false,
  inherentScore: false,
  residualScore: false,
  businessImpactStatement: false,
  technicalDetails: false,
  affectedSystems: false,
  assessmentDueDate: false,
  remediationOptionsCount: false,
};

/** Column labels for display */
const COLUMN_LABELS: Record<string, string> = {
  title: "Title",
  severity: "Severity",
  impactScore: "Impact",
  status: "Status",
  createdAt: "Created",
  updatedAt: "Updated",
  description: "Description",
  findingSource: "Finding Source",
  cveId: "CVE ID",
  discoveryDate: "Discovery Date",
  itOwner: "IT Owner",
  businessOwner: "Business Owner",
  assessor: "Assessor",
  assignedAt: "Assigned Date",
  assetCriticality: "Asset Criticality",
  nextAuditDate: "Next Audit",
  inherentScore: "Inherent Score",
  residualScore: "Residual Score",
  businessImpactStatement: "Business Impact",
  technicalDetails: "Technical Details",
  affectedSystems: "Affected Systems",
  assessmentDueDate: "Assessment Due",
  remediationOptionsCount: "Remediation Options",
};

/** Draggable table header component */
function DraggableTableHeader({
  header,
  children,
}: {
  header: { id: string; column: { getCanSort: () => boolean } };
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: header.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? "grabbing" : "grab",
  };

  return (
    <TableHead ref={setNodeRef} style={style} className="group relative">
      <div className="flex items-center gap-1">
        <span
          {...attributes}
          {...listeners}
          className="cursor-grab opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground/70" />
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
          {children}
        </span>
      </div>
    </TableHead>
  );
}

export function RiskRegistryClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status: sessionStatus } = useSession();

  // Track client-side mount to prevent hydration mismatches
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const [search, setSearch] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Column visibility state
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(DEFAULT_VISIBILITY);

  // Column order state
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([...ALL_COLUMN_IDS]);

  // Load saved column visibility and order from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedVisibility = localStorage.getItem(COLUMN_VISIBILITY_KEY);
      if (savedVisibility) {
        try {
          setColumnVisibility(JSON.parse(savedVisibility) as VisibilityState);
        } catch {
          // Invalid JSON, use defaults
        }
      }

      const savedOrder = localStorage.getItem(COLUMN_ORDER_KEY);
      if (savedOrder) {
        try {
          setColumnOrder(JSON.parse(savedOrder) as ColumnOrderState);
        } catch {
          // Invalid JSON, use defaults
        }
      }
    }
  }, []);

  // Save column visibility to localStorage when it changes
  useEffect(() => {
    if (isMounted) {
      localStorage.setItem(COLUMN_VISIBILITY_KEY, JSON.stringify(columnVisibility));
    }
  }, [columnVisibility, isMounted]);

  // Save column order to localStorage when it changes
  useEffect(() => {
    if (isMounted) {
      localStorage.setItem(COLUMN_ORDER_KEY, JSON.stringify(columnOrder));
    }
  }, [columnOrder, isMounted]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Story 5.5: Parse filters from URL (AC21)
  const filters = useMemo(
    () => parseFiltersFromURL(searchParams),
    [searchParams]
  );

  // Check if user can create risks
  const userRole = session?.user?.role as UserRole | undefined;
  const canCreateRisk = userRole && CAN_CREATE_RISK_ROLES.includes(userRole);
  // Story 5.6 AC18: Check if user can export risks
  const canExportRisks = userRole && CAN_EXPORT_RISK_ROLES.includes(userRole);
  // Check if user can assign risk assessments
  const canAssignAssessments = userRole && CAN_ASSIGN_ASSESSMENT_ROLES.includes(userRole);

  // Story 5.5 AC16-AC18: Check if user can see owner filters
  const canFilterByOwner = userRole && (
    userRole === UserRole.GRC_ANALYST ||
    userRole === UserRole.SECURITY_ENGINEER ||
    userRole === UserRole.ORG_ADMIN ||
    userRole === UserRole.AUDITOR
  );

  // Story 5.6: Export mutation
  const exportMutation = api.risk.exportRisks.useMutation({
    onSuccess: (result) => {
      // AC4: Download CSV file with generated filename
      const blob = new Blob([result.data], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success(`Exported ${result.rowCount} risks to CSV`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to export risks");
    },
  });

  // Story 5.6 AC1-AC3: Export handler
  const handleExport = useCallback(() => {
    // AC2: Export respects active filters
    exportMutation.mutate({
      search: search || undefined,
      severity: filters.severity.length > 0 ? filters.severity : undefined,
      status: filters.status.length > 0 ? filters.status : undefined,
      findingSource: filters.findingSource.length > 0 ? filters.findingSource : undefined,
      frameworkId: filters.frameworkId ?? undefined,
      itOwnerId: filters.itOwnerId ?? undefined,
      businessOwnerId: filters.businessOwnerId ?? undefined,
    });
  }, [exportMutation, search, filters]);

  // Handler for filter changes
  const handleFiltersChange = useCallback((newFilters: RiskFilters) => {
    setPage(1); // Reset to first page when filters change
  }, []);

  // Story 5.5 AC23-AC26: Fetch risks with multi-select filters
  // NOTE: All hooks must be called before any early returns
  const { data, isLoading, error } = api.risk.list.useQuery({
    page,
    pageSize,
    search: search || undefined,
    // Story 5.5: Multi-select filters
    severity: filters.severity.length > 0 ? filters.severity : undefined,
    status: filters.status.length > 0 ? filters.status : undefined,
    findingSource: filters.findingSource.length > 0 ? filters.findingSource : undefined,
    frameworkId: filters.frameworkId ?? undefined,
    itOwnerId: filters.itOwnerId ?? undefined,
    businessOwnerId: filters.businessOwnerId ?? undefined,
    sortBy: "impactScore",
    sortOrder: "desc",
  });

  // Define column definitions
  const columns = useMemo<ColumnDef<RiskData>[]>(
    () => [
      {
        id: "identifier",
        accessorKey: "identifier",
        header: "ID",
        cell: ({ row }) => (
          <span className="font-mono text-sm text-muted-foreground">
            {row.original.identifier ?? "—"}
          </span>
        ),
        enableHiding: false,
      },
      {
        id: "title",
        accessorKey: "title",
        header: "Title",
        cell: ({ row }) => (
          <div className="min-w-[200px] max-w-[350px]">
            <p className="font-semibold text-foreground truncate">{row.original.title}</p>
            <p className="text-sm text-muted-foreground truncate">
              {truncateText(row.original.description, 80)}
            </p>
          </div>
        ),
        enableHiding: false,
      },
      {
        id: "severity",
        accessorKey: "severity",
        header: "Severity",
        cell: ({ row }) => {
          // Story 22.4: prefer the derived effective score/label (rollup or
          // manual override); coarse enum badge remains the legacy fallback.
          const effLabel = row.original.effectiveScoreLabel;
          const effScore =
            row.original.effectiveScore == null
              ? null
              : Number(row.original.effectiveScore);
          if (effLabel) {
            return (
              <span className="inline-flex items-center gap-1.5">
                <Badge>{effLabel}</Badge>
                {effScore !== null && (
                  <span className="font-mono text-xs text-muted-foreground">
                    {Number(effScore.toFixed(2))}
                  </span>
                )}
              </span>
            );
          }
          const severityStyle = severityConfig[row.original.severity as keyof typeof severityConfig];
          return (
            <Badge variant={severityStyle?.variant}>
              {severityStyle?.label}
            </Badge>
          );
        },
      },
      {
        id: "impactScore",
        accessorKey: "impactScore",
        header: "Impact",
        cell: ({ row }) => (
          <span className={`font-mono font-semibold tabular-nums ${getImpactScoreColor(row.original.impactScore)}`}>
            {row.original.impactScore ?? "—"}
          </span>
        ),
      },
      {
        id: "status",
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const statusStyle = statusConfig[row.original.status as keyof typeof statusConfig];
          const StatusIcon = statusStyle?.icon;
          return (
            <Badge variant={statusStyle?.variant}>
              {StatusIcon && <StatusIcon className="h-3 w-3 mr-1" />}
              {statusStyle?.label}
            </Badge>
          );
        },
      },
      {
        id: "createdAt",
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {formatDate(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: "updatedAt",
        accessorKey: "updatedAt",
        header: "Updated",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {formatDate(row.original.updatedAt)}
          </span>
        ),
      },
      {
        id: "description",
        accessorKey: "description",
        header: "Description",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground max-w-[300px] truncate block">
            {truncateText(row.original.description, 100)}
          </span>
        ),
      },
      {
        id: "findingSource",
        accessorKey: "findingSource",
        header: "Finding Source",
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.findingSource?.replace(/_/g, " ") ?? "—"}
          </span>
        ),
      },
      {
        id: "cveId",
        accessorKey: "cveId",
        header: "CVE ID",
        cell: ({ row }) => (
          <span className="text-sm font-mono">
            {row.original.cveId ?? "—"}
          </span>
        ),
      },
      {
        id: "discoveryDate",
        accessorKey: "discoveryDate",
        header: "Discovery Date",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {formatDate(row.original.discoveryDate)}
          </span>
        ),
      },
      {
        id: "itOwner",
        accessorFn: (row) => row.ITOwner?.name ?? row.ITOwner?.email,
        header: "IT Owner",
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.ITOwner?.name ?? row.original.ITOwner?.email ?? "—"}
          </span>
        ),
      },
      {
        id: "businessOwner",
        accessorFn: (row) => row.BusinessOwner?.name ?? row.BusinessOwner?.email,
        header: "Business Owner",
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.BusinessOwner?.name ?? row.original.BusinessOwner?.email ?? "—"}
          </span>
        ),
      },
      {
        id: "assessor",
        accessorFn: (row) => row.Assessor?.name ?? row.Assessor?.email,
        header: "Assessor",
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.Assessor?.name ?? row.original.Assessor?.email ?? "—"}
          </span>
        ),
      },
      {
        id: "assignedAt",
        accessorKey: "assignedAt",
        header: "Assigned Date",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {formatDate(row.original.assignedAt)}
          </span>
        ),
      },
      {
        id: "assetCriticality",
        accessorKey: "assetCriticality",
        header: "Asset Criticality",
        cell: ({ row }) => (
          <Badge variant="outline">
            {row.original.assetCriticality}
          </Badge>
        ),
      },
      {
        id: "nextAuditDate",
        accessorKey: "nextAuditDate",
        header: "Next Audit",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {formatDate(row.original.nextAuditDate)}
          </span>
        ),
      },
      {
        id: "inherentScore",
        accessorKey: "inherentScore",
        header: "Inherent Score",
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.inherentScoreLabel ??
              (row.original.inherentScore ? String(row.original.inherentScore) : "—")}
          </span>
        ),
      },
      {
        id: "residualScore",
        accessorKey: "residualScore",
        header: "Residual Score",
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.residualScoreLabel ??
              (row.original.residualScore ? String(row.original.residualScore) : "—")}
          </span>
        ),
      },
      {
        id: "businessImpactStatement",
        accessorKey: "businessImpactStatement",
        header: "Business Impact",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground max-w-[200px] truncate block">
            {truncateText(row.original.businessImpactStatement, 80)}
          </span>
        ),
      },
      {
        id: "technicalDetails",
        accessorKey: "technicalDetails",
        header: "Technical Details",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground max-w-[200px] truncate block">
            {truncateText(row.original.technicalDetails, 80)}
          </span>
        ),
      },
      {
        id: "affectedSystems",
        accessorKey: "affectedSystems",
        header: "Affected Systems",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground max-w-[200px] truncate block">
            {truncateText(row.original.affectedSystems, 80)}
          </span>
        ),
      },
      {
        id: "assessmentDueDate",
        accessorKey: "assessmentDueDate",
        header: "Assessment Due",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {formatDate(row.original.assessmentDueDate)}
          </span>
        ),
      },
      {
        id: "remediationOptionsCount",
        accessorKey: "remediationOptionsCount",
        header: "Remediation Options",
        cell: ({ row }) => (
          <Badge variant="secondary">
            {row.original.remediationOptionsCount}
          </Badge>
        ),
      },
    ],
    []
  );

  // Create table instance
  const table = useReactTable({
    data: (data?.risks ?? []) as RiskData[],
    columns,
    state: {
      columnVisibility,
      columnOrder,
    },
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });

  // Handle drag end for column reordering
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setColumnOrder((current) => {
        const oldIndex = current.indexOf(active.id as string);
        const newIndex = current.indexOf(over.id as string);
        return arrayMove(current, oldIndex, newIndex);
      });
    }
  }, []);

  // Loading state - include isMounted check to prevent hydration mismatch
  if (!isMounted || sessionStatus === "loading") {
    return (
      <AppLayout breadcrumbs={[{ label: "Risk Register" }]}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  // Redirect to login if not authenticated
  if (sessionStatus === "unauthenticated") {
    router.push("/login");
    return null;
  }

  return (
    <AppLayout breadcrumbs={[{ label: "Risk Register" }]}>
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          eyebrow="RISK MANAGEMENT"
          title="Risk Register"
          icon={<ShieldAlert />}
          description="Track and manage security risks across your organization."
          actions={
            <>
              {/* Link to Dashboard */}
              <Button variant="outline" asChild>
                <Link href="/risks/dashboard">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Dashboard
                </Link>
              </Button>
              {/* Story 5.6 AC1-AC3: Export to CSV button */}
              {canExportRisks && (
                <Button
                  variant="outline"
                  onClick={handleExport}
                  disabled={exportMutation.isPending}
                >
                  {exportMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Export to CSV
                </Button>
              )}
              {/* Risk Assessment Assignment button for managers */}
              {canAssignAssessments && (
                <AssignAssessmentDialog />
              )}
              {canCreateRisk && (
                <Button asChild>
                  <Link href="/risks/new">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Risk
                  </Link>
                </Button>
              )}
            </>
          }
        />

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatTile
            label="TOTAL RISKS"
            value={data?.total ?? 0}
            icon={<ShieldAlert />}
            tone="primary"
            accent
          />
          <StatTile
            label="HIGH SEVERITY"
            value={data?.risks.filter((r) => r.severity === "HIGH").length ?? 0}
            icon={<AlertTriangle />}
            tone="critical"
          />
          <StatTile
            label="OPEN"
            value={data?.risks.filter((r) => r.status === "OPEN").length ?? 0}
            icon={<Clock />}
          />
          <StatTile
            label="REMEDIATED"
            value={data?.risks.filter((r) => r.status === "REMEDIATED" || r.status === "CLOSED").length ?? 0}
            icon={<CheckCircle />}
            tone="success"
          />
        </div>

        {/* Search and Filters */}
        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
            <Input
              placeholder="Search by title or description..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>

          {/* Filter Panel with multi-select, URL state, and chips (AC1-AC22) */}
          <RiskFilterPanel
            isOpen={isFilterOpen}
            onToggle={() => setIsFilterOpen(!isFilterOpen)}
            onFiltersChange={handleFiltersChange}
            showOwnerFilters={canFilterByOwner}
          />
        </div>

        {/* Risk Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-[17px] w-[17px] text-primary" />
                  Risks
                </CardTitle>
                <CardDescription>
                  Click on a risk to view details and manage remediation options.
                </CardDescription>
              </div>
              {/* Column Visibility Toggle */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Settings2 className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 max-h-[400px] overflow-y-auto">
                  <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {table
                    .getAllColumns()
                    .filter((column) => column.getCanHide())
                    .map((column) => (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        checked={column.getIsVisible()}
                        onCheckedChange={(value) => column.toggleVisibility(!!value)}
                      >
                        {COLUMN_LABELS[column.id] ?? column.id}
                      </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/70" />
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
                <p className="text-destructive">{error.message}</p>
              </div>
            ) : data?.risks.length === 0 ? (
              <div className="text-center py-12">
                <ShieldAlert className="h-12 w-12 text-muted-foreground/70 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No risks found</h3>
                <p className="text-muted-foreground mb-4">
                  {search || filters.severity.length > 0 || filters.status.length > 0 || filters.findingSource.length > 0 || filters.frameworkId || filters.itOwnerId || filters.businessOwnerId
                    ? "Try adjusting your filters"
                    : "Create your first risk to get started"}
                </p>
                {canCreateRisk && (
                  <Button asChild>
                    <Link href="/risks/new">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Risk
                    </Link>
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-md border border-border">
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                    modifiers={[restrictToHorizontalAxis]}
                  >
                    <Table>
                      <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                          <TableRow key={headerGroup.id}>
                            <SortableContext
                              items={headerGroup.headers.map((h) => h.id)}
                              strategy={horizontalListSortingStrategy}
                            >
                              {headerGroup.headers.map((header) => (
                                <DraggableTableHeader key={header.id} header={header}>
                                  {header.isPlaceholder
                                    ? null
                                    : flexRender(
                                        header.column.columnDef.header,
                                        header.getContext()
                                      )}
                                </DraggableTableHeader>
                              ))}
                            </SortableContext>
                          </TableRow>
                        ))}
                      </TableHeader>
                      <TableBody>
                        {table.getRowModel().rows.map((row) => (
                          <TableRow
                            key={row.id}
                            className="cursor-pointer hover:bg-secondary"
                            onClick={() => router.push(`/risks/${row.original.id}`)}
                          >
                            {row.getVisibleCells().map((cell) => (
                              <TableCell key={cell.id}>
                                {flexRender(
                                  cell.column.columnDef.cell,
                                  cell.getContext()
                                )}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </DndContext>
                </div>

                {/* Pagination */}
                {data && data.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground tabular-nums">
                      Showing {(page - 1) * pageSize + 1} to{" "}
                      {Math.min(page * pageSize, data.total)} of {data.total} risks
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page === 1}
                        onClick={() => setPage(page - 1)}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page === data.totalPages}
                        onClick={() => setPage(page + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
