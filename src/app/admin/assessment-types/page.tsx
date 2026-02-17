/**
 * Assessment Type Management Admin Page
 *
 * Admin page for managing risk assessment types.
 *
 * @see Story 7.8.1: AssessmentType Schema & CRUD
 */

import { AssessmentTypesClient } from "./client";

export const metadata = {
  title: "Assessment Types | BetterThanSpreadsheetsGRC",
  description: "Manage risk assessment types",
};

export default function AssessmentTypesAdminPage() {
  return <AssessmentTypesClient />;
}
