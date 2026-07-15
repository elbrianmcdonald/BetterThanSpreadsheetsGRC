/**
 * EditUserDialog Component
 *
 * Dialog form for editing an existing user.
 * Pre-fills form with current user data.
 *
 * Story 7.0.4: Added Business Unit field (AC6-AC10)
 */

"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { api } from "@/trpc/react";
import { UserRole } from "@prisma/client";
import { roleDisplayConfig } from "@/schemas/user";

interface EditUserDialogProps {
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditUserDialog({
  userId,
  onClose,
  onSuccess,
}: EditUserDialogProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>(UserRole.BUSINESS_USER);
  // Admin password change
  const [newPassword, setNewPassword] = useState("");
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch user data
  const { data: user, isLoading } = api.user.getUserById.useQuery({
    id: userId,
  });

  // Pre-fill form when user data loads
  useEffect(() => {
    if (user) {
      setName(user.name ?? "");
      setEmail(user.email ?? "");
      setRole(user.role);
    }
  }, [user]);

  const utils = api.useUtils();

  const updateUserMutation = api.user.updateUser.useMutation({
    onMutate: async (updatedUser) => {
      // Cancel outgoing refetches
      await utils.user.listUsers.cancel();

      // Snapshot previous value
      const previousUsers = utils.user.listUsers.getData();

      // Optimistically update the user in the list
      if (previousUsers) {
        utils.user.listUsers.setData(
          { skip: 0, take: 50 },
          (old) => {
            if (!old) return old;
            return {
              ...old,
              users: old.users.map((u) =>
                u.id === updatedUser.id
                  ? { ...u, ...updatedUser }
                  : u
              ),
            };
          }
        );
      }

      return { previousUsers };
    },
    onError: (err, updatedUser, context) => {
      // Rollback on error
      if (context?.previousUsers) {
        utils.user.listUsers.setData({ skip: 0, take: 50 }, context.previousUsers);
      }
      toast.error(err.message);
      setError(err.message);
    },
    onSuccess: (data) => {
      toast.success(`User "${data.name}" updated successfully!`);
      setNewPassword("");
      setShowPasswordSection(false);
      onSuccess();
    },
    onSettled: () => {
      // Refetch to ensure consistency
      void utils.user.listUsers.invalidate();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    updateUserMutation.mutate({
      id: userId,
      name,
      email,
      role,
      ...(newPassword ? { newPassword } : {}),
    });
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-10 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-center shadow-xl sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
            <p className="mt-2 text-sm text-gray-600">Loading user data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-10 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />

        {/* Dialog */}
        <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
          <div>
            <div className="mt-3 text-center sm:mt-5">
              <h3 className="text-base font-semibold leading-6 text-gray-900">
                Edit User
              </h3>
              <div className="mt-2">
                <p className="text-sm text-gray-500">
                  Update user information and role.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 sm:mt-6 space-y-4">
            {/* Error Message */}
            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      Error updating user
                    </h3>
                    <div className="mt-2 text-sm text-red-700">
                      <p>{error}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Name Input */}
            <div>
              <label
                htmlFor="edit-name"
                className="block text-sm font-medium leading-6 text-gray-900"
              >
                Name
              </label>
              <div className="mt-2">
                <input
                  type="text"
                  id="edit-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                />
              </div>
            </div>

            {/* Email Input */}
            <div>
              <label
                htmlFor="edit-email"
                className="block text-sm font-medium leading-6 text-gray-900"
              >
                Email
              </label>
              <div className="mt-2">
                <input
                  type="email"
                  id="edit-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                />
              </div>
            </div>

            {/* Role Select */}
            <div>
              <label
                htmlFor="edit-role"
                className="block text-sm font-medium leading-6 text-gray-900"
              >
                Role
              </label>
              <div className="mt-2">
                <select
                  id="edit-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                >
                  {Object.entries(roleDisplayConfig).map(([roleKey, config]) => (
                    <option key={roleKey} value={roleKey}>
                      {config.label} - {config.description}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Change Password (collapsible) */}
            <div>
              <button
                type="button"
                onClick={() => {
                  setShowPasswordSection(!showPasswordSection);
                  if (showPasswordSection) setNewPassword("");
                }}
                className="flex items-center text-sm font-medium text-blue-600 hover:text-blue-500"
              >
                <svg
                  className={`mr-1 h-4 w-4 transition-transform ${showPasswordSection ? "rotate-90" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
                Change Password
              </button>
              {showPasswordSection && (
                <div className="mt-2">
                  <input
                    type="password"
                    id="edit-new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Must be at least 12 characters with uppercase, lowercase, number, and special character.
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
              <button
                type="submit"
                disabled={updateUserMutation.isPending}
                className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:col-start-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updateUserMutation.isPending ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={updateUserMutation.isPending}
                className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
