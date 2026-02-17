/**
 * Vendor Detail Page
 *
 * Epic 1: TPRM Vendor Registry
 * Story 1.3: Vendor Detail Page (FR3)
 *
 * AC1: Page accessible at `/vendors/[id]`
 * AC2: Page protected - requires authenticated user
 * AC3: 404 if vendor not found or wrong organization
 * AC4: Breadcrumb: Third Party > Vendor Registry > {identifier}
 * AC5: Page title shows vendor identifier
 */

import { notFound } from "next/navigation";
import { auth } from "@/server/auth";
import { requireAuth } from "@/lib/auth/route-protection";
import { api } from "@/trpc/server";

import { AppLayout } from "@/components/layout/AppLayout";
import { VendorDetailContent } from "./client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  try {
    const { id } = await params;
    const vendor = await api.vendor.getById({ id });
    return {
      title: `${vendor.identifier} | Vendor | BetterThanSpreadsheetsGRC`,
      description: vendor.name,
    };
  } catch {
    return {
      title: "Vendor Not Found | BetterThanSpreadsheetsGRC",
    };
  }
}

export default async function VendorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  // AC2: Page protected - requires authenticated user
  requireAuth(session, `/vendors`);

  const { id } = await params;

  // Fetch vendor
  let vendor;
  try {
    vendor = await api.vendor.getById({ id });
  } catch {
    // AC3: 404 if vendor not found or wrong organization
    notFound();
  }

  // AC4: Breadcrumb navigation items
  const breadcrumbs = [
    { label: "Third Party" },
    { label: "Vendor Registry", href: "/vendors" },
    { label: vendor.identifier },
  ];

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <VendorDetailContent
        vendor={vendor as any}
        userRole={session!.user.role}
      />
    </AppLayout>
  );
}
