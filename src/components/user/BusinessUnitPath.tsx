/**
 * Business Unit Path Component
 *
 * Story 7.0.4: User Business Unit Assignment UI
 *
 * Displays the full hierarchical path of a business unit (e.g., "Engineering > Platform").
 *
 * @see AC2-AC3: Display BU name with path for nested BUs
 */

"use client";

interface BusinessUnitNode {
  id: string;
  name: string;
  parentId: string | null;
  parent?: BusinessUnitNode | null;
}

interface BusinessUnitPathProps {
  businessUnit: BusinessUnitNode | null | undefined;
  /** Show "Unassigned" when businessUnit is null */
  showUnassigned?: boolean;
  /** Custom class for the container */
  className?: string;
}

/**
 * Recursively builds the path from root to current BU
 */
function buildPath(bu: BusinessUnitNode | null | undefined): string[] {
  if (!bu) return [];

  const path: string[] = [];

  // Build path from root to current
  function collectPath(node: BusinessUnitNode | null | undefined) {
    if (!node) return;
    if (node.parent) {
      collectPath(node.parent);
    }
    path.push(node.name);
  }

  collectPath(bu);
  return path;
}

export function BusinessUnitPath({
  businessUnit,
  showUnassigned = true,
  className = "",
}: BusinessUnitPathProps) {
  if (!businessUnit) {
    if (showUnassigned) {
      return (
        <span className={`text-slate-500 italic ${className}`}>Unassigned</span>
      );
    }
    return null;
  }

  const path = buildPath(businessUnit);
  const displayPath = path.join(" > ");

  return (
    <span className={`text-foreground ${className}`} title={displayPath}>
      {displayPath}
    </span>
  );
}

/**
 * Simple badge variant for compact display
 */
export function BusinessUnitBadge({
  businessUnit,
  showUnassigned = false,
}: Omit<BusinessUnitPathProps, "className">) {
  if (!businessUnit) {
    if (showUnassigned) {
      return (
        <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">
          Unassigned
        </span>
      );
    }
    return null;
  }

  const path = buildPath(businessUnit);

  return (
    <span
      className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10"
      title={path.join(" > ")}
    >
      {path.length > 2 ? `...${path.slice(-2).join(" > ")}` : path.join(" > ")}
    </span>
  );
}
