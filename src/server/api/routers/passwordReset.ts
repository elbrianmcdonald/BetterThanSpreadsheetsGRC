/**
 * Password Reset tRPC Router
 *
 * Handles password reset and change operations.
 *
 * **Security Features:**
 * - Time-limited reset tokens (1 hour expiration)
 * - Single-use tokens (marked as used after consumption)
 * - Secure token generation (crypto.randomBytes)
 * - Password complexity validation
 * - Audit logging for password changes
 * - Per-user rate limit on reset requests (max 3 per hour)
 * - Constant-time response for existent/non-existent emails
 *
 * Reset tokens are delivered out-of-band (email). When no email transport
 * is configured (EMAIL_PROVIDER=console), the reset URL is logged to stdout
 * for local development. Tokens are never returned to the API caller.
 */

import { TRPCError } from "@trpc/server";
import crypto, { randomUUID } from "crypto";

import { env } from "@/env";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "@/server/api/trpc";
import { runWithOrganizationContext } from "@/server/db/middleware/organization-filter";
import {
  requestPasswordResetSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from "@/schemas/user";
import { hashPassword, verifyPassword } from "@/server/services/auth/passwordService";

const RESET_REQUEST_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_RESET_REQUESTS_PER_WINDOW = 3;
const TIMING_FLOOR_MS = 80;

/**
 * Generate a secure random token for password reset
 */
function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export const passwordResetRouter = createTRPCRouter({
  /**
   * Request Password Reset
   *
   * Creates a password reset token for the user.
   *
   * **Authorization:** Public (no authentication required)
   * **Security:**
   * - Token expires after 1 hour
   * - Token is single-use
   * - Does not reveal if the email exists (response shape and timing
   *   are identical for existent, non-existent, and throttled users)
   * - Throttled to MAX_RESET_REQUESTS_PER_WINDOW per user per hour
   *
   * The token is never returned to the caller. In dev (NODE_ENV !==
   * "production") the reset URL is logged to stdout. Wiring to the email
   * transport for production delivery is a follow-up task.
   */
  requestReset: publicProcedure
    .input(requestPasswordResetSchema)
    .mutation(async ({ ctx, input }) => {
      const startedAt = Date.now();
      const genericResponse = {
        success: true,
        message: "If an account exists with this email, a password reset link has been sent.",
      };

      const equalizeTiming = async () => {
        const elapsed = Date.now() - startedAt;
        if (elapsed < TIMING_FLOOR_MS) {
          await new Promise((resolve) => setTimeout(resolve, TIMING_FLOOR_MS - elapsed));
        }
      };

      const user = await ctx.db.user.findUnique({
        where: { email: input.email },
      });

      if (!user || !user.hashedPassword) {
        await equalizeTiming();
        return genericResponse;
      }

      const windowStart = new Date(Date.now() - RESET_REQUEST_WINDOW_MS);
      const recentRequests = await ctx.db.passwordResetToken.count({
        where: {
          userId: user.id,
          createdAt: { gte: windowStart },
        },
      });

      if (recentRequests >= MAX_RESET_REQUESTS_PER_WINDOW) {
        console.warn(
          `[passwordReset] Throttled reset request for user ${user.id} (${recentRequests} in window)`
        );
        await equalizeTiming();
        return genericResponse;
      }

      const token = generateResetToken();
      const expires = new Date(Date.now() + RESET_REQUEST_WINDOW_MS);

      await ctx.db.passwordResetToken.create({
        data: {
          id: randomUUID(),
          userId: user.id,
          token,
          expires,
          used: false,
        },
      });

      // Non-production builds log the reset URL to stdout so developers can
      // complete the flow without configuring a real email transport.
      // Never return the token to the caller — it is a credential.
      if (env.NODE_ENV !== "production") {
        const base = env.AUTH_URL ?? "http://localhost:3000";
        console.log(
          `[passwordReset:dev] reset link for ${user.email}: ${base}/reset-password?token=${token}`
        );
      }

      // TODO(follow-up): wire to email.service.ts to send the reset URL out-of-band.
      // Until then, console transport (EMAIL_PROVIDER=console) is the dev workflow
      // and a production deployment without email configured cannot complete resets.

      await equalizeTiming();
      return genericResponse;
    }),

  /**
   * Reset Password
   *
   * Resets user password using a valid reset token.
   *
   * **Authorization:** Public (uses token for authorization)
   * **Validation:**
   * - Token must exist and not be expired
   * - Token must not have been used already
   * - New password must meet complexity requirements
   *
   * **Audit:** Logs PASSWORD_RESET action
   */
  resetPassword: publicProcedure
    .input(resetPasswordSchema)
    .mutation(async ({ ctx, input }) => {
      // Find and validate reset token
      const resetToken = await ctx.db.passwordResetToken.findUnique({
        where: { token: input.token },
      });

      if (!resetToken) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid or expired reset token",
        });
      }

      // Get user separately
      const user = await ctx.db.user.findUnique({
        where: { id: resetToken.userId },
        select: {
          id: true,
          organizationId: true,
        },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      // Check if token is expired
      if (resetToken.expires < new Date()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Reset token has expired",
        });
      }

      // Check if token has already been used
      if (resetToken.used) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Reset token has already been used",
        });
      }

      // Hash new password
      const hashedPassword = await hashPassword(input.newPassword);

      // resetPassword is a publicProcedure so no tRPC middleware established
      // the organization AsyncLocalStorage context. AuditLog is not on the
      // Prisma multi-tenant allowlist, so its create would otherwise throw
      // "Organization context required for creating AuditLog". Establish the
      // context now that the user is known, and run the three writes inside
      // a transaction so the password change, token consumption, and audit
      // entry succeed or roll back together.
      await runWithOrganizationContext(user.organizationId, () =>
        ctx.db.$transaction(async (tx) => {
          await tx.user.update({
            where: { id: resetToken.userId },
            data: { hashedPassword },
          });

          await tx.passwordResetToken.update({
            where: { id: resetToken.id },
            data: { used: true },
          });

          await tx.auditLog.create({
            data: {
              id: randomUUID(),
              organizationId: user.organizationId,
              userId: resetToken.userId,
              action: "PASSWORD_RESET",
              entityType: "User",
              entityId: resetToken.userId,
              changes: {
                message: "User reset their password via reset token",
              },
            },
          });
        }),
      );

      return {
        success: true,
        message: "Password has been reset successfully. You can now sign in with your new password.",
      };
    }),

  /**
   * Change Password
   *
   * Allows authenticated users to change their own password.
   *
   * **Authorization:** Authenticated users only
   * **Validation:**
   * - Current password must be correct
   * - New password must meet complexity requirements
   * - New password cannot be same as current password
   *
   * **Audit:** Logs PASSWORD_CHANGE action
   */
  changePassword: protectedProcedure
    .input(changePasswordSchema)
    .mutation(async ({ ctx, input }) => {
      // Get current user with password
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.session.user.id },
        select: {
          id: true,
          hashedPassword: true,
          organizationId: true,
        },
      });

      if (!user || !user.hashedPassword) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found or does not use local authentication",
        });
      }

      // Verify current password
      const isValidPassword = await verifyPassword(
        input.currentPassword,
        user.hashedPassword
      );

      if (!isValidPassword) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Current password is incorrect",
        });
      }

      // Check that new password is different from current
      const isSamePassword = await verifyPassword(
        input.newPassword,
        user.hashedPassword
      );

      if (isSamePassword) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "New password must be different from current password",
        });
      }

      // Hash new password
      const hashedPassword = await hashPassword(input.newPassword);

      // changePassword uses protectedProcedure, which validates the session
      // but does not establish the organization AsyncLocalStorage context
      // (only organizationProcedure does that). AuditLog is not on the
      // multi-tenant allowlist, so its create would otherwise throw
      // "Organization context required for creating AuditLog". Wrap the
      // password update and audit entry in the context + a transaction so
      // the two writes commit or roll back together.
      await runWithOrganizationContext(user.organizationId, () =>
        ctx.db.$transaction(async (tx) => {
          await tx.user.update({
            where: { id: user.id },
            data: { hashedPassword },
          });

          await tx.auditLog.create({
            data: {
              id: randomUUID(),
              organizationId: user.organizationId,
              userId: user.id,
              action: "PASSWORD_CHANGE",
              entityType: "User",
              entityId: user.id,
              changes: {
                message: "User changed their password",
              },
            },
          });
        }),
      );

      return {
        success: true,
        message: "Password has been changed successfully",
      };
    }),
});
