/**
 * User Management Client Component
 *
 * Client-side component for user management UI.
 * Separated from server component for interactivity.
 */

"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { UserList } from "@/components/user/UserList";
import { CreateUserDialog } from "@/components/user/CreateUserDialog";
import { MembersManager } from "@/components/admin/MembersManager";
import { AppLayout, PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";

export function UserManagementClient() {
  const [isCreating, setIsCreating] = useState(false);

  return (
    <AppLayout breadcrumbs={[{ label: "Administration" }, { label: "User Management" }]}>
      <PageHeader
        eyebrow="ADMINISTRATION"
        title="User Management"
        icon={<Users />}
        description="Manage users and roles for your organization. Only Organization Administrators can create, edit, or delete users."
        actions={
          <Button type="button" onClick={() => setIsCreating(true)}>
            Create User
          </Button>
        }
      />

      <div className="flow-root">
        <UserList />
      </div>

      {/* Company Members — attach existing users to the active company (formerly /admin/members). */}
      <section className="mt-10">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-foreground">Company Members</h2>
          <p className="text-sm text-muted-foreground">
            Attach existing users to the active company and manage their per-company role. A user
            can belong to more than one company — switch companies to manage their membership in each.
          </p>
        </div>
        <MembersManager />
      </section>

      {isCreating && (
        <CreateUserDialog
          onClose={() => setIsCreating(false)}
          onSuccess={() => setIsCreating(false)}
        />
      )}
    </AppLayout>
  );
}
