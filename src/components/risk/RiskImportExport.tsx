"use client";

/**
 * Export / Import controls for the Risk Register.
 *
 * Export: streams the org's risks to CSV via risk.exportRisks (honouring the
 * current search term). Import: the user picks a CSV (ideally an edited export),
 * we parse + validate it client-side (src/lib/riskCsv.ts), show a preview with
 * per-row errors, then bulk-create via risk.importRisks and report a summary.
 */

import { useCallback, useRef, useState } from "react";
import { Download, Upload, Loader2, FileWarning, CheckCircle2, X } from "lucide-react";
import { UserRole } from "@prisma/client";
import { toast } from "sonner";

import { READ_ROLES, WRITE_ROLES } from "@/lib/auth/roles";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { parseRiskImportCsv, type RiskImportParseResult } from "@/lib/riskCsv";

interface RiskImportExportProps {
  /** Current register search term — export honours it. */
  search?: string;
  /** Current user's role, for gating the buttons. */
  userRole?: UserRole;
  /** Called after a successful import so the caller can refetch. */
  onImported?: () => void;
}

type ImportResult = { created: number; skipped: number; errors: Array<{ title: string; message: string }> };

export function RiskImportExport({ search, userRole, onImported }: RiskImportExportProps) {
  const canExport = !!userRole && READ_ROLES.includes(userRole);
  const canImport = !!userRole && WRITE_ROLES.includes(userRole);

  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<RiskImportParseResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const exportMutation = api.risk.exportRisks.useMutation({
    onSuccess: (res) => {
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = res.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${res.rowCount} risk${res.rowCount === 1 ? "" : "s"} to CSV`);
    },
    onError: (err) => toast.error(err.message || "Failed to export risks"),
  });

  const importMutation = api.risk.importRisks.useMutation({
    onSuccess: (res) => {
      setResult(res);
      toast.success(
        `Imported ${res.created} risk${res.created === 1 ? "" : "s"}` +
          (res.skipped ? ` · ${res.skipped} skipped (duplicate title)` : "") +
          (res.errors.length ? ` · ${res.errors.length} failed` : "")
      );
      onImported?.();
    },
    onError: (err) => toast.error(err.message || "Failed to import risks"),
  });

  const resetDialog = useCallback(() => {
    setFileName(null);
    setParsed(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (!next) resetDialog();
    },
    [resetDialog]
  );

  const handleFile = useCallback(async (file: File) => {
    setResult(null);
    setFileName(file.name);
    const text = await file.text();
    setParsed(parseRiskImportCsv(text));
  }, []);

  const validCount = parsed?.rows.length ?? 0;
  const parseErrors = parsed?.errors ?? [];

  return (
    <>
      {canExport && (
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          onClick={() => exportMutation.mutate({ search: search || undefined })}
          disabled={exportMutation.isPending}
        >
          {exportMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Export
        </Button>
      )}

      {canImport && (
        <Button variant="outline" size="sm" className="gap-1" onClick={() => setOpen(true)}>
          <Upload className="h-4 w-4" />
          Import
        </Button>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Import risks from CSV</DialogTitle>
            <DialogDescription>
              Upload a CSV in the risk export format. Rows are validated before import;
              rows whose title already exists are skipped.
            </DialogDescription>
          </DialogHeader>

          {/* Result view (after import) */}
          {result ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 rounded-md border border-success/40 bg-success/5 p-3 text-sm">
                <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                <div>
                  <p className="font-medium text-foreground">
                    {result.created} created
                    {result.skipped > 0 && ` · ${result.skipped} skipped`}
                    {result.errors.length > 0 && ` · ${result.errors.length} failed`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Skipped rows already existed (matched by title).
                  </p>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded-md border p-2 text-xs">
                  {result.errors.map((e, i) => (
                    <p key={i} className="text-destructive">
                      {e.title}: {e.message}
                    </p>
                  ))}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={resetDialog}>
                  Import another
                </Button>
                <Button size="sm" onClick={() => handleOpenChange(false)}>
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* File picker */}
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-muted"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFile(f);
                  }}
                />
                {fileName && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={resetDialog}
                    title="Clear"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Preview */}
              {parsed && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-3 text-sm">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-success/10 px-2 py-1 text-success">
                      <CheckCircle2 className="h-4 w-4" />
                      {validCount} valid
                    </span>
                    {parseErrors.length > 0 && (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-destructive/10 px-2 py-1 text-destructive">
                        <FileWarning className="h-4 w-4" />
                        {parseErrors.length} with errors
                      </span>
                    )}
                  </div>

                  {parseErrors.length > 0 && (
                    <div className="max-h-40 overflow-y-auto rounded-md border p-2 text-xs text-muted-foreground">
                      {parseErrors.slice(0, 50).map((e, i) => (
                        <p key={i}>
                          <span className="font-mono text-[11px]">line {e.line}</span> — {e.message}
                        </p>
                      ))}
                      {parseErrors.length > 50 && <p>…and {parseErrors.length - 50} more</p>}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 border-t pt-4">
                <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={validCount === 0 || importMutation.isPending}
                  onClick={() => parsed && importMutation.mutate({ rows: parsed.rows })}
                >
                  {importMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      Importing…
                    </>
                  ) : (
                    `Import ${validCount} risk${validCount === 1 ? "" : "s"}`
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
