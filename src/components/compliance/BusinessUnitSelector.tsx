"use client";

/**
 * Business Unit Selector for Compliance Dashboard
 *
 * BU-Scoped Compliance: Allows users to filter compliance data by business unit
 *
 * Shows a dropdown with "All Business Units" (org rollup) plus all BUs
 * that have at least one framework assigned.
 */

import { useMemo } from "react";
import { api } from "@/trpc/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface BusinessUnitSelectorProps {
  /** Currently selected BU ID (null = all BUs / org rollup) */
  value: string | null;
  /** Called when selection changes */
  onChange: (value: string | null) => void;
  /** Optional className for the trigger */
  className?: string;
}

export function BusinessUnitSelector({
  value,
  onChange,
  className,
}: BusinessUnitSelectorProps) {
  // Get business units with framework assignments
  const { data: buData, isLoading: loadingBUs } = api.businessUnit.list.useQuery({
    includeInactive: false,
  });

  // Flatten BU tree for display
  type BUTreeNode = {
    id: string;
    name: string;
    children: BUTreeNode[];
  };

  const flatBUs = useMemo(() => {
    const flatten = (
      tree: BUTreeNode[] | undefined,
      level = 0
    ): Array<{ id: string; name: string; level: number }> => {
      if (!tree) return [];
      return tree.flatMap((bu) => [
        { id: bu.id, name: bu.name, level },
        ...flatten(bu.children, level + 1),
      ]);
    };

    return flatten(buData?.tree as BUTreeNode[] | undefined);
  }, [buData?.tree]);

  if (loadingBUs) {
    return <Skeleton className="h-10 w-[200px]" />;
  }

  return (
    <Select
      value={value ?? "all"}
      onValueChange={(v) => onChange(v === "all" ? null : v)}
    >
      <SelectTrigger className={className}>
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <SelectValue placeholder="Select Business Unit" />
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">
          <span className="font-medium">All Business Units</span>
        </SelectItem>
        {flatBUs.map((bu) => (
          <SelectItem key={bu.id} value={bu.id}>
            <span style={{ paddingLeft: `${bu.level * 12}px` }}>
              {bu.level > 0 && "└ "}
              {bu.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
