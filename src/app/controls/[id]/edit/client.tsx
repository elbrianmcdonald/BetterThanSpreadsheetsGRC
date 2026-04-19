"use client";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api } from "@/trpc/react";
import { AppLayout } from "@/components/layout";
import {
  OrgControlForm,
  type OrgControlFormInitialValues,
} from "@/components/organizational-control/OrgControlForm";

export function EditControlClient({ controlId }: { controlId: string }) {
  const router = useRouter();

  const { data: control, isLoading, error } = api.organizationalControl.getById.useQuery({
    id: controlId,
  });

  if (isLoading) {
    return (
      <AppLayout
        breadcrumbs={[
          { label: "Controls", href: "/controls" },
          { label: "Loading..." },
          { label: "Edit" },
        ]}
      >
        <div className="container max-w-5xl mx-auto py-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </AppLayout>
    );
  }

  if (error || !control) {
    return (
      <AppLayout
        breadcrumbs={[
          { label: "Controls", href: "/controls" },
          { label: "Not found" },
        ]}
      >
        <div className="container max-w-5xl mx-auto py-12 text-center">
          <p className="text-red-600">{error?.message ?? "Control not found"}</p>
        </div>
      </AppLayout>
    );
  }

  const initialValues: OrgControlFormInitialValues = {
    id: control.id,
    localControlId: control.localControlId,
    name: control.name,
    description: control.description,
    objective: control.objective,
    family: control.family,
    controlType: control.controlType,
    nature: control.nature,
    automationLevel: control.automationLevel,
    status: control.status,
    implementationNarrative: control.implementationNarrative,
    scope: control.scope,
    frequency: control.frequency,
    procedureRunbookLink: control.procedureRunbookLink,
    reviewCycleMonths: control.reviewCycleMonths,
    frameworkMappings: control.FrameworkMappings.map((m) => ({
      frameworkId: m.FrameworkControl.Framework.id,
      frameworkControlId: m.frameworkControlId,
      mappingType: m.mappingType,
      notes: m.notes ?? undefined,
    })),
    assignments: control.Assignments.map((a) => ({
      personId: a.personId,
      role: a.role,
    })),
  };

  return (
    <AppLayout
      breadcrumbs={[
        { label: "Controls", href: "/controls" },
        { label: control.name, href: `/controls/${control.id}` },
        { label: "Edit" },
      ]}
    >
      <div className="container max-w-5xl mx-auto py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Edit control</h1>
          <p className="text-muted-foreground mt-1">
            <span className="font-mono text-blue-700">{control.localControlId}</span> · {control.name}
          </p>
        </div>
        <OrgControlForm
          mode="edit"
          initialValues={initialValues}
          onCancel={() => router.push(`/controls/${control.id}`)}
        />
      </div>
    </AppLayout>
  );
}
