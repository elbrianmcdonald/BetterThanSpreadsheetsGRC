"use client";

/**
 * Role-Based Risk Navigation Links
 *
 * Displays the appropriate risk navigation link based on the user's role.
 *
 * Story 4.9: Role-Based Risk Views - Navigation Updates (Task 8)
 * - IT_STAKEHOLDER: Show "My Assigned Risks" link
 * - BUSINESS_STAKEHOLDER: Show "Decisions Pending" link
 * - GRC_ANALYST, SECURITY_ENGINEER, ORG_ADMIN: Show "All Risks" link
 *
 * @see Story 4.9: Role-Based Risk Views
 */

import Link from "next/link";
import { useSession } from "next-auth/react";
import { UserRole } from "@prisma/client";
import { cn } from "@/lib/utils";

interface RoleBasedRiskNavProps {
  /** Current path for active state styling */
  currentPath?: string;
  /** Additional CSS classes for the link container */
  className?: string;
  /** CSS classes for individual links */
  linkClassName?: string;
  /** CSS classes for active link */
  activeLinkClassName?: string;
}

/**
 * Navigation links for risks based on user role.
 *
 * @example
 * ```tsx
 * <RoleBasedRiskNav
 *   currentPath="/risks"
 *   linkClassName="inline-flex items-center border-b-2 border-transparent px-1 pt-1 text-sm font-medium text-gray-500 hover:text-gray-700"
 *   activeLinkClassName="border-blue-500 text-gray-900"
 * />
 * ```
 */
export function RoleBasedRiskNav({
  currentPath,
  className,
  linkClassName = "inline-flex items-center border-b-2 border-transparent hover:border-gray-300 px-1 pt-1 text-sm font-medium text-gray-500 hover:text-gray-700",
  activeLinkClassName = "border-blue-500 text-gray-900",
}: RoleBasedRiskNavProps) {
  const { data: session } = useSession();
  const userRole = session?.user?.role as UserRole | undefined;

  if (!userRole) {
    return null;
  }

  // Define risk navigation links based on role
  const getRiskNavItems = (): Array<{ href: string; label: string }> => {
    switch (userRole) {
      case UserRole.IT_STAKEHOLDER:
        return [{ href: "/risks/my-risks", label: "My Assigned Risks" }];

      case UserRole.BUSINESS_STAKEHOLDER:
        return [{ href: "/risks/decisions", label: "Decisions Pending" }];

      case UserRole.GRC_ANALYST:
      case UserRole.SECURITY_ENGINEER:
      case UserRole.ORG_ADMIN:
        return [
          { href: "/risks", label: "Risk Registry" },
          { href: "/risks/my-risks", label: "My Risks" },
        ];

      case UserRole.AUDITOR:
        return [{ href: "/risks", label: "Risk Registry" }];

      default:
        return [];
    }
  };

  const navItems = getRiskNavItems();

  if (navItems.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex space-x-4", className)}>
      {navItems.map((item) => {
        const isActive = currentPath === item.href ||
          (currentPath?.startsWith(item.href) && item.href !== "/risks") ||
          (item.href === "/risks" && currentPath === "/risks");

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              linkClassName,
              isActive && activeLinkClassName
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

/**
 * Get the default risk page URL for a user's role.
 *
 * @param role - The user's role
 * @returns The URL path for the user's default risk view
 */
export function getDefaultRiskPage(role: UserRole | undefined): string {
  switch (role) {
    case UserRole.IT_STAKEHOLDER:
      return "/risks/my-risks";

    case UserRole.BUSINESS_STAKEHOLDER:
      return "/risks/decisions";

    case UserRole.GRC_ANALYST:
    case UserRole.SECURITY_ENGINEER:
    case UserRole.ORG_ADMIN:
    case UserRole.AUDITOR:
    default:
      return "/risks";
  }
}
