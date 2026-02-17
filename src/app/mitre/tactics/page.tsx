/**
 * MITRE ATT&CK Tactics Page
 *
 * Story 13.5: Tactic Browse UI
 *
 * Displays all 14 MITRE ATT&CK tactics in kill chain order with technique counts.
 */

import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/server/auth";
import { TacticsClient } from "./client";

export const metadata = {
  title: "MITRE ATT&CK Tactics | BetterThanSpreadsheets GRC",
  description: "Browse MITRE ATT&CK tactics for threat modeling",
};

export default async function TacticsPage() {
  const session = await getServerAuthSession();

  if (!session) {
    redirect("/login");
  }

  return <TacticsClient />;
}
