"use client";

/**
 * Email Queue Dashboard Client Component
 *
 * Displays:
 * - Summary statistics (pending, sent, failed, success rate)
 * - Pending/retrying emails list
 * - Failed emails list with retry action
 *
 * @see Story 4.15: AC30-AC40
 */

import { useState } from "react";
import { AppLayout } from "@/components/layout";
import { api } from "@/trpc/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  RefreshCw,
  Loader2,
  Mail,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Trash2,
  AlertOctagon,
} from "lucide-react";

export function EmailQueueDashboardClient() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkRetrying, setIsBulkRetrying] = useState(false);

  const utils = api.useUtils();

  // Fetch metrics
  const {
    data: metrics,
    isLoading: isLoadingMetrics,
    refetch: refetchMetrics,
  } = api.emailQueue.getMetrics.useQuery(undefined, {
    staleTime: 30 * 1000, // 30 seconds cache
    refetchInterval: 60 * 1000, // Auto-refresh every minute
  });

  // Fetch pending emails
  const {
    data: pendingData,
    isLoading: isLoadingPending,
  } = api.emailQueue.getPendingEmails.useQuery(
    { page: 1, pageSize: 10 },
    { staleTime: 30 * 1000 }
  );

  // Fetch failed emails
  const {
    data: failedData,
    isLoading: isLoadingFailed,
  } = api.emailQueue.getFailedEmails.useQuery(
    { page: 1, pageSize: 10 },
    { staleTime: 30 * 1000 }
  );

  // Retry mutation
  const retryMutation = api.emailQueue.retryEmail.useMutation({
    onSuccess: () => {
      void utils.emailQueue.getMetrics.invalidate();
      void utils.emailQueue.getFailedEmails.invalidate();
      void utils.emailQueue.getPendingEmails.invalidate();
    },
  });

  // Delete mutation
  const deleteMutation = api.emailQueue.deleteFailedEmail.useMutation({
    onSuccess: () => {
      void utils.emailQueue.getMetrics.invalidate();
      void utils.emailQueue.getFailedEmails.invalidate();
    },
  });

  // Bulk retry mutation
  const bulkRetryMutation = api.emailQueue.bulkRetryEmails.useMutation({
    onSuccess: () => {
      setSelectedIds(new Set());
      void utils.emailQueue.getMetrics.invalidate();
      void utils.emailQueue.getFailedEmails.invalidate();
      void utils.emailQueue.getPendingEmails.invalidate();
    },
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetchMetrics(),
        utils.emailQueue.getPendingEmails.invalidate(),
        utils.emailQueue.getFailedEmails.invalidate(),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRetry = async (emailId: string) => {
    setRetryingId(emailId);
    try {
      await retryMutation.mutateAsync({ emailId });
    } finally {
      setRetryingId(null);
    }
  };

  const handleDelete = async (emailId: string) => {
    if (!confirm("Are you sure you want to delete this email? This action cannot be undone.")) {
      return;
    }
    setDeletingId(emailId);
    try {
      await deleteMutation.mutateAsync({ emailId });
    } finally {
      setDeletingId(null);
    }
  };

  const handleBulkRetry = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkRetrying(true);
    try {
      await bulkRetryMutation.mutateAsync({ emailIds: Array.from(selectedIds) });
    } finally {
      setIsBulkRetrying(false);
    }
  };

  const toggleSelectAll = () => {
    if (!failedData?.emails) return;
    if (selectedIds.size === failedData.emails.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(failedData.emails.map((e) => e.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const isLoading = isLoadingMetrics || isLoadingPending || isLoadingFailed;

  if (isLoading) {
    return (
      <AppLayout breadcrumbs={[{ label: "Administration" }, { label: "Email Queue" }]}>
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-gray-500">Loading email queue data...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Determine success rate color
  const getSuccessRateColor = (color: string) => {
    switch (color) {
      case "green":
        return "text-green-600 bg-green-50";
      case "yellow":
        return "text-yellow-600 bg-yellow-50";
      case "red":
        return "text-red-600 bg-red-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  return (
    <AppLayout breadcrumbs={[{ label: "Administration" }, { label: "Email Queue" }]}>
      <div className="space-y-8">
        {/* Refresh Button */}
        <div className="flex justify-end">
          <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Refreshing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </>
          )}
        </Button>
      </div>

      {/* Summary Statistics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalPending ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.retrying ?? 0} retrying
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sent (24h)</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {metrics?.totalSent ?? 0}
            </div>
            {metrics?.averageSendTimeSeconds && (
              <p className="text-xs text-muted-foreground">
                Avg: {metrics.averageSendTimeSeconds}s to send
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed (24h)</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {metrics?.totalFailed ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              After max retries
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                metrics?.successRateColor === "green"
                  ? "text-green-600"
                  : metrics?.successRateColor === "yellow"
                  ? "text-yellow-600"
                  : "text-red-600"
              }`}
            >
              {metrics?.successRate ?? 100}%
            </div>
            <Badge
              variant="outline"
              className={getSuccessRateColor(metrics?.successRateColor ?? "green")}
            >
              {metrics?.successRateColor === "green" && "Healthy"}
              {metrics?.successRateColor === "yellow" && "Warning"}
              {metrics?.successRateColor === "red" && "Critical"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* AC34 Alerts - High Pending Count or High Failure Rate */}
      {(metrics?.alerts?.highPendingCount || metrics?.alerts?.highFailureRate) && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="py-4">
            <div className="space-y-2">
              {metrics?.alerts?.highPendingCount && (
                <div className="flex items-center gap-2">
                  <AlertOctagon className="h-5 w-5 text-red-600" />
                  <span className="text-red-800 font-medium">
                    High pending count: {metrics.totalPending} emails pending (threshold: 100)
                  </span>
                </div>
              )}
              {metrics?.alerts?.highFailureRate && (
                <div className="flex items-center gap-2">
                  <AlertOctagon className="h-5 w-5 text-red-600" />
                  <span className="text-red-800 font-medium">
                    High failure rate: {(100 - metrics.successRate).toFixed(1)}% failure rate (threshold: 5%)
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Oldest Pending Alert */}
      {metrics?.oldestPendingMinutes && metrics.oldestPendingMinutes > 30 && (
        <Card className="border-yellow-300 bg-yellow-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <span className="text-yellow-800">
                Oldest pending email is {metrics.oldestPendingMinutes} minutes old.
                Consider checking the email worker status.
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending Emails */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Pending Emails
          </CardTitle>
          <CardDescription>
            Emails waiting to be sent or retrying
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingData?.emails.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No pending emails
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingData?.emails.map((email) => (
                  <TableRow key={email.id}>
                    <TableCell>
                      <Badge variant="outline">{email.emailType}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {email.to}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {email.subject}
                    </TableCell>
                    <TableCell>
                      {email.status === "RETRYING" ? (
                        <Badge variant="secondary">
                          Retry {email.retryCount}/{email.maxRetries}
                        </Badge>
                      ) : (
                        <Badge>Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {new Date(email.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {pendingData && pendingData.total > 10 && (
            <div className="mt-4 text-center text-sm text-gray-500">
              Showing 10 of {pendingData.total} pending emails
            </div>
          )}
        </CardContent>
      </Card>

      {/* Failed Emails */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                Failed Emails
              </CardTitle>
              <CardDescription>
                Emails that failed after all retry attempts
              </CardDescription>
            </div>
            {/* Bulk Retry Button */}
            {failedData && failedData.emails.length > 0 && (
              <Button
                variant="outline"
                onClick={handleBulkRetry}
                disabled={selectedIds.size === 0 || isBulkRetrying}
              >
                {isBulkRetrying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Retry Selected ({selectedIds.size})
                  </>
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {failedData?.emails.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No failed emails
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={
                        failedData?.emails &&
                        failedData.emails.length > 0 &&
                        selectedIds.size === failedData.emails.length
                      }
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {failedData?.emails.map((email) => (
                  <TableRow key={email.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(email.id)}
                        onCheckedChange={() => toggleSelect(email.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive">{email.emailType}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {email.to}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {email.subject}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-red-600">
                      {email.error}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRetry(email.id)}
                          disabled={retryingId === email.id || deletingId === email.id}
                        >
                          {retryingId === email.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <RotateCcw className="mr-1 h-4 w-4" />
                              Retry
                            </>
                          )}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(email.id)}
                          disabled={retryingId === email.id || deletingId === email.id}
                        >
                          {deletingId === email.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {failedData && failedData.total > 10 && (
            <div className="mt-4 text-center text-sm text-gray-500">
              Showing 10 of {failedData.total} failed emails
            </div>
          )}
        </CardContent>
      </Card>

        {/* Legend */}
        <Card className="bg-gray-50">
          <CardContent className="py-4">
            <div className="flex items-center justify-center gap-8 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-green-500" />
                <span className="text-gray-600">&gt;98% Healthy</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-yellow-500" />
                <span className="text-gray-600">95-98% Warning</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-red-500" />
                <span className="text-gray-600">&lt;95% Critical</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
