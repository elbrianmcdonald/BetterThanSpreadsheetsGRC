/**
 * User Profile Page
 *
 * Displays user information and allows password changes.
 * Requires authentication.
 *
 * Story 7.0.4: Added Business Unit display (AC16-AC18)
 */

import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/server/auth";
import { ProfileClient } from "./client";

export default async function ProfilePage() {
  const session = await getServerAuthSession();

  if (!session) {
    redirect("/login");
  }

  return <ProfileClient userId={session.user.id} />;
}
