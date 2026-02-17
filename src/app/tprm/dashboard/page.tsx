/**
 * TPRM Dashboard Page
 *
 * Epic 2: Vendor Risk Tiering
 * Story 2.3: Risk Tier Dashboard (FR13)
 *
 * AC1: Page accessible at `/tprm/dashboard`
 * AC2: Shows vendor count by risk tier with chart visualization
 * AC3: Summary cards for total vendors, critical tier, overdue reviews
 * AC4: Upcoming reviews section
 * AC5: Links from chart segments to filtered vendor list
 */

import { auth } from "@/server/auth";
import { requireRole } from "@/lib/auth/route-protection";
import { UserRole } from "@prisma/client";
import { AppLayout } from "@/components/layout";
import { TPRMDashboardClient } from "./client";

/**
 * Roles that can view the TPRM Dashboard
 */
const TPRM_VIEW_ROLES = [
  UserRole.ORG_ADMIN,
  UserRole.GRC_ANALYST,
  UserRole.SECURITY_ENGINEER,
  UserRole.CISO,
  UserRole.IT_STAKEHOLDER,
  UserRole.BUSINESS_STAKEHOLDER,
  UserRole.AUDITOR,
];

export const metadata = {
  title: "TPRM Dashboard | BetterThanSpreadsheetsGRC",
  description: "Third Party Risk Management Dashboard - Vendor risk tier overview and review status",
};

export default async function TPRMDashboardPage() {
  const session = await auth();

  // AC2: Require authentication and role
  requireRole(session, TPRM_VIEW_ROLES, "/");

  return (
    <AppLayout
      breadcrumbs={[
        { label: "Third Party" },
        { label: "TPRM Dashboard" },
      ]}
    >
      <TPRMDashboardClient />
    </AppLayout>
  );
}
