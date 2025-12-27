/**
 * Profile Client Component
 *
 * Story 7.0.4: Added Business Unit display (AC16-AC18)
 *
 * Client-side component that fetches user data including business unit.
 */

"use client";

import { api } from "@/trpc/react";
import { AppLayout } from "@/components/layout";
import { ChangePasswordForm } from "@/components/user/ChangePasswordForm";
import { BusinessUnitPath } from "@/components/user/BusinessUnitPath";
import { roleDisplayConfig } from "@/schemas/user";
import { Loader2 } from "lucide-react";

interface ProfileClientProps {
  userId: string;
}

export function ProfileClient({ userId }: ProfileClientProps) {
  const { data: user, isLoading, error } = api.user.getUserById.useQuery({
    id: userId,
  });

  if (isLoading) {
    return (
      <AppLayout breadcrumbs={[{ label: "Profile" }]}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (error || !user) {
    return (
      <AppLayout breadcrumbs={[{ label: "Profile" }]}>
        <div className="text-center text-red-500 py-12">
          Error loading profile: {error?.message ?? "User not found"}
        </div>
      </AppLayout>
    );
  }

  const roleConfig = roleDisplayConfig[user.role];

  return (
    <AppLayout breadcrumbs={[{ label: "Profile" }]}>
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Profile Settings
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage your account information and security settings
          </p>
        </div>

        {/* User Information */}
        <div className="mb-8 bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-base font-semibold leading-6 text-gray-900">
              Account Information
            </h3>
            <div className="mt-5 border-t border-gray-200">
              <dl className="divide-y divide-gray-200">
                <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5">
                  <dt className="text-sm font-medium text-gray-500">Name</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                    {user.name || "Not set"}
                  </dd>
                </div>
                <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5">
                  <dt className="text-sm font-medium text-gray-500">Email</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                    {user.email}
                  </dd>
                </div>
                <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5">
                  <dt className="text-sm font-medium text-gray-500">Role</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                    <span className="font-medium">{roleConfig?.label ?? user.role}</span>
                    {roleConfig?.description && (
                      <span className="ml-2 text-gray-500">
                        - {roleConfig.description}
                      </span>
                    )}
                  </dd>
                </div>
                {/* Story 7.0.4: Business Unit display (AC16-AC17) */}
                <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5">
                  <dt className="text-sm font-medium text-gray-500">Business Unit</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                    <BusinessUnitPath businessUnit={user.businessUnit} showUnassigned />
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>

        {/* Change Password */}
        <ChangePasswordForm />
      </div>
    </AppLayout>
  );
}
