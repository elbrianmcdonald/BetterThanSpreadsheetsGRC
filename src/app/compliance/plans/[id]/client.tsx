"use client";

import Link from "next/link";
import { ArrowLeft, ClipboardCheck } from "lucide-react";

import { AppLayout, PageHeader } from "@/components/layout";
import { CompliancePlanDetail } from "@/components/compliance/CompliancePlanDetail";
import { BridgeFromAssessment } from "@/components/compliance/BridgeFromAssessment";
import { api } from "@/trpc/react";

export function CompliancePlanDetailClient({ planId }: { planId: string }) {
  const { data: plan } = api.compliancePlan.get.useQuery({ id: planId });

  return (
    <AppLayout breadcrumbs={[{ label: "Compliance" }, { label: "Plans" }, { label: plan?.name ?? "Plan" }]}>
      <div className="px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/compliance/plans"
          className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All plans
        </Link>
        <PageHeader
          eyebrow="COMPLIANCE PLAN"
          title={plan?.name ?? "Plan"}
          icon={<ClipboardCheck />}
          description={plan?.description ?? "Controls to be met, with evidence, owner, status, target date, and acceptance criteria."}
        />
        <div className="mt-6 space-y-6">
          <BridgeFromAssessment planId={planId} />
          <CompliancePlanDetail planId={planId} />
        </div>
      </div>
    </AppLayout>
  );
}
