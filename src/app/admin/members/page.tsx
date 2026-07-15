/**
 * Company Members — merged into User Management.
 *
 * Company Members and User Management were collapsed into a single screen at
 * /admin/users (the Company Members section lives there now). This route
 * redirects for any remaining bookmarks/deep links.
 */

import { redirect } from "next/navigation";

export default function MembersAdminPage() {
  redirect("/admin/users");
}
