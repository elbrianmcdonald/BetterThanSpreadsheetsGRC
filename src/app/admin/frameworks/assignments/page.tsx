/**
 * Framework-BU Assignments Admin Page
 *
 * BU-Scoped Compliance: Admin interface for managing which frameworks
 * apply to which business units.
 */

import { auth } from "@/server/auth";
import { requireRole } from "@/lib/auth/route-protection";
import { UserRole } from "@prisma/client";
import { AppLayout } from "@/components/layout";
import { FrameworkAssignmentsClient } from "./client";

export const metadata = {
  title: "Framework Assignments | BetterThanSpreadsheetsGRC",
  description: "Manage which frameworks apply to which business units",
};

export default async function FrameworkAssignmentsPage() {
  const session = await auth();

  // Only ORG_ADMIN can manage framework assignments
  requireRole(session, [UserRole.ADMINISTRATOR], "/admin/frameworks/assignments");

  return (
    <AppLayout breadcrumbs={[{ label: "Admin" }, { label: "Framework Assignments" }]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Framework Assignments
          </h1>
          <p className="mt-2 text-sm text-gray-700">
            Assign compliance frameworks to business units. Each business unit will have its
            compliance coverage calculated separately for assigned frameworks.
          </p>
        </div>

        <FrameworkAssignmentsClient />
      </div>
    </AppLayout>
  );
}
