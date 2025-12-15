/**
 * User Management Page
 *
 * Admin-only page for managing users within an organization.
 * Requires ORG_ADMIN role.
 */

import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { UserRole } from "@prisma/client";
import { UserManagementClient } from "./client";

export const metadata = {
  title: "User Management | BetterThanSpreadsheetsGRC",
  description: "Manage users and roles in your organization",
};

export default async function UserManagementPage() {
  const session = await auth();

  // Require authentication
  if (!session || !session.user) {
    redirect("/api/auth/signin?callbackUrl=/admin/users");
  }

  // Require ORG_ADMIN role
  if (session.user.role !== UserRole.ORG_ADMIN) {
    redirect("/?error=unauthorized");
  }

  return <UserManagementClient />;
}
