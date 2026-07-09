"use client";

import { ShieldCheck } from "lucide-react";

import { AppLayout, PageHeader } from "@/components/layout";
import { PlatformAdminManager } from "@/components/admin/PlatformAdminManager";

export function PlatformAdminsClient() {
  return (
    <AppLayout breadcrumbs={[{ label: "Administration" }, { label: "Platform Admins" }]}>
      <div className="px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="PLATFORM"
          title="Platform Admins"
          icon={<ShieldCheck />}
          description="Grant or revoke platform-admin access. Platform admins can switch into and manage every company."
        />
        <div className="mt-6">
          <PlatformAdminManager />
        </div>
      </div>
    </AppLayout>
  );
}
