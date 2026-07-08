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
import { useSearchParams } from "next/navigation";
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
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/layout";
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
  FileSpreadsheet,
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

  // Story 12.2: Filter states (AC15-AC20). Seeded from URL search params
  // so dashboard metric cards can deep-link into a pre-filtered list
  // (e.g. ?status=active, ?coverage=ready, ?coverage=needs-attention).
  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">(() => {
    const raw = searchParams.get("status");
    return raw === "active" || raw === "inactive" ? raw : "all";
  });
  const [coverageFilter, setCoverageFilter] = useState<"all" | "ready" | "needs-attention">(() => {
    const raw = searchParams.get("coverage");
    return raw === "ready" || raw === "needs-attention" ? raw : "all";
  });
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") ?? "");

  const utils = api.useUtils();

  // Fetch frameworks list
  const { data: frameworks, isLoading: isLoadingFrameworks } =
    api.framework.list.useQuery({ includeControlCount: true });

  // Maturity frameworks (system templates + org-specific) — listed alongside
  // compliance frameworks so admins have one place to manage frameworks.
  const { data: maturityFrameworks } = api.maturity.listFrameworks.useQuery({
    includeInactive: true,
  });

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
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      case "info":
        return <Info className="h-4 w-4 text-primary" />;
    }
  };

  // Unified row shape — covers both compliance and maturity frameworks so
  // they render in a single list. `kind` discriminates rendering choices
  // (badge color, detail link, available actions).
  type UnifiedFrameworkRow =
    | {
        kind: "compliance";
        id: string;
        name: string;
        code: string;
        version: string;
        description: string | null;
        isActive: boolean;
        controlCount: number;
        health: "HEALTHY" | "AT_RISK" | "CRITICAL";
        atRiskControls: number;
        criticalControls: number;
        healthyControls: number;
      }
    | {
        kind: "maturity";
        id: string;
        name: string;
        code: string; // MaturityFramework.type used as a code-equivalent
        version: string;
        description: string | null;
        isActive: boolean;
        isSystemTemplate: boolean;
      };

  const complianceRows: UnifiedFrameworkRow[] =
    frameworks?.map((fw) => {
      const health = healthData?.frameworks.find((h) => h.frameworkId === fw.id);
      return {
        kind: "compliance",
        id: fw.id,
        name: fw.name,
        code: fw.code,
        version: fw.version,
        description: fw.description ?? null,
        isActive: fw.isActive,
        controlCount: fw.controlCount ?? 0,
        health: (health?.health ?? "HEALTHY") as "HEALTHY" | "AT_RISK" | "CRITICAL",
        atRiskControls: (health?.atRiskControls ?? 0) + (health?.criticalControls ?? 0),
        criticalControls: health?.criticalControls ?? 0,
        healthyControls: health?.healthyControls ?? 0,
      };
    }) ?? [];

  const maturityRows: UnifiedFrameworkRow[] =
    maturityFrameworks?.map((mf) => ({
      kind: "maturity",
      id: mf.id,
      name: mf.name,
      code: mf.type,
      version: mf.version,
      description: mf.description ?? null,
      isActive: mf.isActive,
      isSystemTemplate: mf.isSystemTemplate,
    })) ?? [];

  const allRows: UnifiedFrameworkRow[] = [...complianceRows, ...maturityRows];

  // Apply filters (AC15-AC20). Coverage filter buckets compliance rows by
  // healthData coverage % — ≥90 = "ready", <70 = "needs-attention". Maturity
  // rows have no coverage % so the coverage filter doesn't apply to them
  // (they're hidden when a coverage filter is active).
  const coverageByFwId = new Map(
    healthData?.frameworks.map((h) => [h.frameworkId, h]) ?? []
  );
  const filteredFrameworks = allRows.filter((fw) => {
    // Status filter
    if (statusFilter === "active" && !fw.isActive) return false;
    if (statusFilter === "inactive" && fw.isActive) return false;

    // Coverage filter — only meaningful for compliance frameworks.
    if (coverageFilter !== "all") {
      if (fw.kind !== "compliance") return false;
      const health = coverageByFwId.get(fw.id);
      const pct =
        health && health.totalControls > 0
          ? (health.healthyControls / health.totalControls) * 100
          : 0;
      if (coverageFilter === "ready" && pct < 90) return false;
      if (coverageFilter === "needs-attention" && pct >= 70) return false;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!fw.name.toLowerCase().includes(query) && !fw.code.toLowerCase().includes(query)) {
        return false;
      }
    }

    return true;
  });

  const hasActiveFilters =
    statusFilter !== "all" || coverageFilter !== "all" || searchQuery !== "";

  return (
    <div className="mt-8 space-y-6">
      {/* Story 12.2: Summary Statistics Cards (AC9-AC14) */}
      {healthData && (
        <div className="grid gap-4 md:grid-cols-2">
          <StatTile
            label="Total Frameworks"
            value={healthData.summary.totalFrameworks}
            sub={`${healthData.summary.activeFrameworks} active`}
            icon={<Building2 />}
            tone="primary"
            accent
          />
          <StatTile
            label="Total Controls"
            value={healthData.summary.totalControls}
            icon={<Shield />}
          />
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
              setCoverageFilter("all");
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
        <Button variant="outline" asChild>
          <Link href="/admin/frameworks/import">
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Import CSV/XLSX
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
                <div className="rounded-md border border-primary/20 bg-primary/10 p-3 text-sm">
                  <p className="font-medium text-foreground">New to OSCAL?</p>
                  <p className="mt-1 text-muted-foreground">
                    Download a starter template to see the expected structure, then edit it for your framework.
                  </p>
                  <a
                    href="/oscal-catalog-template.json"
                    download="oscal-catalog-template.json"
                    className="mt-2 inline-block text-sm font-medium text-primary underline hover:text-primary/80"
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
                  <p className="text-sm text-muted-foreground">
                    Supported formats: JSON, YAML
                  </p>
                </div>

                {selectedFile && (
                  <div className="flex items-center gap-2 p-3 bg-secondary rounded-lg">
                    <FileJson className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium text-foreground">{selectedFile.name}</p>
                      <p className="text-sm text-muted-foreground">
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
                  <p className="text-sm text-muted-foreground">
                    A unique identifier for this framework (e.g., NIST-800-53-R5)
                  </p>
                </div>
              </div>
            )}

            {importStep === "preview" && preview && (
              <div className="space-y-4 py-4">
                <div className="p-4 bg-secondary rounded-lg space-y-3">
                  <h4 className="font-medium text-foreground">Framework Metadata</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Title:</span>{" "}
                      <span className="font-medium text-foreground">{preview.metadata.title}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Version:</span>{" "}
                      <span className="font-medium text-foreground">{preview.metadata.version}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">OSCAL Version:</span>{" "}
                      <span className="font-medium text-foreground">{preview.metadata.oscalVersion ?? "N/A"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Controls:</span>{" "}
                      <span className="font-medium text-foreground">{preview.controlCount}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Groups:</span>{" "}
                      <span className="font-medium text-foreground">{preview.groupCount}</span>
                    </div>
                  </div>
                  {preview.metadata.description && (
                    <p className="text-sm text-muted-foreground">{preview.metadata.description}</p>
                  )}
                </div>

                {preview.topLevelControls.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-foreground">Sample Controls</h4>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {preview.topLevelControls.slice(0, 10).map((control) => (
                        <div
                          key={control.id}
                          className="flex items-center justify-between p-2 bg-secondary rounded text-sm"
                        >
                          <span>
                            <span className="font-mono text-muted-foreground">{control.id}</span>
                            <span className="mx-2">-</span>
                            <span className="text-foreground">{control.title}</span>
                          </span>
                          {control.childCount > 0 && (
                            <span className="font-mono text-xs text-muted-foreground">
                              +{control.childCount} enhancements
                            </span>
                          )}
                        </div>
                      ))}
                      {preview.topLevelControls.length > 10 && (
                        <p className="text-sm text-muted-foreground text-center">
                          ...and {preview.topLevelControls.length - 10} more controls
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {preview.issues.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-foreground">Validation Issues</h4>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {preview.issues.map((issue, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 p-2 bg-secondary rounded text-sm"
                        >
                          {getIssueSeverityIcon(issue.severity)}
                          <span className="text-foreground">{issue.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className={`p-3 rounded-lg ${preview.isValid ? "bg-success/10" : "bg-destructive/10"}`}>
                  {preview.isValid ? (
                    <div className="flex items-center gap-2 text-success">
                      <CheckCircle2 className="h-5 w-5" />
                      <span>Validation passed - Ready to import</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertCircle className="h-5 w-5" />
                      <span>Validation failed - Cannot import</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {importStep === "importing" && (
              <div className="py-12 flex flex-col items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="mt-4 text-muted-foreground">Importing framework...</p>
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
            {filteredFrameworks && filteredFrameworks.length !== allRows.length && (
              <span className="ml-2 text-muted-foreground">
                (showing {filteredFrameworks.length} of {allRows.length})
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingFrameworks || isLoadingHealth ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/70" />
            </div>
          ) : filteredFrameworks?.length === 0 && hasActiveFilters ? (
            <div className="text-center py-8 text-muted-foreground">
              <Filter className="mx-auto h-12 w-12 text-muted-foreground/70" />
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
          ) : allRows.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileJson className="mx-auto h-12 w-12 text-muted-foreground/70" />
              <p className="mt-2">No frameworks imported yet</p>
              <p className="text-sm">Import an OSCAL catalog to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredFrameworks?.map((framework) => (
                <div
                  key={`${framework.kind}-${framework.id}`}
                  className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-secondary transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-foreground">{framework.name}</h3>
                      {/* Type badge — distinguishes compliance frameworks
                          (NIST 800-53, ISO 27001) from maturity frameworks
                          (NIST CSF, C2M2) at a glance. */}
                      {framework.kind === "compliance" ? (
                        <Badge variant="info">Compliance</Badge>
                      ) : (
                        <Badge variant="neutral">Maturity</Badge>
                      )}
                      <Badge variant="code">{framework.code}</Badge>
                      <span className="font-mono text-xs text-muted-foreground">v{framework.version}</span>
                      {framework.isActive ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="neutral">Inactive</Badge>
                      )}
                      {framework.kind === "maturity" && framework.isSystemTemplate && (
                        <Badge variant="warning">System Template</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {framework.kind === "compliance"
                        ? `${framework.controlCount} controls`
                        : "Maturity framework"}
                      {framework.description && ` • ${framework.description}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={
                        framework.kind === "compliance"
                          ? `/admin/frameworks/${framework.id}`
                          : `/admin/frameworks/maturity/${framework.id}`
                      }
                    >
                      <Button variant="outline" size="sm">
                        <Eye className="mr-1 h-4 w-4" />
                        View
                      </Button>
                    </Link>
                    {/* Activate/deactivate/delete are compliance-only —
                        maturity frameworks are managed via the maturity
                        dashboard and don't have the same lifecycle. */}
                    {framework.kind === "compliance" && (
                      <>
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
                          className="text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(framework.id, framework.name)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
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
