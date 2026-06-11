/**
 * Epic 19 / Story 19.3: Pathway in deliverable — "Section 03 — Exploitation
 * Pathway" card.
 *
 * A clickable section card showing the pathway as an inline technique-tile
 * strip (reusing TechniqueTileStrip — no duplicated tile markup) with the
 * verdict / blast-radius summary line. The whole card links to the full pathway
 * view at `/deliverables/pathway/[pathwayId]`.
 *
 * Graceful omission (AC7): renders NOTHING when `pathway` is null or has no steps,
 * so the report never shows an empty "Section 03" placeholder. Section numbering
 * is fixed (passed via `sectionNo`), not a live counter, so later sections don't
 * renumber when this is omitted (AC8).
 */

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { TechniqueTileStrip } from "./TechniqueTileStrip";
import type { PathwayLike } from "./types";

export function PathwaySectionCard({
  pathway,
  sectionNo = "03",
}: {
  pathway: Pick<PathwayLike, "id" | "verdict" | "blastRadius" | "steps"> | null;
  sectionNo?: string;
}) {
  // AC7: omit entirely when there is no pathway / no steps.
  if (!pathway || pathway.steps.length === 0) return null;

  const summary =
    pathway.verdict ??
    (pathway.blastRadius ? `Blast radius: ${pathway.blastRadius}` : "Exploitation pathway");

  return (
    <section className="mt-10 border-b pb-10 last:border-b-0">
      <div className="flex items-center gap-3">
        <span className="font-mono text-sm font-medium" style={{ color: "var(--primary)" }}>
          {sectionNo}
        </span>
        <span aria-hidden className="h-px flex-1" style={{ background: "var(--border)" }} />
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Exploitation Pathway
        </h2>
      </div>

      <Link
        href={`/deliverables/pathway/${pathway.id}`}
        className="mt-5 block rounded-xl border p-4 transition-colors hover:bg-[var(--muted)]"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <p className="text-sm leading-relaxed" style={{ color: "var(--foreground)" }}>
            {summary}
          </p>
          <span
            className="inline-flex shrink-0 items-center gap-1 font-mono text-xs"
            style={{ color: "var(--primary)" }}
          >
            View pathway
            <ArrowRight size={14} aria-hidden />
          </span>
        </div>

        {pathway.blastRadius && pathway.verdict ? (
          <p className="mb-3 text-xs" style={{ color: "var(--muted-foreground)" }}>
            Blast radius: {pathway.blastRadius}
          </p>
        ) : null}

        <TechniqueTileStrip steps={pathway.steps} />
      </Link>
    </section>
  );
}
