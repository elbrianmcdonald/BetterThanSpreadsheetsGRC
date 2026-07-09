"use client";

import { ClipboardCheck } from "lucide-react";

import { AppLayout, PageHeader } from "@/components/layout";
import { CompliancePlansManager } from "@/components/compliance/CompliancePlansManager";

export function CompliancePlansClient() {
  return (
    <AppLayout breadcrumbs={[{ label: "Compliance" }, { label: "Plans" }]}>
      <div className="px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="COMPLIANCE"
          title="Compliance Plans"
          icon={<ClipboardCheck />}
          description="Bridge assessment gaps to remediation. Each plan tracks the controls that must be met — evidence, owner, status, target date, and acceptance criteria."
        />
        <div className="mt-6">
          <CompliancePlansManager />
        </div>
      </div>
    </AppLayout>
  );
}
