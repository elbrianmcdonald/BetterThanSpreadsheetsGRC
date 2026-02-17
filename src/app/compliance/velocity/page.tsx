/**
 * Remediation Velocity Report Page
 *
 * Story 5.8: Remediation Velocity Metrics (Average Days-to-Close)
 *
 * Detailed velocity report page:
 * - AC17: Clicking widget navigates to detailed velocity report page
 * - AC18: Report shows: Overall average, Average by severity, Average by IT owner,
 *         Average by finding source, Slowest risks (bottom 10 by days-to-close)
 * - AC19: Report includes table listing all closed risks with days-to-close
 * - AC20: Table sortable by days-to-close, closed date, severity
 * - AC21: Report exportable to CSV
 *
 * @see Story 5.8: Remediation Velocity Metrics
 */

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { hasPermission, Permission } from "@/server/auth/permissions";
import { VelocityReportClient } from "./client";

export const metadata = {
  title: "Remediation Velocity Report | BetterThanSpreadsheetsGRC",
  description: "Detailed remediation velocity metrics and analysis",
};

export default async function VelocityReportPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Requires RISK_READ_ALL permission (same as compliance dashboard)
  const canViewReport = hasPermission(session.user.role, Permission.RISK_READ_ALL);

  if (!canViewReport) {
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
      <VelocityReportClient />
    </Suspense>
  );
}
