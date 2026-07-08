"use client";

/**
 * Framework Import Client (Stories 24.1 + 24.2)
 *
 * Two-stage framework import wizard:
 *  - upload: choose a CSV/XLSX file (Story 24.1)
 *  - preview: verify raw parsed contents (Story 24.1)
 *  - mapping: map file columns to canonical control fields (Story 24.2)
 * Commit (Story 24.3) consumes { fileContent, mapping } held in state here.
 *
 * Wizard steps use the inline string-union pattern established by the OSCAL
 * import dialog (admin/frameworks/client.tsx) — there is no Stepper primitive.
 */

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Columns3,
  PartyPopper,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/trpc/react";
import { validateImportFile, MAX_FILE_SIZE_BYTES } from "@/lib/framework-import-parser";
import {
  CANONICAL_FIELDS,
  suggestColumnMapping,
  type CanonicalFieldKey,
  type ColumnMapping,
} from "@/lib/framework-import-mapping";

type ImportStep = "upload" | "preview" | "mapping" | "done";

// Radix SelectItem cannot use an empty-string value; sentinel = "not mapped".
const UNMAPPED = "__unmapped__";

interface ParsedPreview {
  headers: string[];
  previewRows: string[][];
  totalRows: number;
  issues: { severity: "error" | "warning"; message: string }[];
}

export function FrameworkImportClient() {
  const [step, setStep] = useState<ImportStep>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ParsedPreview | null>(null);
  // Base64 file content is retained so the commit step (Story 24.3) can re-send
  // it together with the chosen mapping (re-send-per-stage convention).
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [rowErrors, setRowErrors] = useState<{ row: number; message: string }[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [version, setVersion] = useState("");
  const [importResult, setImportResult] = useState<{
    frameworkId: string;
    frameworkName: string;
    controlsImported: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseMutation = api.framework.parseImportFile.useMutation({
    onSuccess: (data) => {
      if (!data.valid) {
        setErrorMessages(
          data.issues.filter((i) => i.severity === "error").map((i) => i.message),
        );
        setPreview(null);
        return;
      }
      setPreview(data);
      setErrorMessages([]);
      setStep("preview");
    },
    onError: (error) => {
      setErrorMessages([error.message]);
      setPreview(null);
    },
  });

  const commitMutation = api.framework.commitImport.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setImportResult({
          frameworkId: data.frameworkId,
          frameworkName: data.frameworkName,
          controlsImported: data.controlsImported,
        });
        setErrorMessages([]);
        setRowErrors([]);
        setStep("done");
        return;
      }
      // Failure shapes: { issues } (duplicate/parse) or { rowErrors } (validation)
      setRowErrors("rowErrors" in data && data.rowErrors ? data.rowErrors : []);
      setErrorMessages(
        "issues" in data && data.issues ? data.issues.map((i) => i.message) : [],
      );
    },
    onError: (error) => {
      setErrorMessages([error.message]);
    },
  });

  const resetToUpload = useCallback(() => {
    setStep("upload");
    setSelectedFile(null);
    setPreview(null);
    setFileContent(null);
    setMapping(null);
    setErrorMessages([]);
    setRowErrors([]);
    setName("");
    setCode("");
    setVersion("");
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleFileSelect = useCallback(
    (file: File) => {
      setErrorMessages([]);
      setPreview(null);
      setFileContent(null);
      setMapping(null);

      // Cheap client-side pre-check for instant feedback; the server re-validates
      const validationError = validateImportFile(file.name, file.size);
      if (validationError) {
        setSelectedFile(null);
        setErrorMessages([validationError]);
        return;
      }

      setSelectedFile(file);

      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const base64Content = dataUrl.split(",")[1] ?? dataUrl;
        setFileContent(base64Content);
        parseMutation.mutate({ fileContent: base64Content, fileName: file.name });
      };
      reader.onerror = () => {
        setErrorMessages(["Failed to read file. Please try again."]);
      };
      reader.readAsDataURL(file);
    },
    [parseMutation],
  );

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  // Advance preview → mapping. Seed auto-suggestions only on first entry so
  // returning from "Back to preview" preserves the user's manual edits.
  // (handleFileSelect / resetToUpload set mapping back to null for a new file.)
  const startMapping = useCallback(() => {
    if (!preview) return;
    setMapping((prev) => prev ?? suggestColumnMapping(preview.headers));
    setStep("mapping");
  }, [preview]);

  // Assign a canonical field to a column index, enforcing single-assignment:
  // if the chosen column is already used by another field, clear it there.
  const assignColumn = useCallback(
    (field: CanonicalFieldKey, columnIndex: number | null) => {
      setMapping((prev) => {
        if (!prev) return prev;
        const next: ColumnMapping = { ...prev, [field]: columnIndex };
        if (columnIndex !== null) {
          for (const other of CANONICAL_FIELDS) {
            if (other.key !== field && next[other.key] === columnIndex) {
              next[other.key] = null;
            }
          }
        }
        return next;
      });
    },
    [],
  );

  const missingRequired = CANONICAL_FIELDS.filter(
    (f) => f.required && (!mapping || mapping[f.key] === null),
  ).map((f) => f.label);
  const detailsComplete =
    name.trim().length > 0 && code.trim().length > 0 && version.trim().length > 0;
  const canContinue = missingRequired.length === 0 && detailsComplete;

  const handleCommit = useCallback(() => {
    if (!fileContent || !selectedFile || !mapping) return;
    if (mapping.controlId === null || mapping.title === null) return;
    setErrorMessages([]);
    setRowErrors([]);
    commitMutation.mutate({
      fileContent,
      fileName: selectedFile.name,
      name: name.trim(),
      code: code.trim(),
      version: version.trim(),
      mapping: {
        controlId: mapping.controlId,
        title: mapping.title,
        description: mapping.description,
        family: mapping.family,
        parentControlId: mapping.parentControlId,
      },
    });
  }, [fileContent, selectedFile, mapping, name, code, version, commitMutation]);

  const warnings = preview?.issues.filter((i) => i.severity === "warning") ?? [];

  return (
    <div className="container mx-auto max-w-5xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Import Framework</h1>
          <p className="text-sm text-muted-foreground">
            Upload a CSV or Excel file containing a control framework, verify the preview, then
            map its columns.
          </p>
        </div>
        <Button variant="ghost" asChild>
          <Link href="/admin/frameworks">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Frameworks
          </Link>
        </Button>
      </div>

      {/* Errors (both steps) */}
      {errorMessages.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Import could not proceed</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {errorMessages.map((message, i) => (
                <li key={i}>{message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {rowErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>
            {rowErrors.length} row {rowErrors.length === 1 ? "problem" : "problems"} — fix the file
            and re-upload
          </AlertTitle>
          <AlertDescription>
            <ul className="max-h-48 list-disc overflow-y-auto pl-4">
              {rowErrors.map((e, i) => (
                <li key={i}>
                  Row {e.row}: {e.message}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Step 1 of 3 — Upload file
            </CardTitle>
            <CardDescription>
              Accepted formats: .csv and .xlsx, up to {MAX_FILE_SIZE_BYTES / 1024 / 1024}MB. The
              first row must contain column headers.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 transition-colors ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50"
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDragging(false);
              }}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                }}
              />
              <FileSpreadsheet className="mb-3 h-10 w-10 text-muted-foreground" />
              {parseMutation.isPending ? (
                <p className="text-sm text-muted-foreground">Parsing {selectedFile?.name}…</p>
              ) : (
                <>
                  <p className="text-sm font-medium">
                    Drag and drop your framework file here, or click to browse
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    e.g., an ISO 27001 control export or an internal control catalog
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {step === "preview" && preview && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Step 2 of 3 — Verify preview
            </CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1">
                <FileSpreadsheet className="h-4 w-4" />
                {selectedFile?.name}
              </span>
              <Badge variant="secondary">{preview.totalRows} data rows</Badge>
              <Badge variant="secondary">{preview.headers.length} columns</Badge>
              <span className="text-muted-foreground">
                Showing first {preview.previewRows.length} of {preview.totalRows} rows
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {warnings.map((warning, i) => (
              <Alert key={i}>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{warning.message}</AlertDescription>
              </Alert>
            ))}

            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {preview.headers.map((header) => (
                      <TableHead key={header} className="whitespace-nowrap font-medium">
                        {header}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.previewRows.map((row, rowIndex) => (
                    <TableRow key={rowIndex}>
                      {row.map((cell, cellIndex) => (
                        <TableCell
                          key={cellIndex}
                          className="max-w-[320px] truncate whitespace-nowrap"
                          title={cell}
                        >
                          {cell}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={resetToUpload}>
                <X className="mr-2 h-4 w-4" />
                Choose a different file
              </Button>
              <Button onClick={startMapping}>
                Continue to Column Mapping
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "mapping" && preview && mapping && fileContent && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Columns3 className="h-5 w-5" />
              Step 3 of 3 — Map columns
            </CardTitle>
            <CardDescription>
              Match your file&apos;s columns to the platform&apos;s control fields. We&apos;ve
              pre-filled the ones we recognized — adjust any that look wrong.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              {CANONICAL_FIELDS.map((field) => {
                const selectedIndex = mapping[field.key];
                const samples =
                  selectedIndex === null
                    ? []
                    : preview.previewRows
                        .map((row) => row[selectedIndex])
                        .filter((v) => v && v.length > 0)
                        .slice(0, 3);

                return (
                  <div
                    key={field.key}
                    className="grid grid-cols-1 gap-2 rounded-md border p-3 sm:grid-cols-[220px_1fr] sm:items-start"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{field.label}</span>
                      {field.required ? (
                        <Badge variant="secondary">Required</Badge>
                      ) : (
                        <Badge variant="outline">Optional</Badge>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Select
                        value={selectedIndex === null ? UNMAPPED : String(selectedIndex)}
                        onValueChange={(value) =>
                          assignColumn(field.key, value === UNMAPPED ? null : Number(value))
                        }
                      >
                        <SelectTrigger
                          aria-label={`Map ${field.label}`}
                          className="w-full sm:max-w-sm"
                        >
                          <SelectValue placeholder="— Not mapped —" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={UNMAPPED}>— Not mapped —</SelectItem>
                          {preview.headers.map((header, index) => (
                            <SelectItem key={index} value={String(index)}>
                              {header}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedIndex !== null && (
                        <p className="text-xs text-muted-foreground">
                          {samples.length > 0 ? (
                            <>
                              e.g.{" "}
                              {samples.map((s, i) => (
                                <span key={i}>
                                  {i > 0 && ", "}
                                  <span className="font-mono">{s}</span>
                                </span>
                              ))}
                            </>
                          ) : (
                            "No sample values in the preview rows"
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Framework details — required before commit */}
            <div className="space-y-3 rounded-md border p-4">
              <p className="text-sm font-medium">Framework details</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="fw-name">Name</Label>
                  <Input
                    id="fw-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="ISO/IEC 27001"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="fw-code">Code</Label>
                  <Input
                    id="fw-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="ISO27001"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="fw-version">Version</Label>
                  <Input
                    id="fw-version"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    placeholder="2022"
                  />
                </div>
              </div>
            </div>

            {missingRequired.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Map the required field{missingRequired.length > 1 ? "s" : ""}:{" "}
                  <span className="font-medium">{missingRequired.join(", ")}</span> to continue.
                </AlertDescription>
              </Alert>
            )}
            {missingRequired.length === 0 && !detailsComplete && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Enter the framework name, code, and version to continue.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={() => setStep("preview")}
                disabled={commitMutation.isPending}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to preview
              </Button>
              <Button disabled={!canContinue || commitMutation.isPending} onClick={handleCommit}>
                {commitMutation.isPending ? "Importing…" : "Import Framework"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "done" && importResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PartyPopper className="h-5 w-5 text-green-600" />
              Framework imported
            </CardTitle>
            <CardDescription>
              <span className="font-medium">{importResult.frameworkName}</span> was created with{" "}
              {importResult.controlsImported} control
              {importResult.controlsImported === 1 ? "" : "s"}. It is inactive — activate it from the
              frameworks list when you&apos;re ready.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href={`/admin/frameworks/${importResult.frameworkId}`}>
                View framework
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/admin/frameworks">Back to frameworks</Link>
            </Button>
            <Button variant="ghost" onClick={resetToUpload}>
              Import another
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
