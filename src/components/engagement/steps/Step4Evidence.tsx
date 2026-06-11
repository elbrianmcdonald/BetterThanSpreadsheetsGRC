"use client";

/**
 * Step 4: Evidence Requests (Epic 18 — Story 18.5).
 *
 * Evidence table over `engagement.evidence.*` (item / domain / status). The
 * status chip is click-to-cycle via `evidence.cycleStatus`; a success-colored
 * Progress bar shows received/total. "Request recommended docs" calls
 * `evidence.seedRecommended`.
 */

import { useEffect, useState } from "react";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
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
import { Plus, Trash2, FileStack, Loader2 } from "lucide-react";
import { ASSESS_DOMAINS } from "@/lib/engagement/assessment-methodology";
import { InfoCallout } from "../InfoCallout";
import { EvidenceStatusChip } from "../EvidenceStatusChip";
import type { EngagementDetail, EngagementEvidenceRequest } from "../types";

interface Props {
  engagement: EngagementDetail;
  readOnly?: boolean;
}

function EvidenceRow({
  evidence,
  engagementId,
  inScopeDomains,
  readOnly,
}: {
  evidence: EngagementEvidenceRequest;
  engagementId: string;
  inScopeDomains: string[];
  readOnly?: boolean;
}) {
  const utils = api.useUtils();
  const invalidate = () =>
    void utils.engagement.getById.invalidate({ id: engagementId });

  const updateMutation = api.engagement.evidence.update.useMutation({
    onSuccess: invalidate,
  });
  const cycleMutation = api.engagement.evidence.cycleStatus.useMutation({
    onSuccess: invalidate,
  });
  const removeMutation = api.engagement.evidence.remove.useMutation({
    onSuccess: invalidate,
  });

  const [item, setItem] = useState(evidence.item);
  useEffect(() => setItem(evidence.item), [evidence.item]);

  const domainOptions = ASSESS_DOMAINS.filter((d) =>
    inScopeDomains.includes(d.id),
  );

  return (
    <TableRow>
      <TableCell>
        <Input
          value={item}
          disabled={readOnly}
          onChange={(e) => setItem(e.target.value)}
          onBlur={() => {
            if (item.trim() !== evidence.item)
              updateMutation.mutate({ id: evidence.id, item: item.trim() });
          }}
          placeholder="Document or artifact"
          className="h-8 text-sm"
        />
      </TableCell>
      <TableCell>
        <Select
          value={evidence.domain ?? ""}
          disabled={readOnly}
          onValueChange={(v) =>
            updateMutation.mutate({ id: evidence.id, domain: v })
          }
        >
          <SelectTrigger className="h-8 w-44">
            <SelectValue placeholder="Domain" />
          </SelectTrigger>
          <SelectContent>
            {domainOptions.length === 0 ? (
              <SelectItem value="__none" disabled>
                No in-scope domains
              </SelectItem>
            ) : (
              domainOptions.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <EvidenceStatusChip
          status={evidence.status}
          disabled={readOnly || cycleMutation.isPending}
          onCycle={() => cycleMutation.mutate({ id: evidence.id })}
        />
      </TableCell>
      <TableCell>
        {!readOnly ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => removeMutation.mutate({ id: evidence.id })}
            disabled={removeMutation.isPending}
            aria-label="Remove request"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

export function Step4Evidence({ engagement, readOnly }: Props) {
  const utils = api.useUtils();
  const invalidate = () =>
    void utils.engagement.getById.invalidate({ id: engagement.id });

  const createMutation = api.engagement.evidence.create.useMutation({
    onSuccess: invalidate,
  });
  const seedMutation = api.engagement.evidence.seedRecommended.useMutation({
    onSuccess: invalidate,
  });

  const requests = [...engagement.evidenceRequests].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  const total = requests.length;
  const received = requests.filter((r) => r.status === "RECEIVED").length;
  const pct = total === 0 ? 0 : Math.round((received / total) * 100);

  return (
    <div className="space-y-5">
      <InfoCallout>
        Issue and track the document and artifact requests that ground your
        ratings. Click a status chip to advance it through requested → partial →
        received.
      </InfoCallout>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="eyebrow">Evidence requests</p>
        {!readOnly ? (
          <div className="flex gap-2">
            {requests.length === 0 ? (
              <Button
                variant="outline"
                onClick={() =>
                  seedMutation.mutate({ engagementId: engagement.id })
                }
                disabled={seedMutation.isPending}
              >
                {seedMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileStack className="mr-2 h-4 w-4" />
                )}
                Request recommended docs
              </Button>
            ) : null}
            <Button
              onClick={() =>
                createMutation.mutate({
                  engagementId: engagement.id,
                  item: "New request",
                })
              }
              disabled={createMutation.isPending}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add request
            </Button>
          </div>
        ) : null}
      </div>

      {total > 0 ? (
        <div className="rounded-lg border bg-card px-4 py-3">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="eyebrow">Collection progress</span>
            <span className="tnum text-muted-foreground">
              {received} of {total} received
            </span>
          </div>
          <Progress
            value={pct}
            className="bg-success/20 [&>div]:bg-success"
          />
        </div>
      ) : null}

      {requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
          <FileStack className="mb-3 h-7 w-7 text-muted-foreground" />
          <p className="font-medium">No evidence requested</p>
          <p className="text-sm text-muted-foreground">
            Use the recommended docs to seed a starting checklist.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="w-48">Domain</TableHead>
                <TableHead className="w-36">Status</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r) => (
                <EvidenceRow
                  key={r.id}
                  evidence={r}
                  engagementId={engagement.id}
                  inScopeDomains={engagement.inScopeDomains}
                  readOnly={readOnly}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
