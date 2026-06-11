"use client";

/**
 * Risk Executive Summary body.
 *
 * The ordered, per-assessment consulting deliverable for a RiskAssessmentProject.
 * Rendered below the shell's cover + scorecard (the "Scores"), it lays out the
 * sections in the fixed order the engagement narrative reads:
 *
 *   01 Executive Statement   — editable free-text (author/admin) or read-only prose
 *   02 Graphs                — matrix-driven risk heatmap + effort/impact plot
 *   03 Action Plans          — remediation initiatives (ActionPlanItem → ActionCard)
 *   04 Risks                 — discovered risks register (compact)
 *   05 Exploitation Pathway  — ExploitationPathwayView (defaults to Attack Narrative)
 *   06 Findings              — discovered findings register
 *   07 People Interviewed    — engagement stakeholders + session attendees
 *
 * Severity + the heatmap are driven by the assessment's configured risk matrix
 * (its scales/thresholds/labels/colors), not a fixed 5×5 / 4-tier scale. Project
 * data (statement, scores, matrix, findings, risks) arrives via props from
 * `deliverable.getRiskExecBody`; action plans, pathways, and interviewees are
 * fetched here. Findings/heatmap open the SHARED Finding Drawer, so this body
 * MUST mount inside a FindingDrawerProvider (ExecutiveSummaryTab provides it).
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
import { EffortImpactPlot } from "../EffortImpactPlot";
import { ActionCard } from "../ActionCard";
import { ExecSummaryLayoutDialog } from "../ExecSummaryLayoutDialog";
import {
  EXEC_SECTION_LABELS,
  type ExecSectionConfig,
  type ExecSectionKey,
} from "../execSummaryLayout";
import { ExploitationPathwayView } from "@/components/pathway/ExploitationPathwayView";
import type { PathwayLike } from "@/components/pathway/types";
import type {
  ExecMatrix,
  ExecFinding,
  ExecRiskRow,
} from "@/server/services/deliverableRiskExecData";

/** This body is only ever rendered for the RISK assessment kind. */
const KIND = "RISK" as const;

export function RiskExecutiveBody({
  assessmentId,
  executiveStatement,
  canEdit,
  matrix,
  layout,
  rows,
  risks,
}: {
  assessmentId: string;
  executiveStatement: string | null;
  canEdit: boolean;
  matrix: ExecMatrix | null;
  layout: ExecSectionConfig[];
  rows: ExecFinding[];
  risks: ExecRiskRow[];
}) {
  const { openFinding } = useFindingDrawer();
  const [layoutOpen, setLayoutOpen] = useState(false);

  // Per-assessment sections fetched via their own procedures.
  const actionsQuery = api.actionPlan.listForAssessment.useQuery({
    assessmentKind: KIND,
    assessmentId,
  });
  const pathwaysQuery = api.pathway.listByAssessment.useQuery({
    assessmentKind: KIND,
    assessmentId,
  });
  const engagementQuery = api.engagement.getByAssessment.useQuery({
    assessmentKind: KIND,
    assessmentId,
  });

  const utils = api.useUtils();
  const refetchPathways = () =>
    void utils.pathway.listByAssessment.invalidate({ assessmentKind: KIND, assessmentId });

  const layoutMutation = api.riskAssessmentProject.updateExecSummaryLayout.useMutation({
    onSuccess: async () => {
      await utils.deliverable.getRiskExecBody.invalidate({ id: assessmentId });
      setLayoutOpen(false);
      toast.success("Section layout updated");
    },
    onError: (err) => toast.error(err.message || "Failed to update layout"),
  });

  const actions = actionsQuery.data ?? [];
  const pathways = (pathwaysQuery.data ?? []) as unknown as PathwayLike[];
  const engagement = engagementQuery.data ?? null;

  // One node per section key; rendered in the order/visibility from `layout`.
  const content: Partial<Record<ExecSectionKey, ReactNode>> = {
    statement: (
      <ExecutiveStatementBlock
        assessmentId={assessmentId}
        statement={executiveStatement}
        canEdit={canEdit}
      />
    ),
    graphs: (
      <>
        {matrix ? (
          <div
            className="rounded-xl border p-5"
            style={{ borderColor: "var(--border)", background: "var(--card)" }}
          >
            <p className="eyebrow mb-3" style={{ color: "var(--muted-foreground)" }}>
              Risk heatmap — {matrix.name}
            </p>
            <MatrixHeatmap matrix={matrix} rows={rows} />
          </div>
        ) : (
          <EmptyState>
            No risk matrix is configured for this assessment, so a heatmap can’t be drawn.
          </EmptyState>
        )}
        {actions.length > 0 ? (
          <div
            className="mt-6 rounded-xl border p-4"
            style={{ borderColor: "var(--border)", background: "var(--card)" }}
          >
            <p className="eyebrow mb-3" style={{ color: "var(--muted-foreground)" }}>
              Prioritization — effort vs. risk reduction
            </p>
            <EffortImpactPlot actions={actions} />
          </div>
        ) : null}
      </>
    ),
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
    risks: <RisksTable risks={risks} />,
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
            assessmentKind={KIND}
            assessmentId={assessmentId}
            onChanged={refetchPathways}
          />
        ))}
      </div>
    ),
    findings: <FindingsRegister rows={rows} onOpen={openFinding} />,
    interviewees: engagementQuery.isLoading ? (
      <SectionLoading />
    ) : (
      <Interviewees engagement={engagement} />
    ),
  };

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
        <EmptyState>
          All sections are hidden. Use “Customize sections” to add some back.
        </EmptyState>
      ) : null}

      {canEdit ? (
        <ExecSummaryLayoutDialog
          open={layoutOpen}
          onOpenChange={setLayoutOpen}
          layout={layout}
          saving={layoutMutation.isPending}
          onSave={(next) => layoutMutation.mutate({ id: assessmentId, layout: next })}
        />
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// 01 — Executive statement (editable / read-only)
// ---------------------------------------------------------------------------

function ExecutiveStatementBlock({
  assessmentId,
  statement,
  canEdit,
}: {
  assessmentId: string;
  statement: string | null;
  canEdit: boolean;
}) {
  const utils = api.useUtils();
  const [draft, setDraft] = useState(statement ?? "");
  const mutation = api.riskAssessmentProject.updateExecutiveStatement.useMutation({
    onSuccess: async () => {
      await utils.deliverable.getRiskExecBody.invalidate({ id: assessmentId });
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
    return (
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{statement}</p>
    );
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
          onClick={() => mutation.mutate({ id: assessmentId, executiveStatement: draft })}
        >
          {mutation.isPending ? "Saving…" : "Save statement"}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 04 — Risks register (compact, matrix severity)
// ---------------------------------------------------------------------------

function RisksTable({ risks }: { risks: ExecRiskRow[] }) {
  if (risks.length === 0) {
    return <EmptyState>No risks have been raised in this assessment.</EmptyState>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-left">
            {["ID", "Risk", "L×I", "Score", "Treatment", "Severity"].map((h) => (
              <th
                key={h}
                className="eyebrow border-b pb-2 pr-4 font-normal"
                style={{ borderColor: "var(--border)" }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {risks.map((r) => (
            <tr key={r.id} className="border-b" style={{ borderColor: "var(--border)" }}>
              <td className="py-3 pr-4 align-top">
                <IdTag>{r.identifier ?? "—"}</IdTag>
              </td>
              <td className="py-3 pr-4 align-top">
                <div className="font-medium text-foreground">{r.title}</div>
              </td>
              <td className="py-3 pr-4 align-top font-mono tabular-nums text-muted-foreground">
                {r.likelihood != null && r.impact != null
                  ? `${formatNum(r.likelihood)}×${formatNum(r.impact)}`
                  : "—"}
              </td>
              <td className="py-3 pr-4 align-top font-mono tabular-nums text-foreground">
                {r.score != null ? formatNum(r.score) : "—"}
              </td>
              <td className="py-3 pr-4 align-top text-muted-foreground">
                {r.treatment ? titleCase(r.treatment) : "—"}
              </td>
              <td className="py-3 align-top">
                <MatrixSeverityBadge label={r.severityLabel} color={r.severityColor} size="sm" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 06 — Findings register (matrix severity; ranked by score)
// ---------------------------------------------------------------------------

function FindingsRegister({
  rows,
  onOpen,
}: {
  rows: ExecFinding[];
  onOpen: (row: ExecFinding) => void;
}) {
  if (rows.length === 0) {
    return <EmptyState>No findings have been recorded in this assessment.</EmptyState>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-left">
            {["ID", "Finding", "Domain", "L×I", "Severity"].map((h) => (
              <th
                key={h}
                className="eyebrow border-b pb-2 pr-4 font-normal"
                style={{ borderColor: "var(--border)" }}
              >
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

// ---------------------------------------------------------------------------
// 07 — People interviewed
// ---------------------------------------------------------------------------

interface InterviewStakeholder {
  id: string;
  name: string;
  role: string | null;
  domain: string | null;
  raci: string | null;
}
interface InterviewSession {
  id: string;
  attendees: string[];
}
interface InterviewEngagement {
  stakeholders: InterviewStakeholder[];
  sessions: InterviewSession[];
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
      if (name && !known.has(name.toLowerCase()) && !extraAttendees.includes(name)) {
        extraAttendees.push(name);
      }
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
                  <th
                    key={h}
                    className="eyebrow border-b pb-2 pr-4 font-normal"
                    style={{ borderColor: "var(--border)" }}
                  >
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

// ---------------------------------------------------------------------------
// Small shared bits
// ---------------------------------------------------------------------------

function SectionLoading() {
  return (
    <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      Loading…
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground"
      style={{ borderColor: "var(--border)" }}
    >
      {children}
    </div>
  );
}

function IdTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block whitespace-nowrap rounded-md border bg-muted px-2 py-1 font-mono text-xs text-foreground">
      {children}
    </span>
  );
}

/** Drop a trailing .0000/.0 so integers read cleanly. */
function formatNum(v: number): string {
  return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(2)));
}

/** ENUM_VALUE → "Enum value". */
function titleCase(v: string): string {
  const s = v.replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
