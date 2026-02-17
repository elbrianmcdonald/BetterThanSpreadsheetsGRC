/**
 * RoleBadge Component
 *
 * Displays a user's role as a colored badge.
 * Color-coded by role tier for quick visual identification.
 */

import { type UserRole } from "@prisma/client";
import { roleDisplayConfig } from "@/schemas/user";

interface RoleBadgeProps {
  role: UserRole;
  showDescription?: boolean;
}

const colorClasses = {
  purple: "bg-purple-100 text-purple-800 border-purple-200",
  violet: "bg-violet-100 text-violet-800 border-violet-200",
  blue: "bg-blue-100 text-blue-800 border-blue-200",
  cyan: "bg-cyan-100 text-cyan-800 border-cyan-200",
  indigo: "bg-indigo-100 text-indigo-800 border-indigo-200",
  green: "bg-green-100 text-green-800 border-green-200",
  yellow: "bg-yellow-100 text-yellow-800 border-yellow-200",
  gray: "bg-gray-100 text-gray-800 border-gray-200",
} as const;

export function RoleBadge({ role, showDescription = false }: RoleBadgeProps) {
  const config = roleDisplayConfig[role];
  const colorClass = colorClasses[config.color];

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <span
        className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors ${colorClass}`}
        title={config.description}
      >
        {config.label}
      </span>
      {showDescription && (
        <span className="text-xs text-gray-500">{config.description}</span>
      )}
    </div>
  );
}
