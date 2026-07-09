/**
 * Multi-Tenancy Epic 1 — company switcher API (Story 1.3).
 *
 * `listSwitchable` powers the sidebar switcher; `switch` performs a
 * server-validated change of the active company. Both are `protectedProcedure`
 * (they operate on the user's cross-organization membership, not the currently
 * active org) and defer their access authority to
 * `@/server/services/organization/access` so validation is centralized.
 */

import { randomUUID } from "crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { AuditAction, UserRole } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

import {
  adminProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "@/server/api/trpc";
import { runWithOrganizationContext } from "@/server/db/middleware/organization-filter";
import { createAuditLog } from "@/server/services/audit-log.service";
import { seedOrganizationDefaults } from "@/lib/matrix/seedDefaults";
import {
  listAccessibleOrganizations,
  resolveActiveRole,
} from "@/server/services/organization/access";

/** Build a URL-safe slug from a company name. */
function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "org"
  );
}

/** Throw FORBIDDEN unless the given user is a platform admin (authoritative DB check). */
async function assertPlatformAdmin(db: PrismaClient, userId: string): Promise<void> {
  const me = await db.user.findUnique({
    where: { id: userId },
    select: { isPlatformAdmin: true },
  });
  if (!me?.isPlatformAdmin) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Platform admin access required" });
  }
}

export const organizationRouter = createTRPCRouter({
  /**
   * Organizations the current user may switch into (FR7). Members see their
   * membership orgs; platform admins see every active organization (FR2).
   */
  listSwitchable: protectedProcedure.query(async ({ ctx }) => {
    return listAccessibleOrganizations(ctx.db, ctx.session.user.id);
  }),

  /**
   * Change the active organization (FR5, FR8). Re-validates access server-side
   * on every call and rejects unauthorized targets (FR9, NFR5). Returns the
   * target org and the user's per-membership role there, which the client then
   * writes into the session via NextAuth `update()`.
   */
  switch: protectedProcedure
    .input(z.object({ organizationId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const role = await resolveActiveRole(
        ctx.db,
        ctx.session.user.id,
        input.organizationId,
      );
      if (!role) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have access to that organization",
        });
      }

      // Audit the switch inside the target org's context (AR1). Fire-and-forget:
      // the AuditLog write needs org context because the org-filter injects it.
      void runWithOrganizationContext(input.organizationId, async () => {
        await createAuditLog({
          organizationId: input.organizationId,
          userId: ctx.session!.user.id,
          action: AuditAction.SWITCH_ORGANIZATION,
          entityType: "Organization",
          entityId: input.organizationId,
        });
      });

      return { organizationId: input.organizationId, role };
    }),

  /**
   * Create a brand-new empty company (Epic 2, Story 2.1). Restricted to platform
   * admins and org admins (FR10). Provisions baseline defaults — default risk
   * matrix + assessment type (FR11) — grants the creator an ADMIN membership, and
   * returns the new org so the client switches into it (FR12).
   */
  create: protectedProcedure
    .input(z.object({ name: z.string().trim().min(1).max(120) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // FR10 / NFR3: only platform admins or org admins may create companies.
      const me = await ctx.db.user.findUnique({
        where: { id: userId },
        select: { isPlatformAdmin: true },
      });
      const canCreate =
        me?.isPlatformAdmin === true ||
        ctx.session.user.role === UserRole.ORG_ADMIN;
      if (!canCreate) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only platform admins or organization admins can create a company",
        });
      }

      const organizationId = randomUUID();
      const slug = `${slugify(input.name)}-${organizationId.slice(0, 8)}`;

      await ctx.db.organization.create({
        data: { id: organizationId, name: input.name, slug, active: true, updatedAt: new Date() },
      });

      // Creator becomes ADMIN of the new company (FR12).
      await ctx.db.organizationMembership.create({
        data: { id: randomUUID(), userId, organizationId, role: UserRole.ORG_ADMIN },
      });

      // Provision baseline defaults inside the new org's context so the org-filter
      // scopes the seeded rows to it (FR11).
      await runWithOrganizationContext(organizationId, async () => {
        await seedOrganizationDefaults(ctx.db, organizationId);
      });

      // Audit the creation within the new org's context (AR1). Fire-and-forget.
      void runWithOrganizationContext(organizationId, async () => {
        await createAuditLog({
          organizationId,
          userId,
          action: AuditAction.CREATE_ORGANIZATION,
          entityType: "Organization",
          entityId: organizationId,
        });
      });

      return { organizationId, role: UserRole.ORG_ADMIN };
    }),

  // ---- Epic 3: membership management (active company) ----

  /** List the members of the active company (Story 3.1/3.2 management surface). */
  listMembers: adminProcedure.query(async ({ ctx }) => {
    const memberships = await ctx.db.organizationMembership.findMany({
      where: { organizationId: ctx.organizationId! },
      select: {
        userId: true,
        role: true,
        createdAt: true,
        User: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    return memberships.map((m) => ({
      userId: m.userId,
      role: m.role,
      name: m.User.name,
      email: m.User.email,
    }));
  }),

  /** Attach an existing user to the active company with a role (FR13). */
  addMember: adminProcedure
    .input(z.object({ email: z.string().email(), role: z.nativeEnum(UserRole) }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { email: input.email },
        select: { id: true },
      });
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No user found with that email" });
      }

      const existing = await ctx.db.organizationMembership.findUnique({
        where: { userId_organizationId: { userId: user.id, organizationId: ctx.organizationId! } },
      });
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "User is already a member of this company" });
      }

      await ctx.db.organizationMembership.create({
        data: { id: randomUUID(), userId: user.id, organizationId: ctx.organizationId!, role: input.role },
      });

      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: AuditAction.MEMBERSHIP_GRANTED,
        entityType: "OrganizationMembership",
        entityId: user.id,
        changes: { after: { userId: user.id, role: input.role } },
      });

      return { userId: user.id };
    }),

  /** Change a member's role in the active company (FR14). */
  updateMemberRole: adminProcedure
    .input(z.object({ userId: z.string().min(1), role: z.nativeEnum(UserRole) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.organizationMembership.findUnique({
        where: { userId_organizationId: { userId: input.userId, organizationId: ctx.organizationId! } },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User is not a member of this company" });
      }

      await ctx.db.organizationMembership.update({
        where: { userId_organizationId: { userId: input.userId, organizationId: ctx.organizationId! } },
        data: { role: input.role },
      });

      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: AuditAction.MEMBERSHIP_ROLE_UPDATED,
        entityType: "OrganizationMembership",
        entityId: input.userId,
        changes: { before: { role: existing.role }, after: { role: input.role } },
      });

      return { userId: input.userId, role: input.role };
    }),

  /** Remove a member from the active company, revoking their access (FR14). */
  removeMember: adminProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.organizationMembership.findUnique({
        where: { userId_organizationId: { userId: input.userId, organizationId: ctx.organizationId! } },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User is not a member of this company" });
      }

      await ctx.db.organizationMembership.delete({
        where: { userId_organizationId: { userId: input.userId, organizationId: ctx.organizationId! } },
      });

      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: AuditAction.MEMBERSHIP_REVOKED,
        entityType: "OrganizationMembership",
        entityId: input.userId,
        changes: { before: { role: existing.role } },
      });

      return { userId: input.userId };
    }),

  // ---- Platform: companies management (list + delete) ----

  /** List all companies with member counts. Platform-admin only. */
  listCompanies: protectedProcedure.query(async ({ ctx }) => {
    await assertPlatformAdmin(ctx.db, ctx.session.user.id);
    const orgs = await ctx.db.organization.findMany({
      select: {
        id: true,
        name: true,
        active: true,
        _count: { select: { OrganizationMembership: true } },
      },
      orderBy: { name: "asc" },
    });
    return orgs.map((o) => ({
      id: o.id,
      name: o.name,
      active: o.active,
      memberCount: o._count.OrganizationMembership,
    }));
  }),

  /** Delete a company and all its data (cascade). Platform-admin only; cannot
   * delete the caller's currently-active company. */
  delete: protectedProcedure
    .input(z.object({ organizationId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx.db, ctx.session.user.id);

      if (input.organizationId === ctx.session.user.organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Switch to another company before deleting this one",
        });
      }

      const org = await ctx.db.organization.findUnique({
        where: { id: input.organizationId },
        select: { id: true, name: true },
      });
      if (!org) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Company not found" });
      }

      await ctx.db.organization.delete({ where: { id: input.organizationId } });

      // Audit in the acting admin's (surviving) org — the deleted org's trail is gone.
      const actorOrgId = ctx.session.user.organizationId;
      void runWithOrganizationContext(actorOrgId, async () => {
        await createAuditLog({
          organizationId: actorOrgId,
          userId: ctx.session.user.id,
          action: AuditAction.DELETE_ORGANIZATION,
          entityType: "Organization",
          entityId: input.organizationId,
          changes: { before: { name: org.name } },
        });
      });

      return { organizationId: input.organizationId };
    }),

  // ---- Epic 3, Story 3.3: platform admin management ----

  /** List all platform admins. Platform-admin only (NFR3, NFR5). */
  listPlatformAdmins: protectedProcedure.query(async ({ ctx }) => {
    await assertPlatformAdmin(ctx.db, ctx.session.user.id);
    return ctx.db.user.findMany({
      where: { isPlatformAdmin: true },
      select: { id: true, name: true, email: true },
      orderBy: { email: "asc" },
    });
  }),

  /** Grant or revoke platform-admin status for a user by email. Platform-admin only (FR16). */
  setPlatformAdmin: protectedProcedure
    .input(z.object({ email: z.string().email(), isPlatformAdmin: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx.db, ctx.session.user.id);

      const target = await ctx.db.user.findUnique({
        where: { email: input.email },
        select: { id: true },
      });
      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No user found with that email" });
      }

      await ctx.db.user.update({
        where: { id: target.id },
        data: { isPlatformAdmin: input.isPlatformAdmin },
      });

      // Platform-level event, homed in the acting admin's current org for the trail.
      const actorOrgId = ctx.session.user.organizationId;
      void runWithOrganizationContext(actorOrgId, async () => {
        await createAuditLog({
          organizationId: actorOrgId,
          userId: ctx.session!.user.id,
          action: AuditAction.UPDATE_PLATFORM_ADMIN,
          entityType: "User",
          entityId: target.id,
          changes: { after: { isPlatformAdmin: input.isPlatformAdmin } },
        });
      });

      return { userId: target.id, isPlatformAdmin: input.isPlatformAdmin };
    }),
});
