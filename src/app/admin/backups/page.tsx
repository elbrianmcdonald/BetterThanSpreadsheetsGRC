import { Suspense } from "react";
import { auth } from "@/server/auth";
import { requireRole } from "@/lib/auth/route-protection";
import { UserRole } from "@prisma/client";
import { BackupsClient } from "./client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Backups | BetterThanSpreadsheetsGRC",
  description: "Download application backups and restore from a backup archive",
};

export default async function BackupsPage() {
  const session = await auth();
  requireRole(session, [UserRole.ORG_ADMIN], "/admin/backups");

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      }
    >
      <BackupsClient />
    </Suspense>
  );
}
