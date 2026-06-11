/**
 * Epic 19 / Story 19.2 AC14: ATT&CK Matrix mode.
 *
 * Tactic columns with dark header tiles, always ordered Initial Access →
 * Credential Access → Privilege Escalation → Lateral Movement → Defense Evasion
 * → Impact (the fixed TACTIC_ORDER). Steps whose tactic is not in TACTIC_ORDER
 * are appended in their own trailing columns so nothing is dropped.
 */

import type { PathwayStepLike } from "./types";
import { TACTIC_ORDER, orderedSteps, stepMembers } from "./types";

export function AttackMatrixFlow({ steps }: { steps: PathwayStepLike[] }) {
  const ordered = orderedSteps(steps);

  // Group steps by tactic, then build columns in the fixed ATT&CK order, with
  // any out-of-vocabulary tactics appended afterwards (preserving order).
  const byTactic = new Map<string, PathwayStepLike[]>();
  for (const s of ordered) {
    const list = byTactic.get(s.tactic) ?? [];
    list.push(s);
    byTactic.set(s.tactic, list);
  }
  const extraTactics = [...byTactic.keys()].filter(
    (t) => !TACTIC_ORDER.includes(t as (typeof TACTIC_ORDER)[number]),
  );
  const columns = [...TACTIC_ORDER, ...extraTactics];

  return (
    <div className="grid auto-cols-[minmax(140px,1fr)] grid-flow-col gap-2 overflow-x-auto pb-2">
      {columns.map((tactic) => {
        const cells = byTactic.get(tactic) ?? [];
        return (
          <div key={tactic} className="flex min-w-[140px] flex-col gap-2">
            <div
              className="eyebrow rounded-md px-2 py-2 text-center"
              style={{ background: "var(--foreground)", color: "var(--background)" }}
            >
              {tactic}
            </div>
            {cells.length === 0 ? (
              <div
                className="rounded-md border border-dashed py-3 text-center text-xs"
                style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
              >
                —
              </div>
            ) : (
              cells.map((s) => {
                const members = stepMembers(s);
                return (
                  <div
                    key={s.id}
                    className="relative flex flex-col gap-1.5 rounded-lg border p-3"
                    style={{ borderColor: "var(--border)", background: "var(--card)" }}
                  >
                    {/* Numbered crit badge anchored to the top-left corner */}
                    <span
                      aria-hidden
                      className="absolute -left-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full font-mono text-[11px] font-bold"
                      style={{
                        background: "var(--destructive)",
                        color: "var(--destructive-foreground, white)",
                      }}
                    >
                      {s.order}
                    </span>
                    <div
                      className="text-[13px] font-semibold leading-snug"
                      style={{ color: "var(--foreground)" }}
                    >
                      {s.technique}
                    </div>
                    {s.mitreTid ? (
                      <span
                        className="font-mono text-[10px] font-semibold"
                        style={{ color: "var(--primary)" }}
                      >
                        {s.mitreTid}
                      </span>
                    ) : null}
                    {members.length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-1">
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
                );
              })
            )}
          </div>
        );
      })}
    </div>
  );
}
