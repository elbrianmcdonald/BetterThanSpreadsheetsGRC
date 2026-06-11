"use client";

/**
 * Wizard step rail (Epic 18 — Story 18.2, reused by 18.3–18.7).
 *
 * Sticky 6-step rail driven by the engagement's current `phase`. Each step is
 * a circle badge: active = primary, done = success + check, future = muted.
 * Duration labels come from ASSESSMENT_PHASES.
 */

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ASSESSMENT_PHASES } from "@/lib/engagement/assessment-methodology";
import { PHASE_ORDER, type EngagementPhase } from "./types";

interface StepRailProps {
  current: EngagementPhase;
  /** Navigate to a phase already reached (no jumping ahead of current). */
  onSelect?: (phase: EngagementPhase) => void;
  disabled?: boolean;
}

export function StepRail({ current, onSelect, disabled }: StepRailProps) {
  const currentIdx = PHASE_ORDER.indexOf(current);

  return (
    <nav
      aria-label="Engagement steps"
      className="sticky top-6 flex flex-col gap-1"
    >
      {ASSESSMENT_PHASES.map((phase, idx) => {
        const isActive = idx === currentIdx;
        const isDone = idx < currentIdx;
        const reachable = idx <= currentIdx;

        return (
          <button
            key={phase.id}
            type="button"
            disabled={disabled || !reachable || !onSelect}
            onClick={() => reachable && onSelect?.(phase.id)}
            className={cn(
              "group flex items-center gap-3 rounded-md px-2 py-2 text-left transition-colors",
              reachable && onSelect && !disabled && "hover:bg-secondary",
              !reachable && "cursor-default opacity-60",
            )}
          >
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[12px] font-semibold tnum transition-colors",
                isActive &&
                  "border-primary bg-primary text-primary-foreground",
                isDone &&
                  "border-success bg-success text-success-foreground",
                !isActive &&
                  !isDone &&
                  "border-border bg-muted text-muted-foreground",
              )}
            >
              {isDone ? <Check className="h-4 w-4" /> : phase.n}
            </span>
            <span className="flex flex-col">
              <span
                className={cn(
                  "text-sm font-medium leading-tight",
                  isActive ? "text-foreground" : "text-foreground/80",
                )}
              >
                {phase.short}
              </span>
              <span className="eyebrow">{phase.duration}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
