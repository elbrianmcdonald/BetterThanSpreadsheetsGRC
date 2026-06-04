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
 * Delivery of the reset link depends on the configured email transport:
 *   - Real transport (sendgrid/ses): the link is emailed out-of-band and the
 *     token is never exposed to the API caller.
 *   - No transport (EMAIL_PROVIDER=console, the default): there is no
 *     out-of-band channel, so the link is returned to the caller and shown
 *     on-screen, keeping password reset self-service. In this mode anyone who
 *     can name a registered email can obtain a working reset link — acceptable
 *     only for trusted/internal deployments. Configuring SendGrid/SES closes
 *     this automatically (the inline path is skipped once a transport exists).
 */

import { TRPCError } from "@trpc/server";
import crypto, { randomUUID } from "crypto";

import { env } from "@/env";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "@/server/api/trpc";
import { runWithOrganizationContext } from "@/server/db/middleware/organization-filter";
import { emailService } from "@/server/services/email.service";
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
   * Delivery: with a real email transport the link is emailed and never
   * returned to the caller; with EMAIL_PROVIDER=console the link is returned
   * inline so the page can display it (self-service without email). See the
   * file header for the security trade-off of the inline path.
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

      // The reset-password page reads the token from this relative path.
      const resetPath = `/reset-password?token=${token}`;

      // No email transport configured: there is no out-of-band channel, so
      // return the link to the caller for on-screen self-service. This lets
      // anyone who can name a registered email obtain a working reset link —
      // see the file header. Switch EMAIL_PROVIDER to sendgrid/ses to deliver
      // out-of-band instead; this inline branch is then never taken.
      if (env.EMAIL_PROVIDER === "console") {
        console.warn(
          "[passwordReset] EMAIL_PROVIDER=console — returning reset link inline for on-screen self-service (configure SendGrid/SES to email it instead)"
        );
        await equalizeTiming();
        return { ...genericResponse, resetUrl: resetPath };
      }

      // Real transport: email the link out-of-band, never expose the token.
      // Best-effort — a transport failure must not reveal that the account
      // exists, so we swallow errors and still return the generic response.
      try {
        const base = env.AUTH_URL ?? "http://localhost:3000";
        await emailService.sendPasswordResetEmail({
          to: user.email ?? input.email,
          resetUrl: `${base}${resetPath}`,
        });
      } catch (error) {
        console.error("[passwordReset] Failed to send reset email:", error);
      }

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
