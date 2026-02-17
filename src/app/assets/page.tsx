/**
 * Asset Registry List Page
 *
 * Epic 14: Asset Registry & BIA Integration
 * Story 14.2: Asset List Page with Filtering
 */

import { AppLayout } from "@/components/layout";
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
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
              <Server className="h-6 w-6" />
              Asset Registry
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Manage IT assets and track their dependencies on business processes.
            </p>
          </div>
        </div>

        <AssetListClient />
      </div>
    </AppLayout>
  );
}
