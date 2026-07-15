/**
 * Exploitation Pathways (master library) — Administration.
 *
 * Manage the org-wide library of exploitation pathways: create, edit, and
 * delete. Pathways created here are available to select onto assessments and to
 * tag on findings/risks. Staff-write roles only (mirrors the pathway router).
 */

import { auth } from "@/server/auth";
import { requireRole } from "@/lib/auth/route-protection";
import { WRITE_ROLES } from "@/lib/auth/roles";
import { type UserRole } from "@prisma/client";
import { PathwayLibraryClient } from "./client";

export const metadata = {
  title: "Exploitation Pathways | BetterThanSpreadsheetsGRC",
  description: "Manage the organization's exploitation pathway library",
};

export default async function PathwayLibraryPage() {
  const session = await auth();
  requireRole(session, [...WRITE_ROLES] as UserRole[], "/admin/pathways");

  return <PathwayLibraryClient />;
}
