"use client";

/**
 * Sent Evidence Requests Client Component
 *
 * Client-side component for GRC Analysts to manage their sent evidence requests.
 *
 * AC30-AC34: Analyst view for managing sent evidence requests
 *
 * @see Story 3.12: Evidence Request Workflow
 */

import { useState } from "react";
import Link from "next/link";
import {
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  Trash2,
  Calendar,
  User,
  FileText,
  Loader2,
  Plus,
} from "lucide-react";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type StatusFilter = "all" | "PENDING" | "FULFILLED" | "CANCELLED";

export function SentEvidenceRequestsClient() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [cancelRequestId, setCancelRequestId] = useState<string | null>(null);
  const pageSize = 10;

  const utils = api.useUtils();

  // Fetch sent evidence requests
  const { data, isLoading, error } = api.evidenceRequest.listSentRequests.useQuery({
    status: statusFilter === "all" ? undefined : statusFilter,
    page,
    pageSize,
  });

  // Cancel request mutation
  const cancelMutation = api.evidenceRequest.cancel.useMutation({
    onSuccess: () => {
      toast.success("Evidence request cancelled");
      utils.evidenceRequest.listSentRequests.invalidate();
      setCancelRequestId(null);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Handle cancel confirmation
  const handleConfirmCancel = () => {
    if (cancelRequestId) {
      cancelMutation.mutate({ id: cancelRequestId });
    }
  };

  // Status badge configuration
  const getStatusBadge = (status: string, isOverdue: boolean) => {
    if (status === "PENDING" && isOverdue) {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          Overdue
        </Badge>
      );
    }

    switch (status) {
      case "PENDING":
        return (
          <Badge variant="outline" className="gap-1 text-amber-600 border-amber-200 bg-amber-50">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        );
      case "FULFILLED":
        return (
          <Badge variant="outline" className="gap-1 text-green-600 border-green-200 bg-green-50">
            <CheckCircle className="h-3 w-3" />
            Fulfilled
          </Badge>
        );
      case "CANCELLED":
        return (
          <Badge variant="outline" className="gap-1 text-gray-600 border-gray-200 bg-gray-50">
            <XCircle className="h-3 w-3" />
            Cancelled
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Format date
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="mt-8 space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-9 w-20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-8">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              <span>Failed to load evidence requests. Please try again.</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const requests = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="mt-8 space-y-6">
      {/* Actions and Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value as StatusFilter);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="FULFILLED">Fulfilled</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            {data?.total ?? 0} request{(data?.total ?? 0) !== 1 ? "s" : ""}
          </span>
          <Button asChild>
            <Link href="/admin/evidence">
              <Plus className="h-4 w-4 mr-2" />
              New Request
            </Link>
          </Button>
        </div>
      </div>

      {/* Request List */}
      {requests.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              No evidence requests sent
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              {statusFilter === "all"
                ? "You haven't sent any evidence requests yet."
                : `You don't have any ${statusFilter.toLowerCase()} evidence requests.`}
            </p>
            <Button asChild className="mt-4">
              <Link href="/admin/evidence">
                <Plus className="h-4 w-4 mr-2" />
                Create Evidence Request
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <Card
              key={request.id}
              className={cn(
                "transition-colors hover:bg-gray-50",
                request.isOverdue && request.status === "PENDING" && "border-red-200 bg-red-50/50"
              )}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-3">
                    {/* Recipient Info */}
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">
                        {request.recipient.name ?? request.recipient.email}
                      </span>
                      {request.recipient.name && (
                        <span className="text-sm text-gray-500">
                          ({request.recipient.email})
                        </span>
                      )}
                    </div>

                    {/* Control Domains */}
                    <div className="flex flex-wrap gap-2">
                      {request.controlDomains.map((domain) => (
                        <Badge key={domain.id} variant="secondary">
                          {domain.name}
                        </Badge>
                      ))}
                    </div>

                    {/* Request Info */}
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>Due: {formatDate(request.dueDate)}</span>
                      </div>
                      <span>|</span>
                      <span>Sent {request.daysSinceSent} day{request.daysSinceSent !== 1 ? "s" : ""} ago</span>
                    </div>

                    {/* Fulfilled Evidence Link (AC34) */}
                    {request.status === "FULFILLED" && request.evidence && (
                      <div className="flex items-center gap-1 text-sm text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        <span>
                          Fulfilled:{" "}
                          <Link
                            href={`/admin/evidence/${request.evidence.id}`}
                            className="underline hover:no-underline"
                          >
                            {request.evidence.title}
                          </Link>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Right Side: Status + Actions */}
                  <div className="flex flex-col items-end gap-3">
                    {getStatusBadge(request.status, request.isOverdue)}

                    <div className="flex gap-2">
                      {request.status === "FULFILLED" && request.evidence && (
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                        >
                          <Link href={`/admin/evidence/${request.evidence.id}`}>
                            <Eye className="h-4 w-4 mr-1" />
                            View Evidence
                          </Link>
                        </Button>
                      )}
                      {/* AC32: Cancel pending request */}
                      {request.status === "PENDING" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => setCancelRequestId(request.id)}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </Button>
        </div>
      )}

      {/* Cancel Confirmation Dialog (AC32, AC33) */}
      <Dialog open={!!cancelRequestId} onOpenChange={() => setCancelRequestId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Evidence Request?</DialogTitle>
            <DialogDescription>
              This will cancel the evidence request and notify the recipient via email.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelRequestId(null)}
              disabled={cancelMutation.isPending}
            >
              Keep Request
            </Button>
            <Button
              onClick={handleConfirmCancel}
              disabled={cancelMutation.isPending}
              variant="destructive"
            >
              {cancelMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                "Cancel Request"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
