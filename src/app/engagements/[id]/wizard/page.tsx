/**
 * Engagement Wizard page (Epic 18 — Stories 18.2–18.7).
 *
 * Server component shell: authenticates, awaits the route params, and renders
 * the client wizard which drives the 6-step rail off the engagement's `phase`.
 */

import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { EngagementWizardClient } from "./client";

export const metadata = {
  title: "Engagement Wizard | Consulting Accelerator",
  description: "Guided 6-step engagement: scope, schedule, stakeholders, evidence, interviews and review.",
};

export default async function EngagementWizardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/api/auth/signin");
  }

  const { id } = await params;

  return <EngagementWizardClient engagementId={id} />;
}
