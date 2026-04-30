# Changelog

All notable changes to BetterThanSpreadsheetsGRC are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- **Enterprise Risks** module: 10 baseline rollup risks per organization, manual/calculated scoring, child-risk alignment, severity trend snapshots, and a per-risk review cadence with audit trail (`/risks/enterprise`).
- **Loss Event Range** (Min / Probable / Max in USD) on Business Processes and Assets — captured on the BIA detail and edit pages.
- **Risk Assessment linkage**: a risk assessment can link one Asset and/or one Business Process. The current Loss Event Range is snapshotted onto the assessment at link time and applied to all child risks; re-pick refreshes the snapshot.
- Enterprise Risk picker on manual create / discovered / edit risk forms so individual risks can be aligned to a top-level enterprise risk.

### Fixed
- `asset.update` and `asset.create` were validating `ownerId` against the `User` table; corrected to `AssetOwner`, the model the FK actually points to.

## [1.0] — 2026-04-29

### Added
- Initial tracked release.
