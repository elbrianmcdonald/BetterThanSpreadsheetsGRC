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
  ChevronDown,
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
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles?: UserRole[];
  group?: string; // Optional group name for visual separation within a section
}

interface NavSection {
  id: string;
  label: string;
  icon: React.ReactNode;
  items: NavItem[];
  roles?: UserRole[];
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
        roles: [UserRole.ORG_ADMIN, UserRole.GRC_ANALYST, UserRole.SECURITY_ENGINEER],
      },
    ],
  },
  {
    id: "governance",
    label: "Governance",
    icon: <Shield className="h-5 w-5" />,
    roles: [UserRole.ORG_ADMIN, UserRole.GRC_ANALYST, UserRole.SECURITY_ENGINEER],
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
        roles: [UserRole.ORG_ADMIN, UserRole.GRC_ANALYST],
      },
      {
        href: "/controls",
        label: "Controls",
        icon: <Shield className="h-4 w-4" />,
        roles: [UserRole.ORG_ADMIN, UserRole.GRC_ANALYST, UserRole.SECURITY_ENGINEER],
      },
      {
        href: "/framework-controls",
        label: "Framework/Standard Control Library",
        icon: <Shield className="h-4 w-4" />,
        roles: [UserRole.ORG_ADMIN, UserRole.GRC_ANALYST],
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
        href: "/standards",
        label: "Standards",
        icon: <BookCheck className="h-4 w-4" />,
        roles: [UserRole.ORG_ADMIN, UserRole.GRC_ANALYST, UserRole.CISO],
      },
      {
        href: "/admin/evidence",
        label: "Evidence",
        icon: <FileText className="h-4 w-4" />,
        roles: [UserRole.ORG_ADMIN, UserRole.GRC_ANALYST, UserRole.SECURITY_ENGINEER],
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
        roles: [UserRole.ORG_ADMIN, UserRole.GRC_ANALYST, UserRole.SECURITY_ENGINEER, UserRole.CISO, UserRole.AUDITOR],
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
        label: "Business Processes",
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
        roles: [UserRole.ORG_ADMIN, UserRole.GRC_ANALYST],
      },
    ],
  },
  {
    id: "admin",
    label: "Administration",
    icon: <Users className="h-5 w-5" />,
    roles: [UserRole.ORG_ADMIN],
    items: [
      {
        href: "/admin/users",
        label: "User Management",
        icon: <Users className="h-4 w-4" />,
        roles: [UserRole.ORG_ADMIN],
      },
      {
        href: "/admin/business-units",
        label: "Business Units",
        icon: <ClipboardList className="h-4 w-4" />,
        roles: [UserRole.ORG_ADMIN],
      },
      {
        href: "/admin/risk-matrices",
        label: "Risk Matrices",
        icon: <BarChart3 className="h-4 w-4" />,
        roles: [UserRole.ORG_ADMIN],
      },
      {
        href: "/admin/backups",
        label: "Backups",
        icon: <Database className="h-4 w-4" />,
        roles: [UserRole.ORG_ADMIN],
      },
      // Data group
      {
        href: "/admin/mappings",
        label: "Mappings",
        icon: <GitMerge className="h-4 w-4" />,
        roles: [UserRole.ORG_ADMIN],
        group: "Data",
      },
      {
        href: "/admin/taxonomy",
        label: "Taxonomy",
        icon: <Tag className="h-4 w-4" />,
        roles: [UserRole.ORG_ADMIN],
        group: "Data",
      },
      {
        href: "/mitre/tactics",
        label: "MITRE ATT&CK",
        icon: <Crosshair className="h-4 w-4" />,
        roles: [UserRole.ORG_ADMIN],
        group: "Data",
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

  // Filter sections and items based on user role
  const visibleSections = NAV_SECTIONS.filter((section) => {
    if (!section.roles) return true;
    return userRole && section.roles.includes(userRole);
  }).map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (!item.roles) return true;
      return userRole && item.roles.includes(userRole);
    }),
  })).filter((section) => section.items.length > 0);

  return (
    <aside className="w-64 bg-slate-900 text-white min-h-screen flex flex-col">
      {/* Logo */}
      <div className="p-4 border-b border-slate-700">
        <Link href="/" className="flex items-center gap-2">
          <Shield className="h-8 w-8 text-blue-400" />
          <div className="flex flex-col">
            <span className="font-bold text-lg leading-tight">BetterThan</span>
            <span className="font-bold text-lg leading-tight text-blue-400">SpreadsheetsGRC</span>
          </div>
        </Link>
      </div>

      {/* Home Link */}
      <div className="p-2">
        <Link
          href="/"
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
            isActive("/") && pathname === "/"
              ? "bg-slate-700 text-white"
              : "text-slate-300 hover:bg-slate-800 hover:text-white"
          )}
        >
          <Home className="h-5 w-5" />
          <span>Home</span>
        </Link>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {visibleSections.map((section) => {
          const isExpanded = expandedSections.has(section.id);
          const hasActiveItem = section.items.some((item) => isActive(item.href));

          return (
            <div key={section.id}>
              {/* Section Header */}
              <button
                onClick={() => toggleSection(section.id)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-md transition-colors",
                  hasActiveItem
                    ? "bg-slate-800 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                )}
              >
                <div className="flex items-center gap-3">
                  {section.icon}
                  <span className="font-medium">{section.label}</span>
                </div>
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>

              {/* Section Items */}
              {isExpanded && (
                <div className="mt-1 ml-4 space-y-1">
                  {section.items.map((item, index) => {
                    // Check if we need to show a group header
                    const prevItem = index > 0 ? section.items[index - 1] : null;
                    const showGroupHeader = item.group && item.group !== prevItem?.group;

                    return (
                      <div key={item.href}>
                        {showGroupHeader && (
                          <div className="flex items-center gap-2 px-3 py-2 mt-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            <Database className="h-3 w-3" />
                            <span>{item.group}</span>
                          </div>
                        )}
                        <Link
                          href={item.href}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm",
                            isActive(item.href)
                              ? "bg-blue-600 text-white"
                              : "text-slate-400 hover:bg-slate-800 hover:text-white"
                          )}
                        >
                          {item.icon}
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

      {/* User Info */}
      {session?.user && (
        <div className="p-4 border-t border-slate-700">
          <Link
            href="/profile"
            className="flex items-center gap-3 text-sm text-slate-300 hover:text-white transition-colors"
          >
            <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center">
              <span className="text-xs font-medium">
                {session.user.name?.charAt(0)?.toUpperCase() || "U"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{session.user.name}</p>
              <p className="text-xs text-slate-500 truncate">{session.user.role}</p>
            </div>
          </Link>
        </div>
      )}
    </aside>
  );
}
