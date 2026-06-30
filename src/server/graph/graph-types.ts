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
