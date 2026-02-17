/**
 * Risk Matrix Management Admin Page
 *
 * Admin page for managing risk matrix templates.
 *
 * @see Story 7.8.2: RiskMatrixTemplate Schema
 */

import { RiskMatricesClient } from "./client";

export const metadata = {
  title: "Risk Matrices | BetterThanSpreadsheetsGRC",
  description: "Manage risk matrix templates and scoring configurations",
};

export default function RiskMatricesAdminPage() {
  return <RiskMatricesClient />;
}
