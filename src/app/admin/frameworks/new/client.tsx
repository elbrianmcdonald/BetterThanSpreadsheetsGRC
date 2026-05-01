"use client";

/**
 * Create a custom framework — two paths:
 *   1. Pick from existing /controls organizational control library.
 *   2. Import a fresh batch of controls from Excel alongside the framework.
 *
 * Both paths land in the same /admin/frameworks/<id> detail view on success.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, X, ArrowLeft } from "lucide-react";
import { api } from "@/trpc/react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BulkImportPanel } from "@/components/organizational-control/BulkImportPanel";
import type { OrgControlImportRow } from "@/lib/excel-org-control-import";

type Mode = "library" | "excel";
type FrameworkKind = "compliance" | "maturity";

export function NewFrameworkClient() {
  const router = useRouter();

  // Compliance vs Maturity selector — picks which backend flow to use.
  // Compliance keeps the existing library/excel UI; Maturity offers a
  // "clone a system template" form (option 3a from the design discussion).
  const [kind, setKind] = useState<FrameworkKind>("compliance");

  // Framework meta (shared)
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [version, setVersion] = useState("1.0");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<Mode>("library");

  // Maturity clone state
  const [maturitySourceId, setMaturitySourceId] = useState<string>("");

  // Library tab state
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Excel tab state
  const [importRows, setImportRows] = useState<OrgControlImportRow[]>([]);
  const [importOwnerId, setImportOwnerId] = useState<string | null>(null);

  const { data: listData } = api.organizationalControl.list.useQuery({
    limit: 100,
    hideDeprecated: true,
  });

  const { data: searchResults, isFetching: isSearching } =
    api.organizationalControl.search.useQuery(
      { query: search.trim(), limit: 25, excludeIds: selectedIds },
      { enabled: search.trim().length > 0 }
    );

  const allControls = listData?.controls ?? [];

  const availableForDisplay = useMemo(() => {
    const base =
      search.trim().length > 0
        ? searchResults ?? []
        : allControls.filter((c) => !selectedIds.includes(c.id));
    return base;
  }, [search, searchResults, allControls, selectedIds]);

  const selectedControls = useMemo(() => {
    const byId = new Map(allControls.map((c) => [c.id, c] as const));
    return selectedIds
      .map((id) => byId.get(id))
      .filter((c): c is (typeof allControls)[number] => !!c);
  }, [selectedIds, allControls]);

  const addControl = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };
  const removeControl = (id: string) => {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  };

  const createFromLibrary = api.framework.createCustom.useMutation({
    onSuccess: (fw) => {
      toast.success(`Framework "${fw.name}" created with ${selectedIds.length} controls`);
      router.push(`/admin/frameworks/${fw.id}`);
    },
    onError: (e) => toast.error(e.message || "Failed to create framework"),
  });

  const createFromExcel = api.framework.createCustomFromExcel.useMutation({
    onSuccess: (fw) => {
      toast.success(`Framework "${fw.name}" created with ${importRows.length} controls`);
      router.push(`/admin/frameworks/${fw.id}`);
    },
    onError: (e) => toast.error(e.message || "Failed to create framework"),
  });

  // Maturity-only: list of system templates + existing org-specific clones
  // available as clone sources.
  const { data: maturitySources } = api.maturity.listFrameworks.useQuery(
    { includeInactive: false },
    { enabled: kind === "maturity" }
  );

  const cloneMaturity = api.maturity.cloneFramework.useMutation({
    onSuccess: (fw) => {
      toast.success(`Maturity framework "${fw.name}" cloned`);
      router.push(`/admin/frameworks/maturity/${fw.id}`);
    },
    onError: (e) => toast.error(e.message || "Failed to clone framework"),
  });

  const isPending =
    createFromLibrary.isPending ||
    createFromExcel.isPending ||
    cloneMaturity.isPending;

  const validateMeta = (): boolean => {
    if (name.trim().length < 3) {
      toast.error("Name must be at least 3 characters");
      return false;
    }
    if (code.trim().length < 2) {
      toast.error("Code must be at least 2 characters");
      return false;
    }
    return true;
  };

  const handleSubmitLibrary = () => {
    if (!validateMeta()) return;
    if (selectedIds.length === 0) {
      toast.error("Select at least one control");
      return;
    }
    createFromLibrary.mutate({
      name: name.trim(),
      code: code.trim(),
      version: version.trim() || "1.0",
      description: description.trim() || undefined,
      orgControlIds: selectedIds,
    });
  };

  const handleSubmitExcel = () => {
    if (!validateMeta()) return;
    if (importRows.length === 0) {
      toast.error("Upload a valid Excel file with at least one row");
      return;
    }
    createFromExcel.mutate({
      name: name.trim(),
      code: code.trim(),
      version: version.trim() || "1.0",
      description: description.trim() || undefined,
      controls: importRows,
      defaultOwnerId: importOwnerId ?? undefined,
    });
  };

  const handleSubmitMaturityClone = () => {
    if (name.trim().length < 3) {
      toast.error("Name must be at least 3 characters");
      return;
    }
    if (!maturitySourceId) {
      toast.error("Pick a source maturity framework to clone from");
      return;
    }
    cloneMaturity.mutate({
      sourceFrameworkId: maturitySourceId,
      name: name.trim(),
      version: version.trim() || "1.0",
    });
  };

  const controlCount = mode === "library" ? selectedIds.length : importRows.length;

  return (
    <AppLayout
      breadcrumbs={[
        { label: "Administration" },
        { label: "Frameworks", href: "/admin/frameworks" },
        { label: "New Framework" },
      ]}
    >
      <div className="container max-w-4xl mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Create framework</h1>
            <p className="text-muted-foreground mt-1">
              Author a custom framework from your /controls library, or bulk-import
              controls from an Excel file. Once created you can run a compliance
              assessment against it just like any imported framework.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/admin/frameworks">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
        </div>

        {/* Compliance vs Maturity radio. Drives which form below renders. */}
        <Card>
          <CardHeader>
            <CardTitle>Framework type</CardTitle>
            <CardDescription>
              Compliance frameworks (NIST 800-53, ISO 27001, etc.) drive
              compliance assessments. Maturity frameworks (NIST CSF, C2M2)
              drive maturity assessments.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setKind("compliance")}
                className={`flex-1 p-4 rounded-lg border-2 text-left transition-colors ${
                  kind === "compliance"
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                    Compliance
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Build from your control library or import from Excel.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setKind("maturity")}
                className={`flex-1 p-4 rounded-lg border-2 text-left transition-colors ${
                  kind === "maturity"
                    ? "border-purple-500 bg-purple-50"
                    : "border-gray-200 hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded">
                    Maturity
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Clone a system template (NIST CSF, C2M2) into your org.
                </p>
              </button>
            </div>
          </CardContent>
        </Card>

        {kind === "compliance" ? (
          <>
        <Card>
          <CardHeader>
            <CardTitle>Framework details</CardTitle>
            <CardDescription>
              Code + version must be unique in your organization.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="e.g., Internal Security Baseline"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="code">
                Code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="code"
                placeholder="ISB"
                maxLength={50}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
            </div>
            <div>
              <Label htmlFor="version">Version</Label>
              <Input
                id="version"
                placeholder="1.0"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={3}
                placeholder="What this framework covers, who it's for..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Controls{" "}
              <span className="text-muted-foreground text-base font-normal">
                ({controlCount} {mode === "library" ? "selected" : "parsed"})
              </span>
            </CardTitle>
            <CardDescription>
              Pick existing controls from your library, or bulk-create new ones from Excel.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="library">Pick from library</TabsTrigger>
                <TabsTrigger value="excel">Import from Excel</TabsTrigger>
              </TabsList>

              <TabsContent value="library" className="space-y-4 pt-4">
                {selectedControls.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs uppercase">Selected</Label>
                    <ul className="space-y-1">
                      {selectedControls.map((c) => (
                        <li
                          key={c.id}
                          className="flex items-center gap-2 p-2 rounded-md border bg-muted/30"
                        >
                          <span className="font-mono text-xs text-blue-700 shrink-0">
                            {c.localControlId}
                          </span>
                          <span className="text-sm truncate flex-1">{c.name}</span>
                          <Badge variant="outline" className="text-xs shrink-0">
                            {c.controlType}
                          </Badge>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => removeControl(c.id)}
                            aria-label="Remove control"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <Label htmlFor="ctrl-search" className="text-xs uppercase">
                    Add from /controls
                  </Label>
                  <div className="relative">
                    <Input
                      id="ctrl-search"
                      placeholder="Search by ID or name..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    {isSearching && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  {availableForDisplay.length === 0 ? (
                    <p className="text-xs text-muted-foreground mt-2">
                      {search.trim()
                        ? `No controls match "${search.trim()}". Create one at /controls first.`
                        : "No controls in the library yet. Use the Excel tab or go to /controls."}
                    </p>
                  ) : (
                    <ul className="mt-2 max-h-72 overflow-y-auto rounded-md border divide-y">
                      {availableForDisplay.map((c) => {
                        const alreadySelected = selectedIds.includes(c.id);
                        return (
                          <li key={c.id}>
                            <button
                              type="button"
                              disabled={alreadySelected}
                              onClick={() => addControl(c.id)}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 disabled:opacity-50 flex items-center gap-2"
                            >
                              <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <span className="font-mono text-xs text-blue-700 shrink-0">
                                {c.localControlId}
                              </span>
                              <span className="truncate flex-1">{c.name}</span>
                              {alreadySelected && (
                                <Badge variant="outline" className="text-xs shrink-0">
                                  Selected
                                </Badge>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="excel" className="pt-4">
                <BulkImportPanel
                  helperText="Each row creates a new organizational control AND attaches it to this framework. Fix all errors before importing — any row error blocks the whole import."
                  onRowsChange={setImportRows}
                  onDefaultOwnerChange={setImportOwnerId}
                  defaultOwnerId={importOwnerId}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => router.push("/admin/frameworks")}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={mode === "library" ? handleSubmitLibrary : handleSubmitExcel}
            disabled={isPending || controlCount === 0}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              `Create framework${controlCount > 0 ? ` (${controlCount} controls)` : ""}`
            )}
          </Button>
        </div>
        </>
        ) : (
          <>
            {/* Maturity clone — pick a source template, give it a name. */}
            <Card>
              <CardHeader>
                <CardTitle>Maturity framework details</CardTitle>
                <CardDescription>
                  Cloning copies the source's domains, scoring levels, and
                  questions into your organization. The clone is independent
                  of the source — edits won't affect the original.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="mat-source">
                    Source <span className="text-destructive">*</span>
                  </Label>
                  <select
                    id="mat-source"
                    className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={maturitySourceId}
                    onChange={(e) => setMaturitySourceId(e.target.value)}
                  >
                    <option value="">Pick a maturity framework to clone…</option>
                    {(maturitySources ?? []).map((mf) => (
                      <option key={mf.id} value={mf.id}>
                        {mf.name} ({mf.type}) v{mf.version}
                        {mf.isSystemTemplate ? " · system template" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="mat-name">
                    New name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="mat-name"
                    placeholder="e.g., Acme NIST CSF Implementation"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="mat-version">Version</Label>
                  <Input
                    id="mat-version"
                    placeholder="1.0"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => router.push("/admin/frameworks")}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button onClick={handleSubmitMaturityClone} disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Cloning...
                  </>
                ) : (
                  "Clone maturity framework"
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
