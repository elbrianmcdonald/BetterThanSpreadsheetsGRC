/**
 * Risk Creation Page
 *
 * Page for Security Engineers to create new risk records.
 *
 * AC1: Risk creation page accessible at `/risks/new`
 * AC21-AC23: Role-based access control (SECURITY_ENGINEER, GRC_ANALYST, ORG_ADMIN)
 *
 * @see Story 4.1: Risk Creation via tRPC Procedures and Web Forms
 */

import { Suspense } from "react";
import { auth } from "@/server/auth";
import { requireRole } from "@/lib/auth/route-protection";
import { UserRole } from "@prisma/client";
import { CreateRiskClient } from "./client";

// Force dynamic rendering to ensure proper hydration with session-dependent UI
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Create Risk | BetterThanSpreadsheetsGRC",
  description: "Document a new security finding or risk",
};

/**
 * Roles that can create risks (AC21-AC23)
 * - Security Engineer
 * - GRC Analyst
 * - Org Admin
 */
const RISK_CREATE_ROLES = [
  UserRole.SECURITY_ENGINEER,
  UserRole.GRC_ANALYST,
  UserRole.ORG_ADMIN,
];

export default async function CreateRiskPage() {
  const session = await auth();

  // Require one of the allowed roles (AC21-AC23)
  requireRole(session, RISK_CREATE_ROLES, "/risks/new");

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      }
    >
      <CreateRiskClient />
    </Suspense>
  );
}
