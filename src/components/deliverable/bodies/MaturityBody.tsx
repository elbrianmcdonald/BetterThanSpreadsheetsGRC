/**
 * Story 17.4: Maturity Deliverable body.
 *
 * Renders, inside the shared {@link DeliverableSection} primitives:
 *   01 Domain Maturity — a {@link DomainMaturityBar} per domain on a shared
 *      0–5 axis (current fill vs target marker), plus a 1–5 level legend.
 *   02 Below Target    — callouts for domains where current < target, sorted by
 *      largest gap first; a positive empty state when none are below target.
 *
 * Presentational only — all data arrives via props; no tRPC, no fetching.
 */

import { DeliverableSection } from "@/components/deliverable/DeliverableSection";
import { DomainMaturityBar } from "@/components/deliverable/DomainMaturityBar";
import {
  isBelowTarget,
  levelColor,
  type MaturityDomainRow,
} from "@/server/services/deliverableMaturityData";

/** Maturity level legend (CMMI-style 1–5). */
const LEVEL_LEGEND: { level: number; label: string }[] = [
  { level: 1, label: "Initial" },
  { level: 2, label: "Managed" },
  { level: 3, label: "Defined" },
  { level: 4, label: "Quantified" },
  { level: 5, label: "Optimized" },
];

export function MaturityBody({
  domains,
  overallLevel,
  targetLevel,
}: {
  domains: MaturityDomainRow[];
  overallLevel: number | null;
  targetLevel: number | null;
}) {
  const belowTarget = domains
    .filter(isBelowTarget)
    .map((d) => ({
      ...d,
      // Safe: isBelowTarget guarantees both levels are non-null.
      gap: (d.targetLevel as number) - (d.currentLevel as number),
    }))
    .sort((a, b) => b.gap - a.gap);

  return (
    <>
      <DeliverableSection
        n="01"
        title="Domain Maturity"
        right={<OverallChip overallLevel={overallLevel} targetLevel={targetLevel} />}
      >
        {domains.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            No domains have been scored for this assessment yet.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-4">
              {domains.map((d) => (
                <DomainMaturityBar
                  key={d.name}
                  name={d.name}
                  currentLevel={d.currentLevel}
                  targetLevel={d.targetLevel}
                  isNotApplicable={d.isNotApplicable}
                />
              ))}
            </div>
            <LevelLegend />
          </>
        )}
      </DeliverableSection>

      <DeliverableSection
        n="02"
        title="Below Target"
        right={
          belowTarget.length > 0 ? (
            <span className="eyebrow" style={{ color: "var(--severity-high)" }}>
              {belowTarget.length} domain{belowTarget.length === 1 ? "" : "s"}
            </span>
          ) : null
        }
      >
        {belowTarget.length === 0 ? (
          <div
            className="rounded-md border px-4 py-3 text-sm"
            style={{
              borderColor: "var(--border)",
              color: "var(--success)",
              background: "color-mix(in oklch, var(--success) 8%, var(--card))",
            }}
          >
            All scored domains meet or exceed their target maturity level.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {belowTarget.map((d) => (
              <div
                key={d.name}
                className="flex items-center justify-between gap-3 rounded-md border px-4 py-3"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: levelColor(d.currentLevel) }}
                  />
                  <span className="text-sm font-medium text-foreground">{d.name}</span>
                </div>
                <div className="flex items-center gap-3 font-mono text-xs">
                  <span style={{ color: levelColor(d.currentLevel) }}>
                    {d.currentLevel}
                  </span>
                  <span style={{ color: "var(--muted-foreground)" }}>
                    → {d.targetLevel}
                  </span>
                  <span
                    className="rounded px-1.5 py-0.5 font-semibold"
                    style={{
                      color: "var(--severity-high)",
                      background:
                        "color-mix(in oklch, var(--severity-high) 14%, var(--card))",
                    }}
                  >
                    gap {d.gap}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </DeliverableSection>
    </>
  );
}

/** Sectionless domain-maturity content (bars + legend) for the exec summary. */
export function MaturityDomainsContent({ domains }: { domains: MaturityDomainRow[] }) {
  if (domains.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
        No domains have been scored for this assessment yet.
      </p>
    );
  }
  return (
    <>
      <div className="flex flex-col gap-4">
        {domains.map((d) => (
          <DomainMaturityBar
            key={d.name}
            name={d.name}
            currentLevel={d.currentLevel}
            targetLevel={d.targetLevel}
            isNotApplicable={d.isNotApplicable}
          />
        ))}
      </div>
      <LevelLegend />
    </>
  );
}

/** Sectionless below-target callouts for the exec summary. */
export function MaturityBelowTargetContent({ domains }: { domains: MaturityDomainRow[] }) {
  const belowTarget = domains
    .filter(isBelowTarget)
    .map((d) => ({ ...d, gap: (d.targetLevel as number) - (d.currentLevel as number) }))
    .sort((a, b) => b.gap - a.gap);
  if (belowTarget.length === 0) {
    return (
      <div
        className="rounded-md border px-4 py-3 text-sm"
        style={{
          borderColor: "var(--border)",
          color: "var(--success)",
          background: "color-mix(in oklch, var(--success) 8%, var(--card))",
        }}
      >
        All scored domains meet or exceed their target maturity level.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {belowTarget.map((d) => (
        <div
          key={d.name}
          className="flex items-center justify-between gap-3 rounded-md border px-4 py-3"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: levelColor(d.currentLevel) }}
            />
            <span className="text-sm font-medium text-foreground">{d.name}</span>
          </div>
          <div className="flex items-center gap-3 font-mono text-xs">
            <span style={{ color: levelColor(d.currentLevel) }}>{d.currentLevel}</span>
            <span style={{ color: "var(--muted-foreground)" }}>→ {d.targetLevel}</span>
            <span
              className="rounded px-1.5 py-0.5 font-semibold"
              style={{
                color: "var(--severity-high)",
                background: "color-mix(in oklch, var(--severity-high) 14%, var(--card))",
              }}
            >
              gap {d.gap}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function OverallChip({
  overallLevel,
  targetLevel,
}: {
  overallLevel: number | null;
  targetLevel: number | null;
}) {
  if (overallLevel === null) return null;
  return (
    <span className="font-mono text-xs">
      <span style={{ color: levelColor(overallLevel) }}>Overall {overallLevel}</span>
      {targetLevel !== null ? (
        <span style={{ color: "var(--muted-foreground)" }}> / {targetLevel}</span>
      ) : null}
    </span>
  );
}

function LevelLegend() {
  return (
    <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
      <span className="eyebrow" style={{ color: "var(--muted-foreground)" }}>
        Level
      </span>
      {LEVEL_LEGEND.map(({ level, label }) => (
        <span key={level} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-2.5 w-2.5 rounded-sm"
            style={{ background: levelColor(level) }}
          />
          <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            {level} {label}
          </span>
        </span>
      ))}
    </div>
  );
}
