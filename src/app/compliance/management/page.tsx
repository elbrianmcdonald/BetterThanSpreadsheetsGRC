/**
 * Compliance Management Page
 *
 * Displays compliance management dashboard with frameworks and assessments.
 *
 * @see Story 2.6: Framework Coverage Calculation Engine
 * @module app/compliance/management
 */

import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { CoverageDashboardClient } from "./client";

export const metadata = {
  title: "Compliance Management | Compliance",
  description: "Manage frameworks and track compliance assessments",
};

export default async function ComplianceManagementPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/api/auth/signin");
  }

  return <CoverageDashboardClient />;
}
