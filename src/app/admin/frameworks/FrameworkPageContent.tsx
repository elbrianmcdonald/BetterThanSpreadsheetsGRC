"use client";

/**
 * Framework Page Content
 *
 * Client component that wraps framework management with AppLayout.
 */

import Link from "next/link";
import { Settings } from "lucide-react";
import { FrameworkManagementClient } from "./client";
import { AppLayout } from "@/components/layout";

export function FrameworkPageContent() {
  return (
    <AppLayout breadcrumbs={[{ label: "Governance" }, { label: "Frameworks" }]}>
      <div className="sm:flex sm:items-center sm:justify-between">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold leading-6 text-gray-900">
            Framework Management
          </h1>
          <p className="mt-2 text-sm text-gray-700">
            Import and manage compliance frameworks from OSCAL catalogs.
            Frameworks define the security controls your organization needs to implement.
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <Link
            href="/admin/frameworks/configure"
            className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            <Settings className="h-4 w-4" />
            Configure Activation
          </Link>
        </div>
      </div>

      <FrameworkManagementClient />
    </AppLayout>
  );
}
