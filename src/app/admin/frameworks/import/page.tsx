import { Suspense } from "react";
import { auth } from "@/server/auth";
import { requireRole } from "@/lib/auth/route-protection";
import { UserRole } from "@prisma/client";
import { FrameworkImportClient } from "./client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Import Framework | BetterThanSpreadsheetsGRC",
  description: "Import a control framework from a CSV or Excel file",
};

// Matches the FRAMEWORK_MANAGE permission required by the parse/import mutations
const ROLES = [UserRole.ADMINISTRATOR];

export default async function FrameworkImportPage() {
  const session = await auth();
  requireRole(session, ROLES, "/admin/frameworks/import");

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      }
    >
      <FrameworkImportClient />
    </Suspense>
  );
}
