"use client";

/**
 * Create Business Process Client Component
 *
 * Epic 10: BIA Core Module
 * Story 10.2: Business Process Data Model & Basic CRUD
 * Story 10.3: Process Owner Assignment & Reassignment
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Activity,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export function CreateProcessClient() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    businessFunctionId: "",
    ownerId: "",
    workaroundProcedure: "",
  });

  const [ownerSearch, setOwnerSearch] = useState("");

  // Queries
  const { data: functions } = api.businessFunction.list.useQuery({
    includeInactive: false,
  });

  const { data: owners } = api.businessProcess.getAvailableOwners.useQuery({
    search: ownerSearch || undefined,
  });

  // Mutations
  const createMutation = api.businessProcess.create.useMutation({
    onSuccess: (process) => {
      toast.success("Business process created");
      router.push(`/bia/processes/${process.id}`);
    },
    onError: (error) => toast.error(error.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }

    createMutation.mutate({
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
      businessFunctionId: formData.businessFunctionId || undefined,
      ownerId: formData.ownerId || undefined,
      workaroundProcedure: formData.workaroundProcedure.trim() || undefined,
    });
  };

  return (
    <AppLayout
      breadcrumbs={[
        { label: "Business Impact" },
        { label: "Business Processes", href: "/bia/processes" },
        { label: "New Process" },
      ]}
    >
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/bia/processes">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Processes
            </Button>
          </Link>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Activity className="h-6 w-6" />
            New Business Process
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Create a new business process for impact assessment.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Info */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Process Details</CardTitle>
                  <CardDescription>
                    Basic information about the business process.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="e.g., Payroll Processing, Order Fulfillment"
                      maxLength={200}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      placeholder="Describe this business process..."
                      rows={4}
                      maxLength={4000}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="function">Business Function</Label>
                    <Select
                      value={formData.businessFunctionId}
                      onValueChange={(v) =>
                        setFormData({ ...formData, businessFunctionId: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a function..." />
                      </SelectTrigger>
                      <SelectContent>
                        {functions?.map((fn) => (
                          <SelectItem key={fn.id} value={fn.id}>
                            {fn.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Organize this process under a business function.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Workaround Procedure</CardTitle>
                  <CardDescription>
                    Document manual procedures if this process is unavailable.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={formData.workaroundProcedure}
                    onChange={(e) =>
                      setFormData({ ...formData, workaroundProcedure: e.target.value })
                    }
                    placeholder="Describe the manual workaround procedures..."
                    rows={6}
                    maxLength={10000}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Process Owner</CardTitle>
                  <CardDescription>
                    Assign a user responsible for this process.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    placeholder="Search users..."
                    value={ownerSearch}
                    onChange={(e) => setOwnerSearch(e.target.value)}
                  />
                  <Select
                    value={formData.ownerId}
                    onValueChange={(v) =>
                      setFormData({ ...formData, ownerId: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select an owner..." />
                    </SelectTrigger>
                    <SelectContent>
                      {owners?.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          <div>
                            <div className="font-medium">{user.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {user.email}
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    The owner will be responsible for completing impact assessments.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col gap-3">
                    <Button
                      type="submit"
                      disabled={createMutation.isPending || !formData.name.trim()}
                      className="w-full"
                    >
                      {createMutation.isPending && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      Create Process
                    </Button>
                    <Link href="/bia/processes" className="w-full">
                      <Button type="button" variant="outline" className="w-full">
                        Cancel
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
