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

import { useState } from "react";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Search, X } from "lucide-react";
import { MitreTechniquePicker } from "@/components/risk/MitreTechniquePicker";
import type { AssessmentKind } from "@/components/engagement/types";

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

  // Findings: scoped to THIS assessment when in one, else the org-wide register.
  const scopedFindings = api.finding.listForAssessment.useQuery(
    { assessmentId: assessmentId ?? "", assessmentType: assessmentKind ?? "COMPLIANCE" },
    { enabled: hasAssessment },
  );
  const orgFindings = api.finding.list.useQuery({ limit: 100 }, { enabled: !hasAssessment });
  const findings = hasAssessment
    ? scopedFindings.data ?? []
    : (orgFindings.data?.items ?? []).map((f) => ({
        id: f.id,
        identifier: f.identifier,
        title: f.title,
      }));
  const findingsLoading = hasAssessment ? scopedFindings.isLoading : orgFindings.isLoading;

  // Risks: scoped to THIS assessment when in one, else the org-wide register.
  const scopedRisks = api.risk.listForAssessment.useQuery(
    { assessmentId: assessmentId ?? "", assessmentType: assessmentKind ?? "COMPLIANCE" },
    { enabled: hasAssessment },
  );
  const orgRisks = api.risk.list.useQuery({ pageSize: 100 }, { enabled: !hasAssessment });
  const risks = hasAssessment
    ? scopedRisks.data ?? []
    : (orgRisks.data?.risks ?? []).map((r) => ({
        id: r.id,
        identifier: r.identifier,
        title: r.title,
      }));
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
      {/* Finding picker — pathways link findings only. */}
      <div className="space-y-1.5">
        <Label>Add finding</Label>
        <Select
          value=""
          onValueChange={(id) => {
            const f = findings.find((x) => x.id === id);
            if (f) addMember({ kind: "finding", id: f.id, identifier: f.identifier, title: f.title });
          }}
          disabled={findingsLoading}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a finding…" />
          </SelectTrigger>
          <SelectContent>
            {findings.map((f) => (
              <SelectItem key={f.id} value={f.id} disabled={isPicked("finding", f.id)}>
                {f.identifier} · {f.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Risk picker — a step may also reference risks directly. */}
      <div className="space-y-1.5">
        <Label>Add risk</Label>
        <Select
          value=""
          onValueChange={(id) => {
            const r = risks.find((x) => x.id === id);
            if (r) addMember({ kind: "risk", id: r.id, identifier: r.identifier, title: r.title });
          }}
          disabled={risksLoading || risks.length === 0}
        >
          <SelectTrigger>
            <SelectValue
              placeholder={risks.length === 0 ? "No risks in this assessment" : "Select a risk…"}
            />
          </SelectTrigger>
          <SelectContent>
            {risks.map((r) => (
              <SelectItem key={r.id} value={r.id} disabled={isPicked("risk", r.id)}>
                {r.identifier} · {r.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
