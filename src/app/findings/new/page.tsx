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
import { WRITE_ROLES } from "@/lib/auth/roles";
import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateFindingForm } from "@/components/findings/CreateFindingForm";
import { FileSearch } from "lucide-react";

export const metadata = {
  title: "Create New Finding | BetterThanSpreadsheetsGRC",
  description: "Create a new security finding from audits, pentests, or vulnerability scans",
};

/**
 * Roles that can create findings (AC29) — any mutation → write tier.
 */
const FINDING_CREATE_ROLES = WRITE_ROLES;

export default async function CreateFindingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();

  // AC2, AC29-AC30: Require authentication and role
  requireRole(session, FINDING_CREATE_ROLES, "/findings/new");

  // Assessment-scoped create (2026-07-06): the questionnaire / findings tab
  // link here with prefill + a return path so the full-page form replaces the
  // old squished dialog. Only same-origin relative return paths are honored.
  const sp = await searchParams;
  const str = (v: string | string[] | undefined) =>
    typeof v === "string" && v.length > 0 ? v : undefined;
  const discoveryProjectId = str(sp.discoveryProjectId);
  const questionId = str(sp.questionId);
  const defaultTitle = str(sp.title);
  const defaultDescription = str(sp.description);
  const rawReturnTo = str(sp.returnTo);
  const returnTo =
    rawReturnTo && rawReturnTo.startsWith("/") && !rawReturnTo.startsWith("//")
      ? rawReturnTo
      : undefined;

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
            {discoveryProjectId
              ? "This finding is recorded against the risk assessment and stays pending until the assessment is approved, then publishes to the findings register."
              : "Document a security finding from audits, penetration tests, vulnerability scans, or other security assessments. Complete the form below to create a new finding record."}
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
            <CreateFindingForm
              discoveryProjectId={discoveryProjectId}
              sourceRiskAssessmentQuestionId={questionId}
              defaultTitle={defaultTitle}
              defaultDescription={defaultDescription}
              returnTo={returnTo}
            />
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
