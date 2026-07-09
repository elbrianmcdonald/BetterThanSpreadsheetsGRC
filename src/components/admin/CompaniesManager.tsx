"use client";

/**
 * Companies Manager (Multi-Tenancy — platform admin)
 *
 * Lists every company with member counts, creates new companies, and deletes
 * companies (cascading all their data). The caller's currently-active company
 * cannot be deleted — switch away first. Server enforces platform-admin access.
 */

import { useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

import { api } from "@/trpc/react";

export function CompaniesManager() {
  const { data: session } = useSession();
  const utils = api.useUtils();
  const { data: companies, isLoading } = api.organization.listCompanies.useQuery();
  const createOrg = api.organization.create.useMutation();
  const deleteOrg = api.organization.delete.useMutation();

  const [name, setName] = useState("");
  const activeId = session?.user?.organizationId;

  const refresh = () => utils.organization.listCompanies.invalidate();

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await createOrg.mutateAsync({ name: trimmed });
      setName("");
      await refresh();
      toast.success("Company created");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create company");
    }
  };

  const handleDelete = async (id: string, companyName: string) => {
    if (!window.confirm(`Delete "${companyName}" and all of its data? This cannot be undone.`)) {
      return;
    }
    try {
      await deleteOrg.mutateAsync({ organizationId: id });
      await refresh();
      toast.success("Company deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete company");
    }
  };

  return (
    <div className="space-y-6">
      {/* Create */}
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card p-4">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          New company
          <input
            aria-label="New company name"
            value={name}
            placeholder="Company name"
            onChange={(e) => setName(e.target.value)}
            className="w-64 rounded border border-input bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </label>
        <button
          type="button"
          onClick={() => void handleCreate()}
          disabled={createOrg.isPending || name.trim().length === 0}
          className="rounded bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          Create
        </button>
      </div>

      {/* Companies */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading companies…</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Company</th>
                <th className="px-4 py-2 font-medium">Members</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {(companies ?? []).map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-4 py-2 font-medium text-foreground">
                    {c.name}
                    {c.id === activeId && (
                      <span className="ml-2 rounded bg-sidebar-accent px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sidebar-primary">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{c.memberCount}</td>
                  <td className="px-4 py-2 text-right">
                    {c.id === activeId ? (
                      <span className="text-xs text-muted-foreground/60">Switch away to delete</span>
                    ) : (
                      <button
                        type="button"
                        aria-label={`Delete ${c.name}`}
                        onClick={() => void handleDelete(c.id, c.name)}
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    )}
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
