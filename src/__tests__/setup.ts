/**
 * Jest Test Setup
 *
 * This file runs before all tests to set up the test environment.
 */

// Polyfill TextEncoder/TextDecoder for the jsdom test environment. jsdom does
// not provide them, but transitive deps of `@prisma/client` (@noble/hashes) need
// TextEncoder at import time — without this, every `.tsx` (jsdom) suite that
// imports anything from `@prisma/client` fails to load. Node already defines
// them globally, so this is a no-op there.
import { TextEncoder, TextDecoder } from "node:util";
const globalForEncoding = globalThis as unknown as {
  TextEncoder?: unknown;
  TextDecoder?: unknown;
};
if (typeof globalForEncoding.TextEncoder === "undefined") {
  globalForEncoding.TextEncoder = TextEncoder;
}
if (typeof globalForEncoding.TextDecoder === "undefined") {
  globalForEncoding.TextDecoder = TextDecoder;
}

// Import jest-dom matchers for better assertions
import '@testing-library/jest-dom';

// Import jest-axe matchers for accessibility testing
import 'jest-axe/extend-expect';

// Ensure we're using the test database
if (process.env.NODE_ENV !== 'test') {
  Object.defineProperty(process.env, 'NODE_ENV', {
    value: 'test',
    writable: true,
  });
}

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
