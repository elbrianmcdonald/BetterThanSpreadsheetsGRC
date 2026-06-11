"use client";

/**
 * Inline "Create Risk" dialog.
 *
 * Mirrors CreateFindingDialog: used from inside the compliance assessment
 * workspace to spawn a risk tied to a specific control. Pre-fills title +
 * description from the caller and records the linkage (controlId +
 * complianceAssessmentId) server-side via risk.createForAssessment.
 *
 * Findings picker: a risk can aggregate MULTIPLE findings from this assessment
 * (RiskFindingLink join). At least one is required; the first checked becomes
 * the denormalized primary/origin finding (Risk.spawnedFromFindingId).
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Severity } from "@prisma/client";
import { Loader2, ShieldAlert } from "lucide-react";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

const SEVERITY_OPTIONS: { value: Severity; label: string }[] = [
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
];

/** Minimal finding shape the dialog needs to render the picker. */
export type AssessmentFindingOption = {
  id: string;
  identifier: string;
  title: string;
};

export interface CreateRiskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefilled title (e.g., "AC-1 — Access Control Policy"). */
  initialTitle?: string;
  /** Prefilled description (e.g., control narrative + context). */
  initialDescription?: string;
  initialSeverity?: Severity;
  /** Linkage — optional, set by caller based on where the dialog was opened. */
  controlId?: string;
  complianceAssessmentId: string;
  /** Small label shown above the title, e.g., "Linked to AC-1 — …". */
  contextLabel?: string;
  /**
   * Optional pre-supplied findings for the "Link to finding" picker. When
   * omitted the dialog queries finding.listForAssessment itself.
   */
  assessmentFindings?: AssessmentFindingOption[];
}

export function CreateRiskDialog(props: CreateRiskDialogProps) {
  const [title, setTitle] = useState(props.initialTitle ?? "");
  const [description, setDescription] = useState(props.initialDescription ?? "");
  const [severity, setSeverity] = useState<Severity>(
    props.initialSeverity ?? "MEDIUM"
  );
  const [linkedFindingIds, setLinkedFindingIds] = useState<string[]>([]);

  // Fall back to querying findings when the caller didn't supply them.
  const { data: queriedFindings } = api.finding.listForAssessment.useQuery(
    { assessmentId: props.complianceAssessmentId, assessmentType: "COMPLIANCE" },
    { enabled: props.open && !props.assessmentFindings }
  );

  const findingOptions = useMemo<AssessmentFindingOption[]>(
    () =>
      props.assessmentFindings ??
      (queriedFindings?.map((f) => ({
        id: f.id,
        identifier: f.identifier,
        title: f.title,
      })) ??
        []),
    [props.assessmentFindings, queriedFindings]
  );

  // Re-hydrate local state when the dialog opens with new prefill props.
  useEffect(() => {
    if (props.open) {
      setTitle(props.initialTitle ?? "");
      setDescription(props.initialDescription ?? "");
      setSeverity(props.initialSeverity ?? "MEDIUM");
      setLinkedFindingIds([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open, props.initialTitle, props.initialDescription, props.initialSeverity]);

  const utils = api.useUtils();
  const createMutation = api.risk.createForAssessment.useMutation({
    onSuccess: (risk) => {
      toast.success(
        <span>
          Risk <strong>{risk.identifier}</strong> created —{" "}
          <Link href={`/risks/${risk.id}`} className="underline" target="_blank">
            open
          </Link>
        </span>
      );
      void utils.risk.listForAssessment.invalidate({
        assessmentId: props.complianceAssessmentId,
        assessmentType: "COMPLIANCE",
      });
      void utils.risk.list.invalidate();
      props.onOpenChange(false);
    },
    onError: (e) => toast.error(e.message || "Failed to create risk"),
  });

  const descLen = description.trim().length;
  const titleLen = title.trim().length;
  const hasFinding = linkedFindingIds.length >= 1;
  const canSubmit =
    titleLen >= 1 &&
    titleLen <= 500 &&
    descLen >= 1 &&
    hasFinding &&
    !createMutation.isPending;

  const toggleFinding = (id: string, checked: boolean) => {
    setLinkedFindingIds((prev) =>
      checked ? [...prev, id] : prev.filter((x) => x !== id)
    );
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    createMutation.mutate({
      title: title.trim(),
      description: description.trim(),
      severity,
      complianceAssessmentId: props.complianceAssessmentId,
      controlId: props.controlId,
      linkedFindingIds,
    });
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Create risk</DialogTitle>
          <DialogDescription>
            Raise a risk spotted during this assessment and tie it to the
            finding(s) it came from. It'll show up in the Risks tab and the Risk
            register.
          </DialogDescription>
        </DialogHeader>

        {props.contextLabel && (
          <Alert className="bg-blue-50 border-blue-200">
            <ShieldAlert className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-sm">
              {props.contextLabel}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div>
            <Label htmlFor="risk-title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="risk-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short summary of the risk"
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {titleLen} / 500 characters
            </p>
          </div>

          <div>
            <Label htmlFor="risk-description">
              Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="risk-description"
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What the risk is, the exposure, and why it matters"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {descLen} characters
            </p>
          </div>

          <div>
            <Label>Severity</Label>
            <Select
              value={severity}
              onValueChange={(v) => setSeverity(v as Severity)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEVERITY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>
              Findings <span className="text-destructive">*</span>
            </Label>
            {findingOptions.length === 0 ? (
              <p className="text-xs text-muted-foreground mt-1">
                No findings in this assessment yet — raise a finding first, then
                tie the risk to it.
              </p>
            ) : (
              <>
                <div className="mt-1 max-h-48 space-y-1 overflow-y-auto rounded-md border p-2">
                  {findingOptions.map((f) => {
                    const checked = linkedFindingIds.includes(f.id);
                    return (
                      <label
                        key={f.id}
                        className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 hover:bg-muted"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(c) =>
                            toggleFinding(f.id, c === true)
                          }
                          className="mt-0.5"
                        />
                        <span className="text-sm">
                          <span className="mr-1 font-mono text-xs text-muted-foreground">
                            {f.identifier}
                          </span>
                          <span>{f.title}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {linkedFindingIds.length === 0
                    ? "Select at least one finding from this assessment. The first becomes the primary."
                    : `${linkedFindingIds.length} finding${
                        linkedFindingIds.length === 1 ? "" : "s"
                      } selected.`}
                </p>
              </>
            )}
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
              "Create risk"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
