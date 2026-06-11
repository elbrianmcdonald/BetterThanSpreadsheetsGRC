import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  /** Mono uppercase kicker above the title (the signature consulting touch) */
  eyebrow?: string;
  /** Screen title (h1) */
  title: ReactNode;
  /** Small navy lucide icon shown left of the title */
  icon?: ReactNode;
  /** Muted one-line description under the title */
  description?: ReactNode;
  /** Right-aligned actions (typically a single primary CTA) */
  actions?: ReactNode;
  className?: string;
}

/**
 * Standard page header for the consulting-grade theme.
 * Layout: eyebrow kicker → (navy icon + 26px/700 title) → muted sub, actions pushed right.
 */
export function PageHeader({
  eyebrow,
  title,
  icon,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-[26px] flex items-start gap-4", className)}>
      <div className="min-w-0 flex-1">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="flex items-center gap-[11px] text-[26px] font-bold leading-[1.1] tracking-[-0.018em] text-foreground">
          {icon && (
            <span className="grid shrink-0 place-items-center text-primary [&>svg]:h-6 [&>svg]:w-6">
              {icon}
            </span>
          )}
          <span className="truncate">{title}</span>
        </h1>
        {description && (
          <p className="mt-[7px] text-[13.5px] leading-[1.5] text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
