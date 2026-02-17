/**
 * Mock NextAuth for Tests
 *
 * Provides a simplified next-auth implementation for Jest tests.
 * Prevents ES module issues with the real next-auth package.
 */

import type { Session } from "next-auth";
import type { UserRole } from "@prisma/client";

// Mock session for testing
export const mockSession: Session = {
  user: {
    id: "test-user-id",
    name: "Test User",
    email: "test@example.com",
    role: "AUDITOR" as UserRole,
    organizationId: "test-org-id",
    assignedFrameworks: [], // Story 3.7: Auditor framework access
  },
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};

const NextAuth = jest.fn(() => ({
  handlers: {
    GET: jest.fn(),
    POST: jest.fn(),
  },
  auth: jest.fn(async () => mockSession),
  signIn: jest.fn(),
  signOut: jest.fn(),
}));

export default NextAuth;

// Named exports for next-auth
export const handlers = {
  GET: jest.fn(),
  POST: jest.fn(),
};

export const auth = jest.fn(async () => mockSession);
export const signIn = jest.fn();
export const signOut = jest.fn();
export const useSession = jest.fn(() => ({
  data: mockSession,
  status: "authenticated",
  update: jest.fn(),
}));
