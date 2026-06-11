"use client";

/**
 * Story 17.1: Reusable Finding Drawer (AC14–AC18).
 *
 * Slide-in panel fixed to the right. Built once and rendered by
 * FindingDrawerProvider; bodies open it via useFindingDrawer().openFinding(row).
 */

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { SevBadge } from "./SevBadge";
import { sevOf } from "./tone";
import type { FindingLike } from "./types";

export function FindingDrawer({
  finding,
  onClose,
}: {
  finding: FindingLike | null;
  onClose: () => void;
}) {
  const open = finding !== null;
  const panelRef = useRef<HTMLDivElement>(null);
  // Remember the element focused before opening, to restore on close (AC: focus mgmt).
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // Escape-to-close + focus management (AC15, focus trap entry).
  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    // Move focus into the panel.
    panelRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      restoreFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!finding) return null;

  const score = finding.likelihood * finding.impact;
  const severity = sevOf(score);

  return (
    <>
      {/* Backdrop (AC15) */}
      <div
        aria-hidden
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "oklch(0.3 0.02 252 / 0.32)",
          zIndex: 50,
        }}
      />
      {/* Panel (AC14): slides in from the right */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Finding ${finding.identifier ?? finding.id}`}
        tabIndex={-1}
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(520px, 92vw)",
          background: "var(--card)",
          borderLeft: "1px solid var(--border)",
          boxShadow: "0 8px 24px oklch(0.4 0.03 252 / 0.10), 0 2px 6px oklch(0.4 0.03 252 / 0.05)",
          zIndex: 51,
          display: "flex",
          flexDirection: "column",
          animation: "deliverable-drawer-in 220ms cubic-bezier(0.16, 1, 0.3, 1)",
          outline: "none",
        }}
      >
        <style>{`
          @keyframes deliverable-drawer-in {
            from { transform: translateX(24px); opacity: 0; }
            to   { transform: translateX(0);    opacity: 1; }
          }
        `}</style>

        {/* Header (AC16) */}
        <div className="flex items-start gap-3 border-b p-6">
          <span className="rounded-md border bg-muted px-2 py-1 font-mono text-xs text-foreground">
            {finding.identifier ?? finding.id}
          </span>
          <SevBadge severity={severity} />
          <h3 className="ml-auto-0 mt-0.5 flex-1 text-xl font-semibold leading-snug text-foreground">
            {finding.title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 place-items-center rounded-md border text-muted-foreground hover:bg-accent"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body (AC17–AC18) */}
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {/* Scoring grid */}
          <div className="grid grid-cols-3 gap-3">
            <ScoreTile label="Likelihood" value={finding.likelihood} suffix="/ 5" />
            <ScoreTile label="Impact" value={finding.impact} suffix="/ 5" />
            <ScoreTile label="Risk Score" value={score} />
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-3">
            <MetaTile label="Domain" value={finding.domain ?? "—"} />
            <MetaTile label="Remediation Effort" value={finding.remediationEffort ?? "—"} />
          </div>

          {/* Framed boxes */}
          {finding.rationale ? (
            <FramedBox label="Why it is a risk" color="var(--destructive)" text={finding.rationale} />
          ) : null}
          {finding.recommendedAction ? (
            <FramedBox label="Recommended action" color="var(--success)" text={finding.recommendedAction} />
          ) : null}
          {finding.evidence ? (
            <FramedBox label="Evidence" color="var(--primary)" text={finding.evidence} />
          ) : null}
        </div>
      </div>
    </>
  );
}

function ScoreTile({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/40 p-3">
      <div className="eyebrow">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="tnum text-2xl font-semibold text-foreground">{value}</span>
        {suffix ? <span className="text-xs text-muted-foreground">{suffix}</span> : null}
      </div>
    </div>
  );
}

function MetaTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/40 p-3">
      <div className="eyebrow">{label}</div>
      <div className="mt-1 text-sm text-foreground">{value}</div>
    </div>
  );
}

function FramedBox({
  label,
  color,
  text,
}: {
  label: string;
  color: string;
  text: string;
}) {
  return (
    <div
      style={{
        borderLeft: `3px solid ${color}`,
        background: `color-mix(in oklch, ${color} 6%, transparent)`,
        borderRadius: "0 8px 8px 0",
        padding: "12px 14px",
      }}
    >
      <div className="eyebrow" style={{ color }}>
        {label}
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-foreground">{text}</p>
    </div>
  );
}
