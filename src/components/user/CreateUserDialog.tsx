/**
 * CreateUserDialog Component
 *
 * Dialog form for creating a new user in the organization.
 * Validates input and shows success/error messages.
 */

"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { api } from "@/trpc/react";
import { UserRole } from "@prisma/client";
import { roleDisplayConfig } from "@/schemas/user";

interface CreateUserDialogProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateUserDialog({
  onClose,
  onSuccess,
}: CreateUserDialogProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>(UserRole.BUSINESS_USER);
  const [error, setError] = useState<string | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [passwordCopied, setPasswordCopied] = useState(false);

  const utils = api.useUtils();

  const copyPasswordToClipboard = async () => {
    if (generatedPassword) {
      try {
        await navigator.clipboard.writeText(generatedPassword);
        setPasswordCopied(true);
        toast.success("Password copied to clipboard!");
        setTimeout(() => setPasswordCopied(false), 3000);
      } catch (error) {
        toast.error("Failed to copy password");
      }
    }
  };

  const createUserMutation = api.user.createUser.useMutation({
    onMutate: async (newUser) => {
      // Cancel outgoing refetches
      await utils.user.listUsers.cancel();

      // Snapshot previous value
      const previousUsers = utils.user.listUsers.getData();

      // Optimistically update to the new value (Story 3.8: Include assignedFrameworks, Story 7.0.4: Include businessUnit)
      if (previousUsers) {
        utils.user.listUsers.setData(
          { skip: 0, take: 50 },
          (old) => {
            if (!old) return old;
            return {
              ...old,
              users: [
                {
                  id: "temp-id", // Temporary ID
                  name: newUser.name,
                  email: newUser.email,
                  role: newUser.role ?? UserRole.BUSINESS_USER, // Default to most-restrictive
                  // Role Consolidation Epic 2: staff carry platformRole; BUSINESS_USER is null.
                  platformRole:
                    newUser.role && newUser.role !== UserRole.BUSINESS_USER
                      ? newUser.role
                      : null,
                  assignedFrameworks: newUser.assignedFrameworks ?? [], // Story 3.8
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  // Story 7.0.4: Add businessUnit fields for type compatibility
                  businessUnitId: null,
                  businessUnit: null,
                },
                ...old.users,
              ],
              total: old.total + 1,
            };
          }
        );
      }

      return { previousUsers };
    },
    onError: (err, newUser, context) => {
      // Rollback on error
      if (context?.previousUsers) {
        utils.user.listUsers.setData({ skip: 0, take: 50 }, context.previousUsers);
      }
      toast.error(err.message);
      setError(err.message);
    },
    onSuccess: (data) => {
      // Capture generated password for one-time display
      if ('generatedPassword' in data) {
        setGeneratedPassword(data.generatedPassword as string);
      }
      toast.success(`User "${data.name}" created successfully!`);
    },
    onSettled: () => {
      // Refetch to ensure consistency
      void utils.user.listUsers.invalidate();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    createUserMutation.mutate({
      name,
      email,
      role,
    });
  };

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
                Create New User
              </h3>
              <div className="mt-2">
                <p className="text-sm text-gray-500">
                  Add a new user to your organization.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 sm:mt-6 space-y-4">
            {/* Password Display - One-time only */}
            {generatedPassword && (
              <div className="rounded-md bg-yellow-50 p-4 border-2 border-yellow-200">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-yellow-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3 flex-1">
                    <h3 className="text-sm font-medium text-yellow-800">
                      User Created - Save This Password Now!
                    </h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <p className="mb-3 font-semibold">
                        This password will only be shown once. Copy it now and securely communicate it to the new user.
                      </p>
                      <div className="flex items-center space-x-2 bg-yellow-100 rounded p-3">
                        <code className="flex-1 text-lg font-mono text-yellow-900 break-all">
                          {generatedPassword}
                        </code>
                        <button
                          type="button"
                          onClick={copyPasswordToClipboard}
                          className="inline-flex items-center rounded-md bg-yellow-600 px-4 py-2 text-sm font-semibold text-white hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 whitespace-nowrap"
                        >
                          {passwordCopied ? (
                            <>
                              <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Copied!
                            </>
                          ) : (
                            <>
                              <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                      <p className="mt-3 text-xs">
                        Once you close this dialog, you will not be able to retrieve this password again.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      Error creating user
                    </h3>
                    <div className="mt-2 text-sm text-red-700">
                      <p>{error}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Form fields - hide after user created */}
            {!generatedPassword && (
              <>
                {/* Name Input */}
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium leading-6 text-gray-900"
                  >
                    Name
                  </label>
                  <div className="mt-2">
                    <input
                      type="text"
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                      placeholder="John Doe"
                    />
                  </div>
                </div>

                {/* Email Input */}
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium leading-6 text-gray-900"
                  >
                    Email
                  </label>
                  <div className="mt-2">
                    <input
                      type="email"
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                      placeholder="john.doe@example.com"
                    />
                  </div>
                </div>

                {/* Role Select */}
                <div>
                  <label
                    htmlFor="role"
                    className="block text-sm font-medium leading-6 text-gray-900"
                  >
                    Role
                  </label>
                  <div className="mt-2">
                    <select
                      id="role"
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
                  <p className="mt-1 text-sm text-gray-500">
                    Default: Auditor (most restrictive role)
                  </p>
                </div>
              </>
            )}

            {/* Actions */}
            <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
              {generatedPassword ? (
                // After user created - show only close button
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:col-span-2"
                >
                  Close
                </button>
              ) : (
                // Before user created - show create and cancel buttons
                <>
                  <button
                    type="submit"
                    disabled={createUserMutation.isPending}
                    className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:col-start-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {createUserMutation.isPending ? "Creating..." : "Create User"}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={createUserMutation.isPending}
                    className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
