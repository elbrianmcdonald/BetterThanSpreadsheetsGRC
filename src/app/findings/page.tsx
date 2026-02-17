/**
 * Findings List Page
 *
 * Story 7.12: Findings List Page
 *
 * AC1: Page accessible at `/findings`
 * AC2: Page protected - requires authenticated user
 * AC3: Page title: "Findings"
 * AC4: "New Finding" button in header (role-based visibility)
 */

import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/server/auth";
import { FindingsListContent } from "./FindingsListContent";

export const metadata = {
  title: "Findings | BetterThanSpreadsheets GRC",
};

export default async function FindingsPage() {
  // AC2: Page protected - requires authenticated user
  const session = await getServerAuthSession();
  if (!session) {
    redirect("/api/auth/signin");
  }

  return <FindingsListContent />;
}
