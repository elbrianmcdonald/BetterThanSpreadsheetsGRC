/**
 * Create Risk Assessment Page
 *
 * Redirects to /risks/new so the risk-assessments flow uses the same
 * RiskAssessmentForm as the risks/new path (assessment header + multiple
 * risk items with MITRE, inherent/residual, controls, treatment).
 * The standalone CreateAssessmentProjectForm is no longer used here.
 */

import { redirect } from "next/navigation";

export default function CreateAssessmentPage() {
  redirect("/risks/new");
}
