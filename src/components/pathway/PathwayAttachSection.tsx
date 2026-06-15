"use client";

/**
 * Epic 19 — creation-time exploitation-pathway attachment.
 *
 * Shared by CreateFindingForm and CreateRiskForm. Lets the author flag a new
 * finding/risk as "part of an exploitation pathway" at creation time. Because
 * pathways are scoped to ONE assessment (and a step needs a MITRE tactic +
 * technique), the section collects:
 *   1. which assessment the pathway lives in (cross-kind picker),
 *   2. an existing pathway in that assessment OR a new pathway name,
 *   3. the MITRE ATT&CK technique for the step this member is added to.
 *
 * It owns no submission logic — it reports its state up via `onChange`. The
 * parent form, after the finding/risk is created, orchestrates
 * `pathway.create` (when new) + `pathway.addStep` with the new id. The
 * `pathway.addStep` mutation is what sets `Finding.isToxic` / `Risk.isToxic`,
 * which in turn drives the ⬡ ToxicMark indicator in the registers.
 */

import { useEffect, useState } from "react";
import { AssessmentKind } from "@prisma/client";
import { Search } from "lucide-react";

import { api } from "@/trpc/react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { MitreTechniquePicker } from "@/components/risk/MitreTechniquePicker";

/** The completed attachment intent the parent form acts on after create. */
export interface PathwayAttachValue {
  assessmentKind: AssessmentKind;
  assessmentId: string;
  /** Existing pathway to add the new member to. */
  pathwayId?: string;
  /** Name for a brand-new pathway (mutually exclusive with pathwayId). */
  newPathwayName?: string;
  tactic: string;
  technique: string;
  mitreTid?: string;
}

/** What the section reports to its parent on every change. */
export interface PathwayAttachState {
  /** The "part of an exploitation pathway" checkbox. */
  enabled: boolean;
  /** A fully-valid attachment, or null when enabled-but-incomplete. */
  value: PathwayAttachValue | null;
}

const NEW_PATHWAY = "__new__";

export function PathwayAttachSection({
  onChange,
}: {
  onChange: (state: PathwayAttachState) => void;
}) {
  const [enabled, setEnabled] = useState(false);
  // Cross-kind assessment selection encoded as `${kind}:${id}`.
  const [assessmentKey, setAssessmentKey] = useState("");
  const [pathwayChoice, setPathwayChoice] = useState(""); // pathway id or NEW_PATHWAY
  const [newPathwayName, setNewPathwayName] = useState("");
  const [tactic, setTactic] = useState("");
  const [technique, setTechnique] = useState("");
  const [mitreTid, setMitreTid] = useState("");
  const [mitrePickerOpen, setMitrePickerOpen] = useState(false);

  const assessmentsQuery = api.pathway.listAssessments.useQuery(undefined, {
    enabled,
  });
  const assessments = assessmentsQuery.data ?? [];

  const [assessmentKind, assessmentId] = assessmentKey
    ? (assessmentKey.split(/:(.+)/) as [string, string])
    : ["", ""];

  const pathwaysQuery = api.pathway.listByAssessment.useQuery(
    {
      assessmentKind: assessmentKind as AssessmentKind,
      assessmentId: assessmentId ?? "",
    },
    { enabled: enabled && !!assessmentKind && !!assessmentId },
  );
  const pathways = pathwaysQuery.data ?? [];

  // Derive + report the current state to the parent whenever inputs change.
  useEffect(() => {
    if (!enabled) {
      onChange({ enabled: false, value: null });
      return;
    }

    const creatingNew = pathwayChoice === NEW_PATHWAY;
    const complete =
      !!assessmentKind &&
      !!assessmentId &&
      technique.trim().length > 0 &&
      (creatingNew ? newPathwayName.trim().length > 0 : pathwayChoice.length > 0);

    const value: PathwayAttachValue | null = complete
      ? {
          assessmentKind: assessmentKind as AssessmentKind,
          assessmentId: assessmentId!,
          pathwayId: creatingNew ? undefined : pathwayChoice,
          newPathwayName: creatingNew ? newPathwayName.trim() : undefined,
          tactic: tactic.trim() || "Unspecified",
          technique: technique.trim(),
          mitreTid: mitreTid.trim() || undefined,
        }
      : null;

    onChange({ enabled: true, value });
    // onChange identity is owned by the parent; intentionally excluded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    enabled,
    assessmentKey,
    pathwayChoice,
    newPathwayName,
    tactic,
    technique,
    mitreTid,
  ]);

  return (
    <div className="space-y-3 rounded-md border bg-muted/20 p-4">
      <div className="flex items-start gap-2">
        <Checkbox
          id="pathway-attach"
          checked={enabled}
          onCheckedChange={(c) => setEnabled(c === true)}
          className="mt-0.5"
        />
        <div className="space-y-0.5">
          <Label htmlFor="pathway-attach" className="cursor-pointer">
            Part of an exploitation pathway
          </Label>
          <p className="text-xs text-muted-foreground">
            Add this to an attack chain so it&apos;s flagged with{" "}
            <span className="font-mono text-destructive">⬡</span> in the register.
          </p>
        </div>
      </div>

      {enabled && (
        <div className="space-y-3 pl-6">
          {/* Assessment (cross-kind) */}
          <div className="space-y-1.5">
            <Label>
              Assessment <span className="text-destructive">*</span>
            </Label>
            <Select
              value={assessmentKey}
              onValueChange={(v) => {
                setAssessmentKey(v);
                setPathwayChoice("");
                setNewPathwayName("");
              }}
              disabled={assessmentsQuery.isLoading}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    assessmentsQuery.isLoading
                      ? "Loading assessments…"
                      : "Select the assessment this pathway belongs to…"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {assessments.length === 0 && !assessmentsQuery.isLoading ? (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    No assessments found.
                  </div>
                ) : (
                  assessments.map((a) => (
                    <SelectItem key={`${a.kind}:${a.id}`} value={`${a.kind}:${a.id}`}>
                      {a.label}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Pathway (existing or new) */}
          {assessmentKey && (
            <div className="space-y-1.5">
              <Label>
                Pathway <span className="text-destructive">*</span>
              </Label>
              <Select
                value={pathwayChoice}
                onValueChange={setPathwayChoice}
                disabled={pathwaysQuery.isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select or create a pathway…" />
                </SelectTrigger>
                <SelectContent>
                  {pathways.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={NEW_PATHWAY}>+ Create new pathway…</SelectItem>
                </SelectContent>
              </Select>
              {pathwayChoice === NEW_PATHWAY && (
                <Input
                  value={newPathwayName}
                  onChange={(e) => setNewPathwayName(e.target.value)}
                  placeholder="New pathway name (e.g. Initial access → domain admin)"
                  maxLength={200}
                />
              )}
            </div>
          )}

          {/* MITRE technique for the step */}
          {assessmentKey && (
            <div className="space-y-1.5">
              <Label>
                MITRE ATT&amp;CK technique <span className="text-destructive">*</span>
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setMitrePickerOpen(true)}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setMitrePickerOpen(true)}
                >
                  <Search className="mr-2 h-4 w-4" />
                  Search MITRE ATT&amp;CK…
                </Button>
              )}
            </div>
          )}

          <MitreTechniquePicker
            open={mitrePickerOpen}
            onOpenChange={setMitrePickerOpen}
            onSelect={(t) => {
              setTechnique(t.name);
              setMitreTid(t.externalId);
              setTactic(t.tactics?.[0]?.name ?? "");
            }}
          />
        </div>
      )}
    </div>
  );
}
