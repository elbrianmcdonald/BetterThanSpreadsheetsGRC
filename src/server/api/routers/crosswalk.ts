/**
 * Crosswalk Router (Epic 25, Story 25.2)
 *
 * Framework-to-framework crosswalking between ANY two loaded frameworks —
 * not just the organization's designated base framework. Reuses the existing
 * `FrameworkControlMapping` model (no new model); the base-framework-only
 * constraint that `baseFrameworkMapping` enforces is deliberately omitted here.
 * A "crosswalk" is simply a (source framework, target framework) pair that has
 * one or more control mappings in the organization.
 *
 * Relationship types use the OLIR semantics from Story 25.1
 * (EQUIVALENT / SUBSET_OF / SUPERSET_OF / INTERSECTS).
 *
 * The dual-pane mapping workbench UI is Story 25.3; audit logging of
 * create/edit/delete is added with that story (NFR4).
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  UserRole,
  FrameworkMappingType,
  StandardMappingType,
  MappingStatus,
  AuditAction,
  Prisma,
} from "@prisma/client";
import { randomUUID } from "crypto";

import {
  createTRPCRouter,
  organizationProcedure,
  requireRole,
} from "@/server/api/trpc";
import { createAuditLog } from "@/server/services/audit-log.service";
import {
  invertMappingType,
  deriveSuggestion,
  type OlirType,
} from "@/lib/crosswalk-derivation";
import {
  buildExportFile,
  OLIR_EXPORT_LABEL,
  type ExportFormat,
} from "@/lib/crosswalk-export";
import { READ_ROLES, WRITE_ROLES } from "@/lib/auth/roles";

// Roles that can create/delete/confirm crosswalk mappings (writes; mapping
// promotion is a write per product decision, not a governance approval gate)
const CROSSWALK_MANAGE_ROLES: UserRole[] = WRITE_ROLES as UserRole[];

// Roles that can view crosswalks (reads)
const CROSSWALK_VIEW_ROLES: UserRole[] = READ_ROLES as UserRole[];

const pairInput = z.object({
  sourceFrameworkId: z.string().min(1),
  targetFrameworkId: z.string().min(1),
});

/**
 * Load a framework's controls with their family (root ancestor) and each
 * control's strongest org-control coverage status (CONFIRMED > SUGGESTED).
 * Shared by getFrameworkCoverage + listFamilyControlsByStatus (Story 26.3).
 */
async function loadCoverage(
  db: Prisma.TransactionClient,
  orgId: string,
  frameworkId: string,
) {
  const controls = await db.control.findMany({
    where: { frameworkId, organizationId: orgId },
    select: { id: true, controlId: true, title: true, parentControlId: true },
    orderBy: { controlId: "asc" },
  });
  const byId = new Map(controls.map((c) => [c.id, c]));
  const rootOf = (c: (typeof controls)[number]): (typeof controls)[number] => {
    let cur = c;
    const seen = new Set<string>();
    while (cur.parentControlId && byId.has(cur.parentControlId) && !seen.has(cur.id)) {
      seen.add(cur.id);
      cur = byId.get(cur.parentControlId)!;
    }
    return cur;
  };
  const rootIdByControl = new Map<string, string>();
  const familyMeta = new Map<string, { id: string; controlId: string; title: string }>();
  for (const c of controls) {
    const r = rootOf(c);
    rootIdByControl.set(c.id, r.id);
    if (!familyMeta.has(r.id)) {
      familyMeta.set(r.id, { id: r.id, controlId: r.controlId, title: r.title });
    }
  }

  const mappings = await db.orgControlFrameworkMapping.findMany({
    where: { organizationId: orgId, FrameworkControl: { frameworkId } },
    select: { frameworkControlId: true, status: true },
  });
  const statusByControl = new Map<string, "CONFIRMED" | "SUGGESTED">();
  for (const m of mappings) {
    if (m.status === MappingStatus.CONFIRMED) {
      statusByControl.set(m.frameworkControlId, "CONFIRMED");
    } else if (
      m.status === MappingStatus.SUGGESTED &&
      statusByControl.get(m.frameworkControlId) !== "CONFIRMED"
    ) {
      statusByControl.set(m.frameworkControlId, "SUGGESTED");
    }
  }

  return { controls, rootIdByControl, familyMeta, statusByControl };
}

export const crosswalkRouter = createTRPCRouter({
  /**
   * List all crosswalk pairs (source framework → target framework) that have
   * at least one mapping in the organization, with mapping count + last-updated.
   */
  listCrosswalks: organizationProcedure
    .use(requireRole(CROSSWALK_VIEW_ROLES))
    .query(async ({ ctx }) => {
      const orgId = ctx.organizationId!;

      // Derive framework pairs from the control ids on each mapping via a raw
      // aggregation so we never load every mapping row into JS (NFR1).
      const pairs = await ctx.db.$queryRaw<
        Array<{
          sourceFrameworkId: string;
          targetFrameworkId: string;
          mappingCount: bigint;
          lastUpdated: Date;
        }>
      >`
        SELECT sc."frameworkId"      AS "sourceFrameworkId",
               tc."frameworkId"      AS "targetFrameworkId",
               COUNT(*)              AS "mappingCount",
               MAX(fcm."updatedAt")  AS "lastUpdated"
        FROM "FrameworkControlMapping" fcm
        JOIN "Control" sc ON sc.id = fcm."sourceControlId"
        JOIN "Control" tc ON tc.id = fcm."targetControlId"
        WHERE fcm."organizationId" = ${orgId}
        GROUP BY sc."frameworkId", tc."frameworkId"
        ORDER BY MAX(fcm."updatedAt") DESC
      `;

      if (pairs.length === 0) return [];

      const frameworkIds = Array.from(
        new Set(pairs.flatMap((p) => [p.sourceFrameworkId, p.targetFrameworkId])),
      );
      const frameworks = await ctx.db.framework.findMany({
        where: { id: { in: frameworkIds }, organizationId: orgId },
        select: { id: true, name: true, code: true },
      });
      const fwById = new Map(frameworks.map((f) => [f.id, f]));

      return pairs
        .map((p) => {
          const source = fwById.get(p.sourceFrameworkId);
          const target = fwById.get(p.targetFrameworkId);
          if (!source || !target) return null; // framework deleted; skip
          return {
            sourceFrameworkId: p.sourceFrameworkId,
            targetFrameworkId: p.targetFrameworkId,
            source,
            target,
            mappingCount: Number(p.mappingCount),
            lastUpdated: p.lastUpdated,
          };
        })
        .filter((p): p is NonNullable<typeof p> => p !== null);
    }),

  /**
   * Metadata for a chosen framework pair (names, control counts, mapping count).
   * Backs the workbench header. Both frameworks must belong to the org.
   */
  getPair: organizationProcedure
    .use(requireRole(CROSSWALK_VIEW_ROLES))
    .input(pairInput)
    .query(async ({ ctx, input }) => {
      const orgId = ctx.organizationId!;

      if (input.sourceFrameworkId === input.targetFrameworkId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A crosswalk requires two different frameworks",
        });
      }

      const frameworks = await ctx.db.framework.findMany({
        where: {
          id: { in: [input.sourceFrameworkId, input.targetFrameworkId] },
          organizationId: orgId,
        },
        select: {
          id: true,
          name: true,
          code: true,
          _count: { select: { Control: true } },
        },
      });

      const source = frameworks.find((f) => f.id === input.sourceFrameworkId);
      const target = frameworks.find((f) => f.id === input.targetFrameworkId);
      if (!source || !target) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "One or both frameworks were not found in your organization",
        });
      }

      const mappingCount = await ctx.db.frameworkControlMapping.count({
        where: {
          organizationId: orgId,
          SourceControl: { frameworkId: input.sourceFrameworkId },
          TargetControl: { frameworkId: input.targetFrameworkId },
        },
      });

      return {
        source: {
          id: source.id,
          name: source.name,
          code: source.code,
          controlCount: source._count.Control,
        },
        target: {
          id: target.id,
          name: target.name,
          code: target.code,
          controlCount: target._count.Control,
        },
        mappingCount,
      };
    }),

  /**
   * All mappings for a framework pair (read-only list for the shell +
   * Story 25.3's current-mappings panel). Capped for the shell; full
   * server-side search/pagination is the 25.3 workbench's job.
   */
  listMappingsForPair: organizationProcedure
    .use(requireRole(CROSSWALK_VIEW_ROLES))
    .input(pairInput.extend({ take: z.number().int().min(1).max(1000).default(500) }))
    .query(async ({ ctx, input }) => {
      const mappings = await ctx.db.frameworkControlMapping.findMany({
        where: {
          organizationId: ctx.organizationId!,
          SourceControl: { frameworkId: input.sourceFrameworkId },
          TargetControl: { frameworkId: input.targetFrameworkId },
        },
        select: {
          id: true,
          mappingType: true,
          confidence: true,
          notes: true,
          updatedAt: true,
          SourceControl: { select: { id: true, controlId: true, title: true } },
          TargetControl: { select: { id: true, controlId: true, title: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: input.take,
      });
      return mappings;
    }),

  /**
   * Create a crosswalk mapping between any two controls in different frameworks.
   * No base-framework checks. Dedup on the model's unique [source, target] pair.
   */
  createMapping: organizationProcedure
    .use(requireRole(CROSSWALK_MANAGE_ROLES))
    .input(
      z.object({
        sourceControlId: z.string().min(1),
        targetControlId: z.string().min(1),
        mappingType: z.nativeEnum(FrameworkMappingType).default(FrameworkMappingType.EQUIVALENT),
        notes: z.string().max(1000).optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.organizationId!;

      if (input.sourceControlId === input.targetControlId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A control cannot be crosswalked to itself",
        });
      }

      const [source, target] = await Promise.all([
        ctx.db.control.findFirst({
          where: { id: input.sourceControlId, organizationId: orgId },
          select: { id: true, frameworkId: true },
        }),
        ctx.db.control.findFirst({
          where: { id: input.targetControlId, organizationId: orgId },
          select: { id: true, frameworkId: true },
        }),
      ]);

      if (!source) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Source control not found" });
      }
      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Target control not found" });
      }

      // A crosswalk maps ACROSS frameworks; a same-framework pair is a mistake.
      // (Control.frameworkId is non-nullable, so a direct compare is sufficient.)
      if (source.frameworkId === target.frameworkId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Source and target controls are in the same framework",
        });
      }

      try {
        const created = await ctx.db.frameworkControlMapping.create({
          data: {
            id: randomUUID(),
            organizationId: orgId,
            sourceControlId: input.sourceControlId,
            targetControlId: input.targetControlId,
            mappingType: input.mappingType,
            notes: input.notes ?? null,
            createdById: ctx.session!.user.id,
          },
          select: {
            id: true,
            mappingType: true,
            confidence: true,
            notes: true,
            updatedAt: true,
            SourceControl: { select: { id: true, controlId: true, title: true } },
            TargetControl: { select: { id: true, controlId: true, title: true } },
          },
        });
        void createAuditLog({
          organizationId: orgId,
          userId: ctx.session!.user.id,
          action: AuditAction.CREATE_MAPPING,
          entityType: "FrameworkControlMapping",
          entityId: created.id,
          changes: {
            after: {
              sourceControlId: input.sourceControlId,
              targetControlId: input.targetControlId,
              mappingType: input.mappingType,
            },
          },
        });
        return created;
      } catch (e) {
        // Unique [sourceControlId, targetControlId] → friendly conflict (FR10).
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This source→target mapping already exists",
          });
        }
        throw e;
      }
    }),

  /**
   * Delete a crosswalk mapping (org-scoped).
   */
  deleteMapping: organizationProcedure
    .use(requireRole(CROSSWALK_MANAGE_ROLES))
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.frameworkControlMapping.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId! },
        select: { id: true },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Mapping not found" });
      }
      await ctx.db.frameworkControlMapping.delete({ where: { id: input.id } });
      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: AuditAction.DELETE_MAPPING,
        entityType: "FrameworkControlMapping",
        entityId: input.id,
      });
      return { success: true };
    }),

  /**
   * Paginated, server-side-searchable control listing for one framework pane
   * (NFR1). "Family" = the control's root ancestor via parentControlId.
   */
  listFrameworkControls: organizationProcedure
    .use(requireRole(CROSSWALK_VIEW_ROLES))
    .input(
      z.object({
        frameworkId: z.string().min(1),
        search: z.string().optional(),
        familyId: z.string().optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(25),
      }),
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.organizationId!;

      const framework = await ctx.db.framework.findFirst({
        where: { id: input.frameworkId, organizationId: orgId },
        select: { id: true, name: true, code: true },
      });
      if (!framework) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Framework not found" });
      }

      // Bounded by framework size (~1,196 max) — load once to compute families.
      const all = await ctx.db.control.findMany({
        where: { frameworkId: input.frameworkId, organizationId: orgId },
        select: { id: true, controlId: true, title: true, parentControlId: true },
        orderBy: { controlId: "asc" },
      });

      const byId = new Map(all.map((c) => [c.id, c]));
      const familyOf = (c: (typeof all)[number]): (typeof all)[number] => {
        let cur = c;
        const seen = new Set<string>();
        while (cur.parentControlId && byId.has(cur.parentControlId) && !seen.has(cur.id)) {
          seen.add(cur.id);
          cur = byId.get(cur.parentControlId)!;
        }
        return cur;
      };

      const familyMap = new Map<string, { id: string; controlId: string; title: string }>();
      const rootIdByControl = new Map<string, string>();
      for (const c of all) {
        const root = familyOf(c);
        rootIdByControl.set(c.id, root.id);
        if (!familyMap.has(root.id)) {
          familyMap.set(root.id, { id: root.id, controlId: root.controlId, title: root.title });
        }
      }
      const families = Array.from(familyMap.values()).sort((a, b) =>
        a.controlId.localeCompare(b.controlId),
      );

      const search = input.search?.trim().toLowerCase();
      const filtered = all.filter((c) => {
        if (input.familyId && rootIdByControl.get(c.id) !== input.familyId) return false;
        if (search) {
          return (
            c.controlId.toLowerCase().includes(search) ||
            c.title.toLowerCase().includes(search)
          );
        }
        return true;
      });

      const total = filtered.length;
      const start = (input.page - 1) * input.pageSize;
      const controls = filtered.slice(start, start + input.pageSize).map((c) => ({
        id: c.id,
        controlId: c.controlId,
        title: c.title,
        familyId: rootIdByControl.get(c.id)!,
      }));

      return {
        framework,
        controls,
        total,
        page: input.page,
        pageSize: input.pageSize,
        families,
      };
    }),

  /**
   * Mappings for a single selected source control into the target framework —
   * backs the persistent current-mappings bar.
   */
  listMappingsForSource: organizationProcedure
    .use(requireRole(CROSSWALK_VIEW_ROLES))
    .input(z.object({ sourceControlId: z.string().min(1), targetFrameworkId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      return ctx.db.frameworkControlMapping.findMany({
        where: {
          organizationId: ctx.organizationId!,
          sourceControlId: input.sourceControlId,
          TargetControl: { frameworkId: input.targetFrameworkId },
        },
        select: {
          id: true,
          mappingType: true,
          notes: true,
          updatedAt: true,
          TargetControl: { select: { id: true, controlId: true, title: true } },
        },
        orderBy: { updatedAt: "desc" },
      });
    }),

  /**
   * Batch-create mappings from one source control to many target controls with
   * a single relationship type + optional notes. Dedups via skipDuplicates.
   */
  createMappings: organizationProcedure
    .use(requireRole(CROSSWALK_MANAGE_ROLES))
    .input(
      z.object({
        sourceControlId: z.string().min(1),
        targetControlIds: z.array(z.string().min(1)).min(1).max(200),
        mappingType: z.nativeEnum(FrameworkMappingType).default(FrameworkMappingType.EQUIVALENT),
        notes: z.string().max(1000).optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.organizationId!;
      const targetIds = Array.from(new Set(input.targetControlIds));

      if (targetIds.includes(input.sourceControlId)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A control cannot be crosswalked to itself",
        });
      }

      const source = await ctx.db.control.findFirst({
        where: { id: input.sourceControlId, organizationId: orgId },
        select: { id: true, frameworkId: true },
      });
      if (!source) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Source control not found" });
      }

      const targets = await ctx.db.control.findMany({
        where: { id: { in: targetIds }, organizationId: orgId },
        select: { id: true, frameworkId: true },
      });
      if (targets.length !== targetIds.length) {
        throw new TRPCError({ code: "NOT_FOUND", message: "One or more target controls not found" });
      }
      if (targets.some((t) => t.frameworkId === source.frameworkId)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Target controls must be in a different framework from the source",
        });
      }

      const result = await ctx.db.frameworkControlMapping.createMany({
        data: targets.map((t) => ({
          id: randomUUID(),
          organizationId: orgId,
          sourceControlId: input.sourceControlId,
          targetControlId: t.id,
          mappingType: input.mappingType,
          notes: input.notes ?? null,
          createdById: ctx.session!.user.id,
        })),
        skipDuplicates: true,
      });

      // Only audit a real write — skipDuplicates may have created nothing.
      if (result.count > 0) {
        void createAuditLog({
          organizationId: orgId,
          userId: ctx.session!.user.id,
          action: AuditAction.CREATE_MAPPING,
          entityType: "FrameworkControlMapping",
          entityId: input.sourceControlId,
          changes: {
            after: {
              sourceControlId: input.sourceControlId,
              targetControlIds: targetIds,
              mappingType: input.mappingType,
              created: result.count,
            },
          },
        });
      }

      return { created: result.count };
    }),

  /**
   * Edit a mapping's relationship type and/or notes in place (FR12).
   */
  updateMapping: organizationProcedure
    .use(requireRole(CROSSWALK_MANAGE_ROLES))
    .input(
      z.object({
        id: z.string().min(1),
        mappingType: z.nativeEnum(FrameworkMappingType).optional(),
        notes: z.string().max(1000).optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.frameworkControlMapping.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId! },
        select: { id: true, mappingType: true, notes: true },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Mapping not found" });
      }

      const updated = await ctx.db.frameworkControlMapping.update({
        where: { id: input.id },
        data: {
          ...(input.mappingType !== undefined && { mappingType: input.mappingType }),
          ...(input.notes !== undefined && { notes: input.notes }),
        },
        select: {
          id: true,
          mappingType: true,
          notes: true,
          updatedAt: true,
          TargetControl: { select: { id: true, controlId: true, title: true } },
        },
      });

      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: AuditAction.UPDATE_MAPPING,
        entityType: "FrameworkControlMapping",
        entityId: input.id,
        changes: {
          before: { mappingType: existing.mappingType, notes: existing.notes },
          after: { mappingType: updated.mappingType, notes: updated.notes },
        },
      });

      return updated;
    }),

  // ===========================================================================
  // Story 25.4 — Organizational Controls as a crosswalk source
  // (OrgControlFrameworkMapping edge table; same OLIR semantics, StandardMappingType).
  // ===========================================================================

  /**
   * Paginated org custom controls for the source pane. Same return shape as
   * listFrameworkControls so ControlPane renders it unchanged. `family` is a
   * plain string on OrganizationalControl (not a hierarchy).
   */
  listOrgControls: organizationProcedure
    .use(requireRole(CROSSWALK_VIEW_ROLES))
    .input(
      z.object({
        search: z.string().optional(),
        familyId: z.string().optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(25),
      }),
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.organizationId!;
      const NO_FAMILY = "(none)";

      const all = await ctx.db.organizationalControl.findMany({
        where: { organizationId: orgId },
        select: { id: true, localControlId: true, name: true, family: true },
        orderBy: { localControlId: "asc" },
      });

      const familyIdOf = (c: (typeof all)[number]) => c.family ?? NO_FAMILY;
      const familyMap = new Map<string, { id: string; controlId: string; title: string }>();
      for (const c of all) {
        const fid = familyIdOf(c);
        if (!familyMap.has(fid)) familyMap.set(fid, { id: fid, controlId: fid, title: fid });
      }
      const families = Array.from(familyMap.values()).sort((a, b) =>
        a.controlId.localeCompare(b.controlId),
      );

      const search = input.search?.trim().toLowerCase();
      const filtered = all.filter((c) => {
        if (input.familyId && familyIdOf(c) !== input.familyId) return false;
        if (search) {
          return (
            c.localControlId.toLowerCase().includes(search) ||
            c.name.toLowerCase().includes(search)
          );
        }
        return true;
      });

      const total = filtered.length;
      const start = (input.page - 1) * input.pageSize;
      const controls = filtered.slice(start, start + input.pageSize).map((c) => ({
        id: c.id,
        controlId: c.localControlId,
        title: c.name,
        familyId: familyIdOf(c),
      }));

      return { controls, total, page: input.page, pageSize: input.pageSize, families };
    }),

  /**
   * Header metadata for an org-controls → framework workbench.
   */
  getOrgControlTarget: organizationProcedure
    .use(requireRole(CROSSWALK_VIEW_ROLES))
    .input(z.object({ targetFrameworkId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.organizationId!;
      const target = await ctx.db.framework.findFirst({
        where: { id: input.targetFrameworkId, organizationId: orgId },
        select: { id: true, name: true, code: true, _count: { select: { Control: true } } },
      });
      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Framework not found in your organization" });
      }
      const [orgControlCount, mappingCount] = await Promise.all([
        ctx.db.organizationalControl.count({ where: { organizationId: orgId } }),
        ctx.db.orgControlFrameworkMapping.count({
          where: {
            organizationId: orgId,
            FrameworkControl: { frameworkId: input.targetFrameworkId },
          },
        }),
      ]);
      return {
        target: {
          id: target.id,
          name: target.name,
          code: target.code,
          controlCount: target._count.Control,
        },
        orgControlCount,
        mappingCount,
      };
    }),

  /**
   * Existing OrgControlFrameworkMapping rows for a selected org control into the
   * target framework — backs the current-mappings bar (surfaces mappings created
   * by the existing FrameworkMappingsEditor too — AC3).
   */
  listOrgControlMappingsForSource: organizationProcedure
    .use(requireRole(CROSSWALK_VIEW_ROLES))
    .input(
      z.object({
        orgControlId: z.string().min(1),
        targetFrameworkId: z.string().min(1),
        statuses: z.array(z.nativeEnum(MappingStatus)).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.orgControlFrameworkMapping.findMany({
        where: {
          organizationId: ctx.organizationId!,
          orgControlId: input.orgControlId,
          FrameworkControl: { frameworkId: input.targetFrameworkId },
          ...(input.statuses && input.statuses.length > 0
            ? { status: { in: input.statuses } }
            : {}),
        },
        select: {
          id: true,
          mappingType: true,
          notes: true,
          createdAt: true,
          FrameworkControl: { select: { id: true, controlId: true, title: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  /**
   * Batch-create org-control → framework-control mappings.
   */
  createOrgControlMappings: organizationProcedure
    .use(requireRole(CROSSWALK_MANAGE_ROLES))
    .input(
      z.object({
        orgControlId: z.string().min(1),
        frameworkControlIds: z.array(z.string().min(1)).min(1).max(200),
        mappingType: z.nativeEnum(StandardMappingType).default(StandardMappingType.EQUIVALENT),
        notes: z.string().max(500).optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.organizationId!;
      const targetIds = Array.from(new Set(input.frameworkControlIds));

      const orgControl = await ctx.db.organizationalControl.findFirst({
        where: { id: input.orgControlId, organizationId: orgId },
        select: { id: true },
      });
      if (!orgControl) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Organizational control not found" });
      }

      const targets = await ctx.db.control.findMany({
        where: { id: { in: targetIds }, organizationId: orgId },
        select: { id: true },
      });
      if (targets.length !== targetIds.length) {
        throw new TRPCError({ code: "NOT_FOUND", message: "One or more target controls not found" });
      }

      const result = await ctx.db.orgControlFrameworkMapping.createMany({
        data: targets.map((t) => ({
          id: randomUUID(),
          organizationId: orgId,
          orgControlId: input.orgControlId,
          frameworkControlId: t.id,
          mappingType: input.mappingType,
          notes: input.notes ?? null,
          createdById: ctx.session!.user.id,
        })),
        skipDuplicates: true,
      });

      if (result.count > 0) {
        void createAuditLog({
          organizationId: orgId,
          userId: ctx.session!.user.id,
          action: AuditAction.CREATE_MAPPING,
          entityType: "OrgControlFrameworkMapping",
          entityId: input.orgControlId,
          changes: {
            after: {
              orgControlId: input.orgControlId,
              frameworkControlIds: targetIds,
              mappingType: input.mappingType,
              created: result.count,
            },
          },
        });
      }

      return { created: result.count };
    }),

  /**
   * Edit an org-control mapping's relationship type / notes in place.
   */
  updateOrgControlMapping: organizationProcedure
    .use(requireRole(CROSSWALK_MANAGE_ROLES))
    .input(
      z.object({
        id: z.string().min(1),
        mappingType: z.nativeEnum(StandardMappingType).optional(),
        notes: z.string().max(500).optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.orgControlFrameworkMapping.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId! },
        select: { id: true, mappingType: true, notes: true },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Mapping not found" });
      }
      const updated = await ctx.db.orgControlFrameworkMapping.update({
        where: { id: input.id },
        data: {
          ...(input.mappingType !== undefined && { mappingType: input.mappingType }),
          ...(input.notes !== undefined && { notes: input.notes }),
        },
        select: {
          id: true,
          mappingType: true,
          notes: true,
          FrameworkControl: { select: { id: true, controlId: true, title: true } },
        },
      });
      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: AuditAction.UPDATE_MAPPING,
        entityType: "OrgControlFrameworkMapping",
        entityId: input.id,
        changes: {
          before: { mappingType: existing.mappingType, notes: existing.notes },
          after: { mappingType: updated.mappingType, notes: updated.notes },
        },
      });
      return updated;
    }),

  /**
   * Delete an org-control mapping.
   */
  deleteOrgControlMapping: organizationProcedure
    .use(requireRole(CROSSWALK_MANAGE_ROLES))
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.orgControlFrameworkMapping.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId! },
        select: { id: true },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Mapping not found" });
      }
      await ctx.db.orgControlFrameworkMapping.delete({ where: { id: input.id } });
      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: AuditAction.DELETE_MAPPING,
        entityType: "OrgControlFrameworkMapping",
        entityId: input.id,
      });
      return { success: true };
    }),

  // ===========================================================================
  // Story 26.1 — One-hop transitive suggestions
  // (org control --confirmed--> FC_a --one crosswalk--> FC_b in the target framework)
  // ===========================================================================

  /**
   * Generate SUGGESTED org-control → target-framework mappings by traversing
   * exactly one crosswalk hop from each CONFIRMED org-control mapping. Bulk
   * insert; the unique [orgControlId, frameworkControlId] key drops any pair
   * that already exists in any status (never re-proposes REJECTED — FR16).
   */
  generateSuggestions: organizationProcedure
    .use(requireRole(CROSSWALK_MANAGE_ROLES))
    .input(z.object({ targetFrameworkId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.organizationId!;
      const targetFwId = input.targetFrameworkId;

      const framework = await ctx.db.framework.findFirst({
        where: { id: targetFwId, organizationId: orgId },
        select: { id: true },
      });
      if (!framework) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Framework not found in your organization" });
      }

      // OC → FC_a legs: confirmed org mappings whose framework control is NOT in
      // the target framework (can't crosswalk into the same framework).
      const legs = await ctx.db.orgControlFrameworkMapping.findMany({
        where: {
          organizationId: orgId,
          status: MappingStatus.CONFIRMED,
          FrameworkControl: { frameworkId: { not: targetFwId } },
        },
        select: {
          id: true,
          orgControlId: true,
          frameworkControlId: true,
          mappingType: true,
          OrgControl: { select: { localControlId: true } },
          FrameworkControl: { select: { controlId: true, frameworkId: true } },
        },
        // Stable order so regeneration produces identical lineage/order.
        orderBy: [{ orgControlId: "asc" }, { frameworkControlId: "asc" }],
      });
      if (legs.length === 0) return { generated: 0, skipped: 0 };

      // Crosswalk edges touching the target framework, indexed by the NON-target
      // control id (= FC_a). type2 is oriented FC_a → FC_b (inverted for reverse edges).
      const crosswalks = await ctx.db.frameworkControlMapping.findMany({
        where: {
          organizationId: orgId,
          OR: [
            { SourceControl: { frameworkId: targetFwId } },
            { TargetControl: { frameworkId: targetFwId } },
          ],
        },
        select: {
          id: true,
          mappingType: true,
          SourceControl: { select: { id: true, controlId: true, frameworkId: true } },
          TargetControl: { select: { id: true, controlId: true, frameworkId: true } },
        },
        orderBy: { id: "asc" },
      });

      type Edge = { fcB: string; fcBControlId: string; type2: OlirType; crosswalkId: string };
      const adjacency = new Map<string, Edge[]>();
      const addEdge = (fcAId: string, edge: Edge) => {
        const list = adjacency.get(fcAId);
        if (list) list.push(edge);
        else adjacency.set(fcAId, [edge]);
      };
      for (const c of crosswalks) {
        const s = c.SourceControl;
        const t = c.TargetControl;
        const type = c.mappingType as OlirType;
        if (t.frameworkId === targetFwId && s.frameworkId !== targetFwId) {
          // forward: FC_a = source, FC_b = target
          addEdge(s.id, { fcB: t.id, fcBControlId: t.controlId, type2: type, crosswalkId: c.id });
        } else if (s.frameworkId === targetFwId && t.frameworkId !== targetFwId) {
          // reverse: FC_a = target, FC_b = source; traverse the edge backwards
          addEdge(t.id, {
            fcB: s.id,
            fcBControlId: s.controlId,
            type2: invertMappingType(type),
            crosswalkId: c.id,
          });
        }
        // both-in-target (shouldn't happen) → skip
      }

      // Derive candidates; keep the highest-confidence chain per (orgControl, FC_b).
      type Candidate = {
        orgControlId: string;
        frameworkControlId: string;
        mappingType: OlirType;
        confidence: number;
        derivedVia: { orgMappingId: string; crosswalkId: string; chain: string };
      };
      const best = new Map<string, Candidate>();
      for (const leg of legs) {
        const edges = adjacency.get(leg.frameworkControlId);
        if (!edges) continue;
        const type1 = leg.mappingType as OlirType;
        for (const e of edges) {
          if (e.fcB === leg.frameworkControlId) continue;
          const { type: mappingType, confidence } = deriveSuggestion(type1, e.type2);
          const key = `${leg.orgControlId}:${e.fcB}`;
          const prev = best.get(key);
          const cand: Candidate = {
            orgControlId: leg.orgControlId,
            frameworkControlId: e.fcB,
            mappingType,
            confidence,
            derivedVia: {
              orgMappingId: leg.id,
              crosswalkId: e.crosswalkId,
              chain: `${leg.OrgControl.localControlId} → ${leg.FrameworkControl.controlId} → ${e.fcBControlId}`,
            },
          };
          if (!prev || confidence > prev.confidence) {
            best.set(key, cand);
          } else if (
            confidence === prev.confidence &&
            mappingType !== prev.mappingType &&
            prev.mappingType !== "INTERSECTS"
          ) {
            // Two equally-strong chains disagree on direction (e.g. SUBSET vs
            // SUPERSET). Contradictory evidence → the honest, deterministic
            // merge is INTERSECTS, capped at the observed-overlap confidence.
            best.set(key, {
              ...prev,
              mappingType: "INTERSECTS",
              confidence: Math.min(prev.confidence, 60),
            });
          }
        }
      }

      const candidates = Array.from(best.values());
      if (candidates.length === 0) return { generated: 0, skipped: 0 };

      const result = await ctx.db.orgControlFrameworkMapping.createMany({
        data: candidates.map((c) => ({
          id: randomUUID(),
          organizationId: orgId,
          orgControlId: c.orgControlId,
          frameworkControlId: c.frameworkControlId,
          mappingType: c.mappingType as StandardMappingType,
          status: MappingStatus.SUGGESTED,
          confidence: c.confidence,
          derivedVia: c.derivedVia as Prisma.InputJsonValue,
          createdById: ctx.session!.user.id,
        })),
        skipDuplicates: true,
      });

      if (result.count > 0) {
        void createAuditLog({
          organizationId: orgId,
          userId: ctx.session!.user.id,
          action: AuditAction.CREATE_MAPPING,
          entityType: "OrgControlFrameworkMapping",
          entityId: targetFwId,
          changes: { after: { targetFrameworkId: targetFwId, generated: result.count, kind: "SUGGESTED" } },
        });
      }

      return { generated: result.count, skipped: candidates.length - result.count };
    }),

  /**
   * List org-control mappings into a target framework by status (default
   * SUGGESTED) — backs the Story 26.2 review UI.
   */
  listSuggestions: organizationProcedure
    .use(requireRole(CROSSWALK_VIEW_ROLES))
    .input(
      z.object({
        targetFrameworkId: z.string().min(1),
        status: z.nativeEnum(MappingStatus).default(MappingStatus.SUGGESTED),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.orgControlFrameworkMapping.findMany({
        where: {
          organizationId: ctx.organizationId!,
          status: input.status,
          FrameworkControl: { frameworkId: input.targetFrameworkId },
        },
        select: {
          id: true,
          status: true,
          confidence: true,
          mappingType: true,
          notes: true,
          derivedVia: true,
          OrgControl: { select: { id: true, localControlId: true, name: true } },
          FrameworkControl: { select: { id: true, controlId: true, title: true } },
        },
        orderBy: [{ confidence: "desc" }, { createdAt: "desc" }],
      });
    }),

  // ===========================================================================
  // Story 26.2 — Review: promote (confirm) or reject suggestions
  // NFR5: SUGGESTED → CONFIRMED happens ONLY here, on an explicit human action.
  // ===========================================================================

  /**
   * Promote a SUGGESTED mapping to CONFIRMED, recording the reviewer and
   * optionally adjusting the relationship type / adding rationale.
   */
  confirmSuggestion: organizationProcedure
    .use(requireRole(CROSSWALK_MANAGE_ROLES))
    .input(
      z.object({
        id: z.string().min(1),
        mappingType: z.nativeEnum(StandardMappingType).optional(),
        notes: z.string().max(500).optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.orgControlFrameworkMapping.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId! },
        select: { id: true, status: true, mappingType: true },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Mapping not found" });
      }
      if (existing.status !== MappingStatus.SUGGESTED) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only a suggested mapping can be confirmed" });
      }
      const updated = await ctx.db.orgControlFrameworkMapping.update({
        where: { id: input.id },
        data: {
          status: MappingStatus.CONFIRMED,
          reviewedById: ctx.session!.user.id,
          reviewedAt: new Date(),
          ...(input.mappingType !== undefined && { mappingType: input.mappingType }),
          ...(input.notes !== undefined && { notes: input.notes }),
        },
        select: { id: true, status: true, mappingType: true },
      });
      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: AuditAction.UPDATE_MAPPING,
        entityType: "OrgControlFrameworkMapping",
        entityId: input.id,
        changes: { before: { status: "SUGGESTED" }, after: { status: "CONFIRMED", mappingType: updated.mappingType } },
      });
      return updated;
    }),

  /**
   * Reject a SUGGESTED mapping. Status → REJECTED; the row is RETAINED so the
   * unique key blocks re-proposal (FR16). Records the reviewer.
   */
  rejectSuggestion: organizationProcedure
    .use(requireRole(CROSSWALK_MANAGE_ROLES))
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.orgControlFrameworkMapping.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId! },
        select: { id: true, status: true },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Mapping not found" });
      }
      if (existing.status !== MappingStatus.SUGGESTED) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only a suggested mapping can be rejected" });
      }
      await ctx.db.orgControlFrameworkMapping.update({
        where: { id: input.id },
        data: {
          status: MappingStatus.REJECTED,
          reviewedById: ctx.session!.user.id,
          reviewedAt: new Date(),
        },
      });
      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: AuditAction.UPDATE_MAPPING,
        entityType: "OrgControlFrameworkMapping",
        entityId: input.id,
        changes: { before: { status: "SUGGESTED" }, after: { status: "REJECTED" } },
      });
      return { success: true };
    }),

  /**
   * Bulk confirm or reject a set of suggestions. Transitions only the org-scoped
   * SUGGESTED rows in the set (others are silently ignored). One audit summary.
   */
  bulkReviewSuggestions: organizationProcedure
    .use(requireRole(CROSSWALK_MANAGE_ROLES))
    .input(
      z.object({
        ids: z.array(z.string().min(1)).min(1).max(500),
        action: z.enum(["CONFIRM", "REJECT"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.organizationId!;
      const userId = ctx.session!.user.id;
      const nextStatus = input.action === "CONFIRM" ? MappingStatus.CONFIRMED : MappingStatus.REJECTED;

      // Capture exactly which pending suggestions we transition, so we can write
      // a per-mapping audit trail (AC4), not just a summary.
      const affected = await ctx.db.orgControlFrameworkMapping.findMany({
        where: { id: { in: input.ids }, organizationId: orgId, status: MappingStatus.SUGGESTED },
        select: { id: true },
      });
      if (affected.length === 0) return { updated: 0 };

      const affectedIds = affected.map((m) => m.id);
      await ctx.db.orgControlFrameworkMapping.updateMany({
        where: { id: { in: affectedIds }, organizationId: orgId, status: MappingStatus.SUGGESTED },
        data: { status: nextStatus, reviewedById: userId, reviewedAt: new Date() },
      });

      for (const id of affectedIds) {
        void createAuditLog({
          organizationId: orgId,
          userId,
          action: AuditAction.UPDATE_MAPPING,
          entityType: "OrgControlFrameworkMapping",
          entityId: id,
          changes: { before: { status: "SUGGESTED" }, after: { status: nextStatus } },
        });
      }
      return { updated: affectedIds.length };
    }),

  // ===========================================================================
  // Story 26.3 — Per-family coverage of a framework by org controls
  // ===========================================================================

  /**
   * Per-family coverage of a target framework by the org's custom controls.
   * Each framework control is classed by its strongest org-control mapping:
   * CONFIRMED > SUGGESTED > unmapped (REJECTED-only counts as unmapped).
   * Server-side aggregate (NFR1).
   */
  getFrameworkCoverage: organizationProcedure
    .use(requireRole(CROSSWALK_VIEW_ROLES))
    .input(z.object({ targetFrameworkId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.organizationId!;
      const framework = await ctx.db.framework.findFirst({
        where: { id: input.targetFrameworkId, organizationId: orgId },
        select: { id: true, name: true, code: true },
      });
      if (!framework) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Framework not found in your organization" });
      }

      const cov = await loadCoverage(ctx.db, orgId, input.targetFrameworkId);

      type Fam = {
        familyId: string;
        controlId: string;
        title: string;
        total: number;
        confirmed: number;
        suggested: number;
        unmapped: number;
      };
      const famAgg = new Map<string, Fam>();
      let confirmed = 0;
      let suggested = 0;
      for (const c of cov.controls) {
        const fid = cov.rootIdByControl.get(c.id)!;
        let fam = famAgg.get(fid);
        if (!fam) {
          const meta = cov.familyMeta.get(fid)!;
          fam = { familyId: fid, controlId: meta.controlId, title: meta.title, total: 0, confirmed: 0, suggested: 0, unmapped: 0 };
          famAgg.set(fid, fam);
        }
        fam.total++;
        const st = cov.statusByControl.get(c.id);
        if (st === "CONFIRMED") {
          fam.confirmed++;
          confirmed++;
        } else if (st === "SUGGESTED") {
          fam.suggested++;
          suggested++;
        } else {
          fam.unmapped++;
        }
      }

      const families = Array.from(famAgg.values()).sort((a, b) =>
        a.controlId.localeCompare(b.controlId),
      );
      const total = cov.controls.length;
      const unmapped = total - confirmed - suggested;

      return {
        framework,
        overall: {
          total,
          confirmed,
          suggested,
          unmapped,
          confirmedPct: total > 0 ? Math.round((confirmed / total) * 100) : 0,
        },
        families,
      };
    }),

  /**
   * The controls in one family with a given coverage status — for drill-down.
   */
  listFamilyControlsByStatus: organizationProcedure
    .use(requireRole(CROSSWALK_VIEW_ROLES))
    .input(
      z.object({
        targetFrameworkId: z.string().min(1),
        familyId: z.string().min(1),
        status: z.enum(["CONFIRMED", "SUGGESTED", "UNMAPPED"]),
      }),
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.organizationId!;
      const cov = await loadCoverage(ctx.db, orgId, input.targetFrameworkId);
      return cov.controls
        .filter((c) => cov.rootIdByControl.get(c.id) === input.familyId)
        .filter((c) => {
          const st = cov.statusByControl.get(c.id);
          if (input.status === "CONFIRMED") return st === "CONFIRMED";
          if (input.status === "SUGGESTED") return st === "SUGGESTED";
          return !st; // UNMAPPED
        })
        .map((c) => ({ id: c.id, controlId: c.controlId, title: c.title }));
    }),

  // ===========================================================================
  // Story 26.4 — Export the crosswalk as an audit deliverable (CSV / XLSX)
  // ===========================================================================

  /**
   * Export the org-control → target-framework crosswalk with full lifecycle
   * columns (status, confidence, lineage, reviewer). `scope: "complete"` also
   * emits an explicit "(no mapping)" row per uncovered framework control (AC3).
   */
  exportOrgControlCrosswalk: organizationProcedure
    .use(requireRole(CROSSWALK_VIEW_ROLES))
    .input(
      z.object({
        targetFrameworkId: z.string().min(1),
        format: z.enum(["csv", "xlsx"]),
        statuses: z.array(z.nativeEnum(MappingStatus)).optional(),
        scope: z.enum(["filtered", "complete"]).default("complete"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.organizationId!;
      const framework = await ctx.db.framework.findFirst({
        where: { id: input.targetFrameworkId, organizationId: orgId },
        select: { id: true, code: true },
      });
      if (!framework) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Framework not found in your organization" });
      }

      const cov = await loadCoverage(ctx.db, orgId, input.targetFrameworkId);
      const familyOf = (controlDbId: string) => {
        const rootId = cov.rootIdByControl.get(controlDbId);
        return rootId ? (cov.familyMeta.get(rootId)?.controlId ?? "") : "";
      };

      const mappings = await ctx.db.orgControlFrameworkMapping.findMany({
        where: {
          organizationId: orgId,
          FrameworkControl: { frameworkId: input.targetFrameworkId },
          ...(input.statuses && input.statuses.length > 0 ? { status: { in: input.statuses } } : {}),
        },
        select: {
          mappingType: true,
          status: true,
          confidence: true,
          notes: true,
          derivedVia: true,
          reviewedAt: true,
          frameworkControlId: true,
          OrgControl: { select: { localControlId: true, name: true } },
          FrameworkControl: { select: { id: true, controlId: true, title: true } },
          ReviewedBy: { select: { name: true, email: true } },
        },
        orderBy: [{ FrameworkControl: { controlId: "asc" } }],
      });

      const headers = [
        "Org Control ID",
        "Org Control",
        "Framework Control ID",
        "Framework Control",
        "Family",
        "Relationship",
        "Rationale",
        "Status",
        "Confidence",
        "Lineage",
        "Reviewed By",
        "Reviewed At",
      ];

      const rows: string[][] = mappings.map((m) => {
        const chain = (m.derivedVia as { chain?: string } | null)?.chain;
        const reviewer = m.ReviewedBy ? (m.ReviewedBy.name ?? m.ReviewedBy.email ?? "") : "";
        return [
          m.OrgControl.localControlId,
          m.OrgControl.name,
          m.FrameworkControl.controlId,
          m.FrameworkControl.title,
          familyOf(m.FrameworkControl.id),
          OLIR_EXPORT_LABEL[m.mappingType] ?? m.mappingType,
          m.notes ?? "",
          m.status,
          String(m.confidence),
          chain ? chain : "manual",
          reviewer,
          m.reviewedAt ? m.reviewedAt.toISOString() : "",
        ];
      });

      if (input.scope === "complete") {
        // "(no mapping)" must mean no mapping of ANY status — otherwise a
        // status-filtered export (e.g. CONFIRMED only) would mislabel a control
        // that actually has a SUGGESTED/REJECTED mapping as unmapped.
        const anyMapped = await ctx.db.orgControlFrameworkMapping.findMany({
          where: { organizationId: orgId, FrameworkControl: { frameworkId: input.targetFrameworkId } },
          select: { frameworkControlId: true },
        });
        const mappedTargetIds = new Set(anyMapped.map((m) => m.frameworkControlId));
        for (const c of cov.controls) {
          if (mappedTargetIds.has(c.id)) continue;
          rows.push([
            "",
            "",
            c.controlId,
            c.title,
            familyOf(c.id),
            "(no mapping)",
            "",
            "",
            "",
            "",
            "",
            "",
          ]);
        }
      }

      const file = buildExportFile(input.format as ExportFormat, headers, rows);
      return {
        filename: `crosswalk-${framework.code}-org-controls.${input.format}`,
        ...file,
      };
    }),

  /**
   * Export a framework-pair crosswalk (relationship + rationale + confidence).
   * Framework-pair mappings have no status/lineage/reviewer, so those columns
   * are omitted. `scope: "complete"` emits "(no mapping)" rows for uncovered
   * source controls.
   */
  exportFrameworkCrosswalk: organizationProcedure
    .use(requireRole(CROSSWALK_VIEW_ROLES))
    .input(
      z.object({
        sourceFrameworkId: z.string().min(1),
        targetFrameworkId: z.string().min(1),
        format: z.enum(["csv", "xlsx"]),
        scope: z.enum(["filtered", "complete"]).default("complete"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.organizationId!;
      const [source, target] = await Promise.all([
        ctx.db.framework.findFirst({ where: { id: input.sourceFrameworkId, organizationId: orgId }, select: { id: true, code: true } }),
        ctx.db.framework.findFirst({ where: { id: input.targetFrameworkId, organizationId: orgId }, select: { id: true, code: true } }),
      ]);
      if (!source || !target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Framework not found in your organization" });
      }

      const mappings = await ctx.db.frameworkControlMapping.findMany({
        where: {
          organizationId: orgId,
          SourceControl: { frameworkId: input.sourceFrameworkId },
          TargetControl: { frameworkId: input.targetFrameworkId },
        },
        select: {
          mappingType: true,
          confidence: true,
          notes: true,
          sourceControlId: true,
          SourceControl: { select: { controlId: true, title: true } },
          TargetControl: { select: { controlId: true, title: true } },
        },
        orderBy: [{ SourceControl: { controlId: "asc" } }],
      });

      const headers = [
        "Source Control ID",
        "Source Control",
        "Target Control ID",
        "Target Control",
        "Relationship",
        "Rationale",
        "Confidence",
      ];
      const rows: string[][] = mappings.map((m) => [
        m.SourceControl.controlId,
        m.SourceControl.title,
        m.TargetControl.controlId,
        m.TargetControl.title,
        OLIR_EXPORT_LABEL[m.mappingType] ?? m.mappingType,
        m.notes ?? "",
        String(m.confidence),
      ]);

      if (input.scope === "complete") {
        const mappedSourceIds = new Set(mappings.map((m) => m.sourceControlId));
        const sourceControls = await ctx.db.control.findMany({
          where: { frameworkId: input.sourceFrameworkId, organizationId: orgId },
          select: { id: true, controlId: true, title: true },
          orderBy: { controlId: "asc" },
        });
        for (const c of sourceControls) {
          if (mappedSourceIds.has(c.id)) continue;
          rows.push([c.controlId, c.title, "", "", "(no mapping)", "", ""]);
        }
      }

      const file = buildExportFile(input.format as ExportFormat, headers, rows);
      return {
        filename: `crosswalk-${source.code}-to-${target.code}.${input.format}`,
        ...file,
      };
    }),
});
