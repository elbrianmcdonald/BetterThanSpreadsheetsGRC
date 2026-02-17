/**
 * Control Domain Mappings Administration Page
 *
 * Admin page for viewing and managing OSCAL translation mappings.
 *
 * @see Story 2.4: OSCAL Translation Engine
 */

import { MappingAdminClient } from "./client";

export const metadata = {
  title: "Control Mappings | BetterThanSpreadsheetsGRC",
  description: "Manage OSCAL control domain mappings",
};

export default function MappingAdminPage() {
  return <MappingAdminClient />;
}
