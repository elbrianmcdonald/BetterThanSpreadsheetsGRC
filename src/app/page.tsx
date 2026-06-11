/**
 * Home Page / Workspace
 *
 * Post-login landing page: the "Triage Inbox" workspace (grouped worklist +
 * task-status donut + quick actions + activity rail). See WorkspaceHome.
 */

// Force dynamic rendering to ensure proper hydration with session-dependent UI
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

import { auth } from "@/server/auth";
import { AppLayout } from "@/components/layout";
import { WorkspaceHome } from "./_components/WorkspaceHome";

export default async function Home() {
  const session = await auth();

  // Redirect to login if not authenticated
  if (!session) {
    redirect("/login");
  }

  const firstName = session.user?.name?.split(" ")[0] ?? "there";
  const isAdmin =
    session.user?.role === "ORG_ADMIN" || session.user?.role === "CISO";

  return (
    <AppLayout showBreadcrumbs={false}>
      <WorkspaceHome firstName={firstName} isAdmin={isAdmin} />
    </AppLayout>
  );
}
