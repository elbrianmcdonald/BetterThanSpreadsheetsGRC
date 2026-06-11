/**
 * Story 17.3: Compliance Deliverable — body.
 *
 * Presentational only: all data arrives via props (no tRPC). Renders two
 * sections inside the shared `DeliverableSection` pattern:
 *
 *   01 Control Status — control rows grouped by family (controlId prefix), each
 *      family header carrying a per-family status tally; families and controls
 *      sorted deterministically (numeric-aware so AC-01 sorts before AC-10).
 *   02 Gap Register  — only PARTIALLY_COMPLIANT + NON_COMPLIANT controls (NON_COMPLIANT
 *      first), each in a framed card with a left border in the status color and
 *      "Not documented" placeholders for empty gap/remediation text.
 *
 * Colors resolve to design-system tokens only (no hardcoded hex).
 */

import type { ComplianceStatus } from "@prisma/client";

import { DeliverableSection } from "@/components/deliverable/DeliverableSection";
import { StatusPill } from "@/components/deliverable/StatusPill";
import type {
  ComplianceControlRow,
  ComplianceGapRow,
} from "@/server/services/deliverableComplianceData";

const STATUS_COLOR: Record<ComplianceStatus, string> = {
  COMPLIANT: "var(--success)",
  PARTIALLY_COMPLIANT: "var(--warning)",
  NON_COMPLIANT: "var(--destructive)",
  NOT_APPLICABLE: "var(--muted-foreground)",
  NOT_ASSESSED: "var(--border)",
};

/** Tally counts per status within a family (stable insertion-friendly order). */
const TALLY_ORDER: ComplianceStatus[] = [
  "COMPLIANT",
  "PARTIALLY_COMPLIANT",
  "NON_COMPLIANT",
  "NOT_APPLICABLE",
  "NOT_ASSESSED",
];

const TALLY_LABEL: Record<ComplianceStatus, string> = {
  COMPLIANT: "Compliant",
  PARTIALLY_COMPLIANT: "Partial",
  NON_COMPLIANT: "Non-compliant",
  NOT_APPLICABLE: "N/A",
  NOT_ASSESSED: "Not assessed",
};

function groupByFamily(controls: ComplianceControlRow[]): {
  family: string;
  rows: ComplianceControlRow[];
}[] {
  const map = new Map<string, ComplianceControlRow[]>();
  for (const c of controls) {
    const list = map.get(c.family);
    if (list) list.push(c);
    else map.set(c.family, [c]);
  }
  return Array.from(map.entries())
    .map(([family, rows]) => ({
      family,
      rows: [...rows].sort((a, b) =>
        a.controlId.localeCompare(b.controlId, undefined, { numeric: true }),
      ),
    }))
    .sort((a, b) => a.family.localeCompare(b.family, undefined, { numeric: true }));
}

function FamilyTally({ rows }: { rows: ComplianceControlRow[] }) {
  const counts = TALLY_ORDER.map((status) => ({
    status,
    n: rows.filter((r) => r.status === status).length,
  })).filter((c) => c.n > 0);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {counts.map((c) => (
        <span
          key={c.status}
          className="inline-flex items-center gap-1.5 text-xs"
          style={{ color: "var(--muted-foreground)" }}
        >
          <span
            aria-hidden
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: STATUS_COLOR[c.status] }}
          />
          <span className="font-medium" style={{ color: "var(--foreground)" }}>
            {c.n}
          </span>
          {TALLY_LABEL[c.status]}
        </span>
      ))}
    </div>
  );
}

function ControlStatusGrid({ controls }: { controls: ComplianceControlRow[] }) {
  if (controls.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
        No controls have been scored for this assessment yet.
      </p>
    );
  }

  const groups = groupByFamily(controls);

  return (
    <div className="space-y-8">
      {groups.map((g) => (
        <div key={g.family}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-2">
            <h3 className="text-sm font-semibold tracking-tight text-foreground">
              {g.family}
            </h3>
            <FamilyTally rows={g.rows} />
          </div>
          <ul className="mt-1 divide-y" style={{ borderColor: "var(--border)" }}>
            {g.rows.map((row) => (
              <li
                key={row.controlId}
                className="flex items-center justify-between gap-4 py-2"
              >
                <div className="flex min-w-0 items-baseline gap-3">
                  <span
                    className="shrink-0 text-xs font-medium"
                    style={{
                      fontFamily: "var(--font-mono)",
                      color: "var(--muted-foreground)",
                    }}
                  >
                    {row.controlId}
                  </span>
                  <span className="truncate text-sm text-foreground">{row.title}</span>
                </div>
                <StatusPill status={row.status} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function GapField({ label, value }: { label: string; value: string | null }) {
  const documented = value != null && value.trim().length > 0;
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p
        className="mt-1 text-sm"
        style={{
          color: documented ? "var(--foreground)" : "var(--muted-foreground)",
          fontStyle: documented ? "normal" : "italic",
        }}
      >
        {documented ? value : "Not documented"}
      </p>
    </div>
  );
}

function GapRegister({ gaps }: { gaps: ComplianceGapRow[] }) {
  if (gaps.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
        No partial or non-compliant controls — nothing requires remediation.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {gaps.map((gap) => {
        const color = STATUS_COLOR[gap.status];
        return (
          <div
            key={gap.controlId}
            className="rounded-md border p-4"
            style={{
              borderColor: "var(--border)",
              borderLeftWidth: "3px",
              borderLeftColor: color,
              background: `color-mix(in oklch, ${color} 4%, transparent)`,
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-baseline gap-3">
                <span
                  className="text-xs font-medium"
                  style={{
                    fontFamily: "var(--font-mono)",
                    color: "var(--muted-foreground)",
                  }}
                >
                  {gap.controlId}
                </span>
                <span className="text-sm font-medium text-foreground">{gap.title}</span>
              </div>
              <StatusPill status={gap.status} />
            </div>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <GapField label="Gap" value={gap.gapDescription} />
              <GapField label="Remediation plan" value={gap.remediationPlan} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ComplianceBody({
  controls,
  gaps,
}: {
  controls: ComplianceControlRow[];
  gaps: ComplianceGapRow[];
}) {
  return (
    <>
      <DeliverableSection
        n="01"
        title="Control Status"
        right={
          <span className="eyebrow">
            {controls.length} {controls.length === 1 ? "control" : "controls"}
          </span>
        }
      >
        <ControlStatusGrid controls={controls} />
      </DeliverableSection>

      <DeliverableSection
        n="02"
        title="Gap Register"
        right={
          <span className="eyebrow">
            {gaps.length} {gaps.length === 1 ? "gap" : "gaps"}
          </span>
        }
      >
        <GapRegister gaps={gaps} />
      </DeliverableSection>
    </>
  );
}
