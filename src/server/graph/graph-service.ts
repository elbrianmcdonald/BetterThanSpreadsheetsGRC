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
