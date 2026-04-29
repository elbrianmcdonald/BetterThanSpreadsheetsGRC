"use client";

/**
 * Asset Detail Client Component
 *
 * Epic 14: Asset Registry & BIA Integration
 * Story 14.3: Asset Detail Page
 */

import { useState } from "react";
import { api } from "@/trpc/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AssetType, AssetStatus } from "@prisma/client";
import { toast } from "react-hot-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  ArrowLeft,
  Edit,
  Trash2,
  Server,
  Database,
  AppWindow,
  Network,
  HardDrive,
  Monitor,
  Link as LinkIcon,
  Unlink,
  Building2,
  User,
  Calendar,
  History,
} from "lucide-react";
import { LinkProcessModal } from "@/components/asset/LinkProcessModal";

// Asset type display config
const ASSET_TYPE_CONFIG: Record<
  AssetType,
  { label: string; icon: React.ReactNode }
> = {
  SERVER: { label: "Server", icon: <Server className="h-5 w-5" /> },
  DATABASE: { label: "Database", icon: <Database className="h-5 w-5" /> },
  APPLICATION: { label: "Application", icon: <AppWindow className="h-5 w-5" /> },
  NETWORK: { label: "Network", icon: <Network className="h-5 w-5" /> },
  STORAGE: { label: "Storage", icon: <HardDrive className="h-5 w-5" /> },
  ENDPOINT: { label: "Endpoint", icon: <Monitor className="h-5 w-5" /> },
};

// Status colors
const STATUS_COLORS: Record<AssetStatus, string> = {
  ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  INACTIVE: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  DECOMMISSIONED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  UNDER_MAINTENANCE: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
};

const STATUS_LABELS: Record<AssetStatus, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  DECOMMISSIONED: "Decommissioned",
  UNDER_MAINTENANCE: "Under Maintenance",
};

const DEPENDENCY_TYPE_COLORS: Record<string, string> = {
  PRIMARY: "bg-blue-100 text-blue-800",
  BACKUP: "bg-purple-100 text-purple-800",
  SUPPORTING: "bg-gray-100 text-gray-800",
};

interface Props {
  assetId: string;
}

export function AssetDetailClient({ assetId }: Props) {
  const router = useRouter();
  const utils = api.useUtils();

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [newStatus, setNewStatus] = useState<AssetStatus | "">("");

  // Fetch asset data
  const { data, isLoading, error } = api.asset.getById.useQuery({ id: assetId });

  // Mutations
  const deleteMutation = api.asset.delete.useMutation({
    onSuccess: () => {
      toast.success("Asset decommissioned");
      router.push("/assets");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateStatusMutation = api.asset.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Status updated");
      setShowStatusDialog(false);
      utils.asset.getById.invalidate({ id: assetId });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const unlinkMutation = api.asset.unlinkFromProcess.useMutation({
    onSuccess: () => {
      toast.success("Process unlinked");
      utils.asset.getById.invalidate({ id: assetId });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Skeleton className="h-10 w-32" />
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <p className="text-red-500">
            {error?.message || "Asset not found"}
          </p>
          <Link href="/assets">
            <Button variant="link">Return to Assets</Button>
          </Link>
        </div>
      </div>
    );
  }

  const { asset, tierSourceProcesses, permissions } = data;
  const typeConfig = ASSET_TYPE_CONFIG[asset.type];

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Back Link */}
      <Link href="/assets">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Assets
        </Button>
      </Link>

      {/* Hero Section */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground font-mono">
            {asset.identifier}
          </p>
          <h1 className="text-2xl font-semibold flex items-center gap-3">
            {typeConfig.icon}
            {asset.name}
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline" className="flex items-center gap-1">
              {typeConfig.icon}
              {typeConfig.label}
            </Badge>
            <Badge className={STATUS_COLORS[asset.status]}>
              {STATUS_LABELS[asset.status]}
            </Badge>
            {asset.calculatedTier && (
              <Badge
                style={{
                  backgroundColor: asset.calculatedTier.colorHex + "20",
                  color: asset.calculatedTier.colorHex,
                  borderColor: asset.calculatedTier.colorHex,
                }}
                variant="outline"
              >
                {asset.calculatedTier.name}
              </Badge>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {permissions.canEdit && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setNewStatus(asset.status);
                  setShowStatusDialog(true);
                }}
              >
                Change Status
              </Button>
              <Link href={`/assets/${assetId}/edit`}>
                <Button variant="outline">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </Link>
            </>
          )}
          {permissions.canDelete && (
            <Button
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Decommission
            </Button>
          )}
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          {asset.description && (
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{asset.description}</p>
              </CardContent>
            </Card>
          )}

          {/* Loss Event Range */}
          <Card>
            <CardHeader>
              <CardTitle>Loss Event Range</CardTitle>
              <CardDescription>Estimated financial loss in USD if a loss event occurs.</CardDescription>
            </CardHeader>
            <CardContent>
              {asset.lossMinimum || asset.lossProbable || asset.lossMaximum ? (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Minimum</p>
                    <p className="font-mono text-lg">
                      {asset.lossMinimum ? `$${Number(asset.lossMinimum).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Probable</p>
                    <p className="font-mono text-lg">
                      {asset.lossProbable ? `$${Number(asset.lossProbable).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Maximum</p>
                    <p className="font-mono text-lg">
                      {asset.lossMaximum ? `$${Number(asset.lossMaximum).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground italic text-sm">Not yet estimated</p>
              )}
            </CardContent>
          </Card>

          {/* Linked Processes */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Linked Business Processes</CardTitle>
                <CardDescription>
                  Processes that depend on this asset
                </CardDescription>
              </div>
              {permissions.canLinkProcesses && (
                <Button size="sm" onClick={() => setShowLinkModal(true)}>
                  <LinkIcon className="h-4 w-4 mr-2" />
                  Link Process
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {asset.businessProcessLinks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No processes linked. Link processes to track dependencies.
                </p>
              ) : (
                <div className="space-y-3">
                  {asset.businessProcessLinks.map((link: any) => (
                    <div
                      key={link.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex-1">
                        <Link
                          href={`/bia/processes/${link.businessProcess.id}`}
                          className="font-medium hover:underline"
                        >
                          {link.businessProcess.name}
                        </Link>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground font-mono">
                            {link.businessProcess.identifier}
                          </span>
                          {link.dependencyType && (
                            <Badge
                              className={
                                DEPENDENCY_TYPE_COLORS[link.dependencyType] ||
                                "bg-gray-100"
                              }
                            >
                              {link.dependencyType}
                            </Badge>
                          )}
                          {link.businessProcess.effectiveTier && (
                            <Badge
                              style={{
                                backgroundColor:
                                  link.businessProcess.effectiveTier.colorHex + "20",
                                color: link.businessProcess.effectiveTier.colorHex,
                              }}
                              variant="outline"
                            >
                              {link.businessProcess.effectiveTier.name}
                            </Badge>
                          )}
                        </div>
                        {link.notes && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {link.notes}
                          </p>
                        )}
                      </div>
                      {permissions.canLinkProcesses && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            unlinkMutation.mutate({
                              assetId: asset.id,
                              businessProcessId: link.businessProcess.id,
                            })
                          }
                        >
                          <Unlink className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-6">
          {/* Calculated Tier */}
          <Card>
            <CardHeader>
              <CardTitle>Criticality Tier</CardTitle>
            </CardHeader>
            <CardContent>
              {asset.calculatedTier ? (
                <div className="space-y-2">
                  <Badge
                    className="text-base px-4 py-2"
                    style={{
                      backgroundColor: asset.calculatedTier.colorHex + "20",
                      color: asset.calculatedTier.colorHex,
                      borderColor: asset.calculatedTier.colorHex,
                    }}
                    variant="outline"
                  >
                    {asset.calculatedTier.name}
                  </Badge>
                  <p className="text-xs text-muted-foreground">
                    {tierSourceProcesses.length === 1
                      ? `Inherited from: ${tierSourceProcesses[0]?.name}`
                      : `Inherited from ${tierSourceProcesses.length} processes`}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No tier - link processes to calculate
                </p>
              )}
            </CardContent>
          </Card>

          {/* Ownership */}
          <Card>
            <CardHeader>
              <CardTitle>Ownership</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Owner</p>
                  <p className="text-sm">
                    {asset.owner?.name || "Not assigned"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Business Unit</p>
                  <p className="text-sm">
                    {asset.businessUnit?.name || "Not assigned"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Audit Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-4 w-4" />
                Audit Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="text-sm">
                    {new Date(asset.createdAt).toLocaleDateString()}
                    {asset.createdBy && ` by ${asset.createdBy.name}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Last Updated</p>
                  <p className="text-sm">
                    {new Date(asset.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decommission Asset</DialogTitle>
            <DialogDescription>
              Are you sure you want to decommission {asset.name}? This will mark
              the asset as DECOMMISSIONED.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate({ id: assetId })}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Decommissioning..." : "Decommission"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Dialog */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Asset Status</DialogTitle>
            <DialogDescription>
              Update the status of {asset.name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select
              value={newStatus}
              onValueChange={(value) => setNewStatus(value as AssetStatus)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABELS).map(([status, label]) => (
                  <SelectItem key={status} value={status}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStatusDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                newStatus &&
                updateStatusMutation.mutate({
                  id: assetId,
                  status: newStatus as AssetStatus,
                })
              }
              disabled={!newStatus || updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending ? "Updating..." : "Update Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Process Modal */}
      <LinkProcessModal
        open={showLinkModal}
        onOpenChange={setShowLinkModal}
        assetId={assetId}
        onSuccess={() => {
          utils.asset.getById.invalidate({ id: assetId });
        }}
      />
    </div>
  );
}
