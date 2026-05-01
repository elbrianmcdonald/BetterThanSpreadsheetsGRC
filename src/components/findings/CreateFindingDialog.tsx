"use client";

/**
 * Inline "Create Finding" dialog.
 *
 * Used from inside maturity/compliance assessment pages to spawn a finding
 * tied to a specific control or domain. Pre-fills title + description from
 * the caller and records the linkage (controlId for compliance, maturity
 * IDs for maturity) server-side.
 *
 * Uses a leaner form than /findings/new — no inline Business Unit creation,
 * no assignee lookup; users can enrich the finding from /findings/[id]
 * after creating it.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { FindingSource, Severity } from "@prisma/client";
import { Loader2, AlertTriangle } from "lucide-react";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Threshold } from "@/lib/matrix/types";

const SOURCE_OPTIONS: { value: FindingSource; label: string }[] = [
  { value: "AUDIT", label: "Audit" },
  { value: "PENTEST", label: "Penetration Test" },
  { value: "SCANNER", label: "Vulnerability Scanner" },
  { value: "INCIDENT", label: "Security Incident" },
  { value: "MANUAL", label: "Manual Discovery" },
];

/**
 * Severity option as rendered in the dropdown. When the org has a default
 * risk matrix, we surface the matrix's threshold labels (with their colors)
 * so findings and risks share the same vocabulary. Otherwise we fall back
 * to the legacy HIGH/MEDIUM/LOW enum values.
 */
type SeverityOption = {
  /** Stable key for the dropdown — uses the threshold label or enum value */
  key: string;
  /** Human-readable label, e.g. "Critical" */
  label: string;
  /** Hex color from the matrix threshold (or null for legacy options) */
  color: string | null;
  /** Coarse Severity enum that gets persisted alongside severityLabel */
  severity: Severity;
  /** Threshold label (matches Risk.inherentScoreLabel format) */
  severityLabel: string | null;
};

const FALLBACK_SEVERITY_OPTIONS: SeverityOption[] = [
  { key: "HIGH", label: "High", color: null, severity: "HIGH", severityLabel: null },
  { key: "MEDIUM", label: "Medium", color: null, severity: "MEDIUM", severityLabel: null },
  { key: "LOW", label: "Low", color: null, severity: "LOW", severityLabel: null },
];

/**
 * Map a threshold position (0-indexed, sorted by sortOrder ascending) to
 * the legacy Severity enum so existing filters/badges keep working. The
 * top tier always maps to HIGH and the bottom tier to LOW; intermediates
 * fall to MEDIUM. For a typical 4-tier matrix (Low/Medium/High/Critical)
 * this gives Low→LOW, Medium→MEDIUM, High→MEDIUM, Critical→HIGH.
 */
function severityForThresholdIndex(index: number, total: number): Severity {
  if (total <= 1) return "MEDIUM";
  if (index === 0) return "LOW";
  if (index === total - 1) return "HIGH";
  return "MEDIUM";
}

function buildSeverityOptions(thresholds: Threshold[] | null | undefined): SeverityOption[] {
  if (!thresholds || thresholds.length === 0) return FALLBACK_SEVERITY_OPTIONS;
  // Sort ascending by sortOrder so position-based mapping is predictable,
  // then reverse for display so the highest tier appears first.
  const sortedAsc = [...thresholds].sort((a, b) => a.sortOrder - b.sortOrder);
  const total = sortedAsc.length;
  const options = sortedAsc.map((t, i) => ({
    key: t.label,
    label: t.label,
    color: t.color,
    severity: severityForThresholdIndex(i, total),
    severityLabel: t.label,
  }));
  return options.reverse();
}

export interface CreateFindingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefilled title (e.g., "GV — Govern" or "AC-1 — Access Control Policy"). */
  initialTitle?: string;
  /** Prefilled description (e.g., control narrative + context). */
  initialDescription?: string;
  initialSource?: FindingSource;
  initialSeverity?: Severity;
  /** Linkage — optional, set by caller based on where the dialog was opened. */
  controlId?: string;
  complianceAssessmentId?: string;
  maturityAssessmentId?: string;
  maturityDomainId?: string;
  /** Small label shown above the title, e.g., "Spawned from GV — Govern". */
  contextLabel?: string;
}

export function CreateFindingDialog(props: CreateFindingDialogProps) {
  const [title, setTitle] = useState(props.initialTitle ?? "");
  const [description, setDescription] = useState(props.initialDescription ?? "");
  const [source, setSource] = useState<FindingSource>(
    props.initialSource ?? "AUDIT"
  );
  // Selected severity option key — index into the dynamic option list. We
  // store the label/key rather than the enum so we can preserve the matrix
  // threshold the user picked even when several tiers map to the same enum.
  const [severityKey, setSeverityKey] = useState<string | null>(null);

  // Pull the org's default risk matrix so the severity dropdown can use the
  // matrix-defined thresholds (Critical/High/Medium/Low etc.) — keeps the
  // qualitative vocabulary consistent between findings and risks.
  const { data: defaultMatrix } = api.riskMatrix.getDefault.useQuery(
    undefined,
    { enabled: props.open }
  );

  const severityOptions = useMemo(
    () => buildSeverityOptions(defaultMatrix?.thresholds ?? null),
    [defaultMatrix?.thresholds]
  );

  const selectedSeverityOption =
    severityOptions.find((o) => o.key === severityKey) ?? severityOptions[Math.floor(severityOptions.length / 2)] ?? FALLBACK_SEVERITY_OPTIONS[1]!;

  // When the dialog opens with new prefill props (e.g., user clicked a
  // different control), re-hydrate local state.
  useEffect(() => {
    if (props.open) {
      setTitle(props.initialTitle ?? "");
      setDescription(props.initialDescription ?? "");
      setSource(props.initialSource ?? "AUDIT");
      // Pick the option whose enum matches initialSeverity, falling back to
      // the middle of the list so the user gets a sensible default.
      const initialEnum = props.initialSeverity ?? "MEDIUM";
      const match = severityOptions.find((o) => o.severity === initialEnum);
      setSeverityKey(
        match?.key ??
          severityOptions[Math.floor(severityOptions.length / 2)]?.key ??
          null
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open, props.initialTitle, props.initialDescription, severityOptions]);

  const utils = api.useUtils();
  const createMutation = api.finding.create.useMutation({
    onSuccess: (finding) => {
      toast.success(
        <span>
          Finding <strong>{finding.identifier}</strong> created —{" "}
          <Link
            href={`/findings/${finding.id}`}
            className="underline"
            target="_blank"
          >
            open
          </Link>
        </span>
      );
      // Refresh the "Findings from this assessment" list in-place.
      if (props.complianceAssessmentId) {
        void utils.finding.listForAssessment.invalidate({
          assessmentId: props.complianceAssessmentId,
          assessmentType: "COMPLIANCE",
        });
      }
      if (props.maturityAssessmentId) {
        void utils.finding.listForAssessment.invalidate({
          assessmentId: props.maturityAssessmentId,
          assessmentType: "MATURITY",
        });
      }
      void utils.finding.list.invalidate();
      props.onOpenChange(false);
    },
    onError: (e) => toast.error(e.message || "Failed to create finding"),
  });

  const descLen = description.trim().length;
  const titleLen = title.trim().length;
  const canSubmit =
    titleLen >= 5 && titleLen <= 500 && descLen >= 20 && !createMutation.isPending;

  const handleSubmit = () => {
    if (!canSubmit) return;
    createMutation.mutate({
      title: title.trim(),
      description: description.trim(),
      source,
      severity: selectedSeverityOption.severity,
      severityLabel: selectedSeverityOption.severityLabel ?? undefined,
      matrixVersionId:
        selectedSeverityOption.severityLabel && defaultMatrix?.currentVersionId
          ? defaultMatrix.currentVersionId
          : undefined,
      controlId: props.controlId,
      complianceAssessmentId: props.complianceAssessmentId,
      maturityAssessmentId: props.maturityAssessmentId,
      maturityDomainId: props.maturityDomainId,
    });
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Create finding</DialogTitle>
          <DialogDescription>
            Capture an issue spotted during this assessment. It'll be linked
            back automatically so you can pick it up in the Findings register.
          </DialogDescription>
        </DialogHeader>

        {props.contextLabel && (
          <Alert className="bg-blue-50 border-blue-200">
            <AlertTriangle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-sm">
              {props.contextLabel}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div>
            <Label htmlFor="finding-title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="finding-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short summary of the issue"
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {titleLen} / 500 characters (min 5)
            </p>
          </div>

          <div>
            <Label htmlFor="finding-description">
              Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="finding-description"
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What was observed, evidence, and why it's a gap (min 20 chars)"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {descLen} characters (min 20)
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Source</Label>
              <Select
                value={source}
                onValueChange={(v) => setSource(v as FindingSource)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Severity</Label>
              <Select
                value={selectedSeverityOption.key}
                onValueChange={(v) => setSeverityKey(v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {severityOptions.map((o) => (
                    <SelectItem key={o.key} value={o.key}>
                      <div className="flex items-center gap-2">
                        {o.color && (
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: o.color }}
                          />
                        )}
                        <span>{o.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {defaultMatrix?.thresholds && (
                <p className="text-xs text-muted-foreground mt-1">
                  Tiers from <span className="font-medium">{defaultMatrix.name}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => props.onOpenChange(false)}
            disabled={createMutation.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {createMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating…
              </>
            ) : (
              "Create finding"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
