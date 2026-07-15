# Unified Framework Detail Views Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every framework detail page — compliance (NIST SP 800-171, 800-53, ISO 27001, NISTCSF) and maturity (NIST CSF 2.0, C2M2, OWASP SAMM) — renders through one shared hierarchical table component with the same chrome, so all frameworks look and behave the same.

**Architecture:** Introduce a presentational `FrameworkNodeTable` that renders a normalized `FrameworkNode[]` tree as an expandable table styled like the current `/admin/frameworks/[id]` table. Two pure adapter functions normalize the two very different server shapes (`Control` rows joined by `parentControlId`; `MaturityDomain`/`MaturityQuestion` rows joined by `parentId`) into that one type. The compliance page loads **top-level rows only** and lazy-loads children on expand (survives 800-53's 1,216 controls); the maturity page already receives its whole tree from `maturity.getFramework` and passes it in eagerly. Health/Risk/Finding/Domain columns are **column-gated off** for maturity, because `MaturityDomain` has no risk or finding links.

**Tech Stack:** Next.js 15 App Router (Server `page.tsx` → Client `client.tsx`), tRPC v11, Prisma 7, React 19, Tailwind v4 (CSS-first), shadcn/ui, Jest 30 (ts-jest ESM), Playwright.

## Global Constraints

- **`organizationProcedure`, never `protectedProcedure`, for any org-scoped read or write.** A read from `protectedProcedure` silently returns **all tenants' rows** (`src/server/db/middleware/organization-filter.ts:327-330`).
- **`MaturityFramework`, `MaturityDomain`, and `MaturityQuestion` are on `ALLOWLIST_TABLES`** (`organization-filter.ts:119-228`) — they are **NOT auto-filtered**. Every maturity query must hand-filter (`organizationId: null && isSystemTemplate` OR `organizationId: ctx.organizationId`). `Control` and `Framework` **are** auto-filtered inside `organizationProcedure`.
- **`verbatimModuleSyntax: true`** — every type-only import MUST be `import type { X }` or `import { type X }`. A plain value-import of a type breaks the build. This is the most common mistake in this repo.
- **`noUncheckedIndexedAccess: true`** — `arr[0]` is `T | undefined`. Guard, `?.`, or a justified `!`.
- **Typecheck is the ONLY static gate and it is currently RED with a baseline of 225 errors** (223 in `src/__tests__/`, 2 in `e2e/`). Application source is 100% clean. **The bar: introduce no new errors and keep app source at zero.** Verify with `npm run typecheck 2>&1 | grep -c 'error TS'` and compare against **225**.
- **There is no linter and no formatter.** Match the surrounding file by imitation.
- **NEVER run `npm run dev`.** The app runs in Docker on **port 80**. Playwright must be run with `PW_BASE_URL=http://127.0.0.1`.
- **The Docker app does NOT hot-reload.** It is a baked `NODE_ENV=production` image with no source bind-mount, so a code change is invisible in the browser until you rebuild: `docker compose up -d --build app`. Verify only after rebuilding, or you will be looking at a stale page and will "confirm" work that never shipped.
- **NEVER run `npm run db:generate`** — it is `prisma migrate dev` and can reset the database. This plan requires **no schema change**.
- Tests live **only** in `src/__tests__/{unit,integration}/`, must be named `*.test.ts(x)`, and component tests need a `@jest-environment jsdom` docblock. A colocated test never runs.
- **Integration tests cannot run on the Windows host** (no `DATABASE_URL` in `.env`; Postgres does not publish 5432). Run them through the compose test profile: `docker compose --profile test exec test npx jest <path>`. There is **no `_test` database** — `docker-compose.yml:124-144` points `TEST_DATABASE_URL` at the main DB, so `setup.ts` takes that branch and never appends `_test`. Unit tests (`src/__tests__/unit/`) run fine on the host with `npx jest`.
- Client tRPC import is `import { api } from "@/trpc/react"`. Cache invalidation is always `const utils = api.useUtils()` + `void utils.<router>.<proc>.invalidate()`.
- Toasts: `import { toast } from "sonner"`. Never `react-hot-toast`.
- Cross-directory imports use the `@/*` alias. Shared logic goes in `src/lib/`, never `src/utils/`.
- Commits are **plain imperative sentences**, not Conventional Commits. No `feat:`/`fix:`/`chore:` prefixes.
- Audit logging is manual and fire-and-forget (`void createAuditLog(...)`). **This plan adds no state-changing mutations**, so no new audit calls are needed.

---

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `src/lib/frameworks/framework-node.ts` | The `FrameworkNode` type + the two pure adapters (`controlsToNodes`, `maturityToNodes`). No React. Unit-testable in `node` environment. |
| `src/components/frameworks/FrameworkNodeTable.tsx` | Presentational expandable table. Takes `FrameworkNode[]` + a column config + expand/click callbacks. Knows nothing about tRPC or which framework it's rendering. |
| `src/__tests__/unit/framework-node.test.ts` | Adapter unit tests (node env — no docblock). |
| `src/__tests__/unit/FrameworkNodeTable.test.tsx` | Component unit tests (**needs the jsdom docblock**). |
| `src/__tests__/integration/framework-control-children.test.ts` | Integration test for the new `getControlChildren` procedure, **including cross-tenant isolation**. |
| `e2e/framework-hierarchy.spec.ts` | Playwright: both pages render a tree, expand works. |

**Modified:**

| File | Change |
|---|---|
| `src/server/api/routers/framework.ts` | Add `getControlChildren` procedure (children are currently capped at `take: 5`, `:1048`, which is a preview limit — a dedicated procedure avoids changing that). |
| `src/app/admin/frameworks/[id]/client.tsx` | Replace the flat `<Table>` body (`:596-823`) with `<FrameworkNodeTable>`; pass `topLevelOnly: true`; keep all existing dialogs, cards, filters, mutations. |
| `src/app/admin/frameworks/maturity/[id]/client.tsx` | Replace the `DomainNode` tree (`:425-513`, and its render at `:260-299`) with `<FrameworkNodeTable>`; add the admin header, metadata cards, and search box. Keep the Scoring Levels card and the testing-fields dialog. |

**Deleted:** `DomainNode`, `QuestionRow`, and `TestingBadges` in `src/app/admin/frameworks/maturity/[id]/client.tsx:425-597` (their behavior moves into `FrameworkNodeTable`).

---

## Design Decisions (settled — do not re-litigate)

1. **Search shows flat results, not a filtered tree.** When a search term is active, both pages render matches as a flat list (no expansion, no ancestors) and show the copy `Showing flat search results`. Building an ancestor-chain-expanding tree search is out of scope. The compliance page already searches server-side (`framework.ts:1029-1035`); the maturity page filters its already-loaded tree client-side.
2. **Pagination applies to top-level rows only, and only when not searching.** ISO 27001 (45 controls) and NISTCSF-compliance (39 controls) have no parents, so `topLevelOnly` returns them all and they paginate exactly as today — no regression. 800-171 shows its 17 families on one page. Maturity pages are not paginated (134 domains max).
3. **Column gating, not two components.** `FrameworkNodeTable` takes a `columns` config. Compliance turns on `risks`, `findings`, `health`, `domains`, `children`, `actions`. Maturity turns on `level` and leaves the rest off.
4. **No schema change. No new mutations. No audit logging.**

---

## Task 1: The `FrameworkNode` type and the two adapters

**Files:**
- Create: `src/lib/frameworks/framework-node.ts`
- Test: `src/__tests__/unit/framework-node.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type FrameworkNodeKind = "control" | "domain" | "question"`
  - `interface FrameworkNode` (fields below)
  - `function controlsToNodes(controls: ControlInput[]): FrameworkNode[]`
  - `function maturityToNodes(roots: MaturityDomainInput[], questions: MaturityQuestionInput[]): FrameworkNode[]`
  - `function flattenVisible(nodes: FrameworkNode[], expanded: ReadonlySet<string>): FrameworkNode[]`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/unit/framework-node.test.ts`:

```ts
import {
  controlsToNodes,
  maturityToNodes,
  flattenVisible,
  type FrameworkNode,
} from "@/lib/frameworks/framework-node";

describe("controlsToNodes", () => {
  it("maps a top-level control to a depth-0 node with unloaded children", () => {
    const nodes = controlsToNodes([
      {
        id: "c1",
        controlId: "03.01",
        title: "Access Control",
        description: "Access Control",
        testInstructions: null,
        acceptanceCriteria: null,
        isActive: true,
        _count: { other_Control: 22 },
        ControlDomains: [],
      },
    ]);

    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({
      id: "c1",
      code: "03.01",
      title: "Access Control",
      kind: "control",
      depth: 0,
      childCount: 22,
      children: null, // null means "not loaded yet" — the caller lazy-loads
      levelLabel: null,
    });
  });

  it("reports childCount 0 and children [] for a leaf control", () => {
    const nodes = controlsToNodes([
      {
        id: "c2",
        controlId: "03.01.01",
        title: "Account Management",
        description: "Define the types of system accounts...",
        testInstructions: "Sample 10 accounts",
        acceptanceCriteria: null,
        isActive: true,
        _count: { other_Control: 0 },
        ControlDomains: [],
      },
    ]);

    expect(nodes[0]!.childCount).toBe(0);
    expect(nodes[0]!.children).toEqual([]);
    expect(nodes[0]!.testInstructions).toBe("Sample 10 accounts");
  });

  it("carries domain tags through", () => {
    const nodes = controlsToNodes([
      {
        id: "c3",
        controlId: "03.02",
        title: "Awareness and Training",
        description: null,
        testInstructions: null,
        acceptanceCriteria: null,
        isActive: true,
        _count: { other_Control: 2 },
        ControlDomains: [
          { ControlDomain: { id: "d1", code: "AT", name: "Awareness & Training" } },
        ],
      },
    ]);

    expect(nodes[0]!.domains).toEqual([{ id: "d1", code: "AT", name: "Awareness & Training" }]);
  });

  it("assigns the given depth to children when nesting", () => {
    const children = controlsToNodes(
      [
        {
          id: "c4",
          controlId: "03.01.01",
          title: "Account Management",
          description: null,
          testInstructions: null,
          acceptanceCriteria: null,
          isActive: true,
          _count: { other_Control: 0 },
          ControlDomains: [],
        },
      ],
      1,
    );

    expect(children[0]!.depth).toBe(1);
  });
});

describe("maturityToNodes", () => {
  const csfTree = [
    {
      id: "gv",
      code: "GV",
      name: "Govern",
      description: "The organization's cybersecurity risk management strategy...",
      level: "FUNCTION",
      testInstructions: null,
      acceptanceCriteria: null,
      children: [
        {
          id: "gvoc",
          code: "GV.OC",
          name: "Organizational Context",
          description: "The circumstances...",
          level: "CATEGORY",
          testInstructions: null,
          acceptanceCriteria: null,
          children: [
            {
              id: "gvoc01",
              code: "GV.OC-01",
              name: "The organizational mission is understood",
              description: null,
              level: "SUBCATEGORY",
              testInstructions: "Review the mission statement",
              acceptanceCriteria: null,
              children: [],
            },
          ],
        },
      ],
    },
  ];

  it("maps the CSF Function/Category/Subcategory tree with depth and levelLabel", () => {
    const nodes = maturityToNodes(csfTree, []);

    expect(nodes).toHaveLength(1);
    const fn = nodes[0]!;
    expect(fn).toMatchObject({ id: "gv", code: "GV", kind: "domain", depth: 0, levelLabel: "FUNCTION" });
    expect(fn.childCount).toBe(1);

    const cat = fn.children![0]!;
    expect(cat).toMatchObject({ code: "GV.OC", depth: 1, levelLabel: "CATEGORY" });

    const sub = cat.children![0]!;
    expect(sub).toMatchObject({ code: "GV.OC-01", depth: 2, levelLabel: "SUBCATEGORY", childCount: 0 });
    expect(sub.testInstructions).toBe("Review the mission statement");
  });

  it("never returns null children — a maturity tree is always fully loaded", () => {
    const nodes = maturityToNodes(csfTree, []);
    expect(nodes[0]!.children).not.toBeNull();
    expect(nodes[0]!.children![0]!.children![0]!.children).toEqual([]);
  });

  it("attaches C2M2/SAMM questions as question-kind leaves under their domain", () => {
    const nodes = maturityToNodes(
      [
        {
          id: "dm",
          code: "ASSET",
          name: "Asset Management",
          description: null,
          level: "FUNCTION",
          testInstructions: null,
          acceptanceCriteria: null,
          children: [],
        },
      ],
      [
        {
          id: "q1",
          domainId: "dm",
          questionText: "Are IT assets inventoried?",
          practiceCode: "ASSET-1a",
          practiceLevel: 1,
          testInstructions: null,
          acceptanceCriteria: null,
        },
      ],
    );

    const domain = nodes[0]!;
    expect(domain.childCount).toBe(1);
    const q = domain.children![0]!;
    expect(q).toMatchObject({
      id: "q1",
      code: "ASSET-1a",
      title: "Are IT assets inventoried?",
      kind: "question",
      depth: 1,
      levelLabel: "MIL 1",
      childCount: 0,
    });
  });

  it("ignores questions whose domainId is null (framework-level questions are rendered separately)", () => {
    const nodes = maturityToNodes(
      [
        {
          id: "dm",
          code: "ASSET",
          name: "Asset Management",
          description: null,
          level: "FUNCTION",
          testInstructions: null,
          acceptanceCriteria: null,
          children: [],
        },
      ],
      [
        {
          id: "q0",
          domainId: null,
          questionText: "Framework-level question",
          practiceCode: null,
          practiceLevel: null,
          testInstructions: null,
          acceptanceCriteria: null,
        },
      ],
    );

    expect(nodes[0]!.children).toEqual([]);
  });
});

describe("flattenVisible", () => {
  const tree: FrameworkNode[] = [
    {
      id: "a",
      code: "A",
      title: "Alpha",
      description: null,
      kind: "domain",
      levelLabel: "FUNCTION",
      depth: 0,
      childCount: 1,
      testInstructions: null,
      acceptanceCriteria: null,
      children: [
        {
          id: "a1",
          code: "A.1",
          title: "Alpha One",
          description: null,
          kind: "domain",
          levelLabel: "CATEGORY",
          depth: 1,
          childCount: 0,
          testInstructions: null,
          acceptanceCriteria: null,
          children: [],
        },
      ],
    },
  ];

  it("returns only roots when nothing is expanded", () => {
    expect(flattenVisible(tree, new Set()).map((n) => n.id)).toEqual(["a"]);
  });

  it("returns children of expanded nodes, in order, depth-first", () => {
    expect(flattenVisible(tree, new Set(["a"])).map((n) => n.id)).toEqual(["a", "a1"]);
  });

  it("does not descend into an expanded node whose children are not loaded", () => {
    const lazy: FrameworkNode[] = [{ ...tree[0]!, children: null }];
    expect(flattenVisible(lazy, new Set(["a"])).map((n) => n.id)).toEqual(["a"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/__tests__/unit/framework-node.test.ts`
Expected: FAIL — `Cannot find module '@/lib/frameworks/framework-node'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/frameworks/framework-node.ts`:

```ts
/**
 * The one shape every framework detail view renders.
 *
 * Compliance frameworks (Control rows joined by parentControlId) and maturity
 * frameworks (MaturityDomain rows joined by parentId, plus MaturityQuestion
 * leaves) are structurally different on the server. Both normalize to this so a
 * single table component can render either.
 */

export type FrameworkNodeKind = "control" | "domain" | "question";

export interface FrameworkNodeDomainTag {
  id: string;
  code: string;
  name: string;
}

export interface FrameworkNode {
  id: string;
  /** controlId ("03.01.01"), domain code ("GV.OC-01"), or practiceCode ("ASSET-1a"). */
  code: string;
  title: string;
  description: string | null;
  kind: FrameworkNodeKind;
  /** "FUNCTION" | "CATEGORY" | "SUBCATEGORY" | "MIL 1" for maturity; null for compliance. */
  levelLabel: string | null;
  /** 0 for roots. Drives indentation. */
  depth: number;
  /** How many children exist, even when they are not loaded. Drives the chevron. */
  childCount: number;
  /**
   * Loaded children, or `null` when children exist but have not been fetched.
   * Maturity trees arrive whole, so they are never null. Compliance trees are
   * lazy: a parent starts null and is filled in on expand.
   */
  children: FrameworkNode[] | null;
  testInstructions: string | null;
  acceptanceCriteria: string | null;
  /** Compliance only. */
  domains?: FrameworkNodeDomainTag[];
  isActive?: boolean;
}

// --- Compliance ------------------------------------------------------------

export interface ControlInput {
  id: string;
  controlId: string;
  title: string;
  description: string | null;
  testInstructions: string | null;
  acceptanceCriteria: string | null;
  isActive: boolean;
  _count?: { other_Control: number } | null;
  ControlDomains?: Array<{ ControlDomain: FrameworkNodeDomainTag }> | null;
}

export function controlsToNodes(controls: ControlInput[], depth = 0): FrameworkNode[] {
  return controls.map((c) => {
    const childCount = c._count?.other_Control ?? 0;
    return {
      id: c.id,
      code: c.controlId,
      title: c.title,
      description: c.description,
      kind: "control" as const,
      levelLabel: null,
      depth,
      childCount,
      // A leaf is loaded by definition; a parent must be fetched on expand.
      children: childCount === 0 ? [] : null,
      testInstructions: c.testInstructions,
      acceptanceCriteria: c.acceptanceCriteria,
      domains: (c.ControlDomains ?? []).map((cd) => cd.ControlDomain),
      isActive: c.isActive,
    };
  });
}

// --- Maturity --------------------------------------------------------------

export interface MaturityDomainInput {
  id: string;
  code: string;
  name: string;
  description: string | null;
  level: string;
  testInstructions: string | null;
  acceptanceCriteria: string | null;
  children: MaturityDomainInput[];
}

export interface MaturityQuestionInput {
  id: string;
  domainId: string | null;
  questionText: string;
  practiceCode: string | null;
  practiceLevel: number | null;
  testInstructions: string | null;
  acceptanceCriteria: string | null;
}

export function maturityToNodes(
  roots: MaturityDomainInput[],
  questions: MaturityQuestionInput[],
): FrameworkNode[] {
  const byDomain = new Map<string, MaturityQuestionInput[]>();
  for (const q of questions) {
    if (q.domainId === null) continue; // rendered separately, outside the tree
    const bucket = byDomain.get(q.domainId);
    if (bucket) bucket.push(q);
    else byDomain.set(q.domainId, [q]);
  }

  const walk = (domain: MaturityDomainInput, depth: number): FrameworkNode => {
    const childDomains = domain.children.map((child) => walk(child, depth + 1));
    const childQuestions = (byDomain.get(domain.id) ?? []).map(
      (q): FrameworkNode => ({
        id: q.id,
        code: q.practiceCode ?? q.id.slice(0, 8),
        title: q.questionText,
        description: null,
        kind: "question",
        levelLabel: q.practiceLevel === null ? null : `MIL ${q.practiceLevel}`,
        depth: depth + 1,
        childCount: 0,
        children: [],
        testInstructions: q.testInstructions,
        acceptanceCriteria: q.acceptanceCriteria,
      }),
    );
    const children = [...childDomains, ...childQuestions];

    return {
      id: domain.id,
      code: domain.code,
      title: domain.name,
      description: domain.description,
      kind: "domain",
      levelLabel: domain.level,
      depth,
      childCount: children.length,
      children,
      testInstructions: domain.testInstructions,
      acceptanceCriteria: domain.acceptanceCriteria,
    };
  };

  return roots.map((root) => walk(root, 0));
}

// --- Rendering helper ------------------------------------------------------

/**
 * Depth-first list of the rows the table should draw, honouring `expanded`.
 * An expanded node whose children are still `null` contributes only itself —
 * the caller is responsible for fetching them.
 */
export function flattenVisible(
  nodes: FrameworkNode[],
  expanded: ReadonlySet<string>,
): FrameworkNode[] {
  const out: FrameworkNode[] = [];
  const visit = (node: FrameworkNode) => {
    out.push(node);
    if (!expanded.has(node.id) || node.children === null) return;
    for (const child of node.children) visit(child);
  };
  for (const node of nodes) visit(node);
  return out;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/__tests__/unit/framework-node.test.ts`
Expected: PASS — 9 passing tests.

- [ ] **Step 5: Confirm no new typecheck errors**

Run: `npm run typecheck 2>&1 | grep -c 'error TS'`
Expected: `225` (the baseline) or lower. If higher, fix before committing.

- [ ] **Step 6: Commit**

```bash
git add src/lib/frameworks/framework-node.ts src/__tests__/unit/framework-node.test.ts
git commit -m "Add a shared FrameworkNode shape so compliance and maturity frameworks can render through one component"
```

---

## Task 2: `framework.getControlChildren` — lazy children for the compliance tree

**Files:**
- Modify: `src/server/api/routers/framework.ts` (add the procedure next to `getControls`, which ends around `:1080`)
- Test: `src/__tests__/integration/framework-control-children.test.ts`

**Why a new procedure:** `getControls` already includes `other_Control` but with `take: 5` (`framework.ts:1048`) — that is a deliberate *preview* limit used by other callers. Widening it would load every child of every row. A dedicated procedure fetches the full child set for exactly one parent, on demand.

**Interfaces:**
- Consumes: `Permission.FRAMEWORK_READ` from `@/server/auth/permissions` (already imported in this router), `organizationProcedure`, `requirePermission`.
- Produces: `api.framework.getControlChildren.useQuery({ parentControlId: string })` returning `ControlInput[]` (the exact shape `controlsToNodes` from Task 1 accepts).

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/integration/framework-control-children.test.ts`. Follow the existing setup convention in `src/__tests__/integration/` — read a neighbouring file first (e.g. any test that builds two orgs) and reuse its org/user/caller helpers verbatim rather than inventing new ones.

```ts
/**
 * Integration test for framework.getControlChildren.
 *
 * The isolation case is the one that matters: an org-B caller must not be able
 * to read org-A's controls by passing org-A's parent control id.
 */
import { createCaller } from "@/server/api/root";
import { rawPrisma } from "@/server/db";
// NOTE: import the org/user/context helpers this repo's other integration
// tests already use — do not hand-roll a new tRPC context here.

describe("framework.getControlChildren", () => {
  // Setup: create Org A with a framework, a parent control "03.01" and two
  // children "03.01.01" and "03.01.02"; create Org B with its own user.
  // Use rawPrisma for setup/teardown only (it is unfiltered by design).

  it("returns every child of a parent, ordered by controlId", async () => {
    const caller = /* org-A admin caller */;
    const children = await caller.framework.getControlChildren({
      parentControlId: parentId,
    });

    expect(children.map((c) => c.controlId)).toEqual(["03.01.01", "03.01.02"]);
    expect(children[0]!._count.other_Control).toBe(0);
  });

  it("returns more than five children (it is not the getControls preview limit)", async () => {
    // Seed 7 children under a second parent, then:
    const children = await caller.framework.getControlChildren({
      parentControlId: bigParentId,
    });
    expect(children).toHaveLength(7);
  });

  it("does not leak another org's controls — cross-tenant isolation", async () => {
    const orgBCaller = /* org-B admin caller */;

    await expect(
      orgBCaller.framework.getControlChildren({ parentControlId: parentId }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/__tests__/integration/framework-control-children.test.ts`
Expected: FAIL — `getControlChildren` does not exist on the framework router.

Note: integration tests hit a **real** database (`src/__tests__/setup.ts:39-51` appends `_test` to the DB name). The `_test` database must exist.

- [ ] **Step 3: Write the implementation**

In `src/server/api/routers/framework.ts`, immediately after the `getControls` procedure, add:

```ts
  /**
   * Children of a single control, for lazy-expanding the framework tree.
   *
   * Deliberately separate from `getControls`, whose `other_Control` include is
   * capped at 5 as a preview. NIST 800-53 has 1216 controls, so the detail page
   * loads top-level rows only and calls this per expanded row.
   */
  getControlChildren: organizationProcedure
    .use(requirePermission(Permission.FRAMEWORK_READ))
    .input(z.object({ parentControlId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // The org filter extension scopes this read, so a control belonging to
      // another tenant is simply not found — no existence leak.
      const parent = await ctx.db.control.findUnique({
        where: { id: input.parentControlId },
      });

      if (!parent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Control not found",
        });
      }

      return ctx.db.control.findMany({
        where: { parentControlId: input.parentControlId },
        orderBy: { controlId: "asc" },
        include: {
          _count: { select: { other_Control: true } },
          ControlDomains: {
            include: {
              ControlDomain: { select: { id: true, code: true, name: true } },
            },
          },
        },
      });
    }),
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/__tests__/integration/framework-control-children.test.ts`
Expected: PASS — 3 tests, including the cross-tenant `NOT_FOUND`.

- [ ] **Step 5: Confirm no new typecheck errors**

Run: `npm run typecheck 2>&1 | grep -c 'error TS'`
Expected: `225` or lower.

- [ ] **Step 6: Commit**

```bash
git add src/server/api/routers/framework.ts src/__tests__/integration/framework-control-children.test.ts
git commit -m "Add getControlChildren so a framework tree can lazy-load children instead of paging a flat list"
```

---

## Task 3: The shared `FrameworkNodeTable` component

**Files:**
- Create: `src/components/frameworks/FrameworkNodeTable.tsx`
- Test: `src/__tests__/unit/FrameworkNodeTable.test.tsx`

**Interfaces:**
- Consumes: `FrameworkNode`, `flattenVisible` from `@/lib/frameworks/framework-node` (Task 1).
- Produces:
  ```ts
  interface FrameworkNodeTableColumns {
    level?: boolean;    // maturity: FUNCTION / CATEGORY / MIL 1 badge
    health?: boolean;   // compliance: Risks + Findings + Health
    domains?: boolean;  // compliance: taxonomy tags
    testing?: boolean;  // both: TI + AC
    children?: boolean; // compliance: "N sub-controls"
    actions?: boolean;  // compliance: actions dropdown
  }

  interface FrameworkNodeTableProps {
    nodes: FrameworkNode[];
    columns: FrameworkNodeTableColumns;
    expanded: ReadonlySet<string>;
    onToggleExpand: (node: FrameworkNode) => void;
    loadingChildIds?: ReadonlySet<string>;
    /** compliance only; keyed by node id */
    healthByNodeId?: ReadonlyMap<string, { health: "HEALTHY" | "AT_RISK" | "CRITICAL"; riskCount: number; findingCount: number }>;
    onRowClick?: (node: FrameworkNode) => void;
    onEditTesting?: (node: FrameworkNode, focus: "ti" | "ac") => void;
    onEditDomains?: (node: FrameworkNode) => void;
    renderActions?: (node: FrameworkNode) => React.ReactNode;
    /** When true, indentation and chevrons are suppressed (flat search results). */
    flat?: boolean;
  }
  export function FrameworkNodeTable(props: FrameworkNodeTableProps): React.JSX.Element
  ```

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/unit/FrameworkNodeTable.test.tsx`:

```tsx
/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { FrameworkNodeTable } from "@/components/frameworks/FrameworkNodeTable";
import type { FrameworkNode } from "@/lib/frameworks/framework-node";

const leaf = (id: string, code: string, title: string, depth: number): FrameworkNode => ({
  id,
  code,
  title,
  description: null,
  kind: "control",
  levelLabel: null,
  depth,
  childCount: 0,
  children: [],
  testInstructions: null,
  acceptanceCriteria: null,
  domains: [],
  isActive: true,
});

const family: FrameworkNode = {
  ...leaf("f1", "03.01", "Access Control", 0),
  childCount: 2,
  children: [leaf("c1", "03.01.01", "Account Management", 1), leaf("c2", "03.01.02", "Access Enforcement", 1)],
};

describe("FrameworkNodeTable", () => {
  it("renders only root rows when nothing is expanded", () => {
    render(
      <FrameworkNodeTable
        nodes={[family]}
        columns={{ children: true }}
        expanded={new Set()}
        onToggleExpand={jest.fn()}
      />,
    );

    expect(screen.getByText("03.01")).toBeInTheDocument();
    expect(screen.queryByText("03.01.01")).not.toBeInTheDocument();
  });

  it("renders children of an expanded row", () => {
    render(
      <FrameworkNodeTable
        nodes={[family]}
        columns={{ children: true }}
        expanded={new Set(["f1"])}
        onToggleExpand={jest.fn()}
      />,
    );

    expect(screen.getByText("03.01.01")).toBeInTheDocument();
    expect(screen.getByText("03.01.02")).toBeInTheDocument();
  });

  it("calls onToggleExpand with the node when the chevron is clicked", () => {
    const onToggleExpand = jest.fn();
    render(
      <FrameworkNodeTable
        nodes={[family]}
        columns={{}}
        expanded={new Set()}
        onToggleExpand={onToggleExpand}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /expand 03\.01/i }));
    expect(onToggleExpand).toHaveBeenCalledWith(family);
  });

  it("renders no chevron for a leaf", () => {
    render(
      <FrameworkNodeTable
        nodes={[leaf("c1", "03.01.01", "Account Management", 0)]}
        columns={{}}
        expanded={new Set()}
        onToggleExpand={jest.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /expand/i })).not.toBeInTheDocument();
  });

  it("shows a level badge only when the level column is on", () => {
    const domain: FrameworkNode = {
      ...leaf("gv", "GV", "Govern", 0),
      kind: "domain",
      levelLabel: "FUNCTION",
    };

    const { rerender } = render(
      <FrameworkNodeTable nodes={[domain]} columns={{ level: true }} expanded={new Set()} onToggleExpand={jest.fn()} />,
    );
    expect(screen.getByText("FUNCTION")).toBeInTheDocument();

    rerender(
      <FrameworkNodeTable nodes={[domain]} columns={{}} expanded={new Set()} onToggleExpand={jest.fn()} />,
    );
    expect(screen.queryByText("FUNCTION")).not.toBeInTheDocument();
  });

  it("renders health columns from healthByNodeId when the health column is on", () => {
    render(
      <FrameworkNodeTable
        nodes={[leaf("c1", "03.01.01", "Account Management", 0)]}
        columns={{ health: true }}
        expanded={new Set()}
        onToggleExpand={jest.fn()}
        healthByNodeId={new Map([["c1", { health: "CRITICAL", riskCount: 3, findingCount: 1 }]])}
      />,
    );

    expect(screen.getByText("Critical")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows a spinner in place of the chevron while children load", () => {
    render(
      <FrameworkNodeTable
        nodes={[{ ...family, children: null }]}
        columns={{}}
        expanded={new Set(["f1"])}
        onToggleExpand={jest.fn()}
        loadingChildIds={new Set(["f1"])}
      />,
    );

    expect(screen.getByLabelText(/loading children/i)).toBeInTheDocument();
  });

  it("suppresses chevrons and indentation in flat mode", () => {
    render(
      <FrameworkNodeTable
        nodes={[family]}
        columns={{}}
        expanded={new Set()}
        onToggleExpand={jest.fn()}
        flat
      />,
    );

    expect(screen.queryByRole("button", { name: /expand/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/__tests__/unit/FrameworkNodeTable.test.tsx`
Expected: FAIL — `Cannot find module '@/components/frameworks/FrameworkNodeTable'`.

- [ ] **Step 3: Write the implementation**

Create `src/components/frameworks/FrameworkNodeTable.tsx`:

```tsx
"use client";

/**
 * The one table every framework detail page renders.
 *
 * Purely presentational: it takes a normalized FrameworkNode tree, a column
 * config, and controlled expansion state. It does not fetch, and it does not
 * know whether it is showing a compliance framework or a maturity one.
 */

import type { ReactNode } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  Shield,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { flattenVisible, type FrameworkNode } from "@/lib/frameworks/framework-node";

export type NodeHealth = "HEALTHY" | "AT_RISK" | "CRITICAL";

export interface NodeHealthInfo {
  health: NodeHealth;
  riskCount: number;
  findingCount: number;
}

export interface FrameworkNodeTableColumns {
  level?: boolean;
  health?: boolean;
  domains?: boolean;
  testing?: boolean;
  children?: boolean;
  actions?: boolean;
}

export interface FrameworkNodeTableProps {
  nodes: FrameworkNode[];
  columns: FrameworkNodeTableColumns;
  expanded: ReadonlySet<string>;
  onToggleExpand: (node: FrameworkNode) => void;
  loadingChildIds?: ReadonlySet<string>;
  healthByNodeId?: ReadonlyMap<string, NodeHealthInfo>;
  onRowClick?: (node: FrameworkNode) => void;
  onEditTesting?: (node: FrameworkNode, focus: "ti" | "ac") => void;
  onEditDomains?: (node: FrameworkNode) => void;
  renderActions?: (node: FrameworkNode) => ReactNode;
  /** Flat search results: no chevrons, no indentation. */
  flat?: boolean;
}

function HealthBadge({ health }: { health: NodeHealth }) {
  if (health === "CRITICAL") {
    return (
      <Badge variant="destructive" className="gap-1">
        <ShieldAlert className="h-3 w-3" />
        Critical
      </Badge>
    );
  }
  if (health === "AT_RISK") {
    return (
      <Badge variant="outline" className="gap-1 border-yellow-500 text-yellow-600 bg-yellow-50">
        <Shield className="h-3 w-3" />
        At Risk
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 border-green-500 text-green-600 bg-green-50">
      <ShieldCheck className="h-3 w-3" />
      Healthy
    </Badge>
  );
}

/** Colour a maturity row by its level so the hierarchy reads at a glance. */
function levelBadgeClass(levelLabel: string | null): string {
  if (levelLabel === "FUNCTION") return "bg-purple-100 text-purple-700";
  if (levelLabel === "CATEGORY") return "bg-blue-100 text-blue-700";
  return "";
}

function TestingCell({
  value,
  label,
  onEdit,
}: {
  value: string | null;
  label: string;
  onEdit: () => void;
}) {
  if (value) {
    return (
      <Badge
        variant="secondary"
        className="text-xs cursor-pointer hover:bg-secondary/80 max-w-[130px] truncate"
        title={value}
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
      >
        {value}
      </Badge>
    );
  }
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 px-2 text-xs text-muted-foreground"
      onClick={(e) => {
        e.stopPropagation();
        onEdit();
      }}
    >
      <Plus className="h-3 w-3 mr-1" />
      {label}
    </Button>
  );
}

export function FrameworkNodeTable({
  nodes,
  columns,
  expanded,
  onToggleExpand,
  loadingChildIds,
  healthByNodeId,
  onRowClick,
  onEditTesting,
  onEditDomains,
  renderActions,
  flat = false,
}: FrameworkNodeTableProps) {
  const rows = flat ? nodes : flattenVisible(nodes, expanded);

  return (
    <div className="overflow-hidden rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[180px]">Control ID</TableHead>
            <TableHead>Title</TableHead>
            {columns.level && <TableHead className="w-[120px]">Level</TableHead>}
            {columns.health && <TableHead className="w-[80px] text-center">Risks</TableHead>}
            {columns.health && <TableHead className="w-[80px] text-center">Findings</TableHead>}
            {columns.health && <TableHead className="w-[100px]">Health</TableHead>}
            {columns.domains && <TableHead className="w-[120px]">Domains</TableHead>}
            {columns.testing && <TableHead className="w-[140px]">Test Instructions</TableHead>}
            {columns.testing && <TableHead className="w-[140px]">Acceptance Criteria</TableHead>}
            {columns.children && <TableHead className="w-[100px]">Children</TableHead>}
            {columns.actions && <TableHead className="w-[80px]">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((node) => {
            const isExpandable = !flat && node.childCount > 0;
            const isOpen = expanded.has(node.id);
            const isLoadingChildren = loadingChildIds?.has(node.id) ?? false;
            const healthInfo = healthByNodeId?.get(node.id);

            return (
              <TableRow
                key={node.id}
                className={onRowClick ? "cursor-pointer hover:bg-gray-50" : undefined}
                onClick={onRowClick ? () => onRowClick(node) : undefined}
              >
                <TableCell className="font-mono text-sm">
                  <div
                    className="flex items-center gap-1.5"
                    style={{ paddingLeft: flat ? 0 : `${node.depth * 1.25}rem` }}
                  >
                    {isLoadingChildren ? (
                      <Loader2
                        aria-label={`Loading children of ${node.code}`}
                        className="h-4 w-4 shrink-0 animate-spin text-muted-foreground"
                      />
                    ) : isExpandable ? (
                      <button
                        type="button"
                        aria-label={`${isOpen ? "Collapse" : "Expand"} ${node.code}`}
                        aria-expanded={isOpen}
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleExpand(node);
                        }}
                      >
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                    ) : (
                      <span className="w-4 shrink-0" />
                    )}
                    <span>{node.code}</span>
                  </div>
                </TableCell>

                <TableCell>
                  <p className="font-medium">{node.title}</p>
                  {node.description && (
                    <p className="text-sm text-gray-500 truncate max-w-md">{node.description}</p>
                  )}
                </TableCell>

                {columns.level && (
                  <TableCell>
                    {node.levelLabel && (
                      <Badge variant="secondary" className={`text-xs ${levelBadgeClass(node.levelLabel)}`}>
                        {node.levelLabel}
                      </Badge>
                    )}
                  </TableCell>
                )}

                {columns.health && (
                  <TableCell className="text-center">
                    {healthInfo && healthInfo.riskCount > 0 ? (
                      <Badge variant="outline" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {healthInfo.riskCount}
                      </Badge>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </TableCell>
                )}

                {columns.health && (
                  <TableCell className="text-center">
                    {healthInfo && healthInfo.findingCount > 0 ? (
                      <Badge variant="outline" className="gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {healthInfo.findingCount}
                      </Badge>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </TableCell>
                )}

                {columns.health && (
                  <TableCell>
                    <HealthBadge health={healthInfo?.health ?? "HEALTHY"} />
                  </TableCell>
                )}

                {columns.domains && (
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {node.domains && node.domains.length > 0 ? (
                        node.domains.map((d) => (
                          <Badge
                            key={d.id}
                            variant="secondary"
                            className="text-xs cursor-pointer hover:bg-secondary/80"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditDomains?.(node);
                            }}
                          >
                            {d.code}
                          </Badge>
                        ))
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-muted-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditDomains?.(node);
                          }}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add
                        </Button>
                      )}
                    </div>
                  </TableCell>
                )}

                {columns.testing && (
                  <TableCell>
                    <TestingCell
                      value={node.testInstructions}
                      label="TI"
                      onEdit={() => onEditTesting?.(node, "ti")}
                    />
                  </TableCell>
                )}

                {columns.testing && (
                  <TableCell>
                    <TestingCell
                      value={node.acceptanceCriteria}
                      label="AC"
                      onEdit={() => onEditTesting?.(node, "ac")}
                    />
                  </TableCell>
                )}

                {columns.children && (
                  <TableCell>
                    {node.childCount > 0 && (
                      <span className="text-sm text-gray-500">{node.childCount} sub-controls</span>
                    )}
                  </TableCell>
                )}

                {columns.actions && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {renderActions?.(node)}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/__tests__/unit/FrameworkNodeTable.test.tsx`
Expected: PASS — 8 tests.

- [ ] **Step 5: Confirm no new typecheck errors**

Run: `npm run typecheck 2>&1 | grep -c 'error TS'`
Expected: `225` or lower.

- [ ] **Step 6: Commit**

```bash
git add src/components/frameworks/FrameworkNodeTable.tsx src/__tests__/unit/FrameworkNodeTable.test.tsx
git commit -m "Add FrameworkNodeTable, one expandable table for every framework detail view"
```

---

## Task 4: Wire the compliance framework page onto the shared table

**Files:**
- Modify: `src/app/admin/frameworks/[id]/client.tsx`

**Interfaces:**
- Consumes: `FrameworkNodeTable` (Task 3), `controlsToNodes` + `FrameworkNode` (Task 1), `api.framework.getControlChildren` (Task 2).
- Produces: nothing new; this is a wiring task.

**What changes:** `getControls` is called with `topLevelOnly: true` when not searching. Roots become a `FrameworkNode[]` in state; expanding a root fetches and grafts its children. The `<Table>` markup at `:596-823` is replaced by `<FrameworkNodeTable>`. **Everything else on this page stays exactly as it is** — the metadata cards, the health summary cards, the health filter, the search box, the Add Control dialog, the domain tagging dialog, the testing-fields dialog, `ControlDetailModal`, and pagination.

- [ ] **Step 1: Add the tree state and the lazy-load effect**

In `src/app/admin/frameworks/[id]/client.tsx`, add these imports alongside the existing ones:

```tsx
import { useEffect } from "react";
import { FrameworkNodeTable } from "@/components/frameworks/FrameworkNodeTable";
import { controlsToNodes, type FrameworkNode } from "@/lib/frameworks/framework-node";
```

(`useState` is already imported at `:11`; extend that import to `import { useEffect, useState } from "react";` rather than adding a second React import.)

Replace the `getControls` query at `:180-186` with:

```tsx
  const isSearching = debouncedSearch.length > 0;

  // Not searching: load top-level rows only and lazy-expand. Searching: flat
  // results, because a search hit deep in the tree has no meaningful parent row
  // to draw it under.
  const { data: controlsData, isLoading: isLoadingControls } =
    api.framework.getControls.useQuery({
      frameworkId,
      topLevelOnly: !isSearching,
      search: debouncedSearch || undefined,
      page: currentPage,
      pageSize,
    });
```

Then, after the mutations and before `handleCreateControl`, add:

```tsx
  const [rootNodes, setRootNodes] = useState<FrameworkNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loadingChildIds, setLoadingChildIds] = useState<Set<string>>(new Set());
  const [pendingExpandId, setPendingExpandId] = useState<string | null>(null);

  // Rebuild the tree whenever the server returns a new page / search result.
  // Expansion is reset with it: the old ids are not on screen any more.
  useEffect(() => {
    setRootNodes(controlsToNodes(controlsData?.controls ?? []));
    setExpanded(new Set());
  }, [controlsData]);

  const { data: childControls } = api.framework.getControlChildren.useQuery(
    { parentControlId: pendingExpandId! },
    { enabled: pendingExpandId !== null },
  );

  // Graft fetched children onto the node that asked for them.
  useEffect(() => {
    if (!pendingExpandId || !childControls) return;
    const parentId = pendingExpandId;
    const children = controlsToNodes(childControls);

    setRootNodes((prev) => graftChildren(prev, parentId, children));
    setLoadingChildIds((prev) => {
      const next = new Set(prev);
      next.delete(parentId);
      return next;
    });
    setPendingExpandId(null);
  }, [pendingExpandId, childControls]);

  const handleToggleExpand = (node: FrameworkNode) => {
    const isOpen = expanded.has(node.id);

    setExpanded((prev) => {
      const next = new Set(prev);
      if (isOpen) next.delete(node.id);
      else next.add(node.id);
      return next;
    });

    // Fetch children the first time this row opens.
    if (!isOpen && node.children === null) {
      setLoadingChildIds((prev) => new Set(prev).add(node.id));
      setPendingExpandId(node.id);
    }
  };
```

Add this helper **above** the `FrameworkDetailClient` function (next to `ControlHealthBadge`):

```tsx
/**
 * Return a copy of the tree with `children` attached to the node with `parentId`.
 * Children arrive one level at a time, so this only ever has to recurse.
 */
function graftChildren(
  nodes: FrameworkNode[],
  parentId: string,
  children: FrameworkNode[],
): FrameworkNode[] {
  return nodes.map((node) => {
    if (node.id === parentId) {
      return {
        ...node,
        children: children.map((child) => ({ ...child, depth: node.depth + 1 })),
      };
    }
    if (node.children === null) return node;
    return { ...node, children: graftChildren(node.children, parentId, children) };
  });
}
```

- [ ] **Step 2: Replace the table markup**

Delete the `controlsWithHealth` / `filteredControls` block at `:308-322` and replace it with a health lookup map plus a health filter over the visible rows:

```tsx
  const healthByNodeId = new Map(
    (healthData?.controls ?? []).map((h) => [
      h.id,
      { health: h.health, riskCount: h.riskCount, findingCount: h.findingCount },
    ]),
  );

  // The health filter narrows which ROOT rows are shown. Filtering mid-tree
  // would orphan children, so a filtered view is a flat view.
  const isFiltering = healthFilter !== "all";
  const visibleRoots = isFiltering
    ? rootNodes.filter((n) => (healthByNodeId.get(n.id)?.health ?? "HEALTHY") === healthFilter)
    : rootNodes;
```

Replace the whole `<div className="overflow-hidden rounded-md border">…</Table></div>` block (`:596-823`) with:

```tsx
              <FrameworkNodeTable
                nodes={visibleRoots}
                columns={{
                  health: true,
                  domains: true,
                  testing: true,
                  children: true,
                  actions: true,
                }}
                expanded={expanded}
                onToggleExpand={handleToggleExpand}
                loadingChildIds={loadingChildIds}
                healthByNodeId={healthByNodeId}
                flat={isSearching || isFiltering}
                onRowClick={(node) => setSelectedControlId(node.id)}
                onEditTesting={(node, focus) => {
                  setEditingTestingControlId(node.id);
                  setEditingTestingField(focus === "ti" ? "testInstructions" : "acceptanceCriteria");
                  setEditingTestInstructions(node.testInstructions ?? "");
                  setEditingAcceptanceCriteria(node.acceptanceCriteria ?? "");
                }}
                onEditDomains={(node) => {
                  setTaggingControlId(node.id);
                  setTaggingControlDomains((node.domains ?? []).map((d) => d.id));
                }}
                renderActions={(node) => (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        Actions
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setSelectedControlId(node.id)}>
                        <FileText className="h-4 w-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      {node.isActive ? (
                        <DropdownMenuItem
                          onClick={() => deprecateControlMutation.mutate({ id: node.id })}
                          className="text-amber-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Deprecate
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() => restoreControlMutation.mutate({ id: node.id })}
                          className="text-green-600"
                        >
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Restore
                        </DropdownMenuItem>
                      )}
                      {(healthByNodeId.get(node.id)?.riskCount ?? 0) === 0 &&
                        (healthByNodeId.get(node.id)?.findingCount ?? 0) === 0 && (
                          <DropdownMenuItem
                            onClick={() => deleteControlMutation.mutate({ id: node.id })}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              />
```

The empty-state check at `:574` currently reads `filteredControls.length === 0`. Change it to `visibleRoots.length === 0`.

Directly above `<FrameworkNodeTable>`, add the flat-mode notice:

```tsx
              {(isSearching || isFiltering) && (
                <p className="mb-2 text-sm text-muted-foreground">
                  Showing flat search results — expand is disabled while filtering.
                </p>
              )}
```

Finally, the pagination copy at `:828-831` says "controls". When `topLevelOnly` is on, `pagination.totalCount` is now the count of **top-level** rows. Change the label to:

```tsx
                  <p className="text-sm text-gray-500">
                    Showing {currentPage * pageSize + 1} to{" "}
                    {Math.min((currentPage + 1) * pageSize, pagination.totalCount)} of{" "}
                    {pagination.totalCount} {isSearching ? "matching controls" : "top-level controls"}
                  </p>
```

Now that the old `<Table>` is gone, remove the imports it needed and nothing else does: `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow` (`:23-30`), and the icons `AlertTriangle`, `Shield`, `ShieldAlert`, `ShieldCheck`, `AlertCircle`. **Leave `ControlHealthBadge` deleted too** — it now lives inside `FrameworkNodeTable`. Verify nothing else in the file references them before deleting.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck 2>&1 | grep -c 'error TS'`
Expected: `225` or lower. If a `verbatimModuleSyntax` error appears, the `FrameworkNode` import needs `import { type FrameworkNode }`.

- [ ] **Step 4: Verify in the running app**

The app is already running in Docker on port 80. Next.js hot-reloads.

Open `http://localhost/admin/frameworks/550e8400-e29b-41d4-a716-446655440073` (NIST SP 800-171) and confirm:
1. Seventeen `03.xx` family rows render, **not** 50 mixed rows.
2. Each family shows a chevron and `N sub-controls`.
3. Clicking a chevron shows a spinner, then indents the `03.xx.yy` requirements beneath it.
4. Typing in the search box flattens the list and shows the notice.
5. Row click still opens `ControlDetailModal`; the TI/AC and domain dialogs still open and save.

Then open the NIST SP 800-53 framework (1,216 controls) and confirm the page loads without a multi-second stall.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/frameworks/\[id\]/client.tsx
git commit -m "Render compliance frameworks as an expandable tree so control families are visible instead of flattened into sibling rows"
```

---

## Task 5: Wire the maturity framework page onto the shared table

**Files:**
- Modify: `src/app/admin/frameworks/maturity/[id]/client.tsx`

**Interfaces:**
- Consumes: `FrameworkNodeTable` (Task 3), `maturityToNodes` + `FrameworkNode` (Task 1).
- Produces: nothing new.

**What changes:** The bespoke `DomainNode` / `QuestionRow` / `TestingBadges` tree (`:425-597`) is deleted and replaced by `<FrameworkNodeTable>` with `columns={{ level: true, testing: true }}` — **no Risks, Findings, Health, Domains, Children, or Actions columns**, because `MaturityDomain` carries none of that data. The page also gains the admin chrome it was missing: metadata cards and a search box. The Scoring Levels card and the testing-fields dialog stay as they are.

- [ ] **Step 1: Replace the tree with the shared table**

In `src/app/admin/frameworks/maturity/[id]/client.tsx`:

Replace the imports at `:12-14` — drop `Collapsible*` (`:38-42`) and the chevron icons, add what the new markup needs:

```tsx
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Calendar, Hash, Layers, Loader2, Search, Shield, Tag } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FrameworkNodeTable } from "@/components/frameworks/FrameworkNodeTable";
import { maturityToNodes, type FrameworkNode } from "@/lib/frameworks/framework-node";
```

(Keep the existing `Card*`, `Badge`, `Dialog*`, `Label`, `Textarea` imports.)

Add tree + search state next to the existing dialog state (after `:71`):

```tsx
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
```

After `frameworkLevelQuestions` is computed (`:154`), build the node tree. A maturity framework arrives whole from the server (134 domains at most), so there is nothing to lazy-load:

```tsx
  const rootNodes = useMemo(
    () =>
      framework
        ? maturityToNodes(framework.domainHierarchy, framework.questions)
        : [],
    [framework],
  );

  // Search flattens: a hit deep in the tree has no parent row on screen to sit
  // under. Match on code and title, which is what people search by.
  const isSearching = search.trim().length > 0;
  const searchResults = useMemo(() => {
    if (!isSearching) return [];
    const needle = search.trim().toLowerCase();
    const hits: FrameworkNode[] = [];
    const visit = (node: FrameworkNode) => {
      if (
        node.code.toLowerCase().includes(needle) ||
        node.title.toLowerCase().includes(needle)
      ) {
        hits.push({ ...node, depth: 0 });
      }
      for (const child of node.children ?? []) visit(child);
    };
    for (const root of rootNodes) visit(root);
    return hits;
  }, [isSearching, search, rootNodes]);
```

Note: `useMemo` must sit above the early returns for `isLoading` / `error` (React hooks cannot be called conditionally). Move the two `useMemo` blocks **above** the `if (isLoading)` guard at `:114`, and guard on `framework` being undefined inside them as shown.

Replace the entire Domains `<Card>` body (`:249-327`) with:

```tsx
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base">Domains</CardTitle>
                <CardDescription>
                  {framework.domains.length} domains •{" "}
                  {framework.questions.length > 0
                    ? `${framework.questions.length} practices/questions`
                    : "no questions (subcategories are the controls)"}
                </CardDescription>
              </div>
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search domains..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {rootNodes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No domains defined.</p>
            ) : isSearching && searchResults.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No domains match “{search}”.
              </p>
            ) : (
              <>
                {isSearching && (
                  <p className="mb-2 text-sm text-muted-foreground">
                    Showing flat search results — {searchResults.length} match
                    {searchResults.length === 1 ? "" : "es"}.
                  </p>
                )}
                <FrameworkNodeTable
                  nodes={isSearching ? searchResults : rootNodes}
                  columns={{ level: true, testing: true }}
                  expanded={expanded}
                  flat={isSearching}
                  onToggleExpand={(node) =>
                    setExpanded((prev) => {
                      const next = new Set(prev);
                      if (next.has(node.id)) next.delete(node.id);
                      else next.add(node.id);
                      return next;
                    })
                  }
                  onEditTesting={(node, focus) =>
                    openEditor(
                      {
                        kind: node.kind === "question" ? "question" : "domain",
                        id: node.id,
                        code: node.code,
                        name: node.title,
                        testInstructions: node.testInstructions,
                        acceptanceCriteria: node.acceptanceCriteria,
                      },
                      focus,
                    )
                  }
                />
              </>
            )}

            {/* Questions not bound to any domain sit outside the tree. */}
            {frameworkLevelQuestions.length > 0 && !isSearching && (
              <div className="mt-6 space-y-2 border-t pt-4">
                <h3 className="text-sm font-medium">Framework-level questions</h3>
                <FrameworkNodeTable
                  nodes={frameworkLevelQuestions.map((q) => ({
                    id: q.id,
                    code: q.practiceCode ?? q.id.slice(0, 8),
                    title: q.questionText,
                    description: null,
                    kind: "question" as const,
                    levelLabel: q.practiceLevel === null ? null : `MIL ${q.practiceLevel}`,
                    depth: 0,
                    childCount: 0,
                    children: [],
                    testInstructions: q.testInstructions,
                    acceptanceCriteria: q.acceptanceCriteria,
                  }))}
                  columns={{ level: true, testing: true }}
                  expanded={new Set()}
                  flat
                  onToggleExpand={() => undefined}
                  onEditTesting={(node, focus) =>
                    openEditor(
                      {
                        kind: "question",
                        id: node.id,
                        code: node.code,
                        name: node.title,
                        testInstructions: node.testInstructions,
                        acceptanceCriteria: node.acceptanceCriteria,
                      },
                      focus,
                    )
                  }
                />
              </div>
            )}
          </CardContent>
        </Card>
```

Delete `DomainNode`, `QuestionRow`, `TestingBadges`, and the now-unused `DomainNodeShape` / `QuestionShape` types (`:401-597`).

- [ ] **Step 2: Add the metadata cards so the page matches the compliance chrome**

Immediately after the header `<Card>` closes (`:204`) and **before** the Scoring Levels card, insert:

```tsx
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <Tag className="mr-3 h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Version</p>
                  <p className="text-lg font-medium">{framework.version}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <Hash className="mr-3 h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Total Domains</p>
                  <p className="text-lg font-medium">{framework.domains.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <Layers className="mr-3 h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Scoring Levels</p>
                  <p className="text-lg font-medium">
                    {framework.minLevel}–{framework.maxLevel}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <Calendar className="mr-3 h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Practices</p>
                  <p className="text-lg font-medium">{framework.questions.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck 2>&1 | grep -c 'error TS'`
Expected: `225` or lower.

- [ ] **Step 4: Verify all three maturity frameworks in the running app**

From `http://localhost/admin/frameworks`, click **View** on each of the three maturity frameworks:

1. **NIST Cybersecurity Framework 2.0** — six FUNCTION rows (GV, ID, PR, DE, RS, RC) in the GV → ID → PR → DE → RS → RC order the server sorts them into, each expandable to CATEGORY, each of those expandable to SUBCATEGORY. The Level column shows `FUNCTION` / `CATEGORY` / `SUBCATEGORY`. No Risks / Findings / Health / Domains / Actions columns.
2. **C2M2** — ten domains, each expanding to `MIL N` practice rows.
3. **OWASP SAMM** — five business functions expanding to question rows.

On each: the search box flattens results; clicking TI or AC opens the testing dialog and saving shows a sonner toast and refreshes the row.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/frameworks/maturity/\[id\]/client.tsx
git commit -m "Render maturity frameworks through the shared framework table so CSF, C2M2 and SAMM match the compliance framework pages"
```

---

## Task 6: End-to-end coverage

**Files:**
- Create: `e2e/framework-hierarchy.spec.ts`

**Interfaces:**
- Consumes: `login`, `USERS`, and the seeded demo DB from `e2e/support/helpers.ts:30-36`.
- Produces: nothing.

Read `e2e/support/helpers.ts` before writing this — auth is a **form login helper**, not `storageState`, and Radix `Select`s need `selectByTrigger` (`helpers.ts:59-72`). This spec touches no Selects and creates no entities, so no `uid()` suffixing is needed.

- [ ] **Step 1: Write the spec**

Create `e2e/framework-hierarchy.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { login, USERS } from "./support/helpers";

test.describe("Framework detail views render a hierarchy", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, USERS.admin);
  });

  test("NIST SP 800-171 shows families that expand to requirements", async ({ page }) => {
    await page.goto("/admin/frameworks");
    await page.getByRole("link", { name: /^View$/ }).nth(2).click(); // NIST SP 800-171

    // Families are visible; requirements are not, until expanded.
    await expect(page.getByText("03.01", { exact: true })).toBeVisible();
    await expect(page.getByText("03.01.01", { exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "Expand 03.01" }).click();

    await expect(page.getByText("03.01.01", { exact: true })).toBeVisible();
  });

  test("NIST CSF 2.0 maturity shows Functions that expand to Categories", async ({ page }) => {
    await page.goto("/admin/frameworks");
    await page
      .locator("div")
      .filter({ hasText: "NIST Cybersecurity Framework 2.0" })
      .getByRole("link", { name: /^View$/ })
      .first()
      .click();

    await expect(page).toHaveURL(/\/admin\/frameworks\/maturity\//);

    // The six CSF Functions.
    await expect(page.getByText("GV", { exact: true })).toBeVisible();
    await expect(page.getByText("FUNCTION").first()).toBeVisible();

    // Categories hidden until GV is expanded.
    await expect(page.getByText("GV.OC", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Expand GV" }).click();
    await expect(page.getByText("GV.OC", { exact: true })).toBeVisible();
  });

  test("the maturity view does not offer risk, finding, or health columns", async ({ page }) => {
    await page.goto("/admin/frameworks");
    await page
      .locator("div")
      .filter({ hasText: "NIST Cybersecurity Framework 2.0" })
      .getByRole("link", { name: /^View$/ })
      .first()
      .click();

    await expect(page.getByRole("columnheader", { name: "Level" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Risks" })).toHaveCount(0);
    await expect(page.getByRole("columnheader", { name: "Findings" })).toHaveCount(0);
    await expect(page.getByRole("columnheader", { name: "Health" })).toHaveCount(0);
  });
});
```

- [ ] **Step 2: Run the spec**

Run: `PW_BASE_URL=http://127.0.0.1 npx playwright test e2e/framework-hierarchy.spec.ts`
Expected: 3 passing. The base URL override is mandatory — `playwright.config.ts:11-13` defaults to `:3000` and the app is on port 80.

If the `nth(2)` "View" link picks the wrong framework, replace it with the same `locator("div").filter({ hasText: "NIST SP 800-171" })` pattern the other two tests use.

- [ ] **Step 3: Commit**

```bash
git add e2e/framework-hierarchy.spec.ts
git commit -m "Cover the framework hierarchy views with end-to-end tests"
```

---

## Task 7: Final verification

- [ ] **Step 1: Full unit + integration suite**

Run: `npm test`
Expected: no new failures against the pre-existing baseline. Note which tests were already failing before this branch if any are.

- [ ] **Step 2: Typecheck against the baseline**

Run: `npm run typecheck 2>&1 | grep -c 'error TS'`
Expected: **225 or lower**. Application source must be at zero:
Run: `npm run typecheck 2>&1 | grep 'error TS' | grep -vE 'src/__tests__|e2e/' | wc -l`
Expected: `0`.

- [ ] **Step 3: Smoke the app**

Walk every affected page in the Docker app on `http://localhost`:
- `/admin/frameworks` — list unchanged.
- `/admin/frameworks/<iso27001>` — 45 flat controls, no chevrons, paginates as before.
- `/admin/frameworks/<800-171>` — 17 families, expand works.
- `/admin/frameworks/<800-53>` — loads fast, expand works.
- `/admin/frameworks/maturity/<csf2>` — three-level tree, level badges.
- `/admin/frameworks/maturity/<c2m2>` — domains → MIL practices.
- `/admin/frameworks/maturity/<samm>` — functions → questions.

- [ ] **Step 4: Confirm nothing else consumed what was deleted**

Run: `npx tsc --noEmit` and separately grep for stragglers:
Run: `grep -rn "ControlHealthBadge\|DomainNode\|TestingBadges" src/ --include=*.tsx --include=*.ts`
Expected: matches only inside `src/components/frameworks/FrameworkNodeTable.tsx` (or none at all).

---

## Out of Scope (deliberately)

- `/compliance/frameworks/[id]` — the *other* framework view, which flattens the hierarchy the same way. It is a separate router (`compliance.getFrameworkDetails`) and a separate page. Worth a follow-up; not in this plan.
- The `Health Score` metric. It currently reads **100%** for NIST SP 800-171 because that framework has zero linked risks and zero linked findings — the score is computed over an empty set. This plan **preserves** the existing behavior rather than fixing it. It should be a separate ticket.
- Linking risks and findings to `MaturityDomain` so maturity frameworks could one day have real health data. That is a schema change and was explicitly deferred.
- Tree-aware search that expands the ancestor chain to a hit. Both pages flatten on search by design.
