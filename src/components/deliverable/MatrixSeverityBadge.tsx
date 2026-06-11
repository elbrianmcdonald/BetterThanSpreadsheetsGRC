"use client";

/**
 * A severity chip driven by a risk matrix's threshold band — solid band color
 * with auto-contrast text. Unlike the fixed 4-tier {@link SevBadge}, this renders
 * whatever bands/labels/colors the assessment's matrix defines.
 */

import { getContrastColor } from "@/lib/matrix";

export function MatrixSeverityBadge({
  label,
  color,
  size = "md",
}: {
  label: string;
  color: string;
  size?: "sm" | "md";
}) {
  return (
    <span
      className="inline-flex items-center whitespace-nowrap rounded-full font-mono uppercase tracking-wide"
      style={{
        fontSize: size === "sm" ? 10 : 11,
        padding: size === "sm" ? "2px 8px" : "3px 10px",
        background: color,
        color: getContrastColor(color),
      }}
    >
      {label}
    </span>
  );
}
