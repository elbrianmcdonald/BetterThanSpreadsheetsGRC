/**
 * Authentication Error Page
 *
 * Displays user-friendly error messages for OAuth callback failures.
 * Handles various authentication error scenarios.
 */

"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  // Map error codes to user-friendly messages
  const errorMessages: Record<string, { title: string; description: string }> = {
    Configuration: {
      title: "Configuration Error",
      description:
        "There is a problem with the server configuration. Please contact your system administrator.",
    },
    AccessDenied: {
      title: "Access Denied",
      description:
        "You do not have permission to sign in. Please contact your organization administrator.",
    },
    Verification: {
      title: "Verification Error",
      description:
        "The sign in link is no longer valid. It may have already been used or expired.",
    },
    OAuthSignin: {
      title: "OAuth Sign-In Error",
      description:
        "There was an error during the sign-in process. Please try again.",
    },
    OAuthCallback: {
      title: "OAuth Callback Error",
      description:
        "There was an error processing the authentication response. Please try signing in again.",
    },
    OAuthCreateAccount: {
      title: "Account Creation Error",
      description:
        "Unable to create your account. Please contact support if this persists.",
    },
    EmailCreateAccount: {
      title: "Email Account Error",
      description:
        "Unable to create an email account. Please try again or contact support.",
    },
    Callback: {
      title: "Callback Error",
      description:
        "There was an error during the authentication callback. Please try signing in again.",
    },
    Default: {
      title: "Authentication Error",
      description:
        "An unexpected error occurred during sign-in. Please try again.",
    },
  };

  const errorInfo = (error ? errorMessages[error] : null) ?? errorMessages.Default!;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        {/* Error Icon */}
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <svg
              className="h-10 w-10 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
        </div>

        {/* Error Message */}
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            {errorInfo.title}
          </h1>
          <p className="mt-4 text-base text-gray-600">{errorInfo.description}</p>

          {/* Error Code (for debugging) */}
          {error && (
            <p className="mt-2 text-sm text-gray-500">
              Error code: <code className="rounded bg-gray-100 px-2 py-1 text-xs font-mono">{error}</code>
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-8 space-y-3">
          <Link
            href="/login"
            className="flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Try signing in again
          </Link>

          <Link
            href="/"
            className="flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Go to home page
          </Link>
        </div>

        {/* Help Section */}
        <div className="mt-6 rounded-md bg-gray-100 p-4">
          <h3 className="text-sm font-medium text-gray-900">
            Need help?
          </h3>
          <div className="mt-2 text-sm text-gray-600">
            <p className="mb-2">If you continue to experience issues:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Verify you're using your organization's Microsoft account</li>
              <li>Check that you have access to the application</li>
              <li>Try clearing your browser cache and cookies</li>
              <li>Contact your system administrator for assistance</li>
            </ul>
          </div>
          <div className="mt-4">
            <a
              href="/help"
              className="text-sm font-medium text-blue-600 hover:text-blue-500"
            >
              Contact support →
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
            <p className="mt-4 text-sm text-gray-600">Loading...</p>
          </div>
        </div>
      }
    >
      <AuthErrorContent />
    </Suspense>
  );
}
