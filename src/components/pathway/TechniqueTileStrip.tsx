/**
 * Epic 19 / Stories 19.2 + 19.3: reusable inline technique-tile strip.
 *
 * One tile per PathwayStep (in `order` ascending) connected by arrow glyphs.
 * Shared between the deliverable Section 03 card (19.3) and the Kill Chain
 * styling (19.2) so there is no duplicated tile markup (19.3 AC11).
 *
 * Tokens only: tactic eyebrow uses `.eyebrow`, ATT&CK id is mono `var(--primary)`,
 * hairlines use `var(--border)`. No hardcoded colors.
 */

import { Fragment } from "react";
import type { PathwayStepLike } from "./types";
import { orderedSteps } from "./types";

function ArrowGlyph() {
  return (
    <svg
      width="20"
      height="12"
      viewBox="0 0 20 12"
      aria-hidden
      className="shrink-0"
      style={{ color: "var(--muted-foreground)" }}
    >
      <path
        d="M0 6 H16 M12 2 L16 6 L12 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TechniqueTileStrip({ steps }: { steps: PathwayStepLike[] }) {
  const ordered = orderedSteps(steps);
  return (
    <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
      {ordered.map((s, i) => (
        <Fragment key={s.id}>
          <div
            className="flex min-w-[140px] flex-col gap-1 rounded-md border px-3 py-2"
            style={{ borderColor: "var(--border)", background: "var(--card)" }}
          >
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
          </div>
          {i < ordered.length - 1 ? <ArrowGlyph /> : null}
        </Fragment>
      ))}
    </div>
  );
}
