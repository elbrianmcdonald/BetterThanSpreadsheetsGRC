"use client";

/**
 * Strategy List Client Component
 *
 * Displays a filterable list of security strategies with creation capability.
 *
 * Story 1.4: Strategy List Page UI
 * AC1: Table with Title, Status badge, Fiscal Year, Progress %, Owner, Updated Date
 * AC2: Status filter dropdown (All, DRAFT, ACTIVE, COMPLETED, ARCHIVED)
 * AC3: Create Strategy button navigates to creation form/modal
 * AC4: Clickable rows navigate to /strategy/[id] detail page
 */

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import {
  Plus,
  Loader2,
  Target,
  Calendar,
  User,
  TrendingUp,
  ChevronRight,
  Filter,
} from "lucide-react";
import { UserRole, StrategyStatus } from "@prisma/client";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import { WRITE_ROLES } from "@/lib/auth/roles";
import { AppLayout, PageHeader, StatTile } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** Roles that can create/manage strategies (FR58) */
const CAN_MANAGE_STRATEGY_ROLES: UserRole[] = WRITE_ROLES;

/** Status badge configuration */
const statusConfig: Record<
  StrategyStatus,
  { variant: "neutral" | "info" | "success"; label: string }
> = {
  DRAFT: { variant: "neutral", label: "Draft" },
  ACTIVE: { variant: "info", label: "Active" },
  COMPLETED: { variant: "success", label: "Completed" },
  ARCHIVED: { variant: "neutral", label: "Archived" },
};

/** Get current fiscal year */
function getCurrentFiscalYear(): number {
  const now = new Date();
  // Assuming fiscal year starts in October
  return now.getMonth() >= 9 ? now.getFullYear() + 1 : now.getFullYear();
}

export function StrategyListClient() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const utils = api.useUtils();

  // Track client-side mount to prevent hydration mismatches
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // State
  const [statusFilter, setStatusFilter] = useState<StrategyStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Create form state
  const [newStrategy, setNewStrategy] = useState({
    title: "",
    description: "",
    fiscalYearStart: getCurrentFiscalYear(),
    fiscalYearEnd: getCurrentFiscalYear(),
  });

  // Check permissions
  const userRole = session?.user?.role as UserRole | undefined;
  const canManageStrategy = userRole && CAN_MANAGE_STRATEGY_ROLES.includes(userRole);

  // Fetch strategies
  const { data, isLoading, error } = api.strategy.list.useQuery({
    page,
    pageSize: 20,
    status: statusFilter === "ALL" ? undefined : statusFilter,
    sortBy: "updatedAt",
    sortOrder: "desc",
  });

  // Create mutation
  const createMutation = api.strategy.create.useMutation({
    onSuccess: (strategy) => {
      toast.success("Strategy created successfully");
      setCreateDialogOpen(false);
      setNewStrategy({
        title: "",
        description: "",
        fiscalYearStart: getCurrentFiscalYear(),
        fiscalYearEnd: getCurrentFiscalYear(),
      });
      void utils.strategy.list.invalidate();
      // Navigate to the new strategy
      router.push(`/strategy/${strategy.id}`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create strategy");
    },
  });

  // Handlers
  const handleRowClick = useCallback(
    (strategyId: string) => {
      router.push(`/strategy/${strategyId}`);
    },
    [router]
  );

  const handleStatusFilterChange = useCallback((value: string) => {
    setStatusFilter(value as StrategyStatus | "ALL");
    setPage(1);
  }, []);

  const handleCreateSubmit = useCallback(() => {
    if (!newStrategy.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (newStrategy.fiscalYearEnd < newStrategy.fiscalYearStart) {
      toast.error("End year must be greater than or equal to start year");
      return;
    }
    createMutation.mutate({
      title: newStrategy.title.trim(),
      description: newStrategy.description.trim() || null,
      fiscalYearStart: newStrategy.fiscalYearStart,
      fiscalYearEnd: newStrategy.fiscalYearEnd,
      status: StrategyStatus.DRAFT,
    });
  }, [newStrategy, createMutation]);

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
      <AppLayout breadcrumbs={[{ label: "Strategy" }]}>
        <div className="container mx-auto px-4 py-8">
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Error Loading Strategies</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{error.message}</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => router.refresh()}
              >
                Try Again
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const strategies = data?.strategies ?? [];
  const pagination = data?.pagination;

  // Calculate summary stats
  const activeCount = strategies.filter((s) => s.status === "ACTIVE").length;
  const draftCount = strategies.filter((s) => s.status === "DRAFT").length;

  return (
    <AppLayout breadcrumbs={[{ label: "Strategy" }]}>
      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <PageHeader
          eyebrow="GOVERNANCE"
          title="Security Strategy"
          icon={<Target />}
          description="Manage your organization's security strategies and goals"
          actions={
            <div className="flex items-center gap-3">
            {/* Status Filter (AC2) */}
            <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
              <SelectTrigger className="w-[160px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="ARCHIVED">Archived</SelectItem>
              </SelectContent>
            </Select>

            {/* Create Strategy Button (AC3) */}
            {canManageStrategy && (
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Strategy
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Create New Strategy</DialogTitle>
                    <DialogDescription>
                      Define a new security strategy for your organization.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="title">Title *</Label>
                      <Input
                        id="title"
                        placeholder="e.g., FY2025 Cybersecurity Strategy"
                        value={newStrategy.title}
                        onChange={(e) =>
                          setNewStrategy((prev) => ({ ...prev, title: e.target.value }))
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        placeholder="Describe the strategy's purpose and scope..."
                        value={newStrategy.description}
                        onChange={(e) =>
                          setNewStrategy((prev) => ({ ...prev, description: e.target.value }))
                        }
                        rows={3}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="fiscalYearStart">Fiscal Year Start</Label>
                        <Input
                          id="fiscalYearStart"
                          type="number"
                          min={2000}
                          max={2100}
                          value={newStrategy.fiscalYearStart}
                          onChange={(e) =>
                            setNewStrategy((prev) => ({
                              ...prev,
                              fiscalYearStart: parseInt(e.target.value) || getCurrentFiscalYear(),
                            }))
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="fiscalYearEnd">Fiscal Year End</Label>
                        <Input
                          id="fiscalYearEnd"
                          type="number"
                          min={2000}
                          max={2100}
                          value={newStrategy.fiscalYearEnd}
                          onChange={(e) =>
                            setNewStrategy((prev) => ({
                              ...prev,
                              fiscalYearEnd: parseInt(e.target.value) || getCurrentFiscalYear(),
                            }))
                          }
                        />
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
                      disabled={createMutation.isPending || !newStrategy.title.trim()}
                    >
                      {createMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        "Create Strategy"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
            </div>
          }
        />

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatTile
            label="Total Strategies"
            value={pagination?.totalCount ?? 0}
            icon={<Target />}
            tone="primary"
            accent
          />
          <StatTile
            label="Active"
            value={activeCount}
            icon={<TrendingUp />}
            tone="primary"
          />
          <StatTile
            label="In Draft"
            value={draftCount}
            icon={<Calendar />}
          />
          <StatTile
            label="This Page"
            value={strategies.length}
            icon={<User />}
          />
        </div>

        {/* Strategy Table (AC1) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[15px] font-bold">
              <Target className="h-[17px] w-[17px] text-primary" />
              Strategies
            </CardTitle>
            <CardDescription>
              {pagination?.totalCount === 0
                ? "No strategies found"
                : `Showing ${strategies.length} of ${pagination?.totalCount} strategies`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : strategies.length === 0 ? (
              <div className="text-center py-12">
                <Target className="h-12 w-12 mx-auto text-muted-foreground/70 mb-4" />
                <h3 className="text-lg font-medium text-foreground">No Strategies Found</h3>
                <p className="text-muted-foreground mt-1">
                  {statusFilter === "ALL"
                    ? "Get started by creating your first security strategy."
                    : `No strategies with status "${statusFilter}" found.`}
                </p>
                {canManageStrategy && statusFilter === "ALL" && (
                  <Button
                    className="mt-4"
                    onClick={() => setCreateDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Strategy
                  </Button>
                )}
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Title</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Status</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Fiscal Year</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Progress</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Owner</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Updated</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {strategies.map((strategy) => {
                      const config = statusConfig[strategy.status];
                      // Story 4.3: Use calculated progress from API
                      const progress = strategy.progress ?? 0;

                      return (
                        <TableRow
                          key={strategy.id}
                          className="cursor-pointer hover:bg-secondary"
                          onClick={() => handleRowClick(strategy.id)}
                        >
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-semibold text-foreground">{strategy.title}</span>
                              {strategy.description && (
                                <span className="text-xs text-muted-foreground line-clamp-1">
                                  {strategy.description}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={config.variant}>
                              {config.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 font-mono text-sm text-muted-foreground">
                              <Calendar className="h-3 w-3 text-muted-foreground/70" />
                              {strategy.fiscalYearStart === strategy.fiscalYearEnd
                                ? `FY${strategy.fiscalYearStart}`
                                : `FY${strategy.fiscalYearStart}-${strategy.fiscalYearEnd}`}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 min-w-[100px]">
                              <Progress value={progress} className="h-2 flex-1" />
                              <span className="tnum font-mono text-xs text-muted-foreground w-8">
                                {progress}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {strategy.owner ? (
                              <div className="flex items-center gap-1 text-sm text-foreground">
                                <User className="h-3 w-3 text-muted-foreground/70" />
                                {strategy.owner.name || strategy.owner.email}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm italic">Unassigned</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-sm text-muted-foreground">
                              {format(new Date(strategy.updatedAt), "MMM d, yyyy")}
                            </span>
                          </TableCell>
                          <TableCell>
                            <ChevronRight className="h-4 w-4 text-muted-foreground/70" />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                    <p className="font-mono text-sm text-muted-foreground">
                      Page {pagination.page} of {pagination.totalPages}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => p + 1)}
                        disabled={!pagination.hasMore}
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
