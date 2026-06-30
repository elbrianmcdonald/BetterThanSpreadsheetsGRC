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
            // rawPrisma is unfiltered → compound-unique upsert is safe + race-immune.
            await rawPrisma.node.upsert({
              where: { type_entityId: { type: nodeType, entityId: row.id } },
              create: { type: nodeType, entityId: row.id, organizationId: row.organizationId ?? null },
              update: {},
            });
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
