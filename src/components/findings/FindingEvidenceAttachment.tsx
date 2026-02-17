"use client";

/**
 * Finding Evidence Attachment Component
 *
 * Story 14.6: Finding Evidence Attachment
 *
 * Allows GRC Analysts to attach evidence from the repository to findings.
 */

import { useState } from "react";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Paperclip,
  Plus,
  Trash2,
  FileText,
  Image,
  File,
  Search,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface FindingEvidenceAttachmentProps {
  findingId: string;
  canEdit?: boolean;
}

const FILE_ICONS: Record<string, React.ReactNode> = {
  pdf: <FileText className="h-4 w-4 text-red-500" />,
  png: <Image className="h-4 w-4 text-blue-500" />,
  jpg: <Image className="h-4 w-4 text-blue-500" />,
  jpeg: <Image className="h-4 w-4 text-blue-500" />,
  default: <File className="h-4 w-4 text-gray-500" />,
};

function getFileIcon(fileType: string) {
  const ext = fileType.split("/").pop()?.toLowerCase() ?? "";
  return FILE_ICONS[ext] ?? FILE_ICONS.default;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FindingEvidenceAttachment({
  findingId,
  canEdit = true,
}: FindingEvidenceAttachmentProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [removeId, setRemoveId] = useState<string | null>(null);

  const utils = api.useUtils();

  // Fetch attached evidence
  const { data: attachedEvidence, isLoading } =
    api.finding.getEvidence.useQuery({ findingId });

  // Fetch available evidence for attachment
  const { data: availableEvidence, isLoading: searchLoading } =
    api.evidence.list.useQuery(
      { search, pageSize: 20 },
      { enabled: isOpen }
    );

  // Attach evidence mutation
  const attachMutation = api.finding.attachEvidence.useMutation({
    onSuccess: () => {
      utils.finding.getEvidence.invalidate({ findingId });
      toast.success("Evidence attached");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Remove evidence mutation
  const removeMutation = api.finding.removeEvidence.useMutation({
    onSuccess: () => {
      setRemoveId(null);
      utils.finding.getEvidence.invalidate({ findingId });
      toast.success("Evidence removed");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleAttach = (evidenceId: string) => {
    attachMutation.mutate({ findingId, evidenceId });
  };

  const handleRemove = () => {
    if (!removeId) return;
    removeMutation.mutate({ findingId, evidenceId: removeId });
  };

  // Filter out already attached evidence from available list
  const attachedIds = new Set(
    attachedEvidence?.map((a) => a.evidence.id) ?? []
  );
  const filteredEvidence =
    availableEvidence?.items.filter((e) => !attachedIds.has(e.id)) ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Paperclip className="h-4 w-4" />
            Attached Evidence
            {attachedEvidence && attachedEvidence.length > 0 && (
              <Badge variant="secondary">{attachedEvidence.length}</Badge>
            )}
          </CardTitle>
          {canEdit && (
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-1" />
                  Attach
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Attach Evidence</DialogTitle>
                  <DialogDescription>
                    Search and select evidence from the repository to attach to
                    this finding.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search evidence..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <div className="max-h-[300px] overflow-y-auto space-y-2">
                    {searchLoading ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map((i) => (
                          <Skeleton key={i} className="h-16 w-full" />
                        ))}
                      </div>
                    ) : filteredEvidence.length > 0 ? (
                      filteredEvidence.map((evidence) => (
                        <div
                          key={evidence.id}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {getFileIcon(evidence.fileType)}
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">
                                {evidence.title}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {evidence.originalFileName} &bull;{" "}
                                {formatFileSize(evidence.fileSize)}
                              </p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleAttach(evidence.id)}
                            disabled={attachMutation.isPending}
                          >
                            {attachMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Plus className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        {search
                          ? "No matching evidence found"
                          : "No evidence available to attach"}
                      </p>
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : attachedEvidence && attachedEvidence.length > 0 ? (
          <div className="space-y-2">
            {attachedEvidence.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {getFileIcon(attachment.evidence.fileType)}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {attachment.evidence.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {attachment.evidence.originalFileName} &bull;{" "}
                      {formatFileSize(attachment.evidence.fileSize ?? 0)} &bull;
                      Attached{" "}
                      {formatDistanceToNow(new Date(attachment.attachedAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    asChild
                  >
                    <a
                      href={`/admin/evidence/${attachment.evidence.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                  {canEdit && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setRemoveId(attachment.evidence.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-6">
            No evidence attached yet.
            {canEdit && " Click 'Attach' to add evidence from the repository."}
          </p>
        )}

        {/* Remove confirmation dialog */}
        <AlertDialog open={!!removeId} onOpenChange={() => setRemoveId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Evidence</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove this evidence from the finding?
                The evidence will remain in the repository.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRemove}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {removeMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                )}
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
