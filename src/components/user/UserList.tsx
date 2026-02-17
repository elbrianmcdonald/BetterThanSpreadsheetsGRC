/**
 * UserList Component
 *
 * Displays a table of users in the current organization.
 * Includes actions for edit/delete (ORG_ADMIN only).
 *
 * Story 7.0.4: Added Business Unit column and filtering (AC1-AC5, AC11-AC15)
 */

"use client";

import { useState } from "react";
import { api } from "@/trpc/react";
import { RoleBadge } from "./RoleBadge";
import { EditUserDialog } from "./EditUserDialog";
import { DeleteUserDialog } from "./DeleteUserDialog";
import { BusinessUnitPath } from "./BusinessUnitPath";
import { BulkAssignBUDialog } from "./BulkAssignBUDialog";
import { ProtectedElement } from "@/components/rbac";
import { UserRole } from "@prisma/client";
import { useSession } from "next-auth/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export function UserList() {
  const { data: session } = useSession();
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 50;

  // Story 7.0.4: Business Unit filter state (AC4-AC5)
  const [buFilter, setBuFilter] = useState<string>("__all__");

  // Story 7.0.4: Bulk selection state (AC11-AC15)
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [isBulkAssignOpen, setIsBulkAssignOpen] = useState(false);

  // Fetch business units for filter dropdown
  const { data: buData } = api.businessUnit.list.useQuery({ includeInactive: false });

  // Build filter params based on buFilter state
  const filterParams = {
    skip: currentPage * pageSize,
    take: pageSize,
    ...(buFilter === "__unassigned__" ? { filterUnassigned: true } : {}),
    ...(buFilter !== "__all__" && buFilter !== "__unassigned__" ? { businessUnitId: buFilter } : {}),
  };

  // Query users from current organization with pagination and BU filter
  const { data, isLoading, error, refetch, isFetching } = api.user.listUsers.useQuery(filterParams);

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;
  const hasNextPage = currentPage < totalPages - 1;
  const hasPreviousPage = currentPage > 0;

  // Story 7.0.4: Selection handlers (AC11)
  const toggleUserSelection = (userId: string) => {
    const newSelection = new Set(selectedUserIds);
    if (newSelection.has(userId)) {
      newSelection.delete(userId);
    } else {
      newSelection.add(userId);
    }
    setSelectedUserIds(newSelection);
  };

  const toggleAllSelection = () => {
    if (!data?.users) return;
    if (selectedUserIds.size === data.users.length) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(data.users.map((u) => u.id)));
    }
  };

  const handleBulkAssignSuccess = () => {
    setIsBulkAssignOpen(false);
    setSelectedUserIds(new Set());
    void refetch();
  };

  // Reset selection when filter changes
  const handleFilterChange = (value: string) => {
    setBuFilter(value);
    setCurrentPage(0);
    setSelectedUserIds(new Set());
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="text-sm text-gray-600">Loading users...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
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
            <h3 className="text-sm font-medium text-red-800">Error loading users</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error.message}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data || data.users.length === 0) {
    return (
      <div className="text-center py-12">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No users</h3>
        <p className="mt-1 text-sm text-gray-500">
          Get started by creating a new user.
        </p>
      </div>
    );
  }

  // Determine if we're refetching (not initial load)
  const isRefetching = isFetching && !isLoading;

  return (
    <>
      {/* Story 7.0.4: Filter Toolbar (AC4-AC5, AC11-AC12) */}
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label htmlFor="bu-filter" className="text-sm font-medium text-gray-700">
            Business Unit:
          </label>
          <Select value={buFilter} onValueChange={handleFilterChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Business Units" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Business Units</SelectItem>
              <SelectItem value="__unassigned__">Unassigned</SelectItem>
              {buData?.flatOptions.map((opt) => (
                <SelectItem key={opt.id} value={opt.id}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Bulk Action Button (AC12) */}
        <ProtectedElement role={UserRole.ORG_ADMIN}>
          <Button
            variant="outline"
            size="sm"
            disabled={selectedUserIds.size === 0}
            onClick={() => setIsBulkAssignOpen(true)}
          >
            Assign Business Unit ({selectedUserIds.size})
          </Button>
        </ProtectedElement>
      </div>

      <div className="relative">
        {/* Refetch Loading Overlay */}
        {isRefetching && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white bg-opacity-75 rounded-lg">
            <div className="flex items-center space-x-2">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
              <span className="text-sm font-medium text-gray-700">Refreshing...</span>
            </div>
          </div>
        )}

      <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-50">
            <tr>
              {/* Story 7.0.4: Checkbox column (AC11) */}
              <ProtectedElement role={UserRole.ORG_ADMIN}>
                <th scope="col" className="w-12 px-3 py-3.5">
                  <Checkbox
                    checked={data?.users && data.users.length > 0 && selectedUserIds.size === data.users.length}
                    onCheckedChange={toggleAllSelection}
                    aria-label="Select all users"
                  />
                </th>
              </ProtectedElement>
              <th
                scope="col"
                className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6"
              >
                Name
              </th>
              <th
                scope="col"
                className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
              >
                Email
              </th>
              <th
                scope="col"
                className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
              >
                Role
              </th>
              {/* Story 7.0.4: Business Unit column (AC1) */}
              <th
                scope="col"
                className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
              >
                Business Unit
              </th>
              <th
                scope="col"
                className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
              >
                Created
              </th>
              <ProtectedElement role={UserRole.ORG_ADMIN}>
                <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                  <span className="sr-only">Actions</span>
                </th>
              </ProtectedElement>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {data.users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                {/* Story 7.0.4: Row checkbox (AC11) */}
                <ProtectedElement role={UserRole.ORG_ADMIN}>
                  <td className="w-12 px-3 py-4">
                    <Checkbox
                      checked={selectedUserIds.has(user.id)}
                      onCheckedChange={() => toggleUserSelection(user.id)}
                      aria-label={`Select ${user.name || user.email}`}
                    />
                  </td>
                </ProtectedElement>
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                  {user.name || "(No name)"}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  {user.email}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  <RoleBadge role={user.role} />
                </td>
                {/* Story 7.0.4: Business Unit cell (AC2-AC3) */}
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  <BusinessUnitPath businessUnit={user.businessUnit} />
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <ProtectedElement role={UserRole.ORG_ADMIN}>
                  <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                    <button
                      onClick={() => setEditingUserId(user.id)}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeletingUserId(user.id)}
                      className="text-red-600 hover:text-red-900"
                      disabled={user.id === session?.user?.id}
                    >
                      Delete
                    </button>
                  </td>
                </ProtectedElement>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {data && data.total > pageSize && (
        <div className="mt-4 flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
          <div className="flex flex-1 justify-between sm:hidden">
            <button
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={!hasPreviousPage}
              className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={!hasNextPage}
              className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing{" "}
                <span className="font-medium">{currentPage * pageSize + 1}</span>{" "}
                to{" "}
                <span className="font-medium">
                  {Math.min((currentPage + 1) * pageSize, data.total)}
                </span>{" "}
                of <span className="font-medium">{data.total}</span> users
              </p>
            </div>
            <div>
              <nav
                className="isolate inline-flex -space-x-px rounded-md shadow-sm"
                aria-label="Pagination"
              >
                <button
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  disabled={!hasPreviousPage}
                  className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Previous</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
                <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300">
                  Page {currentPage + 1} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => p + 1)}
                  disabled={!hasNextPage}
                  className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Next</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Edit Dialog */}
      {editingUserId && (
        <EditUserDialog
          userId={editingUserId}
          onClose={() => setEditingUserId(null)}
          onSuccess={() => {
            setEditingUserId(null);
            void refetch();
          }}
        />
      )}

      {/* Delete Dialog */}
      {deletingUserId && (
        <DeleteUserDialog
          userId={deletingUserId}
          onClose={() => setDeletingUserId(null)}
          onSuccess={() => {
            setDeletingUserId(null);
            void refetch();
          }}
        />
      )}

      {/* Story 7.0.4: Bulk Assign BU Dialog (AC13-AC15) */}
      {isBulkAssignOpen && (
        <BulkAssignBUDialog
          userIds={Array.from(selectedUserIds)}
          onClose={() => setIsBulkAssignOpen(false)}
          onSuccess={handleBulkAssignSuccess}
        />
      )}
    </>
  );
}
