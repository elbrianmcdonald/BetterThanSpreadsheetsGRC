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

  // 4. Migrate RiskOrganizationalControl -> MITIGATES edges, IF the legacy table still exists.
  // Raw SQL so this compiles after the Prisma model is dropped; the IF-EXISTS guard
  // makes it a safe no-op once the table is gone.
  const tableExists = await rawPrisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'RiskOrganizationalControl'
    ) AS exists`;
  if (tableExists[0]?.exists) {
    const links = await rawPrisma.$queryRaw<{
      organizationId: string;
      riskId: string;
      organizationalControlId: string;
      role: string;
      notes: string | null;
      createdById: string | null;
    }[]>`SELECT "organizationId", "riskId", "organizationalControlId", role, notes, "createdById"
         FROM "RiskOrganizationalControl"`;
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
        rawPrisma as unknown as Parameters<typeof graphService.createEdge>[1],
      );
      mitigatesEdges += 1;
    }
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
