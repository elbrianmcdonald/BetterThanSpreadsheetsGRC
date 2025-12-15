/**
 * Mock Prisma Adapter for Tests
 *
 * Provides a mock Prisma adapter for NextAuth testing.
 * Prevents ES module issues with the real @auth/prisma-adapter package.
 */

export function PrismaAdapter(prisma: any) {
  return {
    createUser: jest.fn(async (data: any) => ({ id: "mock-user-id", ...data })),
    getUser: jest.fn(async (id: string) => null),
    getUserByEmail: jest.fn(async (email: string) => null),
    getUserByAccount: jest.fn(async (provider: any) => null),
    updateUser: jest.fn(async (user: any) => user),
    deleteUser: jest.fn(async (userId: string) => undefined),
    linkAccount: jest.fn(async (account: any) => account),
    unlinkAccount: jest.fn(async (provider: any) => undefined),
    createSession: jest.fn(async (session: any) => session),
    getSessionAndUser: jest.fn(async (sessionToken: string) => null),
    updateSession: jest.fn(async (session: any) => session),
    deleteSession: jest.fn(async (sessionToken: string) => undefined),
    createVerificationToken: jest.fn(async (token: any) => token),
    useVerificationToken: jest.fn(async (params: any) => null),
  };
}
