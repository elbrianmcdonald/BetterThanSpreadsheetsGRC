/**
 * Cleanup Old Login Attempts Script
 *
 * Deletes login attempts older than 15 minutes to prevent database bloat.
 * Should be run via cron job: STAR/15 * * * * (every 15 minutes)
 * Replace STAR with asterisk in crontab
 *
 * Usage: npx tsx scripts/cleanup-login-attempts.ts
 */

import { cleanupOldAttempts } from '../src/server/services/auth/rateLimitService';
import { fileURLToPath } from 'url';

async function runCleanup() {
  try {
    console.log('[LOGIN-CLEANUP] Starting login attempts cleanup...');

    const count = await cleanupOldAttempts();

    console.log(`[LOGIN-CLEANUP] Deleted ${count} old login attempts`);
    return count;
  } catch (error) {
    console.error('[LOGIN-CLEANUP] Error during cleanup:', error);
    throw error;
  }
}

// Run cleanup if executed directly (ESM-compatible)
const isMainModule = process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  runCleanup()
    .then((count) => {
      console.log(`[LOGIN-CLEANUP] Cleanup complete. Deleted ${count} attempts.`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('[LOGIN-CLEANUP] Cleanup failed:', error);
      process.exit(1);
    });
}
