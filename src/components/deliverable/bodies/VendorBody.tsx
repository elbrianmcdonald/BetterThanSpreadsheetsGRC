"use client";

/**
 * Vendor Assessment Deliverable — body.
 *
 * Presentational only: all data arrives via props (no tRPC). Renders, inside
 * the shared {@link DeliverableSection} primitives:
 *   01 Assessment Summary  — result chips (status, recommendation, risk tier) +
 *      a narrative summary block.
 *   02 Findings            — the spawned-findings register; rows open the SHARED
 *      Finding Drawer (this body owns NO drawer).
 *   03 Questionnaire Completion — per-questionnaire status + stored score.
 *
 * Colors resolve to design-system tokens only (no hardcoded hex), sans/mono.
 */

import { DeliverableSection } from "../DeliverableSection";
import { useFindingDrawer } from "../FindingDrawerProvider";
import type {
  VendorFindingRow,
  VendorQuestionnaireRow,
} from "@/server/services/deliverableVendorData";

export function VendorBody({
  findings,
  questionnaires,
  statusLabel,
  recommendation,
  riskScore,
  riskTier,
  summary,
}: {
  findings: VendorFindingRow[];
  questionnaires: VendorQuestionnaireRow[];
  statusLabel: string;
  recommendation: string;
  riskScore: number | null;
  riskTier: string;
  summary: string | null;
}) {
  const { openFinding } = useFindingDrawer();

  return (
    <>
      <DeliverableSection n="01" title="Assessment Summary">
        <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
          <Stat label="Status" value={statusLabel} />
          <Stat label="Recommendation" value={recommendation} />
          <Stat label="Risk tier" value={riskTier} />
          <Stat
            label="Risk score"
            value={riskScore == null ? "—" : `${riskScore} / 100`}
          />
        </div>

        <div className="mt-5">
          <p className="eyebrow">Summary</p>
          <p
            className="mt-1 text-sm leading-relaxed"
            style={{
              color: summary ? "var(--foreground)" : "var(--muted-foreground)",
              fontStyle: summary ? "normal" : "italic",
            }}
          >
            {summary ?? "No assessment summary recorded."}
          </p>
        </div>
      </DeliverableSection>

      <DeliverableSection
        n="02"
        title="Findings"
        right={
          <span className="eyebrow">
            {findings.length} {findings.length === 1 ? "finding" : "findings"}
          </span>
        }
      >
        {findings.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            No findings have been raised against this assessment.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left">
                  {["ID", "Finding", "Severity", "Status"].map((h) => (
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
                {findings.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => openFinding(row)}
                    className="group border-b transition-colors hover:bg-muted"
                    style={{ cursor: "pointer", borderColor: "var(--border)" }}
                  >
                    <td className="py-3 pr-4 align-top">
                      <IdTag>{row.identifier}</IdTag>
                    </td>
                    <td className="py-3 pr-4 align-top">
                      <div className="font-medium text-foreground">{row.title}</div>
                    </td>
                    <td className="py-3 pr-4 align-top text-muted-foreground">
                      {row.severityLabel ?? "—"}
                    </td>
                    <td className="py-3 align-top text-muted-foreground">
                      {row.status.replace(/_/g, " ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DeliverableSection>

      <DeliverableSection
        n="03"
        title="Questionnaire Completion"
        right={
          <span className="eyebrow">
            {questionnaires.filter((q) => q.status === "COMPLETED").length} /{" "}
            {questionnaires.length} complete
          </span>
        }
      >
        {questionnaires.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            No questionnaires are attached to this assessment.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {questionnaires.map((q) => (
              <div
                key={q.id}
                className="flex items-center justify-between gap-3 rounded-md border px-4 py-3"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">
                    {q.name}
                  </div>
                  <div className="eyebrow mt-0.5">{q.status.replace(/_/g, " ")}</div>
                </div>
                <div className="font-mono text-xs tabular-nums" style={{ color: "var(--muted-foreground)" }}>
                  {q.overallScore == null ? "—" : `${Math.round(q.overallScore)}%`}
                </div>
              </div>
            ))}
          </div>
        )}
      </DeliverableSection>
    </>
  );
}

/** Sectionless vendor assessment summary (chips + narrative) for the exec summary. */
export function VendorSummaryContent({
  statusLabel,
  recommendation,
  riskTier,
  riskScore,
  summary,
}: {
  statusLabel: string;
  recommendation: string;
  riskTier: string;
  riskScore: number | null;
  summary: string | null;
}) {
  return (
    <>
      <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
        <Stat label="Status" value={statusLabel} />
        <Stat label="Recommendation" value={recommendation} />
        <Stat label="Risk tier" value={riskTier} />
        <Stat label="Risk score" value={riskScore == null ? "—" : `${riskScore} / 100`} />
      </div>
      <div className="mt-5">
        <p className="eyebrow">Summary</p>
        <p
          className="mt-1 text-sm leading-relaxed"
          style={{
            color: summary ? "var(--foreground)" : "var(--muted-foreground)",
            fontStyle: summary ? "normal" : "italic",
          }}
        >
          {summary ?? "No assessment summary recorded."}
        </p>
      </div>
    </>
  );
}

/** Sectionless questionnaire-completion list for the exec summary. */
export function VendorQuestionnairesContent({
  questionnaires,
}: {
  questionnaires: VendorQuestionnaireRow[];
}) {
  if (questionnaires.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
        No questionnaires are attached to this assessment.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {questionnaires.map((q) => (
        <div
          key={q.id}
          className="flex items-center justify-between gap-3 rounded-md border px-4 py-3"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-foreground">{q.name}</div>
            <div className="eyebrow mt-0.5">{q.status.replace(/_/g, " ")}</div>
          </div>
          <div className="font-mono text-xs tabular-nums" style={{ color: "var(--muted-foreground)" }}>
            {q.overallScore == null ? "—" : `${Math.round(q.overallScore)}%`}
          </div>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-lg font-semibold leading-none text-foreground">{value}</div>
      <div className="eyebrow mt-1.5">{label}</div>
    </div>
  );
}

/** Mono ID pill, matching the drawer header's IdTag styling. */
function IdTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block whitespace-nowrap rounded-md border bg-muted px-2 py-1 font-mono text-xs text-foreground">
      {children}
    </span>
  );
}
