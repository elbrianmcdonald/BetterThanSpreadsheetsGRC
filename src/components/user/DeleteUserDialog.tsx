/**
 * DeleteUserDialog Component
 *
 * Confirmation dialog for deleting a user.
 * Shows user info and requires explicit confirmation.
 */

"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { api } from "@/trpc/react";

interface DeleteUserDialogProps {
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function DeleteUserDialog({
  userId,
  onClose,
  onSuccess,
}: DeleteUserDialogProps) {
  const [error, setError] = useState<string | null>(null);

  // Fetch user data to show in confirmation
  const { data: user, isLoading } = api.user.getUserById.useQuery({
    id: userId,
  });

  const utils = api.useUtils();

  const deleteUserMutation = api.user.deleteUser.useMutation({
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await utils.user.listUsers.cancel();

      // Snapshot previous value
      const previousUsers = utils.user.listUsers.getData();

      // Optimistically remove the user from the list
      if (previousUsers) {
        utils.user.listUsers.setData(
          { skip: 0, take: 50 },
          (old) => {
            if (!old) return old;
            return {
              ...old,
              users: old.users.filter((u) => u.id !== variables.id),
              total: old.total - 1,
            };
          }
        );
      }

      return { previousUsers };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousUsers) {
        utils.user.listUsers.setData({ skip: 0, take: 50 }, context.previousUsers);
      }
      toast.error(err.message);
      setError(err.message);
    },
    onSuccess: () => {
      toast.success("User deleted successfully");
      onSuccess();
    },
    onSettled: () => {
      // Refetch to ensure consistency
      void utils.user.listUsers.invalidate();
    },
  });

  const handleDelete = () => {
    setError(null);
    deleteUserMutation.mutate({ id: userId });
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
          <div className="sm:flex sm:items-start">
            <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
              <svg
                className="h-6 w-6 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
            </div>
            <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
              <h3 className="text-base font-semibold leading-6 text-gray-900">
                Delete User
              </h3>
              <div className="mt-2">
                <p className="text-sm text-gray-500">
                  Are you sure you want to delete <strong>{user?.name}</strong> (
                  {user?.email})?
                </p>
                <p className="mt-2 text-sm text-gray-500">
                  This action cannot be undone. The user will lose access to the
                  system immediately.
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mt-4 rounded-md bg-red-50 p-4">
                  <div className="flex">
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">
                        Error deleting user
                      </h3>
                      <div className="mt-2 text-sm text-red-700">
                        <p>{error}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteUserMutation.isPending}
              className="inline-flex w-full justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 sm:ml-3 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleteUserMutation.isPending ? "Deleting..." : "Delete User"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={deleteUserMutation.isPending}
              className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
