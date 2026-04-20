"use client";

/**
 * Shared Excel import panel for OrganizationalControls.
 *
 * Used by both /controls (bulk-create standalone controls) and
 * /admin/frameworks/new (bulk-create controls + framework in one shot).
 * Parses .xlsx client-side; any row error blocks the whole import.
 *
 * The consumer wires the "Import" button to whichever mutation applies —
 * this panel only manages file state + preview + owner selection.
 */

import { useState, useRef } from "react";
import { Download, Upload, FileSpreadsheet, X, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PersonPicker } from "@/components/person/PersonPicker";
import {
  parseOrgControlsExcel,
  validateExcelFile,
  type OrgControlImportRow,
  type RowError,
} from "@/lib/excel-org-control-import";

export interface BulkImportPanelProps {
  /** Shown above the panel (e.g., to explain framework-tab vs /controls semantics) */
  helperText?: string;
  /** Callback when parse completes successfully — parent stays in sync with selected rows. */
  onRowsChange: (rows: OrgControlImportRow[]) => void;
  /** Callback for default owner selection (optional). */
  onDefaultOwnerChange: (personId: string | null) => void;
  /** Current default owner (controlled). */
  defaultOwnerId: string | null;
}

export function BulkImportPanel({
  helperText,
  onRowsChange,
  onDefaultOwnerChange,
  defaultOwnerId,
}: BulkImportPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<OrgControlImportRow[]>([]);
  const [errors, setErrors] = useState<RowError[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [parsing, setParsing] = useState(false);

  const clearFile = () => {
    setFileName(null);
    setRows([]);
    setErrors([]);
    setTotalRows(0);
    onRowsChange([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFile = async (file: File) => {
    const err = validateExcelFile(file.name, file.size);
    if (err) {
      toast.error(err);
      return;
    }

    setParsing(true);
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      // Convert to base64 for the parser
      let binary = "";
      const bytes = new Uint8Array(buffer);
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(
          null,
          Array.from(bytes.subarray(i, i + chunk))
        );
      }
      const base64 = btoa(binary);
      const result = parseOrgControlsExcel(base64);

      setTotalRows(result.totalRows);
      setErrors(result.errors);
      setRows(result.rows);
      onRowsChange(result.rows);

      if (result.success) {
        toast.success(`Parsed ${result.rows.length} row${result.rows.length === 1 ? "" : "s"}`);
      } else {
        toast.error(
          `Found ${result.errors.length} error${result.errors.length === 1 ? "" : "s"} — fix before importing`
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to parse file");
      clearFile();
    } finally {
      setParsing(false);
    }
  };

  return (
    <div className="space-y-4">
      {helperText && (
        <p className="text-sm text-muted-foreground">{helperText}</p>
      )}

      <div className="flex items-center gap-2">
        <Button variant="outline" asChild>
          <a href="/api/templates/org-controls-import" download>
            <Download className="h-4 w-4 mr-2" />
            Download template
          </a>
        </Button>

        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={parsing}
        >
          <Upload className="h-4 w-4 mr-2" />
          {fileName ? "Replace file" : "Upload .xlsx"}
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />

        {fileName && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileSpreadsheet className="h-4 w-4" />
            <span className="truncate max-w-xs">{fileName}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={clearFile}
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="max-w-md">
        <Label>Default owner (optional)</Label>
        <PersonPicker
          value={defaultOwnerId}
          onChange={(id) => onDefaultOwnerChange(id ?? null)}
          placeholder="Assign an owner to every imported control…"
          clearable
        />
        <p className="text-xs text-muted-foreground mt-1">
          Each imported control needs an owner eventually. Pick one now to
          apply to all, or assign individually from /controls later.
        </p>
      </div>

      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="font-medium">
              {errors.length} error{errors.length === 1 ? "" : "s"} found — import blocked
            </div>
            <ScrollArea className="max-h-60 mt-2">
              <ul className="text-xs space-y-1 font-mono">
                {errors.map((e, i) => (
                  <li key={i}>
                    {e.row > 0 ? `Row ${e.row}` : "File"}
                    {" · "}
                    <span className="text-foreground">{e.field}</span>
                    {" — "}
                    {e.message}
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </AlertDescription>
        </Alert>
      )}

      {rows.length > 0 && errors.length === 0 && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            <div className="font-medium">
              {rows.length} row{rows.length === 1 ? "" : "s"} ready to import
              {totalRows !== rows.length && ` (${totalRows} total in file)`}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {rows.length > 0 && errors.length === 0 && (
        <div className="rounded-md border">
          <ScrollArea className="max-h-80">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Local ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Family</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, 50).map((r, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-mono text-xs">
                      {r.localControlId ?? <span className="text-muted-foreground">auto</span>}
                    </TableCell>
                    <TableCell className="text-sm">{r.name}</TableCell>
                    <TableCell className="text-xs">{r.controlType}</TableCell>
                    <TableCell className="text-xs">{r.status}</TableCell>
                    <TableCell className="text-xs">{r.family ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
          {rows.length > 50 && (
            <p className="text-xs text-muted-foreground p-2 border-t">
              Showing first 50 of {rows.length} rows.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
