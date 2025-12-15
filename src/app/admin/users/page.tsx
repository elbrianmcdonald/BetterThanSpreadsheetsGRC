/**
 * User Management Page
 *
 * Admin-only page for managing users within an organization.
 * Requires ORG_ADMIN role.
 */

import { auth } from "@/server/auth";
import { requireOrgAdmin } from "@/lib/auth/route-protection";
import { UserManagementClient } from "./client";

export const metadata = {
  title: "User Management | BetterThanSpreadsheetsGRC",
  description: "Manage users and roles in your organization",
};

export default async function UserManagementPage() {
  const session = await auth();

  // Require ORG_ADMIN role (handles auth + authorization)
  requireOrgAdmin(session, "/admin/users");

  return <UserManagementClient />;
}
