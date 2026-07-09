"use client";

import { Users } from "lucide-react";

import { AppLayout, PageHeader } from "@/components/layout";
import { MembersManager } from "@/components/admin/MembersManager";

export function MembersClient() {
  return (
    <AppLayout breadcrumbs={[{ label: "Administration" }, { label: "Members" }]}>
      <div className="px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="ADMINISTRATION"
          title="Company Members"
          icon={<Users />}
          description="Attach existing users to this company and manage their per-company roles."
        />
        <div className="mt-6">
          <MembersManager />
        </div>
      </div>
    </AppLayout>
  );
}
