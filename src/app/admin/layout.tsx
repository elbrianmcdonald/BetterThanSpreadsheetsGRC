/**
 * Admin Layout
 *
 * Layout for admin section with sidebar navigation and role protection.
 * All pages under /admin require appropriate roles.
 */

import { auth } from "@/server/auth";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Require authentication
  if (!session) {
    redirect("/login");
  }

  // Admin pages use AppLayout from individual pages/components
  // This layout just handles auth protection
  return <>{children}</>;
}
