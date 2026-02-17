/**
 * Email Queue Dashboard Page
 *
 * Displays email queue metrics, pending emails, and failed email management.
 *
 * @see Story 4.15: Email Queue with Retry Logic
 * @module app/admin/email-queue
 */

import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { EmailQueueDashboardClient } from "./client";

export const metadata = {
  title: "Email Queue | Admin",
  description: "Monitor email queue status and manage failed emails",
};

export default async function EmailQueuePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/api/auth/signin");
  }

  return <EmailQueueDashboardClient />;
}
