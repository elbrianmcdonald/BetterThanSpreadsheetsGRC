"use client";

/**
 * Engagements list client (Polymorphic Engagement rework).
 *
 * Renders a table of the org's engagements (identifier / client / assessment
 * kind / status / phase) with a status filter and a "New engagement" dialog.
 *
 * The dialog now WRAPS an existing assessment: pick an `assessmentKind`, then
 * pick an EXISTING assessment of that kind (via that kind's list query), enter
 * the client metadata, and call `engagement.create`. After create we route into
 * the wizard.
 *
 * Picker coverage (pilot = COMPLIANCE):
 *   COMPLIANCE → api.complianceAssessment.list  (fully wired)
 *   MATURITY   → api.maturity.list              (fully wired)
 *   RISK       → api.riskAssessment.list        (fully wired)
 *   VENDOR     → picker disabled ("supported soon")
 *   BIA        → picker disabled ("supported soon")
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { api } from "@/trpc/react";
import { AppLayout, PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Plus, FolderOpen } from "lucide-react";
import type { AssessmentKind } from "@/components/engagement/types";

type EngagementStatus =
  | "SCOPING"
  | "SCHEDULED"
  | "FIELDWORK"
  | "REVIEW"
  | "DELIVERED";

const STATUS_VARIANTS: Record<
  EngagementStatus,
  "default" | "secondary" | "outline"
> = {
  SCOPING: "outline",
  SCHEDULED: "secondary",
  FIELDWORK: "secondary",
  REVIEW: "secondary",
  DELIVERED: "default",
};

const PHASE_LABELS: Record<string, string> = {
  setup: "Setup",
  schedule: "Schedule",
  stakeholders: "Stakeholders",
  evidence: "Evidence",
  interviews: "Interviews",
  review: "Review",
};

const KIND_LABELS: Record<AssessmentKind, string> = {
  COMPLIANCE: "Compliance",
  MATURITY: "Maturity",
  RISK: "Risk",
  VENDOR: "Vendor (TPRM)",
  BIA: "Business Impact",
};

/** Which kinds have a fully wired assessment picker. */
const SUPPORTED_KINDS: AssessmentKind[] = ["COMPLIANCE", "MATURITY", "RISK"];

const KIND_ORDER: AssessmentKind[] = [
  "COMPLIANCE",
  "MATURITY",
  "RISK",
  "VENDOR",
  "BIA",
];

type PickerOption = { id: string; name: string; status: string | null };

/**
 * Resolve the assessment options for the selected kind. Each branch calls the
 * kind's list query (always called to satisfy the rules-of-hooks; `enabled`
 * gates the network request) and normalizes to `{ id, name, status }`.
 */
function useAssessmentOptions(kind: AssessmentKind): {
  options: PickerOption[];
  isLoading: boolean;
  supported: boolean;
} {
  const complianceQuery = api.complianceAssessment.list.useQuery(
    { page: 1, pageSize: 100 },
    { enabled: kind === "COMPLIANCE" },
  );
  const maturityQuery = api.maturity.list.useQuery(
    { page: 1, pageSize: 100 },
    { enabled: kind === "MATURITY" },
  );
  const riskQuery = api.riskAssessment.list.useQuery(
    { page: 1, limit: 100 },
    { enabled: kind === "RISK" },
  );

  return useMemo(() => {
    switch (kind) {
      case "COMPLIANCE":
        return {
          supported: true,
          isLoading: complianceQuery.isLoading,
          options: (complianceQuery.data?.assessments ?? []).map((a) => ({
            id: a.id,
            name: a.name,
            status: a.status,
          })),
        };
      case "MATURITY":
        return {
          supported: true,
          isLoading: maturityQuery.isLoading,
          options: (maturityQuery.data?.assessments ?? []).map((a) => ({
            id: a.id,
            name: a.name,
            status: a.status,
          })),
        };
      case "RISK":
        return {
          supported: true,
          isLoading: riskQuery.isLoading,
          options: (riskQuery.data?.items ?? []).map((a) => ({
            id: a.id,
            name: a.title,
            status: a.status,
          })),
        };
      default:
        return { supported: false, isLoading: false, options: [] };
    }
  }, [
    kind,
    complianceQuery.data,
    complianceQuery.isLoading,
    maturityQuery.data,
    maturityQuery.isLoading,
    riskQuery.data,
    riskQuery.isLoading,
  ]);
}

export function EngagementsClient() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<EngagementStatus | "ALL">(
    "ALL",
  );
  const [createOpen, setCreateOpen] = useState(false);

  // Create-form state
  const [assessmentKind, setAssessmentKind] =
    useState<AssessmentKind>("COMPLIANCE");
  const [assessmentId, setAssessmentId] = useState("");
  const [clientName, setClientName] = useState("");
  const [sector, setSector] = useState("");
  const [size, setSize] = useState("");
  const [engagementWindow, setEngagementWindow] = useState("");
  const [consultancy, setConsultancy] = useState("");

  // The engagement list (status filter is client-side: list takes no status arg).
  const listQuery = api.engagement.list.useQuery();
  const allEngagements = listQuery.data ?? [];
  const engagements =
    statusFilter === "ALL"
      ? allEngagements
      : allEngagements.filter((e) => e.status === statusFilter);

  const { options, isLoading: optionsLoading, supported } =
    useAssessmentOptions(assessmentKind);

  const utils = api.useUtils();
  const createMutation = api.engagement.create.useMutation({
    onSuccess: (eng) => {
      void utils.engagement.list.invalidate();
      setCreateOpen(false);
      router.push(`/engagements/${eng.id}/wizard`);
    },
  });

  function resetForm() {
    setAssessmentKind("COMPLIANCE");
    setAssessmentId("");
    setClientName("");
    setSector("");
    setSize("");
    setEngagementWindow("");
    setConsultancy("");
  }

  function handleKindChange(kind: AssessmentKind) {
    setAssessmentKind(kind);
    setAssessmentId(""); // assessment selection is kind-specific
  }

  const canCreate =
    supported && Boolean(assessmentId) && clientName.trim().length > 0;

  function handleCreate() {
    if (!canCreate) return;
    createMutation.mutate({
      assessmentKind,
      assessmentId,
      clientName: clientName.trim(),
      sector: sector.trim() || undefined,
      size: size.trim() || undefined,
      engagementWindow: engagementWindow.trim() || undefined,
      consultancy: consultancy.trim() || undefined,
    });
  }

  return (
    <AppLayout>
      <PageHeader
        title="Engagements"
        description="Engagements that wrap an existing assessment."
        actions={
          <Dialog
            open={createOpen}
            onOpenChange={(open) => {
              setCreateOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New engagement
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New engagement</DialogTitle>
                <DialogDescription>
                  Wrap an existing assessment with consulting metadata. Scoring
                  and interviews stay in the assessment.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="eng-kind">Assessment kind</Label>
                  <Select
                    value={assessmentKind}
                    onValueChange={(v) => handleKindChange(v as AssessmentKind)}
                  >
                    <SelectTrigger id="eng-kind">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {KIND_ORDER.map((k) => (
                        <SelectItem key={k} value={k}>
                          {KIND_LABELS[k]}
                          {SUPPORTED_KINDS.includes(k) ? "" : " (soon)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="eng-assessment">Assessment</Label>
                  {supported ? (
                    <Select
                      value={assessmentId}
                      onValueChange={setAssessmentId}
                      disabled={optionsLoading || options.length === 0}
                    >
                      <SelectTrigger id="eng-assessment">
                        <SelectValue
                          placeholder={
                            optionsLoading
                              ? "Loading assessments…"
                              : options.length === 0
                                ? "No assessments of this kind"
                                : "Select an assessment"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {options.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.name}
                            {o.status ? ` · ${o.status}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="rounded-md border border-dashed bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                      {KIND_LABELS[assessmentKind]} engagements are supported
                      soon. Pick Compliance, Maturity, or Risk for now.
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="eng-client">Client name</Label>
                  <Input
                    id="eng-client"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Acme Industries"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="eng-sector">Sector</Label>
                    <Input
                      id="eng-sector"
                      value={sector}
                      onChange={(e) => setSector(e.target.value)}
                      placeholder="Manufacturing"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="eng-size">Size</Label>
                    <Input
                      id="eng-size"
                      value={size}
                      onChange={(e) => setSize(e.target.value)}
                      placeholder="1,200 staff"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="eng-window">Engagement window</Label>
                    <Input
                      id="eng-window"
                      value={engagementWindow}
                      onChange={(e) => setEngagementWindow(e.target.value)}
                      placeholder="Q2 2026"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="eng-consultancy">Consultancy</Label>
                    <Input
                      id="eng-consultancy"
                      value={consultancy}
                      onChange={(e) => setConsultancy(e.target.value)}
                      placeholder="Your firm"
                    />
                  </div>
                </div>

                {createMutation.error ? (
                  <p className="text-sm text-destructive">
                    {createMutation.error.message}
                  </p>
                ) : null}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                  disabled={createMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={!canCreate || createMutation.isPending}
                >
                  {createMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Create engagement
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <Label htmlFor="status-filter" className="text-sm text-muted-foreground">
          Status
        </Label>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as EngagementStatus | "ALL")}
        >
          <SelectTrigger id="status-filter" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="SCOPING">Scoping</SelectItem>
            <SelectItem value="SCHEDULED">Scheduled</SelectItem>
            <SelectItem value="FIELDWORK">Fieldwork</SelectItem>
            <SelectItem value="REVIEW">Review</SelectItem>
            <SelectItem value="DELIVERED">Delivered</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {listQuery.isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading engagements…
        </div>
      ) : engagements.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <FolderOpen className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-medium">No engagements yet</p>
          <p className="mb-4 text-sm text-muted-foreground">
            Wrap an existing assessment to start a guided engagement.
          </p>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New engagement
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Identifier</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Assessment kind</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Phase</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {engagements.map((eng) => (
                <TableRow key={eng.id}>
                  <TableCell className="font-mono text-sm">
                    <Link
                      href={`/engagements/${eng.id}/wizard`}
                      className="hover:underline"
                    >
                      {eng.identifier}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">{eng.clientName}</TableCell>
                  <TableCell>
                    {KIND_LABELS[eng.assessmentKind as AssessmentKind] ??
                      eng.assessmentKind}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={STATUS_VARIANTS[eng.status as EngagementStatus]}
                    >
                      {eng.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{PHASE_LABELS[eng.phase] ?? eng.phase}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(eng.createdAt), "MMM d, yyyy")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </AppLayout>
  );
}
