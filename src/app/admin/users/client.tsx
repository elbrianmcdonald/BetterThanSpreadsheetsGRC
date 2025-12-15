/**
 * User Management Client Component
 *
 * Client-side component for user management UI.
 * Separated from server component for interactivity.
 */

"use client";

import { useState } from "react";
import { UserList } from "@/components/user/UserList";
import { CreateUserDialog } from "@/components/user/CreateUserDialog";

export function UserManagementClient() {
  const [isCreating, setIsCreating] = useState(false);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold leading-6 text-gray-900">
            User Management
          </h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage users and roles for your organization. Only Organization
            Administrators can create, edit, or delete users.
          </p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="block rounded-md bg-blue-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Create User
          </button>
        </div>
      </div>

      <div className="mt-8 flow-root">
        <UserList />
      </div>

      {isCreating && (
        <CreateUserDialog
          onClose={() => setIsCreating(false)}
          onSuccess={() => setIsCreating(false)}
        />
      )}
    </div>
  );
}
