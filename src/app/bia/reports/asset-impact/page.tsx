/**
 * Asset Impact Report Page
 *
 * Epic 14: Asset Registry & BIA Integration
 * Story 14.7: Asset Impact Report
 */

import { AppLayout } from "@/components/layout";
import { Server } from "lucide-react";
import { AssetImpactClient } from "./client";

export const metadata = {
  title: "Asset Impact Report | BetterThanSpreadsheetsGRC",
  description: "View asset dependencies and business process impact",
};

export default function AssetImpactReportPage() {
  return (
    <AppLayout
      breadcrumbs={[
        { label: "Business Impact" },
        { label: "Reports" },
        { label: "Asset Impact" },
      ]}
    >
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Server className="h-6 w-6" />
            Asset Impact Report
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Understand which business processes depend on each asset to assess impact of outages and maintenance.
          </p>
        </div>

        <AssetImpactClient />
      </div>
    </AppLayout>
  );
}
