"use client";

/**
 * Evidence Request Detail Client Component
 *
 * Displays full evidence request details and handles evidence upload for fulfillment.
 *
 * AC24-AC29: Request detail view with upload and fulfillment workflow
 *
 * @see Story 3.12: Evidence Request Workflow
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  FileText,
  Upload,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Loader2,
} from "lucide-react";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface EvidenceRequestDetailClientProps {
  requestId: string;
}

export function EvidenceRequestDetailClient({ requestId }: EvidenceRequestDetailClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const utils = api.useUtils();

  // Check if we should auto-open upload dialog
  const shouldAutoOpenUpload = searchParams.get("action") === "upload";
  const [showUploadDialog, setShowUploadDialog] = useState(shouldAutoOpenUpload);

  // Fetch request details
  const { data: request, isLoading, error } = api.evidenceRequest.getById.useQuery({
    id: requestId,
  });

  // Fulfill request mutation
  const fulfillMutation = api.evidenceRequest.fulfill.useMutation({
    onSuccess: () => {
      utils.evidenceRequest.getById.invalidate({ id: requestId });
      utils.evidenceRequest.listMyRequests.invalidate();
      utils.evidenceRequest.getPendingCount.invalidate();
      setShowUploadDialog(false);
    },
  });

  // Auto-open upload dialog if requested
  useEffect(() => {
    if (shouldAutoOpenUpload && request?.status === "PENDING") {
      setShowUploadDialog(true);
    }
  }, [shouldAutoOpenUpload, request?.status]);

  // Handle evidence upload success
  const handleUploadSuccess = (evidenceId: string) => {
    fulfillMutation.mutate({
      requestId,
      evidenceId,
    });
  };

  // Format date
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  // Status badge
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" asChild>
          <Link href="/evidence-requests">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Requests
          </Link>
        </Button>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              <span>
                {error?.message ?? "Evidence request not found"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button variant="ghost" asChild>
        <Link href="/evidence-requests">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Requests
        </Link>
      </Button>

      {/* Header with Status and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-gray-900">
              Evidence Request
            </h1>
            {getStatusBadge(request.status, request.isOverdue)}
          </div>
          <p className="text-sm text-gray-500">
            Requested on {formatDate(request.createdAt)}
          </p>
        </div>

        {/* AC26: Upload Evidence button prominently displayed */}
        {request.status === "PENDING" && (
          <Button
            size="lg"
            onClick={() => setShowUploadDialog(true)}
            className="gap-2"
          >
            <Upload className="h-5 w-5" />
            Upload Evidence
          </Button>
        )}
      </div>

      {/* Request Details */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Control Domains */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Requested Control Domains</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {request.controlDomains.map((domain) => (
                  <Badge key={domain.id} variant="secondary" className="text-sm">
                    {domain.code}: {domain.name}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Instructions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Instructions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none">
                <p className="whitespace-pre-wrap text-gray-700">
                  {request.instructions}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Fulfilled Evidence */}
          {request.status === "FULFILLED" && request.evidence && (
            <Card className="border-green-200 bg-green-50/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-green-700">
                  <CheckCircle className="h-5 w-5" />
                  Submitted Evidence
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="font-medium">{request.evidence.title}</p>
                      <p className="text-sm text-gray-500">
                        {request.evidence.originalFileName}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/evidence/${request.evidence.id}`}>
                      View Evidence
                    </Link>
                  </Button>
                </div>
                {request.fulfilledAt && (
                  <p className="mt-4 text-sm text-gray-500">
                    Submitted on {formatDate(request.fulfilledAt)}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Due Date */}
          <Card className={cn(
            request.isOverdue && request.status === "PENDING" && "border-red-200 bg-red-50/50"
          )}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Due Date
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-medium">
                {formatDate(request.dueDate)}
              </p>
              {request.status === "PENDING" && (
                <p className={cn(
                  "mt-1 text-sm",
                  request.daysUntilDue < 0 ? "text-red-600 font-medium" :
                  request.daysUntilDue <= 3 ? "text-amber-600 font-medium" :
                  "text-gray-500"
                )}>
                  {request.daysUntilDue < 0 ? (
                    `${Math.abs(request.daysUntilDue)} day${Math.abs(request.daysUntilDue) !== 1 ? "s" : ""} overdue`
                  ) : request.daysUntilDue === 0 ? (
                    "Due today"
                  ) : (
                    `${request.daysUntilDue} day${request.daysUntilDue !== 1 ? "s" : ""} remaining`
                  )}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Requester */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5" />
                Requested By
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">
                {request.requestedBy.name ?? "Unknown"}
              </p>
              <p className="text-sm text-gray-500">
                {request.requestedBy.email}
              </p>
            </CardContent>
          </Card>

          {/* Framework Context */}
          {request.frameworkCode && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Framework Context</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant="outline">{request.frameworkCode}</Badge>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Upload Evidence Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload Evidence</DialogTitle>
            <DialogDescription>
              Upload a file to fulfill this evidence request. The file will be linked
              to the requested control domains.
            </DialogDescription>
          </DialogHeader>

          {fulfillMutation.isPending ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="mt-4 text-sm text-gray-500">
                Submitting evidence...
              </p>
            </div>
          ) : fulfillMutation.isError ? (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200">
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                <span>{fulfillMutation.error.message}</span>
              </div>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setShowUploadDialog(false)}
              >
                Close
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Upload your evidence file. After upload, you can select this request to fulfill it.
              </p>
              <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                <p className="text-sm text-blue-600">
                  <strong>Note:</strong> After uploading evidence in the main evidence
                  repository, return to this request and use the uploaded evidence to
                  fulfill the request.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowUploadDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  asChild
                >
                  <Link href="/admin/evidence">
                    Go to Evidence Upload
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
