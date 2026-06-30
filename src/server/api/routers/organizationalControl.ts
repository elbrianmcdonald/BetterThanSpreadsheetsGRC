/**
 * Organizational Control tRPC Router
 *
 * Manages organization-owned controls operated by the GRC program. Supports:
 * - Full-field CRUD (identification, classification, implementation, cadence, lifecycle)
 * - Many-to-many crosswalk to framework library controls via OrgControlFrameworkMapping
 * - RACI ownership (owner/operator/reviewer) via OrgControlAssignment
 * - Linkage to risks via MITIGATES graph edges (Control→Risk)
 *
 * Sub-Epic B.1 + B.2 (tech-spec: docs/sprint-artifacts/tech-spec-org-controls-redesign.md)
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { randomUUID } from "crypto";
import {
  AuditAction,
  ControlType,
  ControlNature,
  AutomationLevel,
  ControlFrequency,
  OrgControlStatus,
  AssignmentRole,
  RiskOrgControlRole,
  StandardMappingType,
  EvidenceArtifactType,
  Prisma,
} from "@prisma/client";
import { createTRPCRouter, organizationProcedure } from "@/server/api/trpc";
import { graphService } from "@/server/graph/graph-service";

const ALLOWED_MUTATION_ROLES = ["ORG_ADMIN", "GRC_ANALYST", "SECURITY_ENGINEER"];

function assertMutationAllowed(role: string | undefined, action: string): void {
  if (!role || !ALLOWED_MUTATION_ROLES.includes(role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `You don't have permission to ${action} controls`,
    });
  }
}

function generateLocalControlId(): string {
  return "OC-" + Date.now().toString(36).toUpperCase();
}

const frameworkMappingInput = z.object({
  frameworkControlId: z.string(),
  mappingType: z.nativeEnum(StandardMappingType).default(StandardMappingType.COVERS),
  notes: z.string().max(500).optional(),
});

const assignmentInput = z.object({
  personId: z.string(),
  role: z.nativeEnum(AssignmentRole),
});

const evidenceRequirementInput = z.object({
  description: z.string().min(1).max(5000),
  artifactType: z.nativeEnum(EvidenceArtifactType),
  required: z.boolean().default(true),
  ownerId: z.string().optional().nullable(),
});

// Full-field input used by create and update
const controlFieldsInput = z.object({
  localControlId: z.string().min(1).max(50).optional(),
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(5000).optional().nullable(),
  objective: z.string().max(5000).optional().nullable(),
  family: z.string().max(100).optional().nullable(),
  controlType: z.nativeEnum(ControlType).default(ControlType.PREVENTIVE),
  nature: z.nativeEnum(ControlNature).optional().nullable(),
  automationLevel: z.nativeEnum(AutomationLevel).optional().nullable(),
  status: z.nativeEnum(OrgControlStatus).default(OrgControlStatus.NOT_IMPLEMENTED),
  implementationNarrative: z.string().max(10000).optional().nullable(),
  scope: z.string().max(5000).optional().nullable(),
  frequency: z.nativeEnum(ControlFrequency).optional().nullable(),
  procedureRunbookLink: z.string().url().max(500).optional().nullable(),
  reviewCycleMonths: z.number().int().min(1).max(120).optional().nullable(),
  retirementDate: z.date().optional().nullable(),
  frameworkMappings: z.array(frameworkMappingInput).optional(),
  assignments: z.array(assignmentInput).optional(),
  evidenceRequirements: z.array(evidenceRequirementInput).optional(),
});

export const organizationalControlRouter = createTRPCRouter({
  /**
   * List organizational controls with filters and junction counts
   */
  list: organizationProcedure
    .input(
      z.object({
        search: z.string().optional(),
        status: z.nativeEnum(OrgControlStatus).optional(),
        controlType: z.nativeEnum(ControlType).optional(),
        nature: z.nativeEnum(ControlNature).optional(),
        automationLevel: z.nativeEnum(AutomationLevel).optional(),
        family: z.string().optional(),
        ownerId: z.string().optional(),
        overdueTestsOnly: z.boolean().optional(),
        hideDeprecated: z.boolean().optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const controls = await ctx.db.organizationalControl.findMany({
        where: {
          organizationId: ctx.organizationId!,
          ...(input.status
            ? { status: input.status }
            : input.hideDeprecated
              ? { status: { not: OrgControlStatus.DEPRECATED } }
              : {}),
          ...(input.controlType && { controlType: input.controlType }),
          ...(input.nature && { nature: input.nature }),
          ...(input.automationLevel && { automationLevel: input.automationLevel }),
          ...(input.family && { family: { equals: input.family, mode: "insensitive" } }),
          ...(input.ownerId && {
            Assignments: {
              some: { personId: input.ownerId, role: AssignmentRole.OWNER },
            },
          }),
          ...(input.overdueTestsOnly && {
            nextTestDueDate: { lt: now },
            status: { not: OrgControlStatus.DEPRECATED },
          }),
          ...(input.search && {
            OR: [
              { name: { contains: input.search, mode: "insensitive" } },
              { localControlId: { contains: input.search, mode: "insensitive" } },
              { description: { contains: input.search, mode: "insensitive" } },
            ],
          }),
        },
        include: {
          Assignments: {
            where: { role: AssignmentRole.OWNER },
            select: {
              id: true,
              role: true,
              Person: { select: { id: true, name: true, email: true, jobTitle: true } },
            },
          },
          _count: {
            select: {
              FrameworkMappings: true,
              Assignments: true,
              Deficiencies: true,
              Exceptions: true,
            },
          },
        },
        orderBy: [{ localControlId: "asc" }, { name: "asc" }],
        take: input.limit + 1,
        ...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
      });

      let nextCursor: string | undefined;
      if (controls.length > input.limit) {
        const nextItem = controls.pop();
        nextCursor = nextItem?.id;
      }

      // Inject MITIGATES edge counts back as _count.RiskLinks (preserves UI shape)
      const linkCounts = await graphService.countOutEdgesByEntities({
        type: "MITIGATES",
        fromType: "Control",
        entityIds: controls.map((c) => c.id),
        organizationId: ctx.organizationId!,
      });
      const controlsWithCounts = controls.map((c) => ({
        ...c,
        _count: { ...c._count, RiskLinks: linkCounts.get(c.id) ?? 0 },
      }));

      return { controls: controlsWithCounts, nextCursor };
    }),

  /**
   * Search controls by name for autocomplete (inline risk linking)
   */
  search: organizationProcedure
    .input(
      z.object({
        query: z.string().min(1),
        limit: z.number().min(1).max(20).default(10),
        excludeIds: z.array(z.string()).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.organizationalControl.findMany({
        where: {
          organizationId: ctx.organizationId!,
          status: { not: OrgControlStatus.DEPRECATED },
          OR: [
            { name: { contains: input.query, mode: "insensitive" } },
            { localControlId: { contains: input.query, mode: "insensitive" } },
          ],
          ...(input.excludeIds?.length && { id: { notIn: input.excludeIds } }),
        },
        orderBy: { name: "asc" },
        take: input.limit,
      });
    }),

  /**
   * List controls whose next test is overdue. Used by dashboard widget.
   */
  overdueTests: organizationProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const controls = await ctx.db.organizationalControl.findMany({
        where: {
          organizationId: ctx.organizationId!,
          nextTestDueDate: { lt: now },
          status: { not: OrgControlStatus.DEPRECATED },
        },
        orderBy: { nextTestDueDate: "asc" },
        take: input.limit,
        select: {
          id: true,
          localControlId: true,
          name: true,
          status: true,
          controlType: true,
          lastTestedDate: true,
          nextTestDueDate: true,
          lastTestResult: true,
        },
      });

      const total = await ctx.db.organizationalControl.count({
        where: {
          organizationId: ctx.organizationId!,
          nextTestDueDate: { lt: now },
          status: { not: OrgControlStatus.DEPRECATED },
        },
      });

      return { controls, total };
    }),

  /**
   * Get distinct family values (for autocomplete in forms)
   */
  distinctFamilies: organizationProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.organizationalControl.findMany({
      where: {
        organizationId: ctx.organizationId!,
        family: { not: null },
      },
      select: { family: true },
      distinct: ["family"],
      orderBy: { family: "asc" },
    });
    return rows.map((r) => r.family).filter((f): f is string => f !== null);
  }),

  /**
   * Get one control with all relations (detail view)
   */
  getById: organizationProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const control = await ctx.db.organizationalControl.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId!,
        },
        include: {
          CreatedBy: { select: { id: true, name: true, email: true } },
          FrameworkMappings: {
            include: {
              FrameworkControl: {
                select: {
                  id: true,
                  controlId: true,
                  title: true,
                  Framework: { select: { id: true, code: true, name: true } },
                },
              },
            },
          },
          Assignments: {
            include: {
              Person: { select: { id: true, name: true, email: true, jobTitle: true } },
            },
            orderBy: [{ role: "asc" }, { assignedAt: "desc" }],
          },
          EvidenceRequirements: true,
          TestRecords: {
            take: 5,
            orderBy: { testedAt: "desc" },
            include: { TestedBy: { select: { id: true, name: true } } },
          },
          _count: {
            select: {
              FrameworkMappings: true,
              Assignments: true,
              EvidenceRequirements: true,
              EvidenceLinks: true,
              TestRecords: true,
              Deficiencies: true,
              Exceptions: true,
              DependenciesFrom: true,
              DependenciesTo: true,
              linkedObjectives: true,
            },
          },
        },
      });

      if (!control) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Control not found" });
      }

      // Inject MITIGATES edge count back as _count.RiskLinks (preserves UI shape)
      const riskLinks = (
        await graphService.listOutEdges({
          type: "MITIGATES",
          from: { type: "Control", id: input.id },
          organizationId: ctx.organizationId!,
        })
      ).length;
      const result = { ...control, _count: { ...control._count, RiskLinks: riskLinks } };

      return result;
    }),

  /**
   * Quick create - minimal fields, used inline from risk editor
   */
  quickCreate: organizationProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required").max(200),
        controlType: z.nativeEnum(ControlType).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertMutationAllowed(ctx.session?.user.role, "create");

      const existing = await ctx.db.organizationalControl.findFirst({
        where: {
          organizationId: ctx.organizationId!,
          name: { equals: input.name, mode: "insensitive" },
        },
      });

      if (existing) {
        return { ...existing, created: false };
      }

      const newControl = await ctx.db.organizationalControl.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          localControlId: generateLocalControlId(),
          name: input.name,
          controlType: input.controlType ?? ControlType.PREVENTIVE,
          status: OrgControlStatus.NOT_IMPLEMENTED,
          createdById: ctx.session!.user.id,
        },
      });

      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          userId: ctx.session!.user.id,
          action: AuditAction.CREATE_CONTROL,
          entityType: "OrganizationalControl",
          entityId: newControl.id,
          changes: { action: "QUICK_CREATE", name: input.name, controlType: input.controlType },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });

      return { ...newControl, created: true };
    }),

  /**
   * Full create with all fields + framework mappings + assignments
   */
  create: organizationProcedure
    .input(controlFieldsInput)
    .mutation(async ({ ctx, input }) => {
      assertMutationAllowed(ctx.session?.user.role, "create");

      const localControlId = input.localControlId ?? generateLocalControlId();

      // Duplicate checks
      const nameConflict = await ctx.db.organizationalControl.findFirst({
        where: {
          organizationId: ctx.organizationId!,
          name: { equals: input.name, mode: "insensitive" },
        },
      });
      if (nameConflict) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A control with this name already exists",
        });
      }

      const localIdConflict = await ctx.db.organizationalControl.findFirst({
        where: {
          organizationId: ctx.organizationId!,
          localControlId: { equals: localControlId, mode: "insensitive" },
        },
      });
      if (localIdConflict) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `A control with ID "${localControlId}" already exists`,
        });
      }

      const userId = ctx.session!.user.id;
      const organizationId = ctx.organizationId!;

      // Transactional create: control + junctions
      const newControl = await ctx.db.$transaction(async (tx) => {
        const created = await tx.organizationalControl.create({
          data: {
            id: randomUUID(),
            organizationId,
            localControlId,
            name: input.name,
            description: input.description ?? null,
            objective: input.objective ?? null,
            family: input.family ?? null,
            controlType: input.controlType,
            nature: input.nature ?? null,
            automationLevel: input.automationLevel ?? null,
            status: input.status,
            implementationNarrative: input.implementationNarrative ?? null,
            scope: input.scope ?? null,
            frequency: input.frequency ?? null,
            procedureRunbookLink: input.procedureRunbookLink ?? null,
            reviewCycleMonths: input.reviewCycleMonths ?? null,
            retirementDate: input.retirementDate ?? null,
            createdById: userId,
          },
        });

        if (input.frameworkMappings?.length) {
          await tx.orgControlFrameworkMapping.createMany({
            data: input.frameworkMappings.map((m) => ({
              id: randomUUID(),
              organizationId,
              orgControlId: created.id,
              frameworkControlId: m.frameworkControlId,
              mappingType: m.mappingType,
              notes: m.notes ?? null,
              createdById: userId,
            })),
            skipDuplicates: true,
          });
        }

        if (input.assignments?.length) {
          await tx.orgControlAssignment.createMany({
            data: input.assignments.map((a) => ({
              id: randomUUID(),
              organizationId,
              orgControlId: created.id,
              personId: a.personId,
              role: a.role,
              assignedById: userId,
            })),
            skipDuplicates: true,
          });
        }

        if (input.evidenceRequirements?.length) {
          await tx.orgControlEvidenceRequirement.createMany({
            data: input.evidenceRequirements.map((r) => ({
              id: randomUUID(),
              organizationId,
              orgControlId: created.id,
              description: r.description,
              artifactType: r.artifactType,
              required: r.required,
              ownerId: r.ownerId ?? null,
            })),
          });
        }

        return created;
      });

      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId,
          userId,
          action: AuditAction.CREATE_CONTROL,
          entityType: "OrganizationalControl",
          entityId: newControl.id,
          changes: {
            action: "CREATE",
            after: {
              localControlId: newControl.localControlId,
              name: newControl.name,
              controlType: newControl.controlType,
              status: newControl.status,
              nature: newControl.nature,
              automationLevel: newControl.automationLevel,
              frameworkMappingCount: input.frameworkMappings?.length ?? 0,
              assignmentCount: input.assignments?.length ?? 0,
            },
          },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });

      return newControl;
    }),

  /**
   * Bulk create from Excel. All-or-nothing: any duplicate (within batch or
   * against existing org data) aborts the entire import.
   */
  bulkCreate: organizationProcedure
    .input(
      z.object({
        controls: z
          .array(
            z.object({
              localControlId: z.string().min(1).max(50).optional(),
              name: z.string().min(1).max(200),
              description: z.string().max(5000).optional().nullable(),
              objective: z.string().max(5000).optional().nullable(),
              family: z.string().max(100).optional().nullable(),
              controlType: z.nativeEnum(ControlType),
              nature: z.nativeEnum(ControlNature).optional().nullable(),
              status: z.nativeEnum(OrgControlStatus),
              implementationNarrative: z.string().max(10000).optional().nullable(),
              scope: z.string().max(5000).optional().nullable(),
              frequency: z.nativeEnum(ControlFrequency).optional().nullable(),
            })
          )
          .min(1)
          .max(1000),
        defaultOwnerId: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertMutationAllowed(ctx.session?.user.role, "create");

      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      // Assign local IDs up front (used both for conflict checks and insert)
      const prepared = input.controls.map((c) => ({
        ...c,
        localControlId: c.localControlId ?? generateLocalControlId(),
      }));

      const conflicts: string[] = [];

      // Conflict check: names against existing org data
      const existingByName = await ctx.db.organizationalControl.findMany({
        where: {
          organizationId,
          name: { in: prepared.map((c) => c.name), mode: "insensitive" },
        },
        select: { name: true },
      });
      const existingNames = new Set(existingByName.map((r) => r.name.toLowerCase()));
      for (const c of prepared) {
        if (existingNames.has(c.name.toLowerCase())) {
          conflicts.push(`Name "${c.name}" already exists in the organization`);
        }
      }

      // Conflict check: local IDs against existing org data
      const existingByLocalId = await ctx.db.organizationalControl.findMany({
        where: {
          organizationId,
          localControlId: {
            in: prepared.map((c) => c.localControlId),
            mode: "insensitive",
          },
        },
        select: { localControlId: true },
      });
      const existingLocalIds = new Set(
        existingByLocalId.map((r) => r.localControlId.toLowerCase())
      );
      for (const c of prepared) {
        if (existingLocalIds.has(c.localControlId.toLowerCase())) {
          conflicts.push(
            `Local control ID "${c.localControlId}" already exists in the organization`
          );
        }
      }

      // Verify default owner exists in this org (if provided)
      if (input.defaultOwnerId) {
        const owner = await ctx.db.person.findFirst({
          where: { id: input.defaultOwnerId, organizationId },
          select: { id: true },
        });
        if (!owner) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Default owner not found in this organization",
          });
        }
      }

      if (conflicts.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Import blocked — ${conflicts.length} conflict${conflicts.length === 1 ? "" : "s"}:\n${conflicts.slice(0, 10).join("\n")}${conflicts.length > 10 ? `\n…and ${conflicts.length - 10} more` : ""}`,
        });
      }

      const created = await ctx.db.$transaction(async (tx) => {
        const rows = prepared.map((c) => ({
          id: randomUUID(),
          organizationId,
          localControlId: c.localControlId,
          name: c.name,
          description: c.description ?? null,
          objective: c.objective ?? null,
          family: c.family ?? null,
          controlType: c.controlType,
          nature: c.nature ?? null,
          status: c.status,
          implementationNarrative: c.implementationNarrative ?? null,
          scope: c.scope ?? null,
          frequency: c.frequency ?? null,
          createdById: userId,
        }));

        await tx.organizationalControl.createMany({ data: rows });

        if (input.defaultOwnerId) {
          await tx.orgControlAssignment.createMany({
            data: rows.map((r) => ({
              id: randomUUID(),
              organizationId,
              orgControlId: r.id,
              personId: input.defaultOwnerId!,
              role: AssignmentRole.OWNER,
              assignedById: userId,
            })),
            skipDuplicates: true,
          });
        }

        return rows;
      });

      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId,
          userId,
          action: AuditAction.CREATE_CONTROL,
          entityType: "OrganizationalControl",
          entityId: created[0]?.id ?? "bulk",
          changes: {
            action: "BULK_IMPORT",
            count: created.length,
            defaultOwnerId: input.defaultOwnerId ?? null,
            localControlIds: created.map((c) => c.localControlId),
          },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });

      return { count: created.length, ids: created.map((c) => c.id) };
    }),

  /**
   * Full update with all fields + junction replacement
   */
  update: organizationProcedure
    .input(
      z.object({
        id: z.string(),
        data: controlFieldsInput.partial().extend({
          // Keep name non-optional inside partial quirks only when provided
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertMutationAllowed(ctx.session?.user.role, "update");

      const existing = await ctx.db.organizationalControl.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId! },
      });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Control not found" });
      }

      const data = input.data;

      // Duplicate name check
      if (data.name && data.name !== existing.name) {
        const dup = await ctx.db.organizationalControl.findFirst({
          where: {
            organizationId: ctx.organizationId!,
            name: { equals: data.name, mode: "insensitive" },
            id: { not: input.id },
          },
        });
        if (dup) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A control with this name already exists",
          });
        }
      }

      // Duplicate localControlId check
      if (data.localControlId && data.localControlId !== existing.localControlId) {
        const dup = await ctx.db.organizationalControl.findFirst({
          where: {
            organizationId: ctx.organizationId!,
            localControlId: { equals: data.localControlId, mode: "insensitive" },
            id: { not: input.id },
          },
        });
        if (dup) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `A control with ID "${data.localControlId}" already exists`,
          });
        }
      }

      const userId = ctx.session!.user.id;
      const organizationId = ctx.organizationId!;

      const updated = await ctx.db.$transaction(async (tx) => {
        const updateData: Prisma.OrganizationalControlUpdateInput = {};
        if (data.localControlId !== undefined) updateData.localControlId = data.localControlId;
        if (data.name !== undefined) updateData.name = data.name;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.objective !== undefined) updateData.objective = data.objective;
        if (data.family !== undefined) updateData.family = data.family;
        if (data.controlType !== undefined) updateData.controlType = data.controlType;
        if (data.nature !== undefined) updateData.nature = data.nature;
        if (data.automationLevel !== undefined) updateData.automationLevel = data.automationLevel;
        if (data.status !== undefined) updateData.status = data.status;
        if (data.implementationNarrative !== undefined)
          updateData.implementationNarrative = data.implementationNarrative;
        if (data.scope !== undefined) updateData.scope = data.scope;
        if (data.frequency !== undefined) updateData.frequency = data.frequency;
        if (data.procedureRunbookLink !== undefined)
          updateData.procedureRunbookLink = data.procedureRunbookLink;
        if (data.reviewCycleMonths !== undefined)
          updateData.reviewCycleMonths = data.reviewCycleMonths;
        if (data.retirementDate !== undefined) updateData.retirementDate = data.retirementDate;

        const result = await tx.organizationalControl.update({
          where: { id: input.id },
          data: updateData,
        });

        // Replace framework mappings if provided (full set replacement)
        if (data.frameworkMappings) {
          await tx.orgControlFrameworkMapping.deleteMany({
            where: { orgControlId: input.id },
          });
          if (data.frameworkMappings.length) {
            await tx.orgControlFrameworkMapping.createMany({
              data: data.frameworkMappings.map((m) => ({
                id: randomUUID(),
                organizationId,
                orgControlId: input.id,
                frameworkControlId: m.frameworkControlId,
                mappingType: m.mappingType,
                notes: m.notes ?? null,
                createdById: userId,
              })),
              skipDuplicates: true,
            });
          }
        }

        // Replace assignments if provided (full set replacement)
        if (data.assignments) {
          await tx.orgControlAssignment.deleteMany({
            where: { orgControlId: input.id },
          });
          if (data.assignments.length) {
            await tx.orgControlAssignment.createMany({
              data: data.assignments.map((a) => ({
                id: randomUUID(),
                organizationId,
                orgControlId: input.id,
                personId: a.personId,
                role: a.role,
                assignedById: userId,
              })),
              skipDuplicates: true,
            });
          }
        }

        return result;
      });

      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId,
          userId,
          action: AuditAction.UPDATE_CONTROL,
          entityType: "OrganizationalControl",
          entityId: updated.id,
          changes: {
            action: "UPDATE",
            before: {
              name: existing.name,
              controlType: existing.controlType,
              status: existing.status,
              nature: existing.nature,
            },
            after: {
              name: updated.name,
              controlType: updated.controlType,
              status: updated.status,
              nature: updated.nature,
            },
            frameworkMappingsReplaced: data.frameworkMappings !== undefined,
            assignmentsReplaced: data.assignments !== undefined,
          },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });

      return updated;
    }),

  /**
   * Publish a new version. Increments `version` and writes a full-state snapshot
   * to the audit log for later diffing.
   */
  publish: organizationProcedure
    .input(
      z.object({
        id: z.string(),
        notes: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // ORG_ADMIN only for publishing (scope policy, separate from author/edit role)
      if (ctx.session?.user.role !== "ORG_ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only organization admins can publish control versions",
        });
      }

      const organizationId = ctx.organizationId!;

      const existing = await ctx.db.organizationalControl.findFirst({
        where: { id: input.id, organizationId },
        include: {
          FrameworkMappings: {
            include: {
              FrameworkControl: {
                select: {
                  controlId: true,
                  Framework: { select: { code: true } },
                },
              },
            },
          },
          Assignments: {
            include: { Person: { select: { id: true, name: true, email: true } } },
          },
        },
      });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Control not found" });
      }

      const newVersion = existing.version + 1;
      const updated = await ctx.db.organizationalControl.update({
        where: { id: input.id },
        data: { version: newVersion },
      });

      // Snapshot full control state for later version diffing
      const snapshot = {
        version: newVersion,
        localControlId: existing.localControlId,
        name: existing.name,
        description: existing.description,
        objective: existing.objective,
        family: existing.family,
        controlType: existing.controlType,
        nature: existing.nature,
        automationLevel: existing.automationLevel,
        status: existing.status,
        implementationNarrative: existing.implementationNarrative,
        scope: existing.scope,
        frequency: existing.frequency,
        procedureRunbookLink: existing.procedureRunbookLink,
        reviewCycleMonths: existing.reviewCycleMonths,
        retirementDate: existing.retirementDate,
        frameworkMappings: existing.FrameworkMappings.map((m) => ({
          frameworkCode: m.FrameworkControl.Framework.code,
          frameworkControlId: m.FrameworkControl.controlId,
          mappingType: m.mappingType,
          notes: m.notes,
        })),
        assignments: existing.Assignments.map((a) => ({
          personId: a.personId,
          personName: a.Person.name,
          role: a.role,
        })),
      };

      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId,
          userId: ctx.session!.user.id,
          action: AuditAction.UPDATE_CONTROL,
          entityType: "OrganizationalControl",
          entityId: existing.id,
          changes: {
            action: "VERSION_PUBLISHED",
            publishedVersion: newVersion,
            previousVersion: existing.version,
            notes: input.notes ?? null,
            snapshot,
          },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });

      return updated;
    }),

  /**
   * Most recent VERSION_PUBLISHED snapshot from the audit log (used to show the
   * previous published state when confirming a new publish).
   */
  getLatestPublishedSnapshot: organizationProcedure
    .input(z.object({ controlId: z.string() }))
    .query(async ({ ctx, input }) => {
      // AuditLog `changes.action` isn't indexable without a raw query; scan the
      // most recent 100 entries for this entity (bounded and fast).
      const entries = await ctx.db.auditLog.findMany({
        where: {
          organizationId: ctx.organizationId!,
          entityType: "OrganizationalControl",
          entityId: input.controlId,
        },
        orderBy: { timestamp: "desc" },
        take: 100,
      });

      const published = entries.find((e) => {
        const c = e.changes as { action?: string } | null;
        return c?.action === "VERSION_PUBLISHED";
      });

      return { latest: published ?? null };
    }),

  /**
   * Controls due for review: either never tested, or last tested more than
   * `reviewCycleMonths` ago (when a cycle is set). Excludes DEPRECATED.
   */
  dueForReview: organizationProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(10) }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.organizationalControl.findMany({
        where: {
          organizationId: ctx.organizationId!,
          status: { not: OrgControlStatus.DEPRECATED },
          OR: [
            { lastTestedDate: null },
            // Caller filters cycle-elapsed entries client-side below
          ],
        },
        select: {
          id: true,
          localControlId: true,
          name: true,
          status: true,
          lastTestedDate: true,
          reviewCycleMonths: true,
          nextTestDueDate: true,
        },
        orderBy: [{ lastTestedDate: "asc" }, { localControlId: "asc" }],
      });

      // Cycle-elapsed path: pull controls with a cycle and a lastTestedDate older
      // than cycle months. Prisma can't express the arithmetic comparison cleanly,
      // so fetch candidates and filter in memory. Bounded by org size.
      const withCycle = await ctx.db.organizationalControl.findMany({
        where: {
          organizationId: ctx.organizationId!,
          status: { not: OrgControlStatus.DEPRECATED },
          reviewCycleMonths: { not: null },
          lastTestedDate: { not: null },
        },
        select: {
          id: true,
          localControlId: true,
          name: true,
          status: true,
          lastTestedDate: true,
          reviewCycleMonths: true,
          nextTestDueDate: true,
        },
      });

      const now = Date.now();
      const elapsed = withCycle.filter((c) => {
        if (!c.lastTestedDate || !c.reviewCycleMonths) return false;
        const d = new Date(c.lastTestedDate);
        d.setMonth(d.getMonth() + c.reviewCycleMonths);
        return d.getTime() < now;
      });

      // Dedupe (never-tested controls are already in `rows`)
      const byId = new Map<string, (typeof rows)[number]>();
      for (const r of rows) byId.set(r.id, r);
      for (const r of elapsed) if (!byId.has(r.id)) byId.set(r.id, r);

      const combined = Array.from(byId.values());
      const total = combined.length;
      return { controls: combined.slice(0, input.limit), total };
    }),

  /**
   * Archive - soft-retire a control (status=DEPRECATED, retirementDate=now)
   * Preserves all linkages and history for audit.
   */
  archive: organizationProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      assertMutationAllowed(ctx.session?.user.role, "archive");

      const existing = await ctx.db.organizationalControl.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId! },
        include: {
          _count: { select: { Exceptions: true } },
        },
      });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Control not found" });
      }

      if (existing.status === OrgControlStatus.DEPRECATED) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Control is already archived",
        });
      }

      // Guardrail: block archive if pending exceptions exist
      const pendingExceptions = await ctx.db.orgControlException.count({
        where: { orgControlId: input.id, status: "PENDING" },
      });
      if (pendingExceptions > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Cannot archive: ${pendingExceptions} pending exception(s). Resolve them first.`,
        });
      }

      const archived = await ctx.db.organizationalControl.update({
        where: { id: input.id },
        data: {
          status: OrgControlStatus.DEPRECATED,
          retirementDate: new Date(),
        },
      });

      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          userId: ctx.session!.user.id,
          action: AuditAction.UPDATE_CONTROL,
          entityType: "OrganizationalControl",
          entityId: archived.id,
          changes: {
            action: "ARCHIVE",
            before: { status: existing.status, retirementDate: existing.retirementDate },
            after: { status: archived.status, retirementDate: archived.retirementDate },
          },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });

      return archived;
    }),

  /**
   * Hard-delete a control. Only allowed if no linkages exist.
   * Returns an impact summary if linkages prevent deletion.
   */
  delete: organizationProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      assertMutationAllowed(ctx.session?.user.role, "delete");

      const existing = await ctx.db.organizationalControl.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId! },
        include: {
          _count: {
            select: {
              TestRecords: true,
              Deficiencies: true,
              Exceptions: true,
              linkedObjectives: true,
              DependenciesTo: true,
            },
          },
        },
      });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Control not found" });
      }

      // Count live MITIGATES edges from the graph (replaces _count.RiskLinks on the dropped table)
      const mitigatesCount = (
        await graphService.listOutEdges({
          type: "MITIGATES",
          from: { type: "Control", id: input.id },
          organizationId: ctx.organizationId!,
        })
      ).length;

      const impact = existing._count;
      const blockingCount =
        mitigatesCount +
        impact.TestRecords +
        impact.Deficiencies +
        impact.Exceptions +
        impact.linkedObjectives +
        impact.DependenciesTo;

      if (blockingCount > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            `Cannot delete: control has active linkages ` +
            `(${mitigatesCount} risks, ${impact.linkedObjectives} objectives, ` +
            `${impact.TestRecords} test records, ${impact.Deficiencies} deficiencies, ` +
            `${impact.Exceptions} exceptions, ${impact.DependenciesTo} dependent controls). ` +
            `Archive the control instead.`,
        });
      }

      // Cascading deletes handle FrameworkMappings, Assignments, EvidenceRequirements, DependenciesFrom
      await ctx.db.organizationalControl.delete({ where: { id: input.id } });

      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          userId: ctx.session!.user.id,
          action: AuditAction.DELETE_CONTROL,
          entityType: "OrganizationalControl",
          entityId: input.id,
          changes: {
            action: "DELETE",
            before: {
              localControlId: existing.localControlId,
              name: existing.name,
              status: existing.status,
            },
          },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });

      return { success: true };
    }),

  /**
   * Get all risks linked to this control (inverse of getForRisk).
   * Reads MITIGATES edges: Control(fromEntityId) -> Risk(toEntityId).
   */
  getLinkedRisks: organizationProcedure
    .input(z.object({ controlId: z.string() }))
    .query(async ({ ctx, input }) => {
      const edges = await graphService.listOutEdges({
        type: "MITIGATES",
        from: { type: "Control", id: input.controlId },
        organizationId: ctx.organizationId!,
      });
      const riskIds = edges.map((e) => e.toEntityId);
      const risks = await ctx.db.risk.findMany({
        where: { id: { in: riskIds } },
        select: { id: true, identifier: true, title: true, severity: true, status: true },
      });
      const riskById = new Map(risks.map((r) => [r.id, r]));
      return edges
        .map((e) => {
          const props = (e.properties ?? {}) as { role?: RiskOrgControlRole; notes?: string | null };
          const risk = riskById.get(e.toEntityId);
          if (!risk) return null;
          return {
            linkId: e.id,                           // backward compat: UI uses as row key
            riskId: e.toEntityId,                   // new: test + future use
            organizationalControlId: input.controlId,
            role: props.role ?? RiskOrgControlRole.IN_PLACE,
            notes: props.notes ?? null,
            risk,                                   // backward compat: UI reads risk.id/title/etc.
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
    }),

  /**
   * Audit log history for this control (most recent first).
   */
  getHistory: organizationProcedure
    .input(z.object({ controlId: z.string(), limit: z.number().min(1).max(200).default(50) }))
    .query(async ({ ctx, input }) => {
      return ctx.db.auditLog.findMany({
        where: {
          organizationId: ctx.organizationId!,
          entityType: "OrganizationalControl",
          entityId: input.controlId,
        },
        orderBy: { timestamp: "desc" },
        take: input.limit,
      });
    }),

  // --------------------------------------------------------------------
  // Risk linkage endpoints (unchanged from prior implementation — preserve behavior)
  // --------------------------------------------------------------------

  getForRisk: organizationProcedure
    .input(z.object({ riskId: z.string() }))
    .query(async ({ ctx, input }) => {
      const edges = await graphService.listInEdges({
        type: "MITIGATES",
        to: { type: "Risk", id: input.riskId },
        organizationId: ctx.organizationId!,
      });
      const controlIds = edges.map((e) => e.fromEntityId);
      const controls = await ctx.db.organizationalControl.findMany({
        where: { id: { in: controlIds } },
        orderBy: { name: "asc" },
      });
      const controlById = new Map(controls.map((c) => [c.id, c]));
      const links = edges
        .map((e) => {
          const props = (e.properties ?? {}) as { role?: RiskOrgControlRole; notes?: string | null };
          const OrganizationalControl = controlById.get(e.fromEntityId);
          if (!OrganizationalControl) return null;
          return {
            id: e.id,
            riskId: input.riskId,
            organizationalControlId: e.fromEntityId,
            role: props.role ?? RiskOrgControlRole.IN_PLACE,
            notes: props.notes ?? null,
            OrganizationalControl,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      const inPlace = links.filter((l) => l.role === RiskOrgControlRole.IN_PLACE);
      const needed = links.filter((l) => l.role === RiskOrgControlRole.NEEDED);
      return { inPlace, needed };
    }),

  linkToRisk: organizationProcedure
    .input(
      z.object({
        riskId: z.string(),
        controlId: z.string(),
        role: z.nativeEnum(RiskOrgControlRole),
        notes: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertMutationAllowed(ctx.session?.user.role, "link");

      const control = await ctx.db.organizationalControl.findFirst({
        where: { id: input.controlId, organizationId: ctx.organizationId! },
      });
      if (!control) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Control not found" });
      }

      const risk = await ctx.db.risk.findFirst({
        where: { id: input.riskId, organizationId: ctx.organizationId! },
      });
      if (!risk) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Risk not found" });
      }

      const edge = await graphService.createEdge({
        type: "MITIGATES",
        from: { type: "Control", id: input.controlId },
        to: { type: "Risk", id: input.riskId },
        organizationId: ctx.organizationId!,
        properties: { role: input.role, notes: input.notes ?? null },
        createdById: ctx.session?.user.id ?? null,
      });

      return {
        id: edge.id,
        riskId: input.riskId,
        organizationalControlId: input.controlId,
        role: input.role,
        notes: input.notes ?? null,
        OrganizationalControl: control,
      };
    }),

  unlinkFromRisk: organizationProcedure
    .input(z.object({ riskId: z.string(), controlId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      assertMutationAllowed(ctx.session?.user.role, "unlink");

      const removed = await graphService.deleteEdge({
        type: "MITIGATES",
        from: { type: "Control", id: input.controlId },
        to: { type: "Risk", id: input.riskId },
        organizationId: ctx.organizationId!,
      });

      if (!removed) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Link not found" });
      }

      return { success: true };
    }),

  bulkLinkToRisk: organizationProcedure
    .input(
      z.object({
        riskId: z.string(),
        controlIds: z.array(z.string()).min(1).max(50),
        role: z.nativeEnum(RiskOrgControlRole),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertMutationAllowed(ctx.session?.user.role, "link");

      const risk = await ctx.db.risk.findFirst({
        where: { id: input.riskId, organizationId: ctx.organizationId! },
      });
      if (!risk) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Risk not found" });
      }

      // Validate that all requested control IDs exist and belong to this org.
      // ctx.db is org-scoped, so findMany automatically filters to the caller's org.
      const validControls = await ctx.db.organizationalControl.findMany({
        where: { id: { in: input.controlIds } },
        select: { id: true },
      });
      const validIds = validControls.map((c) => c.id);

      // createEdge internally upserts (update if existing, create if new)
      for (const controlId of validIds) {
        await graphService.createEdge({
          type: "MITIGATES",
          from: { type: "Control", id: controlId },
          to: { type: "Risk", id: input.riskId },
          organizationId: ctx.organizationId!,
          properties: { role: input.role, notes: null },
          createdById: ctx.session?.user.id ?? null,
        });
      }

      // Preserve legacy return shape { created, updated } for contract stability.
      // Edge-based upsert doesn't distinguish created vs updated, so we report
      // all as created (callers do not inspect this value).
      // skipped covers ids that were invalid (not org-owned) OR already linked.
      const skipped = input.controlIds.length - validIds.length;
      return { created: validIds.length, updated: 0, skipped };
    }),
});
