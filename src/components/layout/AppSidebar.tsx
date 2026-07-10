"use client";

/**
 * Application Sidebar Navigation
 *
 * Sidebar navigation with collapsible sections organized by function:
 * - Governance: Strategy, Frameworks, Controls
 * - Assessments: Overview + Compliance, Vendor, Risk, Maturity sub-items
 * - Risk: Risk Register, Findings Register, Assignments
 * - Compliance: Dashboard, Standards, Evidence, Velocity
 * - Administration: User Management, Business Units, Risk Matrices
 *                   Data: Mappings, Taxonomy, MITRE ATT&CK
 */

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { UserRole } from "@prisma/client";
import {
  ChevronRight,
  Users,
  Shield,
  FileText,
  AlertTriangle,
  ShieldAlert,
  ClipboardList,
  BarChart3,
  Tag,
  GitMerge,
  GitCompare,
  Home,
  Crosshair,
  Target,
  BookCheck,
  Gauge,
  Database,
  Building2,
  FileQuestion,
  Activity,
  Settings,
  Server,
  ScrollText,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CompanySwitcher } from "@/components/layout/CompanySwitcher";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles?: UserRole[];
  group?: string; // Optional group name for visual separation within a section
  platformAdmin?: boolean; // Visible only to platform admins (Multi-Tenancy Epic 3)
}

interface NavSection {
  id: string;
  label: string;
  icon: React.ReactNode;
  items: NavItem[];
  roles?: UserRole[];
  platformAdmin?: boolean; // Section also visible to platform admins regardless of role
}

// Navigation sections with role-based visibility
const NAV_SECTIONS: NavSection[] = [
  {
    id: "assignments",
    label: "Assignments",
    icon: <ClipboardList className="h-5 w-5" />,
    items: [
      {
        href: "/assignments/my-assignments",
        label: "My Assignments",
        icon: <ClipboardList className="h-4 w-4" />,
      },
      {
        href: "/assignments/backlog",
        label: "Backlog",
        icon: <Users className="h-4 w-4" />,
        roles: [UserRole.ADMINISTRATOR, UserRole.ANALYST, UserRole.ANALYST],
      },
    ],
  },
  {
    id: "governance",
    label: "Governance",
    icon: <Shield className="h-5 w-5" />,
    roles: [UserRole.ADMINISTRATOR, UserRole.ANALYST, UserRole.ANALYST],
    items: [
      {
        href: "/strategy",
        label: "Strategy",
        icon: <Target className="h-4 w-4" />,
      },
      {
        href: "/admin/frameworks",
        label: "Frameworks",
        icon: <ClipboardList className="h-4 w-4" />,
        roles: [UserRole.ADMINISTRATOR, UserRole.ANALYST],
      },
      {
        href: "/crosswalks",
        label: "Crosswalks",
        icon: <GitCompare className="h-4 w-4" />,
        roles: [UserRole.ADMINISTRATOR, UserRole.ANALYST, UserRole.ANALYST],
      },
      {
        href: "/controls",
        label: "Controls",
        icon: <Shield className="h-4 w-4" />,
        roles: [UserRole.ADMINISTRATOR, UserRole.ANALYST, UserRole.ANALYST],
      },
      {
        href: "/framework-controls",
        label: "Framework/Standard Control Library",
        icon: <Shield className="h-4 w-4" />,
        roles: [UserRole.ADMINISTRATOR, UserRole.ANALYST],
      },
    ],
  },
  {
    id: "assessments",
    label: "Assessments",
    icon: <ClipboardList className="h-5 w-5" />,
    items: [
      {
        href: "/assessments",
        label: "Overview",
        icon: <BarChart3 className="h-4 w-4" />,
      },
      {
        href: "/compliance/assessments",
        label: "Compliance",
        icon: <BookCheck className="h-4 w-4" />,
      },
      {
        href: "/tprm/assessments",
        label: "Vendor",
        icon: <Building2 className="h-4 w-4" />,
      },
      {
        href: "/risk-assessments",
        label: "Risk",
        icon: <ShieldAlert className="h-4 w-4" />,
      },
      {
        href: "/maturity/dashboard",
        label: "Maturity",
        icon: <Gauge className="h-4 w-4" />,
      },
      {
        href: "/bia/processes",
        label: "BIA Assessment",
        icon: <FileText className="h-4 w-4" />,
      },
    ],
  },
  {
    id: "risk",
    label: "Risk",
    icon: <ShieldAlert className="h-5 w-5" />,
    items: [
      {
        href: "/risks/dashboard",
        label: "Risk Dashboard",
        icon: <BarChart3 className="h-4 w-4" />,
      },
      {
        href: "/risks/enterprise",
        label: "Enterprise Risks",
        icon: <ShieldAlert className="h-4 w-4" />,
      },
      {
        href: "/risks",
        label: "Risk Register",
        icon: <ClipboardList className="h-4 w-4" />,
      },
      {
        href: "/findings",
        label: "Findings Register",
        icon: <AlertTriangle className="h-4 w-4" />,
      },
    ],
  },
  {
    id: "compliance",
    label: "Compliance",
    icon: <BarChart3 className="h-5 w-5" />,
    items: [
      {
        href: "/compliance/dashboard",
        label: "Dashboard",
        icon: <BarChart3 className="h-4 w-4" />,
      },
      {
        href: "/compliance/plans",
        label: "Compliance Plans",
        icon: <ClipboardList className="h-4 w-4" />,
      },
      {
        href: "/standards",
        label: "Standards",
        icon: <BookCheck className="h-4 w-4" />,
        roles: [UserRole.ADMINISTRATOR, UserRole.ANALYST, UserRole.MANAGER],
      },
      {
        href: "/admin/evidence",
        label: "Evidence",
        icon: <FileText className="h-4 w-4" />,
        roles: [UserRole.ADMINISTRATOR, UserRole.ANALYST, UserRole.ANALYST],
      },
      {
        href: "/compliance/velocity",
        label: "Velocity Metrics",
        icon: <BarChart3 className="h-4 w-4" />,
      },
    ],
  },
  {
    id: "third-party",
    label: "Third Party",
    icon: <Building2 className="h-5 w-5" />,
    items: [
      {
        href: "/tprm/dashboard",
        label: "TPRM Dashboard",
        icon: <Gauge className="h-4 w-4" />,
      },
      {
        href: "/vendors",
        label: "Vendor Registry",
        icon: <Building2 className="h-4 w-4" />,
      },
      {
        href: "/tprm/questionnaires",
        label: "Questionnaires",
        icon: <FileQuestion className="h-4 w-4" />,
        roles: [UserRole.ADMINISTRATOR, UserRole.ANALYST, UserRole.ANALYST, UserRole.MANAGER, UserRole.BUSINESS_USER],
      },
    ],
  },
  {
    id: "bia",
    label: "Business Impact",
    icon: <Activity className="h-5 w-5" />,
    items: [
      {
        href: "/bia/dashboard",
        label: "BIA Dashboard",
        icon: <Gauge className="h-4 w-4" />,
      },
      {
        href: "/bia/processes",
        label: "BIA Register",
        icon: <ClipboardList className="h-4 w-4" />,
      },
      {
        href: "/bia/functions",
        label: "Business Functions",
        icon: <Activity className="h-4 w-4" />,
      },
      {
        href: "/assets",
        label: "Asset Registry",
        icon: <Server className="h-4 w-4" />,
      },
      {
        href: "/admin/bia-config",
        label: "BIA Configuration",
        icon: <Settings className="h-4 w-4" />,
        roles: [UserRole.ADMINISTRATOR, UserRole.ANALYST],
      },
    ],
  },
  {
    id: "admin",
    label: "Administration",
    icon: <Users className="h-5 w-5" />,
    roles: [UserRole.ADMINISTRATOR],
    platformAdmin: true, // also visible to platform admins (for the platform items below)
    items: [
      {
        href: "/admin/users",
        label: "User Management",
        icon: <Users className="h-4 w-4" />,
        roles: [UserRole.ADMINISTRATOR],
      },
      {
        href: "/admin/members",
        label: "Company Members",
        icon: <Building2 className="h-4 w-4" />,
        roles: [UserRole.ADMINISTRATOR],
      },
      {
        href: "/admin/companies",
        label: "Companies",
        icon: <Building2 className="h-4 w-4" />,
        platformAdmin: true,
        group: "Platform",
      },
      {
        href: "/admin/platform-admins",
        label: "Platform Admins",
        icon: <ShieldCheck className="h-4 w-4" />,
        platformAdmin: true,
        group: "Platform",
      },
      {
        href: "/admin/business-units",
        label: "Business Units",
        icon: <ClipboardList className="h-4 w-4" />,
        roles: [UserRole.ADMINISTRATOR],
      },
      {
        href: "/admin/risk-matrices",
        label: "Risk Matrices",
        icon: <BarChart3 className="h-4 w-4" />,
        roles: [UserRole.ADMINISTRATOR],
      },
      {
        href: "/admin/risk-assessment-templates",
        label: "RA Templates",
        icon: <ClipboardList className="h-4 w-4" />,
        roles: [UserRole.ADMINISTRATOR],
      },
      {
        href: "/admin/backups",
        label: "Backups",
        icon: <Database className="h-4 w-4" />,
        roles: [UserRole.ADMINISTRATOR],
      },
      // Data group
      {
        href: "/admin/mappings",
        label: "Mappings",
        icon: <GitMerge className="h-4 w-4" />,
        roles: [UserRole.ADMINISTRATOR],
        group: "Data",
      },
      {
        href: "/admin/taxonomy",
        label: "Taxonomy",
        icon: <Tag className="h-4 w-4" />,
        roles: [UserRole.ADMINISTRATOR],
        group: "Data",
      },
      {
        href: "/mitre/tactics",
        label: "MITRE ATT&CK",
        icon: <Crosshair className="h-4 w-4" />,
        roles: [UserRole.ADMINISTRATOR],
        group: "Data",
      },
    ],
  },
  {
    id: "help",
    label: "Help",
    icon: <ScrollText className="h-5 w-5" />,
    items: [
      {
        href: "/changelog",
        label: "Changelog",
        icon: <ScrollText className="h-4 w-4" />,
      },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const userRole = session?.user?.role as UserRole | undefined;

  // Track which sections are expanded
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    // Auto-expand section that contains current page
    const initialExpanded = new Set<string>();
    NAV_SECTIONS.forEach((section) => {
      if (section.items.some((item) => pathname?.startsWith(item.href))) {
        initialExpanded.add(section.id);
      }
    });
    // Default expand Risk section if nothing else is expanded
    if (initialExpanded.size === 0) {
      initialExpanded.add("risk");
    }
    return initialExpanded;
  });

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  // Collect all nav hrefs for smarter active detection
  const allNavHrefs = NAV_SECTIONS.flatMap((section) =>
    section.items.map((item) => item.href)
  );

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (!pathname) return false;

    // Exact match always wins
    if (pathname === href) return true;

    // Check if pathname starts with href
    if (pathname.startsWith(href + "/")) {
      // But make sure there's no more specific nav item that matches
      const hasMoreSpecificMatch = allNavHrefs.some(
        (otherHref) =>
          otherHref !== href &&
          otherHref.startsWith(href + "/") &&
          (pathname === otherHref || pathname.startsWith(otherHref + "/"))
      );
      return !hasMoreSpecificMatch;
    }

    return false;
  };

  // Role Consolidation Epic 2: the platform admin is simply an ADMINISTRATOR.
  const isPlatformAdmin = session?.user?.platformRole === "ADMINISTRATOR";

  // Filter sections and items based on user role (+ platform-admin visibility).
  const visibleSections = NAV_SECTIONS.filter((section) => {
    const roleOk = !section.roles || (userRole && section.roles.includes(userRole));
    const platformOk = section.platformAdmin && isPlatformAdmin;
    return roleOk || platformOk;
  }).map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      // Platform-only items require platform admin, regardless of role.
      if (item.platformAdmin) return isPlatformAdmin;
      if (!item.roles) return true;
      return userRole && item.roles.includes(userRole);
    }),
  })).filter((section) => section.items.length > 0);

  return (
    <aside className="sticky top-0 flex h-screen w-64 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      {/* Brand */}
      <Link
        href="/"
        className="flex h-14 shrink-0 items-center gap-[11px] border-b border-sidebar-border px-5"
      >
        <span className="grid size-[30px] shrink-0 place-items-center rounded-[7px] bg-primary text-primary-foreground">
          <Shield className="h-[17px] w-[17px]" strokeWidth={2} />
        </span>
        <span className="leading-[1.08]">
          <span className="block text-sm font-bold tracking-[-0.01em] text-foreground">
            BetterThanSpreadsheets
          </span>
          <span className="mt-0.5 block font-mono text-[9.5px] font-medium uppercase tracking-[0.22em] text-primary">
            GRC Platform
          </span>
        </span>
      </Link>

      {/* Company switcher — above Home; only shown for multi-company users (Story 1.4) */}
      <CompanySwitcher />

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {/* Home leaf */}
        <Link
          href="/"
          className={cn(
            "relative flex items-center gap-[11px] rounded-md px-2.5 py-2 text-[13.5px] font-medium transition-colors",
            pathname === "/"
              ? "bg-sidebar-accent font-semibold text-sidebar-primary"
              : "text-sidebar-foreground hover:bg-secondary hover:text-foreground"
          )}
        >
          <Home
            className={cn(
              "h-[17px] w-[17px] shrink-0",
              pathname === "/" ? "text-sidebar-primary" : "text-muted-foreground/70"
            )}
          />
          <span>Home</span>
        </Link>

        {visibleSections.map((section) => {
          const isExpanded = expandedSections.has(section.id);
          const hasActiveItem = section.items.some((item) => isActive(item.href));

          return (
            <div key={section.id} className="mt-0.5">
              {/* Section header */}
              <button
                onClick={() => toggleSection(section.id)}
                className={cn(
                  "flex w-full items-center gap-[11px] rounded-md px-2.5 py-2 text-[13.5px] font-medium transition-colors",
                  hasActiveItem
                    ? "text-foreground"
                    : "text-sidebar-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <span
                  className={cn(
                    "grid shrink-0 place-items-center [&>svg]:h-[17px] [&>svg]:w-[17px]",
                    hasActiveItem ? "text-sidebar-primary" : "text-muted-foreground/70"
                  )}
                >
                  {section.icon}
                </span>
                <span>{section.label}</span>
                <ChevronRight
                  className={cn(
                    "ml-auto h-3.5 w-3.5 text-muted-foreground/70 transition-transform",
                    isExpanded && "rotate-90"
                  )}
                  strokeWidth={2}
                />
              </button>

              {/* Section items */}
              {isExpanded && (
                <div className="mb-1 mt-0.5">
                  {section.items.map((item, index) => {
                    const prevItem = index > 0 ? section.items[index - 1] : null;
                    const showGroupHeader = item.group && item.group !== prevItem?.group;
                    const active = isActive(item.href);

                    return (
                      <div key={item.href}>
                        {showGroupHeader && (
                          <div className="px-2.5 pb-1.5 pt-4 font-mono text-[9.5px] font-medium uppercase tracking-[0.16em] text-muted-foreground/70">
                            {item.group}
                          </div>
                        )}
                        <Link
                          href={item.href}
                          className={cn(
                            "relative flex items-center rounded-md py-[7px] pl-[38px] pr-2.5 text-[13px] font-medium transition-colors",
                            active
                              ? "bg-sidebar-accent font-semibold text-sidebar-primary"
                              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                          )}
                        >
                          {/* leading dot */}
                          <span
                            className={cn(
                              "absolute left-[22px] size-[5px] rounded-full",
                              active ? "bg-sidebar-primary" : "bg-input"
                            )}
                          />
                          {/* active left rule */}
                          {active && (
                            <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-sidebar-primary" />
                          )}
                          <span>{item.label}</span>
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* User footer */}
      {session?.user && (
        <Link
          href="/profile"
          className="flex items-center gap-[11px] border-t border-sidebar-border px-4 py-3.5 transition-colors hover:bg-secondary"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-[13px] font-bold text-primary">
            {session.user.name?.charAt(0)?.toUpperCase() || "U"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold leading-tight text-foreground">
              {session.user.name}
            </p>
            <p className="truncate font-mono text-[10px] tracking-[0.08em] text-muted-foreground/70">
              {session.user.role}
            </p>
          </div>
        </Link>
      )}
    </aside>
  );
}
