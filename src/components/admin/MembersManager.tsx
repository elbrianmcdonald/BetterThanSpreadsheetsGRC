"use client";

/**
 * Members Manager (Multi-Tenancy Epic 3 — Stories 3.1 / 3.2)
 *
 * Org-admin surface for the active company: list members, attach an existing
 * user by email + role (FR13), change a member's role, and remove a member
 * (FR14). All access is authoritatively enforced server-side by `adminProcedure`.
 */

import { useState } from "react";
import { UserRole } from "@prisma/client";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

import { api } from "@/trpc/react";

const ROLES = Object.values(UserRole);

export function MembersManager() {
  const utils = api.useUtils();
  const { data: members, isLoading } = api.organization.listMembers.useQuery();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>(UserRole.BUSINESS_USER);

  const addMember = api.organization.addMember.useMutation();
  const updateRole = api.organization.updateMemberRole.useMutation();
  const removeMember = api.organization.removeMember.useMutation();

  const refresh = () => utils.organization.listMembers.invalidate();

  const handleAdd = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    try {
      await addMember.mutateAsync({ email: trimmed, role });
      setEmail("");
      await refresh();
      toast.success("Member added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add member");
    }
  };

  const handleRoleChange = async (userId: string, nextRole: UserRole) => {
    try {
      await updateRole.mutateAsync({ userId, role: nextRole });
      await refresh();
      toast.success("Role updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update role");
    }
  };

  const handleRemove = async (userId: string) => {
    try {
      await removeMember.mutateAsync({ userId });
      await refresh();
      toast.success("Member removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove member");
    }
  };

  return (
    <div className="space-y-6">
      {/* Add member */}
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card p-4">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Email
          <input
            aria-label="Member email"
            type="email"
            value={email}
            placeholder="user@example.com"
            onChange={(e) => setEmail(e.target.value)}
            className="w-64 rounded border border-input bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Role
          <select
            aria-label="New member role"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="rounded border border-input bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void handleAdd()}
          disabled={addMember.isPending || email.trim().length === 0}
          className="rounded bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          Add member
        </button>
      </div>

      {/* Members list */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading members…</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {(members ?? []).map((m) => (
                <tr key={m.userId} className="border-t border-border">
                  <td className="px-4 py-2 text-foreground">{m.name ?? "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{m.email}</td>
                  <td className="px-4 py-2">
                    <select
                      aria-label={`Role for ${m.email}`}
                      value={m.role}
                      onChange={(e) => void handleRoleChange(m.userId, e.target.value as UserRole)}
                      className="rounded border border-input bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      aria-label={`Remove ${m.email}`}
                      onClick={() => void handleRemove(m.userId)}
                      className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
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
