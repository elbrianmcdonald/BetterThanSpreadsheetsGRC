/**
 * Engagement assessment methodology data.
 *
 * Ported from the design handoff `data-assessment.js`. This is a pure data
 * module (no styling) consumed by BOTH the engagement tRPC router (to seed
 * recommended sessions + evidence requests, and to source the control-question
 * bank) and the engagement wizard UI.
 *
 * CSS color strings (e.g. `color: "var(--crit)"`) from the original have been
 * stripped / replaced with neutral `tone` keys so this stays presentation-free.
 */

export type MethodologyTone = "crit" | "high" | "med" | "low" | "ok" | "neutral";

// ---- Engagement types ----------------------------------------------------

export interface AssessmentTypeDef {
  /** Matches the Prisma `EngagementType` enum value. */
  id: "MATURITY" | "CONTROLS";
  /** Lowercase id used in the design handoff (kept for UI parity). */
  legacyId: "maturity" | "controls";
  name: string;
  tagline: string;
  blurb: string;
  output: string;
  scale: "maturity" | "controls";
  icon: string;
}

export const ASSESSMENT_TYPES: readonly AssessmentTypeDef[] = [
  {
    id: "MATURITY",
    legacyId: "maturity",
    name: "Maturity Assessment",
    tagline: "Rate capability across security domains",
    blurb:
      "Score each domain on a 1–5 capability scale through stakeholder interviews and evidence review. Best for board-level posture, trend tracking, and roadmap prioritization.",
    output: "Domain maturity scores · capability heatmap · prioritized roadmap",
    scale: "maturity",
    icon: "M4 19V5m0 14h16M8 19v-6m4 6V9m4 10v-9",
  },
  {
    id: "CONTROLS",
    legacyId: "controls",
    name: "Controls Assessment",
    tagline: "Test specific controls for implementation",
    blurb:
      "Validate whether each control is implemented, partial, or absent through evidence and technical testing. Best for audit readiness, framework conformance, and gap remediation.",
    output: "Control-by-control status · gap register · remediation actions",
    scale: "controls",
    icon: "M9 12l2 2 4-4m5 2a9 9 0 11-18 0 9 9 0 0118 0z",
  },
] as const;

// ---- The step-by-step process -------------------------------------------

export interface AssessmentPhaseDef {
  /** Matches the Prisma `EngagementPhase` enum value. */
  id: "setup" | "schedule" | "stakeholders" | "evidence" | "interviews" | "review";
  n: string;
  title: string;
  short: string;
  desc: string;
  duration: string;
}

export const ASSESSMENT_PHASES: readonly AssessmentPhaseDef[] = [
  { id: "setup", n: "01", title: "Scope & setup", short: "Setup", desc: "Define the engagement type, client, framework and in-scope domains.", duration: "Day 0" },
  { id: "schedule", n: "02", title: "Schedule & kickoff", short: "Schedule", desc: "Book the kickoff and per-domain interview sessions with the right people.", duration: "Week 1" },
  { id: "stakeholders", n: "03", title: "Stakeholders & RACI", short: "Stakeholders", desc: "Identify domain owners and confirm who answers for each area.", duration: "Week 1" },
  { id: "evidence", n: "04", title: "Evidence requests", short: "Evidence", desc: "Issue and track the document and artifact requests that ground your ratings.", duration: "Week 1–2" },
  { id: "interviews", n: "05", title: "Control interviews", short: "Interviews", desc: "Work each domain's control questions, score them, and capture notes.", duration: "Week 2–3" },
  { id: "review", n: "06", title: "Review & generate", short: "Review", desc: "Roll up domain scores and generate the findings register and deliverable.", duration: "Week 3" },
] as const;

// ---- Scoring scales ------------------------------------------------------

export interface MaturityLevelDef {
  level: number;
  name: string;
  blurb: string;
  tone: MethodologyTone;
}

export const MATURITY_LEVELS: readonly MaturityLevelDef[] = [
  { level: 1, name: "Initial", blurb: "Ad hoc, undocumented, reactive.", tone: "crit" },
  { level: 2, name: "Developing", blurb: "Some practices exist but are inconsistent.", tone: "high" },
  { level: 3, name: "Defined", blurb: "Documented and applied consistently.", tone: "med" },
  { level: 4, name: "Managed", blurb: "Measured, monitored and enforced.", tone: "low" },
  { level: 5, name: "Optimized", blurb: "Continuously improved and automated.", tone: "ok" },
] as const;

export interface ControlStatusDef {
  id: "implemented" | "partial" | "not" | "na";
  name: string;
  short: string;
  tone: MethodologyTone;
  /** Numeric weight for roll-ups; null for N/A. */
  v: number | null;
}

export const CONTROL_STATUS: readonly ControlStatusDef[] = [
  { id: "implemented", name: "Implemented", short: "Met", tone: "ok", v: 5 },
  { id: "partial", name: "Partial", short: "Partial", tone: "med", v: 3 },
  { id: "not", name: "Not in place", short: "Gap", tone: "crit", v: 1 },
  { id: "na", name: "N/A", short: "N/A", tone: "neutral", v: null },
] as const;

// ---- Domains in scope (selectable) --------------------------------------

export interface AssessDomainDef {
  id: string;
  name: string;
  desc: string;
}

export const ASSESS_DOMAINS: readonly AssessDomainDef[] = [
  { id: "gov", name: "Governance & Risk", desc: "Policy, ownership, risk management, third parties." },
  { id: "iam", name: "Identity & Access", desc: "Authentication, privilege, joiner/mover/leaver." },
  { id: "net", name: "Network & Architecture", desc: "Segmentation, perimeter, IT/OT boundaries." },
  { id: "vuln", name: "Vulnerability Management", desc: "Patching, scanning, asset & lifecycle." },
  { id: "detect", name: "Detection & Response", desc: "Logging, monitoring, EDR, incident response." },
  { id: "resil", name: "Resilience & Recovery", desc: "Backups, DR, business continuity." },
  { id: "data", name: "Data & Application", desc: "Data protection, secure development, secrets." },
] as const;

/** domain id -> domain name (for mapping interview gaps to the findings register). */
export const DOMAIN_LABEL: Record<string, string> = ASSESS_DOMAINS.reduce(
  (m, d) => {
    m[d.id] = d.name;
    return m;
  },
  {} as Record<string, string>,
);

// ---- Recommended meeting plan -------------------------------------------

export interface MeetingPlanDef {
  name: string;
  purpose: string;
  attendees: string[];
  week: string;
  duration: string;
}

export const MEETING_PLAN: readonly MeetingPlanDef[] = [
  { name: "Kickoff & scoping", purpose: "Confirm scope, logistics, rules of engagement and points of contact.", attendees: ["Executive sponsor", "IT Director", "Lead assessor"], week: "Week 1 · Mon", duration: "60 min" },
  { name: "Governance interview", purpose: "Policy set, risk register, ownership and third-party management.", attendees: ["IT Director", "Risk/Compliance"], week: "Week 1 · Tue", duration: "90 min" },
  { name: "Identity & network", purpose: "AD, MFA, privileged access, segmentation and perimeter.", attendees: ["Identity admin", "Network manager"], week: "Week 1 · Thu", duration: "90 min" },
  { name: "Detection & resilience", purpose: "Logging, EDR, IR readiness, backup and recovery.", attendees: ["SOC lead", "Infrastructure lead"], week: "Week 2 · Tue", duration: "90 min" },
  { name: "OT / plant walkthrough", purpose: "Plant systems, OT segmentation and remote access to production.", attendees: ["OT engineer", "Plant IT"], week: "Week 2 · Thu", duration: "90 min" },
  { name: "Findings review & closeout", purpose: "Validate findings, agree ratings and walk the draft roadmap.", attendees: ["Executive sponsor", "IT Director"], week: "Week 3 · Fri", duration: "60 min" },
] as const;

// ---- Evidence / document requests ---------------------------------------

export interface DocRequestDef {
  id: string;
  item: string;
  domain: string;
  /** Recommended starting status (maps to EngagementEvidenceStatus). */
  status: "REQUESTED" | "PARTIAL" | "RECEIVED";
}

export const DOC_REQUESTS: readonly DocRequestDef[] = [
  { id: "d1", item: "Information security policy set", domain: "gov", status: "RECEIVED" },
  { id: "d2", item: "Risk register & prior assessment reports", domain: "gov", status: "RECEIVED" },
  { id: "d3", item: "Network architecture & data-flow diagrams", domain: "net", status: "RECEIVED" },
  { id: "d4", item: "Asset inventory (IT & OT)", domain: "vuln", status: "PARTIAL" },
  { id: "d5", item: "AD group & privileged-account export", domain: "iam", status: "RECEIVED" },
  { id: "d6", item: "MFA / conditional-access configuration", domain: "iam", status: "RECEIVED" },
  { id: "d7", item: "Latest vulnerability scan results", domain: "vuln", status: "PARTIAL" },
  { id: "d8", item: "Logging & EDR coverage matrix", domain: "detect", status: "REQUESTED" },
  { id: "d9", item: "Incident response plan & runbooks", domain: "detect", status: "REQUESTED" },
  { id: "d10", item: "Backup & DR runbooks, restore test logs", domain: "resil", status: "RECEIVED" },
  { id: "d11", item: "Secure development & secrets policy", domain: "data", status: "REQUESTED" },
] as const;

// ---- Control question bank, by domain -----------------------------------

export interface ControlQuestionDef {
  id: string;
  control: string;
  q: string;
  guide: string;
}

export const CONTROL_QUESTIONS: Record<string, readonly ControlQuestionDef[]> = {
  gov: [
    { id: "gov-1", control: "Security policy", q: "Is there an approved, current information-security policy set reviewed at least annually?", guide: "Look for board-approved policies with a review date inside 12 months and evidence of communication to staff." },
    { id: "gov-2", control: "Risk management", q: "Is cyber risk identified, owned and tracked in a maintained risk register?", guide: "A living register with named owners, ratings and treatment decisions — not a one-off spreadsheet." },
    { id: "gov-3", control: "Third-party risk", q: "Are vendors with access to systems or data assessed before and during the relationship?", guide: "Onboarding due diligence, contractual security clauses and periodic re-review." },
  ],
  iam: [
    { id: "iam-1", control: "Multi-factor auth", q: "Is phishing-resistant MFA enforced on all remote access and privileged accounts?", guide: "MFA on VPN, email, SaaS and admin logins; legacy auth disabled. Partial if MFA exists but with gaps." },
    { id: "iam-2", control: "Privileged access", q: "Are privileged accounts separated, vaulted and granted least-privilege?", guide: "No shared admin, no Domain Admin service accounts, just-in-time elevation where possible." },
    { id: "iam-3", control: "Lifecycle (JML)", q: "Are joiner / mover / leaver events processed promptly and reviewed?", guide: "Timely deprovisioning, periodic access recertification, evidence of leaver disablement." },
  ],
  net: [
    { id: "net-1", control: "Segmentation", q: "Are corporate, server and OT/production zones separated by enforced boundaries?", guide: "Firewalled zones with documented rules; IT and plant OT must not share a flat network." },
    { id: "net-2", control: "Perimeter exposure", q: "Is the internet-facing footprint minimized, inventoried and reviewed?", guide: "No direct RDP/management exposure; an external attack-surface review exists and is acted on." },
    { id: "net-3", control: "Remote access", q: "Is remote and third-party access brokered, least-privilege and monitored?", guide: "Single controlled entry path, scoped access, session logging for vendors and admins." },
  ],
  vuln: [
    { id: "vuln-1", control: "Patch management", q: "Are systems patched on a defined SLA driven by risk?", guide: "Documented timelines by severity, with metrics on overdue patches and exceptions." },
    { id: "vuln-2", control: "Vulnerability scanning", q: "Is authenticated scanning performed regularly with tracked remediation?", guide: "Recurring internal + external scans, ticketed remediation, trend reporting." },
    { id: "vuln-3", control: "Asset & lifecycle", q: "Is there an accurate asset inventory with end-of-life systems managed?", guide: "Single source of truth for IT/OT assets; EOL systems retired or compensating-controlled." },
  ],
  detect: [
    { id: "det-1", control: "Logging & monitoring", q: "Are security-relevant logs centralized and monitored for the key estate?", guide: "Critical sources forwarded to a SIEM with alerting; coverage gaps documented." },
    { id: "det-2", control: "Endpoint detection", q: "Is EDR deployed across endpoints and servers with response capability?", guide: "Behavioral detection beyond signature AV, with the ability to isolate and investigate." },
    { id: "det-3", control: "Incident response", q: "Is there a tested incident-response plan with defined roles and contacts?", guide: "Documented plan, named roles, external contacts, and at least an annual tabletop exercise." },
  ],
  resil: [
    { id: "res-1", control: "Backup integrity", q: "Are backups immutable or isolated from the production domain?", guide: "Offline/immutable copies an attacker on production cannot reach or delete." },
    { id: "res-2", control: "Restore testing", q: "Are restores tested on a defined cadence against recovery objectives?", guide: "Evidence of successful test restores and documented RTO/RPO targets." },
    { id: "res-3", control: "Continuity", q: "Is there a business-continuity / DR plan covering critical operations?", guide: "Plan addresses plant and IT outages, with priorities and dependencies mapped." },
  ],
  data: [
    { id: "data-1", control: "Data protection", q: "Is sensitive data identified, classified and protected in transit and at rest?", guide: "Classification scheme applied, encryption for sensitive stores, access on need-to-know." },
    { id: "data-2", control: "Secure development", q: "Are security practices embedded in the development lifecycle?", guide: "Code review, dependency scanning, and security testing before release." },
    { id: "data-3", control: "Secrets management", q: "Are credentials and keys stored in a managed secret store, never in code?", guide: "Vaulted secrets, rotation, and CI scanning to keep secrets out of repositories." },
  ],
};

/** Total control-question count for a domain (used in scope cards + counters). */
export function controlQuestionCount(domainId: string): number {
  return CONTROL_QUESTIONS[domainId]?.length ?? 0;
}

/**
 * Map a methodology control-status id to the existing Prisma `ComplianceStatus`
 * enum value so controls scores can be written through the existing
 * `complianceAssessment.updateControlScore` path.
 */
export const CONTROL_STATUS_TO_COMPLIANCE: Record<
  ControlStatusDef["id"],
  "COMPLIANT" | "PARTIALLY_COMPLIANT" | "NON_COMPLIANT" | "NOT_APPLICABLE"
> = {
  implemented: "COMPLIANT",
  partial: "PARTIALLY_COMPLIANT",
  not: "NON_COMPLIANT",
  na: "NOT_APPLICABLE",
};
