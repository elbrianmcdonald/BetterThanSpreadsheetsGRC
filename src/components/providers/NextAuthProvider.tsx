"use client";

/**
 * NextAuth Session Provider
 *
 * Client component wrapper for NextAuth SessionProvider.
 * Required for useSession() hook to work in client components.
 */

import { SessionProvider } from "next-auth/react";

export function NextAuthProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
