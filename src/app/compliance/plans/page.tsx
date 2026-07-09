/**
 * Compliance Plans list page (Bridge to Compliance Plan — Epic 1).
 */

import { CompliancePlansClient } from "./client";

export const metadata = {
  title: "Compliance Plans | BetterThanSpreadsheetsGRC",
  description: "Bridge assessment gaps to owner-assigned remediation plans",
};

export default function CompliancePlansPage() {
  return <CompliancePlansClient />;
}
