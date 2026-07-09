/**
 * Platform Admins Page (Multi-Tenancy Epic 3 — Story 3.3)
 *
 * Platform-admin-only surface to grant/revoke platform-admin status. The
 * `organization.listPlatformAdmins` / `setPlatformAdmin` procedures enforce
 * platform-admin access server-side regardless of how this page is reached.
 */

import { PlatformAdminsClient } from "./client";

export const metadata = {
  title: "Platform Admins | BetterThanSpreadsheetsGRC",
  description: "Manage platform administrators",
};

export default function PlatformAdminsPage() {
  return <PlatformAdminsClient />;
}
