/**
 * Vendor Creation Page
 *
 * Epic 1: TPRM Vendor Registry
 * Story 1.1: Vendor Data Model and Create Form (FR1)
 *
 * AC1: Page accessible at `/vendors/new`
 * AC2: Page protected - requires authenticated user with manage role
 * AC3: Page title: "Add New Vendor"
 * AC4: Breadcrumb: Third Party > Vendor Registry > New
 */

import { auth } from "@/server/auth";
import { requireRole } from "@/lib/auth/route-protection";
import { UserRole } from "@prisma/client";
import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { VendorForm } from "@/components/vendor";
import { Building2 } from "lucide-react";

export const metadata = {
  title: "Add New Vendor | BetterThanSpreadsheetsGRC",
  description: "Add a new vendor to the registry",
};

/**
 * Roles that can create vendors
 */
const VENDOR_MANAGE_ROLES = [UserRole.ADMINISTRATOR, UserRole.ANALYST];

export default async function CreateVendorPage() {
  const session = await auth();

  // AC2: Require authentication and role
  requireRole(session, VENDOR_MANAGE_ROLES, "/vendors/new");

  return (
    <AppLayout
      breadcrumbs={[
        { label: "Third Party" },
        { label: "Vendor Registry", href: "/vendors" },
        { label: "New" },
      ]}
    >
      <div className="mx-auto max-w-3xl">
        {/* AC3: Page Title */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-semibold text-foreground">
              Add New Vendor
            </h1>
          </div>
          <p className="text-muted-foreground">
            Register a new third-party vendor. Complete the form below to add the
            vendor to your registry.
          </p>
        </div>

        {/* Form Card */}
        <Card>
          <CardHeader>
            <CardTitle>Vendor Details</CardTitle>
            <CardDescription>
              Provide information about the vendor. Fields marked with
              <span className="text-destructive"> *</span> are required.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VendorForm mode="create" />
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
