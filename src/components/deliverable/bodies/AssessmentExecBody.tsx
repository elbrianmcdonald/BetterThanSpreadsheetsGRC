"use client";

/**
 * Generic Executive Summary body for the non-Risk assessment kinds
 * (Compliance, Maturity, Vendor, BIA).
 *
 * Renders the cross-cutting sections (editable statement, matrix risk heatmap,
 * findings register, action plans, exploitation pathway, people interviewed)
 * MERGED with the type's native section nodes (passed in via `nativeContent`),
 * laid out in the assessment's configured order and visibility (the Customize
 * dialog). Statement + layout persist via the polymorphic `deliverable`
 * mutations. Must mount inside a FindingDrawerProvider.
 *
 * Risk keeps its own richer body (RiskExecutiveBody); this powers the other four.
 */

import { useState, type ReactNode } from "react";
import { Loader2, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DeliverableSection } from "../DeliverableSection";
import { useFindingDrawer } from "../FindingDrawerProvider";
import { MatrixHeatmap } from "../MatrixHeatmap";
import { MatrixSeverityBadge } from "../MatrixSeverityBadge";
import { ActionCard } from "../ActionCard";
import { ExecSummaryLayoutDialog } from "../ExecSummaryLayoutDialog";
import {
  EXEC_SECTION_LABELS,
  type ExecSectionConfig,
  type ExecSectionKey,
} from "../execSummaryLayout";
import { ExploitationPathwayView } from "@/components/pathway/ExploitationPathwayView";
import type { PathwayLike } from "@/components/pathway/types";
import type { AssessmentKind } from "@/components/engagement/types";
import type { ExecMatrix, ExecFinding } from "@/server/services/deliverableExecShared";

export function AssessmentExecBody({
  assessmentKind,
  assessmentId,
  canEdit,
  executiveStatement,
  layout,
  matrix,
  rows,
  nativeContent,
}: {
  assessmentKind: AssessmentKind;
  assessmentId: string;
  canEdit: boolean;
  executiveStatement: string | null;
  layout: ExecSectionConfig[];
  matrix: ExecMatrix | null;
  rows: ExecFinding[];
  /** Type-native section nodes keyed by section key (controls, gaps, domains…). */
  nativeContent: Partial<Record<ExecSectionKey, ReactNode>>;
}) {
  const { openFinding } = useFindingDrawer();
  const [layoutOpen, setLayoutOpen] = useState(false);
  const utils = api.useUtils();

  const actionsQuery = api.actionPlan.listForAssessment.useQuery({ assessmentKind, assessmentId });
  const pathwaysQuery = api.pathway.listByAssessment.useQuery({ assessmentKind, assessmentId });
  const engagementQuery = api.engagement.getByAssessment.useQuery({ assessmentKind, assessmentId });

  const layoutMutation = api.deliverable.updateExecSummaryLayout.useMutation({
    onSuccess: async () => {
      await utils.deliverable.invalidate();
      setLayoutOpen(false);
      toast.success("Section layout updated");
    },
    onError: (err) => toast.error(err.message || "Failed to update layout"),
  });

  const actions = actionsQuery.data ?? [];
  const pathways = (pathwaysQuery.data ?? []) as unknown as PathwayLike[];
  const engagement = engagementQuery.data ?? null;

  const crossCutting: Partial<Record<ExecSectionKey, ReactNode>> = {
    statement: (
      <ExecutiveStatementBlock
        assessmentKind={assessmentKind}
        assessmentId={assessmentId}
        statement={executiveStatement}
        canEdit={canEdit}
      />
    ),
    heatmap: matrix ? (
      <div className="rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
        <p className="eyebrow mb-3" style={{ color: "var(--muted-foreground)" }}>
          Risk heatmap — {matrix.name}
        </p>
        <MatrixHeatmap matrix={matrix} rows={rows} />
      </div>
    ) : (
      <EmptyState>No risk matrix is configured, so a heatmap can’t be drawn.</EmptyState>
    ),
    findings: <FindingsRegister rows={rows} onOpen={openFinding} />,
    actionPlans: actionsQuery.isLoading ? (
      <SectionLoading />
    ) : actions.length === 0 ? (
      <EmptyState>No remediation initiatives have been planned yet.</EmptyState>
    ) : (
      <div className="flex flex-col gap-3">
        {actions.map((a) => (
          <ActionCard key={a.id} action={a} />
        ))}
      </div>
    ),
    pathway: pathwaysQuery.isLoading ? (
      <SectionLoading />
    ) : pathways.length === 0 ? (
      <ExploitationPathwayView pathway={null} />
    ) : (
      <div className="flex flex-col gap-8">
        {pathways.map((p) => (
          <ExploitationPathwayView
            key={p.id}
            pathway={p}
            editable={canEdit}
            assessmentKind={assessmentKind}
            assessmentId={assessmentId}
            onChanged={() =>
              void utils.pathway.listByAssessment.invalidate({ assessmentKind, assessmentId })
            }
          />
        ))}
      </div>
    ),
    interviewees: engagementQuery.isLoading ? <SectionLoading /> : <Interviewees engagement={engagement} />,
  };

  const content: Partial<Record<ExecSectionKey, ReactNode>> = { ...crossCutting, ...nativeContent };
  const visible = layout.filter((c) => c.enabled && content[c.key] !== undefined);

  return (
    <>
      {canEdit ? (
        <div className="mb-2 flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setLayoutOpen(true)}>
            <SlidersHorizontal className="size-4" />
            Customize sections
          </Button>
        </div>
      ) : null}

      {visible.map((cfg, i) => (
        <DeliverableSection
          key={cfg.key}
          n={String(i + 1).padStart(2, "0")}
          title={EXEC_SECTION_LABELS[cfg.key]}
        >
          {content[cfg.key]}
        </DeliverableSection>
      ))}

      {visible.length === 0 ? (
        <EmptyState>All sections are hidden. Use “Customize sections” to add some back.</EmptyState>
      ) : null}

      {canEdit ? (
        <ExecSummaryLayoutDialog
          open={layoutOpen}
          onOpenChange={setLayoutOpen}
          layout={layout}
          saving={layoutMutation.isPending}
          onSave={(next) => layoutMutation.mutate({ assessmentKind, id: assessmentId, layout: next })}
        />
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Cross-cutting section pieces
// ---------------------------------------------------------------------------

function ExecutiveStatementBlock({
  assessmentKind,
  assessmentId,
  statement,
  canEdit,
}: {
  assessmentKind: AssessmentKind;
  assessmentId: string;
  statement: string | null;
  canEdit: boolean;
}) {
  const utils = api.useUtils();
  const [draft, setDraft] = useState(statement ?? "");
  const mutation = api.deliverable.updateExecutiveStatement.useMutation({
    onSuccess: async () => {
      await utils.deliverable.invalidate();
      toast.success("Executive statement saved");
    },
    onError: (err) => toast.error(err.message || "Failed to save executive statement"),
  });

  if (!canEdit) {
    if (!statement?.trim()) {
      return (
        <p className="text-sm text-muted-foreground">
          No executive statement has been provided for this assessment.
        </p>
      );
    }
    return <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{statement}</p>;
  }

  const dirty = draft !== (statement ?? "");
  return (
    <div className="flex flex-col gap-3">
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={8}
        maxLength={10000}
        placeholder="Summarize the engagement's outcome for leadership: posture, top exposures, and the headline recommendation."
        className="min-h-[160px] resize-y"
      />
      <div className="flex items-center justify-end gap-3">
        <span className="text-xs text-muted-foreground">{draft.length} / 10,000</span>
        <Button
          size="sm"
          disabled={!dirty || mutation.isPending}
          onClick={() => mutation.mutate({ assessmentKind, id: assessmentId, executiveStatement: draft })}
        >
          {mutation.isPending ? "Saving…" : "Save statement"}
        </Button>
      </div>
    </div>
  );
}

function FindingsRegister({ rows, onOpen }: { rows: ExecFinding[]; onOpen: (row: ExecFinding) => void }) {
  if (rows.length === 0) {
    return <EmptyState>No findings have been recorded in this assessment.</EmptyState>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-left">
            {["ID", "Finding", "Domain", "L×I", "Severity"].map((h) => (
              <th key={h} className="eyebrow border-b pb-2 pr-4 font-normal" style={{ borderColor: "var(--border)" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => onOpen(row)}
              className="group border-b transition-colors hover:bg-muted"
              style={{ cursor: "pointer", borderColor: "var(--border)" }}
            >
              <td className="py-3 pr-4 align-top">
                <IdTag>{row.identifier}</IdTag>
              </td>
              <td className="py-3 pr-4 align-top">
                <div className="font-medium text-foreground">{row.title}</div>
                {row.asset ? (
                  <div className="mt-0.5 font-mono text-xs text-muted-foreground">{row.asset}</div>
                ) : null}
              </td>
              <td className="py-3 pr-4 align-top text-muted-foreground">{row.domain ?? "—"}</td>
              <td className="py-3 pr-4 align-top font-mono tabular-nums text-foreground">
                {row.scored ? `${row.likelihood}×${row.impact}` : "—"}
              </td>
              <td className="py-3 align-top">
                <MatrixSeverityBadge label={row.severityLabel} color={row.severityColor} size="sm" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface InterviewStakeholder {
  id: string;
  name: string;
  role: string | null;
  domain: string | null;
  raci: string | null;
}
interface InterviewEngagement {
  stakeholders: InterviewStakeholder[];
  sessions: { id: string; attendees: string[] }[];
}

const RACI_LABEL: Record<string, string> = {
  R: "Responsible",
  A: "Accountable",
  C: "Consulted",
  I: "Informed",
};

function Interviewees({ engagement }: { engagement: InterviewEngagement | null }) {
  const stakeholders = engagement?.stakeholders ?? [];
  const known = new Set(stakeholders.map((s) => s.name.trim().toLowerCase()));
  const extraAttendees: string[] = [];
  for (const sess of engagement?.sessions ?? []) {
    for (const a of sess.attendees) {
      const name = a.trim();
      if (name && !known.has(name.toLowerCase()) && !extraAttendees.includes(name)) extraAttendees.push(name);
    }
  }
  if (stakeholders.length === 0 && extraAttendees.length === 0) {
    return <EmptyState>No interviewees or stakeholders have been recorded for this assessment.</EmptyState>;
  }
  return (
    <div className="flex flex-col gap-5">
      {stakeholders.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left">
                {["Name", "Role", "Domain", "RACI"].map((h) => (
                  <th key={h} className="eyebrow border-b pb-2 pr-4 font-normal" style={{ borderColor: "var(--border)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stakeholders.map((s) => (
                <tr key={s.id} className="border-b" style={{ borderColor: "var(--border)" }}>
                  <td className="py-3 pr-4 align-top font-medium text-foreground">{s.name}</td>
                  <td className="py-3 pr-4 align-top text-muted-foreground">{s.role ?? "—"}</td>
                  <td className="py-3 pr-4 align-top text-muted-foreground">{s.domain ?? "—"}</td>
                  <td className="py-3 align-top text-muted-foreground">
                    {s.raci ? (RACI_LABEL[s.raci] ?? s.raci) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {extraAttendees.length > 0 ? (
        <div>
          <p className="eyebrow mb-2" style={{ color: "var(--muted-foreground)" }}>
            Additional session attendees
          </p>
          <div className="flex flex-wrap gap-2">
            {extraAttendees.map((name) => (
              <span
                key={name}
                className="rounded-full border px-2.5 py-1 text-xs text-foreground"
                style={{ borderColor: "var(--border)" }}
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SectionLoading() {
  return (
    <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      Loading…
    </div>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div
      className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground"
      style={{ borderColor: "var(--border)" }}
    >
      {children}
    </div>
  );
}

function IdTag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block whitespace-nowrap rounded-md border bg-muted px-2 py-1 font-mono text-xs text-foreground">
      {children}
    </span>
  );
}
