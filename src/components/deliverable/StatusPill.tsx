/**
 * Story 17.3: Compliance Deliverable — status pill.
 *
 * Small colored-dot + label pill for a single `ComplianceStatus`. All colors
 * resolve to design-system tokens (no hardcoded hex); the pill background is a
 * faint oklch tint of the status color via color-mix.
 */

import type { ComplianceStatus } from "@prisma/client";

const STATUS_COLOR: Record<ComplianceStatus, string> = {
  COMPLIANT: "var(--success)",
  PARTIALLY_COMPLIANT: "var(--warning)",
  NON_COMPLIANT: "var(--destructive)",
  NOT_APPLICABLE: "var(--muted-foreground)",
  NOT_ASSESSED: "var(--border)",
};

const STATUS_LABEL: Record<ComplianceStatus, string> = {
  COMPLIANT: "Compliant",
  PARTIALLY_COMPLIANT: "Partial",
  NON_COMPLIANT: "Non-compliant",
  NOT_APPLICABLE: "N/A",
  NOT_ASSESSED: "Not assessed",
};

export function StatusPill({ status }: { status: ComplianceStatus }) {
  const color = STATUS_COLOR[status];
  const label = STATUS_LABEL[status];

  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium"
      style={{
        color: "var(--foreground)",
        background: `color-mix(in oklch, ${color} 12%, transparent)`,
        border: `1px solid color-mix(in oklch, ${color} 35%, transparent)`,
      }}
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}
