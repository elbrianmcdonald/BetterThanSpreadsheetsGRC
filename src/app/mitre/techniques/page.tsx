/**
 * MITRE ATT&CK Techniques Page
 *
 * Story 13.6: Technique Search & Browse UI
 *
 * Search and browse MITRE ATT&CK techniques with filtering by tactic.
 */

import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/server/auth";
import { TechniquesClient } from "./client";

export const metadata = {
  title: "MITRE ATT&CK Techniques | BetterThanSpreadsheets GRC",
  description: "Search and browse MITRE ATT&CK techniques for threat modeling",
};

export default async function TechniquesPage() {
  const session = await getServerAuthSession();

  if (!session) {
    redirect("/login");
  }

  return <TechniquesClient />;
}
