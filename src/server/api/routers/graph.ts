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
        organizationId: ctx.organizationId,
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
        organizationId: ctx.organizationId,
      });
      return { success: removed };
    }),

  listCounteredTechniques: organizationProcedure
    .input(z.object({ controlId: z.string() }))
    .query(async ({ ctx, input }) => {
      const countered = await graphService.getCounteredTechniques(input.controlId, ctx.organizationId);
      const ids = countered.map((c) => c.techniqueId);
      const techniques = await ctx.db.mitreTechnique.findMany({
        where: { id: { in: ids } },
        select: { id: true, externalId: true, name: true },
      });
      return techniques;
    }),

  techniqueExposure: organizationProcedure
    .input(z.object({ riskId: z.string() }))
    .query(async ({ ctx, input }) => {
      return graphService.techniqueExposure(input.riskId, ctx.organizationId!);
    }),
});
