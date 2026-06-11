"use client";

/**
 * Accent-tinted info callout used across the wizard steps (Epic 18).
 */

import { Info } from "lucide-react";
import type { ReactNode } from "react";

export function InfoCallout({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground/90">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}
