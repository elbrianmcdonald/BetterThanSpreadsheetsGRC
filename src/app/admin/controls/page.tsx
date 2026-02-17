/**
 * Control Library Page
 *
 * Story 12.8: Control Search & Browse UI (AC1-AC4)
 *
 * Cross-framework control browsing with search, filtering, and health indicators.
 */

import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/server/auth";
import { ControlLibraryClient } from "./client";

export const metadata = {
  title: "Control Library | BetterThanSpreadsheets GRC",
  description: "Browse and search controls across all frameworks",
};

export default async function ControlLibraryPage() {
  const session = await getServerAuthSession();

  if (!session) {
    redirect("/login");
  }

  return <ControlLibraryClient />;
}
