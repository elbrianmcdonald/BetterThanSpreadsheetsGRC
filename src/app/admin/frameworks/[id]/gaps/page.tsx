/**
 * Framework Gap Analysis Page
 *
 * Displays unsatisfied controls (gaps) for a specific framework.
 *
 * @see Story 2.6: AC25-AC29
 * @module app/admin/frameworks/[id]/gaps
 */

import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { GapAnalysisClient } from "./client";

export const metadata = {
  title: "Gap Analysis | Admin",
  description: "View unsatisfied controls for compliance gap analysis",
};

interface GapAnalysisPageProps {
  params: Promise<{ id: string }>;
}

export default async function GapAnalysisPage({ params }: GapAnalysisPageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect("/api/auth/signin");
  }

  const { id } = await params;

  return (
    <div className="container mx-auto py-8 px-4">
      <GapAnalysisClient frameworkId={id} />
    </div>
  );
}
