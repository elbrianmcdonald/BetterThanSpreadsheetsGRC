/**
 * Maturity Assessment Detail Page
 *
 * Server component that handles authentication and renders the
 * client-side assessment detail with scoring functionality.
 */

import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api } from "@/trpc/server";
import { getServerAuthSession } from "@/server/auth";
import { MaturityAssessmentDetailClient } from "./client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;

  try {
    const assessment = await api.maturity.getById({ id });
    return {
      title: `${assessment.name} | Maturity Assessment | BetterThanSpreadsheets GRC`,
      description: `Maturity assessment for ${assessment.framework.name}`,
    };
  } catch {
    return {
      title: "Maturity Assessment | BetterThanSpreadsheets GRC",
    };
  }
}

function LoadingSkeleton() {
  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    </div>
  );
}

export default async function MaturityAssessmentDetailPage({ params }: PageProps) {
  const session = await getServerAuthSession();
  if (!session) {
    redirect("/api/auth/signin?callbackUrl=/maturity");
  }
  const { id } = await params;

  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <MaturityAssessmentDetailClient assessmentId={id} />
    </Suspense>
  );
}
