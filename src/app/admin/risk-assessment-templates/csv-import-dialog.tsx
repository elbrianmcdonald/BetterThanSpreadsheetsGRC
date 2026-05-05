"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { parseCsv, REQUIRED_HEADERS } from "./csv-parse";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingTemplates: { id: string; name: string }[];
}

type Target =
  | { kind: "new"; name: string; description: string }
  | { kind: "existing"; templateId: string };

export function CsvImportDialog({ open, onOpenChange, existingTemplates }: Props) {
  const router = useRouter();
  const utils = api.useUtils();
  const [target, setTarget] = useState<Target>({ kind: "new", name: "", description: "" });
  const [parsed, setParsed] = useState<ReturnType<typeof parseCsv> | null>(null);

  const reset = () => {
    setTarget({ kind: "new", name: "", description: "" });
    setParsed(null);
  };

  const importMutation = api.riskAssessmentTemplate.importCsv.useMutation({
    onSuccess: (res) => {
      void utils.riskAssessmentTemplate.list.invalidate();
      toast.success(
        `Imported ${res.questionsCreated} question${res.questionsCreated === 1 ? "" : "s"} across ${res.sectionsCreated} section${res.sectionsCreated === 1 ? "" : "s"}` +
          (res.unresolvedCount > 0
            ? ` — ${res.unresolvedCount} reference${res.unresolvedCount === 1 ? "" : "s"} need resolution`
            : "")
      );
      onOpenChange(false);
      reset();
      router.push(`/admin/risk-assessment-templates/${res.templateId}`);
    },
    onError: (e) => toast.error(`Import failed: ${e.message}`),
  });

  const handleFile = async (file: File) => {
    const text = await file.text();
    const result = parseCsv(text);
    if (result.errors.length > 0) {
      toast.error(result.errors.join("; "));
      return;
    }
    const missing = REQUIRED_HEADERS.filter((h) => !result.headers.includes(h));
    if (missing.length > 0) {
      toast.error(`Missing required column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}`);
      setParsed(null);
      return;
    }
    if (result.rows.length === 0) {
      toast.error("CSV has no data rows");
      return;
    }
    setParsed(result);
  };

  const canImport =
    parsed &&
    parsed.rows.length > 0 &&
    (target.kind === "existing"
      ? Boolean(target.templateId)
      : Boolean(target.name.trim()));

  const handleImport = () => {
    if (!parsed) return;
    const rows = parsed.rows.map((r) => ({
      section: r.section ?? "",
      number: r.number?.trim() ? r.number : null,
      question: r.question ?? "",
      framework_ref: r.framework_ref?.trim() ? r.framework_ref : null,
    }));
    if (target.kind === "new") {
      importMutation.mutate({
        target: {
          kind: "new",
          name: target.name.trim(),
          description: target.description.trim() || null,
        },
        rows,
      });
    } else {
      importMutation.mutate({
        target: { kind: "existing", templateId: target.templateId },
        rows,
      });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import CSV
          </DialogTitle>
          <DialogDescription>
            Required columns: <code className="text-xs">{REQUIRED_HEADERS.join(", ")}</code>.
            Each row becomes a question. Same-named sections are grouped.
            Unresolved <code className="text-xs">framework_ref</code> values are stored
            as raw strings for later resolution.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Destination</Label>
            <RadioGroup
              value={target.kind}
              onValueChange={(v) =>
                setTarget(
                  v === "new"
                    ? { kind: "new", name: "", description: "" }
                    : { kind: "existing", templateId: "" }
                )
              }
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="new" id="t-new" />
                <Label htmlFor="t-new" className="font-normal cursor-pointer">
                  Create a new template
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem
                  value="existing"
                  id="t-existing"
                  disabled={existingTemplates.length === 0}
                />
                <Label
                  htmlFor="t-existing"
                  className="font-normal cursor-pointer"
                >
                  Append to an existing template
                </Label>
              </div>
            </RadioGroup>
          </div>

          {target.kind === "new" ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-name">Template name *</Label>
                <Input
                  id="new-name"
                  value={target.name}
                  onChange={(e) => setTarget({ ...target, name: e.target.value })}
                  placeholder="e.g., NIST 800-53 Moderate Baseline"
                  maxLength={255}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-desc">Description</Label>
                <Input
                  id="new-desc"
                  value={target.description}
                  onChange={(e) => setTarget({ ...target, description: e.target.value })}
                  placeholder="Optional"
                  maxLength={2000}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="existing-template">Template</Label>
              <Select
                value={target.templateId}
                onValueChange={(v) => setTarget({ kind: "existing", templateId: v })}
              >
                <SelectTrigger id="existing-template">
                  <SelectValue placeholder="Pick a template..." />
                </SelectTrigger>
                <SelectContent>
                  {existingTemplates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="csv-file">CSV file</Label>
            <Input
              id="csv-file"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
            <p className="text-xs text-muted-foreground">
              Save your spreadsheet as CSV (UTF-8). Excel files are not supported in this version.
            </p>
          </div>

          {parsed && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Preview ({parsed.rows.length} rows)</Label>
                <Badge variant="secondary">
                  Unique sections: {new Set(parsed.rows.map((r) => r.section)).size}
                </Badge>
              </div>
              <div className="rounded-md border max-h-[300px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-card">
                    <TableRow>
                      <TableHead>Section</TableHead>
                      <TableHead>#</TableHead>
                      <TableHead>Question</TableHead>
                      <TableHead>Ref</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsed.rows.slice(0, 100).map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs">{r.section}</TableCell>
                        <TableCell className="text-xs font-mono">{r.number}</TableCell>
                        <TableCell className="text-xs max-w-md truncate">
                          {r.question}
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          {r.framework_ref || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {parsed.rows.length > 100 && (
                  <p className="text-xs text-muted-foreground p-2 text-center">
                    ...and {parsed.rows.length - 100} more
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              reset();
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!canImport || importMutation.isPending}
          >
            {importMutation.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Import {parsed ? `${parsed.rows.length} rows` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
