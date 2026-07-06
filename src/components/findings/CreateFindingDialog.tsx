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
 *
 * Story 20.1: matrix L×I(×E) scoring lives in the shared
 * FindingMatrixScoringSection, consumed by all finding-creation entry points.
 */

import { useEffect, useState } from "react";
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
import {
  FindingMatrixScoringSection,
  buildScoringSubmitFields,
  type FindingScoringValue,
} from "@/components/findings/FindingMatrixScoringSection";

const SOURCE_OPTIONS: { value: FindingSource; label: string }[] = [
  { value: "AUDIT", label: "Audit" },
  { value: "PENTEST", label: "Penetration Test" },
  { value: "SCANNER", label: "Vulnerability Scanner" },
  { value: "INCIDENT", label: "Security Incident" },
  { value: "RISK_ASSESSMENT", label: "Risk Assessment" },
  { value: "MANUAL", label: "Manual Discovery" },
];

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
  // Normalized scoring state reported by the shared scoring section.
  const [scoring, setScoring] = useState<FindingScoringValue | null>(null);

  // When the dialog opens with new prefill props (e.g., user clicked a
  // different control), re-hydrate local state. The scoring section resets
  // itself via resetKey.
  useEffect(() => {
    if (props.open) {
      setTitle(props.initialTitle ?? "");
      setDescription(props.initialDescription ?? "");
      setSource(props.initialSource ?? "AUDIT");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open, props.initialTitle, props.initialDescription]);

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
  // When the matrix is configured, require a complete score before submitting;
  // the categorical dropdown always has a value so no extra gate there.
  const canSubmit =
    titleLen >= 5 &&
    titleLen <= 500 &&
    descLen >= 20 &&
    !!scoring?.isComplete &&
    !createMutation.isPending;

  const handleSubmit = () => {
    if (!canSubmit || !scoring) return;
    createMutation.mutate({
      title: title.trim(),
      description: description.trim(),
      source,
      // Matrix path: L/I/(E) + version id — the server recomputes the score
      // and derives severity/severityLabel authoritatively. Categorical path:
      // picked severity + threshold label when tiers came from a matrix.
      ...buildScoringSubmitFields(scoring),
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

          <FindingMatrixScoringSection
            enabled={props.open}
            initialSeverity={props.initialSeverity}
            resetKey={props.open}
            onChange={setScoring}
          />
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
