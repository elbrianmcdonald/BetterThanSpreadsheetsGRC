"use client";

import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout";
import { OrgControlForm } from "@/components/organizational-control/OrgControlForm";

export function NewControlClient() {
  const router = useRouter();

  return (
    <AppLayout
      breadcrumbs={[
        { label: "Controls", href: "/controls" },
        { label: "New Control" },
      ]}
    >
      <div className="container max-w-5xl mx-auto py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Create control</h1>
          <p className="text-muted-foreground mt-1">
            Author a new organizational control. You can edit classification, mapping, and ownership later.
          </p>
        </div>
        <OrgControlForm mode="create" onCancel={() => router.push("/controls")} />
      </div>
    </AppLayout>
  );
}
