# Unified Finding Create Form

**Date:** 2026-07-14
**Status:** Approved, not yet implemented

## Problem

A Finding can be created from five places, using two different form implementations and three
different server paths. The forms have drifted badly.

`CreateFindingForm` (`src/components/findings/CreateFindingForm.tsx`) is the real form, served at
`/findings/new`. It uses react-hook-form + zod and renders the full `RiskItemCard` (`variant="finding"`):
risk statement, control domain, linked risks, MITRE threat steps and objectives, mitigating controls,
control gaps, inherent and residual scoring, remediation options — plus business units (with inline
quick-create), assignee, and the exploitation-pathway attach section.

`CreateFindingDialog` (`src/components/findings/CreateFindingDialog.tsx`) is a lean hand-rolled dialog
with no zod and no react-hook-form. It collects four things: title, description, source, and matrix
scoring. It is what compliance and maturity assessments actually use.

TPRM questionnaire responses use a third thing: a bespoke inline dialog
(`src/app/tprm/questionnaires/responses/[id]/client.tsx:303-360`) hitting a separate mutation,
`finding.createFromQuestionnaireResponse` (`src/server/api/routers/finding.ts:2202`), which supports
none of the matrix scoring or control linking that `finding.create` does.

`riskAssessmentQuestionnaire.spawn` (`src/server/api/routers/riskAssessmentQuestionnaire.ts:468`) is a
fifth path with no client caller. It hand-rolls its own identifier generator instead of using
`generateIdentifier` and creates findings with no matrix scoring at all.

The consequence: a finding raised from a compliance assessment captures a fraction of what the same
finding captures when raised from `/findings/new`, and a finding raised from TPRM is poorer still.

## Goal

One form component and one server mutation, used by every call site. A finding raised from a
compliance assessment should capture exactly what a finding raised from `/findings/new` captures,
plus its linkage back to the assessment.

## Design

### Component structure

`CreateFindingForm` becomes the single form. It is already embeddable — it takes `onCreated` /
`onCancel`, and `AssessmentFindingsTab` already renders it inline. What it lacks is the linkage props
that only the lean dialog can supply today.

It gains these props, all optional, all pass-through — threaded into the `finding.create` payload,
never rendered as editable controls, so a user cannot re-point a finding at a different assessment:

- `controlId`, `complianceAssessmentId`
- `maturityAssessmentId`, `maturityDomainId`
- `vendorId`, `vendorAssessmentId`, `questionnaireResponseId`
- `defaultSource`, `contextLabel`

`CreateFindingDialog` is replaced — same filename, entirely new body — by a thin wrapper that renders
`CreateFindingForm` inside a scrollable shadcn `Dialog`. It owns the modal chrome and nothing else:
open state, title, the context chip, and the scroll container. All form logic stays in
`CreateFindingForm`.

The dialog presentation was chosen over inline expansion or a side sheet because all three call sites
are already buttons that open a modal, so the click contract does not change. The business-unit
quick-create is itself a dialog, giving a dialog-on-dialog; this is a known-workable shadcn case but
should be checked during verification.

The bespoke TPRM dialog is deleted.

### Prefill behavior

**Title is prefilled. The risk statement is not.**

The lean dialog prefilled a `description` with boilerplate ("Observed during assessment…"). The rich
form has no top-level description — the equivalent field is the risk statement inside `RiskItemCard`,
which demands 20+ characters of substance. Auto-filling boilerplate into that field invites users to
leave the boilerplate. They write the statement themselves.

The context that used to be crammed into the description becomes a read-only `contextLabel` chip at
the top of the dialog, so the user can see what they are filing against.

### Source

`source` defaults per call site and stays user-editable everywhere:

| Call site | Default |
|---|---|
| Compliance assessment | `AUDIT` |
| Maturity assessment | `AUDIT` |
| TPRM questionnaire response | `MANUAL` |
| Risk-assessment project | `RISK_ASSESSMENT` |

This matches today's effective behavior, with one deliberate change: TPRM's source becomes editable,
where `createFromQuestionnaireResponse` currently forces `MANUAL` server-side. Locking the select for
assessment-spawned findings was considered and rejected as premature — it is easy to add later if
users are found to be mislabeling.

### Server

`finding.create` (`src/server/api/routers/finding.ts:592`) absorbs the vendor path.

1. **`createFindingInput` (`:71-148`) gains `questionnaireResponseId`,** optional. Every existing caller
   omits it and is unaffected. The compliance, maturity, control, and discovery-project linkage fields
   are already accepted.

   `vendorId` and `vendorAssessmentId` are **not** accepted from the client. They are *derived*
   server-side by walking `questionnaireResponse → questionnaire → assessment → vendor`, exactly as
   `createFromQuestionnaireResponse` does today (`:2187-2188`). `QuestionnaireResponse` has no
   `organizationId` column, so this walk is also the only way to prove org ownership — accepting
   client-supplied vendor ids would let a caller attach a finding to a vendor the response does not
   belong to.

2. **The derivation walk *is* the org-scope check**, lifted from `createFromQuestionnaireResponse`
   (`:2152-2157`) and matching the existing validation of BUs, assignee, control, assessments,
   enterprise risk, and linked risks (`:665-801`). A response whose assessment belongs to another org
   is rejected with `FORBIDDEN`.

3. **The one-finding-per-response guard (`:2160-2168`) moves into `create`, fired only when
   `questionnaireResponseId` is present.** Compliance, maturity, and risk-assessment creates never
   touch it. Same error, same semantics, relocated.

`finding.createFromQuestionnaireResponse` is then deleted.

Unchanged: authoritative matrix scoring (`:807-816`), `FindingControlLink` auto-creation with
`linkType: "OBSERVATION"` when `controlId` is set (`:885-894`), `discoveryStatus: PENDING` for
`discoveryProjectId` (`:877-878`), and the `FINDING_CREATE_ROLES` gate. The vendor path inherits all
of these, which it has none of today.

`riskAssessmentQuestionnaire.spawn` is deleted as dead code.

### Call sites

Each is reduced to passing props. Buttons, handlers, and context state stay as they are.

1. **Compliance** — `src/app/compliance/assessments/[id]/client.tsx:1648`. Passes `defaultSource="AUDIT"`,
   `initialTitle` from the control code and title, `contextLabel`, `controlId`, `complianceAssessmentId`.
   The `findingContext` state and the "Finding" button on `ControlScoreCard` (`:371`) are untouched.

2. **Maturity** — `src/app/maturity/[id]/client.tsx:2872` and `src/components/maturity/samm-checklist.tsx`.
   Same, with `maturityAssessmentId` + `maturityDomainId`.

   Compliance and maturity are **separate subsystems with separate assessment tables** and distinct
   linkage columns (`sourceComplianceAssessmentId` vs `sourceMaturityAssessmentId` /
   `sourceMaturityDomainId`). The dialog never sets both.

3. **TPRM** — `src/app/tprm/questionnaires/responses/[id]/client.tsx`. The bespoke dialog is replaced
   with the shared one: `defaultSource="MANUAL"`, `initialTitle` = the existing `"Concern: …"`, and the
   vendor trio. The markdown context block that was crammed into the description becomes the
   `contextLabel`.

4. **Risk-assessment projects** — `AssessmentFindingsTab.tsx`, `QuestionnaireTab.tsx`. Already use
   `CreateFindingForm` inline. Untouched.

## Data migration

None. TPRM findings created after this change will carry business units, an assignee, remediation
options, control links, and authoritative matrix scoring — none of which the old vendor path
supported. Existing rows keep nulls in those columns.

## Verification

The server change is the only part that can break something that works today, so it is tested first.
The two things that can actually go wrong:

- **Vendor org-scoping.** A vendor, vendor assessment, or questionnaire response from another org must
  be rejected. This is the one place a consolidation like this can quietly open a hole.
- **The conditional uniqueness guard.** It must fire when `questionnaireResponseId` is present and must
  not fire otherwise.

The UI is verified by driving each of the four paths in a browser and confirming the finding lands with
the correct linkage columns set. Because the Docker app does not hot-reload, this is batched: all four
call sites are changed, then one rebuild, then all four paths are driven. Check the nested
business-unit quick-create dialog while there.

Typecheck is measured against the existing baseline of 225 errors. The bar is no new errors, not zero.

## Rejected alternatives

- **Navigate to `/findings/new` with query params** rather than rendering the form in place. Would have
  meant a full page transition out of the assessment and back via `returnTo`. Rendering the same
  component in a dialog gives the same form without losing the user's place.
- **A conditional submit path in the form** (`createFromQuestionnaireResponse` when a
  `questionnaireResponseId` is present, `create` otherwise). Smaller server diff, but it keeps two
  server-side validation surfaces that can drift, and the rich form would silently drop the assignee,
  business units, and remediation options on the vendor path. A form that shows an Assignee picker and
  throws the assignee away is worse than the lean dialog was.
- **Compliance-only scope.** Would have left the identical lean form alive in maturity, with nothing
  preventing the same drift from recurring.
