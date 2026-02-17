/**
 * Vendors List Page
 *
 * Epic 1: TPRM Vendor Registry
 * Story 1.2: Vendor List View with Filtering (FR2)
 *
 * AC1: Page accessible at `/vendors`
 * AC2: Page protected - requires authenticated user
 * AC3: Page title: "Vendor Registry"
 */

import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/server/auth";
import { VendorListContent } from "./client";

export const metadata = {
  title: "Vendor Registry | BetterThanSpreadsheets GRC",
  description: "Manage third-party vendor relationships",
};

export default async function VendorsPage() {
  // AC2: Page protected - requires authenticated user
  const session = await getServerAuthSession();
  if (!session) {
    redirect("/api/auth/signin");
  }

  return <VendorListContent />;
}
