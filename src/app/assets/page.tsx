/**
 * Asset Registry List Page
 *
 * Epic 14: Asset Registry & BIA Integration
 * Story 14.2: Asset List Page with Filtering
 */

import { AppLayout, PageHeader } from "@/components/layout";
import { Server } from "lucide-react";
import { AssetListClient } from "./client";

export const metadata = {
  title: "Asset Registry | BetterThanSpreadsheetsGRC",
  description: "Manage IT assets and their business process dependencies",
};

export default function AssetsPage() {
  return (
    <AppLayout
      breadcrumbs={[
        { label: "Business Impact" },
        { label: "Asset Registry" },
      ]}
    >
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          eyebrow="BUSINESS IMPACT"
          title="Asset Registry"
          icon={<Server />}
          description="Manage IT assets and track their dependencies on business processes."
        />

        <AssetListClient />
      </div>
    </AppLayout>
  );
}
