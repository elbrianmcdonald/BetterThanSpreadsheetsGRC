"use client";

/**
 * New Assessment Client Component
 *
 * Epic 3: Assessment Workflow
 * Story 3.1: Create Vendor Assessment (FR17)
 *
 * Client component for creating new vendor assessments.
 */

import { useRouter } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import toast from "react-hot-toast";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { api } from "@/trpc/react";
import { VendorAssessmentForm } from "@/components/assessment";

interface NewAssessmentClientProps {
  vendorId?: string;
}

export function NewAssessmentClient({ vendorId }: NewAssessmentClientProps) {
  const router = useRouter();

  const createMutation = api.vendorAssessment.create.useMutation({
    onSuccess: (assessment) => {
      toast.success("Assessment created successfully");
      router.push(`/tprm/assessments/${assessment.id}`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create assessment");
    },
  });

  const handleSubmit = async (data: {
    title: string;
    vendorId: string;
    dueDate?: Date | null;
    assessorId?: string | null;
  }) => {
    await createMutation.mutateAsync({
      title: data.title,
      vendorId: data.vendorId,
      dueDate: data.dueDate ?? undefined,
      assessorId: data.assessorId ?? undefined,
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-3">
          <ClipboardCheck className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">New Vendor Assessment</h1>
          <p className="text-sm text-muted-foreground">
            Create a new assessment for a third-party vendor
          </p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Assessment Details</CardTitle>
          <CardDescription>
            Provide the basic information for this assessment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VendorAssessmentForm
            mode="create"
            vendorId={vendorId}
            onSubmit={handleSubmit}
            isSubmitting={createMutation.isPending}
          />
        </CardContent>
      </Card>
    </div>
  );
}
