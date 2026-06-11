/**
 * Engagements List Page (Epic 18 — Story 18.1).
 *
 * Lists the org's consulting engagements and offers a "New engagement" create
 * flow. Renders the client component which talks to the `engagement` tRPC
 * router.
 */

import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { EngagementsClient } from "./client";

export const metadata = {
  title: "Engagements | Consulting Accelerator",
  description: "Create and manage consulting engagements that wrap an assessment",
};

export default async function EngagementsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/api/auth/signin");
  }

  return <EngagementsClient />;
}
