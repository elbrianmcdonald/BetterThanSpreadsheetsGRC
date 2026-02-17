/**
 * BIA Configuration Admin Page
 *
 * Admin page for managing BIA methodology configuration:
 * - Impact Categories (Story 9.2)
 * - Score Scale (Story 9.3)
 * - Tier Definitions (Story 9.4)
 * - Tier Criteria Matrix (Story 9.5)
 * - Time Periods (Story 9.6)
 * - Tier Thresholds (Story 9.7)
 *
 * @see Epic 9: BIA Configuration Admin
 */

import { BIAConfigClient } from "./client";

export const metadata = {
  title: "BIA Configuration | BetterThanSpreadsheetsGRC",
  description: "Configure Business Impact Assessment methodology",
};

export default function BIAConfigAdminPage() {
  return <BIAConfigClient />;
}
