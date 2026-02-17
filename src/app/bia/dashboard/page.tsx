/**
 * BIA Dashboard Page
 *
 * Epic 13: BIA Reporting & Compliance
 * Story 13.1: BIA Dashboard Foundation
 */

import { AppLayout } from "@/components/layout";
import { BarChart3 } from "lucide-react";
import { BIADashboardClient } from "./client";

export const metadata = {
  title: "BIA Dashboard | BetterThanSpreadsheetsGRC",
  description: "Business Impact Assessment Dashboard",
};

export default function BIADashboardPage() {
  return (
    <AppLayout breadcrumbs={[{ label: "Business Impact" }, { label: "Dashboard" }]}>
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            BIA Dashboard
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Overview of business impact assessment status, tier distribution, and compliance metrics.
          </p>
        </div>

        <BIADashboardClient />
      </div>
    </AppLayout>
  );
}
