import { Suspense } from "react";
import { auth } from "@/server/auth";
import { requireRole } from "@/lib/auth/route-protection";
import { UserRole } from "@prisma/client";
import { SettingsHubClient } from "./client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Settings | BetterThanSpreadsheetsGRC",
  description: "Deployment-level configuration",
};

export default async function SettingsHubPage() {
  const session = await auth();
  requireRole(session, [UserRole.ADMINISTRATOR], "/admin/settings");

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      }
    >
      <SettingsHubClient />
    </Suspense>
  );
}
