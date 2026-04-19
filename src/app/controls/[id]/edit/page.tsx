import { Suspense } from "react";
import { notFound } from "next/navigation";
import { auth } from "@/server/auth";
import { requireRole } from "@/lib/auth/route-protection";
import { UserRole } from "@prisma/client";
import { EditControlClient } from "./client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Edit Control | BetterThanSpreadsheetsGRC",
};

const ROLES = [UserRole.ORG_ADMIN, UserRole.GRC_ANALYST, UserRole.SECURITY_ENGINEER];

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditControlPage({ params }: Props) {
  const { id } = await params;
  if (!id) notFound();

  const session = await auth();
  requireRole(session, ROLES, `/controls/${id}/edit`);

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      }
    >
      <EditControlClient controlId={id} />
    </Suspense>
  );
}
