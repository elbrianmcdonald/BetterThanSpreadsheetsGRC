"use client";

/**
 * Epic 19 / Story 19.2: Exploitation Pathway client.
 *
 * Full-page pathway editor. Renders inside the app shell (AppLayout → sidebar)
 * and, for staff-write roles, enables inline editing: rename, verdict/narrative/
 * blast-radius, and step authoring. With no assessment context here, the step
 * form draws findings/risks from the org-wide registers.
 */

import { useSession } from "next-auth/react";
import { UserRole } from "@prisma/client";

import { api } from "@/trpc/react";
import { WRITE_ROLES as WRITE_ROLE_TIER } from "@/lib/auth/roles";
import { AppLayout } from "@/components/layout";
import { FindingDrawerProvider } from "@/components/deliverable/FindingDrawerProvider";
import { ExploitationPathwayView } from "@/components/pathway/ExploitationPathwayView";
import type { PathwayLike } from "@/components/pathway/types";
import { Skeleton } from "@/components/ui/skeleton";

const WRITE_ROLES: UserRole[] = [...WRITE_ROLE_TIER];

export function PathwayClient({ pathwayId }: { pathwayId: string }) {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const canWrite = !!role && WRITE_ROLES.includes(role);

  const { data, isLoading, error, refetch } = api.pathway.getById.useQuery({ id: pathwayId });

  return (
    <AppLayout
      breadcrumbs={[
        { label: "Exploitation Pathways", href: "/admin/pathways" },
        { label: data?.name ?? "Pathway" },
      ]}
    >
      {isLoading ? (
        <div className="mx-auto w-full max-w-[1280px] p-6">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="mt-6 h-[420px] w-full" />
        </div>
      ) : (
        <FindingDrawerProvider>
          <ExploitationPathwayView
            pathway={error ? null : (data as unknown as PathwayLike | null) ?? null}
            editable={canWrite}
            onChanged={() => void refetch()}
          />
        </FindingDrawerProvider>
      )}
    </AppLayout>
  );
}
