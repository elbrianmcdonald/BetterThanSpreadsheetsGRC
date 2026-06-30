# Graph Foundation — Design Spec

**Date:** 2026-06-30
**Status:** Approved (design); ready for implementation planning
**Scope:** Sub-project 1 of the Graph-Native Data Model program
**Author:** Winston (Architect) with Brian

---

## Context & Motivation

BetterThanSpreadsheetsGRC is a mature relational application (Prisma 7.7 / PostgreSQL,
137 models, ~5,500-line schema, ~64 tRPC routers, NextAuth v5, ~76 Jest suites). Today,
relationships between GRC entities are spread across **a dozen-plus dedicated crosswalk /
join tables**, each with its own type enum and router:

| Relationship | Current crosswalk table |
|---|---|
| Control ↔ Control (framework crosswalk) | `FrameworkControlMapping` |
| StandardControl ↔ Control | `StandardControlMapping` |
| OrgControl ↔ framework Control | `OrgControlFrameworkMapping` |
| Domain ↔ control/standard/maturity | `ControlDomainMapping` + 4 tagging junctions |
| Risk ↔ Control | `RiskControlLink` |
| Finding ↔ Control | `FindingControlLink` |
| Risk ↔ OrgControl | `RiskOrganizationalControl` |
| Threat ↔ Technique | `MitreTacticTechnique` + implicit m:n |
| BusinessProcess ↔ Asset/Vendor/Risk | 3 more join tables |

The goal is a **graph-native data model** — a property graph as the system of record for
relationships and reachability — rather than "a relational schema with crosswalks bolted on."

Two notable capability gaps in today's model that the graph closes:
- **MITRE techniques attach only to `Risk`** — there is no `Control → Technique` link.
- **No `Policy` model** exists (Standard/StandardControl approximates it).

### Chosen realization (decisions locked during brainstorming)

1. **Graph-native on Postgres** (not a separate graph DB, not greenfield). Keeps existing
   infra, multi-tenancy extension, migrations, deploy, and test harness.
2. **Option B — Hybrid identity graph.** Typed tables remain the home for rich, validated
   attributes. A generic `Node` (1:1 with each graph entity) + a generic `Edge` table
   become the authoritative model for **relationships, identity, and traversal**. The graph
   is the system of record for relationships; the typed table is the system of record for
   one entity's attributes.
3. **Tracer-bullet first spec.** Prove the whole loop end-to-end against real relationships,
   not just build inert substrate.
4. **Traced relationships:** `MITIGATES` (OrganizationalControl → Risk, migrating the
   existing `RiskOrganizationalControl` crosswalk — org→org) **and** `COUNTERS`
   (OrganizationalControl → ATT&CK Technique — net-new, org→global).
5. **Node-sync via Prisma `$extends` hook + one-time backfill** (mirrors the existing
   `organization-filter.ts` pattern).
6. **Clean cut** — migrate data, repoint routers (contracts unchanged), **drop**
   `RiskOrganizationalControl` in the same spec. No transitional dual-write.

### Node-type mapping (pinned by the tracer)

- **"Control" node** = `OrganizationalControl` (the org's implemented control, `OC-NNNN`)
- **"Requirement" node** = framework `Control` (deferred; not in this spec)
- **"Technique" node** = global `MitreTechnique` (`organizationId` is null — global)

---

## 1. Architecture Overview

Two new tables — **`Node`** and **`Edge`** — plus three new code units:

- **`graphService`** (`src/server/graph/graph-service.ts`) — the **sole** read/write path for
  nodes and edges. Routers never touch `db.node` / `db.edge` directly. It owns tenancy
  enforcement, edge-catalog validation, and traversal.
- **`graphSyncExtension`** (`src/server/db/middleware/graph-sync.ts`) — a second `$extends`
  client extension, composed **after** `organizationFilterMiddleware`, that auto-creates /
  deletes a `Node` whenever an in-scope entity is created/deleted.
- **`backfill-graph.ts`** — a one-time, **re-runnable** script that (a) creates nodes for
  existing `OrganizationalControl` / `Risk` / `MitreTechnique` rows and (b) migrates
  `RiskOrganizationalControl` rows into `MITIGATES` edges.

Typed tables remain the system of record for attributes; the graph is the system of record
for relationships. After this spec, `RiskOrganizationalControl` is dropped.

---

## 2. Data Model

```prisma
enum GraphNodeType { Control Risk Technique }      // grows per sub-project
enum GraphEdgeType { MITIGATES COUNTERS }          // grows per sub-project

model Node {
  id             String        @id @default(cuid())
  organizationId String?       // null = global (e.g. Technique)
  type           GraphNodeType
  entityId       String        // id of the typed row (Control/Risk/Technique)
  createdAt      DateTime      @default(now())
  outEdges       Edge[]        @relation("EdgeFrom")
  inEdges        Edge[]        @relation("EdgeTo")
  @@unique([type, entityId])
  @@index([organizationId])
  @@index([entityId])
}

model Edge {
  id             String        @id @default(cuid())
  organizationId String        // the asserting org — edges are ALWAYS owned, never global
  type           GraphEdgeType
  fromNodeId     String
  toNodeId       String
  properties     Json?         // e.g. { role: "IN_PLACE", notes: "..." }
  createdById    String?
  createdAt      DateTime      @default(now())
  fromNode       Node          @relation("EdgeFrom", fields: [fromNodeId], references: [id], onDelete: Cascade)
  toNode         Node          @relation("EdgeTo",   fields: [toNodeId],   references: [id], onDelete: Cascade)
  @@unique([fromNodeId, type, toNodeId])
  @@index([organizationId, type])
  @@index([fromNodeId])
  @@index([toNodeId])
}
```

- Typed enums (not free text) keep edges indexable and make the catalog compile-time real.
- `onDelete: Cascade` on both endpoints means deleting a node automatically removes its edges.
- `@@unique([type, entityId])` on `Node` guarantees one node per entity and makes backfill /
  sync idempotent.
- `@@unique([fromNodeId, type, toNodeId])` on `Edge` prevents duplicate edges and makes edge
  writes idempotent (upsert-safe).

---

## 3. Multi-Tenancy Rules

> **Revised 2026-06-30 after a HIGH security finding.** The original draft added `Node`
> and `Edge` to `ALLOWLIST_TABLES`, which disables auto org-filtering for those tables
> entirely — a blanket bypass where any stray `db.edge.findMany()` would read across
> tenants. We reject that. Instead we use **default-deny everywhere + a confined escape
> hatch** (the existing unfiltered `rawPrisma` client, used only inside `graphService`/the
> sync extension, only where global rows make auto-filtering impossible).

The existing auto-filter (`organization-filter.ts`) injects `where.organizationId = orgId`
on every **non-allowlisted** model. **Neither `Node` nor `Edge` is allowlisted**, so both are
default-denied on the standard `db` client. Tenancy then works as:

- **`Edge` — filtered `db` (default-deny).** `Edge.organizationId` is always the asserting
  org, so the standard auto-filter is exactly right. `graphService` accesses edges through the
  filtered `db` *and* passes `organizationId` explicitly in every edge `where`/`create` (so it
  is also correct when handed `rawPrisma` in the backfill). A stray `db.edge` call elsewhere is
  safely org-scoped by default. `createEdge` uses `findFirst` + `create`/`update` (not a
  compound-unique `upsert`) so it composes with the filter.
- **`Node` — `rawPrisma` escape hatch.** Node rows can be **global** (`organizationId = null`
  for Technique), are created **without org context** (the MITRE sync), and are keyed by a
  globally-unique compound (`type` + `entityId`) — all of which the generic auto-filter cannot
  express (it throws on null-context creates and mangles compound-unique selectors). So
  `graphService` and the sync extension perform Node reads/writes through `rawPrisma`. This is
  safe because every Node is reached either by its globally-unique `(type, entityId)` key (which
  the caller already owns) or by traversing an **org-filtered Edge** — never by an unscoped node
  scan. A stray `db.node` call elsewhere is still default-denied (it just won't see globals,
  which is safe).
- **Org→global edge:** a `Control COUNTERS Technique` edge carries the **org's** id (the edge is
  the org's assertion) even though its `toNode` (Technique) is global with `organizationId = null`.

Result: orgs share global nodes (read-only) but never each other's edges; there is **no blanket
bypass** — unfiltered access is confined to audited `graphService`/sync code via `rawPrisma`.
`graphService` remains the documented sole access path; direct `db.node`/`db.edge` use in
routers is prohibited by convention, but is now *fail-safe* (default-deny) rather than
*fail-open*.

---

## 4. Node-Sync Extension

```ts
const NODE_SYNC_MODELS = {
  OrganizationalControl: "Control",
  Risk:                  "Risk",
  MitreTechnique:        "Technique",
} as const;
```

- On `create` / `createMany` of an in-scope model → upsert a `Node`
  (`type`, `entityId = row.id`, `organizationId = row.organizationId ?? null`).
- On `delete` / `deleteMany` → remove the node (edges cascade via FK).
- Technique rows are created by the global MITRE sync with no org context → their nodes get
  `organizationId = null`, derived from the row's own `organizationId`.
- **Node writes use `rawPrisma`** (the unfiltered escape hatch from §3), since the filtered
  client cannot create a null-org node or upsert on the compound `(type, entityId)` key.
- Implemented as a `$extends` query wrapper: `const result = await query(args); /* sync via
  rawPrisma */; return result;`. `createMany` / `deleteMany` pass through (reconciled by the
  backfill + `createEdge`'s `ensureNode` safety net).
- Composed **after** the org-filter extension so the created row already carries its
  `organizationId`.

---

## 5. Edge-Type Catalog

A TS registry validated in `graphService.createEdge` at write time:

```ts
const EDGE_CATALOG = {
  MITIGATES: { from: "Control", to: "Risk" },      // OrgControl → Risk
  COUNTERS:  { from: "Control", to: "Technique" }, // OrgControl → Technique (net-new)
} satisfies Record<GraphEdgeType, { from: GraphNodeType; to: GraphNodeType }>;
```

Creating an edge whose endpoint types violate the catalog throws a typed `GraphCatalogError`.
This is how the schemaless graph stays disciplined. New sub-projects extend this map.

---

## 6. The Tracer Migration

### 6a. MITIGATES (migrate + clean cut)

- Backfill maps each `RiskOrganizationalControl` row →
  `Edge(MITIGATES, from = Control node, to = Risk node, properties = { role, notes })`,
  where `role` is the existing `RiskOrgControlRole` (`IN_PLACE` | `NEEDED`).
- The `organizationalControl.ts` / `risk.ts` endpoints that read/write that crosswalk are
  repointed to `graphService`, **keeping their tRPC input/output contracts byte-identical**
  (they still accept/return `role`, `notes`) so existing UI and tests are untouched.
- **Drop the `RiskOrganizationalControl` model** in the same Prisma schema change.

### 6b. COUNTERS (net-new)

- Add `graphService` methods + a thin set of tRPC endpoints to create / list / delete
  `Control → Technique` edges.
- **API + tests only; UI deferred to sub-project 3.** No data to migrate.

---

## 7. Traversal Proof

One read endpoint that crosswalks structurally could not answer, demonstrating graph value:

> **`graph.techniqueExposure(riskId)`** → traverse
> `Risk ←MITIGATES– Control –COUNTERS→ Technique`, returning the ATT&CK techniques addressed
> by the controls that mitigate a given risk (the risk's "attack surface as covered by
> controls").

Implemented as a 2-hop query (recursive-CTE-ready, but 2 hops is a plain indexed join now).
This proves the whole stack in one path: typed-table attributes + global nodes + org edges +
catalog + traversal.

---

## 7b. Deployment / Rollout Safety (DESTRUCTIVE MIGRATION — read before deploying)

Dropping `RiskOrganizationalControl` is a **destructive schema change**. The container entrypoint
(`docker-entrypoint.sh`) runs `prisma db push --accept-data-loss` on **every startup**, which will
drop the table the instant a Task-10 image boots. The backfill that migrates
`RiskOrganizationalControl` → `MITIGATES` edges is a **separate, manual script**
(`tsx prisma/scripts/backfill-graph.ts`) — it is NOT run by the entrypoint. Therefore:

> **Deploying the Task-10 image directly to a database that still holds
> `RiskOrganizationalControl` rows destroys those risk↔control links** (the table is dropped at
> startup, before any backfill could run).

**Required two-phase rollout for any populated environment:**

1. **Phase 1** — deploy the branch at the **pre-drop state** (through Task 9, where the schema still
   contains `RiskOrganizationalControl`). `db push` keeps the table.
2. **Run the backfill** against that deployment: `docker exec <app> npx tsx prisma/scripts/backfill-graph.ts`.
   It creates nodes and migrates every `RiskOrganizationalControl` row into a `MITIGATES` edge
   (idempotent — safe to re-run).
3. **Phase 2** — deploy the **Task-10** image. `db push` now drops the (already-migrated) table.

**Defense in depth:** the backfill keeps a raw-SQL, `IF EXISTS`-guarded migration section so it
compiles after the model is dropped and is a safe no-op once the table is gone — but this only
protects data if the backfill *runs before* `db push` drops the table, which the two-phase order
guarantees. A fresh/empty database (no `RiskOrganizationalControl` rows) can deploy Task 10
directly with no data to lose.

---

## 8. Error Handling

- **Catalog violation** → `GraphCatalogError` (typed).
- **Missing node for an entity at edge-create** → service auto-ensures the node; if the entity
  itself doesn't exist → `GraphNodeMissingError`.
- **Duplicate edge** → idempotent (the `@@unique` makes re-runs safe; service upserts).
- **Cross-tenant edge attempt** → not-found semantics (mirrors existing update/delete behavior).
- **Backfill** → idempotent via `upsert` on the unique keys; safe to re-run.

---

## 9. Testing (Jest, existing harness)

All org-scoped writes wrapped in `runWithOrganizationContext` per existing patterns:

- graph-service unit tests (create/list/delete; catalog enforcement; tenancy incl. org→global)
- node-sync hook tests (create/delete entity ⇒ node appears/disappears)
- backfill idempotency test (running twice yields identical state)
- **migrated-router contract tests must stay green unchanged**
- `techniqueExposure` traversal test
- cross-org isolation test (org B cannot see org A's `MITIGATES` edges)

---

## 10. Explicitly Out of Scope (deferred to later sub-projects)

- `MAPS_TO` (Requirement → Technique) and all other node/edge types
- The Graph Explorer UI and any visual graph rendering
- Recomputing the `coverage` router from edges
- Retiring the other ~11 crosswalk tables
- COUNTERS management UI (API + tests only in this spec)

---

## Program Decomposition (for reference)

| # | Sub-project | Delivers | Depends on |
|---|---|---|---|
| **1** | **Graph foundation** (this spec) | `Node`/`Edge`, sync extension, edge catalog, graph service, tracer migration (MITIGATES + COUNTERS), traversal proof, tests | — |
| 2 | Crosswalks → edges | Migrate remaining high-value relationships; refactor routers; retire tables | 1 |
| 3 | Traversal API + Graph Explorer UI | Impact/reachability, coverage from edges, visual graph view, COUNTERS UI | 1, 2 |
| 4+ | Net-new node types | Policy, Threat Model, full Strategy→Goal→Objective as graph, etc. | 1 |
