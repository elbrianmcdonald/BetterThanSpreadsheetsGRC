/**
 * Login Page
 *
 * Local authentication with email and password.
 * Users sign in with credentials created by Organization Administrators.
 */

import { Suspense } from "react";
import { LoginFormClient } from "./client";

// Force dynamic rendering to ensure proper hydration
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign In | BetterThanSpreadsheetsGRC",
  description: "Sign in to access the GRC platform",
};

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900">
              BetterThanSpreadsheetsGRC
            </h1>
            <p className="mt-2 text-sm text-gray-600">Loading...</p>
          </div>
        </div>
      }
    >
      <LoginFormClient />
    </Suspense>
  );
}
