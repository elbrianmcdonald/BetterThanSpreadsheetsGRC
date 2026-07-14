# Unified Finding Create Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every place a Finding is created — compliance assessments, maturity assessments, TPRM questionnaire responses, and `/findings/new` — uses the same `CreateFindingForm` component and the same `finding.create` mutation.

**Architecture:** `CreateFindingForm` gains pass-through linkage props it currently lacks. `CreateFindingDialog` is gutted and rebuilt as a thin modal wrapper around that form. `finding.create` absorbs the vendor path from `finding.createFromQuestionnaireResponse`, which is then deleted along with the dead `riskAssessmentQuestionnaire.spawn`.

**Tech Stack:** Next.js App Router, tRPC v11, Prisma 7, react-hook-form + zod, shadcn/ui (Radix Dialog), Jest (ts-jest ESM) integration tests against the live dev database.

**Spec:** `docs/superpowers/specs/2026-07-14-unified-finding-create-form-design.md`

## Global Constraints

- **Deviation from spec, already agreed:** the spec said `finding.create` would accept `vendorId`, `vendorAssessmentId`, and `questionnaireResponseId`. It accepts **only `questionnaireResponseId`**. `vendorId` and `vendorAssessmentId` are *derived* server-side by walking `questionnaireResponse → questionnaire → assessment → vendor`, exactly as `createFromQuestionnaireResponse` does today. `QuestionnaireResponse` has no `organizationId` column, so this walk is also how org ownership is established — accepting client-supplied vendor ids would let a caller attach a finding to a vendor the response doesn't belong to. Derivation is strictly safer and simpler.
- **Prefill:** title only. Never prefill the risk statement. (Spec: "Prefill behavior".)
- **Source defaults:** compliance `AUDIT`, maturity `AUDIT`, TPRM `MANUAL`, risk-assessment project `RISK_ASSESSMENT`. Always user-editable.
- **Linkage ids are props, never editable form fields.** A user must not be able to re-point a finding at a different assessment.
- **Typecheck baseline is 225 pre-existing errors.** The bar is *no new errors*, not zero. Compare counts, don't read the absolute number as a failure.
- **The Docker app does not hot-reload.** UI changes need a rebuild. Do not attempt to verify UI in the browser until Task 8.
- **There is no separate test database.** Integration tests run against the live dev DB and must create uniquely-slugged throwaway orgs and clean up after themselves, following the existing pattern in `src/__tests__/integration/finding-creation.test.ts`.
- **Compliance and maturity are different subsystems** with different tables and different linkage columns (`sourceComplianceAssessmentId` vs `sourceMaturityAssessmentId`/`sourceMaturityDomainId`). Never set both.

---

### Task 1: Server — `finding.create` absorbs the vendor path

**Files:**
- Modify: `src/server/api/routers/finding.ts:71-148` (input schema), `:596-620` (destructure), `:659` (validation block), `:872-878` (create data)
- Test: `src/__tests__/integration/finding-create-questionnaire.test.ts` (create)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `finding.create` accepts an optional `questionnaireResponseId: string`. When present it sets `questionnaireResponseId`, `vendorId`, and `vendorAssessmentId` on the created Finding (all derived), and rejects a second finding for the same response with `BAD_REQUEST`. Later tasks pass this field from the client.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/integration/finding-create-questionnaire.test.ts`:

```ts
/**
 * finding.create — questionnaire-response linkage
 *
 * Covers the vendor path folded in from the deleted
 * finding.createFromQuestionnaireResponse (2026-07-14 unified-finding-create-form):
 * - vendor ids are DERIVED from the response, never trusted from the client
 * - one finding per response
 * - a response in another org is rejected
 * - the guard does not fire for non-vendor creates
 */

import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";
import { randomUUID } from "crypto";
import { UserRole, Severity, FindingSource, QuestionType } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { runWithOrganizationContext } from "@/server/db/middleware/organization-filter";

const SLUG = "test-org-fnd-qr";
const SLUG2 = "test-org-fnd-qr-2";

let orgA: { id: string };
let orgB: { id: string };
let userA: { id: string; email: string; role: UserRole; organizationId: string; name: string; assignedFrameworks: string[] };
let responseA: { id: string };
let responseB: { id: string };
let vendorA: { id: string };
let vendorAssessmentA: { id: string };

/** Build vendor → assessment → questionnaire → response for one org. */
async function seedVendorChain(organizationId: string, tag: string) {
  const vendor = await db.vendor.create({
    data: {
      id: randomUUID(),
      identifier: `VND-2026-${tag}`,
      organizationId,
      name: `Vendor ${tag}`,
      updatedAt: new Date(),
    },
  });
  const assessment = await db.vendorAssessment.create({
    data: {
      id: randomUUID(),
      identifier: `VA-2026-${tag}`,
      organizationId,
      vendorId: vendor.id,
      title: `Assessment ${tag}`,
      updatedAt: new Date(),
    },
  });
  const template = await db.questionnaireTemplate.create({
    data: {
      id: randomUUID(),
      organizationId,
      name: `Template ${tag}`,
      updatedAt: new Date(),
    },
  });
  const section = await db.questionnaireSection.create({
    data: {
      id: randomUUID(),
      templateId: template.id,
      title: "Section 1",
      updatedAt: new Date(),
    },
  });
  const question = await db.questionnaireQuestion.create({
    data: {
      id: randomUUID(),
      sectionId: section.id,
      questionText: "Do you encrypt data at rest?",
      questionType: QuestionType.YES_NO,
      updatedAt: new Date(),
    },
  });
  const questionnaire = await db.assessmentQuestionnaire.create({
    data: {
      id: randomUUID(),
      assessmentId: assessment.id,
      templateId: template.id,
      updatedAt: new Date(),
    },
  });
  const response = await db.questionnaireResponse.create({
    data: {
      id: randomUUID(),
      questionnaireId: questionnaire.id,
      questionId: question.id,
      textResponse: "No",
      updatedAt: new Date(),
    },
  });
  return { vendor, assessment, response };
}

async function purge(slug: string) {
  const org = await db.organization.findUnique({ where: { slug } });
  if (!org) return;
  await db.$executeRaw`DELETE FROM "Finding" WHERE "organizationId" = ${org.id}`;
  await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${org.id}`;
  await db.$executeRaw`DELETE FROM "QuestionnaireResponse" WHERE "questionnaireId" IN (SELECT q.id FROM "AssessmentQuestionnaire" q JOIN "VendorAssessment" va ON va.id = q."assessmentId" WHERE va."organizationId" = ${org.id})`;
  await db.$executeRaw`DELETE FROM "AssessmentQuestionnaire" WHERE "assessmentId" IN (SELECT id FROM "VendorAssessment" WHERE "organizationId" = ${org.id})`;
  await db.$executeRaw`DELETE FROM "QuestionnaireQuestion" WHERE "sectionId" IN (SELECT s.id FROM "QuestionnaireSection" s JOIN "QuestionnaireTemplate" t ON t.id = s."templateId" WHERE t."organizationId" = ${org.id})`;
  await db.$executeRaw`DELETE FROM "QuestionnaireSection" WHERE "templateId" IN (SELECT id FROM "QuestionnaireTemplate" WHERE "organizationId" = ${org.id})`;
  await db.$executeRaw`DELETE FROM "QuestionnaireTemplate" WHERE "organizationId" = ${org.id}`;
  await db.$executeRaw`DELETE FROM "VendorAssessment" WHERE "organizationId" = ${org.id}`;
  await db.$executeRaw`DELETE FROM "Vendor" WHERE "organizationId" = ${org.id}`;
  await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${org.id}`;
  await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${org.id}`;
}

beforeAll(async () => {
  await purge(SLUG);
  await purge(SLUG2);

  orgA = await db.organization.create({
    data: { id: randomUUID(), name: "Test Org FND QR", slug: SLUG, updatedAt: new Date() },
  });
  orgB = await db.organization.create({
    data: { id: randomUUID(), name: "Test Org FND QR 2", slug: SLUG2, updatedAt: new Date() },
  });

  userA = await db.user.create({
    data: {
      id: randomUUID(),
      email: `sec-${randomUUID()}@example.com`,
      name: "Sec Engineer",
      role: UserRole.SECURITY_ENGINEER,
      organizationId: orgA.id,
      assignedFrameworks: [],
      updatedAt: new Date(),
    },
  });

  const chainA = await seedVendorChain(orgA.id, "AAAA");
  vendorA = chainA.vendor;
  vendorAssessmentA = chainA.assessment;
  responseA = chainA.response;

  const chainB = await seedVendorChain(orgB.id, "BBBB");
  responseB = chainB.response;
});

afterAll(async () => {
  await purge(SLUG);
  await purge(SLUG2);
  await db.$disconnect();
});

/** Caller in orgA with create rights. */
function callerA() {
  return appRouter.createCaller({
    db,
    session: { user: { id: userA.id, role: userA.role, organizationId: orgA.id }, expires: "" },
    organizationId: orgA.id,
    headers: new Headers(),
  } as never);
}

const basePayload = {
  title: "Vendor does not encrypt data at rest",
  description: "The vendor confirmed in the questionnaire that data at rest is not encrypted.",
  source: FindingSource.MANUAL,
  severity: Severity.HIGH,
};

describe("finding.create with questionnaireResponseId", () => {
  it("derives vendor and vendor-assessment ids from the response", async () => {
    const finding = await runWithOrganizationContext(orgA.id, () =>
      callerA().finding.create({
        ...basePayload,
        questionnaireResponseId: responseA.id,
      }),
    );

    const row = await db.finding.findUnique({
      where: { id: finding.id },
      select: { vendorId: true, vendorAssessmentId: true, questionnaireResponseId: true },
    });

    expect(row).toEqual({
      vendorId: vendorA.id,
      vendorAssessmentId: vendorAssessmentA.id,
      questionnaireResponseId: responseA.id,
    });
  });

  it("rejects a second finding for the same response", async () => {
    await expect(
      runWithOrganizationContext(orgA.id, () =>
        callerA().finding.create({
          ...basePayload,
          title: "A second finding for the same response",
          questionnaireResponseId: responseA.id,
        }),
      ),
    ).rejects.toThrow(/already been created for this response/i);
  });

  it("rejects a response belonging to another organization", async () => {
    await expect(
      runWithOrganizationContext(orgA.id, () =>
        callerA().finding.create({
          ...basePayload,
          title: "Cross-org questionnaire response finding",
          questionnaireResponseId: responseB.id,
        }),
      ),
    ).rejects.toThrow(TRPCError);
  });

  it("does not apply the one-per-response guard to non-vendor creates", async () => {
    const first = await runWithOrganizationContext(orgA.id, () =>
      callerA().finding.create({ ...basePayload, title: "Plain finding number one" }),
    );
    const second = await runWithOrganizationContext(orgA.id, () =>
      callerA().finding.create({ ...basePayload, title: "Plain finding number two" }),
    );

    expect(first.id).not.toEqual(second.id);
    const rows = await db.finding.findMany({
      where: { id: { in: [first.id, second.id] } },
      select: { questionnaireResponseId: true, vendorId: true },
    });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.questionnaireResponseId === null && r.vendorId === null)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/integration/finding-create-questionnaire.test.ts`
Expected: FAIL. The first three tests fail because `questionnaireResponseId` is not in `createFindingInput`, so zod strips it and no linkage is written — the first assertion reports `vendorId: null`. (The fourth test passes already; that's the regression guard.)

- [ ] **Step 3: Add `questionnaireResponseId` to the input schema**

In `src/server/api/routers/finding.ts`, in `createFindingInput`, immediately after the `sourceRiskAssessmentQuestionId` line (currently `:147`) and before the closing `});`:

```ts
  // Vendor (TPRM) linkage — the finding was raised against a questionnaire
  // response. vendorId / vendorAssessmentId are DERIVED from this id server-side
  // (QuestionnaireResponse has no organizationId of its own), so a caller can't
  // attach a finding to a vendor the response doesn't belong to.
  questionnaireResponseId: z.string().optional(),
```

- [ ] **Step 4: Destructure it in the mutation**

In the `create` mutation's destructure (currently `:596-620`), add `questionnaireResponseId` alongside the other linkage fields — after `sourceRiskAssessmentQuestionId`:

```ts
        sourceRiskAssessmentQuestionId,
        questionnaireResponseId,
```

- [ ] **Step 5: Derive the vendor linkage and enforce one-per-response**

In the same mutation, insert this block after the `discoveryProjectId` validation block closes (currently `:659`, right before the `// AC25: Generate sequential identifier` comment):

```ts
      // Vendor (TPRM) linkage: walk response → questionnaire → assessment → vendor.
      // This walk is also the org check — QuestionnaireResponse has no
      // organizationId column, so ownership is only provable through the
      // assessment. Absorbed from the deleted createFromQuestionnaireResponse.
      let vendorLinkage: { vendorId: string; vendorAssessmentId: string } | null = null;
      if (questionnaireResponseId) {
        const response = await ctx.db.questionnaireResponse.findUnique({
          where: { id: questionnaireResponseId },
          select: {
            questionnaire: {
              select: {
                assessment: {
                  select: { id: true, organizationId: true, vendorId: true },
                },
              },
            },
          },
        });
        if (!response) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Questionnaire response not found",
          });
        }
        const assessment = response.questionnaire.assessment;
        if (assessment.organizationId !== organizationId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Assessment does not belong to this organization",
          });
        }

        // One finding per response (FR46). Only ever checked on the vendor path —
        // every other create flow leaves questionnaireResponseId undefined.
        const existing = await ctx.db.finding.findFirst({
          where: { questionnaireResponseId },
          select: { id: true },
        });
        if (existing) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "A finding has already been created for this response",
          });
        }

        vendorLinkage = {
          vendorId: assessment.vendorId,
          vendorAssessmentId: assessment.id,
        };
      }
```

- [ ] **Step 6: Write the linkage onto the created finding**

In the `tx.finding.create({ data: { ... } })` call, after the `sourceRiskAssessmentQuestionId` line (currently `:875`):

```ts
          sourceRiskAssessmentQuestionId: sourceRiskAssessmentQuestionId ?? null,
          // Vendor (TPRM) linkage — derived above, never client-supplied.
          questionnaireResponseId: questionnaireResponseId ?? null,
          vendorId: vendorLinkage?.vendorId ?? null,
          vendorAssessmentId: vendorLinkage?.vendorAssessmentId ?? null,
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx jest src/__tests__/integration/finding-create-questionnaire.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 8: Run the existing finding suites for regressions**

Run: `npx jest src/__tests__/integration/finding-creation.test.ts src/__tests__/unit/finding-assignment.test.ts`
Expected: PASS. Nothing in the create path changed for non-vendor callers — `vendorLinkage` stays `null` and the three new columns are written as `null`, which is what they already were.

- [ ] **Step 9: Commit**

```bash
git add src/server/api/routers/finding.ts src/__tests__/integration/finding-create-questionnaire.test.ts
git commit -m "feat(findings): finding.create accepts questionnaireResponseId and derives vendor linkage"
```

---

### Task 2: `CreateFindingForm` gains linkage props

**Files:**
- Modify: `src/components/findings/CreateFindingForm.tsx:167-197` (props + signature), `:283-299` (default source), `:335-367` (mutation payload)

**Interfaces:**
- Consumes: the `questionnaireResponseId` input from Task 1.
- Produces: `CreateFindingFormProps` additionally accepts `controlId?`, `complianceAssessmentId?`, `maturityAssessmentId?`, `maturityDomainId?`, `questionnaireResponseId?`, and `defaultSource?: FindingSource`. All are pass-through to `finding.create`; none render a control. `defaultTitle`, `onCreated`, `onCancel`, `returnTo` already exist and keep their meaning. Task 3 consumes this.

- [ ] **Step 1: Extend the props interface**

In `src/components/findings/CreateFindingForm.tsx`, replace the `CreateFindingFormProps` interface (`:167-187`) with:

```tsx
interface CreateFindingFormProps {
  /**
   * Assessment-scoped create (2026-07-06): the finding is recorded against
   * this risk-assessment project (PENDING until approval) and optionally
   * back-links the questionnaire question that surfaced it.
   */
  discoveryProjectId?: string;
  sourceRiskAssessmentQuestionId?: string;
  /**
   * Spawn linkage (2026-07-14): the finding was raised from a specific
   * compliance control, maturity domain, or vendor questionnaire response.
   * These are pass-through to finding.create and are deliberately NOT rendered
   * as form fields — a user must not be able to re-point a finding at a
   * different assessment. The server derives vendorId/vendorAssessmentId from
   * questionnaireResponseId.
   */
  controlId?: string;
  complianceAssessmentId?: string;
  maturityAssessmentId?: string;
  maturityDomainId?: string;
  questionnaireResponseId?: string;
  /** Prefill for question-spawned findings (question text / notes). */
  defaultTitle?: string;
  defaultDescription?: string;
  /**
   * Preselected source, by where the finding was spawned from (AUDIT for
   * assessments, MANUAL for vendor questionnaires). Still user-editable.
   */
  defaultSource?: FindingSource;
  /** When set, called after create instead of navigating to the finding. */
  onCreated?: (finding: { id: string; identifier: string }) => void;
  /** Cancel handler when hosted in a dialog (defaults to router.back()). */
  onCancel?: () => void;
  /**
   * Where to navigate after a successful create (e.g. back to the source
   * assessment tab). Defaults to the new finding's detail page.
   */
  returnTo?: string;
}
```

- [ ] **Step 2: Destructure the new props**

Replace the component signature (`:189-197`) with:

```tsx
export function CreateFindingForm({
  discoveryProjectId,
  sourceRiskAssessmentQuestionId,
  controlId,
  complianceAssessmentId,
  maturityAssessmentId,
  maturityDomainId,
  questionnaireResponseId,
  defaultTitle,
  defaultDescription,
  defaultSource,
  onCreated,
  onCancel,
  returnTo,
}: CreateFindingFormProps = {}) {
```

- [ ] **Step 3: Honour `defaultSource` in the form defaults**

In the `useForm` call (`:283-299`), replace the `source` default line:

```tsx
      // Spawn-site default (AUDIT from assessments, MANUAL from vendor
      // questionnaires); risk-assessment projects keep RISK_ASSESSMENT.
      source:
        defaultSource ??
        (discoveryProjectId ? FindingSource.RISK_ASSESSMENT : undefined),
```

- [ ] **Step 4: Pass the linkage into the mutation**

In `onSubmit`'s `createMutation.mutateAsync({ ... })` call, replace the trailing assessment-scope block (`:363-366`) with:

```tsx
          // Assessment-scoped create: gated PENDING until project approval,
          // optionally back-linking the source questionnaire question.
          discoveryProjectId,
          sourceRiskAssessmentQuestionId,
          // Spawn linkage (2026-07-14). controlId also auto-creates an
          // OBSERVATION ControlLink server-side; questionnaireResponseId makes
          // the server derive the vendor + vendor-assessment ids.
          controlId,
          complianceAssessmentId,
          maturityAssessmentId,
          maturityDomainId,
          questionnaireResponseId,
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: `225` — the known baseline, unchanged. If the count is higher, the new errors are yours; fix them before committing.

- [ ] **Step 6: Commit**

```bash
git add src/components/findings/CreateFindingForm.tsx
git commit -m "feat(findings): CreateFindingForm accepts control/assessment/vendor linkage props"
```

---

### Task 3: Rebuild `CreateFindingDialog` as a wrapper

**Files:**
- Rewrite: `src/components/findings/CreateFindingDialog.tsx` (entire file — same path, new body)

**Interfaces:**
- Consumes: `CreateFindingForm` from Task 2.
- Produces: `CreateFindingDialog` with props `open`, `onOpenChange`, `initialTitle?`, `initialSource?`, `contextLabel?`, `controlId?`, `complianceAssessmentId?`, `maturityAssessmentId?`, `maturityDomainId?`, `questionnaireResponseId?`, `onCreated?: () => void`. **`initialDescription` and `initialSeverity` are removed** — the risk statement is never prefilled and severity is derived from matrix scoring inside the form. Tasks 4-6 consume this.

- [ ] **Step 1: Replace the file wholesale**

Overwrite `src/components/findings/CreateFindingDialog.tsx` with:

```tsx
"use client";

/**
 * "Create Finding" dialog.
 *
 * Modal chrome around the one real finding form (CreateFindingForm — the same
 * component served at /findings/new). This file owns the dialog, the context
 * chip, and the scroll container; it owns no form logic. Spawned from compliance
 * assessments, maturity assessments, and TPRM questionnaire responses, each of
 * which passes its own linkage ids straight through to finding.create.
 *
 * Prior to 2026-07-14 this was a separate, much leaner form (title/description/
 * source/severity only). It drifted from /findings/new and was replaced.
 */

import { toast } from "sonner";
import Link from "next/link";
import type { FindingSource } from "@prisma/client";
import { api } from "@/trpc/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CreateFindingForm } from "@/components/findings/CreateFindingForm";

export interface CreateFindingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefilled title (e.g. "AC-1 — Access Control Policy"). Title only — the
   *  risk statement is deliberately left blank for the user to write. */
  initialTitle?: string;
  /** Preselected source: AUDIT from assessments, MANUAL from vendor questionnaires. */
  initialSource?: FindingSource;
  /** Small chip shown above the form, e.g. "Spawned from GV — Govern". */
  contextLabel?: string;
  /** Linkage — set by the caller based on where the dialog was opened. */
  controlId?: string;
  complianceAssessmentId?: string;
  maturityAssessmentId?: string;
  maturityDomainId?: string;
  questionnaireResponseId?: string;
  /** Extra cache invalidation for the host page, after the shared ones run. */
  onCreated?: () => void;
}

export function CreateFindingDialog(props: CreateFindingDialogProps) {
  const utils = api.useUtils();

  const handleCreated = (finding: { id: string; identifier: string }) => {
    toast.success(
      <span>
        Finding <strong>{finding.identifier}</strong> created —{" "}
        <Link href={`/findings/${finding.id}`} className="underline" target="_blank">
          open
        </Link>
      </span>
    );

    // Refresh the "Findings from this assessment" list in-place.
    if (props.complianceAssessmentId) {
      void utils.finding.listForAssessment.invalidate({
        assessmentId: props.complianceAssessmentId,
        assessmentType: "COMPLIANCE",
      });
    }
    if (props.maturityAssessmentId) {
      void utils.finding.listForAssessment.invalidate({
        assessmentId: props.maturityAssessmentId,
        assessmentType: "MATURITY",
      });
    }
    void utils.finding.list.invalidate();
    props.onCreated?.();
    props.onOpenChange(false);
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      {/* The full finding form is tall — cap the dialog and scroll inside it. */}
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create finding</DialogTitle>
          <DialogDescription>
            Capture an issue spotted during this assessment. It&apos;ll be linked
            back automatically so you can pick it up in the Findings register.
          </DialogDescription>
          {props.contextLabel ? (
            <Badge variant="secondary" className="mt-2 w-fit font-normal">
              {props.contextLabel}
            </Badge>
          ) : null}
        </DialogHeader>

        {/*
          Remount the form on each new spawn context so prefill and scoring
          state reset — CreateFindingForm seeds react-hook-form from props in
          defaultValues, which only reads on mount.
        */}
        <CreateFindingForm
          key={`${props.controlId ?? ""}:${props.maturityDomainId ?? ""}:${props.questionnaireResponseId ?? ""}:${props.initialTitle ?? ""}`}
          defaultTitle={props.initialTitle}
          defaultSource={props.initialSource}
          controlId={props.controlId}
          complianceAssessmentId={props.complianceAssessmentId}
          maturityAssessmentId={props.maturityAssessmentId}
          maturityDomainId={props.maturityDomainId}
          questionnaireResponseId={props.questionnaireResponseId}
          onCreated={handleCreated}
          onCancel={() => props.onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
```

The `key` prop is load-bearing. `CreateFindingForm` seeds `defaultTitle` through react-hook-form's `defaultValues`, which is read only on mount — without the remount, clicking "Finding" on a second control would show the first control's title. The old dialog solved this with a `useEffect` re-hydrate (`:90-97`); a remount is the equivalent and doesn't require the form to know it's in a dialog.

- [ ] **Step 2: Confirm `Badge` exists at that path**

Run: `ls src/components/ui/badge.tsx`
Expected: the file exists. If it does not, replace the `<Badge>` with `<p className="mt-2 text-xs text-muted-foreground">{props.contextLabel}</p>` and drop the import.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: **higher than 225.** The three call sites still pass `initialDescription` / `initialSeverity`, which no longer exist. That is expected and is fixed by Tasks 4-6. Confirm every new error is one of those three files:

Run: `npx tsc --noEmit 2>&1 | grep -E "compliance/assessments|maturity/|samm-checklist|tprm/"`

- [ ] **Step 4: Do not commit yet**

This task leaves the tree not type-clean by design. Commit at the end of Task 6, when the call sites are migrated. (If you are running task-by-task with a review gate, note this in your handoff.)

---

### Task 4: Compliance assessment call site

**Files:**
- Modify: `src/app/compliance/assessments/[id]/client.tsx:1648-1662`

**Interfaces:**
- Consumes: `CreateFindingDialog` from Task 3.
- Produces: nothing downstream.

- [ ] **Step 1: Update the dialog invocation**

In `src/app/compliance/assessments/[id]/client.tsx`, find the `<CreateFindingDialog ... />` element (around `:1648`). Keep `open`, `onOpenChange`, and the existing `findingContext` state exactly as they are. Change the prefill and drop the description:

```tsx
        <CreateFindingDialog
          open={findingDialogOpen}
          onOpenChange={setFindingDialogOpen}
          initialTitle={
            findingContext
              ? `${findingContext.controlCode} — ${findingContext.controlTitle}`
              : undefined
          }
          initialSource="AUDIT"
          contextLabel={
            findingContext
              ? `Spawned from ${findingContext.controlCode} — ${findingContext.controlTitle}`
              : undefined
          }
          controlId={findingContext?.controlId}
          complianceAssessmentId={assessment.id}
        />
```

The `initialDescription` prop is gone — the risk statement is written by the user (Global Constraints). `findingContext.controlDescription` is now unused by the dialog; leave the state field in place if anything else reads it, and delete it from the `findingContext` type only if nothing does.

- [ ] **Step 2: Verify no other props were passed**

Run: `grep -n "CreateFindingDialog" -A 14 src/app/compliance/assessments/\[id\]/client.tsx`
Expected: only the props listed above. No `initialDescription`, no `initialSeverity`, no `maturity*`.

- [ ] **Step 3: Continue to Task 5** (still not type-clean until Task 6)

---

### Task 5: Maturity assessment call sites

**Files:**
- Modify: `src/app/maturity/[id]/client.tsx:2872-2884`
- Modify: `src/components/maturity/samm-checklist.tsx` (its `CreateFindingDialog` usage)

**Interfaces:**
- Consumes: `CreateFindingDialog` from Task 3.
- Produces: nothing downstream.

- [ ] **Step 1: Update the maturity page dialog**

In `src/app/maturity/[id]/client.tsx`, update the `<CreateFindingDialog ... />` element (around `:2872`). Keep the existing open state and the context set by `openFindingForControl` (`:2329-2342`). Set maturity linkage only — **never** `controlId` or `complianceAssessmentId` (Global Constraints):

```tsx
        <CreateFindingDialog
          open={findingDialogOpen}
          onOpenChange={setFindingDialogOpen}
          initialTitle={
            findingContext
              ? `${findingContext.controlCode} — ${findingContext.controlTitle}`
              : undefined
          }
          initialSource="AUDIT"
          contextLabel={
            findingContext
              ? `Spawned from ${findingContext.controlCode} — ${findingContext.controlTitle}`
              : undefined
          }
          maturityAssessmentId={assessment.id}
          maturityDomainId={findingContext?.domainId}
        />
```

Match the existing field names on `findingContext` — if the maturity page's context object names them differently than the compliance page's, use its names rather than renaming the state.

- [ ] **Step 2: Update the SAMM checklist dialog the same way**

Run: `grep -n "CreateFindingDialog" -B 2 -A 14 src/components/maturity/samm-checklist.tsx`

Apply the same edit: drop `initialDescription` and `initialSeverity`, add `initialSource="AUDIT"`, keep `maturityAssessmentId` / `maturityDomainId` and the `contextLabel`.

- [ ] **Step 3: Confirm no maturity call site sets compliance linkage**

Run: `grep -rn "complianceAssessmentId\|controlId" src/app/maturity/\[id\]/client.tsx src/components/maturity/samm-checklist.tsx`
Expected: no hits inside a `CreateFindingDialog` usage.

- [ ] **Step 4: Continue to Task 6**

---

### Task 6: TPRM questionnaire response call site

**Files:**
- Modify: `src/app/tprm/questionnaires/responses/[id]/client.tsx` — delete the bespoke dialog (`:303-360`), its submit handler (`:159-168`), its local `title`/`description`/`scoring` state, and the `createFromQuestionnaireResponse` mutation hook (`:124`); replace with `CreateFindingDialog`

**Interfaces:**
- Consumes: `CreateFindingDialog` from Task 3.
- Produces: no client caller of `finding.createFromQuestionnaireResponse` remains — Task 7 depends on this.

- [ ] **Step 1: Read the current dialog and its state**

Run: `grep -n "createFromQuestionnaireResponse\|openCreateFindingDialog\|useState\|Dialog" src/app/tprm/questionnaires/responses/\[id\]/client.tsx | head -40`

Identify: the mutation hook, the open state, the per-response context state (which response was clicked), and the title prefill (`"Concern: …"`, built in `openCreateFindingDialog` at `:143-157`).

- [ ] **Step 2: Replace the bespoke dialog with the shared one**

Delete the inline `<Dialog>…</Dialog>` block (`:303-360`), the `handleCreateFinding` submit function, the `title`/`description`/`scoring` local state, and the `api.finding.createFromQuestionnaireResponse.useMutation(...)` hook. Keep the open state and the "which response was clicked" state. Render instead:

```tsx
        <CreateFindingDialog
          open={createFindingOpen}
          onOpenChange={setCreateFindingOpen}
          initialTitle={findingContext?.title}
          initialSource="MANUAL"
          contextLabel={findingContext?.contextLabel}
          questionnaireResponseId={findingContext?.responseId}
          onCreated={() => {
            // The response row shows a "finding created" state — refetch it.
            void utils.questionnaire.getResponses.invalidate();
          }}
        />
```

Add the import:

```tsx
import { CreateFindingDialog } from "@/components/findings/CreateFindingDialog";
```

Reshape `openCreateFindingDialog` (`:143-157`) so it sets `findingContext` to `{ responseId, title, contextLabel }`. The title keeps the existing `"Concern: …"` prefill. The markdown context block that used to be stuffed into the description becomes the `contextLabel` — collapse it to a single line (e.g. `` `${vendorName} — ${questionText}` ``); it is a chip, not a document.

Match `utils.questionnaire.getResponses.invalidate()` to whatever query the page actually uses to list responses — read the page's `api.…useQuery` call and invalidate that one.

- [ ] **Step 3: Confirm the old mutation has no callers left**

Run: `grep -rn "createFromQuestionnaireResponse" src/`
Expected: hits **only** in `src/server/api/routers/finding.ts`. If any client file still references it, finish migrating that file before continuing.

- [ ] **Step 4: Typecheck — must be back to baseline**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: `225`. Tasks 3-6 are now internally consistent. If the count is above 225, list the new errors and fix them:

Run: `npx tsc --noEmit 2>&1 | grep -E "findings/|compliance/|maturity/|tprm/"`

- [ ] **Step 5: Run the finding test suites**

Run: `npx jest src/__tests__/integration/finding-create-questionnaire.test.ts src/__tests__/integration/finding-creation.test.ts`
Expected: PASS. (These are server tests; the client rewrite can't affect them, but they confirm Task 1 still holds.)

- [ ] **Step 6: Commit Tasks 3-6 together**

```bash
git add src/components/findings/CreateFindingDialog.tsx \
        src/app/compliance/assessments/\[id\]/client.tsx \
        src/app/maturity/\[id\]/client.tsx \
        src/components/maturity/samm-checklist.tsx \
        src/app/tprm/questionnaires/responses/\[id\]/client.tsx
git commit -m "feat(findings): every spawn site uses the real finding form

CreateFindingDialog is now modal chrome around CreateFindingForm — the same
component served at /findings/new. Compliance, maturity, and TPRM all get the
full form (risk statement, taxonomy, MITRE, control links, residual scoring,
remediation options, business units, assignee) instead of four fields."
```

---

### Task 7: Delete the dead server paths

**Files:**
- Modify: `src/server/api/routers/finding.ts:2070-2270ish` (delete `createFromQuestionnaireResponse`)
- Modify: `src/server/api/routers/riskAssessmentQuestionnaire.ts:111-117, 468-503` (delete `SPAWN_INPUT` and `spawn`)

**Interfaces:**
- Consumes: Task 6 (no client callers remain).
- Produces: `finding.create` is the only finding-creation mutation in the app.

- [ ] **Step 1: Re-confirm both are unreferenced**

Run: `grep -rn "createFromQuestionnaireResponse" src/ && grep -rn "questionnaire\.spawn\|\.spawn(" src/`
Expected: `createFromQuestionnaireResponse` appears only in its own definition in `finding.ts`; `spawn` appears only in its own definition in `riskAssessmentQuestionnaire.ts`. **If either has a caller you did not expect, stop and report it** — do not delete a live path.

- [ ] **Step 2: Delete `createFromQuestionnaireResponse`**

In `src/server/api/routers/finding.ts`, delete the whole procedure — from its leading doc comment (`/** Create a finding from a questionnaire response … */`, around `:2069`) through the closing `}),` of its `.mutation()`. Its behavior now lives in `create` (Task 1).

- [ ] **Step 3: Delete `spawn` and its input schema**

In `src/server/api/routers/riskAssessmentQuestionnaire.ts`, delete the `spawn` procedure (`:468-503`) and the now-unused `SPAWN_INPUT` schema (`:111-117`). It had no client caller, hand-rolled its own identifier generator instead of `generateIdentifier`, and created findings with no matrix scoring — a fifth create path that could only drift.

- [ ] **Step 4: Clean up newly-unused imports**

Run: `npx tsc --noEmit 2>&1 | grep -E "finding\.ts|riskAssessmentQuestionnaire\.ts"`

Delete any import or helper that only the removed procedures used. `FindingSource` and `Severity` are still used elsewhere in `finding.ts` — check before removing anything.

- [ ] **Step 5: Typecheck and test**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: `225`.

Run: `npx jest src/__tests__/integration/`
Expected: PASS. A failure here naming `createFromQuestionnaireResponse` means an existing test covered the deleted mutation — port that test's assertions onto `finding.create` with `questionnaireResponseId` rather than deleting the test.

- [ ] **Step 6: Commit**

```bash
git add src/server/api/routers/finding.ts src/server/api/routers/riskAssessmentQuestionnaire.ts
git commit -m "refactor(findings): delete createFromQuestionnaireResponse and dead questionnaire spawn

finding.create is now the only finding-creation mutation."
```

---

### Task 8: End-to-end verification

**Files:** none — this task changes no code. It proves the four paths work.

**Interfaces:**
- Consumes: Tasks 1-7.

- [ ] **Step 1: Full typecheck and test run**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: `225` (baseline — no new errors).

Run: `npx jest`
Expected: PASS, with the new `finding-create-questionnaire.test.ts` among them.

- [ ] **Step 2: Rebuild the Docker app**

The app does **not** hot-reload; none of the UI changes are live until this runs. Rebuild and restart the container, then wait for it to come up before touching the browser.

- [ ] **Step 3: Drive the compliance path**

Open a compliance assessment, click **Finding** on a control row. Confirm:
- The dialog shows the **full** form (source, risk statement, control domain, MITRE, control links, residual scoring, remediation options, business units, assignee, pathway) — not four fields.
- Title is prefilled `"{code} — {title}"`. **Risk statement is empty.**
- Source is preselected **Audit** and is changeable.
- The context chip names the control.
- Submit. The finding is created; the Findings tab of the assessment shows it without a manual refresh.
- In the DB, the row has `sourceComplianceAssessmentId` set, a `FindingControlLink` with `linkType = OBSERVATION`, and `sourceMaturityAssessmentId = NULL`.

- [ ] **Step 4: Drive the maturity path**

Same, from a maturity domain/practice row. Confirm source defaults to **Audit**, and the row has `sourceMaturityAssessmentId` + `sourceMaturityDomainId` set and `sourceComplianceAssessmentId = NULL`.

- [ ] **Step 5: Drive the TPRM path**

From a questionnaire response, click **Create Finding**. Confirm:
- The full form appears, title prefilled `"Concern: …"`, source preselected **Manual**.
- Submit. The row has `questionnaireResponseId`, `vendorId`, and `vendorAssessmentId` set — the vendor ids were derived server-side, never sent by the client.
- Click **Create Finding** on the **same response** again and submit: it is rejected with "A finding has already been created for this response".

- [ ] **Step 6: Regression — the two paths that already used the form**

- `/findings/new` still creates a finding with no linkage (all six linkage columns `NULL`).
- A risk-assessment project's Findings tab still creates a `PENDING` finding with `discoveryProjectId` set and source defaulted to **Risk Assessment** (proving `defaultSource` didn't clobber the existing default).

- [ ] **Step 7: Check the nested dialog**

Inside the create-finding dialog, click **Create New** next to Business Units. The business-unit quick-create dialog is a dialog inside a dialog. Confirm it opens above the form, creates the BU, selects it, and closes without dismissing the finding dialog underneath.

- [ ] **Step 8: Commit any fixes, then report**

Report what you actually observed for each of steps 3-7, including anything that did not work. Do not claim the feature works without having driven it.

---

## Notes for the implementer

- **The two NIST CSFs.** This codebase has a compliance NIST CSF and a maturity NIST CSF; they are different subsystems. If you find yourself in a file that mentions CSF, check which one before assuming the linkage columns.
- **`RiskItemCard` is shared** with the risk-assessment form (`variant="finding"` switches off Treatment). Do not modify it for this work; if it seems to need a change, that is a signal you have gone outside scope.
- **The form collects some fields it never submits** (`mitigatingControlsInPlace`, `preventativeControls*`, `evidenceIds`, `enterpriseRiskId`, `controlLinkIds`, `treatment*` — `CreateFindingForm.tsx:92-121` vs `:335-367`). That is pre-existing and out of scope. Do not "fix" it here.
