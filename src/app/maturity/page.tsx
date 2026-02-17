/**
 * Maturity Assessments Page - Redirect
 *
 * Redirects to the unified maturity dashboard.
 * The dashboard now contains both overview and assessments tabs.
 */

import { redirect } from "next/navigation";

export default function MaturityAssessmentsPage() {
  redirect("/maturity/dashboard");
}
