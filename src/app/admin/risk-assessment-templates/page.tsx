import { RiskAssessmentTemplatesClient } from "./client";

export const metadata = {
  title: "Risk Assessment Templates | BetterThanSpreadsheetsGRC",
  description: "Manage questionnaire templates for risk assessments",
};

export default function RiskAssessmentTemplatesPage() {
  return <RiskAssessmentTemplatesClient />;
}
