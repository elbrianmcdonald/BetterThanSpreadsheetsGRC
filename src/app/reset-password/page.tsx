/**
 * Reset Password Page
 *
 * Allows users to set a new password using a valid reset token.
 * Validates password complexity and token validity.
 */

"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/trpc/react";
import Link from "next/link";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const resetPasswordMutation = api.passwordReset.resetPassword.useMutation({
    onSuccess: () => {
      setIsSuccess(true);
    },
  });

  useEffect(() => {
    if (!token) {
      // No token provided, redirect to forgot password
      router.push("/forgot-password");
    }
  }, [token, router]);

  const validatePassword = (password: string): boolean => {
    setPasswordError(null);

    if (password.length < 12) {
      setPasswordError("Password must be at least 12 characters long");
      return false;
    }
    if (!/[A-Z]/.test(password)) {
      setPasswordError("Password must contain at least one uppercase letter");
      return false;
    }
    if (!/[a-z]/.test(password)) {
      setPasswordError("Password must contain at least one lowercase letter");
      return false;
    }
    if (!/[0-9]/.test(password)) {
      setPasswordError("Password must contain at least one number");
      return false;
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      setPasswordError("Password must contain at least one special character");
      return false;
    }

    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    // Validate password complexity
    if (!validatePassword(newPassword)) {
      return;
    }

    // Submit password reset
    if (token) {
      resetPasswordMutation.mutate({
        token,
        newPassword,
      });
    }
  };

  if (!token) {
    return null; // Will redirect
  }

  if (isSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900">
              BetterThanSpreadsheetsGRC
            </h1>
            <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">
              Password Reset Successful
            </h2>
          </div>

          {/* Success Message */}
          <div className="rounded-md bg-green-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-green-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">
                  Your password has been reset successfully
                </h3>
                <div className="mt-2 text-sm text-green-700">
                  <p>You can now sign in with your new password.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Sign In Button */}
          <div>
            <Link
              href="/login"
              className="group relative flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">
            BetterThanSpreadsheetsGRC
          </h1>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">
            Set New Password
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Enter your new password below.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          {/* Error Message */}
          {(resetPasswordMutation.isError || passwordError) && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-red-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">
                    {passwordError || resetPasswordMutation.error?.message}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* New Password Input */}
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
              New Password
            </label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1 block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
              placeholder="Enter new password"
            />
          </div>

          {/* Confirm Password Input */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
              placeholder="Confirm new password"
            />
          </div>

          {/* Password Requirements */}
          <div className="rounded-md bg-blue-50 p-4">
            <p className="text-xs text-blue-700 font-medium mb-2">Password requirements:</p>
            <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
              <li>At least 12 characters long</li>
              <li>Contains uppercase letter</li>
              <li>Contains lowercase letter</li>
              <li>Contains number</li>
              <li>Contains special character</li>
            </ul>
          </div>

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              disabled={resetPasswordMutation.isPending}
              className="group relative flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
            </button>
          </div>

          {/* Back to Login */}
          <div className="text-center">
            <Link
              href="/login"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              Back to sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
