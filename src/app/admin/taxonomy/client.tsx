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
import { AppLayout, PageHeader, StatTile } from "@/components/layout";
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
        <PageHeader
          eyebrow="GOVERNANCE"
          title="Control Taxonomy"
          icon={<Tag />}
          description="Manage simplified control domains for evidence tagging. These domains map to OSCAL framework controls for compliance tracking."
        />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatTile
          label="Total Domains"
          value={domains?.length ?? 0}
          icon={<Tag />}
          tone="primary"
        />

        <StatTile
          label="Active Domains"
          value={domains?.filter((d) => d.isActive).length ?? 0}
          tone="success"
          sub={
            <span className="font-mono">
              {domains ? Math.round((domains.filter((d) => d.isActive).length / domains.length) * 100) : 0}% active
            </span>
          }
        />

        <StatTile
          label="Inactive Domains"
          value={domains?.filter((d) => !d.isActive).length ?? 0}
          icon={<Info />}
        />
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
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/70" />
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px] font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Order</TableHead>
                    <TableHead className="w-[200px] font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Domain</TableHead>
                    <TableHead className="w-[150px] font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Code</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Description</TableHead>
                    <TableHead className="w-[100px] font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Status</TableHead>
                    <TableHead className="w-[100px] text-right font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {domains?.map((domain, index) => (
                    <TableRow key={domain.id} className={`hover:bg-secondary ${!domain.isActive ? "opacity-50" : ""}`}>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {domain.sortOrder}
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-foreground">{domain.name}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="code">
                          {domain.code}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <p className="text-sm text-muted-foreground truncate max-w-md cursor-help">
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
                          <span className="text-sm text-muted-foreground">
                            {domain.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground/70"
                            onClick={() => handleMoveUp(index)}
                            disabled={index === 0 || reorderMutation.isPending}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground/70"
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
