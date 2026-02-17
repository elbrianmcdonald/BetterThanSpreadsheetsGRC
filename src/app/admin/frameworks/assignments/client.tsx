"use client";

/**
 * Framework Assignments Client Component
 *
 * BU-Scoped Compliance: Matrix view for managing BU-Framework assignments
 */

import { useState } from "react";
import { api } from "@/trpc/react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Building2, Shield, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function FrameworkAssignmentsClient() {
  const [pendingChanges, setPendingChanges] = useState<Set<string>>(new Set());

  const { data: businessUnits, isLoading: loadingBUs } = api.businessUnit.list.useQuery({
    includeInactive: false,
  });

  const { data: frameworks, isLoading: loadingFrameworks } = api.framework.list.useQuery({
    isActive: true,
  });

  const { data: assignments, isLoading: loadingAssignments, refetch } =
    api.businessUnitFramework.list.useQuery();

  const assignMutation = api.businessUnitFramework.assign.useMutation({
    onSuccess: () => {
      void refetch();
      toast.success("Framework assigned to business unit");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to assign framework");
    },
    onSettled: (_, __, variables) => {
      setPendingChanges((prev) => {
        const next = new Set(prev);
        next.delete(`${variables.businessUnitId}:${variables.frameworkId}`);
        return next;
      });
    },
  });

  const unassignMutation = api.businessUnitFramework.unassign.useMutation({
    onSuccess: () => {
      void refetch();
      toast.success("Framework removed from business unit");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to remove framework");
    },
    onSettled: (_, __, variables) => {
      setPendingChanges((prev) => {
        const next = new Set(prev);
        next.delete(`${variables.businessUnitId}:${variables.frameworkId}`);
        return next;
      });
    },
  });

  // Migration mutation for Story 6: Data Migration
  const migrationMutation = api.businessUnitFramework.migrateToScoped.useMutation({
    onSuccess: (data) => {
      void refetch();
      toast.success("Migration completed", {
        description: `${data.evidenceMigrated} evidence migrated, ${data.frameworkAssignmentsCreated} assignments created`,
      });
    },
    onError: (error) => {
      toast.error("Migration failed", {
        description: error.message,
      });
    },
  });

  const isLoading = loadingBUs || loadingFrameworks || loadingAssignments;

  // Build assignment lookup
  const assignmentSet = new Set(
    assignments?.map((a) => `${a.businessUnit.id}:${a.framework.id}`) ?? []
  );

  const isAssigned = (buId: string, fwId: string) =>
    assignmentSet.has(`${buId}:${fwId}`);

  const isPending = (buId: string, fwId: string) =>
    pendingChanges.has(`${buId}:${fwId}`);

  const handleToggle = (buId: string, fwId: string) => {
    const key = `${buId}:${fwId}`;
    setPendingChanges((prev) => new Set([...prev, key]));

    if (isAssigned(buId, fwId)) {
      unassignMutation.mutate({ businessUnitId: buId, frameworkId: fwId });
    } else {
      assignMutation.mutate({ businessUnitId: buId, frameworkId: fwId });
    }
  };

  // Flatten BU tree for display
  type BUTreeNode = {
    id: string;
    name: string;
    children: BUTreeNode[];
  };

  const flattenBUs = (tree: BUTreeNode[] | undefined, level = 0): Array<{ id: string; name: string; level: number }> => {
    if (!tree) return [];
    return tree.flatMap((bu) => [
      { id: bu.id, name: bu.name, level },
      ...flattenBUs(bu.children, level + 1),
    ]);
  };

  const flatBUs = flattenBUs(businessUnits?.tree as BUTreeNode[] | undefined);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!flatBUs.length || !frameworks?.length) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          {!flatBUs.length ? (
            <p>No business units found. Create business units first.</p>
          ) : (
            <p>No active frameworks found. Activate frameworks first.</p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Assignment Matrix
          </CardTitle>

          {/* Migration button for Story 6 */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={migrationMutation.isPending}>
                {migrationMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Auto-Setup
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Auto-Setup BU Assignments</AlertDialogTitle>
                <AlertDialogDescription>
                  This will automatically:
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Create a default business unit if none exists</li>
                    <li>Assign existing evidence to the default BU</li>
                    <li>Assign all frameworks to all business units</li>
                    <li>Recalculate coverage for all BU-Framework pairs</li>
                  </ul>
                  <p className="mt-3 font-medium">
                    This is typically run once during initial setup.
                  </p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => migrationMutation.mutate()}>
                  Run Auto-Setup
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 bg-white border-b p-3 text-left font-medium text-gray-900">
                  Business Unit
                </th>
                {frameworks.map((fw) => (
                  <th key={fw.id} className="border-b p-3 text-center font-medium text-gray-900 min-w-[120px]">
                    <div className="flex flex-col items-center gap-1">
                      <Shield className="h-4 w-4 text-primary" />
                      <span className="text-xs">{fw.code}</span>
                      <Badge variant="outline" className="text-xs">
                        v{fw.version}
                      </Badge>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {flatBUs.map((bu) => (
                <tr key={bu.id} className="hover:bg-gray-50">
                  <td className="sticky left-0 bg-white border-b p-3 font-medium">
                    <span style={{ paddingLeft: `${bu.level * 16}px` }}>
                      {bu.level > 0 && <span className="text-gray-400 mr-2">└</span>}
                      {bu.name}
                    </span>
                  </td>
                  {frameworks.map((fw) => {
                    const assigned = isAssigned(bu.id, fw.id);
                    const pending = isPending(bu.id, fw.id);

                    return (
                      <td key={fw.id} className="border-b p-3 text-center">
                        {pending ? (
                          <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
                        ) : (
                          <Checkbox
                            checked={assigned}
                            onCheckedChange={() => handleToggle(bu.id, fw.id)}
                            aria-label={`Assign ${fw.name} to ${bu.name}`}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 text-sm text-muted-foreground">
          <p>
            Check a box to assign a framework to a business unit.
            Coverage will be calculated separately for each assigned BU-Framework pair.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
