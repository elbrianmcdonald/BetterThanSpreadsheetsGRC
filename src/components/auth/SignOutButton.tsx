/**
 * Sign Out Button Component
 *
 * Client-side button for signing out via NextAuth.
 * Invalidates the database session and redirects to login page.
 */

"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";

export function SignOutButton() {
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut({ callbackUrl: "/login" });
    } catch (error) {
      console.error("Sign-out error:", error);
      setIsSigningOut(false);
    }
  };

  return (
    <button
      onClick={handleSignOut}
      disabled={isSigningOut}
      className="inline-flex h-8 items-center rounded-md border border-input bg-card px-3 text-[12px] font-semibold text-foreground transition-colors hover:bg-secondary hover:border-muted-foreground/40 focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isSigningOut ? (
        <>
          <svg
            className="mr-2 h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          Signing out...
        </>
      ) : (
        <>
          <svg
            className="mr-2 h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
          Sign Out
        </>
      )}
    </button>
  );
}
