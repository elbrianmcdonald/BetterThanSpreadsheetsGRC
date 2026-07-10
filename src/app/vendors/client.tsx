"use client";

/**
 * Vendor List Content Component
 *
 * Epic 1: TPRM Vendor Registry
 * Story 1.2: Vendor List View with Filtering (FR2)
 *
 * Epic 2: Vendor Risk Tiering
 * Story 2.1: Risk Tier Classification (FR11)
 * Story 2.3: Risk Tier Dashboard (FR13)
 * Story 2.4: Review Alerts and Notifications (FR14, FR15)
 *
 * Client component that handles:
 * - Filter state management
 * - Pagination state
 * - Sorting state
 * - API queries
 * - Empty states
 */

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { format, isPast, differenceInDays } from "date-fns";
import {
  Plus,
  Building2,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Clock,
  Upload,
  Download,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  Loader2,
  X,
} from "lucide-react";

import { UserRole, VendorStatus, VendorRiskTier } from "@prisma/client";
import { WRITE_ROLES } from "@/lib/auth/roles";
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { api } from "@/trpc/react";
import { useHasRole } from "@/hooks/useHasRole";
import { AppLayout, PageHeader, StatTile } from "@/components/layout";
import {
  VendorStatusBadge,
  getVendorStatusOptions,
  VendorRiskTierBadge,
  getVendorRiskTierOptions,
} from "@/components/vendor";

/**
 * Roles that can create vendors
 */
const VENDOR_MANAGE_ROLES: UserRole[] = WRITE_ROLES;

/**
 * Vendor data shape from the list query
 */
interface VendorListItem {
  id: string;
  identifier: string;
  name: string;
  category: string | null;
  status: VendorStatus;
  riskTier: VendorRiskTier | null;
  nextReviewDate: Date | string | null;
  reviewDateOverridden: boolean;
  primaryContactName: string | null;
  primaryContactEmail: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  businessUnit?: { id: string; name: string } | null;
  itOwner?: { id: string; name: string | null; email: string | null } | null;
  businessOwner?: { id: string; name: string | null; email: string | null } | null;
}

export function VendorListContent() {
  // Filter state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<VendorStatus | "ALL">("ALL");
  const [riskTierFilter, setRiskTierFilter] = useState<VendorRiskTier | "ALL">("ALL");
  const [reviewStatusFilter, setReviewStatusFilter] = useState<"overdue" | "due_in_30_days" | "due_in_90_days" | "all">("all");
  const [businessUnitFilter, setBusinessUnitFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);

  // Role checks
  const canManageVendors = useHasRole(VENDOR_MANAGE_ROLES);

  // Fetch business units for filter
  const { data: businessUnits } = api.businessUnit.getAll.useQuery();

  // Fetch vendors with filters
  const { data, isLoading, error } = api.vendor.list.useQuery({
    search: search || undefined,
    status: statusFilter !== "ALL" ? [statusFilter] : undefined,
    riskTier: riskTierFilter !== "ALL" ? [riskTierFilter] : undefined,
    reviewStatus: reviewStatusFilter,
    businessUnitId: businessUnitFilter !== "ALL" ? businessUnitFilter : undefined,
    page,
    limit: 25,
    sortBy: sorting[0]?.id as "identifier" | "name" | "category" | "status" | "riskTier" | "nextReviewDate" | "createdAt" | undefined,
    sortOrder: sorting[0]?.desc ? "desc" : "asc",
  });

  // Fetch stats
  const { data: stats } = api.vendor.getStats.useQuery();

  // Import/Export state (Epic 7: FR54, FR57-FR60)
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importStep, setImportStep] = useState<"upload" | "validate" | "success">("upload");
  const [validationResult, setValidationResult] = useState<{
    totalRows: number;
    validCount: number;
    errorCount: number;
    results: Array<{ row: number; data: { name: string; category?: string }; errors: string[]; isValid: boolean }>;
    canImport: boolean;
  } | null>(null);
  const [importResult, setImportResult] = useState<{ importedCount: number } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [parsedData, setParsedData] = useState<Array<{
    name: string;
    category?: string;
    primaryContactName?: string;
    primaryContactEmail?: string;
    riskTier?: string;
    notes?: string;
  }>>([]);

  // Import/Export mutations
  const validateImportMutation = api.vendor.validateBulkImport.useMutation();
  const bulkImportMutation = api.vendor.bulkImport.useMutation();
  const { refetch } = api.vendor.list.useQuery({
    search: search || undefined,
    status: statusFilter !== "ALL" ? [statusFilter] : undefined,
    riskTier: riskTierFilter !== "ALL" ? [riskTierFilter] : undefined,
    reviewStatus: reviewStatusFilter,
    businessUnitId: businessUnitFilter !== "ALL" ? businessUnitFilter : undefined,
    page,
    limit: 25,
    sortBy: sorting[0]?.id as "identifier" | "name" | "category" | "status" | "riskTier" | "nextReviewDate" | "createdAt" | undefined,
    sortOrder: sorting[0]?.desc ? "desc" : "asc",
  });
  const exportQuery = api.vendor.exportToCSV.useQuery(undefined, { enabled: false });

  // Download CSV template
  const downloadTemplate = () => {
    const headers = ["name", "category", "primaryContactName", "primaryContactEmail", "riskTier", "notes"];
    const exampleRow = ["Acme Corp", "Cloud Services", "John Doe", "john@acme.com", "High", "Main cloud provider"];
    const csvContent = [headers.join(","), exampleRow.join(",")].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vendor_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Parse CSV file
  const parseCSV = (text: string): Array<{ [key: string]: string }> => {
    const lines = text.split("\n").filter(line => line.trim());
    if (lines.length < 2) return [];
    const headers = lines[0]!.split(",").map(h => h.trim().replace(/^"|"$/g, ""));
    return lines.slice(1).map(line => {
      const values = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
      const obj: { [key: string]: string } = {};
      headers.forEach((header, i) => {
        obj[header] = values[i] || "";
      });
      return obj;
    });
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const parsed = parseCSV(text);

    if (parsed.length === 0) {
      toast.error("No valid data found in CSV file");
      return;
    }

    // Map to expected format
    const vendors = parsed.map(row => ({
      name: row.name || row.Name || "",
      category: row.category || row.Category || undefined,
      primaryContactName: row.primaryContactName || row["Primary Contact Name"] || undefined,
      primaryContactEmail: row.primaryContactEmail || row["Primary Contact Email"] || undefined,
      riskTier: row.riskTier || row["Risk Tier"] || undefined,
      notes: row.notes || row.Notes || undefined,
    }));

    setParsedData(vendors);

    // Validate
    try {
      const result = await validateImportMutation.mutateAsync({ vendors });
      setValidationResult(result);
      setImportStep("validate");
    } catch (error) {
      toast.error("Failed to validate CSV data");
    }

    // Reset file input
    e.target.value = "";
  };

  // Handle import
  const handleImport = async () => {
    if (!validationResult?.canImport) return;

    setIsImporting(true);
    try {
      const validVendors = parsedData.filter((_, i) =>
        validationResult.results[i]?.isValid
      );
      const result = await bulkImportMutation.mutateAsync({ vendors: validVendors });
      setImportResult(result);
      setImportStep("success");
      toast.success(`Successfully imported ${result.importedCount} vendors`);
    } catch (error) {
      toast.error("Failed to import vendors");
    } finally {
      setIsImporting(false);
    }
  };

  // Handle export
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await exportQuery.refetch();
      if (result.data) {
        const csvContent = [
          result.data.headers.join(","),
          ...result.data.data.map(row =>
            Object.values(row).map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")
          ),
        ].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `vendors_export_${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`Exported ${result.data.totalCount} vendors`);
      }
    } catch (error) {
      toast.error("Failed to export vendors");
    } finally {
      setIsExporting(false);
    }
  };

  // Define columns
  const columns = useMemo<ColumnDef<VendorListItem>[]>(
    () => [
      {
        accessorKey: "identifier",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-4 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground"
          >
            ID
            {column.getIsSorted() === "asc" ? (
              <ArrowUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === "desc" ? (
              <ArrowDown className="ml-2 h-4 w-4" />
            ) : (
              <ArrowUpDown className="ml-2 h-4 w-4" />
            )}
          </Button>
        ),
        cell: ({ row }) => (
          <Link
            href={`/vendors/${row.original.id}`}
            className="font-mono text-[13px] font-medium text-primary hover:underline"
          >
            {row.getValue("identifier")}
          </Link>
        ),
      },
      {
        accessorKey: "name",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-4 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground"
          >
            Name
            {column.getIsSorted() === "asc" ? (
              <ArrowUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === "desc" ? (
              <ArrowDown className="ml-2 h-4 w-4" />
            ) : (
              <ArrowUpDown className="ml-2 h-4 w-4" />
            )}
          </Button>
        ),
        cell: ({ row }) => (
          <Link
            href={`/vendors/${row.original.id}`}
            className="font-semibold text-foreground hover:underline"
          >
            {row.getValue("name")}
          </Link>
        ),
      },
      {
        accessorKey: "category",
        header: "Category",
        cell: ({ row }) => row.getValue("category") || "-",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <VendorStatusBadge status={row.getValue("status")} />
        ),
      },
      {
        accessorKey: "riskTier",
        header: "Risk Tier",
        cell: ({ row }) => (
          <VendorRiskTierBadge tier={row.getValue("riskTier")} />
        ),
      },
      {
        accessorKey: "nextReviewDate",
        header: "Next Review",
        cell: ({ row }) => {
          const nextReview = row.original.nextReviewDate;
          if (!nextReview) return "-";
          const date = new Date(nextReview);
          const isOverdue = isPast(date);
          const daysUntil = differenceInDays(date, new Date());
          return (
            <div className="flex items-center gap-2">
              <span className={`font-mono text-[13px] ${isOverdue ? "text-destructive" : daysUntil <= 30 ? "text-warning" : "text-muted-foreground"}`}>
                {format(date, "MMM d, yyyy")}
              </span>
              {isOverdue && <AlertTriangle className="h-4 w-4 text-destructive" />}
              {!isOverdue && daysUntil <= 30 && <Clock className="h-4 w-4 text-warning" />}
            </div>
          );
        },
      },
      {
        accessorKey: "businessUnit",
        header: "Business Unit",
        cell: ({ row }) => row.original.businessUnit?.name || "-",
      },
      {
        accessorKey: "itOwner",
        header: "IT Owner",
        cell: ({ row }) =>
          row.original.itOwner?.name || row.original.itOwner?.email || "-",
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-4 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground"
          >
            Created
            {column.getIsSorted() === "asc" ? (
              <ArrowUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === "desc" ? (
              <ArrowDown className="ml-2 h-4 w-4" />
            ) : (
              <ArrowUpDown className="ml-2 h-4 w-4" />
            )}
          </Button>
        ),
        cell: ({ row }) =>
          format(new Date(row.getValue("createdAt")), "MMM d, yyyy"),
      },
    ],
    []
  );

  // Table instance
  const table = useReactTable({
    data: data?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: { sorting },
    manualSorting: true,
  });

  const statusOptions = getVendorStatusOptions();
  const riskTierOptions = getVendorRiskTierOptions();

  return (
    <AppLayout
      breadcrumbs={[{ label: "Third Party" }, { label: "Vendor Registry" }]}
    >
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          eyebrow="THIRD PARTY"
          title="Vendor Registry"
          icon={<Building2 />}
          description="Manage third-party vendor relationships"
          actions={
            <>
            {/* Export Button */}
            <Button variant="outline" onClick={handleExport} disabled={isExporting}>
              {isExporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Export CSV
            </Button>

            {/* Import Button */}
            {canManageVendors && (
              <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Upload className="mr-2 h-4 w-4" />
                    Import CSV
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Import Vendors from CSV</DialogTitle>
                    <DialogDescription>
                      Upload a CSV file to bulk import vendors. Download the template for the correct format.
                    </DialogDescription>
                  </DialogHeader>

                  {/* Import Step 1: File Upload */}
                  {importStep === "upload" && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={downloadTemplate}>
                          <FileSpreadsheet className="mr-2 h-4 w-4" />
                          Download Template
                        </Button>
                      </div>

                      <div className="border-2 border-dashed border-input rounded-lg p-8 text-center">
                        <input
                          type="file"
                          accept=".csv"
                          onChange={handleFileUpload}
                          className="hidden"
                          id="csv-upload"
                        />
                        <label htmlFor="csv-upload" className="cursor-pointer">
                          <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                          <p className="text-sm font-medium">Click to upload CSV file</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Supported format: .csv
                          </p>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Import Step 2: Validation Results */}
                  {importStep === "validate" && validationResult && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-success">
                          <CheckCircle className="h-5 w-5" />
                          <span>{validationResult.validCount} valid</span>
                        </div>
                        {validationResult.errorCount > 0 && (
                          <div className="flex items-center gap-2 text-destructive">
                            <AlertCircle className="h-5 w-5" />
                            <span>{validationResult.errorCount} errors</span>
                          </div>
                        )}
                      </div>

                      <div className="border border-border rounded-lg max-h-64 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Row</TableHead>
                              <TableHead className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Name</TableHead>
                              <TableHead className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Category</TableHead>
                              <TableHead className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {validationResult.results.map((result) => (
                              <TableRow
                                key={result.row}
                                className={!result.isValid ? "bg-destructive/10" : ""}
                              >
                                <TableCell>{result.row}</TableCell>
                                <TableCell>
                                  {result.data.name || "(empty)"}
                                  {!result.isValid && (
                                    <div className="text-xs text-destructive mt-1">
                                      {result.errors.join(", ")}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell>{result.data.category || "-"}</TableCell>
                                <TableCell>
                                  {result.isValid ? (
                                    <Badge variant="success">
                                      Valid
                                    </Badge>
                                  ) : (
                                    <Badge variant="critical">Error</Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      <DialogFooter>
                        <Button variant="outline" onClick={() => { setImportStep("upload"); setValidationResult(null); }}>
                          Back
                        </Button>
                        <Button
                          onClick={handleImport}
                          disabled={!validationResult.canImport || isImporting}
                        >
                          {isImporting ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Importing...
                            </>
                          ) : (
                            <>Import {validationResult.validCount} Vendors</>
                          )}
                        </Button>
                      </DialogFooter>
                    </div>
                  )}

                  {/* Import Step 3: Success */}
                  {importStep === "success" && importResult && (
                    <div className="space-y-4">
                      <div className="flex flex-col items-center py-8">
                        <CheckCircle className="h-16 w-16 text-success mb-4" />
                        <h3 className="text-lg font-semibold">Import Complete</h3>
                        <p className="text-muted-foreground">
                          Successfully imported {importResult.importedCount} vendors
                        </p>
                      </div>
                      <DialogFooter>
                        <Button onClick={() => { setImportDialogOpen(false); setImportStep("upload"); refetch(); }}>
                          Close
                        </Button>
                      </DialogFooter>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            )}

            {/* Add Vendor Button */}
            {canManageVendors && (
              <Link href="/vendors/new">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Vendor
                </Button>
              </Link>
            )}
            </>
          }
        />

        {/* Stats Cards */}
        {stats && (
          <div className="space-y-4">
            {/* Status Stats */}
            <div className="grid gap-4 md:grid-cols-4">
              <StatTile
                label="TOTAL VENDORS"
                value={stats.totalCount}
                icon={<Building2 />}
                accent
              />
              <StatTile
                label="ACTIVE"
                value={stats.activeCount}
                tone="success"
              />
              <StatTile
                label="UNDER REVIEW"
                value={stats.underReviewCount}
                tone="warning"
              />
              <StatTile
                label="INACTIVE"
                value={stats.inactiveCount}
              />
            </div>

            {/* Risk Tier & Review Stats (FR13, FR14, FR15) */}
            <div className="grid gap-4 md:grid-cols-6">
              <StatTile
                label="CRITICAL"
                value={stats.tierDistribution?.CRITICAL ?? 0}
                tone="critical"
              />
              <StatTile
                label="HIGH"
                value={
                  <span className="text-severity-high">
                    {stats.tierDistribution?.HIGH ?? 0}
                  </span>
                }
              />
              <StatTile
                label="MEDIUM"
                value={stats.tierDistribution?.MEDIUM ?? 0}
                tone="warning"
              />
              <StatTile
                label="LOW"
                value={stats.tierDistribution?.LOW ?? 0}
                tone="success"
              />
              <StatTile
                label="OVERDUE REVIEWS"
                value={stats.overdueReviewCount}
                icon={<AlertTriangle />}
                tone={stats.overdueReviewCount > 0 ? "critical" : "default"}
              />
              <StatTile
                label="DUE IN 30 DAYS"
                value={stats.upcomingReviewCount}
                icon={<Clock />}
                tone="warning"
              />
            </div>
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search vendors..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9"
                />
              </div>

              {/* Status Filter */}
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value as VendorStatus | "ALL");
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Risk Tier Filter */}
              <Select
                value={riskTierFilter}
                onValueChange={(value) => {
                  setRiskTierFilter(value as VendorRiskTier | "ALL");
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Risk Tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Risk Tiers</SelectItem>
                  {riskTierOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Review Status Filter */}
              <Select
                value={reviewStatusFilter}
                onValueChange={(value) => {
                  setReviewStatusFilter(value as typeof reviewStatusFilter);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Review Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Reviews</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="due_in_30_days">Due in 30 Days</SelectItem>
                  <SelectItem value="due_in_90_days">Due in 90 Days</SelectItem>
                </SelectContent>
              </Select>

              {/* Business Unit Filter */}
              <Select
                value={businessUnitFilter}
                onValueChange={(value) => {
                  setBusinessUnitFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Business Unit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Business Units</SelectItem>
                  {businessUnits?.map((bu) => (
                    <SelectItem key={bu.id} value={bu.id}>
                      {bu.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : error ? (
              <div className="p-8 text-center text-destructive">
                Failed to load vendors: {error.message}
              </div>
            ) : data?.items.length === 0 ? (
              <div className="p-8 text-center">
                <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">No vendors found</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {search || statusFilter !== "ALL" || businessUnitFilter !== "ALL"
                    ? "Try adjusting your filters"
                    : "Get started by adding your first vendor"}
                </p>
                {canManageVendors && !search && statusFilter === "ALL" && businessUnitFilter === "ALL" && (
                  <Link href="/vendors/new">
                    <Button className="mt-4">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Vendor
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id} className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id} className="hover:bg-secondary">
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
            )}
          </CardContent>

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-4">
              <p className="text-sm text-muted-foreground">
                Showing <span className="font-mono">{(page - 1) * 25 + 1}</span> to{" "}
                <span className="font-mono">{Math.min(page * 25, data.totalCount)}</span> of <span className="font-mono">{data.totalCount}</span>{" "}
                vendors
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm">
                  Page <span className="font-mono">{page}</span> of <span className="font-mono">{data.totalPages}</span>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                  disabled={page === data.totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
