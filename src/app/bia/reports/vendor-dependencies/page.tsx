/**
 * Vendor Dependencies Report Page
 *
 * Epic 13: BIA Reporting & Compliance
 * Story 13.4: Process-Vendor Dependency Reports
 */

import { AppLayout } from "@/components/layout";
import { Building2 } from "lucide-react";
import { VendorDependenciesClient } from "./client";

export const metadata = {
  title: "Vendor Dependencies Report | BetterThanSpreadsheetsGRC",
  description: "View vendor concentration risk and process dependencies",
};

export default function VendorDependenciesPage() {
  return (
    <AppLayout
      breadcrumbs={[
        { label: "Business Impact" },
        { label: "Reports" },
        { label: "Vendor Dependencies" },
      ]}
    >
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            Vendor Dependencies Report
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Identify vendor concentration risk by viewing which vendors support critical business processes.
          </p>
        </div>

        <VendorDependenciesClient />
      </div>
    </AppLayout>
  );
}
