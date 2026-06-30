import { rawPrisma } from "@/server/db";

export async function backfillGraph(): Promise<{ nodes: number; mitigatesEdges: number }> {
  let nodes = 0;

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

  // Section 4 (RiskOrganizationalControl -> MITIGATES migration) removed:
  // The RiskOrganizationalControl table has been dropped. MITIGATES edges are
  // now written directly by the graph service on every link/unlink operation.
  // The backfill is now a node-sync-only operation; mitigatesEdges is 0.

  return { nodes, mitigatesEdges: 0 };
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
