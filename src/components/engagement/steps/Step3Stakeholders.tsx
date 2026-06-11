"use client";

/**
 * Step 3: Stakeholders & RACI (Epic 18 — Story 18.4).
 *
 * Stakeholder table over `engagement.stakeholder.*`: avatar/name, role,
 * domain (constrained to inScopeDomains), RACI badge, reviewer ✓, approver ✓.
 * Add/edit/remove + a RACI legend row.
 */

import { useEffect, useState } from "react";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { Plus, Trash2, Users } from "lucide-react";
import { ASSESS_DOMAINS } from "@/lib/engagement/assessment-methodology";
import { InfoCallout } from "../InfoCallout";
import { RaciBadge, RaciLegend } from "../RaciBadge";
import type {
  EngagementDetail,
  EngagementStakeholder,
  RaciRole,
} from "../types";

interface Props {
  engagement: EngagementDetail;
  readOnly?: boolean;
}

const RACI_OPTIONS: RaciRole[] = ["R", "A", "C", "I"];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0]![0]! + (parts[1]?.[0] ?? "")).toUpperCase();
}

function StakeholderRow({
  stakeholder,
  engagementId,
  inScopeDomains,
  readOnly,
}: {
  stakeholder: EngagementStakeholder;
  engagementId: string;
  inScopeDomains: string[];
  readOnly?: boolean;
}) {
  const utils = api.useUtils();
  const invalidate = () =>
    void utils.engagement.getById.invalidate({ id: engagementId });

  const updateMutation = api.engagement.stakeholder.update.useMutation({
    onSuccess: invalidate,
  });
  const removeMutation = api.engagement.stakeholder.remove.useMutation({
    onSuccess: invalidate,
  });

  const [draft, setDraft] = useState({
    name: stakeholder.name,
    role: stakeholder.role ?? "",
  });

  useEffect(() => {
    setDraft({ name: stakeholder.name, role: stakeholder.role ?? "" });
  }, [stakeholder.name, stakeholder.role]);

  const domainOptions = ASSESS_DOMAINS.filter((d) =>
    inScopeDomains.includes(d.id),
  );

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-[11px] font-medium">
              {initials(draft.name)}
            </AvatarFallback>
          </Avatar>
          <Input
            value={draft.name}
            disabled={readOnly}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            onBlur={() => {
              if (draft.name.trim() !== stakeholder.name)
                updateMutation.mutate({ id: stakeholder.id, name: draft.name.trim() });
            }}
            className="h-8 font-medium"
          />
        </div>
      </TableCell>
      <TableCell>
        <Input
          value={draft.role}
          disabled={readOnly}
          onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value }))}
          onBlur={() => {
            if (draft.role.trim() !== (stakeholder.role ?? ""))
              updateMutation.mutate({ id: stakeholder.id, role: draft.role.trim() });
          }}
          placeholder="IT Director"
          className="h-8 text-sm"
        />
      </TableCell>
      <TableCell>
        <Select
          value={stakeholder.domain ?? ""}
          disabled={readOnly}
          onValueChange={(v) =>
            updateMutation.mutate({ id: stakeholder.id, domain: v })
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
        <Select
          value={stakeholder.raci ?? ""}
          disabled={readOnly}
          onValueChange={(v) =>
            updateMutation.mutate({ id: stakeholder.id, raci: v as RaciRole })
          }
        >
          <SelectTrigger className="h-8 w-20">
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            {RACI_OPTIONS.map((r) => (
              <SelectItem key={r} value={r}>
                <span className="flex items-center gap-2">
                  <RaciBadge raci={r} />
                  {r}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="text-center">
        <Checkbox
          checked={stakeholder.isReviewer}
          disabled={readOnly}
          onCheckedChange={(c) =>
            updateMutation.mutate({ id: stakeholder.id, isReviewer: Boolean(c) })
          }
        />
      </TableCell>
      <TableCell className="text-center">
        <Checkbox
          checked={stakeholder.isApprover}
          disabled={readOnly}
          onCheckedChange={(c) =>
            updateMutation.mutate({ id: stakeholder.id, isApprover: Boolean(c) })
          }
        />
      </TableCell>
      <TableCell>
        {!readOnly ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => removeMutation.mutate({ id: stakeholder.id })}
            disabled={removeMutation.isPending}
            aria-label="Remove stakeholder"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

export function Step3Stakeholders({ engagement, readOnly }: Props) {
  const utils = api.useUtils();
  const createMutation = api.engagement.stakeholder.create.useMutation({
    onSuccess: () =>
      void utils.engagement.getById.invalidate({ id: engagement.id }),
  });

  const stakeholders = [...engagement.stakeholders].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );

  return (
    <div className="space-y-5">
      <InfoCallout>
        Record the domain owners and confirm who is{" "}
        <strong>R</strong>esponsible, <strong>A</strong>ccountable,{" "}
        <strong>C</strong>onsulted and <strong>I</strong>nformed for each area.
        Reviewer / approver flags feed the deliverable&apos;s sign-off.
      </InfoCallout>

      <div className="flex items-center justify-between">
        <p className="eyebrow">Stakeholders &amp; RACI</p>
        {!readOnly ? (
          <Button
            onClick={() =>
              createMutation.mutate({
                engagementId: engagement.id,
                name: "New stakeholder",
              })
            }
            disabled={createMutation.isPending}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add stakeholder
          </Button>
        ) : null}
      </div>

      {stakeholders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
          <Users className="mb-3 h-7 w-7 text-muted-foreground" />
          <p className="font-medium">No stakeholders yet</p>
          <p className="text-sm text-muted-foreground">
            Add the domain owners accountable for each in-scope area.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Stakeholder</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>RACI</TableHead>
                <TableHead className="text-center">Reviewer</TableHead>
                <TableHead className="text-center">Approver</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {stakeholders.map((s) => (
                <StakeholderRow
                  key={s.id}
                  stakeholder={s}
                  engagementId={engagement.id}
                  inScopeDomains={engagement.inScopeDomains}
                  readOnly={readOnly}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="rounded-lg border bg-card px-4 py-3">
        <p className="eyebrow mb-2">RACI legend</p>
        <RaciLegend />
      </div>
    </div>
  );
}
