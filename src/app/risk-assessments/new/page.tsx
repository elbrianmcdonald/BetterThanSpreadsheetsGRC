/**
 * Create Risk Assessment Project Page
 *
 * Story 1.3: Create Assessment Form
 *
 * Page for creating new risk assessment projects.
 *
 * AC1: Page accessible at `/risk-assessments/new`
 * AC2: Page protected - requires authenticated user
 * AC3: Page title: "Create Assessment"
 * AC4: Breadcrumb navigation: Risk Assessments > New Assessment
 */

import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/server/auth";
import { AppLayout } from "@/components/layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CreateAssessmentProjectForm } from "@/components/risk-assessment-project/CreateAssessmentProjectForm";
import { ClipboardList } from "lucide-react";

export const metadata = {
  title: "Create Assessment | BetterThanSpreadsheets GRC",
  description: "Create a new risk assessment project",
};

export default async function CreateAssessmentPage() {
  // AC2: Page protected - requires authenticated user
  const session = await getServerAuthSession();
  if (!session) {
    redirect("/api/auth/signin");
  }

  return (
    <AppLayout
      breadcrumbs={[
        { label: "Risk Assessments", href: "/risk-assessments" },
        { label: "New Assessment" },
      ]}
    >
      <div className="mx-auto max-w-2xl">
        {/* Page Header */}
        <div className="mb-8">
          <div className="mb-2 flex items-center gap-3">
            <ClipboardList className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-semibold text-foreground">
              Create Risk Assessment
            </h1>
          </div>
          <p className="text-muted-foreground">
            Create a new risk assessment project to document and track risks for
            a specific subject such as an application, process, or security finding.
          </p>
        </div>

        {/* Form Card */}
        <Card>
          <CardHeader>
            <CardTitle>Assessment Details</CardTitle>
            <CardDescription>
              Provide the details for your risk assessment project. Fields marked
              with <span className="text-destructive">*</span> are required.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateAssessmentProjectForm />
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
