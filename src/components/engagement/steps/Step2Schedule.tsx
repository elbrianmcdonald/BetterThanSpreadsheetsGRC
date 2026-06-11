"use client";

/**
 * Step 2: Schedule & Kickoff (Epic 18 — Story 18.3).
 *
 * Meeting-plan table over `engagement.session.*`. Week/name/purpose/attendees
 * are editable; "Add session" creates a row; "Use recommended plan" calls
 * `session.seedRecommended`. Attendees stored as String[].
 */

import { useEffect, useState } from "react";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, CalendarRange, Loader2 } from "lucide-react";
import { InfoCallout } from "../InfoCallout";
import { AttendeePillsInput } from "../AttendeePillsInput";
import type { EngagementDetail, EngagementSession } from "../types";

interface Props {
  engagement: EngagementDetail;
  readOnly?: boolean;
}

function SessionRow({
  session,
  engagementId,
  readOnly,
}: {
  session: EngagementSession;
  engagementId: string;
  readOnly?: boolean;
}) {
  const utils = api.useUtils();
  const invalidate = () =>
    void utils.engagement.getById.invalidate({ id: engagementId });

  const updateMutation = api.engagement.session.update.useMutation({
    onSuccess: invalidate,
  });
  const removeMutation = api.engagement.session.remove.useMutation({
    onSuccess: invalidate,
  });

  const [draft, setDraft] = useState({
    name: session.name,
    purpose: session.purpose ?? "",
    week: session.week ?? "",
  });

  useEffect(() => {
    setDraft({
      name: session.name,
      purpose: session.purpose ?? "",
      week: session.week ?? "",
    });
  }, [session.name, session.purpose, session.week]);

  function saveField(field: "name" | "purpose" | "week") {
    const value = draft[field].trim();
    const current = (
      field === "name" ? session.name : field === "purpose" ? session.purpose : session.week
    ) ?? "";
    if (value === current) return;
    updateMutation.mutate({ id: session.id, [field]: value });
  }

  return (
    <TableRow>
      <TableCell className="align-top">
        <Input
          value={draft.week}
          disabled={readOnly}
          onChange={(e) => setDraft((d) => ({ ...d, week: e.target.value }))}
          onBlur={() => saveField("week")}
          placeholder="Week 1 · Mon"
          className="h-8 w-32 font-mono text-xs text-primary"
        />
      </TableCell>
      <TableCell className="align-top">
        <Input
          value={draft.name}
          disabled={readOnly}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          onBlur={() => saveField("name")}
          placeholder="Session name"
          className="h-8 font-medium"
        />
      </TableCell>
      <TableCell className="align-top">
        <Input
          value={draft.purpose}
          disabled={readOnly}
          onChange={(e) => setDraft((d) => ({ ...d, purpose: e.target.value }))}
          onBlur={() => saveField("purpose")}
          placeholder="Purpose"
          className="h-8 text-sm"
        />
      </TableCell>
      <TableCell className="align-top">
        <AttendeePillsInput
          value={session.attendees}
          disabled={readOnly}
          onChange={(attendees) =>
            updateMutation.mutate({ id: session.id, attendees })
          }
        />
      </TableCell>
      <TableCell className="align-top">
        {!readOnly ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => removeMutation.mutate({ id: session.id })}
            disabled={removeMutation.isPending}
            aria-label="Remove session"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

export function Step2Schedule({ engagement, readOnly }: Props) {
  const utils = api.useUtils();
  const invalidate = () =>
    void utils.engagement.getById.invalidate({ id: engagement.id });

  const createMutation = api.engagement.session.create.useMutation({
    onSuccess: invalidate,
  });
  const seedMutation = api.engagement.session.seedRecommended.useMutation({
    onSuccess: invalidate,
  });

  const sessions = [...engagement.sessions].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );

  return (
    <div className="space-y-5">
      <InfoCallout>
        Plan the kickoff and per-domain interview sessions, and book the right
        attendees for each. Start from the recommended plan and adjust to the
        client&apos;s calendar.
      </InfoCallout>

      <div className="flex items-center justify-between">
        <p className="eyebrow">Meeting plan</p>
        {!readOnly ? (
          <div className="flex gap-2">
            {sessions.length === 0 ? (
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
                  <CalendarRange className="mr-2 h-4 w-4" />
                )}
                Use recommended plan
              </Button>
            ) : null}
            <Button
              onClick={() =>
                createMutation.mutate({
                  engagementId: engagement.id,
                  name: "New session",
                })
              }
              disabled={createMutation.isPending}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add session
            </Button>
          </div>
        ) : null}
      </div>

      {sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
          <CalendarRange className="mb-3 h-7 w-7 text-muted-foreground" />
          <p className="font-medium">No sessions scheduled</p>
          <p className="text-sm text-muted-foreground">
            Use the recommended plan to seed kickoff and interview sessions.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-36">Week</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead>Attendees</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((s) => (
                <SessionRow
                  key={s.id}
                  session={s}
                  engagementId={engagement.id}
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
