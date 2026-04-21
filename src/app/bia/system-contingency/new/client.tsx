"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Plus } from "lucide-react";
import { AssetType } from "@prisma/client";
import { api } from "@/trpc/react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
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
} from "@/components/ui/dialog";

type Anchor = "ASSET" | "PROCESS";

/** Sentinel value in the Select that triggers the inline-create dialog. */
const CREATE_NEW = "__create_new__";

const ASSET_TYPES: { value: AssetType; label: string }[] = [
  { value: AssetType.SERVER, label: "Server" },
  { value: AssetType.DATABASE, label: "Database" },
  { value: AssetType.APPLICATION, label: "Application" },
  { value: AssetType.NETWORK, label: "Network" },
  { value: AssetType.STORAGE, label: "Storage" },
  { value: AssetType.ENDPOINT, label: "Endpoint" },
];

export function NewSystemContingencyClient() {
  const router = useRouter();
  const utils = api.useUtils();

  const [anchor, setAnchor] = useState<Anchor>("ASSET");
  const [assetId, setAssetId] = useState<string>("");
  const [processId, setProcessId] = useState<string>("");

  const [assetDialogOpen, setAssetDialogOpen] = useState(false);
  const [processDialogOpen, setProcessDialogOpen] = useState(false);

  const { data: assets } = api.asset.list.useQuery(
    { page: 1, pageSize: 100 },
    { enabled: anchor === "ASSET" }
  );
  const { data: processes } = api.businessProcess.list.useQuery(
    { page: 1, pageSize: 100 },
    { enabled: anchor === "PROCESS" }
  );

  const createMutation = api.biaSystemContingency.create.useMutation({
    onSuccess: (bia) => {
      toast.success("BIA created");
      router.push(`/bia/system-contingency/${bia.id}`);
    },
    onError: (e) => toast.error(e.message || "Failed to create BIA"),
  });

  const handleSubmit = () => {
    if (anchor === "ASSET" && !assetId) {
      toast.error("Select an asset");
      return;
    }
    if (anchor === "PROCESS" && !processId) {
      toast.error("Select a business process");
      return;
    }
    createMutation.mutate({
      assetId: anchor === "ASSET" ? assetId : null,
      businessProcessId: anchor === "PROCESS" ? processId : null,
    });
  };

  const assetList = assets?.items ?? [];
  const processList = processes?.items ?? [];

  return (
    <AppLayout
      breadcrumbs={[
        { label: "Assessments" },
        { label: "BIA Assessment", href: "/bia/processes" },
        { label: "New" },
      ]}
    >
      <div className="container max-w-2xl mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">
            New BIA Assessment
          </h1>
          <Button variant="outline" asChild>
            <Link href="/bia/processes">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Anchor</CardTitle>
            <CardDescription>
              Pick what the BIA applies to. After creation you can add
              narrative, processes, resources, and recovery priorities.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <RadioGroup
              value={anchor}
              onValueChange={(v) => setAnchor(v as Anchor)}
              className="flex gap-6"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="ASSET" id="anchor-asset" />
                <Label htmlFor="anchor-asset">Asset (information system)</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="PROCESS" id="anchor-process" />
                <Label htmlFor="anchor-process">Business process</Label>
              </div>
            </RadioGroup>

            {anchor === "ASSET" ? (
              <div>
                <Label>Asset</Label>
                <Select
                  value={assetId}
                  onValueChange={(v) => {
                    if (v === CREATE_NEW) {
                      setAssetDialogOpen(true);
                      return;
                    }
                    setAssetId(v);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an asset…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CREATE_NEW}>
                      <span className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Create new asset…
                      </span>
                    </SelectItem>
                    {assetList.length > 0 && <SelectSeparator />}
                    {assetList.map(
                      (a: { id: string; identifier: string; name: string }) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.identifier} — {a.name}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label>Business process</Label>
                <Select
                  value={processId}
                  onValueChange={(v) => {
                    if (v === CREATE_NEW) {
                      setProcessDialogOpen(true);
                      return;
                    }
                    setProcessId(v);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a process…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CREATE_NEW}>
                      <span className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Create new business process…
                      </span>
                    </SelectItem>
                    {processList.length > 0 && <SelectSeparator />}
                    {processList.map(
                      (p: { id: string; identifier: string; name: string }) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.identifier} — {p.name}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex justify-end">
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating…
                  </>
                ) : (
                  "Create & edit"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <NewAssetDialog
        open={assetDialogOpen}
        onOpenChange={setAssetDialogOpen}
        onCreated={(id) => {
          setAssetId(id);
          void utils.asset.list.invalidate();
        }}
      />

      <NewProcessDialog
        open={processDialogOpen}
        onOpenChange={setProcessDialogOpen}
        onCreated={(id) => {
          setProcessId(id);
          void utils.businessProcess.list.invalidate();
        }}
      />
    </AppLayout>
  );
}

interface NewAssetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}

function NewAssetDialog({ open, onOpenChange, onCreated }: NewAssetDialogProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<AssetType>(AssetType.APPLICATION);
  const [description, setDescription] = useState("");

  const createAsset = api.asset.create.useMutation({
    onSuccess: (asset) => {
      toast.success(`Created asset "${asset.name}"`);
      onCreated(asset.id);
      onOpenChange(false);
      setName("");
      setDescription("");
      setType(AssetType.APPLICATION);
    },
    onError: (e) => toast.error(e.message || "Failed to create asset"),
  });

  const handleCreate = () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    createAsset.mutate({
      name: name.trim(),
      type,
      description: description.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New asset</DialogTitle>
          <DialogDescription>
            Create the asset inline. You can fill in owner, business unit,
            and other fields later from the Asset Registry.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="asset-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="asset-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Production Database Cluster"
            />
          </div>
          <div>
            <Label htmlFor="asset-type">
              Type <span className="text-destructive">*</span>
            </Label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as AssetType)}
            >
              <SelectTrigger id="asset-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSET_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="asset-description">Description</Label>
            <Textarea
              id="asset-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional — what this asset is and where it runs."
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createAsset.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={createAsset.isPending}>
            {createAsset.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating…
              </>
            ) : (
              "Create asset"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface NewProcessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}

function NewProcessDialog({
  open,
  onOpenChange,
  onCreated,
}: NewProcessDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const createProcess = api.businessProcess.create.useMutation({
    onSuccess: (process) => {
      toast.success(`Created process "${process.name}"`);
      onCreated(process.id);
      onOpenChange(false);
      setName("");
      setDescription("");
    },
    onError: (e) => toast.error(e.message || "Failed to create process"),
  });

  const handleCreate = () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    createProcess.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New business process</DialogTitle>
          <DialogDescription>
            Create the process inline. You can fill in function, owner, and
            dependencies later from the Business Processes page.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="process-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="process-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Pay vendor invoice"
            />
          </div>
          <div>
            <Label htmlFor="process-description">Description</Label>
            <Textarea
              id="process-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional — what the process does."
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createProcess.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={createProcess.isPending}>
            {createProcess.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating…
              </>
            ) : (
              "Create process"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
