/**
 * Mock Environment Variables for Tests
 *
 * This mock provides test-safe environment variables for Jest tests.
 * Prevents the real env.js from being loaded, which causes ES module issues.
 */

export const env = {
  // Server-side env vars
  AUTH_SECRET: "test-auth-secret-at-least-32-characters-long",
  AUTH_DISCORD_ID: undefined,
  AUTH_DISCORD_SECRET: undefined,
  DATABASE_URL: process.env.DATABASE_URL || "postgresql://test:test@localhost:5432/test_db",
  NODE_ENV: "test" as const,
};
