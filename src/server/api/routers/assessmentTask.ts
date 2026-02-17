/**
 * Assessment Task Management tRPC Router
 *
 * Handles CRUD operations for proactive risk assessment tasks.
 * These are tasks that managers assign to analysts to discover risks,
 * independent of existing findings.
 *
 * **Security Features:**
 * - Multi-tenant isolation: All operations filter by organizationId
 * - Role-based access: Managers can create/assign, analysts can view their tasks
 *
 * **Features:**
 * - Create assessment tasks with scope definition
 * - Assign tasks to GRC analysts
 * - Track task lifecycle (PENDING → IN_PROGRESS → COMPLETED)
 * - Link discovered risks to tasks
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createTRPCRouter,
  organizationProcedure,
} from "@/server/api/trpc";
import { UserRole, AssessmentTaskStatus, UnifiedAssessmentType } from "@prisma/client";

// Roles that can create and manage assessment tasks
const MANAGER_ROLES: UserRole[] = [
  UserRole.ORG_ADMIN,
  UserRole.CISO,
  UserRole.GRC_MANAGER,
  UserRole.GRC_ANALYST, // Senior analysts can also create tasks
];

// Roles that can be assigned to assessment tasks
const ASSIGNEE_ROLES: UserRole[] = [
  UserRole.GRC_ANALYST,
  UserRole.GRC_MANAGER,
  UserRole.SECURITY_ENGINEER,
];

// Helper to check if user has manager role
function hasManagerRole(role: UserRole): boolean {
  return MANAGER_ROLES.includes(role);
}

// Helper to generate task identifier
async function generateTaskIdentifier(
  db: any,
  organizationId: string
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `TASK-${year}-`;

  // Find the highest number for this year
  const lastTask = await db.assessmentTask.findFirst({
    where: {
      organizationId,
      identifier: { startsWith: prefix },
    },
    orderBy: { identifier: "desc" },
    select: { identifier: true },
  });

  let nextNumber = 1;
  if (lastTask?.identifier) {
    const match = lastTask.identifier.match(/TASK-\d{4}-(\d+)/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  return `${prefix}${nextNumber.toString().padStart(4, "0")}`;
}

// Zod schemas for input validation
const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title must be 200 characters or less"),
  description: z.string().max(2000, "Description must be 2000 characters or less").optional(),
  scope: z.string().min(1, "Scope is required").max(2000, "Scope must be 2000 characters or less"),
  businessUnitId: z.string().optional().nullable(),
  assessmentTypeId: z.string().optional().nullable(),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]).default("MEDIUM"),
  dueDate: z.coerce.date().optional().nullable(),
  assignedToId: z.string().optional().nullable(),
});

const updateTaskSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  scope: z.string().min(1).max(2000).optional(),
  businessUnitId: z.string().optional().nullable(),
  assessmentTypeId: z.string().optional().nullable(),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
  dueDate: z.coerce.date().optional().nullable(),
});

const assignTaskSchema = z.object({
  id: z.string(),
  assignedToId: z.string(),
});

const listTasksSchema = z.object({
  status: z.nativeEnum(AssessmentTaskStatus).optional(),
  assignedToId: z.string().optional(),
  unassignedOnly: z.boolean().default(false),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
});

export const assessmentTaskRouter = createTRPCRouter({
  /**
   * Create Assessment Task
   *
   * Creates a new assessment task. Only managers can create tasks.
   */
  create: organizationProcedure
    .input(createTaskSchema)
    .mutation(async ({ ctx, input }) => {
      // Check if user has manager role
      if (!hasManagerRole(ctx.session.user.role as UserRole)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only managers can create assessment tasks",
        });
      }

      // Generate unique identifier
      const identifier = await generateTaskIdentifier(ctx.db, ctx.organizationId);

      // If assignedToId provided, validate the user exists and has appropriate role
      if (input.assignedToId) {
        const assignee = await ctx.db.user.findFirst({
          where: {
            id: input.assignedToId,
            organizationId: ctx.organizationId,
          },
          select: { id: true, role: true },
        });

        if (!assignee) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Assigned user not found",
          });
        }

        if (!ASSIGNEE_ROLES.includes(assignee.role as UserRole)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "User cannot be assigned to assessment tasks",
          });
        }
      }

      // Validate businessUnitId if provided
      if (input.businessUnitId) {
        const bu = await ctx.db.businessUnit.findFirst({
          where: {
            id: input.businessUnitId,
            organizationId: ctx.organizationId,
            isActive: true,
          },
        });

        if (!bu) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Business unit not found",
          });
        }
      }

      // Validate assessmentTypeId if provided
      if (input.assessmentTypeId) {
        const assessmentType = await ctx.db.assessmentType.findFirst({
          where: {
            id: input.assessmentTypeId,
            organizationId: ctx.organizationId,
            isActive: true,
          },
        });

        if (!assessmentType) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Assessment type not found",
          });
        }
      }

      const task = await ctx.db.assessmentTask.create({
        data: {
          organizationId: ctx.organizationId,
          identifier,
          title: input.title,
          description: input.description ?? null,
          scope: input.scope,
          businessUnitId: input.businessUnitId ?? null,
          assessmentTypeId: input.assessmentTypeId ?? null,
          priority: input.priority,
          dueDate: input.dueDate ?? null,
          assignedToId: input.assignedToId ?? null,
          assignedById: ctx.session.user.id,
          assignedAt: input.assignedToId ? new Date() : null,
          status: AssessmentTaskStatus.PENDING,
        },
        include: {
          assignedTo: {
            select: { id: true, name: true, email: true },
          },
          assignedBy: {
            select: { id: true, name: true, email: true },
          },
          businessUnit: {
            select: { id: true, name: true, code: true },
          },
          assessmentType: {
            select: { id: true, name: true },
          },
        },
      });

      return task;
    }),

  /**
   * Update Assessment Task
   *
   * Updates task details. Only managers can update tasks.
   */
  update: organizationProcedure
    .input(updateTaskSchema)
    .mutation(async ({ ctx, input }) => {
      // Check if user has manager role
      if (!hasManagerRole(ctx.session.user.role as UserRole)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only managers can update assessment tasks",
        });
      }

      // Verify task exists and belongs to organization
      const existing = await ctx.db.assessmentTask.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment task not found",
        });
      }

      // Cannot update completed or cancelled tasks
      if (existing.status === AssessmentTaskStatus.COMPLETED ||
          existing.status === AssessmentTaskStatus.CANCELLED) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot update completed or cancelled tasks",
        });
      }

      const task = await ctx.db.assessmentTask.update({
        where: { id: input.id },
        data: {
          ...(input.title !== undefined && { title: input.title }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.scope !== undefined && { scope: input.scope }),
          ...(input.businessUnitId !== undefined && { businessUnitId: input.businessUnitId }),
          ...(input.assessmentTypeId !== undefined && { assessmentTypeId: input.assessmentTypeId }),
          ...(input.priority !== undefined && { priority: input.priority }),
          ...(input.dueDate !== undefined && { dueDate: input.dueDate }),
        },
        include: {
          assignedTo: {
            select: { id: true, name: true, email: true },
          },
          assignedBy: {
            select: { id: true, name: true, email: true },
          },
          businessUnit: {
            select: { id: true, name: true, code: true },
          },
          assessmentType: {
            select: { id: true, name: true },
          },
        },
      });

      return task;
    }),

  /**
   * Assign Task to Analyst
   *
   * Assigns a task to a GRC analyst. Only managers can assign tasks.
   */
  assign: organizationProcedure
    .input(assignTaskSchema)
    .mutation(async ({ ctx, input }) => {
      // Check if user has manager role
      if (!hasManagerRole(ctx.session.user.role as UserRole)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only managers can assign assessment tasks",
        });
      }

      // Verify task exists
      const existing = await ctx.db.assessmentTask.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment task not found",
        });
      }

      // Verify assignee exists and has appropriate role
      const assignee = await ctx.db.user.findFirst({
        where: {
          id: input.assignedToId,
          organizationId: ctx.organizationId,
        },
        select: { id: true, role: true, name: true, email: true },
      });

      if (!assignee) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assigned user not found",
        });
      }

      if (!ASSIGNEE_ROLES.includes(assignee.role as UserRole)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "User cannot be assigned to assessment tasks",
        });
      }

      const task = await ctx.db.assessmentTask.update({
        where: { id: input.id },
        data: {
          assignedToId: input.assignedToId,
          assignedAt: new Date(),
        },
        include: {
          assignedTo: {
            select: { id: true, name: true, email: true },
          },
          assignedBy: {
            select: { id: true, name: true, email: true },
          },
          businessUnit: {
            select: { id: true, name: true, code: true },
          },
          assessmentType: {
            select: { id: true, name: true },
          },
        },
      });

      return task;
    }),

  /**
   * Cancel Assessment Task
   *
   * Cancels a pending or in-progress task.
   */
  cancel: organizationProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Check if user has manager role
      if (!hasManagerRole(ctx.session.user.role as UserRole)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only managers can cancel assessment tasks",
        });
      }

      const existing = await ctx.db.assessmentTask.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment task not found",
        });
      }

      if (existing.status === AssessmentTaskStatus.COMPLETED) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot cancel a completed task",
        });
      }

      const task = await ctx.db.assessmentTask.update({
        where: { id: input.id },
        data: {
          status: AssessmentTaskStatus.CANCELLED,
        },
      });

      return task;
    }),

  /**
   * List Assessment Tasks
   *
   * Returns tasks based on filters. Managers see all tasks,
   * analysts see only their assigned tasks.
   */
  list: organizationProcedure
    .input(listTasksSchema)
    .query(async ({ ctx, input }) => {
      const userRole = ctx.session.user.role as UserRole;
      const isManager = hasManagerRole(userRole);

      // Build where clause
      const where: any = {
        organizationId: ctx.organizationId,
      };

      // Filter by status if provided
      if (input.status) {
        where.status = input.status;
      }

      // Filter by assignee
      if (input.unassignedOnly) {
        where.assignedToId = null;
      } else if (input.assignedToId) {
        where.assignedToId = input.assignedToId;
      } else if (!isManager) {
        // Non-managers can only see their own tasks
        where.assignedToId = ctx.session.user.id;
      }

      const [tasks, total] = await Promise.all([
        ctx.db.assessmentTask.findMany({
          where,
          include: {
            assignedTo: {
              select: { id: true, name: true, email: true },
            },
            assignedBy: {
              select: { id: true, name: true, email: true },
            },
            businessUnit: {
              select: { id: true, name: true, code: true },
            },
            assessmentType: {
              select: { id: true, name: true },
            },
            _count: {
              select: { discoveredRisks: true },
            },
          },
          orderBy: [
            { status: "asc" }, // PENDING first
            { priority: "asc" }, // HIGH priority first (alphabetically HIGH < LOW < MEDIUM)
            { dueDate: "asc" }, // Earliest due date first
            { createdAt: "desc" },
          ],
          take: input.limit,
          skip: input.offset,
        }),
        ctx.db.assessmentTask.count({ where }),
      ]);

      return {
        tasks: tasks.map((task) => ({
          ...task,
          discoveredRisksCount: task._count.discoveredRisks,
        })),
        total,
        hasMore: input.offset + tasks.length < total,
      };
    }),

  /**
   * Get Assessment Task by ID
   */
  getById: organizationProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const task = await ctx.db.assessmentTask.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
        },
        include: {
          assignedTo: {
            select: { id: true, name: true, email: true },
          },
          assignedBy: {
            select: { id: true, name: true, email: true },
          },
          businessUnit: {
            select: { id: true, name: true, code: true },
          },
          assessmentType: {
            select: { id: true, name: true },
          },
          discoveredRisks: {
            select: {
              id: true,
              title: true,
              severity: true,
              status: true,
            },
          },
        },
      });

      if (!task) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment task not found",
        });
      }

      return task;
    }),

  /**
   * Get Assignable Users
   *
   * Returns users who can be assigned to assessment tasks.
   */
  getAssignableUsers: organizationProcedure.query(async ({ ctx }) => {
    const users = await ctx.db.user.findMany({
      where: {
        organizationId: ctx.organizationId,
        role: { in: ASSIGNEE_ROLES },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
      orderBy: { name: "asc" },
    });

    return users;
  }),

  /**
   * Start Task
   *
   * Analyst marks their assigned task as in progress.
   */
  startTask: organizationProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.db.assessmentTask.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
        },
      });

      if (!task) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment task not found",
        });
      }

      // User must be the assignee or a manager
      const isManager = hasManagerRole(ctx.session.user.role as UserRole);
      if (!isManager && task.assignedToId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not assigned to this task",
        });
      }

      if (task.status !== AssessmentTaskStatus.PENDING) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only pending tasks can be started",
        });
      }

      const updatedTask = await ctx.db.assessmentTask.update({
        where: { id: input.id },
        data: {
          status: AssessmentTaskStatus.IN_PROGRESS,
          startedAt: new Date(),
        },
        include: {
          assignedTo: {
            select: { id: true, name: true, email: true },
          },
          assignedBy: {
            select: { id: true, name: true, email: true },
          },
          businessUnit: {
            select: { id: true, name: true, code: true },
          },
          assessmentType: {
            select: { id: true, name: true },
          },
        },
      });

      return updatedTask;
    }),

  /**
   * Complete Task
   *
   * Analyst marks their task as completed with summary.
   */
  completeTask: organizationProcedure
    .input(z.object({
      id: z.string(),
      summary: z.string().max(2000, "Summary must be 2000 characters or less").optional(),
      risksIdentified: z.number().int().min(0).default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.db.assessmentTask.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
        },
      });

      if (!task) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment task not found",
        });
      }

      // User must be the assignee or a manager
      const isManager = hasManagerRole(ctx.session.user.role as UserRole);
      if (!isManager && task.assignedToId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not assigned to this task",
        });
      }

      if (task.status !== AssessmentTaskStatus.IN_PROGRESS) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only in-progress tasks can be completed",
        });
      }

      const updatedTask = await ctx.db.assessmentTask.update({
        where: { id: input.id },
        data: {
          status: AssessmentTaskStatus.COMPLETED,
          completedAt: new Date(),
          summary: input.summary ?? null,
          risksIdentified: input.risksIdentified,
        },
        include: {
          assignedTo: {
            select: { id: true, name: true, email: true },
          },
          assignedBy: {
            select: { id: true, name: true, email: true },
          },
          businessUnit: {
            select: { id: true, name: true, code: true },
          },
          assessmentType: {
            select: { id: true, name: true },
          },
        },
      });

      return updatedTask;
    }),

  /**
   * Get My Tasks
   *
   * Returns tasks assigned to the current user.
   */
  getMyTasks: organizationProcedure
    .input(z.object({
      status: z.nativeEnum(AssessmentTaskStatus).optional(),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ ctx, input }) => {
      const where: any = {
        organizationId: ctx.organizationId,
        assignedToId: ctx.session.user.id,
      };

      if (input.status) {
        where.status = input.status;
      } else {
        // By default, show pending and in-progress tasks
        where.status = { in: [AssessmentTaskStatus.PENDING, AssessmentTaskStatus.IN_PROGRESS] };
      }

      const tasks = await ctx.db.assessmentTask.findMany({
        where,
        include: {
          assignedBy: {
            select: { id: true, name: true, email: true },
          },
          businessUnit: {
            select: { id: true, name: true, code: true },
          },
          assessmentType: {
            select: { id: true, name: true },
          },
          _count: {
            select: { discoveredRisks: true },
          },
        },
        orderBy: [
          { priority: "asc" }, // HIGH priority first
          { dueDate: "asc" }, // Earliest due date first
          { createdAt: "desc" },
        ],
        take: input.limit,
      });

      return tasks.map((task) => ({
        ...task,
        discoveredRisksCount: task._count.discoveredRisks,
      }));
    }),

  /**
   * Get Queue Metrics
   *
   * Returns summary metrics for the assessment task queue.
   */
  getQueueMetrics: organizationProcedure.query(async ({ ctx }) => {
    const [pending, inProgress, unassigned, overdue] = await Promise.all([
      ctx.db.assessmentTask.count({
        where: {
          organizationId: ctx.organizationId,
          status: AssessmentTaskStatus.PENDING,
        },
      }),
      ctx.db.assessmentTask.count({
        where: {
          organizationId: ctx.organizationId,
          status: AssessmentTaskStatus.IN_PROGRESS,
        },
      }),
      ctx.db.assessmentTask.count({
        where: {
          organizationId: ctx.organizationId,
          status: { in: [AssessmentTaskStatus.PENDING, AssessmentTaskStatus.IN_PROGRESS] },
          assignedToId: null,
        },
      }),
      ctx.db.assessmentTask.count({
        where: {
          organizationId: ctx.organizationId,
          status: { in: [AssessmentTaskStatus.PENDING, AssessmentTaskStatus.IN_PROGRESS] },
          dueDate: { lt: new Date() },
        },
      }),
    ]);

    return {
      pending,
      inProgress,
      unassigned,
      overdue,
      total: pending + inProgress,
    };
  }),

  // ============================================================================
  // Unified Assignments Module - New Procedures
  // ============================================================================

  /**
   * Self-Assign Task
   *
   * Allows GRC analysts and security engineers to self-assign unassigned tasks.
   * Uses atomic transaction to prevent race conditions.
   */
  selfAssign: organizationProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userRole = ctx.session.user.role as UserRole;

      // Check if user can self-assign
      if (!ASSIGNEE_ROLES.includes(userRole)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only GRC analysts and security engineers can self-assign tasks",
        });
      }

      // Use transaction to ensure atomicity
      const task = await ctx.db.$transaction(async (tx) => {
        // Check task exists and is unassigned
        const existing = await tx.assessmentTask.findFirst({
          where: {
            id: input.id,
            organizationId: ctx.organizationId,
            assignedToId: null,
            status: { in: [AssessmentTaskStatus.PENDING, AssessmentTaskStatus.IN_PROGRESS] },
          },
        });

        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Task not found or already assigned",
          });
        }

        // Self-assign the task
        return tx.assessmentTask.update({
          where: { id: input.id },
          data: {
            assignedToId: ctx.session.user.id,
            assignedAt: new Date(),
            selfAssignedAt: new Date(),
          },
          include: {
            assignedTo: {
              select: { id: true, name: true, email: true },
            },
            businessUnit: {
              select: { id: true, name: true, code: true },
            },
            assessmentType: {
              select: { id: true, name: true },
            },
          },
        });
      });

      return task;
    }),

  /**
   * Get Unified Backlog
   *
   * Returns all unassigned tasks with filters for the unified backlog page.
   * Accessible by GRC analysts, security engineers, and org admins.
   */
  getUnifiedBacklog: organizationProcedure
    .input(z.object({
      unifiedType: z.nativeEnum(UnifiedAssessmentType).optional(),
      priority: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
      businessUnitId: z.string().optional(),
      search: z.string().optional(),
      sortBy: z.enum(["priority", "dueDate", "createdAt"]).default("priority"),
      sortOrder: z.enum(["asc", "desc"]).default("asc"),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const userRole = ctx.session.user.role as UserRole;

      // Check access - managers and assignee roles can view backlog
      const canAccessBacklog = hasManagerRole(userRole) || ASSIGNEE_ROLES.includes(userRole);
      if (!canAccessBacklog) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have access to the assignment backlog",
        });
      }

      // Build where clause - only unassigned tasks
      const where: any = {
        organizationId: ctx.organizationId,
        assignedToId: null,
        status: { in: [AssessmentTaskStatus.PENDING, AssessmentTaskStatus.IN_PROGRESS] },
      };

      if (input.unifiedType) {
        where.unifiedType = input.unifiedType;
      }

      if (input.priority) {
        where.priority = input.priority;
      }

      if (input.businessUnitId) {
        where.businessUnitId = input.businessUnitId;
      }

      if (input.search) {
        where.OR = [
          { title: { contains: input.search, mode: "insensitive" } },
          { description: { contains: input.search, mode: "insensitive" } },
          { identifier: { contains: input.search, mode: "insensitive" } },
        ];
      }

      // Build orderBy based on sortBy
      const orderBy: any[] = [];
      if (input.sortBy === "priority") {
        // Sort HIGH first (asc alphabetically)
        orderBy.push({ priority: input.sortOrder });
      } else if (input.sortBy === "dueDate") {
        orderBy.push({ dueDate: input.sortOrder === "asc" ? "asc" : "desc" });
      } else {
        orderBy.push({ createdAt: input.sortOrder === "asc" ? "asc" : "desc" });
      }

      const [tasks, total, byType, overdue] = await Promise.all([
        ctx.db.assessmentTask.findMany({
          where,
          include: {
            assignedBy: {
              select: { id: true, name: true, email: true },
            },
            businessUnit: {
              select: { id: true, name: true, code: true },
            },
            assessmentType: {
              select: { id: true, name: true },
            },
          },
          orderBy,
          take: input.limit,
          skip: input.offset,
        }),
        ctx.db.assessmentTask.count({ where }),
        // Count by type
        ctx.db.assessmentTask.groupBy({
          by: ["unifiedType"],
          where: {
            organizationId: ctx.organizationId,
            assignedToId: null,
            status: { in: [AssessmentTaskStatus.PENDING, AssessmentTaskStatus.IN_PROGRESS] },
          },
          _count: true,
        }),
        // Count overdue
        ctx.db.assessmentTask.count({
          where: {
            ...where,
            dueDate: { lt: new Date() },
          },
        }),
      ]);

      return {
        tasks,
        total,
        overdue,
        byType: byType.reduce((acc, item) => {
          acc[item.unifiedType] = item._count;
          return acc;
        }, {} as Record<UnifiedAssessmentType, number>),
        hasMore: input.offset + tasks.length < total,
      };
    }),

  /**
   * Get My Kanban Assignments
   *
   * Returns the current user's tasks grouped by status for the Kanban board.
   */
  getMyKanbanAssignments: organizationProcedure
    .input(z.object({
      includeCompleted: z.boolean().default(false),
      completedLimit: z.number().min(1).max(50).default(10),
    }))
    .query(async ({ ctx, input }) => {
      // Get tasks assigned to current user
      const baseWhere = {
        organizationId: ctx.organizationId,
        assignedToId: ctx.session.user.id,
      };

      const include = {
        assignedBy: {
          select: { id: true, name: true, email: true },
        },
        businessUnit: {
          select: { id: true, name: true, code: true },
        },
        assessmentType: {
          select: { id: true, name: true },
        },
      };

      const [pending, inProgress, completed] = await Promise.all([
        // PENDING tasks (To Do column)
        ctx.db.assessmentTask.findMany({
          where: {
            ...baseWhere,
            status: AssessmentTaskStatus.PENDING,
          },
          include,
          orderBy: [
            { priority: "asc" },
            { dueDate: "asc" },
            { createdAt: "desc" },
          ],
        }),
        // IN_PROGRESS tasks
        ctx.db.assessmentTask.findMany({
          where: {
            ...baseWhere,
            status: AssessmentTaskStatus.IN_PROGRESS,
          },
          include,
          orderBy: [
            { priority: "asc" },
            { dueDate: "asc" },
            { startedAt: "desc" },
          ],
        }),
        // COMPLETED tasks (limited to recent)
        input.includeCompleted
          ? ctx.db.assessmentTask.findMany({
              where: {
                ...baseWhere,
                status: AssessmentTaskStatus.COMPLETED,
              },
              include,
              orderBy: { completedAt: "desc" },
              take: input.completedLimit,
            })
          : [],
      ]);

      return {
        todo: pending,
        inProgress,
        completed,
        counts: {
          todo: pending.length,
          inProgress: inProgress.length,
          completed: completed.length,
        },
      };
    }),

  /**
   * Create Unified Task
   *
   * Creates a task for any assessment type. Admins can assign to others,
   * GRC users can create unassigned tasks.
   */
  createUnifiedTask: organizationProcedure
    .input(z.object({
      title: z.string().min(1).max(200),
      description: z.string().max(2000).optional(),
      scope: z.string().min(1).max(2000),
      unifiedType: z.nativeEnum(UnifiedAssessmentType).default(UnifiedAssessmentType.RISK_DISCOVERY),
      entityId: z.string().optional(),
      entityType: z.string().optional(),
      businessUnitId: z.string().optional().nullable(),
      assessmentTypeId: z.string().optional().nullable(),
      priority: z.enum(["HIGH", "MEDIUM", "LOW"]).default("MEDIUM"),
      dueDate: z.coerce.date().optional().nullable(),
      assignedToId: z.string().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userRole = ctx.session.user.role as UserRole;

      // Check if user can create tasks
      if (!hasManagerRole(userRole)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only managers can create assessment tasks",
        });
      }

      // Generate unique identifier
      const identifier = await generateTaskIdentifier(ctx.db, ctx.organizationId);

      // If assignedToId provided, validate the user
      if (input.assignedToId) {
        const assignee = await ctx.db.user.findFirst({
          where: {
            id: input.assignedToId,
            organizationId: ctx.organizationId,
          },
          select: { id: true, role: true },
        });

        if (!assignee) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Assigned user not found",
          });
        }

        if (!ASSIGNEE_ROLES.includes(assignee.role as UserRole)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "User cannot be assigned to assessment tasks",
          });
        }
      }

      const task = await ctx.db.assessmentTask.create({
        data: {
          organizationId: ctx.organizationId,
          identifier,
          title: input.title,
          description: input.description ?? null,
          scope: input.scope,
          unifiedType: input.unifiedType,
          entityId: input.entityId ?? null,
          entityType: input.entityType ?? null,
          businessUnitId: input.businessUnitId ?? null,
          assessmentTypeId: input.assessmentTypeId ?? null,
          priority: input.priority,
          dueDate: input.dueDate ?? null,
          assignedToId: input.assignedToId ?? null,
          assignedById: ctx.session.user.id,
          assignedAt: input.assignedToId ? new Date() : null,
          status: AssessmentTaskStatus.PENDING,
        },
        include: {
          assignedTo: {
            select: { id: true, name: true, email: true },
          },
          assignedBy: {
            select: { id: true, name: true, email: true },
          },
          businessUnit: {
            select: { id: true, name: true, code: true },
          },
          assessmentType: {
            select: { id: true, name: true },
          },
        },
      });

      return task;
    }),

  /**
   * Update Task Status
   *
   * Updates the status of a task (for Kanban drag-drop).
   * Only the assignee or managers can update status.
   */
  updateTaskStatus: organizationProcedure
    .input(z.object({
      id: z.string(),
      status: z.nativeEnum(AssessmentTaskStatus),
    }))
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.db.assessmentTask.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
        },
      });

      if (!task) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment task not found",
        });
      }

      // User must be the assignee or a manager
      const isManager = hasManagerRole(ctx.session.user.role as UserRole);
      if (!isManager && task.assignedToId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not authorized to update this task",
        });
      }

      // Validate status transitions
      const validTransitions: Record<AssessmentTaskStatus, AssessmentTaskStatus[]> = {
        [AssessmentTaskStatus.PENDING]: [AssessmentTaskStatus.IN_PROGRESS, AssessmentTaskStatus.CANCELLED],
        [AssessmentTaskStatus.IN_PROGRESS]: [AssessmentTaskStatus.PENDING, AssessmentTaskStatus.COMPLETED, AssessmentTaskStatus.CANCELLED],
        [AssessmentTaskStatus.COMPLETED]: [], // Cannot transition from completed
        [AssessmentTaskStatus.CANCELLED]: [], // Cannot transition from cancelled
      };

      if (!validTransitions[task.status].includes(input.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot transition from ${task.status} to ${input.status}`,
        });
      }

      // Prepare update data with timestamps
      const updateData: any = { status: input.status };

      if (input.status === AssessmentTaskStatus.IN_PROGRESS && !task.startedAt) {
        updateData.startedAt = new Date();
      }

      if (input.status === AssessmentTaskStatus.COMPLETED) {
        updateData.completedAt = new Date();
      }

      const updatedTask = await ctx.db.assessmentTask.update({
        where: { id: input.id },
        data: updateData,
        include: {
          assignedTo: {
            select: { id: true, name: true, email: true },
          },
          assignedBy: {
            select: { id: true, name: true, email: true },
          },
          businessUnit: {
            select: { id: true, name: true, code: true },
          },
          assessmentType: {
            select: { id: true, name: true },
          },
        },
      });

      return updatedTask;
    }),

  /**
   * Get Backlog Metrics
   *
   * Returns metrics for the unified backlog page.
   */
  getBacklogMetrics: organizationProcedure.query(async ({ ctx }) => {
    const baseWhere = {
      organizationId: ctx.organizationId,
      assignedToId: null,
      status: { in: [AssessmentTaskStatus.PENDING, AssessmentTaskStatus.IN_PROGRESS] },
    };

    const [total, overdue, byType, byPriority] = await Promise.all([
      ctx.db.assessmentTask.count({ where: baseWhere }),
      ctx.db.assessmentTask.count({
        where: {
          ...baseWhere,
          dueDate: { lt: new Date() },
        },
      }),
      ctx.db.assessmentTask.groupBy({
        by: ["unifiedType"],
        where: baseWhere,
        _count: true,
      }),
      ctx.db.assessmentTask.groupBy({
        by: ["priority"],
        where: baseWhere,
        _count: true,
      }),
    ]);

    return {
      total,
      overdue,
      byType: byType.reduce((acc, item) => {
        acc[item.unifiedType] = item._count;
        return acc;
      }, {} as Record<string, number>),
      byPriority: byPriority.reduce((acc, item) => {
        acc[item.priority] = item._count;
        return acc;
      }, {} as Record<string, number>),
    };
  }),
});
