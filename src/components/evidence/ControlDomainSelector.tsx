"use client";

/**
 * Control Domain Selector Component
 *
 * Multi-select dropdown for tagging evidence with control domains.
 * Story 3.3: AC6-AC11 - Evidence tagging UI
 *
 * Features:
 * - Fetches domains from tRPC API
 * - Multi-select with checkboxes
 * - Selected domains displayed as removable chips
 * - Maximum 5 domains enforced
 *
 * @see Story 3.3: Control Taxonomy Tagging via Dropdown
 */

import { useMemo } from "react";
import { Check, ChevronDown, X } from "lucide-react";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface ControlDomainSelectorProps {
  /** Currently selected domain IDs */
  value: string[];
  /** Callback when selection changes */
  onChange: (ids: string[]) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Error message to display */
  error?: string;
  /** Custom class name */
  className?: string;
}

/**
 * Color mapping for control domains
 * Story 3.3: AC20 - Tags displayed as colored badges (consistent color per domain)
 */
const DOMAIN_COLORS: Record<string, string> = {
  ACCESS_CONTROL: "bg-blue-100 text-blue-800 border-blue-200",
  AUTHENTICATION: "bg-purple-100 text-purple-800 border-purple-200",
  DATA_PROTECTION: "bg-green-100 text-green-800 border-green-200",
  ENCRYPTION: "bg-yellow-100 text-yellow-800 border-yellow-200",
  NETWORK_SECURITY: "bg-red-100 text-red-800 border-red-200",
  LOGGING_MONITORING: "bg-indigo-100 text-indigo-800 border-indigo-200",
  INCIDENT_RESPONSE: "bg-orange-100 text-orange-800 border-orange-200",
  BUSINESS_CONTINUITY: "bg-teal-100 text-teal-800 border-teal-200",
  PHYSICAL_SECURITY: "bg-gray-100 text-gray-800 border-gray-200",
  THIRD_PARTY_RISK: "bg-pink-100 text-pink-800 border-pink-200",
  SECURITY_AWARENESS: "bg-cyan-100 text-cyan-800 border-cyan-200",
  CHANGE_MANAGEMENT: "bg-lime-100 text-lime-800 border-lime-200",
};

/**
 * Get badge color class for a domain
 */
export function getDomainColor(code: string): string {
  return DOMAIN_COLORS[code] ?? "bg-gray-100 text-gray-800 border-gray-200";
}

export function ControlDomainSelector({
  value,
  onChange,
  disabled = false,
  error,
  className,
}: ControlDomainSelectorProps) {
  // Fetch control domains
  const { data: domains, isLoading } = api.controlDomain.list.useQuery();

  // Get selected domain objects for display
  const selectedDomains = useMemo(() => {
    if (!domains) return [];
    return domains.filter((d) => value.includes(d.id));
  }, [domains, value]);

  // Toggle domain selection
  const toggleDomain = (id: string) => {
    if (value.includes(id)) {
      // Remove domain
      onChange(value.filter((v) => v !== id));
    } else if (value.length < 5) {
      // Add domain (max 5)
      onChange([...value, id]);
    }
  };

  // Remove a specific domain
  const removeDomain = (id: string) => {
    onChange(value.filter((v) => v !== id));
  };

  const isAtMax = value.length >= 5;

  return (
    <div className={cn("space-y-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            disabled={disabled || isLoading}
            className={cn(
              "w-full justify-between",
              error && "border-red-500"
            )}
          >
            <span className="truncate">
              {selectedDomains.length === 0
                ? "Select control domains..."
                : `${selectedDomains.length} domain${selectedDomains.length !== 1 ? "s" : ""} selected`}
            </span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <div className="p-2 border-b">
            <p className="text-sm text-muted-foreground">
              Select 1-5 control domains ({value.length}/5)
            </p>
          </div>
          <div className="max-h-[300px] overflow-y-auto p-2">
            {isLoading ? (
              <div className="p-4 text-center text-muted-foreground">
                Loading domains...
              </div>
            ) : (
              <div className="space-y-1">
                {domains?.map((domain) => {
                  const isSelected = value.includes(domain.id);
                  const isDisabled = !isSelected && isAtMax;

                  return (
                    <button
                      key={domain.id}
                      type="button"
                      onClick={() => toggleDomain(domain.id)}
                      disabled={isDisabled}
                      className={cn(
                        "w-full flex items-start gap-3 p-2 rounded-md text-left transition-colors",
                        isSelected
                          ? "bg-primary/10"
                          : isDisabled
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:bg-muted"
                      )}
                    >
                      <div
                        className={cn(
                          "mt-0.5 h-4 w-4 rounded border flex items-center justify-center",
                          isSelected
                            ? "bg-primary border-primary"
                            : "border-gray-300"
                        )}
                      >
                        {isSelected && (
                          <Check className="h-3 w-3 text-primary-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{domain.name}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {domain.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Selected domains as removable chips - AC9 */}
      {selectedDomains.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedDomains.map((domain) => (
            <Badge
              key={domain.id}
              variant="outline"
              className={cn(
                "pr-1 gap-1",
                getDomainColor(domain.code)
              )}
            >
              {domain.name}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeDomain(domain.id)}
                  className="ml-1 rounded-full hover:bg-black/10 p-0.5"
                >
                  <X className="h-3 w-3" />
                  <span className="sr-only">Remove {domain.name}</span>
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}

      {/* Error message */}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
