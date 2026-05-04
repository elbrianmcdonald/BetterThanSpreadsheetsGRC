# Changelog

All notable changes to BetterThanSpreadsheetsGRC are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- **Risk Assessment v2** — the assessment is now a true container; risk substance lives entirely on each identified risk inside it.
  - **Slim creation form** at `/risk-assessments/new` captures only the project metadata (subject, description, risk matrix, due date, assignee). On submit, redirects to the assessment workspace where the analyst fills everything else in.
  - **Tabbed assessment workspace** at `/risk-assessments/{id}` — Overview · Identified Risks · Controls · Evidence · Remediation · Comments · Audit Trail · History. Hero shows subject, status badge, assignee, due date, and workflow action buttons.
  - **Editable Overview tab** for ORG_ADMIN or the assigned worker (description, assignee, due date, risk owner) via inline pencil-edit; status and matrix remain immutable post-creation.
  - **Editable Identified Risks accordion** — one expandable card per risk, each owning Title/Category/Statement, **MITRE ATT&CK Threat Model** (initial access, threat steps, objectives, moved off the parent), **Controls** (in-place + needed via `CreatableControlPicker`), **Evidence**, **Severity Scoring** (inherent + residual against the locked matrix), and **Treatment** (Remediate ↔ Accept toggle, both forms' data preserved on flip).
  - **Risk Acceptance form** (when treatment = ACCEPT): justification, review/expiration date, optional compensating controls. Persisted on `Risk` via 5 new columns (`acceptanceJustification`, `acceptedById`, `acceptedAt`, `acceptanceReviewDate`, `acceptanceCompensatingControls`).
  - **Enterprise Risk picker on each identified risk** — optional alignment to a top-level Enterprise Risk for executive roll-up.
  - **"Add Risk" inline auto-expand** + Save Changes affordances at the top *and* bottom of the editor for long lists.
  - **Aggregation tabs at the project level**: Controls roll-up (every control across all identified risks with role badge IN_PLACE / NEEDED / MITIGATING / GAP), Evidence roll-up (every attachment), Remediation roll-up (per-risk treatment + plan/justification + due date + status).
  - **Treatment Progress card** between hero and tabs — Total / Remediating / Accepted / No Decision / SLA Breached / Completed counters with overall progress %.
  - **Submit / Approve / Reject / Rescind workflow** in the hero. GRC analyst submits → manager (ORG_ADMIN/CISO) approves or rejects with notes. ORG_ADMIN can approve directly from IN_PROGRESS (skip submit). On approval, identified risks are published to the risk register.
  - **Comments tab** — project-level threaded comments backed by new `RiskAssessmentProjectComment` model (author, timestamp, soft delete by author or admin).
  - **Audit Trail tab** — vertical timeline of `AuditLog` entries scoped to the assessment, with action badge and full change-payload JSON.
- **Inline-create Vendor in Vendor Assessment dropdown** — `CreatableVendorPicker` lets you type a vendor name not in the list and create it on the fly (quick-create or "More options..." dialog with name + category). Mirrors the existing business-unit picker pattern.
- **Identified Risks register pipeline**: when a `RiskAssessmentProject` is approved, one `RiskRegisterEntry` is now created per published risk (forward-only). The register list query and UI render risk-backed entries side-by-side with the legacy assessment-backed entries; clicking either navigates to the single-risk drilldown.
- **Enterprise Risks** module: 10 baseline rollup risks per organization, manual/calculated scoring, child-risk alignment, severity trend snapshots, and a per-risk review cadence with audit trail (`/risks/enterprise`).
- **Loss Event Range** (Min / Probable / Max in USD) on Business Processes and Assets — captured on the BIA detail and edit pages.
- **Risk Assessment linkage**: a risk assessment can link one Asset and/or one Business Process. The current Loss Event Range is snapshotted onto the assessment at link time and applied to all child risks; re-pick refreshes the snapshot.
- Enterprise Risk picker on manual create / discovered / edit risk forms so individual risks can be aligned to a top-level enterprise risk.
- **Matrix-anchored finding severity**: `Finding.severityLabel` and `Finding.matrixVersionId` columns. The Create Finding dialog now pulls severity options (label + color) from the org's default risk matrix thresholds, so findings and risks share the same qualitative vocabulary. Finding badges (header, table, assessment list) prefer the matrix label when present.
- **Test Instructions / Acceptance Criteria on framework controls** (`Control.testInstructions`, `Control.acceptanceCriteria`). Editable inline at `/admin/frameworks/<id>` via badge column + dialog (ORG_ADMIN only). Surfaced read-only as collapsibles in the compliance assessment scoring panel above each control's notes.
- **Test Instructions / Acceptance Criteria on maturity domains and questions** (`MaturityDomain.*`, `MaturityQuestion.*`). Editable at `/admin/frameworks/maturity/<id>` via TI/AC badge buttons on each domain and practice. Surfaced read-only during maturity assessments above the scoring controls.
- **Unified `/admin/frameworks` listing**: compliance frameworks (NIST 800-53, ISO 27001, etc.) and maturity frameworks (NIST CSF, C2M2) now appear side-by-side with `Compliance` / `Maturity` type badges. Maturity rows link to a new read-only detail page that renders the proper Function → Category → Subcategory tree (color-coded by level, sorted by `sortOrder`) with practices/questions grouped under their domain.
- **Compliance / Maturity selector at `/admin/frameworks/new`**: Compliance keeps the existing library/Excel flow. Maturity offers `cloneFramework` — pick a system template (NIST CSF, C2M2) and clone it into the org as `isSystemTemplate=false` with full domain hierarchy, scoring levels, and questions copied.
- **Per-control evidence attachment in assessments**: a new `AssessmentEvidencePanel` lets assessors attach existing evidence from the repo or upload a new file inline (`Upload & attach` in a single dialog) directly from the compliance control / maturity subcategory / C2M2 practice scoring panel. Three new tRPC mutations (`complianceAssessment.attachEvidenceToControl`, `maturity.attachEvidenceToSubcategory`, `maturity.attachEvidenceToPractice`) and `evidence.listByIds` for batch metadata fetch.
- **Clickable dashboard metric cards across 8 pages** (Home, TPRM dashboard, Compliance assessments, Compliance dashboard, Maturity dashboard, Risks dashboard, BIA dashboard) — each metric card is now a `Link` with hover state that navigates to the relevant list pre-filtered by URL search params. 31 cards in total. Findings list now reads `?status=`, `?source=`, `?severity=`, `?search=` from the URL on mount; compliance assessments page reads `?tab=` and `?status=`; `/admin/frameworks` adds a `?coverage=ready|needs-attention` filter that buckets by health-data coverage % (≥90 / <70).

### Changed
- **Business Impact field on the risk detail page** is now a plain editable textarea bound to `risk.businessImpactStatement`. The previous auto-generation flow (regulatory/operational/business sections produced by a heuristic service) has been removed everywhere — analysts type the impact themselves, no autogen on risk create / evidence link / severity change.
- **`risk.create` and `risk.updateRisk`** description min length relaxed (was 20 → now 1) so terse risk statements don't fail validation.
- **`/risks/{id}` is now a single-risk drilldown** only — the "Identified Risks" sibling-list tab was removed. The canonical assessment surface is `/risk-assessments/{id}`.
- **`controlLink.bulkLinkRiskToControls`** is now forgiving: IDs that don't match a framework `Control` are routed to `RiskOrganizationalControl` (best-effort fallback), and unmatched IDs are skipped instead of throwing "Some controls not found or are inactive".
- **Identified Risks editor** uses `organizationalControl.bulkLinkToRisk` for the picker selections (the picker yields organizational control IDs, not framework ones).
- **Compliance assessment notes box** is now full-width below the status select with `rows={6}` `min-h-[160px]` and vertical resize, replacing the cramped one-row textarea that made evidence narratives hard to read while documenting.
- **Maturity assessment notes box** received the same enlargement — applies to both subcategory scoring (NIST CSF) and practice scoring (C2M2 / SAMM).
- **Risk matrix `getDefault`** falls back to the most recently updated active matrix when no template is flagged `isDefault=true`, so consumers (e.g. CreateFindingDialog) can still get matrix-aligned severity options.
- **Framework `updateControl`** exempts `testInstructions` and `acceptanceCriteria` from the OSCAL-imported lock so org admins can author testing fields on locked-source controls (other fields stay locked).
- **Default seeded risk matrix is now 2D 3×3** (Likelihood × Impact, Low/Medium/High thresholds, outputScaleMax 9) instead of 5×5. Affects new orgs only; existing orgs keep their current matrix.

### Removed
- **Business Impact auto-generation** wiring: deleted `businessImpactGenerator.ts` service, `EditImpactStatementDialog.tsx`, the `risk.regenerateBusinessImpact` tRPC procedure, and all 5 `void generateAndSaveBusinessImpact(...)` triggers across `risk.ts` (create, evidence link/unlink, severity update, vendor risk).
- **Legacy Risk Assessment workspace**: deleted `ProjectRiskAssessmentForm.tsx` (the giant inline form replaced by the new tabbed `AssessmentWorkspaceClient` + `IdentifiedRisksEditor`), unused `DiscoveredRiskCard.tsx`, dead-code `RiskLinkedControls.tsx`, and `risk.listIdentifiedSiblings` tRPC procedure.
- **One-time risk-domain reset**: the migration to v2 truncates `Risk`, `RiskAssessment`, `RiskAssessmentProject`, `RiskRegisterEntry`, `RiskScenario` (and dependent rows via CASCADE) across all orgs and re-seeds 3 sample assessment containers per org (Cloud Migration / Vendor Onboarding — Acme SaaS / Q2 Internal Audit). Forward-only — historical risk data is not preserved.
- **Assessment Mode** dropdown (SELF / GUIDED / HYBRID) from the maturity create-assessment dialog — all maturity assessments follow the same workflow now. `assessmentMode` is hardcoded to `SELF` on submit for DB compatibility; no schema migration.

### Fixed
- **Risk category badge alignment** on the identified-risk editor: the parent 2-col grid was stretching cells to equal height which pushed the title's `items-center` flex label down ~7px relative to "Risk Category". Added `items-start` to the grid; both labels now top-align.
- **`risk.create` UUID validation** on `discoveryProjectId` rejected cuid IDs (Prisma default), so saving a risk against a seeded project failed. Relaxed to `.string().min(1)`.
- **`asset.update` and `asset.create`** were validating `ownerId` against the `User` table; corrected to `AssetOwner`, the model the FK actually points to.

## [1.0] — 2026-04-29

### Added
- Initial tracked release.
