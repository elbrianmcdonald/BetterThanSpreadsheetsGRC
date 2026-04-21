import { Suspense } from "react";
import { auth } from "@/server/auth";
import { requireRole } from "@/lib/auth/route-protection";
import { UserRole } from "@prisma/client";
import { HostnameSettingsClient } from "./client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Hostname & HTTPS | BetterThanSpreadsheetsGRC",
  description: "Configure the deployment's public hostname and TLS certificate",
};

export default async function HostnameSettingsPage() {
  const session = await auth();
  requireRole(session, [UserRole.ORG_ADMIN], "/admin/settings/hostname");

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      }
    >
      <HostnameSettingsClient />
    </Suspense>
  );
}
