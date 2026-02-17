/**
 * Compliance Dashboard Page
 *
 * Story 5.1: Compliance Summary Dashboard (AC1-AC35)
 *
 * Main entry point for compliance dashboard:
 * - AC1: Accessible at `/compliance/dashboard`
 * - AC32-AC35: Role-based access control
 *
 * @see Story 5.1: Compliance Summary Dashboard
 */

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { hasPermission, Permission } from "@/server/auth/permissions";
import { ComplianceDashboardClient } from "./client";

export const metadata = {
  title: "Compliance Dashboard | BetterThanSpreadsheetsGRC",
  description: "View compliance coverage across all frameworks",
};

export default async function ComplianceDashboardPage() {
  // AC32-AC35: Check user authentication and permissions
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // AC32: Accessible to CISO, GRC_ANALYST, SECURITY_ENGINEER, ORG_ADMIN, AUDITOR
  // AC33: IT_STAKEHOLDER and BUSINESS_STAKEHOLDER cannot access
  const canViewDashboard = hasPermission(session.user.role, Permission.FRAMEWORK_READ);

  if (!canViewDashboard) {
    // AC35: Unauthorized access redirects to home with error message
    redirect("/?error=unauthorized");
  }

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      }
    >
      <ComplianceDashboardClient />
    </Suspense>
  );
}
