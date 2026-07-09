"use client";

/**
 * Platform Admin Manager (Multi-Tenancy Epic 3 — Story 3.3)
 *
 * Platform-admin-only surface to grant or revoke platform-admin status by email
 * (FR16). The server authoritatively restricts this to platform admins; this UI
 * is additionally only linked for platform admins.
 */

import { useState } from "react";
import { toast } from "sonner";
import { ShieldMinus } from "lucide-react";

import { api } from "@/trpc/react";

export function PlatformAdminManager() {
  const utils = api.useUtils();
  const { data: admins, isLoading } = api.organization.listPlatformAdmins.useQuery();
  const setPlatformAdmin = api.organization.setPlatformAdmin.useMutation();

  const [email, setEmail] = useState("");

  const refresh = () => utils.organization.listPlatformAdmins.invalidate();

  const apply = async (targetEmail: string, isPlatformAdmin: boolean) => {
    const trimmed = targetEmail.trim();
    if (!trimmed) return;
    try {
      await setPlatformAdmin.mutateAsync({ email: trimmed, isPlatformAdmin });
      await refresh();
      toast.success(isPlatformAdmin ? "Platform admin granted" : "Platform admin revoked");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update platform admin");
    }
  };

  const handleGrant = async () => {
    await apply(email, true);
    setEmail("");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card p-4">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Grant by email
          <input
            aria-label="Grant platform admin by email"
            type="email"
            value={email}
            placeholder="user@example.com"
            onChange={(e) => setEmail(e.target.value)}
            className="w-64 rounded border border-input bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </label>
        <button
          type="button"
          onClick={() => void handleGrant()}
          disabled={setPlatformAdmin.isPending || email.trim().length === 0}
          className="rounded bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          Grant
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading platform admins…</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {(admins ?? []).map((a) => (
                <tr key={a.id} className="border-t border-border">
                  <td className="px-4 py-2 text-foreground">{a.name ?? "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{a.email}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      aria-label={`Revoke ${a.email}`}
                      onClick={() => void apply(a.email ?? "", false)}
                      className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10"
                    >
                      <ShieldMinus className="h-3.5 w-3.5" />
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
