"use client";

/**
 * Epic 19 / Story 19.2: Exploitation Pathway client.
 *
 * Full-page pathway editor. Renders inside the app shell (AppLayout → sidebar)
 * and, for staff-write roles, enables inline editing: rename, verdict/narrative/
 * blast-radius, and step authoring. With no assessment context here, the step
 * form draws findings/risks from the org-wide registers.
 *
 * Editing is autosave: the name, the description banner, and each step persist
 * the moment you save/add them. The top bar just provides an explicit "Done"
 * (back to the library) and a "Delete" to discard an unwanted pathway.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { UserRole } from "@prisma/client";
import { Check, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import { WRITE_ROLES as WRITE_ROLE_TIER } from "@/lib/auth/roles";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FindingDrawerProvider } from "@/components/deliverable/FindingDrawerProvider";
import { ExploitationPathwayView } from "@/components/pathway/ExploitationPathwayView";
import type { PathwayLike } from "@/components/pathway/types";
import { Skeleton } from "@/components/ui/skeleton";

const WRITE_ROLES: UserRole[] = [...WRITE_ROLE_TIER];

export function PathwayClient({ pathwayId }: { pathwayId: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const canWrite = !!role && WRITE_ROLES.includes(role);

  const { data, isLoading, error, refetch } = api.pathway.getById.useQuery({ id: pathwayId });

  const [confirmDelete, setConfirmDelete] = useState(false);
  const del = api.pathway.remove.useMutation({
    onSuccess: () => {
      toast.success("Pathway deleted");
      router.push("/admin/pathways");
    },
    onError: (e) => toast.error(e.message),
  });

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
        <>
          {canWrite && !error && data ? (
            <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-3 px-6 pt-6">
              <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Check className="h-3.5 w-3.5 text-primary" />
                Changes are saved automatically as you edit.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
                <Button onClick={() => router.push("/admin/pathways")}>Done</Button>
              </div>
            </div>
          ) : null}

          <FindingDrawerProvider>
            <ExploitationPathwayView
              pathway={error ? null : (data as unknown as PathwayLike | null) ?? null}
              editable={canWrite}
              onChanged={() => void refetch()}
            />
          </FindingDrawerProvider>
        </>
      )}

      {confirmDelete && data ? (
        <Dialog open onOpenChange={(o) => !o && setConfirmDelete(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete pathway?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              This permanently deletes{" "}
              <span className="font-medium text-foreground">{data.name}</span> and its steps, and
              removes it from every assessment, finding, and risk it is linked to. The findings and
              risks themselves are not deleted. This cannot be undone.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={del.isPending}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => del.mutate({ id: pathwayId })} disabled={del.isPending}>
                {del.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </AppLayout>
  );
}
