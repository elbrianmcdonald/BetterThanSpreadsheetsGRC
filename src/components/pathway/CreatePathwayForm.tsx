"use client";

/**
 * CreatePathwayForm — the one canonical "create an exploitation pathway" form.
 *
 * Follows the unified-finding-create-form pattern: a single embeddable,
 * onCreated/onCancel-driven form reused at every spawn site (the Admin library
 * page, the assessment Exploitation Pathways tab, and finding/risk forms).
 * Every pathway lands in the org master library. Optional pass-through
 * `assessmentKind`/`assessmentId` link the new pathway to an assessment on
 * create — they are threaded straight into the payload, never rendered as
 * editable fields, so a spawn site can't be re-pointed.
 *
 * Steps (MITRE technique + finding/risk members) are authored separately, in an
 * assessment context where findings/risks exist — see `AddStepForm`.
 */

import { useState } from "react";
import { AssessmentKind } from "@prisma/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface CreatePathwayFormProps {
  /** When both are set, the new pathway is also linked to this assessment. */
  assessmentKind?: AssessmentKind;
  assessmentId?: string;
  onCreated: (pathwayId: string) => void;
  onCancel?: () => void;
  submitLabel?: string;
}

export function CreatePathwayForm({
  assessmentKind,
  assessmentId,
  onCreated,
  onCancel,
  submitLabel = "Create pathway",
}: CreatePathwayFormProps) {
  const [name, setName] = useState("");
  const [verdict, setVerdict] = useState("");
  const [narrative, setNarrative] = useState("");
  const [blastRadius, setBlastRadius] = useState("");

  const create = api.pathway.create.useMutation({
    onSuccess: (p) => {
      toast.success("Exploitation pathway created");
      onCreated(p.id);
    },
    onError: (e) => toast.error(e.message),
  });

  const hasAssessment = assessmentKind != null && assessmentId != null;

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="pw-name">
          Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="pw-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Phishing → credential theft → lateral movement"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pw-verdict">Verdict</Label>
        <Textarea
          id="pw-verdict"
          rows={2}
          value={verdict}
          onChange={(e) => setVerdict(e.target.value)}
          placeholder="Headline conclusion of this attack path"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pw-narrative">Narrative</Label>
        <Textarea
          id="pw-narrative"
          rows={4}
          value={narrative}
          onChange={(e) => setNarrative(e.target.value)}
          placeholder="How the chain unfolds, step by step"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pw-blast">Blast radius</Label>
        <Textarea
          id="pw-blast"
          rows={2}
          value={blastRadius}
          onChange={(e) => setBlastRadius(e.target.value)}
          placeholder="What's exposed if this path is exploited"
        />
      </div>
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={create.isPending}>
            Cancel
          </Button>
        )}
        <Button
          disabled={!name.trim() || create.isPending}
          onClick={() =>
            create.mutate({
              name: name.trim(),
              verdict: verdict.trim() || undefined,
              narrative: narrative.trim() || undefined,
              blastRadius: blastRadius.trim() || undefined,
              ...(hasAssessment ? { assessmentKind, assessmentId } : {}),
            })
          }
        >
          {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
