/**
 * Profile Client Component
 *
 * Story 7.0.4: Added Business Unit display (AC16-AC18)
 *
 * Client-side component that fetches user data including business unit.
 */

"use client";

import { api } from "@/trpc/react";
import { AppLayout, PageHeader } from "@/components/layout";
import { ChangePasswordForm } from "@/components/user/ChangePasswordForm";
import { BusinessUnitPath } from "@/components/user/BusinessUnitPath";
import { roleDisplayConfig } from "@/schemas/user";
import { Loader2, UserCircle } from "lucide-react";

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
        <div className="text-center text-destructive py-12">
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
        <PageHeader
          eyebrow="ACCOUNT"
          title="Profile Settings"
          icon={<UserCircle />}
          description="Manage your account information and security settings"
        />

        {/* User Information */}
        <div className="mb-8 rounded-lg border border-border bg-card">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <UserCircle className="h-[17px] w-[17px] text-primary" />
              <h3 className="text-[14px] font-bold leading-6 text-foreground">
                Account Information
              </h3>
            </div>
            <div className="mt-1">
              <dl className="divide-y divide-border">
                <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5">
                  <dt className="text-[12.5px] font-semibold text-secondary-foreground">Name</dt>
                  <dd className="mt-1 text-sm text-foreground sm:col-span-2 sm:mt-0">
                    {user.name || "Not set"}
                  </dd>
                </div>
                <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5">
                  <dt className="text-[12.5px] font-semibold text-secondary-foreground">Email</dt>
                  <dd className="mt-1 font-mono text-sm text-foreground sm:col-span-2 sm:mt-0">
                    {user.email}
                  </dd>
                </div>
                <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5">
                  <dt className="text-[12.5px] font-semibold text-secondary-foreground">Role</dt>
                  <dd className="mt-1 text-sm text-foreground sm:col-span-2 sm:mt-0">
                    <span className="font-mono font-medium">{roleConfig?.label ?? user.role}</span>
                    {roleConfig?.description && (
                      <span className="ml-2 text-muted-foreground">
                        - {roleConfig.description}
                      </span>
                    )}
                  </dd>
                </div>
                {/* Story 7.0.4: Business Unit display (AC16-AC17) */}
                <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5">
                  <dt className="text-[12.5px] font-semibold text-secondary-foreground">Business Unit</dt>
                  <dd className="mt-1 text-sm text-foreground sm:col-span-2 sm:mt-0">
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
