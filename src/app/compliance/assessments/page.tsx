/**
 * Compliance Assessments Page
 *
 * Displays compliance management dashboard with frameworks and assessments.
 */

import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { CoverageDashboardClient } from "./client";

export const metadata = {
  title: "Compliance Assessments | Compliance",
  description: "Manage frameworks and track compliance assessments",
};

export default async function ComplianceAssessmentsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/api/auth/signin");
  }

  return <CoverageDashboardClient />;
}
