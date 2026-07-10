"use client";

/**
 * Company Switcher (Multi-Tenancy Epic 1 Story 1.4 + Epic 2 Story 2.1)
 *
 * Sits at the top of the sidebar, above Home. Lets a user who can access more
 * than one company switch the active company, and lets an admin create a new one.
 * The whole app re-scopes to the chosen company's data.
 *
 * Visibility: shown when the user can access 2+ companies (so they can switch),
 * OR when they are an org admin with at least one company (so they can create a
 * second). Otherwise hidden entirely (AR2). The server still authoritatively
 * enforces who may switch/create — the client never gates security.
 *
 * Switch/create flow (FR8, FR12): server-validated mutation → NextAuth `update()`
 * to rewrite the active-org claim → `router.refresh()` so server components
 * re-render against the new company.
 */

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { UserRole } from "@prisma/client";
import { Building2, ChevronsUpDown, Plus } from "lucide-react";

import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";

export function CompanySwitcher() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const utils = api.useUtils();
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");

  const { data: orgs } = api.organization.listSwitchable.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  const switchOrg = api.organization.switch.useMutation();
  const createOrg = api.organization.create.useMutation();

  const activeId = session?.user?.organizationId;
  const canCreate = session?.user?.role === UserRole.ADMINISTRATOR;

  // AR2: the switcher exists only when there's something to do — switch between
  // 2+ companies, or (for an admin) create a second one. Everyone else, and the
  // loading state, render nothing.
  if (!orgs || orgs.length === 0) return null;
  if (orgs.length < 2 && !canCreate) return null;

  const applySession = async (organizationId: string) => {
    await update({ organizationId });
    // The active org lives in the session cookie, so every cached tRPC query is
    // now scoped to the wrong company — invalidate them all so client components
    // refetch, and refresh server components too.
    await utils.invalidate();
    router.refresh();
  };

  const handleChange = async (organizationId: string) => {
    if (!organizationId || organizationId === activeId || busy) return;
    setBusy(true);
    try {
      await switchOrg.mutateAsync({ organizationId });
      await applySession(organizationId);
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      const res = await createOrg.mutateAsync({ name: trimmed });
      setShowCreate(false);
      setName("");
      await applySession(res.organizationId);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1.5 px-3 pt-3">
      <div
        className={cn(
          "relative flex items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/40 px-2.5 py-2",
          busy && "opacity-60",
        )}
      >
        <Building2 className="h-4 w-4 shrink-0 text-sidebar-primary" strokeWidth={2} />
        <select
          aria-label="Switch company"
          value={activeId}
          disabled={busy}
          onChange={(e) => void handleChange(e.target.value)}
          className="w-full cursor-pointer appearance-none bg-transparent pr-5 text-[13px] font-semibold text-foreground focus:outline-none"
        >
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <ChevronsUpDown
          className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-muted-foreground/70"
          strokeWidth={2}
        />
      </div>

      {canCreate && !showCreate && (
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex w-full items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          New company
        </button>
      )}

      {showCreate && (
        <div className="space-y-1.5 rounded-md border border-sidebar-border bg-sidebar-accent/30 p-2">
          <input
            aria-label="New company name"
            value={name}
            disabled={busy}
            placeholder="Company name"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleCreate();
            }}
            className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={busy || name.trim().length === 0}
              className="flex-1 rounded bg-primary px-2 py-1 text-[12px] font-semibold text-primary-foreground disabled:opacity-50"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreate(false);
                setName("");
              }}
              disabled={busy}
              className="rounded px-2 py-1 text-[12px] font-medium text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
