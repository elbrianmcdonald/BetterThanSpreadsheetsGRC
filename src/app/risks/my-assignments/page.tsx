import { redirect } from "next/navigation";

/**
 * Legacy My Assignments Page
 *
 * Redirects to the new unified assignments page.
 * Kept for backwards compatibility with bookmarks and links.
 */
export default function LegacyMyAssignmentsPage() {
  redirect("/assignments/my-assignments");
}
