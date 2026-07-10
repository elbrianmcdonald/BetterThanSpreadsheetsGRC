/**
 * Vendor Edit Page
 *
 * Epic 1: TPRM Vendor Registry
 * Story 1.4: Edit Vendor Information (FR4)
 *
 * AC1: Page accessible at `/vendors/[id]/edit`
 * AC2: Page protected - requires authenticated user with manage role
 * AC3: Page title: "Edit Vendor"
 * AC4: Breadcrumb: Third Party > Vendor Registry > {identifier} > Edit
 */

import { notFound } from "next/navigation";
import { auth } from "@/server/auth";
import { requireRole } from "@/lib/auth/route-protection";
import { UserRole } from "@prisma/client";
import { api } from "@/trpc/server";
import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { VendorForm } from "@/components/vendor";
import { Building2 } from "lucide-react";

/**
 * Roles that can edit vendors
 */
const VENDOR_MANAGE_ROLES = [UserRole.ADMINISTRATOR, UserRole.ANALYST];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  try {
    const { id } = await params;
    const vendor = await api.vendor.getById({ id });
    return {
      title: `Edit ${vendor.identifier} | BetterThanSpreadsheetsGRC`,
      description: `Edit vendor ${vendor.name}`,
    };
  } catch {
    return {
      title: "Vendor Not Found | BetterThanSpreadsheetsGRC",
    };
  }
}

export default async function EditVendorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  // AC2: Require authentication and role
  requireRole(session, VENDOR_MANAGE_ROLES, "/vendors");

  const { id } = await params;

  // Fetch vendor
  let vendor;
  try {
    vendor = await api.vendor.getById({ id });
  } catch {
    notFound();
  }

  return (
    <AppLayout
      breadcrumbs={[
        { label: "Third Party" },
        { label: "Vendor Registry", href: "/vendors" },
        { label: vendor.identifier, href: `/vendors/${vendor.id}` },
        { label: "Edit" },
      ]}
    >
      <div className="mx-auto max-w-3xl">
        {/* AC3: Page Title */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-semibold text-foreground">
              Edit Vendor
            </h1>
          </div>
          <p className="text-muted-foreground">
            Update information for {vendor.name} ({vendor.identifier})
          </p>
        </div>

        {/* Form Card */}
        <Card>
          <CardHeader>
            <CardTitle>Vendor Details</CardTitle>
            <CardDescription>
              Update the vendor information. Fields marked with
              <span className="text-destructive"> *</span> are required.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VendorForm
              mode="edit"
              vendorId={vendor.id}
              defaultValues={{
                name: vendor.name,
                category: vendor.category || "",
                riskTier: vendor.riskTier || "",
                primaryContactName: vendor.primaryContactName || "",
                primaryContactEmail: vendor.primaryContactEmail || "",
                businessUnitId: vendor.businessUnit?.id || "",
                itOwnerId: vendor.itOwner?.id ?? undefined,
                businessOwnerId: vendor.businessOwner?.id ?? undefined,
                notes: vendor.notes || "",
              }}
            />
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
