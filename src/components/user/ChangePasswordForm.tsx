/**
 * Change Password Form Component
 *
 * Allows authenticated users to change their password.
 * Validates current password and enforces complexity requirements.
 */

"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { api } from "@/trpc/react";

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const changePasswordMutation = api.passwordReset.changePassword.useMutation({
    onSuccess: () => {
      toast.success("Password changed successfully!");
      // Reset form
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setError(null);
    },
    onError: (error) => {
      setError(error.message);
      toast.error(error.message);
    },
  });

  const validatePassword = (password: string): boolean => {
    setError(null);

    if (password.length < 12) {
      setError("Password must be at least 12 characters long");
      return false;
    }
    if (!/[A-Z]/.test(password)) {
      setError("Password must contain at least one uppercase letter");
      return false;
    }
    if (!/[a-z]/.test(password)) {
      setError("Password must contain at least one lowercase letter");
      return false;
    }
    if (!/[0-9]/.test(password)) {
      setError("Password must contain at least one number");
      return false;
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      setError("Password must contain at least one special character");
      return false;
    }

    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    // Validate password complexity
    if (!validatePassword(newPassword)) {
      return;
    }

    // Submit password change
    changePasswordMutation.mutate({
      currentPassword,
      newPassword,
    });
  };

  return (
    <div className="bg-white shadow sm:rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-base font-semibold leading-6 text-gray-900">
          Change Password
        </h3>
        <div className="mt-2 max-w-xl text-sm text-gray-500">
          <p>Update your password to keep your account secure.</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Error Message */}
          {error && (
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
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Current Password */}
          <div>
            <label
              htmlFor="currentPassword"
              className="block text-sm font-medium leading-6 text-gray-900"
            >
              Current Password
            </label>
            <div className="mt-2">
              <input
                type="password"
                id="currentPassword"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                placeholder="Enter current password"
              />
            </div>
          </div>

          {/* New Password */}
          <div>
            <label
              htmlFor="newPassword"
              className="block text-sm font-medium leading-6 text-gray-900"
            >
              New Password
            </label>
            <div className="mt-2">
              <input
                type="password"
                id="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                placeholder="Enter new password"
              />
            </div>
          </div>

          {/* Confirm New Password */}
          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium leading-6 text-gray-900"
            >
              Confirm New Password
            </label>
            <div className="mt-2">
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                placeholder="Confirm new password"
              />
            </div>
          </div>

          {/* Password Requirements */}
          <div className="rounded-md bg-blue-50 p-4">
            <p className="text-xs text-blue-700 font-medium mb-2">
              Password requirements:
            </p>
            <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
              <li>At least 12 characters long</li>
              <li>Contains uppercase letter</li>
              <li>Contains lowercase letter</li>
              <li>Contains number</li>
              <li>Contains special character</li>
            </ul>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={changePasswordMutation.isPending}
              className="inline-flex justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {changePasswordMutation.isPending ? "Changing..." : "Change Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
