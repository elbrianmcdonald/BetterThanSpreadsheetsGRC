/**
 * Epic 19 / Story 19.2 AC15: Attack Narrative mode.
 *
 * Vertical staircase (`40px 1fr` grid) with numbered circles connected by a
 * vertical line, tactic eyebrow + ATT&CK id, technique title, note, and a
 * finding-reference chip. Steps render in `order` ascending.
 */

import { Fragment } from "react";
import { ToxicMark } from "./ToxicMark";
import type { PathwayStepLike } from "./types";
import { memberScoreFigure, orderedSteps, severityTier, stepHasMember, stepMembers } from "./types";

export function AttackNarrativeFlow({ steps }: { steps: PathwayStepLike[] }) {
  const ordered = orderedSteps(steps);
  if (ordered.length === 0) {
    return <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>No steps in this pathway yet.</p>;
  }
  return (
    <div className="grid grid-cols-[40px_1fr] gap-x-3">
      {ordered.map((s, i) => {
        const last = i === ordered.length - 1;
        const members = stepMembers(s);
        return (
          <Fragment key={s.id}>
            {/* Rail: numbered circle + connecting line */}
            <div className="flex flex-col items-center">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full font-mono text-xs font-semibold"
                style={{
                  background: "color-mix(in oklch, var(--destructive) 12%, transparent)",
                  color: "var(--destructive)",
                  border: "1px solid var(--destructive)",
                }}
              >
                {s.order}
              </span>
              {!last ? (
                <span
                  aria-hidden
                  className="w-0.5 flex-1"
                  style={{
                    background: "color-mix(in oklch, var(--destructive) 30%, var(--border))",
                    minHeight: 24,
                  }}
                />
              ) : null}
            </div>

            {/* Content */}
            <div className={last ? "pb-1" : "pb-6"}>
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="eyebrow" style={{ color: "var(--destructive)" }}>
                  {s.tactic}
                </span>
                {s.mitreTid ? (
                  <span
                    className="font-mono text-[11px] font-semibold"
                    style={{ color: "var(--primary)" }}
                  >
                    {s.mitreTid}
                  </span>
                ) : null}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <h4
                  className="text-base font-semibold leading-snug tracking-tight"
                  style={{ color: "var(--foreground)" }}
                >
                  {s.technique}
                </h4>
                {stepHasMember(s) ? <ToxicMark size={12} /> : null}
              </div>
              {s.note ? (
                <p
                  className="mt-1.5 max-w-[440px] text-[13px] leading-relaxed"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {s.note}
                </p>
              ) : null}
              {members.length > 0 ? (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {members.map((m) => (
                    <span
                      key={`${m.kind}:${m.id}`}
                      className="inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[12px]"
                      style={{
                        borderColor: m.kind === "risk" ? "var(--primary)" : "var(--border)",
                        background: "var(--muted)",
                      }}
                    >
                      <span
                        className="font-mono text-[11px]"
                        style={{
                          color: m.kind === "risk" ? "var(--primary)" : "var(--muted-foreground)",
                        }}
                      >
                        {m.identifier ?? (m.kind === "risk" ? "RISK" : "FINDING")}
                      </span>
                      <span style={{ color: "var(--muted-foreground)" }}>{m.title}</span>
                      {/* Severity dot + L×I(×E) figure (or severity label fallback). */}
                      <span
                        aria-hidden
                        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: severityTier(m.severity).color }}
                      />
                      <span
                        className="font-mono text-[11px]"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        {memberScoreFigure(m) ?? severityTier(m.severity).label}
                      </span>
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
