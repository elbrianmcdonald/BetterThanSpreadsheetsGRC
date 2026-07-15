"use client";

/**
 * Epic 19 — shared inline "Add step" authoring form for exploitation pathways.
 *
 * Relocated out of `EngagementPathways.tsx` so BOTH the tab panel and the rich
 * `ExploitationPathwayView` can render it without a circular dependency:
 *   EngagementPathways → ExploitationPathwayView → AddStepForm (imports neither).
 *
 * MULTI-MEMBER PICKER: a step may reference MANY findings AND risks. Both lists
 * are scoped to THIS assessment (`api.finding.listForAssessment` /
 * `api.risk.listForAssessment`) — only items raised within the assessment are
 * selectable, not the org register. The user adds findings/risks to a chip list,
 * requires ≥1, picks a MITRE ATT&CK technique (`MitreTechniquePicker` →
 * tactic/technique/mitreTid), an optional note, then `pathway.addStep` with
 * `findingIds` + `riskIds` arrays.
 */

import { useEffect, useState } from "react";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ChevronsUpDown, Loader2, Search, X } from "lucide-react";
import { MitreTechniquePicker } from "@/components/risk/MitreTechniquePicker";
import type { AssessmentKind } from "@/components/engagement/types";

/** Debounce a rapidly-changing value (search box → server query). */
function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/** Case-insensitive match on identifier or title (client-side filter). */
function matchesSearch(it: { identifier: string | null; title: string }, q: string) {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return (it.identifier ?? "").toLowerCase().includes(s) || it.title.toLowerCase().includes(s);
}

interface MemberOption {
  id: string;
  identifier: string | null;
  title: string;
}

/** Searchable single-add combobox for findings/risks (scales past a dropdown). */
function MemberSearchPicker({
  label,
  placeholder,
  items,
  loading,
  search,
  onSearchChange,
  isItemPicked,
  onPick,
}: {
  label: string;
  placeholder: string;
  items: MemberOption[];
  loading: boolean;
  search: string;
  onSearchChange: (s: string) => void;
  isItemPicked: (id: string) => boolean;
  onPick: (item: MemberOption) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal text-muted-foreground"
          >
            {placeholder}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] min-w-[16rem] p-0"
          align="start"
        >
          <Command shouldFilter={false}>
            <CommandInput placeholder="Search by id or title…" value={search} onValueChange={onSearchChange} />
            <CommandList>
              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : items.length === 0 ? (
                <CommandEmpty>No matches.</CommandEmpty>
              ) : (
                <CommandGroup>
                  {items.map((it) => (
                    <CommandItem
                      key={it.id}
                      value={it.id}
                      disabled={isItemPicked(it.id)}
                      onSelect={() => {
                        onPick(it);
                        onSearchChange("");
                        setOpen(false);
                      }}
                    >
                      <span className="mr-2 font-mono text-xs text-muted-foreground">
                        {it.identifier ?? "—"}
                      </span>
                      <span className="truncate">{it.title}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export type MemberKind = "finding" | "risk";

/** Badge variant map for a member's categorical severity. */
export const SEVERITY_VARIANT: Record<
  string,
  "default" | "secondary" | "outline"
> = {
  CRITICAL: "default",
  HIGH: "default",
  MEDIUM: "secondary",
  LOW: "outline",
};

/** A picked member shown as a chip (kind + id + display label). */
interface PickedMember {
  kind: MemberKind;
  id: string;
  identifier: string | null;
  title: string;
}

export function AddStepForm({
  pathwayId,
  assessmentKind,
  assessmentId,
  onDone,
  onCancel,
}: {
  pathwayId: string;
  /** When absent (a master-library pathway with no assessment), findings/risks
   * are drawn from the org-wide registers instead of one assessment. */
  assessmentKind?: AssessmentKind;
  assessmentId?: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [picked, setPicked] = useState<PickedMember[]>([]);
  const [tactic, setTactic] = useState("");
  const [technique, setTechnique] = useState("");
  const [mitreTid, setMitreTid] = useState("");
  const [note, setNote] = useState("");
  const [mitrePickerOpen, setMitrePickerOpen] = useState(false);

  const hasAssessment = Boolean(assessmentKind && assessmentId);

  // Searchable pickers: server-side search for the org-wide register (scales
  // past the 100-row page), client-side filter for the bounded assessment list.
  const [findingSearch, setFindingSearch] = useState("");
  const [riskSearch, setRiskSearch] = useState("");
  const debouncedFindingSearch = useDebounced(findingSearch, 250);
  const debouncedRiskSearch = useDebounced(riskSearch, 250);

  // Findings: scoped to THIS assessment when in one, else the org-wide register.
  const scopedFindings = api.finding.listForAssessment.useQuery(
    { assessmentId: assessmentId ?? "", assessmentType: assessmentKind ?? "COMPLIANCE" },
    { enabled: hasAssessment },
  );
  const orgFindings = api.finding.list.useQuery(
    { limit: 100, search: debouncedFindingSearch.trim() || undefined },
    { enabled: !hasAssessment },
  );
  const findingItems: MemberOption[] = (
    hasAssessment ? scopedFindings.data ?? [] : orgFindings.data?.items ?? []
  ).map((f) => ({ id: f.id, identifier: f.identifier, title: f.title }));
  // Org list is already server-filtered; the scoped list filters client-side.
  const findings = hasAssessment
    ? findingItems.filter((f) => matchesSearch(f, findingSearch))
    : findingItems;
  const findingsLoading = hasAssessment ? scopedFindings.isLoading : orgFindings.isLoading;

  // Risks: scoped to THIS assessment when in one, else the org-wide register.
  const scopedRisks = api.risk.listForAssessment.useQuery(
    { assessmentId: assessmentId ?? "", assessmentType: assessmentKind ?? "COMPLIANCE" },
    { enabled: hasAssessment },
  );
  const orgRisks = api.risk.list.useQuery(
    { pageSize: 100, search: debouncedRiskSearch.trim() || undefined },
    { enabled: !hasAssessment },
  );
  const riskItems: MemberOption[] = (
    hasAssessment ? scopedRisks.data ?? [] : orgRisks.data?.risks ?? []
  ).map((r) => ({ id: r.id, identifier: r.identifier, title: r.title }));
  const risks = hasAssessment
    ? riskItems.filter((r) => matchesSearch(r, riskSearch))
    : riskItems;
  const risksLoading = hasAssessment ? scopedRisks.isLoading : orgRisks.isLoading;

  const addStep = api.pathway.addStep.useMutation({ onSuccess: onDone });

  function isPicked(kind: MemberKind, id: string) {
    return picked.some((m) => m.kind === kind && m.id === id);
  }

  function addMember(member: PickedMember) {
    if (isPicked(member.kind, member.id)) return;
    setPicked((prev) => [...prev, member]);
  }

  function removeMember(kind: MemberKind, id: string) {
    setPicked((prev) => prev.filter((m) => !(m.kind === kind && m.id === id)));
  }

  // A step needs ≥1 member and a MITRE technique selected.
  const canSubmit = picked.length > 0 && technique.trim().length > 0;

  function submit() {
    if (!canSubmit) return;
    addStep.mutate({
      pathwayId,
      tactic: tactic.trim() || "Unspecified",
      technique: technique.trim(),
      mitreTid: mitreTid.trim() || undefined,
      note: note.trim() || undefined,
      findingIds: picked.filter((m) => m.kind === "finding").map((m) => m.id),
      riskIds: picked.filter((m) => m.kind === "risk").map((m) => m.id),
    });
  }

  return (
    <div className="mt-3 space-y-3 rounded-md border bg-muted/30 p-3">
      {/* Finding picker (searchable). */}
      <MemberSearchPicker
        label="Add finding"
        placeholder="Search findings…"
        items={findings}
        loading={findingsLoading}
        search={findingSearch}
        onSearchChange={setFindingSearch}
        isItemPicked={(id) => isPicked("finding", id)}
        onPick={(f) => addMember({ kind: "finding", id: f.id, identifier: f.identifier, title: f.title })}
      />

      {/* Risk picker (searchable) — a step may also reference risks directly. */}
      <MemberSearchPicker
        label="Add risk"
        placeholder="Search risks…"
        items={risks}
        loading={risksLoading}
        search={riskSearch}
        onSearchChange={setRiskSearch}
        isItemPicked={(id) => isPicked("risk", id)}
        onPick={(r) => addMember({ kind: "risk", id: r.id, identifier: r.identifier, title: r.title })}
      />

      {/* Picked-member chip list (source of truth for what gets submitted). */}
      <div className="space-y-1.5">
        <Label>
          Linked findings &amp; risks <span className="text-destructive">*</span>
        </Label>
        {picked.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Add at least one finding or risk to this step.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {picked.map((m) => (
              <span
                key={`${m.kind}:${m.id}`}
                className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--muted)",
                }}
              >
                <span className="font-mono" style={{ color: "var(--muted-foreground)" }}>
                  {m.identifier ?? m.kind.toUpperCase()}
                </span>
                <span className="max-w-[160px] truncate" style={{ color: "var(--foreground)" }}>
                  {m.title}
                </span>
                <button
                  type="button"
                  onClick={() => removeMember(m.kind, m.id)}
                  className="ml-0.5 rounded-sm p-0.5 transition-colors hover:bg-[var(--background)]"
                  aria-label={`Remove ${m.identifier ?? m.title}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* MITRE technique */}
      <div className="space-y-1.5">
        <Label>
          MITRE ATT&CK technique <span className="text-destructive">*</span>
        </Label>
        {technique ? (
          <div className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-sm">
            <span className="flex flex-wrap items-center gap-2">
              {mitreTid ? (
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                  {mitreTid}
                </span>
              ) : null}
              <span className="font-medium">{technique}</span>
              {tactic ? <span className="text-muted-foreground">· {tactic}</span> : null}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setMitrePickerOpen(true)}>
              Change
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={() => setMitrePickerOpen(true)}
          >
            <Search className="mr-2 h-4 w-4" />
            Search MITRE ATT&CK…
          </Button>
        )}
      </div>

      <MitreTechniquePicker
        open={mitrePickerOpen}
        onOpenChange={setMitrePickerOpen}
        onSelect={(t) => {
          setTechnique(t.name);
          setMitreTid(t.externalId);
          setTactic(t.tactics?.[0]?.name ?? "");
        }}
      />

      <div className="space-y-1.5">
        <Label htmlFor="step-note">Note (optional)</Label>
        <Textarea
          id="step-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="min-h-16 text-sm"
          placeholder="How this step compounds the chain…"
        />
      </div>

      {addStep.error ? (
        <p className="text-sm text-destructive">{addStep.error.message}</p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={submit} disabled={!canSubmit || addStep.isPending}>
          {addStep.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Add step
        </Button>
      </div>
    </div>
  );
}
