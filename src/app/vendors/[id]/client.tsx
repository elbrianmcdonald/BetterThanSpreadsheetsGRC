"use client";

/**
 * Vendor Detail Content Component
 *
 * Epic 1: TPRM Vendor Registry
 * Story 1.3: Vendor Detail Page (FR3)
 * Story 1.5: Vendor Status Management (FR5)
 *
 * Epic 2: Vendor Risk Tiering
 * Story 2.1: Risk Tier Classification (FR11)
 * Story 2.5: Manual Review Date Override (FR16)
 *
 * Displays vendor details with status management and edit capabilities.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNow, isPast, differenceInDays } from "date-fns";
import toast from "react-hot-toast";
import {
  Building2,
  Pencil,
  Trash2,
  User,
  Mail,
  Calendar,
  Briefcase,
  MoreVertical,
  AlertTriangle,
  Clock,
  CalendarClock,
  FileWarning,
  ShieldAlert,
  ExternalLink,
  Loader2,
  Download,
  FileArchive,
} from "lucide-react";

import { UserRole, VendorStatus, VendorRiskTier } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/trpc/react";
import {
  VendorStatusBadge,
  getVendorStatusOptions,
  VendorRiskTierBadge,
  getVendorRiskTierOptions,
} from "@/components/vendor";

/**
 * Roles that can manage vendors
 */
const VENDOR_MANAGE_ROLES: UserRole[] = [UserRole.ADMINISTRATOR, UserRole.ANALYST];

interface VendorDetailContentProps {
  vendor: {
    id: string;
    identifier: string;
    name: string;
    category: string | null;
    status: VendorStatus;
    riskTier: VendorRiskTier | null;
    nextReviewDate: Date | string | null;
    reviewDateOverridden: boolean;
    reviewOverrideReason: string | null;
    primaryContactName: string | null;
    primaryContactEmail: string | null;
    notes: string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
    businessUnit?: { id: string; name: string } | null;
    itOwner?: { id: string; name: string | null; email: string | null } | null;
    businessOwner?: { id: string; name: string | null; email: string | null } | null;
    createdBy?: { id: string; name: string | null; email: string | null } | null;
    // Epic 5: Findings and Risks counts (FR47, FR49)
    _count?: {
      findings: number;
      risks: number;
      assessments: number;
    };
  };
  userRole: UserRole;
}

export function VendorDetailContent({ vendor, userRole }: VendorDetailContentProps) {
  const router = useRouter();
  const utils = api.useUtils();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<VendorStatus>(vendor.status);
  const [selectedRiskTier, setSelectedRiskTier] = useState<VendorRiskTier | null>(vendor.riskTier);
  const [overrideDate, setOverrideDate] = useState("");
  const [overrideReason, setOverrideReason] = useState("");

  const canManage = VENDOR_MANAGE_ROLES.includes(userRole);
  const [isExporting, setIsExporting] = useState(false);

  // Update status mutation
  const updateStatusMutation = api.vendor.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Status updated successfully");
      void utils.vendor.getById.invalidate({ id: vendor.id });
      void utils.vendor.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update status");
      setSelectedStatus(vendor.status);
    },
  });

  // Update risk tier mutation (FR11, FR12)
  const updateRiskTierMutation = api.vendor.updateRiskTier.useMutation({
    onSuccess: () => {
      toast.success("Risk tier updated - next review date calculated");
      void utils.vendor.getById.invalidate({ id: vendor.id });
      void utils.vendor.list.invalidate();
      void utils.vendor.getStats.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update risk tier");
      setSelectedRiskTier(vendor.riskTier);
    },
  });

  // Override review date mutation (FR16)
  const overrideReviewDateMutation = api.vendor.overrideReviewDate.useMutation({
    onSuccess: () => {
      toast.success("Review date overridden successfully");
      void utils.vendor.getById.invalidate({ id: vendor.id });
      void utils.vendor.list.invalidate();
      setShowOverrideDialog(false);
      setOverrideDate("");
      setOverrideReason("");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to override review date");
    },
  });

  // Delete mutation
  const deleteMutation = api.vendor.delete.useMutation({
    onSuccess: () => {
      toast.success("Vendor offboarded successfully");
      router.push("/vendors");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to offboard vendor");
    },
  });

  const handleStatusChange = (newStatus: VendorStatus) => {
    setSelectedStatus(newStatus);
    updateStatusMutation.mutate({ id: vendor.id, status: newStatus });
  };

  const handleRiskTierChange = (newTier: string) => {
    if (newTier === "__none__") {
      // Can't unset risk tier once set - would need separate logic
      return;
    }
    const tier = newTier as VendorRiskTier;
    setSelectedRiskTier(tier);
    updateRiskTierMutation.mutate({ id: vendor.id, riskTier: tier });
  };

  const handleOverrideReviewDate = () => {
    if (!overrideDate || !overrideReason) {
      toast.error("Please provide both a date and reason");
      return;
    }
    overrideReviewDateMutation.mutate({
      id: vendor.id,
      nextReviewDate: new Date(overrideDate),
      reason: overrideReason,
    });
  };

  const handleDelete = () => {
    deleteMutation.mutate({ id: vendor.id });
    setShowDeleteDialog(false);
  };

  // Evidence package export handler (FR53)
  const handleExportEvidence = async () => {
    setIsExporting(true);
    try {
      const evidencePackage = await utils.client.vendor.exportEvidencePackage.query({
        vendorId: vendor.id,
        includeAssessments: true,
        includeQuestionnaires: true,
        includeFindings: true,
        includeDocuments: true,
      });

      // Create downloadable JSON file
      const blob = new Blob([JSON.stringify(evidencePackage, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${vendor.identifier}_evidence_package_${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Evidence package exported successfully");
    } catch (error) {
      toast.error("Failed to export evidence package");
      console.error("Export error:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const statusOptions = getVendorStatusOptions();
  const riskTierOptions = getVendorRiskTierOptions();

  // Calculate review status
  const nextReviewDate = vendor.nextReviewDate ? new Date(vendor.nextReviewDate) : null;
  const isOverdue = nextReviewDate && isPast(nextReviewDate);
  const daysUntilReview = nextReviewDate ? differenceInDays(nextReviewDate, new Date()) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="rounded-lg bg-primary/10 p-3">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold">{vendor.name}</h1>
              <VendorStatusBadge status={vendor.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {vendor.identifier}
              {vendor.category && ` • ${vendor.category}`}
            </p>
          </div>
        </div>

        {canManage && (
          <div className="flex items-center gap-2">
            <Link href={`/vendors/${vendor.id}/edit`}>
              <Button variant="outline">
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleExportEvidence}
                  disabled={isExporting}
                >
                  {isExporting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileArchive className="mr-2 h-4 w-4" />
                  )}
                  Export Evidence Package
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Offboard Vendor
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Tabs Navigation */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="findings" className="flex items-center gap-2">
            <FileWarning className="h-4 w-4" />
            Findings
            {vendor._count && vendor._count.findings > 0 && (
              <Badge variant="secondary" className="ml-1">{vendor._count.findings}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="risks" className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            Risks
            {vendor._count && vendor._count.risks > 0 && (
              <Badge variant="secondary" className="ml-1">{vendor._count.risks}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Status Management */}
          {canManage && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Status Management</CardTitle>
                <CardDescription>Change the vendor's current status</CardDescription>
              </CardHeader>
              <CardContent>
                <Select
                  value={selectedStatus}
                  onValueChange={(value) => handleStatusChange(value as VendorStatus)}
                  disabled={updateStatusMutation.isPending}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

          {/* Risk Classification (FR11, FR12, FR16) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                Risk Classification
                {vendor.riskTier && <VendorRiskTierBadge tier={vendor.riskTier} />}
              </CardTitle>
              <CardDescription>
                Vendor risk tier and review schedule
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Risk Tier Selection */}
              {canManage && (
                <div className="space-y-2">
                  <Label>Risk Tier</Label>
                  <Select
                    value={selectedRiskTier ?? "__none__"}
                    onValueChange={handleRiskTierChange}
                    disabled={updateRiskTierMutation.isPending}
                  >
                    <SelectTrigger className="w-[280px]">
                      <SelectValue placeholder="Select risk tier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Not Classified</SelectItem>
                      {riskTierOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Next Review Date Display */}
              {nextReviewDate && (
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CalendarClock className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">Next Review</span>
                    </div>
                    {isOverdue ? (
                      <Badge variant="destructive" className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Overdue
                      </Badge>
                    ) : daysUntilReview !== null && daysUntilReview <= 30 ? (
                      <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">
                        <Clock className="h-3 w-3 mr-1" />
                        Due Soon
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-2xl font-semibold">
                    {format(nextReviewDate, "MMMM d, yyyy")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isOverdue
                      ? `Overdue by ${formatDistanceToNow(nextReviewDate)}`
                      : `In ${formatDistanceToNow(nextReviewDate)}`}
                  </p>
                  {vendor.reviewDateOverridden && (
                    <p className="text-xs text-muted-foreground italic">
                      Manually overridden: {vendor.reviewOverrideReason}
                    </p>
                  )}
                  {canManage && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowOverrideDialog(true)}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      Override Date
                    </Button>
                  )}
                </div>
              )}

              {!vendor.riskTier && (
                <p className="text-sm text-muted-foreground">
                  Assign a risk tier to automatically calculate review schedules.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Primary Contact */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Primary Contact</CardTitle>
            </CardHeader>
            <CardContent>
              {vendor.primaryContactName || vendor.primaryContactEmail ? (
                <div className="space-y-3">
                  {vendor.primaryContactName && (
                    <div className="flex items-center gap-3">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>{vendor.primaryContactName}</span>
                    </div>
                  )}
                  {vendor.primaryContactEmail && (
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a
                        href={`mailto:${vendor.primaryContactEmail}`}
                        className="text-primary hover:underline"
                      >
                        {vendor.primaryContactEmail}
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">No contact information</p>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          {vendor.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm">{vendor.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Ownership */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Ownership</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Business Unit
                </p>
                <p className="mt-1">
                  {vendor.businessUnit?.name || (
                    <span className="text-muted-foreground">Not assigned</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  IT Owner
                </p>
                <p className="mt-1">
                  {vendor.itOwner?.name || vendor.itOwner?.email || (
                    <span className="text-muted-foreground">Not assigned</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Business Owner
                </p>
                <p className="mt-1">
                  {vendor.businessOwner?.name || vendor.businessOwner?.email || (
                    <span className="text-muted-foreground">Not assigned</span>
                  )}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Identifier
                </p>
                <p className="mt-1 font-mono">{vendor.identifier}</p>
              </div>
              {vendor.category && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Category
                  </p>
                  <p className="mt-1">{vendor.category}</p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Created
                </p>
                <p className="mt-1">
                  {format(new Date(vendor.createdAt), "PPP")}
                </p>
                {vendor.createdBy && (
                  <p className="text-sm text-muted-foreground">
                    by {vendor.createdBy.name || vendor.createdBy.email}
                  </p>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Last Updated
                </p>
                <p className="mt-1">
                  {format(new Date(vendor.updatedAt), "PPP")}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
        </TabsContent>

        {/* Findings Tab - Epic 5 FR47 */}
        <TabsContent value="findings">
          <VendorFindingsTab vendorId={vendor.id} />
        </TabsContent>

        {/* Risks Tab - Epic 5 FR49 */}
        <TabsContent value="risks">
          <VendorRisksTab vendorId={vendor.id} />
        </TabsContent>
      </Tabs>

      {/* Override Review Date Dialog (FR16) */}
      <AlertDialog open={showOverrideDialog} onOpenChange={setShowOverrideDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Override Review Date</AlertDialogTitle>
            <AlertDialogDescription>
              Manually set a new review date. This will override the automatic
              calculation based on the risk tier.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="override-date">New Review Date</Label>
              <Input
                id="override-date"
                type="date"
                value={overrideDate}
                onChange={(e) => setOverrideDate(e.target.value)}
                min={format(new Date(), "yyyy-MM-dd")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="override-reason">Reason for Override</Label>
              <Textarea
                id="override-reason"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Explain why this review date is being overridden..."
                rows={3}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setOverrideDate("");
              setOverrideReason("");
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleOverrideReviewDate}
              disabled={!overrideDate || !overrideReason || overrideReviewDateMutation.isPending}
            >
              {overrideReviewDateMutation.isPending ? "Saving..." : "Save Override"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Offboard Vendor</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to offboard {vendor.name}? This will mark the
              vendor as offboarded and hide them from active vendor lists.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Offboard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * Vendor Findings Tab Component
 *
 * Epic 5: FR47 - GRC Analyst can view vendor-related findings on the vendor profile
 */
function VendorFindingsTab({ vendorId }: { vendorId: string }) {
  const { data: findings, isLoading, error } = api.finding.getByVendorId.useQuery(
    { vendorId },
    { retry: false }
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
          <p className="mt-2 text-sm text-muted-foreground">
            Failed to load findings
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!findings || findings.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <FileWarning className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">No Findings</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            No findings have been associated with this vendor yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vendor Findings</CardTitle>
        <CardDescription>
          Findings discovered during vendor assessments
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Identifier</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Created</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {findings.map((finding) => (
              <TableRow key={finding.id}>
                <TableCell className="font-mono text-sm">
                  {finding.identifier}
                </TableCell>
                <TableCell className="max-w-[200px] truncate">
                  {finding.title}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      finding.severity === "HIGH"
                        ? "destructive"
                        : finding.severity === "MEDIUM"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {finding.severity}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{finding.status}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {finding.vendorAssessment?.identifier || "Direct"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(new Date(finding.createdAt), "PP")}
                </TableCell>
                <TableCell>
                  <Link href={`/findings/${finding.id}`}>
                    <Button variant="ghost" size="sm">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/**
 * Vendor Risks Tab Component
 *
 * Epic 5: FR49 - System displays vendor risks on the vendor profile
 */
function VendorRisksTab({ vendorId }: { vendorId: string }) {
  const { data: risks, isLoading, error } = api.risk.getByVendorId.useQuery(
    { vendorId },
    { retry: false }
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
          <p className="mt-2 text-sm text-muted-foreground">
            Failed to load risks
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!risks || risks.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">No Risks</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            No risks have been associated with this vendor yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vendor Risks</CardTitle>
        <CardDescription>
          Risks identified from vendor assessments and questionnaires
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>IT Owner</TableHead>
              <TableHead>Assessment</TableHead>
              <TableHead>Created</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {risks.map((risk) => (
              <TableRow key={risk.id}>
                <TableCell className="max-w-[200px] truncate">
                  {risk.title}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      risk.severity === "HIGH"
                        ? "destructive"
                        : risk.severity === "MEDIUM"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {risk.severity}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{risk.status}</Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {risk.ITOwner?.name || risk.ITOwner?.email || "-"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {risk.VendorAssessment?.identifier || "Direct"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(new Date(risk.createdAt), "PP")}
                </TableCell>
                <TableCell>
                  <Link href={`/risks/${risk.id}`}>
                    <Button variant="ghost" size="sm">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
