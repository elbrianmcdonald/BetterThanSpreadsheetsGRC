"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2, Plus, Pencil, Trash2, ScrollText } from "lucide-react";
import { UserRole } from "@prisma/client";
import toast from "react-hot-toast";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppLayout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MarkdownPreview } from "@/components/ui/markdown-preview";

type ReleaseRow = {
  id: string;
  version: string;
  title: string | null;
  notes: string;
  releasedAt: Date;
  CreatedBy: { id: string; name: string | null; email: string | null } | null;
};

export function ChangelogClient() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === UserRole.ORG_ADMIN;

  const list = api.releaseVersion.list.useQuery();
  const utils = api.useUtils();

  const [editing, setEditing] = useState<ReleaseRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const remove = api.releaseVersion.delete.useMutation({
    onSuccess: () => {
      toast.success("Version deleted");
      void utils.releaseVersion.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <AppLayout>
      <div className="container mx-auto py-6 space-y-6 max-w-4xl">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ScrollText className="h-6 w-6" />
              Changelog
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Application version history. Notes support markdown.
            </p>
          </div>
          {isAdmin && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Version
            </Button>
          )}
        </div>

        {list.isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : !list.data || list.data.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No versions recorded yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {list.data.map((row) => (
              <Card key={row.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-base font-mono">
                          v{row.version}
                        </Badge>
                        {row.title && <span>{row.title}</span>}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Released {new Date(row.releasedAt).toLocaleDateString()}
                        {row.CreatedBy?.name ? ` · by ${row.CreatedBy.name}` : ""}
                      </p>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setEditing(row)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm(`Delete version ${row.version}?`)) {
                              remove.mutate({ id: row.id });
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <MarkdownPreview content={row.notes} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {createOpen && (
        <VersionDialog
          mode="create"
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onSaved={() => void utils.releaseVersion.list.invalidate()}
        />
      )}
      {editing && (
        <VersionDialog
          mode="edit"
          open={!!editing}
          existing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => void utils.releaseVersion.list.invalidate()}
        />
      )}
    </AppLayout>
  );
}

function VersionDialog({
  mode,
  open,
  existing,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  open: boolean;
  existing?: ReleaseRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [version, setVersion] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [releasedAt, setReleasedAt] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (mode === "edit" && existing) {
      setVersion(existing.version);
      setTitle(existing.title ?? "");
      setNotes(existing.notes);
      setReleasedAt(new Date(existing.releasedAt).toISOString().slice(0, 10));
    } else {
      setVersion("");
      setTitle("");
      setNotes("");
      setReleasedAt(new Date().toISOString().slice(0, 10));
    }
  }, [mode, existing, open]);

  const create = api.releaseVersion.create.useMutation({
    onSuccess: () => {
      toast.success("Version created");
      onSaved();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  const update = api.releaseVersion.update.useMutation({
    onSuccess: () => {
      toast.success("Version updated");
      onSaved();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const submit = () => {
    const payload = {
      version: version.trim(),
      title: title.trim() || null,
      notes: notes,
      releasedAt: releasedAt ? new Date(releasedAt) : undefined,
    };
    if (mode === "edit" && existing) {
      update.mutate({ id: existing.id, ...payload });
    } else {
      create.mutate(payload);
    }
  };

  const isPending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Edit Version" : "New Version"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="version">Version *</Label>
              <Input
                id="version"
                placeholder="1.0"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="releasedAt">Released</Label>
              <Input
                id="releasedAt"
                type="date"
                value={releasedAt}
                onChange={(e) => setReleasedAt(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="Optional summary"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="notes">Notes (markdown)</Label>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowPreview((s) => !s)}>
                {showPreview ? "Edit" : "Preview"}
              </Button>
            </div>
            {showPreview ? (
              <div className="border rounded-md p-3 min-h-[200px]">
                <MarkdownPreview content={notes || "*Empty*"} />
              </div>
            ) : (
              <Textarea id="notes" rows={10} value={notes} onChange={(e) => setNotes(e.target.value)} />
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!version.trim() || !notes.trim() || isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {mode === "edit" ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
