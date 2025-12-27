"use client";

/**
 * Application Navigation Bar
 *
 * Consistent navigation header across all authenticated pages.
 * Shows role-appropriate navigation links and user info.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { UserRole } from "@prisma/client";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@/components/auth/SignOutButton";

interface NavItem {
  href: string;
  label: string;
  roles?: UserRole[];
}

// Navigation items with role-based visibility
const NAV_ITEMS: NavItem[] = [
  { href: "/risks", label: "Risks" },
  { href: "/findings", label: "Findings" },
  { href: "/mitre/tactics", label: "MITRE ATT&CK" },
  { href: "/compliance/dashboard", label: "Compliance" },
  { href: "/admin/evidence", label: "Evidence", roles: [UserRole.ORG_ADMIN, UserRole.GRC_ANALYST, UserRole.SECURITY_ENGINEER] },
  { href: "/admin/frameworks", label: "Frameworks", roles: [UserRole.ORG_ADMIN, UserRole.GRC_ANALYST] },
  { href: "/admin/users", label: "Users", roles: [UserRole.ORG_ADMIN] },
];

export function AppNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const userRole = session?.user?.role as UserRole | undefined;

  // Filter nav items based on user role
  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (!item.roles) return true;
    return userRole && item.roles.includes(userRole);
  });

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname?.startsWith(href + "/");
  };

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between">
          <div className="flex">
            <div className="flex flex-shrink-0 items-center">
              <Link href="/" className="text-xl font-bold text-gray-900">
                BetterThanSpreadsheetsGRC
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-6">
              {visibleNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium transition-colors",
                    isActive(item.href)
                      ? "border-blue-500 text-gray-900"
                      : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {session?.user && (
              <>
                <Link
                  href="/profile"
                  className="text-sm text-gray-700 hover:text-gray-900"
                >
                  {session.user.name} ({session.user.role})
                </Link>
                <SignOutButton />
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
