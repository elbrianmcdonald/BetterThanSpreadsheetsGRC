/**
 * Cleanup Expired Sessions Script
 *
 * Deletes expired sessions from the database to prevent bloat.
 * Should be run via cron job: 0 STAR/6 * * * (every 6 hours)
 * Replace STAR with asterisk in crontab
 *
 * Usage: npx tsx scripts/cleanup-expired-sessions.ts
 */

import { db } from '../src/server/db';
import { fileURLToPath } from 'url';

export async function cleanupExpiredSessions() {
  try {
    console.log('[SESSION-CLEANUP] Starting expired session cleanup...');

    const result = await db.session.deleteMany({
      where: {
        expires: {
          lt: new Date(), // Less than current time = expired
        },
      },
    });

    console.log(`[SESSION-CLEANUP] Deleted ${result.count} expired sessions`);
    return result.count;
  } catch (error) {
    console.error('[SESSION-CLEANUP] Error during cleanup:', error);
    throw error;
  } finally {
    await db.$disconnect();
  }
}

// Run cleanup if executed directly (ESM-compatible)
const isMainModule = process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  cleanupExpiredSessions()
    .then((count) => {
      console.log(`[SESSION-CLEANUP] Cleanup complete. Deleted ${count} sessions.`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('[SESSION-CLEANUP] Cleanup failed:', error);
      process.exit(1);
    });
}
