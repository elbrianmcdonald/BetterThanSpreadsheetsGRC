---
project_name: 'Better Than Spreadsheets GRC'
user_name: 'Brian'
date: '2026-07-13'
sections_completed:
  ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'quality_rules', 'workflow_rules', 'anti_patterns']
status: 'complete'
rule_count: 58
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

## THE FIVE THAT WILL BURN YOU

If you read nothing else:

1. **`organizationProcedure` — not `protectedProcedure` — for anything org-scoped.** Without org context, reads return **all tenants' rows, silently**.
2. **~90 models are NOT auto-filtered** (incl. `User`, `Comment`, `Goal`). Hand-filter them.
3. **Never run `npm run dev`** — the app runs in **Docker on port 80**. And `npm run db:generate` is actually `prisma migrate dev` — it can reset your DB.
4. **Jest is `testEnvironment: 'node'`** — component tests need a `@jest-environment jsdom` docblock, and must live in `src/__tests__/`.
5. **`docs/MULTI_TENANT_ARCHITECTURE.md` and `docs/RBAC-UI-COMPONENTS.md` are STALE** and describe an architecture and a role model that no longer exist. **The code wins.**

---

## Technology Stack & Versions

Create T3 App (initVersion 7.40.0) · npm 10.9.2 · ESM (`"type": "module"`)

Next.js ^15.2.3 (App Router) · React ^19.0.0 · TypeScript ^5.8.2
tRPC ^11.0.0 + TanStack Query ^5.69.0 · Prisma ^7.7.0 + @prisma/adapter-pg · PostgreSQL (pg ^8.20.0)
NextAuth ^5.0.0-beta.30 · Zod ^3.25.76 · Tailwind ^4.0.15 · shadcn/ui (new-york) + Radix
react-hook-form ^7.68.0 · TanStack Table ^8.21.3 · Recharts ^2.15.4 · SuperJSON ^2.2.1
Jest ^30.2.0 (ts-jest ESM) · Playwright ^1.57.0 · sonner (canonical toasts)

### Version Constraints That Bite

- **Zod is v3, NOT v4.** Do not use v4-only APIs. `package.json:89`.
- **Tailwind is v4 — CSS-first.** `tailwind.config.ts` exists but is **inert**: no `@config` directive loads it. Theme changes go in `@theme inline` in `src/styles/globals.css:1-55`. Editing the config file does nothing.
- **Next.js 15: `params` and `searchParams` are Promises** and must be awaited in pages. `src/app/findings/[id]/page.tsx:47,55`.
- **NextAuth v5 beta** — v4 patterns (`getServerSession`, `[...nextauth].ts`) do not apply. Use `auth()` from the config.
- **Prisma 7 + adapter-pg** — client built with `new PrismaPg({ connectionString })` (`src/server/db.ts:18`); datasource URL lives in `prisma.config.ts`, so CLI calls need explicit `--url "$DATABASE_URL"`.
- **React 19** — no `forwardRef` needed for new components (`ref` is a plain prop).

## Critical Implementation Rules

### Language-Specific Rules (TypeScript)

**Compiler flags that break the build if ignored** (`tsconfig.json`):

- **`verbatimModuleSyntax: true`** (`:11`) — type-only imports MUST use `import type { X }` or inline `import { type X }`. A plain value-import of a type breaks the build. This is the single most common agent mistake here.
- **`noUncheckedIndexedAccess: true`** (`:15`) — `arr[0]` is typed `T | undefined`. Index access always needs a guard, a `?.`, or a non-null assertion you can justify.
- **`strict: true`** (`:14`) and **`checkJs: true`** (`:16`) — `.js` files are type-checked too.
- **`isolatedModules: true`** (`:10`) — no `const enum`, no re-exporting types without `export type`.
- Target ES2023, `module: ESNext`, `moduleResolution: Bundler`. ESM only — no `require()`.

**Imports:**

- **Use the `@/*` path alias for any cross-directory import** (`@/*` → `./src/*`, `tsconfig.json:28-34`). Relative imports are only for same-directory siblings (e.g. `./FindingDetailContent`).
- `@/lib` is the real shared-code directory. **`src/utils/` is a near-empty legacy directory** (2 files) — put new shared logic in `src/lib/`, not `src/utils/`.
- **`@/trpc/react` and `@/trpc/server` both export a symbol named `api`** — different objects. Never import both in one module.

**Error handling:**

- Server: throw `TRPCError` with an explicit code. Vocabulary in use: `NOT_FOUND` (554 uses), `BAD_REQUEST` (289), `FORBIDDEN` (124), `CONFLICT` (57), `UNAUTHORIZED` (23), `PRECONDITION_FAILED` (12).
- **`TRPCError.message` is rendered verbatim to the user** via `toast.error(error.message)` — write user-facing prose, never leak IDs, stack detail, or other-org data.
- Zod failures do NOT arrive as `message` — they come back flattened as `error.data.zodError` (`src/server/api/trpc.ts:66-68`).
- **Do not cargo-cult `as any`.** `src/app/findings/[id]/page.tsx:76` does it at the server→client prop boundary; that is technical debt, not the pattern.

### Framework-Specific Rules

**Server vs Client components — the `page.tsx` + `client.tsx` split**

- The dominant pattern (126 `page.tsx` / 106 `client.tsx`) is a **Server `page.tsx` that delegates to a sibling `client.tsx`**. Put `"use client"` in `client.tsx`, **never in `page.tsx`**.
- `page.tsx` is `async`: call `auth()`, then a guard from `src/lib/auth/route-protection.ts` (`requireAuth` `:22` / `requireRole` `:49` / `requireOrgAdmin` `:64`), then `await api.x.y()` from `@/trpc/server`, then pass plain data down as props. Canonical: `src/app/findings/[id]/page.tsx:50-64`.
- Those route guards **redirect** — they do not return a boolean. `checkRole` (`:86`) is the non-redirecting variant.
- **`HydrateClient` is DEAD CODE** (`src/trpc/server.ts:27`, zero importers). Do NOT introduce the T3 `prefetch` + `<HydrateClient>` idiom — it is not this codebase's pattern. Server components `await` the caller and pass props.
- `AppLayout` (with a `breadcrumbs` array) wraps page content, usually rendered *inside* the client component.

**tRPC on the client**

- Import is `import { api } from "@/trpc/react"` — the export is named `api`, **not `trpc`** (`src/trpc/react.tsx:25`).
- **Cache invalidation is always `const utils = api.useUtils()` + `void utils.<router>.<proc>.invalidate()` in `onSuccess`.** 127 files do this; **zero** use `useQueryClient` directly.
- Derive types from `RouterInputs` / `RouterOutputs` (`src/trpc/react.tsx:32,39`) — never hand-roll response types.
- Every router must be **manually registered** in `src/server/api/root.ts:74-141` — add both the import and the key, or the procedure does not exist.

**Styling (Tailwind v4)**

- **Use semantic OKLCH token classes** (`bg-card`, `text-muted-foreground`, `border-border`), not raw hex. Full token set incl. `--warning`, `--success`, `--severity-*`, `--chart-1..5` at `src/styles/globals.css:17-54`.
- **Recharts fills use CSS vars**, e.g. `color: "var(--success)"` → `<Cell fill={entry.color} />` (`src/components/compliance/PlanProgressDonut.tsx:63-65,84`). Never hardcode chart hex.
- Two project utility classes, used in 64 files: **`.eyebrow`** (mono uppercase label) and **`.tnum`** (tabular numerals), `globals.css:182-192`. Use them; don't re-roll.
- `cn()` lives at `@/lib/utils`. Arbitrary values (`h-[180px]`) are fine — 777 uses, no rule against them.
- **`src/components/ui/` is shadcn-generated and kebab-case — don't hand-edit or rename.** Feature components are PascalCase under `src/components/<feature>/`.
- **Dark mode is defined but NOT wired**: `.dark` tokens and `next-themes` exist, but no `ThemeProvider` is mounted in `src/app/layout.tsx`. Don't assume a theme toggle works.

**Toasts — one winner**

- **Use `sonner`: `import { toast } from "sonner"`** (123 files). `react-hot-toast` is legacy (31 files) and **both toasters are still mounted** in `src/app/layout.tsx:26-27`. New code: sonner only.

**Forms**

- react-hook-form + `zodResolver` + shadcn `Form/FormField/FormItem/FormLabel/FormControl/FormMessage` from `@/components/ui/form`, Zod schema declared in the same file. Canonical: `src/components/findings/CreateFindingForm.tsx:19-38,81-89`.

**Tables**

- **There is NO shared `DataTable` component** — don't `import { DataTable }`, it does not exist. TanStack Table is used ad hoc on top of raw shadcn `@/components/ui/table` (see `FindingsTable.tsx`, `EvidenceTable.tsx`).
- `src/app/examples/page.tsx` is a live gallery of available shadcn primitives — use it as the design reference.

### Testing Rules

**The three traps**

- **`testEnvironment: 'node'`, NOT jsdom** (`jest.config.cjs:4`). Component tests must opt in **per file** with a `@jest-environment jsdom` docblock — 14 `.tsx` test files do this. Forget it and you get `document is not defined`.
- **Tests live ONLY in `src/__tests__/{unit,integration}/` — never colocated** (`jest.config.cjs:5-6`, `roots: ['<rootDir>/src']`). Zero colocated tests exist. A test placed next to its source will simply never run.
- **`*.spec.ts` is invisible to Jest.** `testMatch` is `*.test.ts` / `*.test.tsx` only (`jest.config.cjs:6`). `.spec.ts` is reserved for Playwright in `e2e/`.

**Jest**

- ts-jest ESM preset. Module mocks for `@/env`, `superjson`, `next-auth`, `@auth/prisma-adapter` are registered via `moduleNameMapper` (`jest.config.cjs:11-21`). New mocks go in `src/__tests__/__mocks__/` and must be registered there.
- **Integration tests hit a REAL database.** `src/__tests__/setup.ts:39-51` rewrites `DATABASE_URL` by appending `_test` to the DB name (or uses `TEST_DATABASE_URL`). Tests are not hermetic; the `_test` DB must exist.
- `jest-axe` matchers are globally registered (`setup.ts:28`) but only one a11y test exists — accessibility coverage is aspirational, not enforced.
- Commands: `npm test` · `npm run test:watch` · `npm run test:coverage`.

**Playwright (E2E)**

- `workers: 1`, `fullyParallel: false`, `screenshot: 'on'` (`playwright.config.ts:5-7,15`).
- **Auth is form-login via a helper, not `storageState`**: `login(page, USERS.admin)` (`e2e/support/helpers.ts:30-36`) against a **seeded demo DB** (`admin@acme-corp.com` / `Admin123!@#`).
- **Base URL defaults to `:3000` but the app runs in Docker on port 80** — you must run with `PW_BASE_URL=http://127.0.0.1` (`playwright.config.ts:11-13`).
- Suffix every created entity name with `uid()` — `(organizationId, name)` unique constraints will collide on re-runs (`helpers.ts:8-10`). Teardown is best-effort and must never fail.
- Radix `Select` needs the `selectByTrigger` helper (`helpers.ts:59-72`) — a plain `selectOption` will not work.
- Commands: `npm run test:e2e` · `test:smoke` · `test:workflows`.

**What to write when adding a feature**

- A tRPC procedure → an integration test in `src/__tests__/integration/`. **Cross-tenant isolation is the case to cover**: assert an org-B user cannot read org-A rows.
- A component → a unit test in `src/__tests__/unit/` with the `@jest-environment jsdom` docblock.
- A user-facing flow → a Playwright spec in `e2e/`.

### Code Quality & Style Rules

**There is no linter and no formatter.**

- No ESLint, Prettier, or Biome config exists anywhere, and `package.json` has **no `lint` script**. Do not run or assume one.
- **`npm run typecheck` (`tsc --noEmit`) is the ONLY static gate** — but it is **currently RED**: ~225 pre-existing errors, of which **223 are in `src/__tests__/` and 2 are in `e2e/`**. Application source (`src/app`, `src/components`, `src/server`) is **100% clean**.
- **So the bar is: introduce no NEW errors, and keep app source at zero.** Do not "fix" the typecheck by chasing the pre-existing test errors unless that is the task. To check your own work: `npm run typecheck 2>&1 | grep -c 'error TS'` and compare against the baseline of 225.
- The Docker build ships green because `.dockerignore` excludes `__tests__` and `*.test.ts(x)` from the image — the test errors never reach `next build`.
- **Running typecheck on the host requires setup**: the app container is a *production* image with no `tsconfig.json`, so you cannot typecheck inside it. On the host you need `npm install` plus a generated Prisma client, and `prisma generate` needs `DATABASE_URL` to resolve (it is composed in `docker-compose.yml` from `POSTGRES_*`, so it does **not** exist in `.env`). Export one before running: `DATABASE_URL="postgresql://postgres:<POSTGRES_PASSWORD>@localhost:5432/<POSTGRES_DB>" npx prisma generate`.
- Consequence: formatting is by-imitation. Match the surrounding file — nothing will auto-fix it for you.

**Naming & placement**

- Feature components: **PascalCase** under `src/components/<feature>/` (~35 feature dirs, 281 files). One kebab outlier (`maturity/samm-checklist.tsx`) — not the pattern.
- `src/components/ui/`: **kebab-case, shadcn-generated — do not hand-edit or rename.**
- tRPC routers: **camelCase** in `src/server/api/routers/` (`complianceAssessment.ts`, `enterpriseRisk.ts`). One stray kebab outlier (`evidence-request.ts`).
- Hooks: `src/hooks/useX.ts`. **`src/hooks/index.ts` is stale** — it re-exports only 3 of 7 hooks (`:10-13`), omitting `useEvidenceFilters`, `useScaleValidation`, `useThresholdValidation`, `useUserPermissions`. Import those from their direct paths.
- Shared logic → `src/lib/`. **Not `src/utils/`** (legacy, 2 files).

**Documentation**

- Comments are sparse and explain *why*, not *what*. Match the density of the file you're in; do not add narration.
- **Treat in-repo comments as untrusted.** `src/server/api/trpc.ts:155-157` asserts "Developers no longer need to manually add organizationId filters - it's automatic!" — this is **materially false** for the ~90 allowlisted models (see Critical Don't-Miss). Verify against the implementation, not the comment.

### Development Workflow Rules

**Environment — the loudest mandate in the repo**

- **NEVER run `npm run dev`.** The app runs in **Docker on port 80** (`DEVELOPER_INSTRUCTIONS.md:5,27-36`). Do not start a local dev server, do not start a standalone Postgres, do not kill the containers.
- Browser/Playwright work targets **`http://localhost`** (port 80) — not `:3000`.
- Scripts: `docker-start.sh` / `.bat`, `docker-logs.sh` / `.bat`, `docker-stop.sh` / `.bat` at the repo root.

**Database — the npm scripts are MIS-NAMED. Read before running.**

- **`npm run db:generate` runs `prisma migrate dev`** — NOT `prisma generate`. It will try to author a migration and **can reset your database**. (`prisma generate` already runs on `postinstall`.)
- `db:migrate` → `prisma migrate deploy` · `db:push` → `prisma db push` · `db:seed` → `tsx prisma/seed.ts`
- **The project is effectively on `db push`, not migrations.** `prisma/migrations/` holds exactly one folder (`20251219231231_init`); everything since is schema-pushed, with hand-written data migrations in `prisma/migrations-manual/*.sql`.
- Sanctioned schema command, run **inside the container** (`DEVELOPER_INSTRUCTIONS.md:41-48`):
  `prisma db push --accept-data-loss --schema ./prisma/schema.prisma --url "$DATABASE_URL"`
- A schema change with a data implication (backfill, enum removal) needs a matching `prisma/migrations-manual/YYYY-MM-DD-<slug>.sql` — see `2026-07-11-role-consolidation.sql`.

**Git**

- **Commits are plain imperative sentences, NOT Conventional Commits.** No `feat:` / `fix:` / `chore:` prefixes. Say what the change does and why it matters:
  `Seed risk register entries so the register is not empty on a fresh install`
  `Pin npm to 11.x in Dockerfile to unbreak the image build`
- Branch prefixes in use: `feat/` and `feature/` (both appear; `feat/` is the more recent).
- Work merges to `master`.

**Definition of done**

1. `npm run typecheck` passes (the only static gate — there is no linter).
2. Relevant Jest tests pass; new tRPC procedures carry a cross-tenant isolation test.
3. Behavior verified in the running Docker app, not just in tests.

### Critical Don't-Miss Rules — Security & Data Isolation

This is a **multi-tenant GRC application**. A cross-tenant data leak is the worst bug you can write here, and the architecture makes it *silent*. Read this section before touching any query.

#### 1. Tenant isolation: automatic, but ONLY inside `organizationProcedure`

A Prisma **client extension** (`$extends`) injects `organizationId` into reads, creates, updates, and deletes. It reads the org id from an `AsyncLocalStorage` store that is populated in exactly one place: `organizationProcedure` (`src/server/api/trpc.ts:181-189`). Implementation: `src/server/db/middleware/organization-filter.ts`; wired at `src/server/db.ts:66-79`.

- **RULE: `organizationProcedure` is the DEFAULT for anything touching org data.** (780 uses vs 42 `protectedProcedure`.)
- **RULE: NEVER touch an org-scoped model from `protectedProcedure` or `publicProcedure`.** With no org context, a **write throws** — but a **read silently returns unfiltered rows across all tenants** (`organization-filter.ts:327-330`: `if (!orgId) return query(args);`). This is a silent cross-tenant leak with no error to warn you.
- `protectedProcedure` is reserved for global reference data only (MITRE ATT&CK, the global control taxonomy, worker metrics). Do not add more.

#### 2. ~90 models are NOT auto-filtered — the ALLOWLIST is a live footgun

`ALLOWLIST_TABLES` (`organization-filter.ts:119-228`) exempts ~90 models from filtering, including **`User`**, `OrganizationMembership`, `Goal`, `Objective`, `Comment`, `StandardControl`, `MaturityFramework`, and all Maturity*/BIA*/Engagement*/Pathway* child tables.

- **RULE: for any allowlisted model you MUST hand-filter** — directly, or via a `where` on a parent relation that carries `organizationId`.
- **RULE: `$queryRaw` bypasses the extension entirely.** Write `WHERE "organizationId" = ${orgId}` yourself (see `src/server/api/routers/crosswalk.ts:126-144`).
- **RULE: `rawPrisma` (`src/server/db.ts:20`) is unfiltered.** Test cleanup and org creation only — never in business logic.
- **RULE: outside tRPC** (route handlers, scripts, services), wrap DB calls in `runWithOrganizationContext(orgId, () => …)` yourself. Pattern: `src/app/api/maturity/[id]/pdf/route.ts:26-45`.
- **RULE: new model?** Give it `organizationId` + an `Organization` relation `onDelete: Cascade` + `@@index([organizationId, …])`. If it genuinely cannot have one, add it to `ALLOWLIST_TABLES` with a comment naming the parent that carries isolation — otherwise every create throws.
- **RULE: cross-org access surfaces as `NOT_FOUND`, never `FORBIDDEN`** — no existence leak (`organization-filter.ts:393`).
- `MULTI_TENANT_MODELS` in `src/server/db.ts:35-41` is **dead code and contradicts the allowlist** (it lists `User`, which is NOT filtered). Do not trust it.

#### 3. RBAC: 4 roles, and role is DERIVED, not stored

- **`UserRole = ADMINISTRATOR | MANAGER | ANALYST | BUSINESS_USER`** (`prisma/schema.prisma:1988-1996`). The old 8 (ORG_ADMIN, GRC_ANALYST, SECURITY_ENGINEER, CISO, IT_STAKEHOLDER, BUSINESS_STAKEHOLDER, AUDITOR, GRC_MANAGER) are **gone**.
- **`User` has NO `role` column.** Staff carry `User.platformRole` (authority across ALL orgs); `BUSINESS_USER` is implied by the existence of an `OrganizationMembership` row. **Never write `db.user.create({ data: { role } })`.**
- **Resolve authority with `resolveActiveRole(db, userId, orgId)`** (`src/server/services/organization/access.ts:24-52`) — the single source of truth, so a client cannot forge an org switch.
- **The authorization idiom is `organizationProcedure.use(requireRole(SOME_ROLES))`** (439 call sites), where `SOME_ROLES` spreads a canonical tier from `src/lib/auth/roles.ts` (`READ_ROLES`/`WRITE_ROLES`/`APPROVE_ROLES`/`ADMIN_ROLES`). **Never hardcode a role array literal.** `adminProcedure` is a fine shortcut.
- **DO NOT USE `analystProcedure`, `engineerProcedure`, `cisoProcedure`, `stakeholderProcedure`, `auditorProcedure`** (`trpc.ts:389-493`). They are **dead code (zero call sites) and several are outright broken** by the role consolidation: `engineerProcedure` = `requireRole([ANALYST, ANALYST])`, `stakeholderProcedure` = `[BUSINESS_USER, BUSINESS_USER]`, and **`cisoProcedure` = `[MANAGER, ANALYST]` — which excludes ADMINISTRATOR.** Do not use them and do not "fix them by using them."
- Fine-grained checks use `hasPermission(role, Permission.X)` / `requirePermission()` (`src/server/auth/permissions.ts`, 74 uses). Note `Permission.RISK_ASSIGN` is **Manager+ only** — ANALYST does not have it.
- **UI permission checks (`usePermission`, `useHasRole`, `<ProtectedElement>`) are COSMETIC.** They never substitute for the server-side guard. Every mutation needs its own server check.

#### 4. Audit logging is MANUAL, per-mutation

- **Nothing is automatic.** Every state-changing mutation calls `createAuditLog({ organizationId, userId, action, entityType, entityId, changes? })` from `@/server/services/audit-log.service`.
- Coverage today is only ~27 of 66 routers — **"the neighboring code didn't log" is not permission to skip it.**
- **Call it fire-and-forget: `void createAuditLog(...)`, do NOT `await`.** It swallows its own errors.
- **`action` must be an existing `AuditAction` enum member** (`prisma/schema.prisma:1687+`). It is a typed Postgres enum — an invented string fails at runtime, and **silently**, because of the fire-and-forget above. Add the enum value to the schema first.
- For updates, capture `before` and pass `changes: { before, after }`. Use `serializeEntityState()` if the entity may hold `hashedPassword`/`token`.
- **AuditLog is create-only.** Never write an update or delete procedure for it.
- Failed `requireRole`/`requirePermission` checks already auto-log `AUTHORIZATION_FAILED` — don't duplicate.

#### 5. THREE DOCS IN `docs/` ARE STALE AND WILL MISLEAD YOU

- **`docs/MULTI_TENANT_ARCHITECTURE.md` is WRONG.** It claims "Automatic query filtering is NOT implemented… Developers MUST manually filter" (`:40,150-154,569`). **False** — the extension exists. It also documents the deleted 8-role enum and a `User.role` column that no longer exists.
- **`docs/RBAC-UI-COMPONENTS.md` is STALE** — every example uses `UserRole.ORG_ADMIN` / `GRC_ANALYST` / `SECURITY_ENGINEER` / `CISO` and `Permission.RISK_APPROVE`, none of which exist. The *component API* is still accurate; the role names are not.
- **Trust `docs/MULTI_TENANCY.md` + the source code.** When a doc and the code disagree, **the code wins** — and so do the comments' opposites: `trpc.ts:155-157` overstates the automation (see §2).

#### 6. Soft deletes are inconsistent — check the model

Some models use `deletedAt DateTime?` (Evidence, RiskComment, EvidenceRequest); most use `isActive Boolean @default(true)` (AssessmentType, RiskMatrixTemplate, BusinessUnit, Person). **There is no global soft-delete filter** — your `where` must exclude deleted rows explicitly.

---

## Usage Guidelines

**For AI Agents:**

- Read this file before implementing any code.
- Follow ALL rules exactly as documented. When in doubt, prefer the more restrictive option.
- **When this file and a `docs/` file disagree, this file wins. When this file and the source disagree, the source wins** — and tell Brian, so this file gets fixed.

**For Humans:**

- Keep this lean and focused on what agents get *wrong*; delete rules that become obvious.
- Several rules here document **bugs and debt, not intent** (broken role procedures, the silent unfiltered read, stale docs, two mounted toast libraries). As those get fixed, delete the corresponding rule — don't let this file preserve them.
- Update when the stack or the isolation model changes.

Last Updated: 2026-07-13
