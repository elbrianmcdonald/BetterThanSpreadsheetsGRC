import NextAuth from "next-auth";
import { cache } from "react";

import { authConfig } from "./config";

const { auth: uncachedAuth, handlers, signIn, signOut } = NextAuth(authConfig);

const auth = cache(uncachedAuth);

// Export as both `auth` and `getServerAuthSession` for compatibility
export { auth, handlers, signIn, signOut };
export { auth as getServerAuthSession };
