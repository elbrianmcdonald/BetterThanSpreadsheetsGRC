/**
 * Framework Reconciliation Report Page
 *
 * Displays post-update reconciliation report showing:
 * - Deprecated controls with evidence
 * - New controls requiring evidence
 * - Modified controls
 *
 * @see Story 2.7: OSCAL Catalog Update Workflow (AC27-AC30)
 * @module app/admin/frameworks/[id]/reconciliation
 */

import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { ReconciliationReportClient } from "./client";

export const metadata = {
  title: "Reconciliation Report | Admin",
  description: "View framework update reconciliation report",
};

interface ReconciliationPageProps {
  params: Promise<{ id: string }>;
}

export default async function ReconciliationReportPage({ params }: ReconciliationPageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect("/api/auth/signin");
  }

  const { id } = await params;

  return <ReconciliationReportClient frameworkId={id} />;
}
