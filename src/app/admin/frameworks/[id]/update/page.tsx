/**
 * Framework Update Page
 *
 * Allows administrators to update an OSCAL catalog to a new version.
 *
 * @see Story 2.7: OSCAL Catalog Update Workflow (AC32-AC37)
 * @module app/admin/frameworks/[id]/update
 */

import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { FrameworkUpdateClient } from "./client";

export const metadata = {
  title: "Update Framework | Admin",
  description: "Update OSCAL catalog to a new version",
};

interface UpdatePageProps {
  params: Promise<{ id: string }>;
}

export default async function FrameworkUpdatePage({ params }: UpdatePageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect("/api/auth/signin");
  }

  const { id } = await params;

  return <FrameworkUpdateClient frameworkId={id} />;
}
