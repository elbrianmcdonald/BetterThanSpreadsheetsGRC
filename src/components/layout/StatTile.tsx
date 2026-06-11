import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type StatTone = "default" | "primary" | "critical" | "warning" | "success";

const valueToneClass: Record<StatTone, string> = {
  default: "text-foreground",
  primary: "text-primary",
  critical: "text-destructive",
  warning: "text-warning",
  success: "text-success",
};

interface StatTileProps {
  /** Mono uppercase label */
  label: string;
  /** The big tabular figure */
  value: ReactNode;
  /** 12px muted sub-line under the value */
  sub?: ReactNode;
  /** Optional footer (e.g. a "View →" link), set off by a hairline rule */
  footer?: ReactNode;
  /** Optional faint icon, top-right */
  icon?: ReactNode;
  /** Colors the value; "primary" also adds the top accent rule */
  tone?: StatTone;
  /** Force the navy top accent rule independent of tone */
  accent?: boolean;
  /** Soft full-tint background (TPRM/BIA emphasis tiles) */
  filled?: boolean;
  className?: string;
}

const fillClass: Partial<Record<StatTone, string>> = {
  critical: "bg-destructive/10",
  warning: "bg-warning/10",
  success: "bg-success/10",
  primary: "bg-primary/10",
};

/**
 * KPI stat tile: mono label (+ optional faint icon) → big tabular number → muted sub.
 * `tone="primary"` or `accent` adds the navy top rule that marks the lead tile.
 */
export function StatTile({
  label,
  value,
  sub,
  footer,
  icon,
  tone = "default",
  accent,
  filled,
  className,
}: StatTileProps) {
  const showAccent = accent ?? tone === "primary";

  return (
    <div
      className={cn(
        "relative rounded-lg border bg-card px-5 py-[18px] shadow-sm",
        showAccent && "border-t-2 border-t-primary",
        filled && (fillClass[tone] ?? "bg-secondary"),
        className
      )}
    >
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
          {label}
        </span>
        {icon && (
          <span className="ml-auto text-muted-foreground/70 [&>svg]:h-4 [&>svg]:w-4">
            {icon}
          </span>
        )}
      </div>
      <div
        className={cn(
          "tnum mt-3 text-[32px] font-bold leading-[1.05] tracking-[-0.02em]",
          valueToneClass[tone]
        )}
      >
        {value}
      </div>
      {sub && <div className="mt-[7px] text-[12px] text-muted-foreground">{sub}</div>}
      {footer && (
        <div className="mt-3.5 border-t border-border pt-3">{footer}</div>
      )}
    </div>
  );
}
