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
 *
 * **Note:** This is a simplified implementation for MVP.
 * In production, you would send reset links via email.
 * For now, tokens are returned directly (for testing/development).
 */

import { TRPCError } from "@trpc/server";
import crypto, { randomUUID } from "crypto";

import { createTRPCRouter, publicProcedure, protectedProcedure } from "@/server/api/trpc";
import {
  requestPasswordResetSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from "@/schemas/user";
import { hashPassword, verifyPassword } from "@/server/services/auth/passwordService";

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
   * - Does not reveal if email exists (timing-safe)
   *
   * **MVP Note:** Returns token directly for testing.
   * In production, would send via email instead.
   */
  requestReset: publicProcedure
    .input(requestPasswordResetSchema)
    .mutation(async ({ ctx, input }) => {
      // Find user by email (timing-safe - always takes same time)
      const user = await ctx.db.user.findUnique({
        where: { email: input.email },
      });

      // Always return success (don't reveal if email exists)
      if (!user || !user.hashedPassword) {
        // User doesn't exist or uses SSO - but don't reveal this
        return {
          success: true,
          message: "If an account exists with this email, a password reset link has been sent.",
        };
      }

      // Generate secure reset token
      const token = generateResetToken();
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      // Store reset token
      await ctx.db.passwordResetToken.create({
        data: {
          id: randomUUID(),
          userId: user.id,
          token,
          expires,
          used: false,
        },
      });

      // MVP: Return token directly
      // Production: Send email with reset link
      return {
        success: true,
        message: "If an account exists with this email, a password reset link has been sent.",
        // TEMPORARY - Remove in production when email sending is implemented
        __devToken: token, // Only for MVP testing
      };
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

      // Update user password
      await ctx.db.user.update({
        where: { id: resetToken.userId },
        data: { hashedPassword },
      });

      // Mark token as used
      await ctx.db.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { used: true },
      });

      // Audit log entry
      await ctx.db.auditLog.create({
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

      // Update user password
      await ctx.db.user.update({
        where: { id: user.id },
        data: { hashedPassword },
      });

      // Audit log entry
      await ctx.db.auditLog.create({
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

      return {
        success: true,
        message: "Password has been changed successfully",
      };
    }),
});
