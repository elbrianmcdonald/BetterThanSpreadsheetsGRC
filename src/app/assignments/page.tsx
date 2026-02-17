import { redirect } from "next/navigation";

/**
 * Assignments Index Page
 *
 * Redirects to My Assignments by default.
 */
export default function AssignmentsPage() {
  redirect("/assignments/my-assignments");
}
