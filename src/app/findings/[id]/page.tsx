/**
 * Finding Detail Page
 *
 * Story 7.11: Finding Detail Page with Inline Expansion
 *
 * Displays a finding with its details and inline risk assessment.
 *
 * AC1: Page accessible at `/findings/[id]`
 * AC2: Page protected - requires authenticated user
 * AC3: 404 if finding not found or wrong organization
 * AC4: Breadcrumb: Findings > {identifier}
 * AC5: Page title shows finding identifier
 * AC6: Page fetches finding with related assessment (if exists)
 *
 * @see Story 7.11: Finding Detail Page with Inline Expansion
 */

import { notFound } from "next/navigation";
import { auth } from "@/server/auth";
import { requireAuth } from "@/lib/auth/route-protection";
import { api } from "@/trpc/server";

import { AppLayout } from "@/components/layout/AppLayout";
import { FindingDetailContent } from "./FindingDetailContent";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  try {
    const { id } = await params;
    const finding = await api.finding.getById({ id });
    return {
      title: `${finding.identifier} | Finding | BetterThanSpreadsheetsGRC`,
      description: finding.title,
    };
  } catch {
    return {
      title: "Finding Not Found | BetterThanSpreadsheetsGRC",
    };
  }
}

export default async function FindingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  // AC2: Page protected - requires authenticated user
  requireAuth(session, `/findings`);

  const { id } = await params;

  // AC6: Fetch finding with related assessment
  let finding;
  try {
    finding = await api.finding.getById({ id });
  } catch {
    // AC3: 404 if finding not found or wrong organization
    notFound();
  }

  // AC4: Breadcrumb navigation items
  const breadcrumbs = [
    { label: "Findings", href: "/findings" },
    { label: finding.identifier },
  ];

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      {/* Page Content with Client Interactivity */}
      <FindingDetailContent
        finding={finding as any}
        userRole={session!.user.role}
      />
    </AppLayout>
  );
}
