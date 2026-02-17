/**
 * Control Taxonomy Administration Page
 *
 * Admin page for managing simplified control taxonomy domains.
 *
 * @see Story 2.3: Simplified Control Taxonomy Definition
 */

import { TaxonomyAdminClient } from "./client";

export const metadata = {
  title: "Control Taxonomy | BetterThanSpreadsheetsGRC",
  description: "Manage simplified control taxonomy domains",
};

export default function TaxonomyAdminPage() {
  return <TaxonomyAdminClient />;
}
