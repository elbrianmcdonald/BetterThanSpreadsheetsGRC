"use client";

/**
 * Risk treatment section (Story 23.1 — acceptance lives ONLY on the Risk).
 *
 * Shows the latest treatment decision and offers "Accept Risk" — a formal
 * TreatmentDecision.ACCEPT with required justification, audit-logged, with
 * segregation of duties enforced server-side (the risk's creator cannot
 * accept it). When an accepted risk's effective score later rises, the
 * acceptance is flagged for re-review (badge here + review cadence pull).
 */

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, FileCheck, Loader2, ShieldCheck } from "lucide-react";

import { api } from "@/trpc/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const TREATMENT_LABELS: Record<string, string> = {
  ACCEPT: "Accepted",
  REMEDIATE: "Remediate",
  TRANSFER: "Transferred",
  AVOID: "Avoid",
};

interface RiskTreatmentSectionProps {
  riskId: string;
  canManage: boolean;
  acceptanceReReviewRequired: boolean;
  /** Called after a treatment decision is recorded (refetch). */
  onChanged: () => void;
}

export function RiskTreatmentSection({
  riskId,
  canManage,
  acceptanceReReviewRequired,
  onChanged,
}: RiskTreatmentSectionProps) {
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [justification, setJustification] = useState("");

  const { data: treatments } = api.risk.getTreatments.useQuery({ riskId });
  const latest = treatments?.[0] ?? null;

  const utils = api.useUtils();
  const acceptMutation = api.risk.createTreatment.useMutation({
    onSuccess: () => {
      toast.success("Risk accepted — decision recorded");
      void utils.risk.getTreatments.invalidate({ riskId });
      void utils.risk.getById.invalidate({ id: riskId });
      setAcceptOpen(false);
      setJustification("");
      onChanged();
    },
    onError: (e) => toast.error(e.message || "Failed to record acceptance"),
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileCheck className="h-4 w-4 text-green-600" />
            Treatment
            {latest && (
              <Badge variant={latest.treatmentType === "ACCEPT" ? "default" : "secondary"}>
                {TREATMENT_LABELS[latest.treatmentType] ?? latest.treatmentType}
              </Badge>
            )}
            {acceptanceReReviewRequired && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                Acceptance re-review required
              </Badge>
            )}
          </CardTitle>
          {canManage && (
            <Button variant="outline" size="sm" onClick={() => setAcceptOpen(true)}>
              <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
              Accept Risk
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Acceptance is a risk-level decision — linked findings stay open
          observations. If the effective score later rises, the acceptance is
          flagged for re-review.
        </p>
      </CardHeader>
      <CardContent>
        {latest ? (
          <div className="text-sm space-y-1">
            <p>
              <span className="font-medium">
                {TREATMENT_LABELS[latest.treatmentType] ?? latest.treatmentType}
              </span>{" "}
              by {latest.decidedBy?.name ?? "Unknown"} on{" "}
              {new Date(latest.decidedAt).toLocaleDateString()}
            </p>
            <p className="text-muted-foreground whitespace-pre-wrap">
              {latest.justification}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No treatment decision yet.</p>
        )}
      </CardContent>

      <Dialog open={acceptOpen} onOpenChange={setAcceptOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Accept this risk</DialogTitle>
            <DialogDescription>
              Records a formal acceptance decision with your justification. The
              risk&apos;s creator cannot accept it (segregation of duties).
              Linked findings remain open — the underlying gaps still exist.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="accept-justification">
              Justification <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="accept-justification"
              rows={4}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Why is this exposure acceptable? Business context, compensating factors, appetite..."
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAcceptOpen(false)}
              disabled={acceptMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                acceptMutation.mutate({
                  riskId,
                  treatmentType: "ACCEPT",
                  justification: justification.trim(),
                })
              }
              disabled={justification.trim().length < 10 || acceptMutation.isPending}
            >
              {acceptMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Recording…
                </>
              ) : (
                "Accept risk"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
