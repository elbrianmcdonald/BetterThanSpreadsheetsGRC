import { PrismaAdapter } from "@auth/prisma-adapter";
import { type DefaultSession, type NextAuthConfig } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { type UserRole } from "@prisma/client";

import { db } from "@/server/db";
import { env } from "@/env";
import { resolveActiveRole } from "@/server/services/organization/access";
import { verifyPassword } from "@/server/services/auth/passwordService";
import {
  isRateLimited,
  recordLoginAttempt,
  clearFailedAttempts,
  getRemainingAttempts,
} from "@/server/services/auth/rateLimitService";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      role: UserRole;
      organizationId: string;
      // Story 3.7: Assigned framework codes for auditor role access control
      assignedFrameworks: string[];
      // Role Consolidation Epic 2: staff platform role (all-org authority), or null
      // for org-bound Business Users. platformRole === ADMINISTRATOR is the platform admin.
      platformRole?: UserRole | null;
    } & DefaultSession["user"];
  }

  interface User {
    role: UserRole;
    organizationId: string;
    // Story 3.7: Assigned framework codes for auditor role access control
    assignedFrameworks: string[];
    // Role Consolidation Epic 2: staff platform role
    platformRole?: UserRole | null;
  }
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authConfig = {
  providers: [
    /**
     * Credentials Provider for Local Authentication
     *
     * Allows users to sign in with email and password.
     * Passwords are hashed with bcrypt (12 salt rounds) and stored in the database.
     */
    CredentialsProvider({
      id: 'credentials',
      name: 'Email and Password',
      credentials: {
        email: {
          label: 'Email',
          type: 'email',
          placeholder: 'user@example.com',
        },
        password: {
          label: 'Password',
          type: 'password',
        },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required');
        }

        const email = credentials.email as string;

        // Check rate limit
        const rateLimited = await isRateLimited(email);
        if (rateLimited) {
          const remaining = await getRemainingAttempts(email);
          throw new Error(
            'Too many failed login attempts. Please try again in 15 minutes.'
          );
        }

        // Find user by email
        const user = await db.user.findUnique({
          where: { email },
          include: { Organization: true },
        });

        if (!user) {
          // Record failed attempt
          await recordLoginAttempt(email, false);

          // Don't reveal whether user exists or password is wrong (security best practice)
          throw new Error('Invalid email or password');
        }

        // Check if user has a hashed password (local auth user)
        if (!user.hashedPassword) {
          // Record failed attempt
          await recordLoginAttempt(email, false);
          throw new Error('This account uses SSO authentication');
        }

        // Verify password
        const isValidPassword = await verifyPassword(
          credentials.password as string,
          user.hashedPassword
        );

        if (!isValidPassword) {
          // Record failed attempt
          await recordLoginAttempt(email, false);

          const remaining = await getRemainingAttempts(email);
          if (remaining > 0) {
            throw new Error(
              `Invalid email or password. ${remaining} attempts remaining.`
            );
          } else {
            throw new Error(
              'Invalid email or password. Account locked for 15 minutes due to too many failed attempts.'
            );
          }
        }

        // Success - record successful attempt and clear failed attempts
        await recordLoginAttempt(email, true);
        await clearFailedAttempts(email);

        // Role Consolidation Epic 2: role is derived — platformRole for staff, or
        // BUSINESS_USER via org membership. No stored User.role.
        const activeRole =
          (await resolveActiveRole(db, user.id, user.organizationId)) ??
          UserRole.BUSINESS_USER;

        // Return user object (NextAuth will create session)
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: activeRole,
          organizationId: user.organizationId,
          // Story 3.7: Include assigned frameworks for auditor role access control
          assignedFrameworks: user.assignedFrameworks ?? [],
          // Role Consolidation Epic 2: staff platform role (all-org authority)
          platformRole: user.platformRole ?? null,
        };
      },
    }),
  ],
  /**
   * Session Configuration (Story 1.6)
   *
   * JWT-based session strategy for Credentials provider:
   * - Sessions stored in JWT tokens (required for Credentials provider)
   * - 24-hour expiry aligns with NFR13 compliance
   * - CSRF protection built-in via NextAuth.js
   *
   * Note: Credentials provider does not support database sessions.
   * For SSO providers in Epic 6, we can use database sessions.
   */
  session: {
    strategy: "jwt", // JWT sessions (required for Credentials provider)
    maxAge: 24 * 60 * 60, // 24 hours (86400 seconds) - NFR13: Session expires after 24 hours of inactivity
    updateAge: 60 * 60,   // 1 hour - Extend session expiry on activity every hour
  },
  callbacks: {
    /**
     * JWT Callback
     *
     * For Credentials provider, we need to add user data to the JWT token
     * since we're not using the database adapter for Credentials auth.
     */
    async jwt({ token, user, trigger, session }) {
      // On sign-in, add user data to token
      if (user) {
        token.id = user.id;
        // Role Consolidation Epic 2: role is the derived active role (platformRole
        // for staff, else BUSINESS_USER); platformRole marks all-org staff scope.
        token.platformRole = user.platformRole ?? null;
        token.role = user.role;
        token.organizationId = user.organizationId;
        // Story 3.7: Include assigned frameworks for auditor role access control
        token.assignedFrameworks = user.assignedFrameworks ?? [];
      }

      // Multi-Tenancy Epic 1 (Story 1.3): the client calls `update({ organizationId })`
      // to switch companies. Re-validate access server-side here (NFR5) — a forged
      // target the user cannot access is ignored, leaving the claim unchanged.
      if (trigger === "update" && token.id) {
        const requestedOrgId = (session as { organizationId?: string } | undefined)
          ?.organizationId;
        if (requestedOrgId && requestedOrgId !== token.organizationId) {
          const role = await resolveActiveRole(db, token.id as string, requestedOrgId);
          if (role) {
            token.organizationId = requestedOrgId;
            token.role = role;
          }
        }
      }

      return token;
    },
    /**
     * Session Callback
     *
     * Enriches session with user data from JWT token (for Credentials provider)
     * or from database (for future SSO providers).
     */
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.organizationId = token.organizationId as string;
        // Story 3.7: Include assigned frameworks for auditor role access control
        session.user.assignedFrameworks = (token.assignedFrameworks as string[]) ?? [];
        // Role Consolidation Epic 2: staff platform role (ADMINISTRATOR = platform admin)
        session.user.platformRole = (token.platformRole as UserRole | null) ?? null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login", // Custom login page
    error: "/auth/error", // Custom error page for OAuth failures
  },
} satisfies NextAuthConfig;
