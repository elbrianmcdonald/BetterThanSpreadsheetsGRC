"use client";

import { useState } from "react";
import Link from "next/link";
import { GitBranch, GitMerge, Loader2, Plus, Server, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { UserRole } from "@prisma/client";
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

const CAN_MUTATE: UserRole[] = [
  UserRole.ORG_ADMIN,
  UserRole.GRC_ANALYST,
  UserRole.SECURITY_ENGINEER,
];

type DependencyList = RouterOutputs["orgControlDependency"]["list"];
type OutgoingDep = DependencyList["outgoing"][number];
type IncomingDep = DependencyList["incoming"][number];

export function DependenciesTab({ controlId }: { controlId: string }) {
  const { data: session } = useSession();
  const userRole = session?.user?.role as UserRole | undefined;
  const canMutate = !!userRole && CAN_MUTATE.includes(userRole);

  const [addOpen, setAddOpen] = useState(false);

  const { data, isLoading } = api.orgControlDependency.list.useQuery({
    orgControlId: controlId,
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-medium">Dependencies</h3>
          <p className="text-sm text-muted-foreground">
            Other controls or external systems this control relies on.
          </p>
        </div>
        {canMutate && (
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add dependency
          </Button>
        )}
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <OutgoingCard
            items={data?.outgoing ?? []}
            controlId={controlId}
            canMutate={canMutate}
          />
          <IncomingCard items={data?.incoming ?? []} />
        </div>
      )}

      <AddDependencyDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        controlId={controlId}
      />
    </div>
  );
}

function OutgoingCard({
  items,
  controlId,
  canMutate,
}: {
  items: OutgoingDep[];
  controlId: string;
  canMutate: boolean;
}) {
  const utils = api.useUtils();
  const deleteMutation = api.orgControlDependency.delete.useMutation({
    onSuccess: () => {
      toast.success("Dependency removed");
      void utils.orgControlDependency.list.invalidate({ orgControlId: controlId });
      void utils.organizationalControl.getById.invalidate({ id: controlId });
    },
    onError: (e) => toast.error(e.message || "Failed to remove"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <GitBranch className="h-4 w-4" />
          Depends on
        </CardTitle>
        <CardDescription>
          Controls or external resources this one relies on to operate.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No outgoing dependencies.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((dep) => (
              <li key={dep.id} className="flex items-start gap-3 p-3 rounded-md border bg-gray-50">
                {dep.Child ? (
                  <GitBranch className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                ) : (
                  <Server className="h-4 w-4 text-gray-500 mt-0.5 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  {dep.Child ? (
                    <Link
                      href={`/controls/${dep.Child.id}`}
                      className="text-sm text-blue-700 hover:underline"
                    >
                      <span className="font-mono text-xs mr-2">{dep.Child.localControlId}</span>
                      {dep.Child.name}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{dep.externalDependency}</span>
                      {dep.externalType && (
                        <Badge variant="outline">{dep.externalType}</Badge>
                      )}
                    </div>
                  )}
                  {dep.notes && (
                    <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                      {dep.notes}
                    </p>
                  )}
                </div>
                {canMutate && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => deleteMutation.mutate({ id: dep.id })}
                    disabled={deleteMutation.isPending}
                    aria-label="Remove dependency"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function IncomingCard({ items }: { items: IncomingDep[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <GitMerge className="h-4 w-4" />
          Depended on by
        </CardTitle>
        <CardDescription>Other controls that rely on this one (read-only).</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing depends on this control.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((dep) => (
              <li key={dep.id} className="flex items-start gap-3 p-3 rounded-md border bg-gray-50">
                <GitMerge className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  {dep.Parent && (
                    <Link
                      href={`/controls/${dep.Parent.id}`}
                      className="text-sm text-blue-700 hover:underline"
                    >
                      <span className="font-mono text-xs mr-2">{dep.Parent.localControlId}</span>
                      {dep.Parent.name}
                    </Link>
                  )}
                  {dep.notes && (
                    <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                      {dep.notes}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function AddDependencyDialog({
  open,
  onOpenChange,
  controlId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  controlId: string;
}) {
  const utils = api.useUtils();
  const [kind, setKind] = useState<"internal" | "external">("internal");
  const [search, setSearch] = useState("");
  const [childId, setChildId] = useState<string>("");
  const [externalDependency, setExternalDependency] = useState("");
  const [externalType, setExternalType] = useState("");
  const [notes, setNotes] = useState("");

  const { data: candidates } = api.organizationalControl.search.useQuery(
    { query: search, limit: 15, excludeIds: [controlId] },
    { enabled: open && kind === "internal" && search.length > 0 }
  );

  const createMutation = api.orgControlDependency.create.useMutation({
    onSuccess: () => {
      toast.success("Dependency added");
      void utils.orgControlDependency.list.invalidate({ orgControlId: controlId });
      void utils.organizationalControl.getById.invalidate({ id: controlId });
      onOpenChange(false);
      setSearch("");
      setChildId("");
      setExternalDependency("");
      setExternalType("");
      setNotes("");
    },
    onError: (e) => toast.error(e.message || "Failed to add dependency"),
  });

  const handleSubmit = () => {
    if (kind === "internal") {
      if (!childId) {
        toast.error("Select an internal control");
        return;
      }
      createMutation.mutate({
        parentOrgControlId: controlId,
        childOrgControlId: childId,
        notes: notes.trim() || null,
      });
    } else {
      if (!externalDependency.trim()) {
        toast.error("External dependency name is required");
        return;
      }
      if (!externalType.trim()) {
        toast.error("External type is required");
        return;
      }
      createMutation.mutate({
        parentOrgControlId: controlId,
        externalDependency: externalDependency.trim(),
        externalType: externalType.trim(),
        notes: notes.trim() || null,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add dependency</DialogTitle>
          <DialogDescription>
            Dependencies are either on another organizational control (internal) or on a tool, service,
            or process (external).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={kind === "internal" ? "default" : "outline"}
              onClick={() => setKind("internal")}
              className="flex-1"
            >
              <GitBranch className="h-4 w-4 mr-2" />
              Internal control
            </Button>
            <Button
              type="button"
              variant={kind === "external" ? "default" : "outline"}
              onClick={() => setKind("external")}
              className="flex-1"
            >
              <Server className="h-4 w-4 mr-2" />
              External resource
            </Button>
          </div>

          {kind === "internal" ? (
            <div>
              <Label>Internal control</Label>
              <Input
                placeholder="Search by ID or name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && candidates && candidates.length > 0 && (
                <div className="mt-1 border rounded-md max-h-48 overflow-y-auto">
                  {candidates.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setChildId(c.id);
                        setSearch(`${c.localControlId} — ${c.name}`);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${childId === c.id ? "bg-blue-50" : ""}`}
                    >
                      <span className="font-mono text-xs text-blue-700">{c.localControlId}</span>{" "}
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-[1fr_160px] gap-3">
              <div>
                <Label htmlFor="extDep">Name</Label>
                <Input
                  id="extDep"
                  placeholder="e.g., LDAP, Firewall appliance"
                  value={externalDependency}
                  onChange={(e) => setExternalDependency(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="extType">Type</Label>
                <Input
                  id="extType"
                  placeholder="Tool / Service / Process"
                  value={externalType}
                  onChange={(e) => setExternalType(e.target.value)}
                />
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="depNotes">Notes (optional)</Label>
            <Textarea
              id="depNotes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What role does this dependency play in the control..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={createMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending ? "Adding..." : "Add dependency"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
