"use client";

/**
 * Control Taxonomy Admin Client Component
 *
 * Manages simplified control taxonomy domains:
 * - View all domains with status
 * - Activate/deactivate domains
 * - Reorder domains
 *
 * @see Story 2.3: Simplified Control Taxonomy Definition
 */

import { useState } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Loader2,
  ArrowUp,
  ArrowDown,
  Tag,
  Info,
} from "lucide-react";
import { toast } from "sonner";

export function TaxonomyAdminClient() {
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const utils = api.useUtils();

  // Fetch all control domains (including inactive)
  const { data: domains, isLoading } = api.controlDomain.listAll.useQuery();

  // Update domain mutation
  const updateMutation = api.controlDomain.update.useMutation({
    onSuccess: () => {
      void utils.controlDomain.listAll.invalidate();
      void utils.controlDomain.list.invalidate();
      toast.success("Control domain updated");
      setUpdatingId(null);
    },
    onError: (error) => {
      toast.error(`Failed to update: ${error.message}`);
      setUpdatingId(null);
    },
  });

  // Reorder mutation
  const reorderMutation = api.controlDomain.reorder.useMutation({
    onSuccess: () => {
      void utils.controlDomain.listAll.invalidate();
      void utils.controlDomain.list.invalidate();
      toast.success("Domain order updated");
    },
    onError: (error) => {
      toast.error(`Failed to reorder: ${error.message}`);
    },
  });

  // Handle toggle active status
  const handleToggleActive = (id: string, currentActive: boolean) => {
    setUpdatingId(id);
    updateMutation.mutate({ id, isActive: !currentActive });
  };

  // Handle move up
  const handleMoveUp = (index: number) => {
    if (!domains || index <= 0) return;

    const newOrderings = domains.map((d, i) => {
      if (i === index) return { id: d.id, sortOrder: domains[i - 1]!.sortOrder };
      if (i === index - 1) return { id: d.id, sortOrder: domains[index]!.sortOrder };
      return { id: d.id, sortOrder: d.sortOrder };
    });

    reorderMutation.mutate({ orderings: newOrderings });
  };

  // Handle move down
  const handleMoveDown = (index: number) => {
    if (!domains || index >= domains.length - 1) return;

    const newOrderings = domains.map((d, i) => {
      if (i === index) return { id: d.id, sortOrder: domains[i + 1]!.sortOrder };
      if (i === index + 1) return { id: d.id, sortOrder: domains[index]!.sortOrder };
      return { id: d.id, sortOrder: d.sortOrder };
    });

    reorderMutation.mutate({ orderings: newOrderings });
  };

  return (
    <AppLayout breadcrumbs={[{ label: "Governance" }, { label: "Taxonomy" }]}>
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="sm:flex sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
              <Tag className="h-6 w-6" />
              Control Taxonomy
            </h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage simplified control domains for evidence tagging. These domains map to
            OSCAL framework controls for compliance tracking.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Domains</p>
                <p className="text-2xl font-semibold">{domains?.length ?? 0}</p>
              </div>
              <Tag className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Active Domains</p>
                <p className="text-2xl font-semibold text-green-600">
                  {domains?.filter((d) => d.isActive).length ?? 0}
                </p>
              </div>
              <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                <span className="text-green-600 text-sm font-medium">
                  {domains ? Math.round((domains.filter((d) => d.isActive).length / domains.length) * 100) : 0}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Inactive Domains</p>
                <p className="text-2xl font-semibold text-gray-400">
                  {domains?.filter((d) => !d.isActive).length ?? 0}
                </p>
              </div>
              <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                <Info className="h-4 w-4 text-gray-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Domains Table */}
      <Card>
        <CardHeader>
          <CardTitle>Control Domains</CardTitle>
          <CardDescription>
            12 simplified control domains for categorizing evidence and mapping to framework controls.
            Use the toggles to activate or deactivate domains, and arrows to reorder.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">Order</TableHead>
                    <TableHead className="w-[200px]">Domain</TableHead>
                    <TableHead className="w-[150px]">Code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {domains?.map((domain, index) => (
                    <TableRow key={domain.id} className={!domain.isActive ? "opacity-50" : ""}>
                      <TableCell className="font-mono text-sm">
                        {domain.sortOrder}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{domain.name}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {domain.code}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <p className="text-sm text-gray-600 truncate max-w-md cursor-help">
                                {domain.description}
                              </p>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-sm">
                              <p className="text-sm">{domain.description}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={domain.isActive}
                            onCheckedChange={() => handleToggleActive(domain.id, domain.isActive)}
                            disabled={updatingId === domain.id}
                          />
                          <span className="text-sm text-gray-500">
                            {domain.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMoveUp(index)}
                            disabled={index === 0 || reorderMutation.isPending}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMoveDown(index)}
                            disabled={index === (domains?.length ?? 0) - 1 || reorderMutation.isPending}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
