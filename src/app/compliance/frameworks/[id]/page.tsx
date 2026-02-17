/**
 * Framework Detail Page
 *
 * Story 5.1: Compliance Summary Dashboard (AC28-AC31)
 *
 * Shows framework controls with evidence status:
 * - AC28: Clicking framework card navigates here
 * - AC29: Accessible at `/compliance/frameworks/[id]`
 * - AC30: Shows all controls with evidence status
 * - AC31: "Upload Evidence" action for missing controls
 *
 * @see Story 5.1: Compliance Summary Dashboard
 */

import { Suspense } from "react";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/server/auth";
import { hasPermission, Permission } from "@/server/auth/permissions";
import { FrameworkDetailClient } from "./client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = {
  title: "Framework Details | BetterThanSpreadsheetsGRC",
  description: "View framework controls and evidence status",
};

export default async function FrameworkDetailPage({ params }: PageProps) {
  const { id } = await params;

  // Check user authentication and permissions
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const canViewFramework = hasPermission(session.user.role, Permission.FRAMEWORK_READ);

  if (!canViewFramework) {
    redirect("/?error=unauthorized");
  }

  if (!id) {
    notFound();
  }

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      }
    >
      <FrameworkDetailClient frameworkId={id} />
    </Suspense>
  );
}
