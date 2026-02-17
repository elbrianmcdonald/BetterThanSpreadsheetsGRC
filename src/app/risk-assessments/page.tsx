/**
 * Risk Assessment Projects List Page
 *
 * Story 1.2: Assessment List Page
 *
 * AC1: Page accessible at `/risk-assessments`
 * AC2: Page protected - requires authenticated user
 * AC3: Page title: "Risk Assessments"
 * AC4: View all assessments in organization
 */

import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/server/auth";
import { RiskAssessmentsListContent } from "./RiskAssessmentsListContent";

export const metadata = {
  title: "Risk Assessments | BetterThanSpreadsheets GRC",
};

export default async function RiskAssessmentsPage() {
  // AC2: Page protected - requires authenticated user
  const session = await getServerAuthSession();
  if (!session) {
    redirect("/api/auth/signin");
  }

  return <RiskAssessmentsListContent />;
}
