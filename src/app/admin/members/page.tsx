/**
 * Company Members Admin Page (Multi-Tenancy Epic 3 — Stories 3.1 / 3.2)
 *
 * Org-admin surface to attach users to the active company and manage roles.
 */

import { MembersClient } from "./client";

export const metadata = {
  title: "Company Members | BetterThanSpreadsheetsGRC",
  description: "Manage the members of the active company",
};

export default function MembersAdminPage() {
  return <MembersClient />;
}
