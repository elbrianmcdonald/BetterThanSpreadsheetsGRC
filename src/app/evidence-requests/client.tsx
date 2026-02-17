"use client";

/**
 * My Evidence Requests Client Component
 *
 * Client-side component for viewing and managing evidence requests assigned to the user.
 *
 * AC19: Recipients see "My Evidence Requests" page listing all pending requests
 * AC20: Request list shows: control domains, requester, due date, status, days until due
 * AC21: Overdue requests highlighted
 * AC22: Requests sortable by due date (soonest first)
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
  Upload,
  ChevronRight,
  Calendar,
  User,
  FileText,
} from "lucide-react";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "PENDING" | "FULFILLED" | "CANCELLED";

export function MyEvidenceRequestsClient() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Fetch my evidence requests
  const { data, isLoading, error } = api.evidenceRequest.listMyRequests.useQuery({
    status: statusFilter === "all" ? undefined : statusFilter,
    page,
    pageSize,
  });

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

  // Get days until due text
  const getDaysUntilDueText = (daysUntilDue: number, status: string) => {
    if (status !== "PENDING") return null;

    if (daysUntilDue < 0) {
      return (
        <span className="text-red-600 font-medium">
          {Math.abs(daysUntilDue)} day{Math.abs(daysUntilDue) !== 1 ? "s" : ""} overdue
        </span>
      );
    }
    if (daysUntilDue === 0) {
      return <span className="text-red-600 font-medium">Due today</span>;
    }
    if (daysUntilDue === 1) {
      return <span className="text-amber-600 font-medium">Due tomorrow</span>;
    }
    if (daysUntilDue <= 3) {
      return (
        <span className="text-amber-600 font-medium">
          {daysUntilDue} days left
        </span>
      );
    }
    return (
      <span className="text-gray-600">
        {daysUntilDue} days left
      </span>
    );
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
      {/* Filters */}
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
        <div className="text-sm text-gray-500">
          {data?.total ?? 0} request{(data?.total ?? 0) !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Request List */}
      {requests.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              No evidence requests
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              {statusFilter === "all"
                ? "You don't have any evidence requests assigned to you."
                : `You don't have any ${statusFilter.toLowerCase()} evidence requests.`}
            </p>
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
                        <User className="h-4 w-4" />
                        <span>From: {request.requestedBy.name ?? request.requestedBy.email}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>Due: {formatDate(request.dueDate)}</span>
                      </div>
                    </div>

                    {/* Days Until Due */}
                    <div>
                      {getDaysUntilDueText(request.daysUntilDue, request.status)}
                    </div>

                    {/* Fulfilled Evidence Link */}
                    {request.status === "FULFILLED" && request.evidence && (
                      <div className="flex items-center gap-1 text-sm text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        <span>
                          Submitted: <Link href={`/admin/evidence/${request.evidence.id}`} className="underline hover:no-underline">{request.evidence.title}</Link>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Right Side: Status + Actions */}
                  <div className="flex flex-col items-end gap-3">
                    {getStatusBadge(request.status, request.isOverdue)}

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <Link href={`/evidence-requests/${request.id}`}>
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Link>
                      </Button>
                      {request.status === "PENDING" && (
                        <Button
                          size="sm"
                          asChild
                        >
                          <Link href={`/evidence-requests/${request.id}?action=upload`}>
                            <Upload className="h-4 w-4 mr-1" />
                            Upload
                          </Link>
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
    </div>
  );
}
