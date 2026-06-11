"use client";

/**
 * Story 17.1: Deliverable Shell (AC1–AC13, AC26).
 *
 * The single, type-agnostic chrome for every consulting deliverable. It knows
 * only about a cover, a scorecard config, and a body slot (children). Type
 * logic lives in the body modules (17.2–17.5).
 *
 * Colors come ONLY from design-system tokens (globals.css) — no hardcoded hex.
 */

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Download, Presentation } from "lucide-react";
import { Scorecard } from "./Scorecard";
import type { DeliverableCover, ScorecardCellConfig } from "./types";

export function DeliverableShell({
  cover,
  scorecard,
  children,
  onExportPdf,
  exporting = false,
  toolbarEyebrow = "Deliverable",
}: {
  cover: DeliverableCover;
  /** Exactly three cells. */
  scorecard: ScorecardCellConfig[];
  children: ReactNode;
  /** When omitted, the Export PDF button is hidden (e.g. types without export support). */
  onExportPdf?: () => void;
  exporting?: boolean;
  toolbarEyebrow?: string;
}) {
  return (
    <div className="mx-auto w-full max-w-[940px] p-6">
      {/* Toolbar (AC6) */}
      <div className="mb-4 flex items-center justify-between">
        <span className="eyebrow">{toolbarEyebrow}</span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm">
            <Presentation className="size-4" />
            Present
          </Button>
          {onExportPdf ? (
            <Button size="sm" onClick={onExportPdf} disabled={exporting}>
              <Download className="size-4" />
              {exporting ? "Exporting…" : "Export PDF"}
            </Button>
          ) : null}
        </div>
      </div>

      {/* Document card (AC4, AC5) — no inner padding; cover is flush to edges. */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-md">
        <CoverBand cover={cover} />
        <div className="px-9 py-9 md:px-11">
          <Scorecard cells={scorecard} />
          {children /* body module plugs in here (AC13) */}
        </div>
      </div>
    </div>
  );
}

/**
 * Cover band (AC1–AC3). Gradient derives from the navy --primary token; the
 * lighter stop is computed via color-mix so there is no literal color anywhere.
 */
function CoverBand({ cover }: { cover: DeliverableCover }) {
  return (
    <div
      style={{
        background:
          "linear-gradient(135deg, var(--primary), color-mix(in oklch, var(--primary) 78%, white))",
        color: "var(--primary-foreground)",
        padding: "40px 44px",
      }}
    >
      <span
        className="font-mono"
        style={{ fontSize: 11, letterSpacing: "0.14em", opacity: 0.85 }}
      >
        {cover.confidentialLabel ?? "CONFIDENTIAL"}
      </span>

      <div className="mt-3" style={{ fontSize: 12, opacity: 0.85 }}>
        {cover.eyebrow}
      </div>

      {/* Headings stay sans (per project decision: no serif) — weight carries hierarchy. */}
      <h1
        className="mt-1 font-semibold tracking-tight"
        style={{ fontSize: 38, lineHeight: 1.1 }}
      >
        {cover.title}
      </h1>

      <div className="mt-6 flex flex-wrap gap-x-12 gap-y-4">
        <CoverMeta label="Engagement" value={cover.engagement} />
        <CoverMeta label="Period" value={cover.period} />
        <CoverMeta label="Prepared by" value={cover.preparedBy} />
      </div>
    </div>
  );
}

function CoverMeta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        className="font-mono uppercase"
        style={{ fontSize: 10, letterSpacing: "0.12em", opacity: 0.75 }}
      >
        {label}
      </div>
      <div className="mt-1" style={{ fontSize: 14, fontWeight: 500 }}>
        {value}
      </div>
    </div>
  );
}
