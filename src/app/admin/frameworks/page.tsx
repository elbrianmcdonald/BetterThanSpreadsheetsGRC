/**
 * Framework Management Page
 *
 * Admin page for managing compliance frameworks and importing OSCAL catalogs.
 *
 * @see Story 2.1: OSCAL Catalog Import Pipeline
 * @see Story 2.5: Framework Activation and Configuration
 */

import { FrameworkPageContent } from "./FrameworkPageContent";

export const metadata = {
  title: "Framework Management | BetterThanSpreadsheetsGRC",
  description: "Manage compliance frameworks and import OSCAL catalogs",
};

export default function FrameworkManagementPage() {
  return <FrameworkPageContent />;
}
