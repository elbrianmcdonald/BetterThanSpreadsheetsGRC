# Security & Correctness Findings — Better Than Spreadsheets GRC

**Date:** 2026-07-13
**Author:** Claude (via BMAD `generate-project-context` follow-up)
**Scope:** Multi-tenant data isolation, RBAC, audit logging. Triggered by writing `project-context.md`.
**Status:** Investigation complete. **Phase 1 remediation applied and verified end-to-end against the running container** (uncommitted). Phases 2–4 outstanding.

> **Update — Phase 1 complete.** V1, V2, V3 fixed and verified (see each finding). Fixing V3 exposed **V9**, a second, independent defect in the same audit writes: they passed `userId: "system"`, a string that is not a `User` row, violating `AuditLog_userId_fkey`. Both layers are now fixed. V4 (the structural read passthrough) is deliberately **not** addressed — it remains Phase 3.

---

## Executive summary

The multi-tenancy design is sound: a Prisma client extension injects `organizationId` into every query, sourced from an `AsyncLocalStorage` store. The problem is that **the store is only ever populated by `organizationProcedure`**, and the extension's behaviour when the store is empty is inconsistent:

| Operation | Behaviour with no org context | Consequence |
| --- | --- | --- |
| **Read** | Passes through **unfiltered** (`organization-filter.ts:328-330`) | Silent cross-tenant disclosure |
| **Write** | **Throws** (`handleCreate:363`, `handleUpdate:406`, `handleDelete:444`) | Silent feature breakage where the throw is caught |

That single asymmetry is the root cause of findings **V1–V4** below. Reads leak; writes break. Both fail quietly.

The extension's own doc comment (`organization-filter.ts:242`) states the intended contract — *"Missing organization context → Throw error for protected operations"* — so reads were simply never hardened to match the design.

**Highest priority:** V1 (unauthenticated, live) and V2 (audit trail silently not written — a compliance defect in a compliance product).

---

## Verified findings

Each of these I confirmed myself by reading the implementation and, where noted, by exercising the running container. They are not inferences.

### V1 — Unauthenticated cross-tenant aggregate disclosure — **CRITICAL — FIXED & VERIFIED**

`verifyCronRequest()` is called in the `POST` handler but **not in `GET`**:

- `src/app/api/cron/finding-sla-breach/route.ts:33` (POST, guarded) vs `:65` (GET, **unguarded**)
- `src/app/api/cron/treatment-sla-breach/route.ts:33` (POST, guarded) vs `:65` (GET, **unguarded**)

`GET` calls `getSlaBreachStats()` → `finding.count()` ×3 with **no org context**, so the counts span **every tenant**.

**Reproduced live against the running container (no credentials):**

```
$ curl -s -o /dev/null -w "%{http_code}" http://localhost/api/cron/finding-sla-breach
200
$ curl -s http://localhost/api/cron/finding-sla-breach
{"status":"ok","endpoint":"finding-sla-breach", ... "stats":{"breached":0,"atRisk":0,"onTrack":0}}

$ curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost/api/cron/finding-sla-breach
401
```

**Impact today is nil** — the demo database has no breached findings, so the counts are zero. But the endpoint is public and the query is unfiltered; with real data it discloses cross-tenant finding and treatment SLA posture to any anonymous caller.

**Fix applied:** `verifyCronRequest(request)` now guards both `GET` handlers (`finding-sla-breach/route.ts:68`, `treatment-sla-breach/route.ts:68`).

**Verified** after a Docker image rebuild:

```
unauthenticated GET  /api/cron/finding-sla-breach    -> 401   (was 200 + cross-tenant stats)
unauthenticated GET  /api/cron/treatment-sla-breach  -> 401   (was 200 + cross-tenant stats)
authorized    GET  (Bearer CRON_SECRET)              -> 200   (legitimate caller still works)
authorized    POST (Bearer CRON_SECRET)              -> 200
```

`/api/cron/evidence-request-reminders` has the same unguarded `GET`, but it returns a **static** payload with no DB access — it leaks nothing, so it was left open as a genuine health check.

---

### V2 — Audit logs are silently dropped on every system path — **HIGH (compliance) — FIXED**

`AuditLog` is **not** in `ALLOWLIST_TABLES`, so `db.auditLog.create()` hits `handleCreate` and **throws** without org context (`organization-filter.ts:363`). `createAuditLog` then **swallows the exception** (`src/server/services/audit-log.service.ts:121-125` — `console.error` only, by design, "fire-and-forget").

Net effect: on any context-less path, the audit entry **is never written and nothing surfaces the failure**.

Confirmed affected call sites:

- **`src/app/api/evidence/[evidenceId]/download/route.ts:100`** — the route establishes no org context (no `runWithOrganizationContext`; verified). The `DOWNLOAD_EVIDENCE` event **never persists**. This is the auditor-access trail.
- `src/server/workers/emailWorker.ts:177` — `EMAIL_SEND_FAILED`, double-swallowed at `:198`.
- `src/server/services/evidence-request-reminder.service.ts:122`, `:175` — reminder events.

**Why this matters more than it looks:** the product's value proposition is an audit trail. A trail that silently omits evidence downloads is worse than no trail, because it is trusted.

**Fix applied:** each path now wraps its audit write in `runWithOrganizationContext(orgId, …)` — the orgId was always available locally:

- `api/evidence/[evidenceId]/download/route.ts:100` — wrapped with `evidence.organizationId`.
- `workers/emailWorker.ts:175` — wrapped with `email.organizationId`.
- `services/evidence-request-reminder.service.ts:100,155` — each loop iteration wrapped in its request's org context (also covers the `controlDomain` read).

`createAuditLog` still **never throws** — callers use `void createAuditLog(...)`, so throwing would become an unhandled rejection and crash the process; a failed audit write must not take down the mutation it records. Instead the swallow is now **unmissable in logs** (`audit-log.service.ts:121`): it emits `[AuditLog] ENTRY DROPPED — action=… entityId=… organizationId=…` naming the lost entry.

> The download route's *read* at `:52` still runs without org context (safe today via the manual check at `:70`). Hardening it would turn the 403 into a 404 — deferred to Phase 3 rather than change user-visible behaviour in a hotfix.

---

### V3 — SLA cron jobs cannot mark anything breached — **HIGH (silent feature failure) — FIXED & VERIFIED**

Same root cause, write side:

- `src/server/services/finding-sla-breach.service.ts:75` — `finding.updateMany` throws (no context), caught by the outer `try` at `:37`. Job returns `breachedCount: 0` plus a populated `errors` array.
- `src/server/services/treatment-sla-breach.service.ts:78` — `riskTreatment.updateMany`, identical.

The jobs successfully *read* the overdue rows (thanks to the read passthrough) and then **fail to write**, every run. The SLA breach feature does not work.

Also dead: `treatment-sla-breach.service.ts:170 processTreatmentSlaAtRisk` has **no caller** — the "at risk" notification never runs at all.

**Fix applied:** both services now group the swept rows by `organizationId` and perform the writes inside each org's own context via `runWithOrganizationContext`. The cross-org *read* stays as-is (it is a deliberate all-org sweep; Phase 3 will give it an explicit system context).

**Verified end-to-end** — inserted a genuinely overdue `Finding`, ran the job, inspected the database, then removed the probe row:

```
BEFORE:  slaBreached = f   auditRows = 0
POST /api/cron/finding-sla-breach (authorized)
   -> {"success":true,"processedCount":1,"breachedCount":1,"errors":[]}
AFTER:   slaBreached = t
         audit entry: FINDING_SLA_BREACHED | userId=NULL | actor=SYSTEM | org=550e8400-…0001
```

Before the fix this same job returned `breachedCount: 0` with a populated `errors` array. Probe row and its audit entry were deleted afterwards (residue verified: 0 rows).

---

### V9 — Audit writes used a non-existent `userId: "system"` — **HIGH — FIXED & VERIFIED**

*(Found only by actually running the fixed job — it was hidden behind V2/V3.)*

With the org-context problem fixed, the audit write got further and then failed on:

```
Foreign key constraint violated on the constraint: `AuditLog_userId_fkey`
```

Four call sites passed the literal string `userId: "system"`, which is not a `User` row. `AuditLog.userId` is **nullable precisely for system actions** (`audit-log.service.ts:108` — *"Nullable for SYSTEM actions (AC8)"*), and `emailWorker.ts` already did it correctly with `userId: null` + `actorName/actorRole: "SYSTEM"`.

So these entries were broken **twice over** — they would have failed even with org context. Fixed at all four sites to `userId: null` with SYSTEM actor snapshots:

- `services/finding-sla-breach.service.ts:104`
- `services/treatment-sla-breach.service.ts:107`
- `services/evidence-request-reminder.service.ts:130`, `:185`

Verified: the audit entry now lands (`errors: []`, row present with `userId=NULL`, `actorName=SYSTEM`).

---

### V4 — Silent unfiltered read passthrough — **HIGH (latent)**

`organization-filter.ts:328-330`:

```ts
// If no organization context, allow query (for system operations)
if (!orgId) {
  return query(args);
}
```

Any read of a non-allowlisted model reached without org context returns **rows from all tenants**, with no error. Today the reachable instances are guarded by manual `where` clauses or by luck (V1 is the one that isn't). It is one careless `protectedProcedure` away from a full record-level leak.

Compounding factor: **~90 models are exempt from filtering entirely** via `ALLOWLIST_TABLES` (`:119-228`), including `User`, `OrganizationMembership`, `Goal`, `Objective`, `Comment`, `StandardControl`. Those *always* require hand-filtering. `src/server/db.ts:35-41` declares a `MULTI_TENANT_MODELS` constant that **contradicts the allowlist** (it lists `User` as filtered — it is not). That constant is dead code and should be deleted before someone trusts it.

**Fix:** make reads fail closed, with an explicit `runWithSystemContext()` escape hatch for genuine cross-org work. This is the extension's documented intent. It cannot be done safely until the legitimate cross-org callers (below) are migrated.

---

### V5 — Broken role procedures — **FIXED (uncommitted)**

`src/server/api/trpc.ts` exported five per-persona procedures with **zero call sites** and role arrays left stale by the 8→4 role consolidation:

- `engineerProcedure` = `requireRole([ANALYST, ANALYST])` — duplicated member
- `stakeholderProcedure` = `[BUSINESS_USER, BUSINESS_USER]` — duplicated member
- **`cisoProcedure` = `[MANAGER, ANALYST]` — excludes `ADMINISTRATOR`**

Their doc comments still described the deleted roles (`SECURITY_ENGINEER`, `GRC_ANALYST`, `CISO`), so the sed sweep rewrote the enum members without revisiting the intent. Had anyone adopted `cisoProcedure`, admins would have been locked out of their own dashboards.

**Action taken:** all five deleted; `adminProcedure` retained; a comment now directs callers to the canonical idiom `organizationProcedure.use(requireRole(TIER))` using the tiers in `src/lib/auth/roles.ts`. Typecheck clean.

---

### V6 — `npm run typecheck` is red on `master` — **MEDIUM (process)**

The project's **only** static gate (there is no linter — no ESLint/Prettier/Biome config, no `lint` script) currently reports **225 errors**:

- **223** in `src/__tests__/**`
- **2** in `e2e/epic2.spec.ts`
- **0** in application source (`src/app`, `src/components`, `src/server`)

The Docker build ships green because `.dockerignore` excludes `__tests__` and `*.test.ts(x)` from the image, so those errors never reach `next build`.

**Consequence:** "run typecheck before committing" is not actionable as stated — a contributor cannot distinguish their own breakage from the 225. The usable bar is *"introduce no new errors; keep app source at zero."*

---

### V7 — Two toast libraries mounted simultaneously — **FIXED (uncommitted)**

`src/app/layout.tsx:26-27` rendered **both** `<ToasterProvider/>` (react-hot-toast, hardcoded hex styling) and `<Toaster/>` (sonner, token-themed). 31 files used the legacy library, 123 used sonner.

**Action taken:** migrated the 30 remaining source files to sonner (import-line change only — the call surface was exclusively `toast.error`/`toast.success`, no options objects, no `toast()`/`loading`/`promise`), deleted `ToasterProvider.tsx`, removed the second mount, dropped the `react-hot-toast` dependency, fixed the stale `expectToast` docstring in `e2e/support/helpers.ts`. Typecheck clean.

> **Not runtime-verified.** The container runs a *production image*; confirming toast rendering requires an image rebuild.

---

### V8 — Three docs actively contradict the code — **MEDIUM**

- **`docs/MULTI_TENANT_ARCHITECTURE.md`** (635 lines) states *"Automatic query filtering is NOT implemented… Developers MUST manually filter"* (`:40`, `:150-154`, `:569`). **This is false** — the extension exists and filters. It also documents the deleted 8-role enum and a `User.role` column that no longer exists. It is superseded by the accurate `docs/MULTI_TENANCY.md` (248 lines). Its only inbound reference is an `@see` comment in `src/__tests__/integration/multi-tenant-data-isolation.test.ts:15`.
- **`docs/RBAC-UI-COMPONENTS.md`** — every example uses `ORG_ADMIN` / `GRC_ANALYST` / `SECURITY_ENGINEER` / `CISO` and `Permission.RISK_APPROVE`, none of which exist. The component API is still accurate; the role names are not.
- **`docs/AUDIT_LOGGING.md`** and **`docs/DATABASE_SCHEMA.md`** also carry dead role names.

A newcomer reading `MULTI_TENANT_ARCHITECTURE.md` builds precisely the wrong mental model of the isolation guarantee. **Recommend deleting it** (superseded) and correcting role names in the rest.

---

## Reported but NOT independently verified

Surfaced by a research agent; the reasoning looked sound but **I did not confirm these myself**. Treat as leads, not facts.

| # | Finding | Why it matters |
| --- | --- | --- |
| U1 | **`complianceJobQueue` cross-tenant write.** `src/server/services/complianceJobQueue.ts:94-99` schedules a `setTimeout` inside the *caller's* AsyncLocalStorage context. The timer inherits **org A's** context, then `processNextJob()` (`:134`) may pick up **org B's** job and write `FrameworkCoverage` under org A's filter. | If real, this is a cross-tenant **write**, worse than a read leak. Timing-dependent, not deterministic. **Verify first.** |
| U2 | **`myAssignments` uses `protectedProcedure`** (`:64 getAll`, `:325 getSummary`) and touches non-allowlisted `Person`, `RiskTreatment`, `ComplianceAssessment`. Escapes leaking only because every `where` manually re-adds `organizationId`. | One forgotten `where` from a leak. Should be `organizationProcedure`. |
| U3 | **`worker.getMetrics`** (`src/server/api/routers/worker.ts:36`) counts **all** `EmailQueue` rows with no org filter (`emailWorker.ts:217-224`). `EmailQueue` is allowlisted, so the extension won't help. | Cross-tenant queue-volume disclosure to any user with `CAN_VIEW_WORKER_METRICS`. |
| U4 | **`controlDomain` existence oracle** (`:477`, `:499`) — junction tables queried by caller-supplied id with no org predicate. | Low: leaks only global-taxonomy tags of another org's control. `:525`/`:560` do it correctly — copy those. |

---

## Legitimate cross-org callers (blockers for the V4 fix)

These *must* keep working across orgs. They currently rely on the read passthrough and will break the moment reads fail closed. Each needs an explicit system-context escape hatch (or, better, a per-org loop).

| Caller | Model (not allowlisted) | Invoked from |
| --- | --- | --- |
| `services/vendorReviewAlertsWorker.ts:65,239,248` | `Vendor` | `instrumentation.ts:45` → `workers/scheduler.ts:318` (nightly, all orgs) |
| `services/finding-sla-breach.service.ts:41,138,148,159` | `Finding` | `api/cron/finding-sla-breach` |
| `services/treatment-sla-breach.service.ts:45,139,146,154,187` | `RiskTreatment` | `api/cron/treatment-sla-breach` |
| `services/evidence-request-reminder.service.ts:51,72` | `EvidenceRequest` | `api/cron/evidence-request-reminders` |
| `api/routers/vendorPortal.ts:170,379` | `QuestionnaireTemplate` | `publicProcedure`, token-auth external vendor — **no session by design**. Best fixed by deriving orgId from the already-loaded `questionnaire.assessment.organizationId` and wrapping, not by a blanket bypass. |
| `services/buScopedMigration.ts:191`, `lib/matrix/seedDefaults.ts:206` | Evidence, BusinessUnit, Framework, … | **Currently unreachable** (no callers). Flagged so they aren't wired up naively later. |

Also note: `src/app/api/evidence/[evidenceId]/download/route.ts:52` reads non-allowlisted `Evidence` with no context — safe today only via a manual check at `:70`, but it **will throw** once reads harden. Its sibling `version/[versionId]/download/route.ts:47` is safe purely by luck (`EvidenceVersion` *is* allowlisted).

---

## Recommended remediation sequence

**Phase 1 — Urgent, small, low-risk — ✅ DONE (verified, uncommitted)**

1. ~~Add `verifyCronRequest` to both cron `GET` handlers.~~ **Done** — unauth GET now 401; authorized caller still 200. *(V1)*
2. ~~Wrap the evidence-download, worker and reminder paths in `runWithOrganizationContext`.~~ **Done.** *(V2)*
3. ~~Make `createAuditLog` failures loud.~~ **Done** — loud `ENTRY DROPPED` log rather than a throw (throwing would become an unhandled rejection under the `void createAuditLog(...)` call convention).
4. ~~Group SLA sweeps by org and write inside each org's context.~~ **Done** — breach marking + audit entry verified against the live DB. *(V3)*
5. ~~Replace the bogus `userId: "system"` with `null` + SYSTEM actor snapshots.~~ **Done.** *(V9 — surfaced by verifying #4.)*

**Phase 2 — Verify the unverified**

4. Confirm or dismiss U1 (`complianceJobQueue` context bleed) — a cross-tenant write outranks everything else here if real.
5. Move `myAssignments` to `organizationProcedure` (U2); fix `worker.getMetrics` (U3).

**Phase 3 — Fail closed (the structural fix)**

6. Add `runWithSystemContext()` — an explicit, greppable, intentional cross-org bypass.
7. Migrate the six legitimate callers above onto it (prefer a per-org loop where practical; reserve the bypass for true all-org sweeps).
8. Change `handleReadQuery` to **throw** when neither org nor system context is present, matching `handleCreate`/`handleUpdate` and the extension's own documented contract (`:242`).
9. Delete the contradictory `MULTI_TENANT_MODELS` constant (`src/server/db.ts:35-41`).
10. Extend `src/__tests__/integration/multi-tenant-data-isolation.test.ts` to assert the new contract: **a context-less read throws** and an org-B user cannot read org-A rows on each of the previously-leaking paths.

**Phase 4 — Docs**

11. Delete `docs/MULTI_TENANT_ARCHITECTURE.md` (superseded and actively wrong); repoint the `@see` in the isolation test to `docs/MULTI_TENANCY.md`.
12. Correct the dead role names in `RBAC-UI-COMPONENTS.md`, `AUDIT_LOGGING.md`, `DATABASE_SCHEMA.md`.
13. Rewrite `docs/MULTI_TENANCY.md` to describe the post-fix contract (fail-closed reads + the explicit system-context hatch).

---

## Changes currently sitting in the working tree (uncommitted)

| File(s) | Change |
| --- | --- |
| `src/server/api/trpc.ts` | Deleted 5 dead/broken role procedures; corrected `adminProcedure` doc comment; added guidance comment. |
| 30 × `src/**/*.tsx` | `react-hot-toast` → `sonner` import swap. |
| `src/app/layout.tsx` | Removed the duplicate `<ToasterProvider/>` mount. |
| `src/components/ToasterProvider.tsx` | Deleted. |
| `package.json` / lockfile | Removed `react-hot-toast`. |
| `e2e/support/helpers.ts` | Corrected stale `expectToast` docstring. |
| `_bmad-output/project-context.md` | New — AI-agent context rules (58 rules). |

Both code changes are typecheck-clean against the 225-error baseline (no new errors; app source remains at zero). Neither has been runtime-verified — that needs a Docker image rebuild.

**Nothing has been committed.**
