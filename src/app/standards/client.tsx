"use client";

/**
 * Standards List Client Component
 *
 * Displays a filterable list of organizational standards with creation capability.
 *
 * Standards Module: Standards List UI
 * - Table with Title, Status badge, Owner, Controls count, Effective Date
 * - Status filter dropdown (All, DRAFT, ACTIVE, DEPRECATED)
 * - Create Standard button navigates to creation form/modal
 * - Clickable rows navigate to /standards/[id] detail page
 */

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import {
  Plus,
  Loader2,
  FileText,
  Calendar,
  User,
  Shield,
  ChevronRight,
  Filter,
  Search,
  AlertCircle,
  CheckCircle,
  Clock,
  Upload,
} from "lucide-react";
import { UserRole, StandardStatus } from "@prisma/client";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** Roles that can create/manage standards */
const CAN_MANAGE_STANDARD_ROLES: UserRole[] = [
  UserRole.CISO,
  UserRole.GRC_ANALYST,
  UserRole.ORG_ADMIN,
];

/** Status badge configuration */
const statusConfig: Record<StandardStatus, { color: string; label: string; icon: typeof CheckCircle }> = {
  DRAFT: { color: "bg-slate-100 text-slate-700 border-slate-200", label: "Draft", icon: Clock },
  ACTIVE: { color: "bg-green-100 text-green-700 border-green-200", label: "Active", icon: CheckCircle },
  DEPRECATED: { color: "bg-amber-100 text-amber-700 border-amber-200", label: "Deprecated", icon: AlertCircle },
};

export function StandardsListClient() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const utils = api.useUtils();

  // Track client-side mount to prevent hydration mismatches
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // State
  const [statusFilter, setStatusFilter] = useState<StandardStatus | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  // Create form state
  const [newStandard, setNewStandard] = useState<{
    title: string;
    description: string;
    effectiveDate: string;
    reviewCycleMonths: number;
  }>({
    title: "",
    description: "",
    effectiveDate: new Date().toISOString().split("T")[0] ?? "",
    reviewCycleMonths: 12,
  });

  // Upload form state
  const [uploadForm, setUploadForm] = useState<{
    title: string;
    description: string;
    csvContent: string;
    fileName: string;
  }>({
    title: "",
    description: "",
    csvContent: "",
    fileName: "",
  });

  // Check permissions
  const userRole = session?.user?.role as UserRole | undefined;
  const canManageStandard = userRole && CAN_MANAGE_STANDARD_ROLES.includes(userRole);

  // Fetch standards
  const { data, isLoading, error } = api.standard.list.useQuery({
    page,
    pageSize: 20,
    status: statusFilter === "ALL" ? undefined : statusFilter,
    search: searchQuery || undefined,
    sortBy: "updatedAt",
    sortOrder: "desc",
  });

  // Fetch summary for stats
  const { data: summary } = api.standard.getSummary.useQuery();

  // Create mutation
  const createMutation = api.standard.create.useMutation({
    onSuccess: (standard) => {
      toast.success("Standard created successfully");
      setCreateDialogOpen(false);
      setNewStandard({
        title: "",
        description: "",
        effectiveDate: new Date().toISOString().split("T")[0] ?? "",
        reviewCycleMonths: 12,
      });
      void utils.standard.list.invalidate();
      void utils.standard.getSummary.invalidate();
      // Navigate to the new standard
      router.push(`/standards/${standard.id}`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create standard");
    },
  });

  // Upload mutation
  const uploadMutation = api.standard.uploadStandardFromCsv.useMutation({
    onSuccess: (result) => {
      toast.success(`Standard created with ${result.controlsCreated} controls`);
      setUploadDialogOpen(false);
      setUploadForm({
        title: "",
        description: "",
        csvContent: "",
        fileName: "",
      });
      void utils.standard.list.invalidate();
      void utils.standard.getSummary.invalidate();
      if (result.standard) {
        router.push(`/standards/${result.standard.id}`);
      }
    },
    onError: (error) => {
      toast.error(error.message || "Failed to upload standard");
    },
  });

  // Handlers
  const handleRowClick = useCallback(
    (standardId: string) => {
      router.push(`/standards/${standardId}`);
    },
    [router]
  );

  const handleStatusFilterChange = useCallback((value: string) => {
    setStatusFilter(value as StandardStatus | "ALL");
    setPage(1);
  }, []);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setPage(1);
  }, []);

  const handleCreateSubmit = useCallback(() => {
    if (!newStandard.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!newStandard.description.trim()) {
      toast.error("Description is required");
      return;
    }
    createMutation.mutate({
      title: newStandard.title.trim(),
      description: newStandard.description.trim(),
      effectiveDate: new Date(newStandard.effectiveDate),
      reviewCycleMonths: newStandard.reviewCycleMonths,
      status: StandardStatus.DRAFT,
    });
  }, [newStandard, createMutation]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast.error("Please select a CSV file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setUploadForm((prev) => ({
        ...prev,
        csvContent: content,
        fileName: file.name,
      }));
    };
    reader.onerror = () => {
      toast.error("Failed to read file");
    };
    reader.readAsText(file);
  }, []);

  const handleUploadSubmit = useCallback(() => {
    if (!uploadForm.title.trim()) {
      toast.error("Standard name is required");
      return;
    }
    if (!uploadForm.csvContent) {
      toast.error("Please select a CSV file");
      return;
    }
    uploadMutation.mutate({
      title: uploadForm.title.trim(),
      description: uploadForm.description.trim() || undefined,
      csvContent: uploadForm.csvContent,
    });
  }, [uploadForm, uploadMutation]);

  // Loading state
  if (!isMounted || sessionStatus === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <AppLayout breadcrumbs={[{ label: "Standards" }]}>
        <div className="container mx-auto px-4 py-8">
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Error Loading Standards</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{error.message}</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => window.location.reload()}
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const standards = data?.standards ?? [];
  const pagination = data?.pagination;

  return (
    <AppLayout breadcrumbs={[{ label: "Standards" }]}>
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              Organizational Standards
            </h1>
            <p className="text-muted-foreground">
              Define and manage internal policies and standards for compliance auditing
            </p>
          </div>
          {canManageStandard && (
            <div className="flex gap-2">
              {/* Upload CSV Dialog */}
              <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                <Button variant="outline" onClick={() => setUploadDialogOpen(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload CSV
                </Button>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Upload Standard from CSV</DialogTitle>
                    <DialogDescription>
                      Upload a CSV file with controls to create a new standard.
                      Required columns: &quot;control number&quot;, &quot;Control Language&quot;
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="uploadTitle">Standard Name *</Label>
                      <Input
                        id="uploadTitle"
                        placeholder="e.g., Internal Security Standard"
                        value={uploadForm.title}
                        onChange={(e) =>
                          setUploadForm((prev) => ({ ...prev, title: e.target.value }))
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="uploadDescription">Description</Label>
                      <Textarea
                        id="uploadDescription"
                        placeholder="Optional description..."
                        rows={2}
                        value={uploadForm.description}
                        onChange={(e) =>
                          setUploadForm((prev) => ({ ...prev, description: e.target.value }))
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="csvFile">CSV File *</Label>
                      <Input
                        id="csvFile"
                        type="file"
                        accept=".csv"
                        onChange={handleFileChange}
                      />
                      {uploadForm.fileName && (
                        <p className="text-sm text-muted-foreground">
                          Selected: {uploadForm.fileName}
                        </p>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md">
                      <p className="font-medium mb-1">Expected CSV format:</p>
                      <code>Standard,control number,Control Language</code>
                      <p className="mt-1">The &quot;Standard&quot; column is optional and will be ignored.</p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setUploadDialogOpen(false)}
                      disabled={uploadMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleUploadSubmit}
                      disabled={uploadMutation.isPending}
                    >
                      {uploadMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Upload Standard
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Create Standard Dialog */}
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <Button onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Standard
                </Button>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Create New Standard</DialogTitle>
                  <DialogDescription>
                    Define a new organizational standard for compliance tracking
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      placeholder="e.g., Information Security Policy"
                      value={newStandard.title}
                      onChange={(e) =>
                        setNewStandard((prev) => ({ ...prev, title: e.target.value }))
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description">Description *</Label>
                    <Textarea
                      id="description"
                      placeholder="Describe the purpose and scope of this standard..."
                      rows={4}
                      value={newStandard.description}
                      onChange={(e) =>
                        setNewStandard((prev) => ({ ...prev, description: e.target.value }))
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="effectiveDate">Effective Date *</Label>
                      <Input
                        id="effectiveDate"
                        type="date"
                        value={newStandard.effectiveDate}
                        onChange={(e) =>
                          setNewStandard((prev) => ({ ...prev, effectiveDate: e.target.value }))
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="reviewCycle">Review Cycle (months)</Label>
                      <Select
                        value={String(newStandard.reviewCycleMonths)}
                        onValueChange={(value) =>
                          setNewStandard((prev) => ({ ...prev, reviewCycleMonths: parseInt(value) }))
                        }
                      >
                        <SelectTrigger id="reviewCycle">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="6">6 months</SelectItem>
                          <SelectItem value="12">12 months</SelectItem>
                          <SelectItem value="24">24 months</SelectItem>
                          <SelectItem value="36">36 months</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setCreateDialogOpen(false)}
                    disabled={createMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateSubmit}
                    disabled={createMutation.isPending}
                  >
                    {createMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create Standard"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            </div>
          )}
        </div>

        {/* Summary Stats */}
        {summary && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Standards</CardDescription>
                <CardTitle className="text-2xl">{summary.totalStandards}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Active Standards</CardDescription>
                <CardTitle className="text-2xl text-green-600">{summary.activeStandards}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Controls</CardDescription>
                <CardTitle className="text-2xl">{summary.totalControls}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Pending Exceptions</CardDescription>
                <CardTitle className="text-2xl text-amber-600">{summary.pendingExceptions}</CardTitle>
              </CardHeader>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search standards..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={handleSearchChange}
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Status</SelectItem>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="DEPRECATED">Deprecated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Standards Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : standards.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No standards found</h3>
                <p className="text-muted-foreground mt-1">
                  {searchQuery || statusFilter !== "ALL"
                    ? "Try adjusting your filters"
                    : "Create your first organizational standard to get started"}
                </p>
                {canManageStandard && !searchQuery && statusFilter === "ALL" && (
                  <Button className="mt-4" onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Standard
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Standard</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Controls</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Effective Date</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {standards.map((standard) => {
                    const config = statusConfig[standard.status];
                    const StatusIcon = config.icon;
                    return (
                      <TableRow
                        key={standard.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleRowClick(standard.id)}
                      >
                        <TableCell>
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-primary/10">
                              <Shield className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <div className="font-medium">{standard.title}</div>
                              <div className="text-sm text-muted-foreground">
                                v{standard.version} · Review every {standard.reviewCycleMonths} months
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={config.color}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {config.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{standard._count.Controls}</span>
                          <span className="text-muted-foreground"> controls</span>
                        </TableCell>
                        <TableCell>
                          {standard.Owner ? (
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">{standard.Owner.name || standard.Owner.email}</span>
                            </div>
                          ) : (
                            <span className="text-slate-500 text-sm italic">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {format(new Date(standard.effectiveDate), "MMM d, yyyy")}
                          </div>
                        </TableCell>
                        <TableCell>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {(page - 1) * pagination.pageSize + 1} to{" "}
              {Math.min(page * pagination.pageSize, pagination.total)} of {pagination.total} standards
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page === pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
