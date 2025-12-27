/**
 * Finding Creation Page
 *
 * Story 7.2: Finding Creation Form
 *
 * Page for Security Engineers and GRC Analysts to create new findings.
 *
 * AC1: Finding creation page accessible at `/findings/new`
 * AC2: Page protected - requires authenticated user
 * AC3: Page title: "Create New Finding"
 * AC4: Breadcrumb navigation: Findings > New Finding
 * AC29-AC31: Role-based access control (SECURITY_ENGINEER, GRC_ANALYST, ORG_ADMIN)
 *
 * @see Story 7.2: Finding Creation Form
 */

import { auth } from "@/server/auth";
import { requireRole } from "@/lib/auth/route-protection";
import { UserRole } from "@prisma/client";
import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateFindingForm } from "@/components/findings/CreateFindingForm";
import { FileSearch } from "lucide-react";

export const metadata = {
  title: "Create New Finding | BetterThanSpreadsheetsGRC",
  description: "Create a new security finding from audits, pentests, or vulnerability scans",
};

/**
 * Roles that can create findings (AC29)
 * - Security Engineer
 * - GRC Analyst
 * - Org Admin
 */
const FINDING_CREATE_ROLES = [
  UserRole.SECURITY_ENGINEER,
  UserRole.GRC_ANALYST,
  UserRole.ORG_ADMIN,
];

export default async function CreateFindingPage() {
  const session = await auth();

  // AC2, AC29-AC30: Require authentication and role
  requireRole(session, FINDING_CREATE_ROLES, "/findings/new");

  return (
    <AppLayout breadcrumbs={[{ label: "Findings", href: "/findings" }, { label: "New Finding" }]}>
      <div className="mx-auto max-w-4xl">
        {/* AC3: Page Title */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <FileSearch className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-semibold text-foreground">
              Create New Finding
            </h1>
          </div>
          <p className="text-muted-foreground">
            Document a security finding from audits, penetration tests, vulnerability scans,
            or other security assessments. Complete the form below to create a new finding record.
          </p>
        </div>

        {/* Form Card */}
        <Card>
          <CardHeader>
            <CardTitle>Finding Details</CardTitle>
            <CardDescription>
              Provide detailed information about the security finding. Fields marked with
              <span className="text-destructive"> *</span> are required.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateFindingForm />
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
