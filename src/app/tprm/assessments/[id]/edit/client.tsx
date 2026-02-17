"use client";

/**
 * Edit Assessment Client Component
 *
 * Epic 3: Assessment Workflow
 * Story 3.4: Assessment Scoring and Recommendation (FR21, FR22)
 * Story 3.5: Assessment Notes and Summary (FR23)
 *
 * Client component for editing vendor assessments.
 */

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ClipboardCheck, AlertTriangle, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { VendorAssessmentStatus } from "@prisma/client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/trpc/react";
import { VendorAssessmentForm } from "@/components/assessment";

interface EditAssessmentClientProps {
  assessmentId: string;
}

export function EditAssessmentClient({ assessmentId }: EditAssessmentClientProps) {
  const router = useRouter();

  // Fetch assessment
  const { data: assessment, isLoading, error } = api.vendorAssessment.getById.useQuery(
    { id: assessmentId },
    { retry: false }
  );

  const updateMutation = api.vendorAssessment.update.useMutation({
    onSuccess: () => {
      toast.success("Assessment updated successfully");
      router.push(`/tprm/assessments/${assessmentId}`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update assessment");
    },
  });

  const handleSubmit = async (data: {
    title?: string;
    dueDate?: Date | null;
    assessorId?: string | null;
    riskScore?: number | null;
    recommendation?: "APPROVE" | "CONDITIONAL_APPROVE" | "REJECT" | null;
    conditions?: string | null;
    rejectionReason?: string | null;
    summary?: string | null;
  }) => {
    await updateMutation.mutateAsync({
      id: assessmentId,
      ...data,
    });
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !assessment) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="p-8 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
          <h3 className="mt-4 text-lg font-semibold">Assessment not found</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {error?.message || "The assessment you're looking for doesn't exist or you don't have access."}
          </p>
          <Link href="/tprm/assessments">
            <Button className="mt-4" variant="outline">
              Back to Assessments
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  // Cannot edit completed assessments
  if (assessment.status === VendorAssessmentStatus.COMPLETED) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="p-8 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-yellow-500" />
          <h3 className="mt-4 text-lg font-semibold">Assessment Completed</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Completed assessments cannot be modified.
          </p>
          <Link href={`/tprm/assessments/${assessmentId}`}>
            <Button className="mt-4" variant="outline">
              View Assessment
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-3">
          <ClipboardCheck className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Edit Assessment</h1>
          <p className="text-sm text-muted-foreground">
            {assessment.identifier} - {assessment.vendor.name}
          </p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Assessment Details</CardTitle>
          <CardDescription>
            Update assessment information, scoring, and recommendations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VendorAssessmentForm
            mode="edit"
            defaultValues={{
              title: assessment.title,
              vendorId: assessment.vendor.id,
              dueDate: assessment.dueDate ? new Date(assessment.dueDate) : null,
              assessorId: assessment.assessor?.id || null,
              riskScore: assessment.riskScore,
              recommendation: assessment.recommendation,
              conditions: assessment.conditions,
              rejectionReason: assessment.rejectionReason,
              summary: assessment.summary,
            }}
            onSubmit={handleSubmit}
            isSubmitting={updateMutation.isPending}
          />
        </CardContent>
      </Card>
    </div>
  );
}
