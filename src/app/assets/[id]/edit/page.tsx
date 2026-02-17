/**
 * Edit Asset Page
 *
 * Epic 14: Asset Registry & BIA Integration
 * Story 14.4: Create/Edit Asset Forms
 */

import { AppLayout } from "@/components/layout";
import { EditAssetClient } from "./client";

export const metadata = {
  title: "Edit Asset | BetterThanSpreadsheetsGRC",
  description: "Edit IT asset details",
};

export default async function EditAssetPage({
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
        { label: "Edit Asset" },
      ]}
    >
      <EditAssetClient assetId={id} />
    </AppLayout>
  );
}
