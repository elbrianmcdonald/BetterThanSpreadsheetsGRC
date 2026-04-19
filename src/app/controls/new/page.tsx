import { Suspense } from "react";
import { auth } from "@/server/auth";
import { requireRole } from "@/lib/auth/route-protection";
import { UserRole } from "@prisma/client";
import { NewControlClient } from "./client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "New Control | BetterThanSpreadsheetsGRC",
  description: "Author a new organizational control",
};

const ROLES = [UserRole.ORG_ADMIN, UserRole.GRC_ANALYST, UserRole.SECURITY_ENGINEER];

export default async function NewControlPage() {
  const session = await auth();
  requireRole(session, ROLES, "/controls/new");

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      }
    >
      <NewControlClient />
    </Suspense>
  );
}
