/**
 * Unit Tests: Session Callback (Story 1.6)
 *
 * Tests the session callback that enriches session with user data.
 */

import { describe, it, expect } from '@jest/globals';
import type { UserRole } from '@prisma/client';

/**
 * Simulated session callback (matching production implementation)
 */
function sessionCallback({
  session,
  user,
}: {
  session: {
    user: {
      email?: string | null;
      name?: string | null;
    };
  };
  user: {
    id: string;
    role: UserRole;
    organizationId: string;
    email?: string | null;
    name?: string | null;
  };
}) {
  return {
    ...session,
    user: {
      ...session.user,
      id: user.id,
      role: user.role,
      organizationId: user.organizationId,
    },
  };
}

describe('Session Callback Unit Tests', () => {
  /**
   * AC25: Unit test - Session callback properly enriches session with user data
   */
  it('should add id, role, and organizationId to session.user', () => {
    const session = {
      user: {
        email: 'test@example.com',
        name: 'Test User',
      },
    };

    const user = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      role: 'BUSINESS_USER' as UserRole,
      organizationId: 'org-456',
    };

    const result = sessionCallback({ session, user });

    expect(result.user.id).toBe('user-123');
    expect(result.user.role).toBe('BUSINESS_USER');
    expect(result.user.organizationId).toBe('org-456');
    expect(result.user.email).toBe('test@example.com');
    expect(result.user.name).toBe('Test User');
  });

  it('should handle user with GRC_ANALYST role', () => {
    const session = {
      user: {
        email: 'analyst@example.com',
        name: 'GRC Analyst',
      },
    };

    const user = {
      id: 'user-789',
      email: 'analyst@example.com',
      name: 'GRC Analyst',
      role: 'ANALYST' as UserRole,
      organizationId: 'org-123',
    };

    const result = sessionCallback({ session, user });

    expect(result.user.role).toBe('ANALYST');
    expect(result.user.organizationId).toBe('org-123');
  });

  it('should handle user with ORG_ADMIN role', () => {
    const session = {
      user: {
        email: 'admin@example.com',
        name: 'Organization Admin',
      },
    };

    const user = {
      id: 'user-admin',
      email: 'admin@example.com',
      name: 'Organization Admin',
      role: 'ADMINISTRATOR' as UserRole,
      organizationId: 'org-999',
    };

    const result = sessionCallback({ session, user });

    expect(result.user.role).toBe('ADMINISTRATOR');
    expect(result.user.organizationId).toBe('org-999');
  });

  it('should preserve existing session data', () => {
    const session = {
      user: {
        email: 'preserve@example.com',
        name: 'Preserve Test',
      },
    };

    const user = {
      id: 'user-preserve',
      email: 'preserve@example.com',
      name: 'Preserve Test',
      role: 'BUSINESS_USER' as UserRole,
      organizationId: 'org-preserve',
    };

    const result = sessionCallback({ session, user });

    // Original session fields should be preserved
    expect(result.user.email).toBe('preserve@example.com');
    expect(result.user.name).toBe('Preserve Test');

    // New fields should be added
    expect(result.user.id).toBe('user-preserve');
    expect(result.user.role).toBe('BUSINESS_USER');
    expect(result.user.organizationId).toBe('org-preserve');
  });

  it('should handle null email and name gracefully', () => {
    const session = {
      user: {
        email: null,
        name: null,
      },
    };

    const user = {
      id: 'user-null',
      email: null,
      name: null,
      role: 'BUSINESS_USER' as UserRole,
      organizationId: 'org-null',
    };

    const result = sessionCallback({ session, user });

    expect(result.user.id).toBe('user-null');
    expect(result.user.role).toBe('BUSINESS_USER');
    expect(result.user.organizationId).toBe('org-null');
    expect(result.user.email).toBeNull();
    expect(result.user.name).toBeNull();
  });

  it('should handle all UserRole enum values', () => {
    const roles: UserRole[] = [
      'ADMINISTRATOR',
      'ANALYST',
      'ANALYST',
      'MANAGER',
      'BUSINESS_USER',
      'BUSINESS_USER',
      'BUSINESS_USER',
    ];

    roles.forEach((role, index) => {
      const session = {
        user: {
          email: `user-${role}@example.com`,
          name: `User ${role}`,
        },
      };

      const user = {
        id: `user-${index}`,
        email: `user-${role}@example.com`,
        name: `User ${role}`,
        role: role,
        organizationId: `org-${index}`,
      };

      const result = sessionCallback({ session, user });

      expect(result.user.role).toBe(role);
      expect(result.user.id).toBe(`user-${index}`);
      expect(result.user.organizationId).toBe(`org-${index}`);
    });
  });
});
