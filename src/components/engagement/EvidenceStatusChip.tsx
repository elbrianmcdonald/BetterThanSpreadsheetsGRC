"use client";

/**
 * Evidence status chip (Epic 18 — Story 18.5).
 *
 * Click-to-cycle REQUESTED → PARTIAL → RECEIVED → REQUESTED via
 * `engagement.evidence.cycleStatus`. Token colors (no hardcoded hex):
 *   REQUESTED = --muted-foreground, PARTIAL = --warning, RECEIVED = --success.
 */

import type { EvidenceStatus } from "./types";

const STATUS_TOKEN: Record<EvidenceStatus, string> = {
  REQUESTED: "var(--muted-foreground)",
  PARTIAL: "var(--warning)",
  RECEIVED: "var(--success)",
};

const STATUS_LABEL: Record<EvidenceStatus, string> = {
  REQUESTED: "Requested",
  PARTIAL: "Partial",
  RECEIVED: "Received",
};

interface Props {
  status: EvidenceStatus;
  onCycle?: () => void;
  disabled?: boolean;
}

export function EvidenceStatusChip({ status, onCycle, disabled }: Props) {
  const color = STATUS_TOKEN[status];
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onCycle}
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors disabled:cursor-default"
      style={{
        color,
        borderColor: color,
        background: `color-mix(in oklch, ${color} 12%, transparent)`,
      }}
      title={disabled ? undefined : "Click to advance status"}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: color }}
      />
      {STATUS_LABEL[status]}
    </button>
  );
}
