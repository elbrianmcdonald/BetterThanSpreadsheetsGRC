"use client";

/**
 * Compliance Plans list (Bridge to Compliance Plan — Story 1.2 UI).
 *
 * Lists named plans with owner, status, progress, and overdue counts; creates a
 * plan; and navigates to a plan's detail board.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { api } from "@/trpc/react";

export function CompliancePlansManager() {
  const router = useRouter();
  const utils = api.useUtils();
  const { data: plans, isLoading } = api.compliancePlan.list.useQuery();
  const createPlan = api.compliancePlan.create.useMutation();
  const [name, setName] = useState("");

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const plan = await createPlan.mutateAsync({ name: trimmed });
      setName("");
      await utils.compliancePlan.list.invalidate();
      toast.success("Plan created");
      router.push(`/compliance/plans/${plan.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create plan");
    }
  };

  const open = (id: string) => router.push(`/compliance/plans/${id}`);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card p-4">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          New plan
          <input
            aria-label="Plan name"
            value={name}
            placeholder="e.g. SOC 2 Readiness"
            onChange={(e) => setName(e.target.value)}
            className="w-72 rounded border border-input bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </label>
        <button
          type="button"
          onClick={() => void handleCreate()}
          disabled={createPlan.isPending || name.trim().length === 0}
          className="rounded bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          Create plan
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading plans…</p>
      ) : (plans ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">No compliance plans yet. Create one above.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Plan</th>
                <th className="px-4 py-2 font-medium">Owner</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Items</th>
                <th className="px-4 py-2 font-medium">Progress</th>
                <th className="px-4 py-2 font-medium">Overdue</th>
              </tr>
            </thead>
            <tbody>
              {(plans ?? []).map((p) => (
                <tr key={p.id} className="border-t border-border hover:bg-secondary/50">
                  <td className="px-4 py-2">
                    <a
                      href={`/compliance/plans/${p.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        open(p.id);
                      }}
                      className="font-medium text-sidebar-primary hover:underline"
                    >
                      {p.name}
                    </a>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{p.owner?.name ?? "—"}</td>
                  <td className="px-4 py-2">
                    <span className="rounded bg-secondary px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{p.itemCount}</td>
                  <td className="px-4 py-2 text-muted-foreground">{p.progressPct}%</td>
                  <td className={`px-4 py-2 ${p.overdueCount > 0 ? "font-semibold text-destructive" : "text-muted-foreground"}`}>
                    {p.overdueCount}
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
