/**
 * Rate Limiting Service
 *
 * Tracks and limits login attempts to prevent brute force attacks.
 *
 * **Security Features:**
 * - Max 5 failed attempts per 15 minutes per email
 * - Tracks both email and IP address
 * - Automatic cleanup of old attempts
 * - Audit logging for security monitoring
 *
 * **Rate Limit Policy:**
 * - Window: 15 minutes (900 seconds)
 * - Max attempts: 5
 * - Lockout duration: 15 minutes after 5th failed attempt
 */

import { randomUUID } from "crypto";
import { db } from "@/server/db";

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

/**
 * Check if email is rate limited
 *
 * Returns true if user has exceeded max failed attempts within the time window.
 */
export async function isRateLimited(email: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);

  // Count failed attempts in the window
  const failedAttempts = await db.loginAttempt.count({
    where: {
      email,
      success: false,
      timestamp: {
        gte: windowStart,
      },
    },
  });

  return failedAttempts >= MAX_ATTEMPTS;
}

/**
 * Get remaining attempts before rate limit
 *
 * Returns number of attempts remaining before rate limit kicks in.
 */
export async function getRemainingAttempts(email: string): Promise<number> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);

  const failedAttempts = await db.loginAttempt.count({
    where: {
      email,
      success: false,
      timestamp: {
        gte: windowStart,
      },
    },
  });

  return Math.max(0, MAX_ATTEMPTS - failedAttempts);
}

/**
 * Record login attempt
 *
 * Logs the login attempt for rate limiting tracking.
 */
export async function recordLoginAttempt(
  email: string,
  success: boolean,
  ipAddress?: string
): Promise<void> {
  await db.loginAttempt.create({
    data: {
      id: randomUUID(),
      email,
      success,
      ipAddress,
      timestamp: new Date(),
    },
  });
}

/**
 * Clear failed attempts for email
 *
 * Called after successful login to reset the rate limit counter.
 */
export async function clearFailedAttempts(email: string): Promise<void> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);

  await db.loginAttempt.deleteMany({
    where: {
      email,
      success: false,
      timestamp: {
        gte: windowStart,
      },
    },
  });
}

/**
 * Cleanup old login attempts
 *
 * Removes login attempts older than the rate limit window.
 * Should be run periodically (e.g., via cron job).
 */
export async function cleanupOldAttempts(): Promise<number> {
  const cutoffDate = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);

  const result = await db.loginAttempt.deleteMany({
    where: {
      timestamp: {
        lt: cutoffDate,
      },
    },
  });

  return result.count;
}
