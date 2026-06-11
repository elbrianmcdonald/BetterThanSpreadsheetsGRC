/**
 * Epic 19 / Story 19.2 AC13: Kill Chain mode.
 *
 * Horizontal step cards (~176px wide) connected by arrow SVGs. Each card shows:
 * step number (mono crit), tactic eyebrow, technique name, ATT&CK id (mono accent),
 * and the note. Toxic findings get a ToxicMark. Steps render in `order` ascending.
 */

import { Fragment } from "react";
import { ToxicMark } from "./ToxicMark";
import type { PathwayStepLike } from "./types";
import { orderedSteps, stepHasMember, stepMembers } from "./types";

function Arrow() {
  return (
    <svg
      width="28"
      height="14"
      viewBox="0 0 28 14"
      aria-hidden
      className="mt-9 shrink-0 self-start"
      style={{ color: "var(--muted-foreground)" }}
    >
      <path
        d="M0 7 H22 M18 3 L22 7 L18 11"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function KillChainFlow({ steps }: { steps: PathwayStepLike[] }) {
  const ordered = orderedSteps(steps);
  if (ordered.length === 0) {
    return <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>No steps in this pathway yet.</p>;
  }
  return (
    <div className="flex items-stretch gap-1 overflow-x-auto pb-2">
      {ordered.map((s, i) => {
        const members = stepMembers(s);
        return (
          <Fragment key={s.id}>
            <div
              className="flex w-44 shrink-0 flex-col gap-2 rounded-lg border p-3"
              style={{ borderColor: "var(--border)", background: "var(--card)" }}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-semibold" style={{ color: "var(--destructive)" }}>
                  {String(s.order).padStart(2, "0")}
                </span>
                {stepHasMember(s) ? <ToxicMark size={12} /> : null}
              </div>
              <div className="eyebrow" style={{ color: "var(--muted-foreground)" }}>
                {s.tactic}
              </div>
              <div className="text-sm font-semibold leading-snug" style={{ color: "var(--foreground)" }}>
                {s.technique}
              </div>
              {s.mitreTid ? (
                <div className="font-mono text-[11px]" style={{ color: "var(--primary)" }}>
                  {s.mitreTid}
                </div>
              ) : null}
              {s.note ? (
                <p className="text-xs leading-snug" style={{ color: "var(--muted-foreground)" }}>
                  {s.note}
                </p>
              ) : null}
              {members.length > 0 ? (
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {members.map((m) => (
                    <span
                      key={`${m.kind}:${m.id}`}
                      className="inline-flex w-fit items-center rounded-md border px-1.5 py-0.5 font-mono text-[10px]"
                      style={{
                        borderColor: m.kind === "risk" ? "var(--primary)" : "var(--border)",
                        color: m.kind === "risk" ? "var(--primary)" : "var(--muted-foreground)",
                      }}
                    >
                      {m.identifier ?? (m.kind === "risk" ? "RISK" : "FINDING")}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            {i < ordered.length - 1 ? <Arrow /> : null}
          </Fragment>
        );
      })}
    </div>
  );
}
