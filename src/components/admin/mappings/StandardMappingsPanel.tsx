"use client";

/**
 * Standard Mappings Panel
 *
 * Displays existing StandardControlMapping data in a read-only table.
 * Shows mappings between standards and framework controls.
 */

import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ExternalLink, BookOpen } from "lucide-react";
import Link from "next/link";
import { labelForMappingType } from "@/components/organizational-control/enum-labels";

export function StandardMappingsPanel() {
  const [selectedStandardId, setSelectedStandardId] = useState<string>("");

  // Fetch standards list
  const { data: standardsData, isLoading: standardsLoading } =
    api.standard.list.useQuery({
      page: 1,
      pageSize: 100,
    });

  // Fetch selected standard with its controls and mappings
  const { data: standardDetail, isLoading: detailLoading } =
    api.standard.getById.useQuery(
      { id: selectedStandardId },
      { enabled: !!selectedStandardId }
    );

  const isLoading = standardsLoading || (selectedStandardId && detailLoading);

  // Count total mappings
  const totalMappings =
    standardDetail?.Controls.reduce(
      (sum, control) => sum + (control.FrameworkMappings?.length ?? 0),
      0
    ) ?? 0;

  const getMappingTypeBadgeVariant = (type: string) => {
    switch (type) {
      case "EQUIVALENT":
        return "default";
      case "SUBSET_OF":
        return "secondary";
      case "SUPERSET_OF":
        return "outline";
      case "INTERSECTS":
        return "secondary";
      default:
        return "secondary";
    }
  };

  return (
    <div className="space-y-6">
      {/* Standard Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Standard Control Mappings
          </CardTitle>
          <CardDescription>
            View mappings between organizational standards and compliance framework
            controls. Edit mappings in the Standard detail page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Select
              value={selectedStandardId}
              onValueChange={setSelectedStandardId}
            >
              <SelectTrigger className="w-[400px]">
                <SelectValue placeholder="Select a standard to view mappings..." />
              </SelectTrigger>
              <SelectContent>
                {standardsData?.standards.map((standard) => (
                  <SelectItem key={standard.id} value={standard.id}>
                    {standard.title}
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {standard._count.Controls} controls
                    </Badge>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedStandardId && (
              <Link href={`/admin/standards/${selectedStandardId}`}>
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Edit Standard
                </Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Mappings Display */}
      {selectedStandardId ? (
        <Card>
          <CardHeader>
            <CardTitle>{standardDetail?.title ?? "Loading..."}</CardTitle>
            <CardDescription>
              {totalMappings} framework control mappings across{" "}
              {standardDetail?.Controls.length ?? 0} standard controls
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : standardDetail?.Controls.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <BookOpen className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>This standard has no controls defined yet.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">Standard Control</TableHead>
                      <TableHead>Control Title</TableHead>
                      <TableHead>Framework Control</TableHead>
                      <TableHead>Framework</TableHead>
                      <TableHead>Mapping Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {standardDetail?.Controls.map((control) => {
                      const mappings = control.FrameworkMappings ?? [];
                      if (mappings.length === 0) {
                        return (
                          <TableRow key={control.id}>
                            <TableCell className="font-mono text-sm">
                              {control.code}
                            </TableCell>
                            <TableCell>{control.title}</TableCell>
                            <TableCell
                              colSpan={3}
                              className="text-gray-400 text-sm italic"
                            >
                              No framework mappings
                            </TableCell>
                          </TableRow>
                        );
                      }
                      return mappings.map((mapping, idx) => (
                        <TableRow key={mapping.id}>
                          {idx === 0 && (
                            <>
                              <TableCell
                                className="font-mono text-sm"
                                rowSpan={mappings.length}
                              >
                                {control.code}
                              </TableCell>
                              <TableCell rowSpan={mappings.length}>
                                {control.title}
                              </TableCell>
                            </>
                          )}
                          <TableCell className="font-mono text-sm">
                            {mapping.FrameworkControl.controlId}
                            <div className="text-xs text-gray-500 font-normal truncate max-w-[200px]">
                              {mapping.FrameworkControl.title}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {mapping.FrameworkControl.Framework.code}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={getMappingTypeBadgeVariant(mapping.mappingType)}
                            >
                              {labelForMappingType(mapping.mappingType)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ));
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <BookOpen className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">No Standard Selected</p>
            <p className="text-sm mt-2">
              Select a standard above to view its framework control mappings.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      {standardsData && standardsData.standards.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Standards Overview</CardTitle>
            <CardDescription>
              Summary of all organizational standards
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-500">Total Standards</p>
                <p className="text-2xl font-semibold">
                  {standardsData.pagination.total}
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-500">Active</p>
                <p className="text-2xl font-semibold text-green-600">
                  {standardsData.standards.filter((s) => s.status === "ACTIVE").length}
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-500">Draft</p>
                <p className="text-2xl font-semibold text-yellow-600">
                  {standardsData.standards.filter((s) => s.status === "DRAFT").length}
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-500">Total Controls</p>
                <p className="text-2xl font-semibold text-blue-600">
                  {standardsData.standards.reduce(
                    (sum, s) => sum + s._count.Controls,
                    0
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
