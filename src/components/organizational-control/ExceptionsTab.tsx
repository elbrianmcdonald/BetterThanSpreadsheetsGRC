"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  ClipboardCheck,
  Clock,
  Loader2,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import {
  ControlExceptionStatus,
  UserRole,
} from "@prisma/client";
import { api, type RouterOutputs } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EXCEPTION_STATUS_OPTIONS,
  exceptionStatusBadgeColor,
  labelForExceptionStatus,
} from "./enum-labels";

const REQUESTER_ROLES: UserRole[] = [
  UserRole.ADMINISTRATOR,
  UserRole.ANALYST,
  UserRole.ANALYST,
];
const APPROVER_ROLES: UserRole[] = [UserRole.ADMINISTRATOR];

const ANY = "__any__";
const RENEWAL_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function daysUntil(date: Date | string | null | undefined): number | null {
  if (!date) return null;
  const ms = new Date(date).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

type Exception = RouterOutputs["orgControlException"]["list"][number];

export function ExceptionsTab({ controlId }: { controlId: string }) {
  const { data: session } = useSession();
  const userRole = session?.user?.role as UserRole | undefined;
  const canRequest = !!userRole && REQUESTER_ROLES.includes(userRole);
  const canApprove = !!userRole && APPROVER_ROLES.includes(userRole);

  const [statusFilter, setStatusFilter] = useState<ControlExceptionStatus | typeof ANY>(ANY);
  const [requestOpen, setRequestOpen] = useState(false);
  const [approveTarget, setApproveTarget] = useState<Exception | null>(null);
  const [renewTarget, setRenewTarget] = useState<Exception | null>(null);

  const { data, isLoading } = api.orgControlException.list.useQuery({
    orgControlId: controlId,
    status: statusFilter === ANY ? undefined : statusFilter,
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-medium">Exceptions</h3>
          <p className="text-sm text-muted-foreground">
            Time-bound approvals to deviate from this control. Renewals are tracked.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={statusFilter}
            onValueChange={(v) =>
              setStatusFilter(v as ControlExceptionStatus | typeof ANY)
            }
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>All statuses</SelectItem>
              {EXCEPTION_STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canRequest && (
            <Button onClick={() => setRequestOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Request exception
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !data?.length ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <ClipboardCheck className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              No exceptions match the selected filter.
            </div>
          ) : (
            <ul className="space-y-3">
              {data.map((e) => (
                <ExceptionRow
                  key={e.id}
                  exception={e}
                  canApprove={canApprove}
                  onApprove={() => setApproveTarget(e)}
                  onRenew={() => setRenewTarget(e)}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <RequestExceptionDialog
        open={requestOpen}
        onOpenChange={setRequestOpen}
        controlId={controlId}
      />

      {approveTarget && (
        <ApproveDenyDialog
          exception={approveTarget}
          onClose={() => setApproveTarget(null)}
          controlId={controlId}
        />
      )}

      {renewTarget && (
        <RenewDialog
          exception={renewTarget}
          onClose={() => setRenewTarget(null)}
          controlId={controlId}
        />
      )}
    </div>
  );
}

function ExceptionRow({
  exception,
  canApprove,
  onApprove,
  onRenew,
}: {
  exception: Exception;
  canApprove: boolean;
  onApprove: () => void;
  onRenew: () => void;
}) {
  const days = daysUntil(exception.expiresAt);
  const isApproved = exception.status === ControlExceptionStatus.APPROVED;
  const isPending = exception.status === ControlExceptionStatus.PENDING;
  const withinRenewWindow =
    isApproved &&
    typeof days === "number" &&
    days <= 30; // RENEWAL_WINDOW_MS as days
  const canRenewExpired = exception.status === ControlExceptionStatus.EXPIRED;

  return (
    <li className="rounded-md border bg-gray-50 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={exceptionStatusBadgeColor(exception.status)}>
            {labelForExceptionStatus(exception.status)}
          </Badge>
          {exception.renewalCount > 0 && (
            <Badge variant="secondary">
              <RefreshCw className="h-3 w-3 mr-1" />
              Renewed {exception.renewalCount}×
            </Badge>
          )}
          <span className="text-sm text-gray-700">
            Expires {formatDate(exception.expiresAt)}
            {days !== null && days <= 30 && days >= 0 && isApproved && (
              <span className="ml-2 text-amber-700 text-xs">({days}d left)</span>
            )}
          </span>
        </div>
        <div className="flex gap-2">
          {canApprove && isPending && (
            <Button size="sm" variant="outline" onClick={onApprove}>
              Review
            </Button>
          )}
          {canApprove && (withinRenewWindow || canRenewExpired) && (
            <Button size="sm" variant="outline" onClick={onRenew}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Renew
            </Button>
          )}
        </div>
      </div>

      <div>
        <p className="text-xs uppercase text-muted-foreground mb-1">Justification</p>
        <p className="text-sm text-gray-800 whitespace-pre-wrap">{exception.justification}</p>
      </div>

      {exception.compensatingControls && (
        <div>
          <p className="text-xs uppercase text-muted-foreground mb-1">Compensating controls</p>
          <p className="text-sm text-gray-800 whitespace-pre-wrap">
            {exception.compensatingControls}
          </p>
        </div>
      )}

      {exception.CompensatingOrgControl && (
        <div>
          <p className="text-xs uppercase text-muted-foreground mb-1">Compensating control (linked)</p>
          <Badge variant="outline" className="font-mono">
            {exception.CompensatingOrgControl.localControlId}
          </Badge>
          <span className="ml-2 text-sm">{exception.CompensatingOrgControl.name}</span>
        </div>
      )}

      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
        <span>
          <Clock className="h-3 w-3 inline mr-1" />
          Requested {formatDate(exception.requestedAt)}
          {exception.RequestedBy && ` by ${exception.RequestedBy.name ?? exception.RequestedBy.email}`}
        </span>
        {exception.approvedAt && (
          <span>
            {exception.status === ControlExceptionStatus.DENIED ? (
              <X className="h-3 w-3 inline mr-1" />
            ) : (
              <CheckCircle className="h-3 w-3 inline mr-1" />
            )}
            {exception.status === ControlExceptionStatus.DENIED ? "Denied" : "Decided"}{" "}
            {formatDate(exception.approvedAt)}
            {exception.ApprovedBy && ` by ${exception.ApprovedBy.name ?? exception.ApprovedBy.email}`}
          </span>
        )}
      </div>

      {exception.approvalNotes && (
        <div className="bg-white border rounded p-2">
          <p className="text-xs uppercase text-muted-foreground mb-1">Approval notes</p>
          <p className="text-sm text-gray-800 whitespace-pre-wrap">{exception.approvalNotes}</p>
        </div>
      )}
    </li>
  );
}

function RequestExceptionDialog({
  open,
  onOpenChange,
  controlId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  controlId: string;
}) {
  const utils = api.useUtils();
  const [justification, setJustification] = useState("");
  const [compensatingControls, setCompensatingControls] = useState("");
  const [compensatingOrgControlId, setCompensatingOrgControlId] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState("");
  const [search, setSearch] = useState("");

  const { data: compensatingCandidates } = api.organizationalControl.search.useQuery(
    { query: search, limit: 15, excludeIds: [controlId] },
    { enabled: open && search.length > 0 }
  );

  const requestMutation = api.orgControlException.request.useMutation({
    onSuccess: () => {
      toast.success("Exception requested");
      void utils.orgControlException.list.invalidate({ orgControlId: controlId });
      void utils.organizationalControl.getById.invalidate({ id: controlId });
      onOpenChange(false);
      setJustification("");
      setCompensatingControls("");
      setCompensatingOrgControlId("");
      setExpiresAt("");
    },
    onError: (e) => toast.error(e.message || "Failed to request"),
  });

  const handleSubmit = () => {
    if (!justification.trim()) {
      toast.error("Justification is required");
      return;
    }
    if (!expiresAt) {
      toast.error("Expiration date is required");
      return;
    }
    const expiry = new Date(expiresAt);
    if (expiry.getTime() <= Date.now()) {
      toast.error("Expiration must be in the future");
      return;
    }
    requestMutation.mutate({
      orgControlId: controlId,
      justification: justification.trim(),
      compensatingControls: compensatingControls.trim() || null,
      compensatingOrgControlId: compensatingOrgControlId || null,
      expiresAt: expiry,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Request exception</DialogTitle>
          <DialogDescription>
            Request approval to deviate from this control for a bounded time.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="justification">
              Justification <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="justification"
              rows={4}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Why this deviation is needed and the risk it creates..."
            />
          </div>
          <div>
            <Label htmlFor="compensatingControls">Compensating controls (text)</Label>
            <Textarea
              id="compensatingControls"
              rows={2}
              value={compensatingControls}
              onChange={(e) => setCompensatingControls(e.target.value)}
              placeholder="Describe manual or informal compensations..."
            />
          </div>
          <div>
            <Label>Compensating control (linked, optional)</Label>
            <Input
              placeholder="Search controls by ID or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && compensatingCandidates && compensatingCandidates.length > 0 && (
              <div className="mt-1 border rounded-md max-h-40 overflow-y-auto">
                {compensatingCandidates.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setCompensatingOrgControlId(c.id);
                      setSearch(`${c.localControlId} — ${c.name}`);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${compensatingOrgControlId === c.id ? "bg-blue-50" : ""}`}
                  >
                    <span className="font-mono text-xs text-blue-700">{c.localControlId}</span>{" "}
                    {c.name}
                  </button>
                ))}
              </div>
            )}
            {compensatingOrgControlId && (
              <button
                type="button"
                onClick={() => {
                  setCompensatingOrgControlId("");
                  setSearch("");
                }}
                className="text-xs text-blue-700 mt-1 hover:underline"
              >
                Clear
              </button>
            )}
          </div>
          <div>
            <Label htmlFor="expiresAt">
              Expires on <span className="text-destructive">*</span>
            </Label>
            <Input
              id="expiresAt"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={requestMutation.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={requestMutation.isPending}>
            {requestMutation.isPending ? "Submitting..." : "Request exception"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApproveDenyDialog({
  exception,
  onClose,
  controlId,
}: {
  exception: Exception;
  onClose: () => void;
  controlId: string;
}) {
  const utils = api.useUtils();
  const [notes, setNotes] = useState("");

  const invalidate = () => {
    void utils.orgControlException.list.invalidate({ orgControlId: controlId });
    void utils.organizationalControl.getById.invalidate({ id: controlId });
  };

  const approveMutation = api.orgControlException.approve.useMutation({
    onSuccess: () => {
      toast.success("Exception approved");
      invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message || "Failed to approve"),
  });

  const denyMutation = api.orgControlException.deny.useMutation({
    onSuccess: () => {
      toast.success("Exception denied");
      invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message || "Failed to deny"),
  });

  const isBusy = approveMutation.isPending || denyMutation.isPending;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Review exception</DialogTitle>
          <DialogDescription>
            Approve or deny this exception. Notes are visible to the requester.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="rounded-md border bg-gray-50 p-3 text-sm">
            <p className="text-xs uppercase text-muted-foreground mb-1">Justification</p>
            <p className="whitespace-pre-wrap">{exception.justification}</p>
          </div>
          <div>
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Conditions, constraints, or rationale..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isBusy}>
            Cancel
          </Button>
          <Button
            variant="outline"
            className="text-red-700 border-red-200 hover:bg-red-50"
            onClick={() => denyMutation.mutate({ id: exception.id, notes: notes.trim() || undefined })}
            disabled={isBusy}
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            Deny
          </Button>
          <Button
            onClick={() => approveMutation.mutate({ id: exception.id, notes: notes.trim() || undefined })}
            disabled={isBusy}
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RenewDialog({
  exception,
  onClose,
  controlId,
}: {
  exception: Exception;
  onClose: () => void;
  controlId: string;
}) {
  const utils = api.useUtils();
  // Default 12-month extension from today
  const defaultNext = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 12);
    return d.toISOString().slice(0, 10);
  }, []);
  const [newExpiresAt, setNewExpiresAt] = useState(defaultNext);
  const [notes, setNotes] = useState(exception.approvalNotes ?? "");

  const renewMutation = api.orgControlException.renew.useMutation({
    onSuccess: () => {
      toast.success("Exception renewed");
      void utils.orgControlException.list.invalidate({ orgControlId: controlId });
      void utils.organizationalControl.getById.invalidate({ id: controlId });
      onClose();
    },
    onError: (e) => toast.error(e.message || "Failed to renew"),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renew exception</DialogTitle>
          <DialogDescription>
            Extend the expiry. This increments the renewal counter and keeps the exception approved.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-xs text-muted-foreground">
            Currently expires {formatDate(exception.expiresAt)} · renewed {exception.renewalCount}× already.
          </p>
          <div>
            <Label htmlFor="newExpiresAt">New expiration</Label>
            <Input
              id="newExpiresAt"
              type="date"
              value={newExpiresAt}
              onChange={(e) => setNewExpiresAt(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="renewNotes">Notes (optional)</Label>
            <Textarea
              id="renewNotes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={renewMutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              const expiry = new Date(newExpiresAt);
              if (expiry.getTime() <= Date.now()) {
                toast.error("New expiration must be in the future");
                return;
              }
              renewMutation.mutate({
                id: exception.id,
                newExpiresAt: expiry,
                notes: notes.trim() || undefined,
              });
            }}
            disabled={renewMutation.isPending}
          >
            {renewMutation.isPending ? "Renewing..." : "Renew exception"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
