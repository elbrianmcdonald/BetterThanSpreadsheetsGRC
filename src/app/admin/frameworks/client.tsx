"use client";

/**
 * Framework Management Client Component
 *
 * Provides OSCAL import functionality and framework list management.
 *
 * @see Story 2.1: OSCAL Catalog Import Pipeline
 */

import { useState, useCallback } from "react";
import Link from "next/link";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  CheckCircle2,
  Upload,
  Plus,
  FileJson,
  Loader2,
  ChevronRight,
  Power,
  PowerOff,
  Trash2,
  AlertTriangle,
  Info,
  Eye,
  Shield,
  Building2,
  Filter,
  Search,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ImportPreview {
  success: boolean;
  metadata: {
    uuid: string;
    title: string;
    version: string;
    oscalVersion?: string;
    published?: string;
    lastModified?: string;
    description?: string;
  };
  controlCount: number;
  groupCount: number;
  topLevelControls: Array<{
    id: string;
    title: string;
    childCount: number;
  }>;
  issues: Array<{
    severity: "error" | "warning" | "info";
    code: string;
    message: string;
    controlId?: string;
  }>;
  isValid: boolean;
}

export function FrameworkManagementClient() {
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [frameworkCode, setFrameworkCode] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importStep, setImportStep] = useState<"upload" | "preview" | "importing">("upload");

  // Story 12.2: Filter states (AC15-AC20)
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const utils = api.useUtils();

  // Fetch frameworks list
  const { data: frameworks, isLoading: isLoadingFrameworks } =
    api.framework.list.useQuery({ includeControlCount: true });

  // Story 12.2: Fetch health data (AC1-AC14)
  const { data: healthData, isLoading: isLoadingHealth } =
    api.controlLink.getFrameworksWithHealth.useQuery();

  // Preview mutation
  const previewMutation = api.framework.preview.useMutation({
    onSuccess: (data) => {
      setPreview(data as ImportPreview);
      setImportStep("preview");
    },
    onError: (error) => {
      alert(`Preview failed: ${error.message}`);
    },
  });

  // Import mutation
  const importMutation = api.framework.importOscal.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        alert(`Successfully imported ${data.controlsImported} controls into framework "${data.frameworkName}"`);
        setIsImportDialogOpen(false);
        resetImport();
        void utils.framework.list.invalidate();
      } else {
        const errorMessages = data.issues
          .filter((i) => i.severity === "error")
          .map((i) => i.message)
          .join("\n");
        alert(`Import failed:\n${errorMessages}`);
        setImportStep("preview"); // Reset to preview so user can try again
      }
    },
    onError: (error) => {
      alert(`Import failed: ${error.message}`);
      setImportStep("preview"); // Reset to preview so user can try again
    },
  });

  // Activate/Deactivate mutations
  const activateMutation = api.framework.activate.useMutation({
    onSuccess: () => void utils.framework.list.invalidate(),
  });

  const deactivateMutation = api.framework.deactivate.useMutation({
    onSuccess: () => void utils.framework.list.invalidate(),
  });

  const deleteMutation = api.framework.delete.useMutation({
    onSuccess: () => void utils.framework.list.invalidate(),
  });

  const resetImport = useCallback(() => {
    setSelectedFile(null);
    setFileContent("");
    setFrameworkCode("");
    setPreview(null);
    setImportStep("upload");
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setSelectedFile(file);

      try {
        const content = await file.text();
        setFileContent(content);

        // Auto-detect framework code from filename
        const nameWithoutExt = file.name.replace(/\.(json|yaml|yml)$/i, "");
        setFrameworkCode(nameWithoutExt.toUpperCase().replace(/[^A-Z0-9-]/g, "-"));
      } catch {
        alert("Failed to read file");
      }
    },
    [],
  );

  const handlePreview = useCallback(() => {
    if (!fileContent || !frameworkCode) {
      alert("Please select a file and enter a framework code");
      return;
    }

    previewMutation.mutate({
      content: fileContent,
      filename: selectedFile?.name,
    });
  }, [fileContent, frameworkCode, selectedFile?.name, previewMutation]);

  const handleImport = useCallback(() => {
    if (!fileContent || !frameworkCode) return;

    setImportStep("importing");
    importMutation.mutate({
      content: fileContent,
      filename: selectedFile?.name,
      code: frameworkCode,
    });
  }, [fileContent, frameworkCode, selectedFile?.name, importMutation]);

  const handleDelete = useCallback(
    (id: string, name: string) => {
      if (confirm(`Are you sure you want to delete framework "${name}"? This will also delete all associated controls.`)) {
        deleteMutation.mutate({ id });
      }
    },
    [deleteMutation],
  );

  const getIssueSeverityIcon = (severity: "error" | "warning" | "info") => {
    switch (severity) {
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "info":
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  // Story 12.2: Merge framework list with health data and filter
  const frameworksWithHealth = frameworks?.map((fw) => {
    const health = healthData?.frameworks.find((h) => h.frameworkId === fw.id);
    return {
      ...fw,
      health: health?.health ?? "HEALTHY" as const,
      atRiskControls: (health?.atRiskControls ?? 0) + (health?.criticalControls ?? 0),
      criticalControls: health?.criticalControls ?? 0,
      healthyControls: health?.healthyControls ?? 0,
    };
  });

  // Apply filters (AC15-AC20)
  const filteredFrameworks = frameworksWithHealth?.filter((fw) => {
    // Status filter
    if (statusFilter === "active" && !fw.isActive) return false;
    if (statusFilter === "inactive" && fw.isActive) return false;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!fw.name.toLowerCase().includes(query) && !fw.code.toLowerCase().includes(query)) {
        return false;
      }
    }

    return true;
  });

  const hasActiveFilters = statusFilter !== "all" || searchQuery !== "";

  return (
    <div className="mt-8 space-y-6">
      {/* Story 12.2: Summary Statistics Cards (AC9-AC14) */}
      {healthData && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Building2 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Frameworks</p>
                  <p className="text-2xl font-bold">{healthData.summary.totalFrameworks}</p>
                  <p className="text-xs text-muted-foreground">
                    {healthData.summary.activeFrameworks} active
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Shield className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Controls</p>
                  <p className="text-2xl font-bold">{healthData.summary.totalControls}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Story 12.2: Filters (AC15-AC20) */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[200px] max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search frameworks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v: "all" | "active" | "inactive") => setStatusFilter(v)}>
          <SelectTrigger className="w-[150px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active Only</SelectItem>
            <SelectItem value="inactive">Inactive Only</SelectItem>
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatusFilter("all");
              setSearchQuery("");
            }}
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Create / Import */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild>
          <Link href="/admin/frameworks/new">
            <Plus className="mr-2 h-4 w-4" />
            Create framework
          </Link>
        </Button>
        <Dialog open={isImportDialogOpen} onOpenChange={(open) => {
          setIsImportDialogOpen(open);
          if (!open) resetImport();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="mr-2 h-4 w-4" />
              Import OSCAL Catalog
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Import OSCAL Catalog</DialogTitle>
              <DialogDescription>
                Upload an OSCAL JSON or YAML catalog file to import a compliance framework.
              </DialogDescription>
            </DialogHeader>

            {importStep === "upload" && (
              <div className="space-y-4 py-4">
                <div className="rounded-md border border-blue-100 bg-blue-50 p-3 text-sm">
                  <p className="font-medium text-blue-900">New to OSCAL?</p>
                  <p className="mt-1 text-blue-800">
                    Download a starter template to see the expected structure, then edit it for your framework.
                  </p>
                  <a
                    href="/oscal-catalog-template.json"
                    download="oscal-catalog-template.json"
                    className="mt-2 inline-block text-sm font-medium text-blue-700 underline hover:text-blue-900"
                  >
                    Download OSCAL template (JSON)
                  </a>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="file">OSCAL Catalog File</Label>
                  <Input
                    id="file"
                    type="file"
                    accept=".json,.yaml,.yml"
                    onChange={handleFileChange}
                  />
                  <p className="text-sm text-gray-500">
                    Supported formats: JSON, YAML
                  </p>
                </div>

                {selectedFile && (
                  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                    <FileJson className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="font-medium">{selectedFile.name}</p>
                      <p className="text-sm text-gray-500">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="code">Framework Code</Label>
                  <Input
                    id="code"
                    value={frameworkCode}
                    onChange={(e) => setFrameworkCode(e.target.value.toUpperCase())}
                    placeholder="e.g., NIST-800-53, SOC2"
                    maxLength={50}
                  />
                  <p className="text-sm text-gray-500">
                    A unique identifier for this framework (e.g., NIST-800-53-R5)
                  </p>
                </div>
              </div>
            )}

            {importStep === "preview" && preview && (
              <div className="space-y-4 py-4">
                <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                  <h4 className="font-medium">Framework Metadata</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-500">Title:</span>{" "}
                      <span className="font-medium">{preview.metadata.title}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Version:</span>{" "}
                      <span className="font-medium">{preview.metadata.version}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">OSCAL Version:</span>{" "}
                      <span className="font-medium">{preview.metadata.oscalVersion ?? "N/A"}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Controls:</span>{" "}
                      <span className="font-medium">{preview.controlCount}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Groups:</span>{" "}
                      <span className="font-medium">{preview.groupCount}</span>
                    </div>
                  </div>
                  {preview.metadata.description && (
                    <p className="text-sm text-gray-600">{preview.metadata.description}</p>
                  )}
                </div>

                {preview.topLevelControls.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Sample Controls</h4>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {preview.topLevelControls.slice(0, 10).map((control) => (
                        <div
                          key={control.id}
                          className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
                        >
                          <span>
                            <span className="font-mono">{control.id}</span>
                            <span className="mx-2">-</span>
                            <span className="text-gray-600">{control.title}</span>
                          </span>
                          {control.childCount > 0 && (
                            <span className="text-xs text-gray-500">
                              +{control.childCount} enhancements
                            </span>
                          )}
                        </div>
                      ))}
                      {preview.topLevelControls.length > 10 && (
                        <p className="text-sm text-gray-500 text-center">
                          ...and {preview.topLevelControls.length - 10} more controls
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {preview.issues.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Validation Issues</h4>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {preview.issues.map((issue, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 p-2 bg-gray-50 rounded text-sm"
                        >
                          {getIssueSeverityIcon(issue.severity)}
                          <span>{issue.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className={`p-3 rounded-lg ${preview.isValid ? "bg-green-50" : "bg-red-50"}`}>
                  {preview.isValid ? (
                    <div className="flex items-center gap-2 text-green-700">
                      <CheckCircle2 className="h-5 w-5" />
                      <span>Validation passed - Ready to import</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-red-700">
                      <AlertCircle className="h-5 w-5" />
                      <span>Validation failed - Cannot import</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {importStep === "importing" && (
              <div className="py-12 flex flex-col items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                <p className="mt-4 text-gray-600">Importing framework...</p>
              </div>
            )}

            <DialogFooter>
              {importStep === "upload" && (
                <Button
                  onClick={handlePreview}
                  disabled={!selectedFile || !frameworkCode || previewMutation.isPending}
                >
                  {previewMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      Preview Import
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              )}
              {importStep === "preview" && (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setImportStep("upload")}>
                    Back
                  </Button>
                  <Button
                    onClick={handleImport}
                    disabled={!preview?.isValid || importMutation.isPending}
                  >
                    Import Framework
                  </Button>
                </div>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Frameworks List */}
      <Card>
        <CardHeader>
          <CardTitle>Imported Frameworks</CardTitle>
          <CardDescription>
            Manage your organization&apos;s compliance frameworks
            {filteredFrameworks && frameworks && filteredFrameworks.length !== frameworks.length && (
              <span className="ml-2 text-muted-foreground">
                (showing {filteredFrameworks.length} of {frameworks.length})
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingFrameworks || isLoadingHealth ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : filteredFrameworks?.length === 0 && hasActiveFilters ? (
            <div className="text-center py-8 text-gray-500">
              <Filter className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2">No frameworks match your filters</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => {
                  setStatusFilter("all");
                  setSearchQuery("");
                }}
              >
                Clear Filters
              </Button>
            </div>
          ) : frameworks?.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileJson className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2">No frameworks imported yet</p>
              <p className="text-sm">Import an OSCAL catalog to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredFrameworks?.map((framework) => (
                <div
                  key={framework.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium">{framework.name}</h3>
                      <span className="px-2 py-0.5 text-xs font-mono bg-gray-100 rounded">
                        {framework.code}
                      </span>
                      <span className="text-sm text-gray-500">v{framework.version}</span>
                      {framework.isActive ? (
                        <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                      {framework.controlCount} controls
                      {framework.description && ` • ${framework.description}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/admin/frameworks/${framework.id}`}>
                      <Button variant="outline" size="sm">
                        <Eye className="mr-1 h-4 w-4" />
                        View
                      </Button>
                    </Link>
                    {framework.isActive ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deactivateMutation.mutate({ id: framework.id, force: true })}
                        disabled={deactivateMutation.isPending}
                      >
                        <PowerOff className="mr-1 h-4 w-4" />
                        Deactivate
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => activateMutation.mutate({ id: framework.id })}
                        disabled={activateMutation.isPending}
                      >
                        <Power className="mr-1 h-4 w-4" />
                        Activate
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDelete(framework.id, framework.name)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
