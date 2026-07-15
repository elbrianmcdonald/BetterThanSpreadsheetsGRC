"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Crosshair, Pencil, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import { AppLayout, PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreatePathwayForm } from "@/components/pathway/CreatePathwayForm";

type PathwayRow = {
  id: string;
  name: string;
  verdict: string | null;
  stepCount: number;
  assessmentCount: number;
  findingCount: number;
  riskCount: number;
  updatedAt: Date;
};

export function PathwayLibraryClient() {
  const utils = api.useUtils();
  const { data: pathways, isLoading } = api.pathway.list.useQuery();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<PathwayRow | null>(null);
  const [deleting, setDeleting] = useState<PathwayRow | null>(null);

  const refresh = () => void utils.pathway.list.invalidate();

  return (
    <AppLayout breadcrumbs={[{ label: "Administration" }, { label: "Exploitation Pathways" }]}>
      <PageHeader
        eyebrow="ADMINISTRATION"
        title="Exploitation Pathways"
        icon={<Crosshair />}
        description="Your library of attack paths (MITRE ATT&CK kill chains). Create pathways here, then select them onto assessments and tag them on findings and risks. Editing a pathway updates it everywhere it is linked."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> New pathway
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : !pathways || pathways.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No exploitation pathways yet. Create one to start your library.
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="w-20 text-right">Steps</TableHead>
                <TableHead className="w-28 text-right">Assessments</TableHead>
                <TableHead className="w-40 text-right">Linked items</TableHead>
                <TableHead className="w-32">Updated</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pathways.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium text-foreground">{p.name}</div>
                    {p.verdict && (
                      <div className="text-xs text-muted-foreground line-clamp-1">{p.verdict}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{p.stepCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.assessmentCount}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Badge variant="outline">{p.findingCount} findings</Badge>
                      <Badge variant="outline">{p.riskCount} risks</Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(p.updatedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button asChild variant="ghost" size="sm" title="Open pathway">
                        <Link href={`/deliverables/pathway/${p.id}`}>
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setEditing(p)} title="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleting(p)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New exploitation pathway</DialogTitle>
            <DialogDescription>
              Add an attack path to the library. Steps and linked findings/risks are added later,
              from an assessment.
            </DialogDescription>
          </DialogHeader>
          <CreatePathwayForm
            onCreated={() => {
              setCreateOpen(false);
              refresh();
            }}
            onCancel={() => setCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit */}
      {editing && (
        <EditPathwayDialog
          pathway={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}

      {/* Delete */}
      {deleting && (
        <DeletePathwayDialog
          pathway={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null);
            refresh();
          }}
        />
      )}
    </AppLayout>
  );
}

function EditPathwayDialog({
  pathway,
  onClose,
  onSaved,
}: {
  pathway: PathwayRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const detail = api.pathway.getById.useQuery({ id: pathway.id });
  const [name, setName] = useState(pathway.name);
  const [verdict, setVerdict] = useState("");
  const [narrative, setNarrative] = useState("");
  const [blastRadius, setBlastRadius] = useState("");
  const [hydrated, setHydrated] = useState(false);

  // Hydrate the long-form fields once the detail loads (list only has name/verdict).
  if (detail.data && !hydrated) {
    setVerdict(detail.data.verdict ?? "");
    setNarrative(detail.data.narrative ?? "");
    setBlastRadius(detail.data.blastRadius ?? "");
    setHydrated(true);
  }

  const update = api.pathway.update.useMutation({
    onSuccess: () => {
      toast.success("Pathway updated");
      onSaved();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit pathway</DialogTitle>
          <DialogDescription>Changes apply everywhere this pathway is linked.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-pw-name">Name</Label>
            <Input id="edit-pw-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-pw-verdict">Verdict</Label>
            <Textarea id="edit-pw-verdict" rows={2} value={verdict} onChange={(e) => setVerdict(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-pw-narrative">Narrative</Label>
            <Textarea id="edit-pw-narrative" rows={4} value={narrative} onChange={(e) => setNarrative(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-pw-blast">Blast radius</Label>
            <Textarea id="edit-pw-blast" rows={2} value={blastRadius} onChange={(e) => setBlastRadius(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={update.isPending}>
            Cancel
          </Button>
          <Button
            disabled={!name.trim() || update.isPending || !detail.data}
            onClick={() =>
              update.mutate({
                id: pathway.id,
                name: name.trim(),
                verdict: verdict.trim() || null,
                narrative: narrative.trim() || null,
                blastRadius: blastRadius.trim() || null,
              })
            }
          >
            {update.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeletePathwayDialog({
  pathway,
  onClose,
  onDeleted,
}: {
  pathway: PathwayRow;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const del = api.pathway.remove.useMutation({
    onSuccess: () => {
      toast.success("Pathway deleted");
      onDeleted();
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete pathway?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          This permanently deletes <span className="font-medium text-foreground">{pathway.name}</span>{" "}
          and its steps, and removes it from every assessment, finding, and risk it is linked to. The
          findings and risks themselves are not deleted. This cannot be undone.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={del.isPending}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={del.isPending} onClick={() => del.mutate({ id: pathway.id })}>
            {del.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
