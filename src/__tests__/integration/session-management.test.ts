/**
 * Integration Tests: Session Management (Story 1.6)
 *
 * Tests database-backed session management including:
 * - Session creation on sign-in
 * - Session data persistence
 * - Session expiry (24 hours)
 * - Multi-device support
 * - Role update propagation
 * - Session revocation on sign-out
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { randomUUID } from 'crypto';
import { db } from '@/server/db';
import type { UserRole } from '@prisma/client';

describe('Session Management Integration Tests', () => {
  let testOrgId: string;
  let testUserId: string;

  beforeAll(async () => {
    // Cleanup any residual data from previous failed runs
    const existingOrg = await db.organization.findUnique({
      where: { slug: "test-org-session" },
    });
    if (existingOrg) {
      await db.session.deleteMany({ where: { User: { organizationId: existingOrg.id } } });
      await db.user.deleteMany({ where: { organizationId: existingOrg.id } });
      await db.organization.delete({ where: { id: existingOrg.id } });
    }

    // Create test organization
    const org = await db.organization.create({
      data: {
        id: randomUUID(),
        name: 'Test Org Session',
        slug: 'test-org-session',
        active: true,
        updatedAt: new Date(),
      },
    });
    testOrgId = org.id;

    // Create test user
    const user = await db.user.create({
      data: {
        id: randomUUID(),
        email: 'session-test@example.com',
        name: 'Session Test User',
        // Role Consolidation Epic 2: Business User → null platformRole (no role column).
        organizationId: testOrgId,
        updatedAt: new Date(),
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    // Cleanup test data
    await db.session.deleteMany({ where: { userId: testUserId } });
    await db.user.delete({ where: { id: testUserId } });
    await db.organization.delete({ where: { id: testOrgId } });
    await db.$disconnect();
  });

  beforeEach(async () => {
    // Clean up any existing sessions before each test
    await db.session.deleteMany({ where: { userId: testUserId } });
  });

  /**
   * AC19: Integration test - Session created in database on successful sign-in
   */
  it('should create session in database on sign-in', async () => {
    // Create a session (simulating NextAuth.js adapter behavior)
    const session = await db.session.create({
      data: {
        id: randomUUID(),
        sessionToken: 'test-session-token-1',
        userId: testUserId,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
      },
    });

    expect(session).toBeDefined();
    expect(session.userId).toBe(testUserId);
    expect(session.sessionToken).toBe('test-session-token-1');

    // Verify session exists in database
    const dbSession = await db.session.findUnique({
      where: { sessionToken: 'test-session-token-1' },
    });

    expect(dbSession).toBeDefined();
    expect(dbSession?.userId).toBe(testUserId);
  });

  /**
   * AC20: Integration test - Session includes all required fields
   */
  it('should include all required fields when fetching session with user', async () => {
    // Create session
    await db.session.create({
      data: {
        id: randomUUID(),
        sessionToken: 'test-session-token-2',
        userId: testUserId,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    // Fetch session with user data (simulating session callback)
    const session = await db.session.findUnique({
      where: { sessionToken: 'test-session-token-2' },
      include: { User: true },
    });

    expect(session).toBeDefined();
    expect(session?.User).toBeDefined();

    // Verify all required session fields
    expect(session?.User.id).toBeDefined();
    expect(session?.User.email).toBe('session-test@example.com');
    expect(session?.User.name).toBe('Session Test User');
    // Role Consolidation Epic 2: active role derives from platformRole (null => Business User).
    expect(session?.User.platformRole ?? 'BUSINESS_USER').toBe('BUSINESS_USER');
    expect(session?.User.organizationId).toBe(testOrgId);
  });

  /**
   * AC21: Integration test - Session expires after configured inactivity period
   */
  it('should expire after 24 hours of inactivity', async () => {
    const now = new Date();
    const expired = new Date(now.getTime() - 25 * 60 * 60 * 1000); // 25 hours ago (past expiry)

    // Create expired session
    await db.session.create({
      data: {
        id: randomUUID(),
        sessionToken: 'expired-session-token',
        userId: testUserId,
        expires: expired,
      },
    });

    // Query for expired sessions
    const expiredSessions = await db.session.findMany({
      where: {
        expires: {
          lt: now, // Less than now = expired
        },
      },
    });

    expect(expiredSessions.length).toBeGreaterThan(0);
    expect(expiredSessions[0]?.sessionToken).toBe('expired-session-token');
    expect(expiredSessions[0]?.expires.getTime()).toBeLessThan(now.getTime());
  });

  /**
   * AC22: Integration test - Sign-out invalidates session in database
   */
  it('should invalidate session on sign-out', async () => {
    // Create session
    const session = await db.session.create({
      data: {
        id: randomUUID(),
        sessionToken: 'signout-test-token',
        userId: testUserId,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    expect(session).toBeDefined();

    // Simulate sign-out by deleting session
    await db.session.delete({
      where: { sessionToken: 'signout-test-token' },
    });

    // Verify session no longer exists
    const deletedSession = await db.session.findUnique({
      where: { sessionToken: 'signout-test-token' },
    });

    expect(deletedSession).toBeNull();
  });

  /**
   * AC23: Integration test - Multiple concurrent sessions per user work correctly
   */
  it('should support multiple concurrent sessions per user (multi-device)', async () => {
    // Create multiple sessions for same user (different devices)
    const session1 = await db.session.create({
      data: {
        id: randomUUID(),
        sessionToken: 'device-1-token',
        userId: testUserId,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const session2 = await db.session.create({
      data: {
        id: randomUUID(),
        sessionToken: 'device-2-token',
        userId: testUserId,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    expect(session1.userId).toBe(testUserId);
    expect(session2.userId).toBe(testUserId);
    expect(session1.sessionToken).not.toBe(session2.sessionToken);

    // Verify both sessions exist
    const userSessions = await db.session.findMany({
      where: { userId: testUserId },
    });

    expect(userSessions.length).toBe(2);
  });

  /**
   * AC24: Integration test - Role updates reflected when fetching fresh session
   */
  it('should reflect role updates across all sessions', async () => {
    // Create session
    await db.session.create({
      data: {
        id: randomUUID(),
        sessionToken: 'role-update-token',
        userId: testUserId,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    // Fetch session with user (initial state)
    let session = await db.session.findUnique({
      where: { sessionToken: 'role-update-token' },
      include: { User: true },
    });

    // Role Consolidation Epic 2: active role derives from platformRole (null => Business User).
    expect(session?.User.platformRole ?? 'BUSINESS_USER').toBe('BUSINESS_USER');

    // Update user role (staff role writes platformRole)
    await db.user.update({
      where: { id: testUserId },
      data: { platformRole: 'ANALYST' as UserRole },
    });

    // Fetch session again (simulates next request)
    session = await db.session.findUnique({
      where: { sessionToken: 'role-update-token' },
      include: { User: true },
    });

    // Role should be updated (database is source of truth)
    expect(session?.User.platformRole ?? 'BUSINESS_USER').toBe('ANALYST');

    // Reset role for other tests (back to Business User => null platformRole)
    await db.user.update({
      where: { id: testUserId },
      data: { platformRole: null },
    });
  });

  /**
   * AC13: Integration test - Session data persists through server restarts
   */
  it('should persist session data in database (survives server restart)', async () => {
    // Create session
    const session = await db.session.create({
      data: {
        id: randomUUID(),
        sessionToken: 'persist-test-token',
        userId: testUserId,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    // Disconnect (simulating server restart)
    await db.$disconnect();

    // Reconnect and verify session still exists
    const persistedSession = await db.session.findUnique({
      where: { sessionToken: 'persist-test-token' },
    });

    expect(persistedSession).toBeDefined();
    expect(persistedSession?.userId).toBe(testUserId);
  });

  /**
   * AC15: Test - Expired sessions can be cleaned up
   */
  it('should cleanup expired sessions with cleanup script logic', async () => {
    const now = new Date();

    // Create mix of valid and expired sessions
    await db.session.create({
      data: {
        id: randomUUID(),
        sessionToken: 'valid-session',
        userId: testUserId,
        expires: new Date(now.getTime() + 24 * 60 * 60 * 1000), // Valid
      },
    });

    await db.session.create({
      data: {
        id: randomUUID(),
        sessionToken: 'expired-session-1',
        userId: testUserId,
        expires: new Date(now.getTime() - 1000), // Expired
      },
    });

    await db.session.create({
      data: {
        id: randomUUID(),
        sessionToken: 'expired-session-2',
        userId: testUserId,
        expires: new Date(now.getTime() - 5000), // Expired
      },
    });

    // Cleanup expired sessions (simulating cleanup script)
    const deleteResult = await db.session.deleteMany({
      where: {
        expires: {
          lt: now,
        },
      },
    });

    expect(deleteResult.count).toBe(2);

    // Verify only valid session remains
    const remainingSessions = await db.session.findMany({
      where: { userId: testUserId },
    });

    expect(remainingSessions.length).toBe(1);
    expect(remainingSessions[0]?.sessionToken).toBe('valid-session');
  });
});
