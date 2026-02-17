/**
 * Business Unit Management Admin Page
 *
 * Admin page for managing hierarchical business unit structure.
 *
 * @see Story 7.0.3: BU Admin CRUD UI
 */

import { BusinessUnitsClient } from "./client";

export const metadata = {
  title: "Business Units | BetterThanSpreadsheetsGRC",
  description: "Manage organizational business unit hierarchy",
};

export default function BusinessUnitsAdminPage() {
  return <BusinessUnitsClient />;
}
