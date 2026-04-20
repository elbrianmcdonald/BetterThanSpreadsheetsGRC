"use client";

/**
 * Risk Detail Tabs Component
 *
 * Story 4.17: Risk Detail Page with Full Context and Actions (AC13-AC18)
 *
 * Tab navigation for risk detail page:
 * - AC13: Tab bar with 6 tabs
 * - AC14: Active tab highlighted, inactive tabs clickable
 * - AC15: Tab counts shown where applicable
 * - AC16: Deep linking supported (?tab=evidence)
 * - AC17: Tab state preserved in URL query parameter
 * - AC18: First tab (Findings) selected by default
 *
 * @see Story 4.17: Risk Detail Page
 */

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback } from "react";
import {
  FileText,
  FolderOpen,
  Wrench,
  MessageSquare,
  History,
  Clock,
  Shield,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type RiskTab =
  | "findings"
  | "controls"
  | "evidence"
  | "remediation"
  | "comments"
  | "audit-trail"
  | "history";

interface TabConfig {
  id: RiskTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  countKey?: string;
}

const TABS: TabConfig[] = [
  { id: "findings", label: "Risk Details", icon: FileText },
  // Story 12.6: Controls tab for risk-to-control linkage
  { id: "controls", label: "Controls", icon: Shield, countKey: "controlsCount" },
  { id: "evidence", label: "Evidence", icon: FolderOpen, countKey: "evidenceCount" },
  { id: "remediation", label: "Remediation", icon: Wrench, countKey: "remediationCount" },
  { id: "comments", label: "Comments", icon: MessageSquare, countKey: "commentsCount" },
  { id: "audit-trail", label: "Audit Trail", icon: History },
  { id: "history", label: "History", icon: Clock },
];

interface RiskDetailTabsProps {
  /** The risk ID */
  riskId: string;
  /** Count values for tabs */
  counts?: {
    controlsCount?: number;
    evidenceCount?: number;
    remediationCount?: number;
    commentsCount?: number;
  };
  /** Content to render for the active tab */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

interface TabButtonProps {
  tab: TabConfig;
  isActive: boolean;
  count?: number;
  onClick: () => void;
}

function TabButton({ tab, isActive, count, onClick }: TabButtonProps) {
  const Icon = tab.icon;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-colors whitespace-nowrap",
        isActive
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted"
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{tab.label}</span>
      {count !== undefined && count > 0 && (
        <span
          className={cn(
            "ml-1 rounded-full px-2 py-0.5 text-xs font-medium",
            isActive
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground"
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

export function RiskDetailTabs({
  riskId,
  counts,
  children,
  className,
}: RiskDetailTabsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // AC16 & AC18: Get active tab from URL or default to "findings"
  const activeTab = (searchParams.get("tab") as RiskTab) || "findings";

  // AC17: Update URL when tab changes
  const setActiveTab = useCallback(
    (tab: RiskTab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tab === "findings") {
        params.delete("tab");
      } else {
        params.set("tab", tab);
      }
      const query = params.toString();
      router.push(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  // Get count for a tab
  const getCount = (countKey?: string): number | undefined => {
    if (!countKey || !counts) return undefined;
    return counts[countKey as keyof typeof counts];
  };

  return (
    <div className={cn("", className)}>
      {/* AC13 & AC14: Tab bar */}
      <div
        className="border-b overflow-x-auto"
        role="tablist"
        aria-label="Risk detail tabs"
      >
        <nav className="flex -mb-px min-w-max">
          {TABS.map((tab) => (
            <TabButton
              key={tab.id}
              tab={tab}
              isActive={activeTab === tab.id}
              count={getCount(tab.countKey)}
              onClick={() => setActiveTab(tab.id)}
            />
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="mt-6" role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
        {children}
      </div>
    </div>
  );
}

/**
 * Hook to get the current active tab from URL
 */
export function useActiveTab(): RiskTab {
  const searchParams = useSearchParams();
  return (searchParams.get("tab") as RiskTab) || "findings";
}

/**
 * Validate if a string is a valid tab ID
 */
export function isValidTab(tab: string | null): tab is RiskTab {
  if (!tab) return false;
  return TABS.some((t) => t.id === tab);
}
