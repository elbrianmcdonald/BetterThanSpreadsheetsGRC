"use client";

/**
 * Link Process Modal
 *
 * Epic 14: Asset Registry & BIA Integration
 * Story 14.5: Link Assets to Business Processes
 */

import { useState } from "react";
import { api } from "@/trpc/react";
import { toast } from "react-hot-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Search, Link as LinkIcon } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assetId: string;
  onSuccess?: () => void;
}

export function LinkProcessModal({
  open,
  onOpenChange,
  assetId,
  onSuccess,
}: Props) {
  const [search, setSearch] = useState("");
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);
  const [dependencyType, setDependencyType] = useState<string>("PRIMARY");
  const [notes, setNotes] = useState("");

  // Fetch available processes
  const { data: processes, isLoading } = api.asset.getAvailableProcesses.useQuery(
    { assetId, search: search || undefined },
    { enabled: open }
  );

  // Link mutation
  const linkMutation = api.asset.linkToProcess.useMutation({
    onSuccess: () => {
      toast.success("Process linked successfully");
      onOpenChange(false);
      resetForm();
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setSearch("");
    setSelectedProcessId(null);
    setDependencyType("PRIMARY");
    setNotes("");
  };

  const handleLink = () => {
    if (!selectedProcessId) return;

    linkMutation.mutate({
      assetId,
      businessProcessId: selectedProcessId,
      dependencyType: dependencyType as "PRIMARY" | "BACKUP" | "SUPPORTING",
      notes: notes || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Link Business Process</DialogTitle>
          <DialogDescription>
            Select a business process to link to this asset.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search processes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Process List */}
          <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Loading processes...
              </div>
            ) : !processes?.length ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {search
                  ? "No processes match your search"
                  : "All processes are already linked"}
              </div>
            ) : (
              processes.map((process: any) => (
                <div
                  key={process.id}
                  className={`p-3 cursor-pointer hover:bg-muted/50 ${
                    selectedProcessId === process.id ? "bg-muted" : ""
                  }`}
                  onClick={() => setSelectedProcessId(process.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{process.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {process.identifier}
                      </p>
                    </div>
                    {process.effectiveTier && (
                      <Badge
                        style={{
                          backgroundColor: process.effectiveTier.colorHex + "20",
                          color: process.effectiveTier.colorHex,
                        }}
                        variant="outline"
                      >
                        {process.effectiveTier.name}
                      </Badge>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Dependency Type */}
          {selectedProcessId && (
            <>
              <div className="space-y-2">
                <Label>Dependency Type</Label>
                <RadioGroup
                  value={dependencyType}
                  onValueChange={setDependencyType}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="PRIMARY" id="primary" />
                    <Label htmlFor="primary" className="cursor-pointer">
                      Primary
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="BACKUP" id="backup" />
                    <Label htmlFor="backup" className="cursor-pointer">
                      Backup
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="SUPPORTING" id="supporting" />
                    <Label htmlFor="supporting" className="cursor-pointer">
                      Supporting
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any notes about this dependency..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-20"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleLink}
            disabled={!selectedProcessId || linkMutation.isPending}
          >
            <LinkIcon className="h-4 w-4 mr-2" />
            {linkMutation.isPending ? "Linking..." : "Link Process"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
