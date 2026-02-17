/**
 * Create Asset Page
 *
 * Epic 14: Asset Registry & BIA Integration
 * Story 14.4: Create/Edit Asset Forms
 */

import { AppLayout } from "@/components/layout";
import { CreateAssetClient } from "./client";

export const metadata = {
  title: "Create Asset | BetterThanSpreadsheetsGRC",
  description: "Create a new IT asset",
};

export default function CreateAssetPage() {
  return (
    <AppLayout
      breadcrumbs={[
        { label: "Business Impact" },
        { label: "Asset Registry", href: "/assets" },
        { label: "Create Asset" },
      ]}
    >
      <CreateAssetClient />
    </AppLayout>
  );
}
