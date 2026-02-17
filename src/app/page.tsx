/**
 * Home Page / Dashboard
 *
 * Main landing page for BetterThanSpreadsheetsGRC.
 * Shows dashboard widgets and quick stats.
 */

// Force dynamic rendering to ensure proper hydration with session-dependent UI
export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, Plus } from "lucide-react";

import { auth } from "@/server/auth";
import { StaleDraftsWidget, HomeMetricsCards } from "@/components/dashboard";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const session = await auth();

  // Redirect to login if not authenticated
  if (!session) {
    redirect("/login");
  }

  const isAdmin = session.user?.role === "ORG_ADMIN";
  const isGrcAnalyst = session.user?.role === "GRC_ANALYST";
  const isSecurityEngineer = session.user?.role === "SECURITY_ENGINEER";

  const canManageRisks = isAdmin || isGrcAnalyst || isSecurityEngineer;
  const canManageFindings = isAdmin || isGrcAnalyst || isSecurityEngineer;

  return (
    <AppLayout showBreadcrumbs={false}>
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {session.user?.name?.split(" ")[0]}!
        </h1>
        <p className="mt-2 text-gray-600">
          Here&apos;s an overview of your GRC program.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          {canManageRisks && (
            <Button asChild>
              <Link href="/risks/new">
                <Plus className="h-4 w-4 mr-2" />
                New Risk
              </Link>
            </Button>
          )}
          {canManageFindings && (
            <Button asChild variant="outline">
              <Link href="/findings/new">
                <Plus className="h-4 w-4 mr-2" />
                New Finding
              </Link>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link href="/compliance/dashboard">
              <BarChart3 className="h-4 w-4 mr-2" />
              View Compliance
            </Link>
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <HomeMetricsCards />

      {/* Attention Required Section */}
      {canManageRisks && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Attention Required</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <StaleDraftsWidget />
          </div>
        </div>
      )}
    </AppLayout>
  );
}
