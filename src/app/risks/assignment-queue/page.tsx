import { redirect } from "next/navigation";

/**
 * Legacy Risk Assignment Queue Page
 *
 * Redirects to the new unified backlog page.
 * Kept for backwards compatibility with bookmarks and links.
 */
export default function LegacyAssignmentQueuePage() {
  redirect("/assignments/backlog");
}
