import { Suspense } from "react";
import { auth } from "@/server/auth";
import { requireRole } from "@/lib/auth/route-protection";
import { UserRole } from "@prisma/client";
import { NewFrameworkClient } from "./client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Create Framework | BetterThanSpreadsheetsGRC",
  description: "Author a custom framework using controls from your organization library",
};

const ROLES = [UserRole.ADMINISTRATOR, UserRole.ANALYST];

export default async function NewFrameworkPage() {
  const session = await auth();
  requireRole(session, ROLES, "/admin/frameworks/new");

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      }
    >
      <NewFrameworkClient />
    </Suspense>
  );
}
