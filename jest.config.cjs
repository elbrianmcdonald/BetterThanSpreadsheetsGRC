/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^@/env$': '<rootDir>/src/__tests__/__mocks__/env.ts',
    '^superjson$': '<rootDir>/src/__tests__/__mocks__/superjson.ts',
    '^next-auth$': '<rootDir>/src/__tests__/__mocks__/next-auth.ts',
    '^next-auth/react$': '<rootDir>/src/__tests__/__mocks__/next-auth.ts',
    '^next-auth/providers/discord$': '<rootDir>/src/__tests__/__mocks__/next-auth/providers/discord.ts',
    '^@auth/prisma-adapter$': '<rootDir>/src/__tests__/__mocks__/@auth/prisma-adapter.ts',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          moduleResolution: 'node',
          module: 'ES2022',
          target: 'ES2022',
        },
      },
    ],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(superjson|@t3-oss|@trpc)/)',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
  ],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  testTimeout: 30000,
};

module.exports = config;
