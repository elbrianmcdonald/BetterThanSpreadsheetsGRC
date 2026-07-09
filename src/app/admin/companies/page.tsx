/**
 * Companies Admin Page (Multi-Tenancy — platform admin)
 *
 * Platform-admin surface to create/list/delete companies. The
 * `organization.listCompanies` / `delete` procedures enforce platform-admin
 * access server-side regardless of how this page is reached.
 */

import { CompaniesClient } from "./client";

export const metadata = {
  title: "Companies | BetterThanSpreadsheetsGRC",
  description: "Manage companies across the platform",
};

export default function CompaniesPage() {
  return <CompaniesClient />;
}
