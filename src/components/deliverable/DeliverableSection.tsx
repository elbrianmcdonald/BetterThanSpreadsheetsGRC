/**
 * Story 17.1: Section pattern (AC11–AC12).
 *
 * Renders the `<n>` (mono accent number) / hairline / heading pattern, separated
 * by a bottom border + margin. Accepts arbitrary children (the type-specific body
 * slot) and an optional `right` slot in the heading row.
 */

import type { ReactNode } from "react";

export function DeliverableSection({
  n,
  title,
  right,
  children,
}: {
  /** Section number, e.g. "01". Rendered mono in the accent (navy) tone. */
  n: string;
  title: string;
  right?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="mt-10 border-b pb-10 last:border-b-0">
      <div className="flex items-center gap-3">
        <span
          className="font-mono text-sm font-medium"
          style={{ color: "var(--primary)" }}
        >
          {n}
        </span>
        <span aria-hidden className="h-px flex-1" style={{ background: "var(--border)" }} />
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
        {right ? <div className="ml-auto">{right}</div> : null}
      </div>
      {children ? <div className="mt-5">{children}</div> : null}
    </section>
  );
}
