/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */

import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { UserRole } from "@prisma/client";

import { auth } from "@/server/auth";
import { db } from "@/server/db";
import {
  hasPermission,
  Permission,
  type Permission as PermissionType,
} from "@/server/auth/permissions";
import { runWithOrganizationContext } from "@/server/db/middleware/organization-filter";

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */
export const createTRPCContext = async (opts: { headers: Headers }) => {
  const session = await auth();

  // Extract organizationId from session for multi-tenant data isolation
  // Session now includes organizationId (Story 1.4) - no DB query needed
  // All data access MUST be filtered by organizationId (see Architecture Decision Doc)
  const organizationId = session?.user?.organizationId ?? null;

  return {
    db,
    session,
    organizationId,
    ...opts,
  };
};

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get typesafety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * Create a server-side caller.
 *
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these a lot in the
 * "/src/server/api/routers" directory.
 */

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 *
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Middleware for timing procedure execution and adding an artificial delay in development.
 *
 * You can remove this if you don't like it, but it can help catch unwanted waterfalls by simulating
 * network latency that would occur in production but not in local development.
 */
const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();

  if (t._config.isDev) {
    // artificial delay in dev
    const waitMs = Math.floor(Math.random() * 400) + 100;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  const result = await next();

  const end = Date.now();
  console.log(`[TRPC] ${path} took ${end - start}ms to execute`);

  return result;
});

/**
 * Public (unauthenticated) procedure
 *
 * This is the base piece you use to build new queries and mutations on your tRPC API. It does not
 * guarantee that a user querying is authorized, but you can still access user session data if they
 * are logged in.
 */
export const publicProcedure = t.procedure.use(timingMiddleware);

/**
 * Protected (authenticated) procedure
 *
 * If you want a query or mutation to ONLY be accessible to logged in users, use this. It verifies
 * the session is valid and guarantees `ctx.session.user` is not null.
 *
 * @see https://trpc.io/docs/procedures
 */
export const protectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(({ ctx, next }) => {
    if (!ctx.session?.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return next({
      ctx: {
        // infers the `session` as non-nullable
        session: { ...ctx.session, user: ctx.session.user },
      },
    });
  });

/**
 * Organization-scoped (multi-tenant) procedure
 *
 * Use this for ALL procedures that access organization-specific data.
 * Enforces that the user is authenticated AND belongs to an organization.
 * Provides `ctx.organizationId` for automatic multi-tenant data filtering.
 *
 * CRITICAL: This procedure sets the organization context for the Prisma middleware,
 * which automatically filters ALL database queries by organizationId. Developers
 * no longer need to manually add organizationId filters - it's automatic!
 *
 * @see Story 1.9: Multi-Tenant Data Access Middleware
 * @see src/server/db/middleware/organization-filter.ts - Automatic filtering implementation
 * @see docs/MULTI_TENANCY.md - Complete multi-tenancy strategy
 */
export const organizationProcedure = t.procedure
  .use(timingMiddleware)
  .use(({ ctx, next }) => {
    if (!ctx.session?.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    if (!ctx.organizationId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "User must belong to an organization to access this resource",
      });
    }

    // Set organization context for Prisma middleware (Story 1.9)
    // All subsequent database queries in this request will be automatically
    // filtered by organizationId through AsyncLocalStorage context.
    // Using run() instead of enterWith() ensures context is preserved
    // through Prisma transactions which create new async contexts.
    return runWithOrganizationContext(ctx.organizationId!, () =>
      next({
        ctx: {
          // infers the `session` and `organizationId` as non-nullable
          session: { ...ctx.session!, user: ctx.session!.user },
          organizationId: ctx.organizationId!,
        },
      }),
    );
  });

/**
 * 4. RBAC MIDDLEWARE (Story 1.7)
 *
 * Role-Based Access Control middleware for fine-grained authorization.
 * These middleware functions enforce permission checks at the procedure level.
 */

/**
 * Authorization failure logging helper
 *
 * Logs failed authorization attempts to the AuditLog for security monitoring.
 * This helps detect potential security threats and unauthorized access attempts.
 *
 * Updated to use the new audit logging service (Story 1.10).
 *
 * @param params - Authorization failure details
 * @see Story 1.10: Audit Logging Infrastructure
 */
async function logAuthorizationFailure(params: {
  userId: string;
  organizationId: string;
  attemptedAction: string;
  requiredRoles?: UserRole[];
  userRole: UserRole;
  resourceId?: string;
}): Promise<void> {
  const { createAuditLog } = await import("@/server/services/audit-log.service");

  // Use fire-and-forget pattern (don't await)
  void createAuditLog({
    organizationId: params.organizationId,
    userId: params.userId,
    action: "AUTHORIZATION_FAILED",
    entityType: "Authorization",
    entityId: params.resourceId ?? "system",
    changes: {
      before: null,
      after: {
        attemptedAction: params.attemptedAction,
        requiredRoles: params.requiredRoles,
        userRole: params.userRole,
        timestamp: new Date().toISOString(),
      },
    },
  });
}

/**
 * Require specific roles middleware factory
 *
 * Creates a middleware that checks if the current user has one of the allowed roles.
 * Throws FORBIDDEN error if the user's role is not in the allowedRoles array.
 *
 * **Usage**:
 * ```typescript
 * export const adminOnlyProcedure = protectedProcedure.use(
 *   requireRole([UserRole.ADMINISTRATOR])
 * );
 * ```
 *
 * @param allowedRoles - Array of roles that are allowed to access the procedure
 * @returns Middleware function
 */
export function requireRole(allowedRoles: UserRole[]) {
  return t.middleware(({ ctx, next }) => {
    if (!ctx.session?.user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "You must be logged in to access this resource",
      });
    }

    const userRole = ctx.session.user.role;
    if (!allowedRoles.includes(userRole)) {
      // Log failed authorization attempt
      void logAuthorizationFailure({
        userId: ctx.session.user.id,
        organizationId: ctx.session.user.organizationId,
        attemptedAction: "role_check",
        requiredRoles: allowedRoles,
        userRole: userRole,
      });

      throw new TRPCError({
        code: "FORBIDDEN",
        message: `This action requires one of these roles: ${allowedRoles.join(", ")}. Your role: ${userRole}`,
      });
    }

    return next({ ctx });
  });
}

/**
 * Require specific permission middleware factory
 *
 * Creates a middleware that checks if the current user's role has the required permission.
 * Uses the Permission Matrix to determine if the user's role is allowed to perform the action.
 *
 * **Usage**:
 * ```typescript
 * export const createRiskProcedure = protectedProcedure.use(
 *   requirePermission(Permission.RISK_CREATE)
 * );
 * ```
 *
 * @param permission - Permission required to access the procedure
 * @returns Middleware function
 */
export function requirePermission(permission: PermissionType) {
  return t.middleware(({ ctx, next }) => {
    if (!ctx.session?.user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "You must be logged in to access this resource",
      });
    }

    const userRole = ctx.session.user.role;
    if (!hasPermission(userRole, permission)) {
      // Log failed authorization attempt
      void logAuthorizationFailure({
        userId: ctx.session.user.id,
        organizationId: ctx.session.user.organizationId,
        attemptedAction: permission,
        userRole: userRole,
      });

      throw new TRPCError({
        code: "FORBIDDEN",
        message: `You don't have permission to perform this action: ${permission}. Your role: ${userRole}`,
      });
    }

    return next({ ctx });
  });
}

/**
 * Verify resource belongs to user's organization
 *
 * Prevents cross-organization data access by checking that the resource's
 * organizationId matches the user's organizationId from the session.
 *
 * **Critical Security Function**: Always call this when accessing a resource by ID
 * to ensure multi-tenant data isolation.
 *
 * @param ctx - tRPC context with organizationId
 * @param resourceOrgId - Organization ID of the resource being accessed
 * @throws FORBIDDEN error if organizationIds don't match
 *
 * @example
 * ```typescript
 * const risk = await ctx.db.risk.findUnique({ where: { id: input.id } });
 * if (!risk) throw new TRPCError({ code: "NOT_FOUND" });
 *
 * // Critical: Verify resource belongs to user's organization
 * await ensureOrgAccess(ctx, risk.organizationId);
 * ```
 */
export async function ensureOrgAccess(
  ctx: { organizationId: string },
  resourceOrgId: string,
): Promise<void> {
  if (ctx.organizationId !== resourceOrgId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You don't have access to this resource",
    });
  }
}

/**
 * 5. ROLE-SPECIFIC PROCEDURES (Story 1.7)
 *
 * Pre-configured procedures for common role combinations.
 * These are convenience wrappers that combine organization context + role checks.
 *
 * **Usage**: Import the appropriate procedure in your router based on required role.
 */

/**
 * Admin-only procedure
 *
 * For procedures that only ORG_ADMIN can access (user management, org settings).
 *
 * @example
 * ```typescript
 * export const userRouter = createTRPCRouter({
 *   create: adminProcedure
 *     .input(createUserSchema)
 *     .mutation(async ({ ctx, input }) => {
 *       // Only ORG_ADMIN can reach here
 *     }),
 * });
 * ```
 */
export const adminProcedure = organizationProcedure.use(
  requireRole([UserRole.ADMINISTRATOR]),
);

/**
 * GRC Analyst procedure
 *
 * For procedures that require GRC_ANALYST role (evidence/risk management).
 *
 * @example
 * ```typescript
 * export const evidenceRouter = createTRPCRouter({
 *   create: analystProcedure
 *     .input(createEvidenceSchema)
 *     .mutation(async ({ ctx, input }) => {
 *       // Only GRC_ANALYST can reach here
 *     }),
 * });
 * ```
 */
export const analystProcedure = organizationProcedure.use(
  requireRole([UserRole.ANALYST]),
);

/**
 * Security Engineer procedure
 *
 * For procedures accessible to both SECURITY_ENGINEER and GRC_ANALYST.
 * Security Engineers can create risks from security findings.
 *
 * @example
 * ```typescript
 * export const riskRouter = createTRPCRouter({
 *   create: engineerProcedure
 *     .input(createRiskSchema)
 *     .mutation(async ({ ctx, input }) => {
 *       // SECURITY_ENGINEER or GRC_ANALYST can reach here
 *     }),
 * });
 * ```
 */
export const engineerProcedure = organizationProcedure.use(
  requireRole([UserRole.ANALYST, UserRole.ANALYST]),
);

/**
 * CISO procedure
 *
 * For procedures accessible to CISO and GRC_ANALYST (dashboards, reports).
 * CISO has read-only access for executive oversight.
 *
 * @example
 * ```typescript
 * export const dashboardRouter = createTRPCRouter({
 *   getCompliance: cisoProcedure
 *     .query(async ({ ctx }) => {
 *       // CISO or GRC_ANALYST can reach here
 *     }),
 * });
 * ```
 */
export const cisoProcedure = organizationProcedure.use(
  requireRole([UserRole.MANAGER, UserRole.ANALYST]),
);

/**
 * Stakeholder procedure
 *
 * For procedures accessible to IT_STAKEHOLDER and BUSINESS_STAKEHOLDER.
 * Used for risk assignment workflows.
 *
 * @example
 * ```typescript
 * export const riskRouter = createTRPCRouter({
 *   listAssignedToMe: stakeholderProcedure
 *     .query(async ({ ctx }) => {
 *       // IT_STAKEHOLDER or BUSINESS_STAKEHOLDER can reach here
 *     }),
 * });
 * ```
 */
export const stakeholderProcedure = organizationProcedure.use(
  requireRole([UserRole.BUSINESS_USER, UserRole.BUSINESS_USER]),
);

/**
 * Auditor procedure
 *
 * For read-only procedures accessible to external auditors.
 * Auditors have limited, read-only access to compliance data.
 *
 * @example
 * ```typescript
 * export const evidenceRouter = createTRPCRouter({
 *   listByFramework: auditorProcedure
 *     .input(z.object({ frameworkId: z.string() }))
 *     .query(async ({ ctx, input }) => {
 *       // AUDITOR can reach here (read-only)
 *     }),
 * });
 * ```
 */
export const auditorProcedure = organizationProcedure.use(
  requireRole([UserRole.BUSINESS_USER]),
);
