"use client";

/**
 * Compliance Plan detail board (Bridge to Compliance Plan — Stories 1.3/1.4 UI).
 *
 * Shows a plan's control-anchored items (resolved control, owner, status, target
 * date, evidence needed, notes, acceptance criteria), lets an owner change status
 * inline and remove items, and adds items via the unified control search picker.
 */

import { Fragment, useState } from "react";
import { CompliancePlanItemStatus } from "@prisma/client";
import { toast } from "sonner";
import { Trash2, Plus, Download, FileUp, Save } from "lucide-react";

import { api } from "@/trpc/react";
import { PlanProgressDonut } from "@/components/compliance/PlanProgressDonut";

const STATUSES = Object.values(CompliancePlanItemStatus);

/** Item statuses treated as "done" — mirrors CLOSED_ITEM_STATUSES in the router. */
const CLOSED_ITEM_STATUSES: string[] = ["COMPLETE", "RISK_ACCEPTED"];

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Local, unsaved edits for a single item — persisted only when Save is clicked. */
type ItemDraft = Partial<{
  ownerId: string;
  status: string;
  targetDate: string; // yyyy-mm-dd
  evidenceNeeded: string;
  acceptanceCriteria: string;
}>;

export function CompliancePlanDetail({ planId }: { planId: string }) {
  const utils = api.useUtils();
  const { data: plan, isLoading } = api.compliancePlan.get.useQuery({ id: planId });

  const [search, setSearch] = useState("");
  const { data: searchResults } = api.compliancePlan.searchControls.useQuery(
    { query: search },
    { enabled: search.trim().length > 0 },
  );

  const addItem = api.compliancePlan.addItem.useMutation();
  const updateItem = api.compliancePlan.updateItem.useMutation();
  const removeItem = api.compliancePlan.removeItem.useMutation();
  const raiseRequest = api.compliancePlan.raiseEvidenceRequest.useMutation();
  const { data: orgUsers } = api.compliancePlan.listOrgUsers.useQuery();
  const { data: people } = api.compliancePlan.listPeople.useQuery();

  const [requestingItemId, setRequestingItemId] = useState<string | null>(null);
  const [reqRecipient, setReqRecipient] = useState("");
  const [reqInstructions, setReqInstructions] = useState("");

  const refresh = () => utils.compliancePlan.get.invalidate({ id: planId });

  const handleRaiseRequest = async (itemId: string) => {
    if (!reqRecipient || !reqInstructions.trim()) return;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    try {
      await raiseRequest.mutateAsync({ itemId, recipientUserId: reqRecipient, dueDate, instructions: reqInstructions.trim() });
      setRequestingItemId(null);
      setReqRecipient("");
      setReqInstructions("");
      toast.success("Evidence request sent");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send request");
    }
  };

  const handleAdd = async (kind: string, controlId: string) => {
    try {
      await addItem.mutateAsync({ planId, controlKind: kind as never, controlId });
      setSearch("");
      await refresh();
      toast.success("Control added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add control");
    }
  };

  // Per-item draft edits; persisted only when the row's Save button is clicked.
  const [drafts, setDrafts] = useState<Record<string, ItemDraft>>({});

  const setField = (id: string, field: keyof ItemDraft, value: string) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));

  // Items with unsaved edits.
  const dirtyIds = Object.keys(drafts).filter((id) => Object.keys(drafts[id] ?? {}).length > 0);

  const buildItemData = (d: ItemDraft) => {
    const data: {
      ownerId?: string | null;
      status?: CompliancePlanItemStatus;
      targetDate?: Date | null;
      evidenceNeeded?: string;
      acceptanceCriteria?: string;
    } = {};
    if (d.ownerId !== undefined) data.ownerId = d.ownerId || null;
    if (d.status !== undefined) data.status = d.status as CompliancePlanItemStatus;
    if (d.targetDate !== undefined) data.targetDate = d.targetDate ? new Date(d.targetDate) : null;
    if (d.evidenceNeeded !== undefined) data.evidenceNeeded = d.evidenceNeeded;
    if (d.acceptanceCriteria !== undefined) data.acceptanceCriteria = d.acceptanceCriteria;
    return data;
  };

  // One plan-level Save: persist every item that has unsaved edits.
  const handleSaveAll = async () => {
    if (dirtyIds.length === 0) return;
    try {
      for (const id of dirtyIds) {
        await updateItem.mutateAsync({ id, ...buildItemData(drafts[id]!) });
      }
      setDrafts({});
      await refresh();
      toast.success(`Saved ${dirtyIds.length} item${dirtyIds.length === 1 ? "" : "s"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save changes");
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await removeItem.mutateAsync({ id });
      await refresh();
      toast.success("Item removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove item");
    }
  };

  const handleExport = async () => {
    try {
      const res = await utils.compliancePlan.exportPlan.fetch({ id: planId });
      downloadCsv(res.filename, res.content);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not export");
    }
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading plan…</p>;
  if (!plan) return <p className="text-sm text-muted-foreground">Plan not found.</p>;

  // Partition every item into exactly one donut bucket:
  //  complete   = closed status (COMPLETE / RISK_ACCEPTED)
  //  overdue    = not complete AND past target date
  //  notComplete = everything else still open
  const completeCount = plan.items.filter((i) => CLOSED_ITEM_STATUSES.includes(i.status)).length;
  const overdueSlice = plan.items.filter(
    (i) => !CLOSED_ITEM_STATUSES.includes(i.status) && i.overdue,
  ).length;
  const notCompleteCount = plan.items.length - completeCount - overdueSlice;

  return (
    <div className="space-y-6">
      {/* Progress summary + donut + export */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-6">
          {/* Item breakdown donut */}
          <div className="w-[240px] shrink-0">
            <PlanProgressDonut
              complete={completeCount}
              notComplete={notCompleteCount}
              overdue={overdueSlice}
            />
          </div>
          <div className="flex items-center gap-4">
            <div>
              <div className="text-2xl font-bold tnum text-foreground">{plan.progressPct}%</div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Complete</div>
            </div>
            <div className="h-10 w-px bg-border" />
            <div>
              <div className={`text-2xl font-bold tnum ${plan.overdueCount > 0 ? "text-destructive" : "text-foreground"}`}>
                {plan.overdueCount}
              </div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {plan.overdueCount === 1 ? "1 overdue" : `${plan.overdueCount} overdue`}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleSaveAll()}
            disabled={dirtyIds.length === 0 || updateItem.isPending}
            className="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            <Save className="h-4 w-4" />
            Save changes{dirtyIds.length > 0 ? ` (${dirtyIds.length})` : ""}
          </button>
          <button
            type="button"
            onClick={() => void handleExport()}
            className="inline-flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-secondary"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Add control */}
      <div className="rounded-lg border border-border bg-card p-4">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Add a control
          <input
            aria-label="Search controls"
            value={search}
            placeholder="Search framework, standard, org, or maturity controls…"
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md rounded border border-input bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </label>
        {search.trim().length > 0 && (
          <ul className="mt-2 max-h-56 divide-y divide-border overflow-y-auto rounded border border-border">
            {(searchResults ?? []).length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">No matching controls</li>
            ) : (
              (searchResults ?? []).map((r) => (
                <li key={`${r.kind}:${r.controlId}`} className="flex items-center justify-between gap-2 px-3 py-1.5">
                  <span className="min-w-0 truncate text-sm">
                    <span className="font-mono text-xs text-muted-foreground">{r.identifier}</span> — {r.title}
                    <span className="ml-2 rounded bg-secondary px-1 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {r.kind.replace("_CONTROL", "").replace("_", " ").toLowerCase()}
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label={`Add ${r.identifier}`}
                    onClick={() => void handleAdd(r.kind, r.controlId)}
                    className="inline-flex shrink-0 items-center gap-1 rounded bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground"
                  >
                    <Plus className="h-3 w-3" />
                    Add
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      {/* Items */}
      {plan.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No controls in this plan yet. Search above to add one.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Control</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Owner</th>
                <th className="px-3 py-2 font-medium">Target</th>
                <th className="px-3 py-2 font-medium">Evidence needed</th>
                <th className="px-3 py-2 font-medium">Acceptance criteria</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {plan.items.map((item) => {
                const label = item.control?.identifier ?? "removed";
                return (
                  <Fragment key={item.id}>
                    <tr className={`border-t border-border align-top ${item.overdue ? "bg-destructive/5" : ""}`}>
                      <td className="px-3 py-2">
                        {item.control ? (
                          <>
                            <div className="font-mono text-xs text-muted-foreground">{item.control.identifier}</div>
                            <div className="font-medium text-foreground">{item.control.title}</div>
                          </>
                        ) : (
                          <span className="italic text-muted-foreground">Control removed</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          aria-label={`Status for ${label}`}
                          value={drafts[item.id]?.status ?? item.status}
                          onChange={(e) => setField(item.id, "status", e.target.value)}
                          className="rounded border border-input bg-background px-1.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s.replace("_", " ")}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          aria-label={`Owner for ${label}`}
                          value={drafts[item.id]?.ownerId ?? item.ownerId ?? ""}
                          onChange={(e) => setField(item.id, "ownerId", e.target.value)}
                          className="rounded border border-input bg-background px-1.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          <option value="">Unassigned</option>
                          {(people ?? []).map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="date"
                          aria-label={`Target date for ${label}`}
                          value={
                            drafts[item.id]?.targetDate ??
                            (item.targetDate ? new Date(item.targetDate).toISOString().slice(0, 10) : "")
                          }
                          onChange={(e) => setField(item.id, "targetDate", e.target.value)}
                          className="rounded border border-input bg-background px-1.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <textarea
                          aria-label={`Evidence needed for ${label}`}
                          value={drafts[item.id]?.evidenceNeeded ?? item.evidenceNeeded ?? ""}
                          rows={2}
                          placeholder="Evidence to collect…"
                          onChange={(e) => setField(item.id, "evidenceNeeded", e.target.value)}
                          className="w-full min-w-[9rem] resize-y rounded border border-input bg-background px-1.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                        {item.linkedEvidence.length > 0 && (
                          <ul className="mt-1 space-y-0.5">
                            {item.linkedEvidence.map((e) => (
                              <li key={e.id} className="text-[11px] text-sidebar-primary">
                                📎 <span>{e.title}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <textarea
                          aria-label={`Acceptance criteria for ${label}`}
                          value={drafts[item.id]?.acceptanceCriteria ?? item.acceptanceCriteria ?? ""}
                          rows={2}
                          placeholder="Acceptance criteria…"
                          onChange={(e) => setField(item.id, "acceptanceCriteria", e.target.value)}
                          className="w-full min-w-[9rem] resize-y rounded border border-input bg-background px-1.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <button
                            type="button"
                            aria-label={`Request evidence for ${label}`}
                            onClick={() => setRequestingItemId(requestingItemId === item.id ? null : item.id)}
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                          >
                            <FileUp className="h-3.5 w-3.5" />
                            Request evidence
                          </button>
                          <button
                            type="button"
                            aria-label={`Remove item ${label}`}
                            onClick={() => void handleRemove(item.id)}
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                    {requestingItemId === item.id && (
                      <tr className="bg-sidebar-accent/30">
                        <td colSpan={7} className="px-3 py-3">
                          <div className="flex flex-wrap items-end gap-2">
                            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                              Recipient
                              <select
                                aria-label="Recipient"
                                value={reqRecipient}
                                onChange={(e) => setReqRecipient(e.target.value)}
                                className="w-52 rounded border border-input bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                              >
                                <option value="">Select a user…</option>
                                {(orgUsers ?? []).map((u) => (
                                  <option key={u.id} value={u.id}>
                                    {u.name ?? u.email}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-muted-foreground">
                              Instructions
                              <input
                                aria-label="Instructions"
                                value={reqInstructions}
                                placeholder="What evidence to collect…"
                                onChange={(e) => setReqInstructions(e.target.value)}
                                className="w-full rounded border border-input bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => void handleRaiseRequest(item.id)}
                              disabled={raiseRequest.isPending || !reqRecipient || reqInstructions.trim() === ""}
                              className="rounded bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                            >
                              Send request
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
