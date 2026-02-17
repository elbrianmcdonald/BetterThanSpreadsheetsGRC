"use client";

/**
 * Control Domain Badge Component
 *
 * Displays control domain tags as colored badges.
 * Story 3.3: AC18-AC21 - Tag display components
 *
 * Features:
 * - Consistent color per domain
 * - Optional click handler for filtering
 * - Compact display mode for lists
 *
 * @see Story 3.3: Control Taxonomy Tagging via Dropdown
 */

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Color mapping for control domains
 * Story 3.3: AC20 - Tags displayed as colored badges (consistent color per domain)
 */
const DOMAIN_COLORS: Record<string, string> = {
  ACCESS_CONTROL: "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200",
  AUTHENTICATION: "bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-200",
  DATA_PROTECTION: "bg-green-100 text-green-800 border-green-200 hover:bg-green-200",
  ENCRYPTION: "bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200",
  NETWORK_SECURITY: "bg-red-100 text-red-800 border-red-200 hover:bg-red-200",
  LOGGING_MONITORING: "bg-indigo-100 text-indigo-800 border-indigo-200 hover:bg-indigo-200",
  INCIDENT_RESPONSE: "bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200",
  BUSINESS_CONTINUITY: "bg-teal-100 text-teal-800 border-teal-200 hover:bg-teal-200",
  PHYSICAL_SECURITY: "bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200",
  THIRD_PARTY_RISK: "bg-pink-100 text-pink-800 border-pink-200 hover:bg-pink-200",
  SECURITY_AWARENESS: "bg-cyan-100 text-cyan-800 border-cyan-200 hover:bg-cyan-200",
  CHANGE_MANAGEMENT: "bg-lime-100 text-lime-800 border-lime-200 hover:bg-lime-200",
};

interface ControlDomainBadgeProps {
  /** Domain ID */
  id: string;
  /** Domain code for color mapping */
  code: string;
  /** Domain display name */
  name: string;
  /** Optional click handler for filtering - AC21 */
  onClick?: (domainId: string) => void;
  /** Whether the badge is currently active/selected */
  isActive?: boolean;
  /** Custom class name */
  className?: string;
}

/**
 * Get badge color class for a domain
 */
export function getDomainColor(code: string): string {
  return DOMAIN_COLORS[code] ?? "bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200";
}

export function ControlDomainBadge({
  id,
  code,
  name,
  onClick,
  isActive = false,
  className,
}: ControlDomainBadgeProps) {
  const colorClass = getDomainColor(code);

  if (onClick) {
    // Clickable badge for filtering - AC21
    return (
      <button
        type="button"
        onClick={() => onClick(id)}
        className={cn(
          "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
          colorClass,
          isActive && "ring-2 ring-offset-1 ring-primary",
          "cursor-pointer",
          className
        )}
      >
        {name}
      </button>
    );
  }

  // Non-clickable badge for display
  return (
    <Badge
      variant="outline"
      className={cn(colorClass, className)}
    >
      {name}
    </Badge>
  );
}

interface ControlDomainBadgeListProps {
  /** Array of control domain objects */
  domains: Array<{
    ControlDomain: {
      id: string;
      code: string;
      name: string;
    };
  }>;
  /** Maximum number of badges to show before truncating */
  maxDisplay?: number;
  /** Optional click handler for filtering */
  onDomainClick?: (domainId: string) => void;
  /** Currently active/filtered domain ID */
  activeDomainId?: string;
  /** Custom class name */
  className?: string;
}

/**
 * Display a list of control domain badges with optional truncation
 * Story 3.3: AC18 - Evidence list page displays control domain tags
 */
export function ControlDomainBadgeList({
  domains,
  maxDisplay = 2,
  onDomainClick,
  activeDomainId,
  className,
}: ControlDomainBadgeListProps) {
  if (domains.length === 0) {
    return (
      <span className="text-sm text-muted-foreground">No tags</span>
    );
  }

  const visibleDomains = domains.slice(0, maxDisplay);
  const hiddenCount = domains.length - maxDisplay;

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {visibleDomains.map((domain) => (
        <ControlDomainBadge
          key={domain.ControlDomain.id}
          id={domain.ControlDomain.id}
          code={domain.ControlDomain.code}
          name={domain.ControlDomain.name}
          onClick={onDomainClick}
          isActive={activeDomainId === domain.ControlDomain.id}
        />
      ))}
      {hiddenCount > 0 && (
        <Badge variant="outline" className="bg-gray-50 text-gray-600">
          +{hiddenCount} more
        </Badge>
      )}
    </div>
  );
}
