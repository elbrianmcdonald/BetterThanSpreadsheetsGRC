/**
 * Jest Test Setup
 *
 * This file runs before all tests to set up the test environment.
 */

// Ensure we're using the test database
process.env.NODE_ENV = 'test';

// Configure test database (use TEST_DATABASE_URL if set, otherwise append _test suffix)
if (!process.env.TEST_DATABASE_URL && process.env.DATABASE_URL) {
  // Create test database URL by appending _test to database name
  const dbUrl = process.env.DATABASE_URL;
  const testDbUrl = dbUrl.replace(
    /\/([^/?]+)(\?|$)/,
    '/$1_test$2'
  );
  process.env.DATABASE_URL = testDbUrl;
  console.log('ℹ️  Using test database:', testDbUrl.replace(/:[^:@]+@/, ':****@'));
} else if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  console.log('ℹ️  Using TEST_DATABASE_URL for testing');
}

// Timeout for database operations
jest.setTimeout(30000);
