# Changelog

All notable changes to BetterThanSpreadsheetsGRC are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
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
- **Compliance assessment notes box** is now full-width below the status select with `rows={6}` `min-h-[160px]` and vertical resize, replacing the cramped one-row textarea that made evidence narratives hard to read while documenting.
- **Maturity assessment notes box** received the same enlargement — applies to both subcategory scoring (NIST CSF) and practice scoring (C2M2 / SAMM).
- **Risk matrix `getDefault`** falls back to the most recently updated active matrix when no template is flagged `isDefault=true`, so consumers (e.g. CreateFindingDialog) can still get matrix-aligned severity options.
- **Framework `updateControl`** exempts `testInstructions` and `acceptanceCriteria` from the OSCAL-imported lock so org admins can author testing fields on locked-source controls (other fields stay locked).
- **Default seeded risk matrix is now 2D 3×3** (Likelihood × Impact, Low/Medium/High thresholds, outputScaleMax 9) instead of 5×5. Affects new orgs only; existing orgs keep their current matrix.

### Removed
- **Assessment Mode** dropdown (SELF / GUIDED / HYBRID) from the maturity create-assessment dialog — all maturity assessments follow the same workflow now. `assessmentMode` is hardcoded to `SELF` on submit for DB compatibility; no schema migration.

### Fixed
- `asset.update` and `asset.create` were validating `ownerId` against the `User` table; corrected to `AssetOwner`, the model the FK actually points to.

## [1.0] — 2026-04-29

### Added
- Initial tracked release.
