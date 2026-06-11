/**
 * Epic 19: shared shapes for the Exploitation Pathway components.
 *
 * These mirror the `pathway.getById` / `pathway.listByAssessment` tRPC payload
 * but are declared structurally so the presentational components don't import
 * server types. The page does the tRPC query and passes data down via props.
 */

/** Which kind of member a step references. */
export type PathwayMemberKind = "finding" | "risk";

/** A linked finding/risk summary as returned on each step. */
export interface PathwayMemberSummary {
  id: string;
  identifier: string | null;
  title: string;
  /** Coarse legacy categorical severity (HIGH/MEDIUM/LOW). */
  severity: string;
  /** Matrix threshold label, e.g. "Critical"/"High" (optional). */
  severityLabel?: string;
  /**
   * Matrix-based inherent scoring inputs (numbers, already Decimal→number at
   * the API boundary). Present on findings/risks scored against a configured
   * risk matrix; absent (undefined) on older categorical-only members.
   * `inherentExposure` is set only for 3D (L×I×E) matrices.
   */
  inherentLikelihood?: number;
  inherentImpact?: number;
  inherentExposure?: number;
  inherentScore?: number;
}

/**
 * One entry of a step's `members` join (source of truth). Carries the member
 * summary plus its `kind` and the stable join-row id (for inline removal).
 */
export interface PathwayMemberEntry extends PathwayMemberSummary {
  kind: PathwayMemberKind;
  /** PathwayStepMember row id. */
  memberId: string;
}

/** One ordered ATT&CK step in the pathway. */
export interface PathwayStepLike {
  id: string;
  order: number;
  tactic: string;
  technique: string;
  mitreTid: string | null;
  findingId: string | null;
  riskId: string | null;
  note: string | null;
  /** Denormalized primary finding/risk (first member of each kind). */
  finding?: PathwayMemberSummary | null;
  risk?: PathwayMemberSummary | null;
  /**
   * All members this step references (source of truth). A step may reference
   * many findings AND/OR risks. May be empty/absent on legacy payloads — use
   * {@link stepMembers} which falls back to finding/risk.
   */
  members?: PathwayMemberEntry[];
}

/** A pathway with its ordered steps. */
export interface PathwayLike {
  id: string;
  name: string;
  assessmentKind: string;
  assessmentId: string;
  verdict: string | null;
  narrative: string | null;
  blastRadius: string | null;
  steps: PathwayStepLike[];
}

/** Authoritative ATT&CK column order for the Matrix view (Story 19.2 AC14). */
export const TACTIC_ORDER = [
  "Initial Access",
  "Credential Access",
  "Privilege Escalation",
  "Lateral Movement",
  "Defense Evasion",
  "Impact",
] as const;

export type PathwayMode = "killchain" | "matrix" | "narrative";

/** Steps sorted ascending by `order` (never trust array order). */
export function orderedSteps(steps: PathwayStepLike[]): PathwayStepLike[] {
  return [...steps].sort((a, b) => a.order - b.order);
}

/**
 * The contributing member of a step — whichever of finding/risk is set, with
 * its kind. Returns null when the step references neither.
 */
export interface PathwayMemberRef {
  kind: PathwayMemberKind;
  member: PathwayMemberSummary;
}

export function stepMember(step: PathwayStepLike): PathwayMemberRef | null {
  if (step.finding) return { kind: "finding", member: step.finding };
  if (step.risk) return { kind: "risk", member: step.risk };
  return null;
}

/**
 * All members a step references. Prefers the `members` join (source of truth);
 * falls back to the denormalized single finding/risk when `members` is empty or
 * absent (legacy payloads), so callers always get at least the primary member.
 */
export function stepMembers(step: PathwayStepLike): PathwayMemberEntry[] {
  if (step.members && step.members.length > 0) return step.members;
  const fallback: PathwayMemberEntry[] = [];
  if (step.finding) {
    fallback.push({ ...step.finding, kind: "finding", memberId: `${step.id}:finding` });
  }
  if (step.risk) {
    fallback.push({ ...step.risk, kind: "risk", memberId: `${step.id}:risk` });
  }
  return fallback;
}

/** True when the step contributes a finding or risk (i.e. is "toxic"). */
export function stepHasMember(step: PathwayStepLike): boolean {
  return !!(step.finding || step.risk || step.findingId || step.riskId);
}

/**
 * Severity tier descriptor for a member dot + label.
 *
 * The pathway summary carries categorical `severity` (the Prisma `Severity`
 * enum: CRITICAL/HIGH/MEDIUM/LOW), NOT an L×I score — so contributing members
 * render a colored severity DOT + label rather than a "5×5" figure. Colors map
 * to the app's real tokens: Critical=destructive, High=severity-high,
 * Medium=warning, Low=success.
 */
export interface SeverityTier {
  /** Token reference for the dot color, e.g. `var(--destructive)`. */
  color: string;
  /** Title-cased display label, e.g. "Critical". */
  label: string;
}

/**
 * Format a single inherent value (number) for the L×I(×E) figure, dropping a
 * trailing `.0000`/`.0` so integers read cleanly ("5" not "5.0000") while
 * fractional levels keep their precision ("2.5").
 */
function formatScoreValue(v: number): string {
  return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(4)));
}

/**
 * Build the L×I or L×I×E figure for a member, e.g. "5×4" or "5×4×3". Returns
 * null when the member has no inherent likelihood/impact (older categorical
 * members) so callers can fall back to the severity label. ×E is appended only
 * when `inherentExposure` is present (3D matrix) — no dimension is hard-coded.
 */
export function memberScoreFigure(
  member: Pick<
    PathwayMemberSummary,
    "inherentLikelihood" | "inherentImpact" | "inherentExposure"
  >,
): string | null {
  if (member.inherentLikelihood == null || member.inherentImpact == null) {
    return null;
  }
  const parts = [member.inherentLikelihood, member.inherentImpact];
  if (member.inherentExposure != null) parts.push(member.inherentExposure);
  return parts.map(formatScoreValue).join("×");
}

export function severityTier(severity: string | null | undefined): SeverityTier {
  switch ((severity ?? "").toUpperCase()) {
    case "CRITICAL":
      return { color: "var(--destructive)", label: "Critical" };
    case "HIGH":
      return { color: "var(--severity-high)", label: "High" };
    case "MEDIUM":
      return { color: "var(--warning)", label: "Medium" };
    case "LOW":
      return { color: "var(--success)", label: "Low" };
    default:
      return { color: "var(--muted-foreground)", label: severity ? severity : "—" };
  }
}
