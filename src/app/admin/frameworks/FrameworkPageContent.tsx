"use client";

/**
 * Framework Page Content
 *
 * Client component that wraps framework management with AppLayout.
 */

import Link from "next/link";
import { ClipboardList, Settings } from "lucide-react";
import { FrameworkManagementClient } from "./client";
import { AppLayout, PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";

export function FrameworkPageContent() {
  return (
    <AppLayout breadcrumbs={[{ label: "Governance" }, { label: "Frameworks" }]}>
      <PageHeader
        eyebrow="GOVERNANCE"
        title="Framework Management"
        icon={<ClipboardList />}
        description="Import and manage compliance frameworks from OSCAL catalogs. Frameworks define the security controls your organization needs to implement."
        actions={
          <Button asChild variant="outline">
            <Link href="/admin/frameworks/configure">
              <Settings className="h-4 w-4" />
              Configure Activation
            </Link>
          </Button>
        }
      />

      <FrameworkManagementClient />
    </AppLayout>
  );
}
