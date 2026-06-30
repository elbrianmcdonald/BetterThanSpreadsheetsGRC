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
      rawPrisma as unknown as Parameters<typeof graphService.createEdge>[1],
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
