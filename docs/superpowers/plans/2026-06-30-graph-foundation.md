# Graph Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a property-graph layer (generic `Node` + `Edge` tables) to the existing Postgres/Prisma app as the system of record for relationships, proven end-to-end by migrating the `RiskOrganizationalControl` crosswalk into `MITIGATES` edges and adding net-new `COUNTERS` (Control→ATT&CK Technique) edges + a 2-hop traversal.

**Architecture:** Option B "hybrid identity graph" — typed tables keep their attributes; each graph entity gets one `Node` row, and all relationships become rows in one `Edge` table. A `graphService` is the sole read/write path (owns tenancy + edge-catalog validation); a `$extends` client extension keeps `Node` rows in sync with entity lifecycle; a re-runnable backfill script seeds nodes for existing rows and migrates the crosswalk. `RiskOrganizationalControl` is dropped at the end (clean cut, router contracts unchanged).

**Tech Stack:** Next.js 15 (App Router), tRPC v11, Prisma 7.7 + `@prisma/adapter-pg` (PostgreSQL), Zod 3.25, Jest 30 + ts-jest, Docker Compose (`postgres` + `test` services).

## Global Constraints

- **Node-type mapping is fixed:** `OrganizationalControl` → `Control`, `Risk` → `Risk`, `MitreTechnique` → `Technique`. (Framework `Control` = "Requirement" is NOT in scope.)
- **Edge directions are fixed by the catalog:** `MITIGATES: Control→Risk`, `COUNTERS: Control→Technique`.
- **`graphService` is the ONLY path** to read/write `Node`/`Edge`. Routers and scripts must not call `db.node`/`db.edge` directly (except the backfill script and test cleanup, which may use raw SQL).
- **Router tRPC input/output contracts must remain byte-identical** through the migration — existing UI and tests must not need changes except where they reference the dropped `RiskOrganizationalControl` table directly.
- **Keep the `RiskOrgControlRole` enum** (`IN_PLACE | NEEDED`) in `schema.prisma` even after dropping the model — router inputs import it from `@prisma/client` and edge `properties.role` stores it.
- **Multi-tenancy (REVISED — default-deny + escape hatch; supersedes the original allowlist approach after a HIGH security finding):** `Node` and `Edge` are **NOT** added to `ALLOWLIST_TABLES`. `Edge` is accessed through the filtered `db` (default-deny auto-filter) and `graphService` *also* passes `organizationId` explicitly in every edge `where`/`create`. `Node` reads/writes go through `rawPrisma` (the existing unfiltered client, imported from `@/server/db`) inside `graphService` and the sync extension only — this is the sanctioned escape hatch needed because Node rows can be global (`organizationId = null`) and are keyed by the compound `(type, entityId)`. `createEdge` uses `findFirst` + `create`/`update`, NOT a compound-unique `upsert`. Direct `db.node`/`db.edge` use in routers is prohibited but is now fail-safe (default-deny).
- **Every `graphService` method takes an optional final `client` argument** (default `db`) so callers inside a `$transaction` can pass `tx`.
- **All graph entity ids are cuid strings.** Edge/Node ids use Prisma `@default(cuid())`.

## Running tests (Docker)

The test suite runs inside the `test` service container against the `postgres` service.

```bash
# One-time per session: bring up db + test container
docker compose --profile test up -d postgres test

# After ANY change to schema.prisma: apply schema + regenerate client IN the test container
docker exec betterthanspreadsheetsgrc-test-1 npx prisma db push --url "$DATABASE_URL" --accept-data-loss
docker exec betterthanspreadsheetsgrc-test-1 npx prisma generate

# Run a single test file
docker exec betterthanspreadsheetsgrc-test-1 npx jest src/__tests__/integration/<file>.test.ts

# Run the whole suite (final task)
docker exec betterthanspreadsheetsgrc-test-1 npx jest
```

> If `$DATABASE_URL` is not set in your shell, the test container already has it in its environment — run the `db push` without `--url` from inside via `docker exec ... sh -lc 'npx prisma db push --accept-data-loss'`.

---

## File Structure

**Create:**
- `src/server/graph/graph-types.ts` — node/edge type maps, `EDGE_CATALOG`, error classes.
- `src/server/graph/graph-service.ts` — the graph service (sole Node/Edge access path).
- `src/server/db/middleware/graph-sync.ts` — `$extends` extension keeping `Node` in sync with entity lifecycle.
- `src/server/api/routers/graph.ts` — tRPC router for `COUNTERS` management + `techniqueExposure`.
- `prisma/scripts/backfill-graph.ts` — re-runnable backfill (nodes for existing rows + crosswalk → edges).
- `src/__tests__/integration/graph-service.test.ts`
- `src/__tests__/integration/graph-sync.test.ts`
- `src/__tests__/integration/graph-mitigates-migration.test.ts`
- `src/__tests__/integration/graph-counters.test.ts`
- `src/__tests__/integration/graph-backfill.test.ts`

**Modify:**
- `prisma/schema.prisma` — add `Node`, `Edge` models + `GraphNodeType`, `GraphEdgeType` enums (Task 1); drop `RiskOrganizationalControl` model (Task 11).
- ~~`src/server/db/middleware/organization-filter.ts` — add `"Node"`, `"Edge"` to `ALLOWLIST_TABLES`.~~ **REMOVED** (security revision): `Node`/`Edge` stay default-denied; do NOT touch the allowlist.
- `src/server/db.ts:76` — compose `graphSyncMiddleware` after `organizationFilterMiddleware`.
- `src/server/api/routers/organizationalControl.ts` — repoint 5 endpoints (`getLinkedRisks`, `getForRisk`, `linkToRisk`, `unlinkFromRisk`, `bulkLinkToRisk`) to `graphService`.
- `src/server/api/routers/risk.ts` — repoint `create` control-linking + the risk-assessment-project `$transaction` block (~line 6096).
- `src/server/api/routers/controlLink.ts` — repoint the `riskOrganizationalControl` sync block (~line 296).
- `src/server/api/routers/riskAssessmentProject.ts` — repoint its `riskOrganizationalControl` usage.
- `src/server/api/root.ts` — register the new `graph` router.

---

## Task 1: Graph substrate (schema only — default-deny tenancy)

> **SECURITY REVISION (supersedes the original "schema + allowlist" task):** Do **NOT**
> allowlist `Node`/`Edge`. They stay default-denied by the org filter. The smoke test proves
> *isolation* (org B cannot see org A's edge), not a bypass. Node global rows are written via
> `rawPrisma` (the sanctioned escape hatch).

**Files:**
- Modify: `prisma/schema.prisma` (add enums + models near the end of the file)
- Test: `src/__tests__/integration/graph-service.test.ts` (first test only)

**Interfaces:**
- Produces: Prisma models `Node { id, organizationId?, type, entityId, createdAt }` and `Edge { id, organizationId, type, fromNodeId, toNodeId, properties?, createdById?, createdAt }`; enums `GraphNodeType { Control Risk Technique }`, `GraphEdgeType { MITIGATES COUNTERS }`. `db.node`/`db.edge` are **default-denied** (auto org-filtered); `rawPrisma.node`/`rawPrisma.edge` are the unfiltered escape hatch used only by graphService/sync/backfill.

- [ ] **Step 1: Add enums and models to `prisma/schema.prisma`**

Append at the end of the file:

```prisma
// ============================================================================
// Graph Foundation — generic property graph (Node + Edge) as the system of
// record for relationships. See docs/superpowers/specs/2026-06-30-graph-foundation-design.md
// ============================================================================

enum GraphNodeType {
  Control // OrganizationalControl
  Risk
  Technique // MitreTechnique (global)
}

enum GraphEdgeType {
  MITIGATES // Control -> Risk
  COUNTERS // Control -> Technique
}

model Node {
  id             String        @id @default(cuid())
  organizationId String? // null = global (e.g. Technique)
  type           GraphNodeType
  entityId       String // id of the typed row (OrganizationalControl/Risk/MitreTechnique)
  createdAt      DateTime      @default(now())

  outEdges Edge[] @relation("EdgeFrom")
  inEdges  Edge[] @relation("EdgeTo")

  @@unique([type, entityId])
  @@index([organizationId])
  @@index([entityId])
}

model Edge {
  id             String        @id @default(cuid())
  organizationId String // asserting org — edges are ALWAYS owned, never global
  type           GraphEdgeType
  fromNodeId     String
  toNodeId       String
  properties     Json?
  createdById    String?
  createdAt      DateTime      @default(now())

  fromNode Node @relation("EdgeFrom", fields: [fromNodeId], references: [id], onDelete: Cascade)
  toNode   Node @relation("EdgeTo", fields: [toNodeId], references: [id], onDelete: Cascade)

  @@unique([fromNodeId, type, toNodeId])
  @@index([organizationId, type])
  @@index([fromNodeId])
  @@index([toNodeId])
}
```

- [ ] **Step 2: Do NOT touch the allowlist**

`Node` and `Edge` are intentionally left OUT of `ALLOWLIST_TABLES` so the org filter
default-denies them. There is no edit to `organization-filter.ts` in this task. (If a previous
revision of this task added `"Node"`/`"Edge"` to the allowlist, REMOVE those two lines now.)

- [ ] **Step 3: Apply schema and regenerate the client**

```bash
docker compose --profile test up -d postgres test
docker exec betterthanspreadsheetsgrc-test-1 npx prisma db push --url "$DATABASE_URL" --accept-data-loss
docker exec betterthanspreadsheetsgrc-test-1 npx prisma generate
```
Expected: `db push` reports the two new tables created; `generate` succeeds.

- [ ] **Step 4: Write the failing smoke test**

Create `src/__tests__/integration/graph-service.test.ts`. This proves the substrate exists AND
that `Edge` is default-denied (org B cannot see org A's edge), AND that a global (null-org) node
is creatable via `rawPrisma`:

```ts
import { db, rawPrisma } from "@/server/db";
import { runWithOrganizationContext } from "@/server/db/middleware/organization-filter";
import { randomUUID } from "crypto";

describe("Graph substrate (default-deny tenancy)", () => {
  const orgA = randomUUID();
  const orgB = randomUUID();
  const fromEntityId = randomUUID();
  const toEntityId = randomUUID();
  const globalTechniqueEntityId = randomUUID();
  let edgeId: string;

  beforeAll(async () => {
    // rawPrisma bypasses the org filter — the sanctioned escape hatch.
    const fromNode = await rawPrisma.node.create({
      data: { organizationId: orgA, type: "Control", entityId: fromEntityId },
    });
    const toNode = await rawPrisma.node.create({
      data: { organizationId: orgA, type: "Risk", entityId: toEntityId },
    });
    const edge = await rawPrisma.edge.create({
      data: { organizationId: orgA, type: "MITIGATES", fromNodeId: fromNode.id, toNodeId: toNode.id },
    });
    edgeId = edge.id;
    // A global (null-org) Technique node must be creatable via rawPrisma.
    await rawPrisma.node.create({
      data: { organizationId: null, type: "Technique", entityId: globalTechniqueEntityId },
    });
  });

  afterAll(async () => {
    await rawPrisma.$executeRaw`DELETE FROM "Edge" WHERE "organizationId" = ${orgA}`;
    await rawPrisma.$executeRaw`DELETE FROM "Node" WHERE "organizationId" = ${orgA}`;
    await rawPrisma.$executeRaw`DELETE FROM "Node" WHERE "entityId" = ${globalTechniqueEntityId}`;
  });

  it("creates a global (null-org) Technique node via rawPrisma", async () => {
    const node = await rawPrisma.node.findFirst({ where: { entityId: globalTechniqueEntityId } });
    expect(node).not.toBeNull();
    expect(node!.organizationId).toBeNull();
  });

  it("default-denies Edge: org A sees its edge, org B does not", async () => {
    const seenByA = await runWithOrganizationContext(orgA, () =>
      db.edge.findMany({ where: { type: "MITIGATES" } }),
    );
    expect(seenByA.some((e) => e.id === edgeId)).toBe(true);

    const seenByB = await runWithOrganizationContext(orgB, () =>
      db.edge.findMany({ where: { type: "MITIGATES" } }),
    );
    expect(seenByB.some((e) => e.id === edgeId)).toBe(false);
  });
});
```

- [ ] **Step 5: Run it**

Run: `docker exec betterthanspreadsheetsgrc-test-1 npx jest src/__tests__/integration/graph-service.test.ts`
Expected: PASS (proves schema + client + default-deny isolation + rawPrisma escape hatch).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma src/__tests__/integration/graph-service.test.ts
git commit -m "feat(graph): add Node/Edge substrate (default-deny tenancy)"
```

---

## Task 2: Graph types — catalog, type maps, errors

**Files:**
- Create: `src/server/graph/graph-types.ts`
- Test: `src/__tests__/integration/graph-service.test.ts` (add a `describe` block)

**Interfaces:**
- Consumes: `GraphNodeType`, `GraphEdgeType` from `@prisma/client`.
- Produces:
  - `NODE_SYNC_MODELS: Record<string, GraphNodeType>` = `{ OrganizationalControl: "Control", Risk: "Risk", MitreTechnique: "Technique" }`
  - `EDGE_CATALOG: Record<GraphEdgeType, { from: GraphNodeType; to: GraphNodeType }>`
  - `assertEdgeAllowed(type: GraphEdgeType, fromType: GraphNodeType, toType: GraphNodeType): void` (throws `GraphCatalogError`)
  - `class GraphCatalogError extends Error`
  - `class GraphNodeMissingError extends Error`

- [ ] **Step 1: Write the failing test**

Add to `src/__tests__/integration/graph-service.test.ts`:

```ts
import {
  EDGE_CATALOG,
  NODE_SYNC_MODELS,
  assertEdgeAllowed,
  GraphCatalogError,
} from "@/server/graph/graph-types";

describe("Graph types", () => {
  it("maps entity models to node types", () => {
    expect(NODE_SYNC_MODELS.OrganizationalControl).toBe("Control");
    expect(NODE_SYNC_MODELS.Risk).toBe("Risk");
    expect(NODE_SYNC_MODELS.MitreTechnique).toBe("Technique");
  });

  it("defines MITIGATES and COUNTERS in the catalog", () => {
    expect(EDGE_CATALOG.MITIGATES).toEqual({ from: "Control", to: "Risk" });
    expect(EDGE_CATALOG.COUNTERS).toEqual({ from: "Control", to: "Technique" });
  });

  it("accepts a valid edge triple", () => {
    expect(() => assertEdgeAllowed("MITIGATES", "Control", "Risk")).not.toThrow();
  });

  it("rejects an invalid edge triple with GraphCatalogError", () => {
    expect(() => assertEdgeAllowed("MITIGATES", "Risk", "Control")).toThrow(
      GraphCatalogError,
    );
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `docker exec betterthanspreadsheetsgrc-test-1 npx jest src/__tests__/integration/graph-service.test.ts -t "Graph types"`
Expected: FAIL — cannot find module `@/server/graph/graph-types`.

- [ ] **Step 3: Implement `src/server/graph/graph-types.ts`**

```ts
import type { GraphNodeType, GraphEdgeType } from "@prisma/client";

/** Entity Prisma model name -> graph node type. Only these models get nodes. */
export const NODE_SYNC_MODELS: Record<string, GraphNodeType> = {
  OrganizationalControl: "Control",
  Risk: "Risk",
  MitreTechnique: "Technique",
};

/** Legal (from)-[EDGE]->(to) triples. Extend this map per sub-project. */
export const EDGE_CATALOG: Record<
  GraphEdgeType,
  { from: GraphNodeType; to: GraphNodeType }
> = {
  MITIGATES: { from: "Control", to: "Risk" },
  COUNTERS: { from: "Control", to: "Technique" },
};

export class GraphCatalogError extends Error {
  constructor(type: GraphEdgeType, fromType: GraphNodeType, toType: GraphNodeType) {
    super(
      `Edge ${type} is not allowed from ${fromType} to ${toType}. ` +
        `Expected ${EDGE_CATALOG[type].from} -> ${EDGE_CATALOG[type].to}.`,
    );
    this.name = "GraphCatalogError";
  }
}

export class GraphNodeMissingError extends Error {
  constructor(type: GraphNodeType, entityId: string) {
    super(`No ${type} entity found for id ${entityId}; cannot create node.`);
    this.name = "GraphNodeMissingError";
  }
}

/** Throws GraphCatalogError if the triple is not in the catalog. */
export function assertEdgeAllowed(
  type: GraphEdgeType,
  fromType: GraphNodeType,
  toType: GraphNodeType,
): void {
  const allowed = EDGE_CATALOG[type];
  if (!allowed || allowed.from !== fromType || allowed.to !== toType) {
    throw new GraphCatalogError(type, fromType, toType);
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `docker exec betterthanspreadsheetsgrc-test-1 npx jest src/__tests__/integration/graph-service.test.ts -t "Graph types"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/graph/graph-types.ts src/__tests__/integration/graph-service.test.ts
git commit -m "feat(graph): add edge catalog, type maps, and error classes"
```

---

## Task 3: Graph service — nodes & edges core

**Files:**
- Create: `src/server/graph/graph-service.ts`
- Test: `src/__tests__/integration/graph-service.test.ts` (add `describe` blocks)

> **SECURITY REVISION — read before implementing.** Per the revised §3 tenancy rules: **Node
> reads/writes use `rawPrisma`** (the unfiltered escape hatch — Node can be global/null-org and
> is keyed by a compound unique the filter can't express). **Edge ops use the passed `client`
> (default the filtered `db`)** and ALWAYS include `organizationId` explicitly in the
> `where`/`create`. `createEdge` uses `findFirst` + `create`/`update`, NOT a compound-unique
> `upsert` (the org filter mangles compound-unique selectors).

**Interfaces:**
- Consumes: `db`, `rawPrisma` from `@/server/db`; `NODE_SYNC_MODELS`, `EDGE_CATALOG`, `assertEdgeAllowed`, `GraphCatalogError` from `./graph-types`.
- Produces an exported `graphService` object. `GraphClient` is `typeof db` (or a Prisma transaction client) — used for EDGE ops only; NODE ops always use `rawPrisma`. Entity refs use `{ type: GraphNodeType; id: string }`.
  - `ensureNode(ref: { type: GraphNodeType; id: string }, organizationId: string | null): Promise<{ id: string }>` — uses `rawPrisma` (no client param)
  - `removeNode(ref): Promise<void>` — uses `rawPrisma`
  - `createEdge(p: { type: GraphEdgeType; from: { type: GraphNodeType; id: string }; to: { type: GraphNodeType; id: string }; organizationId: string; fromOrgId?: string | null; toOrgId?: string | null; properties?: Record<string, unknown>; createdById?: string | null }, client?): Promise<{ id: string }>`
  - `deleteEdge(p: { type: GraphEdgeType; from; to; organizationId: string }, client?): Promise<boolean>`
  - `listOutEdges(p: { type: GraphEdgeType; from: { type; id }; organizationId: string }, client?): Promise<EdgeRow[]>`
  - `listInEdges(p: { type: GraphEdgeType; to: { type; id }; organizationId: string }, client?): Promise<EdgeRow[]>`
  - where `EdgeRow = { id: string; fromNodeId: string; toNodeId: string; properties: unknown; createdById: string | null; fromEntityId: string; toEntityId: string }`

> **Why `ensureNode` takes `organizationId` from the caller:** at edge-create time the caller knows the org of each endpoint (control/risk are current-org; technique is global/null). `ensureNode` upserts so missing nodes are created on demand — this is the safety net that makes the system correct even if the sync extension (Task 4) misses a bulk write.

- [ ] **Step 1: Write the failing tests**

Add to `src/__tests__/integration/graph-service.test.ts`:

```ts
import { graphService } from "@/server/graph/graph-service";
import { runWithOrganizationContext } from "@/server/db/middleware/organization-filter";

describe("graphService.createEdge", () => {
  const orgId = randomUUID();
  const controlId = randomUUID();
  const riskId = randomUUID();

  afterAll(async () => {
    await db.$executeRaw`DELETE FROM "Edge" WHERE "organizationId" = ${orgId}`;
    await db.$executeRaw`DELETE FROM "Node" WHERE "organizationId" = ${orgId}`;
  });

  it("creates a valid MITIGATES edge and is idempotent", async () => {
    // Edge writes go through the filtered `db`, which requires org context
    // (mirrors how tRPC wraps every request in runWithOrganizationContext).
    const { first, second, edges } = await runWithOrganizationContext(orgId, async () => {
      const first = await graphService.createEdge({
        type: "MITIGATES",
        from: { type: "Control", id: controlId },
        to: { type: "Risk", id: riskId },
        organizationId: orgId,
        properties: { role: "IN_PLACE", notes: "n" },
      });
      const second = await graphService.createEdge({
        type: "MITIGATES",
        from: { type: "Control", id: controlId },
        to: { type: "Risk", id: riskId },
        organizationId: orgId,
        properties: { role: "NEEDED", notes: "n2" },
      });
      const edges = await graphService.listInEdges({
        type: "MITIGATES",
        to: { type: "Risk", id: riskId },
        organizationId: orgId,
      });
      return { first, second, edges };
    });
    expect(second.id).toBe(first.id); // same row updated, not duplicated
    expect(edges).toHaveLength(1);
    expect(edges[0]!.fromEntityId).toBe(controlId);
    expect((edges[0]!.properties as { role: string }).role).toBe("NEEDED"); // updated
  });

  it("rejects a catalog-violating edge", async () => {
    // Catalog check throws before any DB write, so no org context is needed.
    await expect(
      graphService.createEdge({
        type: "MITIGATES",
        from: { type: "Risk", id: riskId },
        to: { type: "Control", id: controlId },
        organizationId: orgId,
      }),
    ).rejects.toThrow(/not allowed/);
  });

  it("isolates edges by organization", async () => {
    const otherOrg = randomUUID();
    const edges = await graphService.listInEdges({
      type: "MITIGATES",
      to: { type: "Risk", id: riskId },
      organizationId: otherOrg,
    });
    expect(edges).toHaveLength(0);
    await db.$executeRaw`DELETE FROM "Node" WHERE "organizationId" = ${otherOrg}`;
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `docker exec betterthanspreadsheetsgrc-test-1 npx jest src/__tests__/integration/graph-service.test.ts -t "createEdge"`
Expected: FAIL — cannot find module `@/server/graph/graph-service`.

- [ ] **Step 3: Implement `src/server/graph/graph-service.ts`**

```ts
import { db, rawPrisma } from "@/server/db";
import type { GraphNodeType, GraphEdgeType, Prisma } from "@prisma/client";
import { assertEdgeAllowed } from "./graph-types";

/** A Prisma client or interactive-transaction client. Used for EDGE ops only. */
type GraphClient = typeof db | Prisma.TransactionClient;

export interface EdgeRow {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  properties: unknown;
  createdById: string | null;
  fromEntityId: string;
  toEntityId: string;
}

interface EntityRef {
  type: GraphNodeType;
  id: string;
}

/**
 * Upsert the Node for an entity; returns its node id.
 * NODE ops use `rawPrisma` (the unfiltered escape hatch): nodes can be global
 * (null org) and are keyed by the compound (type, entityId) — both of which the
 * org-filter on `db` cannot express. Safe because (type, entityId) is globally
 * unique, so there is no cross-tenant ambiguity.
 */
async function ensureNode(
  ref: EntityRef,
  organizationId: string | null,
): Promise<{ id: string }> {
  const existing = await rawPrisma.node.findUnique({
    where: { type_entityId: { type: ref.type, entityId: ref.id } },
    select: { id: true },
  });
  if (existing) return existing;
  return rawPrisma.node.create({
    data: { type: ref.type, entityId: ref.id, organizationId },
    select: { id: true },
  });
}

async function removeNode(ref: EntityRef): Promise<void> {
  await rawPrisma.node.deleteMany({ where: { type: ref.type, entityId: ref.id } });
}

/** Resolve an entity ref to its node id (rawPrisma — globally-unique key). */
async function findNodeId(ref: EntityRef): Promise<string | null> {
  const node = await rawPrisma.node.findUnique({
    where: { type_entityId: { type: ref.type, entityId: ref.id } },
    select: { id: true },
  });
  return node?.id ?? null;
}

async function createEdge(
  p: {
    type: GraphEdgeType;
    from: EntityRef;
    to: EntityRef;
    organizationId: string;
    fromOrgId?: string | null;
    toOrgId?: string | null;
    properties?: Record<string, unknown>;
    createdById?: string | null;
  },
  client: GraphClient = db,
): Promise<{ id: string }> {
  assertEdgeAllowed(p.type, p.from.type, p.to.type);
  // Endpoint nodes default to the asserting org unless caller overrides
  // (Technique nodes are global -> pass toOrgId: null). Node ops use rawPrisma.
  const fromNode = await ensureNode(
    p.from,
    p.fromOrgId === undefined ? p.organizationId : p.fromOrgId,
  );
  const toNode = await ensureNode(
    p.to,
    p.toOrgId === undefined ? p.organizationId : p.toOrgId,
  );
  const props = (p.properties ?? undefined) as Prisma.InputJsonValue | undefined;
  // Edge ops go through the passed client (default filtered `db`) and ALWAYS
  // scope by organizationId explicitly — so this is correct under the org
  // filter, inside a tx, AND when handed rawPrisma in the backfill.
  // findFirst + create/update (NOT a compound-unique upsert, which the filter
  // mangles).
  const existing = await client.edge.findFirst({
    where: {
      type: p.type,
      fromNodeId: fromNode.id,
      toNodeId: toNode.id,
      organizationId: p.organizationId,
    },
    select: { id: true },
  });
  if (existing) {
    await client.edge.update({
      where: { id: existing.id },
      data: { properties: props },
    });
    return existing;
  }
  return client.edge.create({
    data: {
      type: p.type,
      fromNodeId: fromNode.id,
      toNodeId: toNode.id,
      organizationId: p.organizationId,
      properties: props,
      createdById: p.createdById ?? null,
    },
    select: { id: true },
  });
}

async function deleteEdge(
  p: { type: GraphEdgeType; from: EntityRef; to: EntityRef; organizationId: string },
  client: GraphClient = db,
): Promise<boolean> {
  const fromNodeId = await findNodeId(p.from);
  const toNodeId = await findNodeId(p.to);
  if (!fromNodeId || !toNodeId) return false;
  const res = await client.edge.deleteMany({
    where: {
      type: p.type,
      fromNodeId,
      toNodeId,
      organizationId: p.organizationId,
    },
  });
  return res.count > 0;
}

function mapEdgeRows(
  rows: Array<{
    id: string;
    fromNodeId: string;
    toNodeId: string;
    properties: unknown;
    createdById: string | null;
    fromNode: { entityId: string };
    toNode: { entityId: string };
  }>,
): EdgeRow[] {
  return rows.map((r) => ({
    id: r.id,
    fromNodeId: r.fromNodeId,
    toNodeId: r.toNodeId,
    properties: r.properties,
    createdById: r.createdById,
    fromEntityId: r.fromNode.entityId,
    toEntityId: r.toNode.entityId,
  }));
}

async function listOutEdges(
  p: { type: GraphEdgeType; from: EntityRef; organizationId: string },
  client: GraphClient = db,
): Promise<EdgeRow[]> {
  const fromNodeId = await findNodeId(p.from);
  if (!fromNodeId) return [];
  const rows = await client.edge.findMany({
    where: { type: p.type, fromNodeId, organizationId: p.organizationId },
    include: { fromNode: { select: { entityId: true } }, toNode: { select: { entityId: true } } },
  });
  return mapEdgeRows(rows);
}

async function listInEdges(
  p: { type: GraphEdgeType; to: EntityRef; organizationId: string },
  client: GraphClient = db,
): Promise<EdgeRow[]> {
  const toNodeId = await findNodeId(p.to);
  if (!toNodeId) return [];
  const rows = await client.edge.findMany({
    where: { type: p.type, toNodeId, organizationId: p.organizationId },
    include: { fromNode: { select: { entityId: true } }, toNode: { select: { entityId: true } } },
  });
  return mapEdgeRows(rows);
}

export const graphService = {
  ensureNode,
  removeNode,
  createEdge,
  deleteEdge,
  listOutEdges,
  listInEdges,
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `docker exec betterthanspreadsheetsgrc-test-1 npx jest src/__tests__/integration/graph-service.test.ts`
Expected: PASS (all `describe` blocks).

- [ ] **Step 5: Commit**

```bash
git add src/server/graph/graph-service.ts src/__tests__/integration/graph-service.test.ts
git commit -m "feat(graph): add graphService node/edge core with catalog + tenancy"
```

---

## Task 4: Node-sync extension

**Files:**
- Create: `src/server/db/middleware/graph-sync.ts`
- Modify: `src/server/db.ts:76`
- Test: `src/__tests__/integration/graph-sync.test.ts`

**Interfaces:**
- Consumes: `NODE_SYNC_MODELS` from `@/server/graph/graph-types`.
- Produces: `graphSyncMiddleware<T extends PrismaClient>(prisma: T): T` — a `$extends` wrapper. On `create` of a sync model, upserts the matching `Node` (using the created row's `id` + `organizationId`). On `delete`, removes the node (cascading its edges). `createMany`/`deleteMany`/`updateMany` pass through (reconciled by the backfill + `createEdge`'s `ensureNode` safety net).

> **Composition order matters:** `graphSyncMiddleware` wraps the org-filtered client, so it runs as the OUTER extension. For `create`, read ids/org from the awaited `result` (the DB-returned row), not from `args` (org-filter injects `organizationId` deeper/after this layer).

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/integration/graph-sync.test.ts`:

```ts
import { db, rawPrisma } from "@/server/db";
import { appRouter } from "@/server/api/root";
import { randomUUID } from "crypto";
import type { UserRole } from "@prisma/client";

let testOrg: { id: string };
let user: { id: string; email: string; role: UserRole; organizationId: string; name: string };

beforeAll(async () => {
  testOrg = await db.organization.create({
    data: { id: randomUUID(), name: "Graph Sync Org", slug: `graph-sync-${randomUUID()}`, updatedAt: new Date() },
  });
  const u = await db.user.create({
    data: { id: randomUUID(), name: "GS User", email: `gs-${randomUUID()}@t.com`, role: "GRC_ANALYST", organizationId: testOrg.id, updatedAt: new Date() },
  });
  user = { id: u.id, email: u.email!, role: u.role, organizationId: u.organizationId, name: u.name! };
});

afterAll(async () => {
  await db.$executeRaw`DELETE FROM "Node" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "OrganizationalControl" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${testOrg.id}`;
});

function caller() {
  return appRouter.createCaller({
    db,
    session: { user: { id: user.id, email: user.email, role: user.role, organizationId: user.organizationId, name: user.name, image: null, assignedFrameworks: [] }, expires: new Date(Date.now() + 86400000).toISOString() },
    organizationId: user.organizationId,
    headers: new Headers(),
  });
}

describe("Node-sync extension", () => {
  it("creates a Node when an OrganizationalControl is created and removes it on delete", async () => {
    const control = await caller().organizationalControl.create({
      name: `OC Sync ${randomUUID()}`,
    });

    const node = await rawPrisma.node.findUnique({
      where: { type_entityId: { type: "Control", entityId: control.id } },
    });
    expect(node).not.toBeNull();
    expect(node!.organizationId).toBe(testOrg.id);

    await caller().organizationalControl.delete({ id: control.id });

    const after = await rawPrisma.node.findUnique({
      where: { type_entityId: { type: "Control", entityId: control.id } },
    });
    expect(after).toBeNull();
  });
});
```

> If `organizationalControl.create` requires more than `name`, pass the minimal required fields you observe from `src/server/api/routers/organizationalControl.ts` create input (e.g. `name`). If `organizationalControl.delete` has a different name, use the actual delete mutation. Keep the assertions identical.

- [ ] **Step 2: Run to verify it fails**

Run: `docker exec betterthanspreadsheetsgrc-test-1 npx jest src/__tests__/integration/graph-sync.test.ts`
Expected: FAIL — node is `null` (no sync yet).

- [ ] **Step 3: Implement `src/server/db/middleware/graph-sync.ts`**

```ts
import type { PrismaClient } from "@prisma/client";
import { rawPrisma } from "@/server/db";
import { NODE_SYNC_MODELS } from "@/server/graph/graph-types";

/**
 * Keeps the generic `Node` table in sync with entity lifecycle for the models
 * in NODE_SYNC_MODELS. Single-row create/delete are handled here; bulk writes
 * pass through and are reconciled by the backfill script and by graphService
 * ensureNode (which upserts endpoint nodes when edges are created).
 *
 * Node writes go through `rawPrisma` (the unfiltered escape hatch — see §3):
 * the filtered client cannot create a null-org node or upsert on the compound
 * (type, entityId) key. (type, entityId) is globally unique, so this is safe.
 *
 * Must be composed AFTER organizationFilterMiddleware (outer extension).
 */
export function graphSyncMiddleware<T extends PrismaClient>(prisma: T): T {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const nodeType = NODE_SYNC_MODELS[model];
          if (!nodeType) return query(args);

          const result = await query(args);

          if (operation === "create" && result && typeof result === "object") {
            const row = result as { id: string; organizationId?: string | null };
            const existing = await rawPrisma.node.findUnique({
              where: { type_entityId: { type: nodeType, entityId: row.id } },
              select: { id: true },
            });
            if (!existing) {
              await rawPrisma.node.create({
                data: { type: nodeType, entityId: row.id, organizationId: row.organizationId ?? null },
              });
            }
          } else if (operation === "delete" && result && typeof result === "object") {
            const row = result as { id: string };
            await rawPrisma.node.deleteMany({
              where: { type: nodeType, entityId: row.id },
            });
          }

          return result;
        },
      },
    },
  }) as unknown as T;
}
```

- [ ] **Step 4: Wire it into `src/server/db.ts`**

Replace the client composition (currently line 76, `const client = organizationFilterMiddleware(baseClient);`) with:

```ts
  // Extend client with organization filtering, then graph node-sync.
  // Order matters: graph-sync is the OUTER extension and reads ids/org from
  // the DB-returned row.
  const client = graphSyncMiddleware(organizationFilterMiddleware(baseClient));
```

And add the import near the top (after the `organization-filter` import at line 5):

```ts
import { graphSyncMiddleware } from "@/server/db/middleware/graph-sync";
```

- [ ] **Step 5: Run to verify it passes**

Run: `docker exec betterthanspreadsheetsgrc-test-1 npx jest src/__tests__/integration/graph-sync.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/db/middleware/graph-sync.ts src/server/db.ts src/__tests__/integration/graph-sync.test.ts
git commit -m "feat(graph): sync Node rows with entity create/delete lifecycle"
```

---

## Task 5: Backfill script (nodes + MITIGATES migration)

**Files:**
- Create: `prisma/scripts/backfill-graph.ts`
- Test: `src/__tests__/integration/graph-backfill.test.ts`

**Interfaces:**
- Consumes: `db`/`rawPrisma` from `@/server/db`; `graphService` from `@/server/graph/graph-service`.
- Produces: exported `async function backfillGraph(): Promise<{ nodes: number; mitigatesEdges: number }>` — idempotent. Creates `Node` rows for every existing `OrganizationalControl` (Control), `Risk` (Risk), `MitreTechnique` (Technique, org null), then converts every `RiskOrganizationalControl` row into a `MITIGATES` edge `{ role, notes }`. Also runnable via `tsx prisma/scripts/backfill-graph.ts`.

> **Use `rawPrisma`** (the unfiltered client exported from `@/server/db`) so the backfill sees all orgs. Build nodes with `createMany({ skipDuplicates: true })` and edges via `graphService.createEdge` (idempotent upsert), passing `rawPrisma` as the `client`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/integration/graph-backfill.test.ts`:

```ts
import { db } from "@/server/db";
import { backfillGraph } from "../../../prisma/scripts/backfill-graph";
import { randomUUID } from "crypto";

let orgId: string;
let controlId: string;
let riskId: string;

beforeAll(async () => {
  orgId = randomUUID();
  controlId = randomUUID();
  riskId = randomUUID();
  const now = new Date();
  // Seed legacy rows via raw SQL (bypass extensions to simulate pre-graph data)
  await db.$executeRaw`INSERT INTO "Organization" (id, name, slug, "updatedAt") VALUES (${orgId}, 'BF Org', ${"bf-" + orgId}, ${now})`;
  await db.$executeRaw`INSERT INTO "OrganizationalControl" (id, "organizationId", "localControlId", name, "createdAt", "updatedAt") VALUES (${controlId}, ${orgId}, 'OC-9001', 'BF Control', ${now}, ${now})`;
  await db.$executeRaw`INSERT INTO "Risk" (id, "organizationId", title, description, severity, status, "createdAt", "updatedAt") VALUES (${riskId}, ${orgId}, 'BF Risk', 'd', 'HIGH', 'OPEN', ${now}, ${now})`;
  await db.$executeRaw`INSERT INTO "RiskOrganizationalControl" (id, "organizationId", "riskId", "organizationalControlId", role, notes, "createdAt", "updatedAt") VALUES (${randomUUID()}, ${orgId}, ${riskId}, ${controlId}, 'IN_PLACE', 'legacy', ${now}, ${now})`;
});

afterAll(async () => {
  await db.$executeRaw`DELETE FROM "Edge" WHERE "organizationId" = ${orgId}`;
  await db.$executeRaw`DELETE FROM "Node" WHERE "organizationId" = ${orgId}`;
  await db.$executeRaw`DELETE FROM "RiskOrganizationalControl" WHERE "organizationId" = ${orgId}`;
  await db.$executeRaw`DELETE FROM "Risk" WHERE "organizationId" = ${orgId}`;
  await db.$executeRaw`DELETE FROM "OrganizationalControl" WHERE "organizationId" = ${orgId}`;
  await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${orgId}`;
});

describe("backfillGraph", () => {
  it("creates nodes + MITIGATES edges and is idempotent", async () => {
    await backfillGraph();

    const controlNode = await db.node.findUnique({ where: { type_entityId: { type: "Control", entityId: controlId } } });
    const riskNode = await db.node.findUnique({ where: { type_entityId: { type: "Risk", entityId: riskId } } });
    expect(controlNode).not.toBeNull();
    expect(riskNode).not.toBeNull();

    const edgesAfterFirst = await db.edge.count({ where: { organizationId: orgId, type: "MITIGATES" } });
    expect(edgesAfterFirst).toBe(1);

    // Run again — no duplicates
    await backfillGraph();
    const edgesAfterSecond = await db.edge.count({ where: { organizationId: orgId, type: "MITIGATES" } });
    expect(edgesAfterSecond).toBe(1);

    const edge = await db.edge.findFirst({ where: { organizationId: orgId, type: "MITIGATES" } });
    expect((edge!.properties as { role: string }).role).toBe("IN_PLACE");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `docker exec betterthanspreadsheetsgrc-test-1 npx jest src/__tests__/integration/graph-backfill.test.ts`
Expected: FAIL — cannot find module `backfill-graph`.

- [ ] **Step 3: Implement `prisma/scripts/backfill-graph.ts`**

```ts
import { rawPrisma } from "@/server/db";
import { graphService } from "@/server/graph/graph-service";

export async function backfillGraph(): Promise<{ nodes: number; mitigatesEdges: number }> {
  let nodes = 0;
  let mitigatesEdges = 0;

  // 1. Control nodes
  const controls = await rawPrisma.organizationalControl.findMany({ select: { id: true, organizationId: true } });
  if (controls.length) {
    const r = await rawPrisma.node.createMany({
      data: controls.map((c) => ({ type: "Control" as const, entityId: c.id, organizationId: c.organizationId })),
      skipDuplicates: true,
    });
    nodes += r.count;
  }

  // 2. Risk nodes
  const risks = await rawPrisma.risk.findMany({ select: { id: true, organizationId: true } });
  if (risks.length) {
    const r = await rawPrisma.node.createMany({
      data: risks.map((rk) => ({ type: "Risk" as const, entityId: rk.id, organizationId: rk.organizationId })),
      skipDuplicates: true,
    });
    nodes += r.count;
  }

  // 3. Technique nodes (global — org null)
  const techniques = await rawPrisma.mitreTechnique.findMany({ select: { id: true } });
  if (techniques.length) {
    const r = await rawPrisma.node.createMany({
      data: techniques.map((t) => ({ type: "Technique" as const, entityId: t.id, organizationId: null })),
      skipDuplicates: true,
    });
    nodes += r.count;
  }

  // 4. Migrate RiskOrganizationalControl -> MITIGATES edges (Control -> Risk)
  const links = await rawPrisma.riskOrganizationalControl.findMany({
    select: { organizationId: true, riskId: true, organizationalControlId: true, role: true, notes: true, createdById: true },
  });
  for (const link of links) {
    await graphService.createEdge(
      {
        type: "MITIGATES",
        from: { type: "Control", id: link.organizationalControlId },
        to: { type: "Risk", id: link.riskId },
        organizationId: link.organizationId,
        properties: { role: link.role, notes: link.notes ?? null },
        createdById: link.createdById,
      },
      rawPrisma,
    );
    mitigatesEdges += 1;
  }

  return { nodes, mitigatesEdges };
}

// Allow running directly: `tsx prisma/scripts/backfill-graph.ts`
if (require.main === module) {
  backfillGraph()
    .then((res) => {
      console.log(`Backfill complete: ${res.nodes} nodes, ${res.mitigatesEdges} MITIGATES edges`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `docker exec betterthanspreadsheetsgrc-test-1 npx jest src/__tests__/integration/graph-backfill.test.ts`
Expected: PASS (idempotent — second run keeps count at 1).

- [ ] **Step 5: Commit**

```bash
git add prisma/scripts/backfill-graph.ts src/__tests__/integration/graph-backfill.test.ts
git commit -m "feat(graph): re-runnable backfill for nodes + MITIGATES migration"
```

---

## Task 6: Repoint `organizationalControl.ts` to edges

**Files:**
- Modify: `src/server/api/routers/organizationalControl.ts` (endpoints `getLinkedRisks`, `getForRisk`, `linkToRisk`, `unlinkFromRisk`, `bulkLinkToRisk`)
- Test: `src/__tests__/integration/graph-mitigates-migration.test.ts`

**Interfaces:**
- Consumes: `graphService` from `@/server/graph/graph-service`.
- Produces: identical tRPC outputs. `getForRisk` still returns `{ inPlace: Array<link & { OrganizationalControl }>, needed: Array<...> }`; `linkToRisk` returns the linked record shape `{ ...link, OrganizationalControl }`; `unlinkFromRisk` returns `{ success: true }`.

> **Reconstruction rule:** a `MITIGATES` edge's `from` node entityId is the `OrganizationalControl.id`; its `to` node entityId is the `Risk.id`; `edge.properties = { role, notes }`. To rebuild the legacy shape, list edges then fetch the joined `OrganizationalControl` rows via `db`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/integration/graph-mitigates-migration.test.ts`:

```ts
import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";
import { randomUUID } from "crypto";
import { type UserRole, RiskOrgControlRole } from "@prisma/client";

let testOrg: { id: string };
let user: { id: string; email: string; role: UserRole; organizationId: string; name: string };
let controlId: string;
let riskId: string;

beforeAll(async () => {
  testOrg = await db.organization.create({ data: { id: randomUUID(), name: "Mit Org", slug: `mit-${randomUUID()}`, updatedAt: new Date() } });
  const u = await db.user.create({ data: { id: randomUUID(), name: "Mit User", email: `mit-${randomUUID()}@t.com`, role: "GRC_ANALYST", organizationId: testOrg.id, updatedAt: new Date() } });
  user = { id: u.id, email: u.email!, role: u.role, organizationId: u.organizationId, name: u.name! };
  const now = new Date();
  controlId = randomUUID();
  riskId = randomUUID();
  await db.$executeRaw`INSERT INTO "OrganizationalControl" (id, "organizationId", "localControlId", name, "createdAt", "updatedAt") VALUES (${controlId}, ${testOrg.id}, 'OC-8001', 'Mit Control', ${now}, ${now})`;
  await db.$executeRaw`INSERT INTO "Risk" (id, "organizationId", title, description, severity, status, "createdAt", "updatedAt") VALUES (${riskId}, ${testOrg.id}, 'Mit Risk', 'd', 'HIGH', 'OPEN', ${now}, ${now})`;
});

afterAll(async () => {
  await db.$executeRaw`DELETE FROM "Edge" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "Node" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "Risk" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "OrganizationalControl" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${testOrg.id}`;
});

function caller() {
  return appRouter.createCaller({
    db,
    session: { user: { id: user.id, email: user.email, role: user.role, organizationId: user.organizationId, name: user.name, image: null, assignedFrameworks: [] }, expires: new Date(Date.now() + 86400000).toISOString() },
    organizationId: user.organizationId,
    headers: new Headers(),
  });
}

describe("MITIGATES migration — organizationalControl router contract", () => {
  it("linkToRisk creates an edge and getForRisk returns it under inPlace", async () => {
    await caller().organizationalControl.linkToRisk({ riskId, controlId, role: RiskOrgControlRole.IN_PLACE, notes: "n" });

    const edge = await db.edge.findFirst({ where: { organizationId: testOrg.id, type: "MITIGATES" } });
    expect(edge).not.toBeNull();

    const grouped = await caller().organizationalControl.getForRisk({ riskId });
    expect(grouped.inPlace).toHaveLength(1);
    expect(grouped.inPlace[0]!.OrganizationalControl.id).toBe(controlId);
    expect(grouped.needed).toHaveLength(0);
  });

  it("getLinkedRisks returns the risk for the control", async () => {
    const links = await caller().organizationalControl.getLinkedRisks({ controlId });
    expect(links.some((l: { riskId: string }) => l.riskId === riskId)).toBe(true);
  });

  it("unlinkFromRisk removes the edge", async () => {
    await caller().organizationalControl.unlinkFromRisk({ riskId, controlId });
    const count = await db.edge.count({ where: { organizationId: testOrg.id, type: "MITIGATES" } });
    expect(count).toBe(0);
  });

  it("bulkLinkToRisk links multiple controls", async () => {
    await caller().organizationalControl.bulkLinkToRisk({ riskId, controlIds: [controlId], role: RiskOrgControlRole.NEEDED });
    const grouped = await caller().organizationalControl.getForRisk({ riskId });
    expect(grouped.needed).toHaveLength(1);
  });
});
```

> Match the exact field names returned today. Open `organizationalControl.ts` and confirm `getForRisk` returns `{ inPlace, needed }` and each item includes `OrganizationalControl` and `role`. The test above asserts that shape — keep it.

- [ ] **Step 2: Run to verify it fails**

Run: `docker exec betterthanspreadsheetsgrc-test-1 npx jest src/__tests__/integration/graph-mitigates-migration.test.ts`
Expected: FAIL — `getForRisk` still reads the (soon-removed) crosswalk and `db.edge` is empty.

- [ ] **Step 3: Repoint the five endpoints**

In `src/server/api/routers/organizationalControl.ts`, add near the top imports:

```ts
import { graphService } from "@/server/graph/graph-service";
```

Replace each endpoint body so it reads/writes through `graphService`. The role/notes live in `edge.properties`. Concretely:

`getForRisk`:

```ts
  getForRisk: organizationProcedure
    .input(z.object({ riskId: z.string() }))
    .query(async ({ ctx, input }) => {
      const edges = await graphService.listInEdges({
        type: "MITIGATES",
        to: { type: "Risk", id: input.riskId },
        organizationId: ctx.organizationId!,
      });
      const controlIds = edges.map((e) => e.fromEntityId);
      const controls = await ctx.db.organizationalControl.findMany({
        where: { id: { in: controlIds } },
        orderBy: { name: "asc" },
      });
      const controlById = new Map(controls.map((c) => [c.id, c]));
      const links = edges
        .map((e) => {
          const props = (e.properties ?? {}) as { role?: RiskOrgControlRole; notes?: string | null };
          const OrganizationalControl = controlById.get(e.fromEntityId);
          if (!OrganizationalControl) return null;
          return {
            id: e.id,
            riskId: input.riskId,
            organizationalControlId: e.fromEntityId,
            role: props.role ?? RiskOrgControlRole.IN_PLACE,
            notes: props.notes ?? null,
            OrganizationalControl,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      const inPlace = links.filter((l) => l.role === RiskOrgControlRole.IN_PLACE);
      const needed = links.filter((l) => l.role === RiskOrgControlRole.NEEDED);
      return { inPlace, needed };
    }),
```

`getLinkedRisks` (mirror, listing OUT edges from the control and joining `Risk`):

```ts
  getLinkedRisks: organizationProcedure
    .input(z.object({ controlId: z.string() }))
    .query(async ({ ctx, input }) => {
      const edges = await graphService.listOutEdges({
        type: "MITIGATES",
        from: { type: "Control", id: input.controlId },
        organizationId: ctx.organizationId!,
      });
      const riskIds = edges.map((e) => e.toEntityId);
      const risks = await ctx.db.risk.findMany({ where: { id: { in: riskIds } } });
      const riskById = new Map(risks.map((r) => [r.id, r]));
      return edges
        .map((e) => {
          const props = (e.properties ?? {}) as { role?: RiskOrgControlRole; notes?: string | null };
          const Risk = riskById.get(e.toEntityId);
          if (!Risk) return null;
          return { id: e.id, riskId: e.toEntityId, organizationalControlId: input.controlId, role: props.role ?? RiskOrgControlRole.IN_PLACE, notes: props.notes ?? null, Risk };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
    }),
```

> Confirm the legacy `getLinkedRisks` shape in the current file and match it exactly (it previously `include`d `OrganizationalControl`/`Risk`; preserve whatever fields the UI consumes).

`linkToRisk`:

```ts
  linkToRisk: organizationProcedure
    .input(z.object({ riskId: z.string(), controlId: z.string(), role: z.nativeEnum(RiskOrgControlRole), notes: z.string().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      assertMutationAllowed(ctx.session?.user.role, "link");
      const control = await ctx.db.organizationalControl.findUnique({ where: { id: input.controlId } });
      if (!control) throw new TRPCError({ code: "NOT_FOUND", message: "Control not found" });
      const risk = await ctx.db.risk.findUnique({ where: { id: input.riskId } });
      if (!risk) throw new TRPCError({ code: "NOT_FOUND", message: "Risk not found" });

      await graphService.createEdge({
        type: "MITIGATES",
        from: { type: "Control", id: input.controlId },
        to: { type: "Risk", id: input.riskId },
        organizationId: ctx.organizationId!,
        properties: { role: input.role, notes: input.notes ?? null },
        createdById: ctx.session?.user.id ?? null,
      });
      return { id: control.id, riskId: input.riskId, organizationalControlId: input.controlId, role: input.role, notes: input.notes ?? null, OrganizationalControl: control };
    }),
```

> Verify the exact return shape the UI expects from `linkToRisk` in the current code and match it. Both endpoints previously `include: { OrganizationalControl: true }`.

`unlinkFromRisk`:

```ts
  unlinkFromRisk: organizationProcedure
    .input(z.object({ riskId: z.string(), controlId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      assertMutationAllowed(ctx.session?.user.role, "unlink");
      const removed = await graphService.deleteEdge({
        type: "MITIGATES",
        from: { type: "Control", id: input.controlId },
        to: { type: "Risk", id: input.riskId },
        organizationId: ctx.organizationId!,
      });
      if (!removed) throw new TRPCError({ code: "NOT_FOUND", message: "Link not found" });
      return { success: true };
    }),
```

`bulkLinkToRisk`:

```ts
  bulkLinkToRisk: organizationProcedure
    .input(z.object({ riskId: z.string(), controlIds: z.array(z.string()), role: z.nativeEnum(RiskOrgControlRole) }))
    .mutation(async ({ ctx, input }) => {
      assertMutationAllowed(ctx.session?.user.role, "link");
      const risk = await ctx.db.risk.findUnique({ where: { id: input.riskId } });
      if (!risk) throw new TRPCError({ code: "NOT_FOUND", message: "Risk not found" });
      for (const controlId of input.controlIds) {
        await graphService.createEdge({
          type: "MITIGATES",
          from: { type: "Control", id: controlId },
          to: { type: "Risk", id: input.riskId },
          organizationId: ctx.organizationId!,
          properties: { role: input.role, notes: null },
          createdById: ctx.session?.user.id ?? null,
        });
      }
      return { success: true, count: input.controlIds.length };
    }),
```

> Confirm `bulkLinkToRisk`'s legacy return value and match it (it previously returned the created/updated counts implicitly). Keep whatever the UI reads.

- [ ] **Step 4: Run to verify it passes**

Run: `docker exec betterthanspreadsheetsgrc-test-1 npx jest src/__tests__/integration/graph-mitigates-migration.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/api/routers/organizationalControl.ts src/__tests__/integration/graph-mitigates-migration.test.ts
git commit -m "refactor(graph): repoint organizationalControl risk-links to MITIGATES edges"
```

---

## Task 7: Repoint remaining MITIGATES writers (`risk.ts`, `controlLink.ts`, `riskAssessmentProject.ts`)

**Files:**
- Modify: `src/server/api/routers/risk.ts` (the `create` control-link block ~line 442 and the assessment-project `$transaction` block ~line 6096)
- Modify: `src/server/api/routers/controlLink.ts` (the `riskOrganizationalControl` sync block ~line 296)
- Modify: `src/server/api/routers/riskAssessmentProject.ts` (its `riskOrganizationalControl` usage)
- Test: extend `src/__tests__/integration/graph-mitigates-migration.test.ts`

**Interfaces:**
- Consumes: `graphService`. Inside `$transaction(async (tx) => ...)`, pass `tx` as the trailing `client` arg to `graphService.createEdge(...)`.

- [ ] **Step 1: Add the failing test**

Append to `src/__tests__/integration/graph-mitigates-migration.test.ts` inside the `describe`:

```ts
  it("risk.create with controls-in-place creates MITIGATES edges with role IN_PLACE", async () => {
    // Use the same controlId; create a fresh risk through the router so the
    // control-link path runs. Adapt the input to risk.create's actual schema.
    const created = await caller().risk.create({
      title: `Risk With Controls ${randomUUID()}`,
      description: "desc",
      severity: "HIGH",
      controlsInPlace: [controlId], // adapt field name to risk.create input
    } as never);

    const edges = await db.edge.findMany({
      where: { organizationId: testOrg.id, type: "MITIGATES" },
      include: { toNode: { select: { entityId: true } } },
    });
    const forNewRisk = edges.filter((e) => e.toNode.entityId === created.id);
    expect(forNewRisk.length).toBeGreaterffThanOrEqual?.(1) ?? expect(forNewRisk.length).toBeGreaterThanOrEqual(1);
    expect((forNewRisk[0]!.properties as { role: string }).role).toBe("IN_PLACE");

    await db.$executeRaw`DELETE FROM "Edge" WHERE "toNodeId" IN (SELECT id FROM "Node" WHERE "entityId" = ${created.id})`;
    await db.$executeRaw`DELETE FROM "Node" WHERE "entityId" = ${created.id}`;
    await db.$executeRaw`DELETE FROM "Risk" WHERE id = ${created.id}`;
  });
```

> **Before writing this test for real:** open `risk.ts` `create` and read its actual Zod input — use the real field name for "controls in place" (the code builds `controlLinks` from inputs around line 415-438). Replace `controlsInPlace`/the placeholder assertion with the true field and a clean `expect(forNewRisk.length).toBeGreaterThanOrEqual(1)`. Do not ship the `toBeGreaterffThanOrEqual` typo above — it is a deliberate marker that this assertion must be rewritten against the real schema.

- [ ] **Step 2: Run to verify it fails**

Run: `docker exec betterthanspreadsheetsgrc-test-1 npx jest src/__tests__/integration/graph-mitigates-migration.test.ts -t "risk.create"`
Expected: FAIL (no edges created by `risk.create` yet; or a schema/typo error you then fix per the note).

- [ ] **Step 3: Repoint `risk.ts` `create` block**

Find the block (around lines 407-447) that builds `controlLinks` and calls `ctx.db.riskOrganizationalControl.createMany(...)`. Replace the `createMany` with edge creation:

```ts
      // Create MITIGATES edges for in-place / needed controls
      for (const link of controlLinks) {
        await graphService.createEdge({
          type: "MITIGATES",
          from: { type: "Control", id: link.organizationalControlId },
          to: { type: "Risk", id: link.riskId },
          organizationId: link.organizationId,
          properties: { role: link.role, notes: null },
          createdById: link.createdById,
        });
      }
```

Add the import at the top of `risk.ts`:

```ts
import { graphService } from "@/server/graph/graph-service";
```

- [ ] **Step 4: Repoint the `risk.ts` `$transaction` block (~line 6096)**

Inside the `await ctx.db.$transaction(async (tx) => { ... })`, replace `await tx.riskOrganizationalControl.createMany({...})` with:

```ts
          if (controlLinks.length > 0) {
            for (const link of controlLinks) {
              await graphService.createEdge(
                {
                  type: "MITIGATES",
                  from: { type: "Control", id: link.organizationalControlId },
                  to: { type: "Risk", id: risk.id },
                  organizationId,
                  properties: { role: link.role, notes: null },
                  createdById: ctx.session?.user.id ?? null,
                },
                tx, // run inside the same transaction
              );
            }
          }
```

- [ ] **Step 5: Repoint `controlLink.ts` (~line 296)**

Replace the block that finds existing `riskOrganizationalControl` and `createMany`s new ones (lines ~296-318) with edge upserts keyed off the `orgRole`:

```ts
        if (orgControls.length > 0) {
          const orgRole = linkType === "MITIGATING" ? "IN_PLACE" : "NEEDED";
          for (const c of orgControls) {
            await graphService.createEdge({
              type: "MITIGATES",
              from: { type: "Control", id: c.id },
              to: { type: "Risk", id: riskId },
              organizationId: ctx.organizationId!,
              properties: { role: orgRole, notes: null },
              createdById: ctx.session?.user.id ?? null,
            });
          }
        }
```

Add the import to `controlLink.ts`:

```ts
import { graphService } from "@/server/graph/graph-service";
```

- [ ] **Step 6: Repoint `riskAssessmentProject.ts`**

Open the file, locate the `riskOrganizationalControl` usage, and replace the create/createMany with the same `graphService.createEdge` pattern (using `tx` if inside a transaction, else default client). Add the `graphService` import. Keep inputs/outputs identical.

- [ ] **Step 7: Finalize the test (remove the placeholder typo) and run**

Fix Step 1's assertion to the real field name and a clean `toBeGreaterThanOrEqual`, then:

Run: `docker exec betterthanspreadsheetsgrc-test-1 npx jest src/__tests__/integration/graph-mitigates-migration.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/server/api/routers/risk.ts src/server/api/routers/controlLink.ts src/server/api/routers/riskAssessmentProject.ts src/__tests__/integration/graph-mitigates-migration.test.ts
git commit -m "refactor(graph): route all MITIGATES writers through graphService"
```

---

## Task 8: COUNTERS edges + `graph` router

**Files:**
- Modify: `src/server/graph/graph-service.ts` (add `getCounteredTechniques`)
- Create: `src/server/api/routers/graph.ts`
- Modify: `src/server/api/root.ts` (register `graph`)
- Test: `src/__tests__/integration/graph-counters.test.ts`

**Interfaces:**
- Produces on `graphService`: `getCounteredTechniques(controlId: string, organizationId: string, client?): Promise<Array<{ techniqueId: string }>>` (returns the technique entity ids via `listOutEdges`).
- Produces tRPC router `graph` with:
  - `counterTechnique({ controlId, techniqueId })` → creates a `COUNTERS` edge (Control current-org → Technique global).
  - `uncounterTechnique({ controlId, techniqueId })` → deletes it; returns `{ success: boolean }`.
  - `listCounteredTechniques({ controlId })` → `Array<{ id, externalId, name }>`.

> **Org→global tenancy:** the Technique node is global, so pass `toOrgId: null` when creating the COUNTERS edge. The edge row itself carries the current org id.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/integration/graph-counters.test.ts`:

```ts
import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";
import { randomUUID } from "crypto";
import type { UserRole } from "@prisma/client";

let testOrg: { id: string };
let user: { id: string; email: string; role: UserRole; organizationId: string; name: string };
let controlId: string;
let techniqueId: string;

beforeAll(async () => {
  testOrg = await db.organization.create({ data: { id: randomUUID(), name: "Ctr Org", slug: `ctr-${randomUUID()}`, updatedAt: new Date() } });
  const u = await db.user.create({ data: { id: randomUUID(), name: "Ctr User", email: `ctr-${randomUUID()}@t.com`, role: "GRC_ANALYST", organizationId: testOrg.id, updatedAt: new Date() } });
  user = { id: u.id, email: u.email!, role: u.role, organizationId: u.organizationId, name: u.name! };
  const now = new Date();
  controlId = randomUUID();
  techniqueId = randomUUID();
  await db.$executeRaw`INSERT INTO "OrganizationalControl" (id, "organizationId", "localControlId", name, "createdAt", "updatedAt") VALUES (${controlId}, ${testOrg.id}, 'OC-7001', 'Ctr Control', ${now}, ${now})`;
  await db.$executeRaw`INSERT INTO "MitreTechnique" (id, "externalId", name, description, url, "createdAt", "updatedAt") VALUES (${techniqueId}, ${"T" + Math.floor(1000 + (techniqueId.charCodeAt(0) % 9000))}, 'Test Technique', 'd', 'http://x', ${now}, ${now})`;
});

afterAll(async () => {
  await db.$executeRaw`DELETE FROM "Edge" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "Node" WHERE "entityId" = ${controlId} OR "entityId" = ${techniqueId}`;
  await db.$executeRaw`DELETE FROM "OrganizationalControl" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "MitreTechnique" WHERE id = ${techniqueId}`;
  await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${testOrg.id}`;
});

function caller() {
  return appRouter.createCaller({
    db,
    session: { user: { id: user.id, email: user.email, role: user.role, organizationId: user.organizationId, name: user.name, image: null, assignedFrameworks: [] }, expires: new Date(Date.now() + 86400000).toISOString() },
    organizationId: user.organizationId,
    headers: new Headers(),
  });
}

describe("COUNTERS edges (Control -> global Technique)", () => {
  it("counters, lists, and uncounters a technique", async () => {
    await caller().graph.counterTechnique({ controlId, techniqueId });

    const edge = await db.edge.findFirst({ where: { organizationId: testOrg.id, type: "COUNTERS" }, include: { toNode: true } });
    expect(edge).not.toBeNull();
    expect(edge!.toNode.organizationId).toBeNull(); // technique node is global

    const listed = await caller().graph.listCounteredTechniques({ controlId });
    expect(listed.map((t) => t.id)).toContain(techniqueId);

    const res = await caller().graph.uncounterTechnique({ controlId, techniqueId });
    expect(res.success).toBe(true);
    const after = await db.edge.count({ where: { organizationId: testOrg.id, type: "COUNTERS" } });
    expect(after).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `docker exec betterthanspreadsheetsgrc-test-1 npx jest src/__tests__/integration/graph-counters.test.ts`
Expected: FAIL — `caller().graph` is undefined.

- [ ] **Step 3: Add `getCounteredTechniques` to `graphService`**

In `src/server/graph/graph-service.ts`, add inside the file and export on the object:

```ts
async function getCounteredTechniques(
  controlId: string,
  organizationId: string,
  client: GraphClient = db,
): Promise<Array<{ techniqueId: string }>> {
  const edges = await listOutEdges(
    { type: "COUNTERS", from: { type: "Control", id: controlId }, organizationId },
    client,
  );
  return edges.map((e) => ({ techniqueId: e.toEntityId }));
}
```

Add `getCounteredTechniques` to the exported `graphService` object.

- [ ] **Step 4: Create `src/server/api/routers/graph.ts`**

```ts
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, organizationProcedure } from "@/server/api/trpc";
import { graphService } from "@/server/graph/graph-service";

export const graphRouter = createTRPCRouter({
  counterTechnique: organizationProcedure
    .input(z.object({ controlId: z.string(), techniqueId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const control = await ctx.db.organizationalControl.findUnique({ where: { id: input.controlId } });
      if (!control) throw new TRPCError({ code: "NOT_FOUND", message: "Control not found" });
      const technique = await ctx.db.mitreTechnique.findUnique({ where: { id: input.techniqueId } });
      if (!technique) throw new TRPCError({ code: "NOT_FOUND", message: "Technique not found" });

      await graphService.createEdge({
        type: "COUNTERS",
        from: { type: "Control", id: input.controlId },
        to: { type: "Technique", id: input.techniqueId },
        organizationId: ctx.organizationId!,
        toOrgId: null, // technique node is global
        createdById: ctx.session?.user.id ?? null,
      });
      return { success: true };
    }),

  uncounterTechnique: organizationProcedure
    .input(z.object({ controlId: z.string(), techniqueId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const removed = await graphService.deleteEdge({
        type: "COUNTERS",
        from: { type: "Control", id: input.controlId },
        to: { type: "Technique", id: input.techniqueId },
        organizationId: ctx.organizationId!,
      });
      return { success: removed };
    }),

  listCounteredTechniques: organizationProcedure
    .input(z.object({ controlId: z.string() }))
    .query(async ({ ctx, input }) => {
      const countered = await graphService.getCounteredTechniques(input.controlId, ctx.organizationId!);
      const ids = countered.map((c) => c.techniqueId);
      const techniques = await ctx.db.mitreTechnique.findMany({
        where: { id: { in: ids } },
        select: { id: true, externalId: true, name: true },
      });
      return techniques;
    }),
});
```

> Confirm the exact names `createTRPCRouter` and `organizationProcedure` are exported from `@/server/api/trpc` (they are used throughout existing routers).

- [ ] **Step 5: Register the router in `src/server/api/root.ts`**

Add the import alongside the other router imports and register it in the `createTRPCRouter({ ... })` map:

```ts
import { graphRouter } from "@/server/api/routers/graph";
// ...
  graph: graphRouter,
```

- [ ] **Step 6: Run to verify it passes**

Run: `docker exec betterthanspreadsheetsgrc-test-1 npx jest src/__tests__/integration/graph-counters.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/server/graph/graph-service.ts src/server/api/routers/graph.ts src/server/api/root.ts src/__tests__/integration/graph-counters.test.ts
git commit -m "feat(graph): add COUNTERS edges and graph router"
```

---

## Task 9: `techniqueExposure` traversal

**Files:**
- Modify: `src/server/graph/graph-service.ts` (add `techniqueExposure`)
- Modify: `src/server/api/routers/graph.ts` (add `techniqueExposure` query)
- Test: `src/__tests__/integration/graph-counters.test.ts` (add a `describe` block)

**Interfaces:**
- Produces on `graphService`: `techniqueExposure(riskId: string, organizationId: string, client?): Promise<Array<{ id: string; externalId: string; name: string }>>` — traverses `Risk ←MITIGATES– Control –COUNTERS→ Technique` via raw SQL.
- Produces tRPC `graph.techniqueExposure({ riskId })`.

- [ ] **Step 1: Write the failing test**

Add to `src/__tests__/integration/graph-counters.test.ts`:

```ts
describe("techniqueExposure traversal", () => {
  it("returns techniques reachable from a risk via mitigating controls", async () => {
    const riskId = randomUUID();
    const now = new Date();
    await db.$executeRaw`INSERT INTO "Risk" (id, "organizationId", title, description, severity, status, "createdAt", "updatedAt") VALUES (${riskId}, ${testOrg.id}, 'Exp Risk', 'd', 'HIGH', 'OPEN', ${now}, ${now})`;

    // Control MITIGATES Risk, Control COUNTERS Technique
    await caller().organizationalControl.linkToRisk({ riskId, controlId, role: "IN_PLACE" as never });
    await caller().graph.counterTechnique({ controlId, techniqueId });

    const exposure = await caller().graph.techniqueExposure({ riskId });
    expect(exposure.map((t) => t.id)).toContain(techniqueId);

    await db.$executeRaw`DELETE FROM "Edge" WHERE "toNodeId" IN (SELECT id FROM "Node" WHERE "entityId" = ${riskId})`;
    await db.$executeRaw`DELETE FROM "Node" WHERE "entityId" = ${riskId}`;
    await db.$executeRaw`DELETE FROM "Risk" WHERE id = ${riskId}`;
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `docker exec betterthanspreadsheetsgrc-test-1 npx jest src/__tests__/integration/graph-counters.test.ts -t "techniqueExposure"`
Expected: FAIL — `graph.techniqueExposure` undefined.

- [ ] **Step 3: Add `techniqueExposure` to `graphService`**

In `src/server/graph/graph-service.ts`:

```ts
async function techniqueExposure(
  riskId: string,
  organizationId: string,
  client: GraphClient = db,
): Promise<Array<{ id: string; externalId: string; name: string }>> {
  return client.$queryRaw<Array<{ id: string; externalId: string; name: string }>>`
    SELECT DISTINCT mt.id, mt."externalId", mt.name
    FROM "Node" rn
    JOIN "Edge" e1 ON e1."toNodeId" = rn.id AND e1.type = 'MITIGATES' AND e1."organizationId" = ${organizationId}
    JOIN "Node" cn ON cn.id = e1."fromNodeId" AND cn.type = 'Control'
    JOIN "Edge" e2 ON e2."fromNodeId" = cn.id AND e2.type = 'COUNTERS' AND e2."organizationId" = ${organizationId}
    JOIN "Node" tn ON tn.id = e2."toNodeId" AND tn.type = 'Technique'
    JOIN "MitreTechnique" mt ON mt.id = tn."entityId"
    WHERE rn.type = 'Risk' AND rn."entityId" = ${riskId}
  `;
}
```

Add `techniqueExposure` to the exported `graphService` object.

- [ ] **Step 4: Add the router query in `src/server/api/routers/graph.ts`**

```ts
  techniqueExposure: organizationProcedure
    .input(z.object({ riskId: z.string() }))
    .query(async ({ ctx, input }) => {
      return graphService.techniqueExposure(input.riskId, ctx.organizationId!);
    }),
```

- [ ] **Step 5: Run to verify it passes**

Run: `docker exec betterthanspreadsheetsgrc-test-1 npx jest src/__tests__/integration/graph-counters.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/graph/graph-service.ts src/server/api/routers/graph.ts src/__tests__/integration/graph-counters.test.ts
git commit -m "feat(graph): add techniqueExposure 2-hop traversal"
```

---

## Task 10: Clean cut — drop `RiskOrganizationalControl`

**Files:**
- Modify: `prisma/schema.prisma` (remove `model RiskOrganizationalControl`; keep `enum RiskOrgControlRole`)
- Modify: any remaining references found by grep (and stale tests/scripts that query the dropped table, e.g. `prisma/scripts/resetRiskAssessments.ts`)
- Test: full suite

**Interfaces:**
- Consumes: nothing new. Removes the `RiskOrganizationalControl` model and the `RiskLinks`/`RiskOrganizationalControl[]` relations on `OrganizationalControl`, `Risk`, and `Organization`.

- [ ] **Step 1: Find every remaining reference**

Run: `git grep -n "riskOrganizationalControl\|RiskOrganizationalControl"`
Expected: only schema relations + `prisma/scripts/resetRiskAssessments.ts` (and possibly a UI/component that already goes through the now-migrated router — leave those, they use the router not the model).

- [ ] **Step 2: Remove model + relations from `prisma/schema.prisma`**

- Delete the entire `model RiskOrganizationalControl { ... }` block (was at ~line 3325).
- Remove the relation fields that reference it:
  - On `OrganizationalControl` (~line 3115): `RiskLinks  RiskOrganizationalControl[]`
  - On `Risk`: the `RiskOrganizationalControl[]` back-relation (grep within the `Risk` model).
  - On `Organization`: the `RiskOrganizationalControl[]` back-relation.
- **Keep** `enum RiskOrgControlRole { IN_PLACE NEEDED }`.

- [ ] **Step 3: Fix `prisma/scripts/resetRiskAssessments.ts`**

Replace its `riskOrganizationalControl` delete with an equivalent edge cleanup, or remove that line if no longer meaningful:

```ts
// Was: await db.riskOrganizationalControl.deleteMany({ ... })
await db.edge.deleteMany({ where: { type: "MITIGATES" } });
```

> Adapt the `where` to whatever scoping the script already uses (e.g. by org). If the script targets specific risks, delete edges whose `toNode.entityId` is in that set via a raw query.

- [ ] **Step 4: Apply schema and regenerate**

```bash
docker exec betterthanspreadsheetsgrc-test-1 npx prisma db push --url "$DATABASE_URL" --accept-data-loss
docker exec betterthanspreadsheetsgrc-test-1 npx prisma generate
```
Expected: `db push` drops the `RiskOrganizationalControl` table; `generate` succeeds; `db.riskOrganizationalControl` no longer exists on the client.

- [ ] **Step 5: Run the full suite**

Run: `docker exec betterthanspreadsheetsgrc-test-1 npx jest`
Expected: PASS. If any suite fails because it referenced `riskOrganizationalControl` directly, update it to assert via the `graph`/`organizationalControl` router or via `db.edge` instead. Re-run until green.

- [ ] **Step 6: Run the backfill in dev/prod environments (operational note, not a test)**

After deploying schema Task 1–9, run once per environment **before** Task 10's drop is deployed:

```bash
docker exec betterthanspreadsheetsGRC-app npx tsx prisma/scripts/backfill-graph.ts
```

> In a real rollout, Tasks 1–9 ship first, the backfill runs, then Task 10 (the drop) ships. In local/test the order is collapsed because the backfill test seeds its own data.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/scripts/resetRiskAssessments.ts
git commit -m "feat(graph): drop RiskOrganizationalControl; MITIGATES is now graph-native"
```

---

## Self-Review

**1. Spec coverage**

| Spec section | Task(s) |
|---|---|
| §2 Data model (Node/Edge, enums) | Task 1 |
| §3 Multi-tenancy (default-deny + rawPrisma escape hatch, org→global) | Task 1 (default-deny, no allowlist), Task 3 (edge ops via filtered db + explicit org; node ops via rawPrisma), Task 4 (sync via rawPrisma), Task 8 (org→global COUNTERS) |
| §4 Node-sync extension | Task 4 |
| §5 Edge-type catalog | Task 2 (catalog), Task 3 (enforcement in createEdge) |
| §6a MITIGATES migrate + clean cut | Tasks 5 (backfill), 6 + 7 (repoint), 10 (drop) |
| §6b COUNTERS net-new (API + tests, no UI) | Task 8 |
| §7 techniqueExposure traversal | Task 9 |
| §8 Error handling (catalog/missing/dup/tenant) | Task 2 (errors), Task 3 (upsert idempotency, tenancy not-found) |
| §9 Testing | Tasks 1–10 each ship tests; Task 10 runs full suite |
| §10 Out of scope | Not implemented by design (MAPS_TO, UI, coverage recompute, other crosswalks) |

No spec requirement is unaddressed.

**2. Placeholder scan**

The only intentional placeholders are the "adapt to the real `risk.create` input" notes in Task 7 and the "confirm the legacy return shape" notes in Task 6 — these are required because the exact Zod inputs/return shapes must be read from the live files to keep contracts byte-identical; each note states precisely what to substitute and the assertion to land on. The deliberate `toBeGreaterffThanOrEqual` typo in Task 7 Step 1 is explicitly flagged to be rewritten before shipping. No "TODO/TBD/implement later" left.

**3. Type consistency**

- `graphService` method names are consistent across tasks: `ensureNode`, `removeNode`, `createEdge`, `deleteEdge`, `listOutEdges`, `listInEdges` (Task 3), `getCounteredTechniques` (Task 8), `techniqueExposure` (Task 9).
- Entity refs are uniformly `{ type: GraphNodeType; id: string }`.
- `EdgeRow.fromEntityId` / `toEntityId` are used identically in Tasks 6, 8.
- `EDGE_CATALOG`, `NODE_SYNC_MODELS`, `assertEdgeAllowed`, `GraphCatalogError` (Task 2) are consumed unchanged in Tasks 3 and 4.
- Edge `properties` shape `{ role, notes }` is written (Tasks 6, 7, backfill 5) and read (Task 6 `getForRisk`/`getLinkedRisks`) consistently.
