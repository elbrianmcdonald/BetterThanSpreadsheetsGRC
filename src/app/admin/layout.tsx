/**
 * Admin Layout
 *
 * Layout for admin section with navigation and role protection.
 * All pages under /admin require ORG_ADMIN role.
 */

import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { UserRole } from "@prisma/client";
import Link from "next/link";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Require authentication
  if (!session || !session.user) {
    redirect("/api/auth/signin?callbackUrl=/admin");
  }

  // Require ORG_ADMIN role
  if (session.user.role !== UserRole.ORG_ADMIN) {
    redirect("/?error=unauthorized");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between">
            <div className="flex">
              <div className="flex flex-shrink-0 items-center">
                <Link
                  href="/"
                  className="text-xl font-bold text-gray-900"
                >
                  BetterThanSpreadsheetsGRC
                </Link>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <Link
                  href="/admin/users"
                  className="inline-flex items-center border-b-2 border-blue-500 px-1 pt-1 text-sm font-medium text-gray-900"
                >
                  User Management
                </Link>
                {/* Future admin pages will go here */}
              </div>
            </div>
            <div className="flex items-center">
              <span className="text-sm text-gray-700">
                {session.user.name} ({session.user.role})
              </span>
            </div>
          </div>
        </div>
      </nav>

      {/* Breadcrumbs */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
        <nav className="flex" aria-label="Breadcrumb">
          <ol className="flex items-center space-x-2">
            <li>
              <Link href="/" className="text-gray-400 hover:text-gray-500">
                Home
              </Link>
            </li>
            <li>
              <div className="flex items-center">
                <svg
                  className="h-5 w-5 flex-shrink-0 text-gray-300"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M5.555 17.776l8-16 .894.448-8 16-.894-.448z" />
                </svg>
                <span className="ml-2 text-sm font-medium text-gray-500">
                  Admin
                </span>
              </div>
            </li>
          </ol>
        </nav>
      </div>

      {/* Page Content */}
      <main className="mx-auto max-w-7xl">{children}</main>
    </div>
  );
}
