"use client";

/**
 * Finding Linked Controls Component
 *
 * Story 12.7: Finding-to-Control Linkage UI (AC1-AC10)
 *
 * Displays controls linked to a finding with ability to:
 * - View linked controls grouped by framework
 * - Add new control links via picker dialog
 * - Edit link type and notes
 * - Remove links
 */

import { useState } from "react";
import { api } from "@/trpc/react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Shield,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Search,
  Link2,
  XCircle,
  AlertTriangle,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import type { FindingControlLinkType } from "@prisma/client";

interface FindingLinkedControlsProps {
  findingId: string;
  findingIdentifier: string;
}

// Link type badge styling (AC3)
function FindingLinkTypeBadge({ type }: { type: FindingControlLinkType }) {
  switch (type) {
    case "VIOLATION":
      return (
        <Badge className="gap-1 bg-red-100 text-red-700 hover:bg-red-100">
          <XCircle className="h-3 w-3" />
          Violation
        </Badge>
      );
    case "WEAKNESS":
      return (
        <Badge className="gap-1 bg-amber-100 text-amber-700 hover:bg-amber-100">
          <AlertTriangle className="h-3 w-3" />
          Weakness
        </Badge>
      );
    case "OBSERVATION":
      return (
        <Badge className="gap-1 bg-blue-100 text-blue-700 hover:bg-blue-100">
          <Eye className="h-3 w-3" />
          Observation
        </Badge>
      );
  }
}

export function FindingLinkedControls({
  findingId,
  findingIdentifier,
}: FindingLinkedControlsProps) {
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedLink, setSelectedLink] = useState<{
    id: string;
    controlId: string;
    controlTitle: string;
    linkType: FindingControlLinkType;
    notes: string | null;
  } | null>(null);

  // Link form state
  const [selectedFramework, setSelectedFramework] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedControlIds, setSelectedControlIds] = useState<Set<string>>(new Set());
  const [linkType, setLinkType] = useState<FindingControlLinkType>("VIOLATION");
  const [notes, setNotes] = useState("");

  const utils = api.useUtils();

  // Fetch linked controls (AC1, AC2)
  const { data: linkedControls, isLoading } = api.controlLink.getFindingControls.useQuery({
    findingId,
  });

  // Fetch frameworks for picker (AC12)
  const { data: frameworks } = api.framework.list.useQuery({});

  // Fetch controls for selected framework (AC13, AC14)
  const { data: controlsData } = api.framework.getControls.useQuery(
    { frameworkId: selectedFramework, search: searchQuery, pageSize: 50 },
    { enabled: !!selectedFramework }
  );

  // Bulk link mutation (AC18)
  const bulkLinkMutation = api.controlLink.bulkLinkFindingToControls.useMutation({
    onSuccess: (result) => {
      if (result.created > 0) {
        toast.success(`${result.created} control(s) linked successfully${result.skipped > 0 ? ` (${result.skipped} already linked)` : ""}`);
      } else {
        toast.info("All selected controls were already linked");
      }
      setShowLinkDialog(false);
      resetLinkForm();
      utils.controlLink.getFindingControls.invalidate({ findingId });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Update mutation (AC6)
  const updateMutation = api.controlLink.updateFindingControlLink.useMutation({
    onSuccess: () => {
      toast.success("Link updated");
      setShowEditDialog(false);
      setSelectedLink(null);
      utils.controlLink.getFindingControls.invalidate({ findingId });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Unlink mutation (AC7)
  const unlinkMutation = api.controlLink.unlinkFindingFromControl.useMutation({
    onSuccess: () => {
      toast.success("Control unlinked");
      utils.controlLink.getFindingControls.invalidate({ findingId });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const resetLinkForm = () => {
    setSelectedFramework("");
    setSearchQuery("");
    setSelectedControlIds(new Set());
    setLinkType("VIOLATION");
    setNotes("");
  };

  const toggleControlSelection = (controlId: string) => {
    setSelectedControlIds((prev) => {
      const next = new Set(prev);
      if (next.has(controlId)) {
        next.delete(controlId);
      } else {
        next.add(controlId);
      }
      return next;
    });
  };

  const handleLink = () => {
    if (selectedControlIds.size === 0) return;
    bulkLinkMutation.mutate({
      findingId,
      controlIds: Array.from(selectedControlIds),
      linkType,
      notes: notes || undefined,
    });
  };

  const handleUpdate = () => {
    if (!selectedLink) return;
    updateMutation.mutate({
      findingId,
      controlId: selectedLink.controlId,
      linkType: selectedLink.linkType,
      notes: selectedLink.notes || undefined,
    });
  };

  const handleUnlink = (controlId: string, controlTitle: string) => {
    if (confirm(`Unlink "${controlTitle}" from this finding?`)) {
      unlinkMutation.mutate({ findingId, controlId });
    }
  };

  const openEditDialog = (link: typeof selectedLink) => {
    setSelectedLink(link);
    setShowEditDialog(true);
  };

  // Group controls by framework (AC9)
  const controlsByFramework = linkedControls?.reduce(
    (acc, link) => {
      const frameworkName = link.control.Framework?.name ?? "Unknown Framework";
      if (!acc[frameworkName]) {
        acc[frameworkName] = [];
      }
      acc[frameworkName].push(link);
      return acc;
    },
    {} as Record<string, typeof linkedControls>
  );

  // Get already linked control IDs (AC15)
  const linkedControlIds = new Set(linkedControls?.map((l) => l.controlId) ?? []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Link button (AC1, AC4, AC10) */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Linked Controls</h3>
          {linkedControls && linkedControls.length > 0 && (
            <Badge variant="secondary">{linkedControls.length}</Badge>
          )}
        </div>
        <Button size="sm" onClick={() => setShowLinkDialog(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Link Control
        </Button>
      </div>

      {/* Empty state (AC8) */}
      {(!linkedControls || linkedControls.length === 0) && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Link2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h4 className="text-lg font-medium mb-2">No Controls Linked</h4>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm">
              Link controls to track affected compliance requirements.
            </p>
            <Button size="sm" onClick={() => setShowLinkDialog(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Link Control
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Controls grouped by framework (AC2, AC9) */}
      {controlsByFramework && Object.keys(controlsByFramework).length > 0 && (
        <div className="space-y-4">
          {Object.entries(controlsByFramework).map(([frameworkName, links]) => (
            <Card key={frameworkName}>
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-medium">{frameworkName}</CardTitle>
                <CardDescription>{links.length} control(s)</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">Control ID</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead className="w-[110px]">Link Type</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {links.map((link) => (
                      <TableRow key={link.id}>
                        <TableCell className="font-mono text-sm">
                          {link.control.controlId}
                        </TableCell>
                        <TableCell>{link.control.title}</TableCell>
                        <TableCell>
                          <FindingLinkTypeBadge type={link.linkType} />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                          {link.notes ?? "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                openEditDialog({
                                  id: link.id,
                                  controlId: link.controlId,
                                  controlTitle: link.control.title,
                                  linkType: link.linkType,
                                  notes: link.notes,
                                })
                              }
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleUnlink(link.controlId, link.control.title)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Link Control Dialog (AC11-AC19) */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Link Control to Finding: {findingIdentifier}</DialogTitle>
            <DialogDescription>
              Select a control to link to this finding
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Framework selector (AC12) */}
            <div className="space-y-2">
              <Label>Framework</Label>
              <Select value={selectedFramework} onValueChange={setSelectedFramework}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a framework..." />
                </SelectTrigger>
                <SelectContent>
                  {frameworks?.map((fw) => (
                    <SelectItem key={fw.id} value={fw.id}>
                      {fw.name} ({fw.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Control search (AC13) */}
            {selectedFramework && (
              <div className="space-y-2">
                <Label>Search Controls</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by ID or title..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            )}

            {/* Control list with multi-select (AC14, AC15) */}
            {selectedFramework && controlsData?.controls && (
              <div className="space-y-2">
                {selectedControlIds.size > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {selectedControlIds.size} control(s) selected
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setSelectedControlIds(new Set())}
                    >
                      Clear selection
                    </Button>
                  </div>
                )}
                <div className="border rounded-md max-h-[200px] overflow-y-auto">
                  {controlsData.controls.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No controls found
                    </div>
                  ) : (
                    <div className="divide-y">
                      {controlsData.controls.map((control) => {
                        const isLinked = linkedControlIds.has(control.id);
                        const isSelected = selectedControlIds.has(control.id);
                        return (
                          <div
                            key={control.id}
                            className={`p-3 cursor-pointer hover:bg-muted/50 ${
                              isSelected ? "bg-primary/10" : ""
                            } ${isLinked ? "opacity-50 cursor-not-allowed" : ""}`}
                            onClick={() => !isLinked && toggleControlSelection(control.id)}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`h-4 w-4 rounded border flex items-center justify-center ${
                                  isSelected
                                    ? "bg-primary border-primary text-primary-foreground"
                                    : "border-input"
                                } ${isLinked ? "opacity-50" : ""}`}
                              >
                                {isSelected && (
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="h-3 w-3"
                                  >
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                )}
                              </div>
                              <div className="flex-1 flex items-center justify-between">
                                <div>
                                  <span className="font-mono text-sm">{control.controlId}</span>
                                  <span className="mx-2 text-muted-foreground">—</span>
                                  <span className="text-sm">{control.title}</span>
                                </div>
                                {isLinked && (
                                  <Badge variant="outline" className="text-xs">
                                    Already linked
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Link type selector (AC16) */}
            {selectedControlIds.size > 0 && (
              <div className="space-y-2">
                <Label>Link Type (applies to all selected)</Label>
                <Select
                  value={linkType}
                  onValueChange={(v) => setLinkType(v as FindingControlLinkType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VIOLATION">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-red-600" />
                        Violation - Finding represents a control violation
                      </div>
                    </SelectItem>
                    <SelectItem value="WEAKNESS">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        Weakness - Finding indicates a control weakness
                      </div>
                    </SelectItem>
                    <SelectItem value="OBSERVATION">
                      <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4 text-blue-600" />
                        Observation - General observation related to control
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Notes (AC17) */}
            {selectedControlIds.size > 0 && (
              <div className="space-y-2">
                <Label>Notes (optional, applies to all)</Label>
                <Textarea
                  placeholder="Add any notes about these links..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={500}
                  rows={2}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {notes.length}/500
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleLink}
              disabled={selectedControlIds.size === 0 || bulkLinkMutation.isPending}
            >
              {bulkLinkMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Linking...
                </>
              ) : (
                `Link ${selectedControlIds.size > 0 ? selectedControlIds.size : ""} Control${selectedControlIds.size !== 1 ? "s" : ""}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Link Dialog (AC6) */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Control Link</DialogTitle>
            <DialogDescription>
              {selectedLink?.controlTitle}
            </DialogDescription>
          </DialogHeader>

          {selectedLink && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Link Type</Label>
                <Select
                  value={selectedLink.linkType}
                  onValueChange={(v) =>
                    setSelectedLink({ ...selectedLink, linkType: v as FindingControlLinkType })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VIOLATION">Violation</SelectItem>
                    <SelectItem value="WEAKNESS">Weakness</SelectItem>
                    <SelectItem value="OBSERVATION">Observation</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={selectedLink.notes ?? ""}
                  onChange={(e) =>
                    setSelectedLink({ ...selectedLink, notes: e.target.value })
                  }
                  maxLength={500}
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
