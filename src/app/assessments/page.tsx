import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { AppLayout } from "@/components/layout";
import { AssessmentsOverviewClient } from "./client";

export const metadata = {
  title: "Assessments | BetterThanSpreadsheetsGRC",
  description: "Unified overview of Compliance, Vendor, Risk, and Maturity assessments",
};

export default async function AssessmentsOverviewPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/api/auth/signin");
  }

  return (
    <AppLayout breadcrumbs={[{ label: "Assessments" }]}>
      <AssessmentsOverviewClient />
    </AppLayout>
  );
}
