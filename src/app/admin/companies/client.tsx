"use client";

import { Building2 } from "lucide-react";

import { AppLayout, PageHeader } from "@/components/layout";
import { CompaniesManager } from "@/components/admin/CompaniesManager";

export function CompaniesClient() {
  return (
    <AppLayout breadcrumbs={[{ label: "Administration" }, { label: "Companies" }]}>
      <div className="px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="PLATFORM"
          title="Companies"
          icon={<Building2 />}
          description="Create, view, and delete companies across the platform. Deleting a company permanently removes all of its data."
        />
        <div className="mt-6">
          <CompaniesManager />
        </div>
      </div>
    </AppLayout>
  );
}
