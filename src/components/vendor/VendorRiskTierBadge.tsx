/**
 * Vendor Risk Tier Badge Component
 *
 * Epic 2: Vendor Risk Tiering
 * Story 2.1: Risk Tier Classification (FR11)
 *
 * Displays vendor risk tier with appropriate styling.
 */

import { VendorRiskTier } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ShieldAlert,
  Shield,
  ShieldCheck,
  HelpCircle,
} from "lucide-react";

interface VendorRiskTierBadgeProps {
  tier: VendorRiskTier | null;
  className?: string;
  showIcon?: boolean;
}

const TIER_CONFIG: Record<
  VendorRiskTier | "NOT_CLASSIFIED",
  {
    label: string;
    variant: "critical" | "high" | "warning" | "success" | "neutral";
    className: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  CRITICAL: {
    label: "Critical",
    variant: "critical",
    className: "",
    icon: AlertTriangle,
  },
  HIGH: {
    label: "High",
    variant: "high",
    className: "",
    icon: ShieldAlert,
  },
  MEDIUM: {
    label: "Medium",
    variant: "warning",
    className: "",
    icon: Shield,
  },
  LOW: {
    label: "Low",
    variant: "success",
    className: "",
    icon: ShieldCheck,
  },
  NOT_CLASSIFIED: {
    label: "Not Classified",
    variant: "neutral",
    className: "",
    icon: HelpCircle,
  },
};

export function VendorRiskTierBadge({
  tier,
  className,
  showIcon = true,
}: VendorRiskTierBadgeProps) {
  const key = tier ?? "NOT_CLASSIFIED";
  const config = TIER_CONFIG[key];
  const Icon = config.icon;

  return (
    <Badge
      variant={config.variant}
      className={cn(config.className, "font-medium", className)}
    >
      {showIcon && <Icon className="mr-1 h-3 w-3" />}
      {config.label}
    </Badge>
  );
}

/**
 * Get all vendor risk tier options for select/dropdown
 */
export function getVendorRiskTierOptions() {
  return [
    { value: "CRITICAL" as VendorRiskTier, label: "Critical (6-month review)" },
    { value: "HIGH" as VendorRiskTier, label: "High (12-month review)" },
    { value: "MEDIUM" as VendorRiskTier, label: "Medium (18-month review)" },
    { value: "LOW" as VendorRiskTier, label: "Low (24-month review)" },
  ];
}
