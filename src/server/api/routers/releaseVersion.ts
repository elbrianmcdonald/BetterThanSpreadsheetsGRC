/**
 * Release Version (Changelog) router.
 *
 * Deployment-wide. Reads are open to any authenticated user; writes are ORG_ADMIN only.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { UserRole } from "@prisma/client";
import {
  createTRPCRouter,
  protectedProcedure,
  organizationProcedure,
  requireRole,
} from "@/server/api/trpc";

const writeProcedure = organizationProcedure.use(requireRole([UserRole.ORG_ADMIN]));

export const releaseVersionRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.releaseVersion.findMany({
      orderBy: { releasedAt: "desc" },
      include: {
        CreatedBy: { select: { id: true, name: true, email: true } },
      },
    });
  }),

  create: writeProcedure
    .input(
      z.object({
        version: z.string().min(1).max(50),
        title: z.string().max(200).optional().nullable(),
        notes: z.string().max(50000),
        releasedAt: z.date().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.releaseVersion.findUnique({ where: { version: input.version } });
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: `Version ${input.version} already exists.` });
      }
      return ctx.db.releaseVersion.create({
        data: {
          version: input.version,
          title: input.title ?? null,
          notes: input.notes,
          releasedAt: input.releasedAt ?? new Date(),
          createdById: ctx.session!.user.id,
        },
      });
    }),

  update: writeProcedure
    .input(
      z.object({
        id: z.string(),
        version: z.string().min(1).max(50).optional(),
        title: z.string().max(200).optional().nullable(),
        notes: z.string().max(50000).optional(),
        releasedAt: z.date().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.releaseVersion.findUnique({ where: { id: input.id } });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Release version not found" });
      }
      return ctx.db.releaseVersion.update({
        where: { id: input.id },
        data: {
          ...(input.version !== undefined ? { version: input.version } : {}),
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          ...(input.releasedAt !== undefined ? { releasedAt: input.releasedAt } : {}),
        },
      });
    }),

  delete: writeProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.releaseVersion.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
