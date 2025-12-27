"use client";

/**
 * Risk Creation Client Component
 *
 * Client-side component for the risk creation form.
 *
 * @see Story 4.1: Risk Creation via tRPC Procedures and Web Forms
 */

import { CreateRiskForm } from "@/components/risk/CreateRiskForm";
import { AppLayout } from "@/components/layout";

export function CreateRiskClient() {
  return (
    <AppLayout breadcrumbs={[{ label: "Risks", href: "/risks" }, { label: "Create Risk" }]}>
      <div className="bg-white shadow-sm rounded-lg">
        <div className="p-6">
          <CreateRiskForm />
        </div>
      </div>
    </AppLayout>
  );
}
