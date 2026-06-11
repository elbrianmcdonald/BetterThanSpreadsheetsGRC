"use client";

/**
 * Epic 19 / Story 19.2: Exploitation Pathway client.
 *
 * Does the tRPC query and feeds the data into ExploitationPathwayView. Wraps the
 * view in FindingDrawerProvider so contributing-finding clicks open the SHARED
 * Finding Drawer (one instance, reused — never a second drawer). Risk members
 * link out to the risk detail page instead.
 */

import { api } from "@/trpc/react";
import { FindingDrawerProvider } from "@/components/deliverable/FindingDrawerProvider";
import { ExploitationPathwayView } from "@/components/pathway/ExploitationPathwayView";
import type { PathwayLike } from "@/components/pathway/types";
import { Skeleton } from "@/components/ui/skeleton";

export function PathwayClient({ pathwayId }: { pathwayId: string }) {
  const { data, isLoading, error } = api.pathway.getById.useQuery({ id: pathwayId });

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-[1280px] p-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="mt-6 h-[420px] w-full" />
      </div>
    );
  }

  if (error) {
    // NOT_FOUND or cross-org → render the empty state rather than crash.
    return (
      <FindingDrawerProvider>
        <ExploitationPathwayView pathway={null} />
      </FindingDrawerProvider>
    );
  }

  return (
    <FindingDrawerProvider>
      <ExploitationPathwayView pathway={(data as unknown as PathwayLike | null) ?? null} />
    </FindingDrawerProvider>
  );
}
