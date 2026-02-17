/**
 * Asset Detail Page
 *
 * Epic 14: Asset Registry & BIA Integration
 * Story 14.3: Asset Detail Page
 */

import { AppLayout } from "@/components/layout";
import { AssetDetailClient } from "./client";

export const metadata = {
  title: "Asset Details | BetterThanSpreadsheetsGRC",
  description: "View and manage IT asset details",
};

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <AppLayout
      breadcrumbs={[
        { label: "Business Impact" },
        { label: "Asset Registry", href: "/assets" },
        { label: "Asset Details" },
      ]}
    >
      <AssetDetailClient assetId={id} />
    </AppLayout>
  );
}
