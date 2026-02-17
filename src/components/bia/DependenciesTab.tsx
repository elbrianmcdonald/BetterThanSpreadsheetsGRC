"use client";

/**
 * Dependencies Tab Component
 *
 * Epic 12: BIA Dependencies & Integration
 * Stories 12.1-12.7: Process dependencies, vendor links, risk links,
 * resource dependencies, and peak time management
 */

import { useState } from "react";
import Link from "next/link";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Plus,
  Building2,
  ShieldAlert,
  GitMerge,
  Search,
  Clock,
  Users,
  MapPin,
  Truck,
  AlertTriangle,
  Edit2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DependenciesTabProps {
  processId: string;
  canEdit: boolean;
}

type DependencyDialog =
  | null
  | "addUpstream"
  | "addVendor"
  | "addRisk"
  | "editPeakTime";

// Types matching the router response
interface ProcessDependency {
  id: string;
  notes: string | null;
  process: {
    id: string;
    identifier: string;
    name: string;
    tier: { name: string; colorHex: string } | null;
    owner: { id: string; name: string | null; email: string } | null;
  };
}

interface VendorLink {
  id: string;
  notes: string | null;
  criticality: string | null;
  vendor: {
    id: string;
    identifier: string;
    name: string;
    status: string;
    category: string | null;
  };
}

interface RiskLink {
  id: string;
  notes: string | null;
  risk: {
    id: string;
    title: string;
    status: string;
    severity: string;
  };
}

interface PeopleDependency {
  id?: string;
  role: string;
  criticality: "HIGH" | "MEDIUM" | "LOW";
  notes?: string;
}

interface FacilityDependency {
  id?: string;
  name: string;
  location?: string;
  criticality: "HIGH" | "MEDIUM" | "LOW";
  notes?: string;
}

interface TransportDependency {
  id?: string;
  description: string;
  type?: string;
  criticality: "HIGH" | "MEDIUM" | "LOW";
  notes?: string;
}

const CRITICALITY_COLORS: Record<string, string> = {
  HIGH: "bg-red-100 text-red-800 border-red-200",
  MEDIUM: "bg-amber-100 text-amber-800 border-amber-200",
  LOW: "bg-green-100 text-green-800 border-green-200",
};

const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export function DependenciesTab({ processId, canEdit }: DependenciesTabProps) {
  const [dialogOpen, setDialogOpen] = useState<DependencyDialog>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Form states
  const [selectedProcessId, setSelectedProcessId] = useState("");
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [vendorCriticality, setVendorCriticality] = useState<"HIGH" | "MEDIUM" | "LOW">("MEDIUM");
  const [vendorNotes, setVendorNotes] = useState("");
  const [selectedRiskId, setSelectedRiskId] = useState("");
  const [riskNotes, setRiskNotes] = useState("");

  // Peak time form
  const [peakDescription, setPeakDescription] = useState("");
  const [peakDays, setPeakDays] = useState<string[]>([]);
  const [peakStartTime, setPeakStartTime] = useState("");
  const [peakEndTime, setPeakEndTime] = useState("");

  const utils = api.useUtils();

  // Query dependencies data
  const { data, isLoading, error } = api.biaDependency.getProcessDependencies.useQuery(
    { processId },
    { enabled: !!processId }
  );

  // Search queries (only when dialog is open)
  const { data: processResults } = api.biaDependency.searchProcesses.useQuery(
    { query: searchQuery, excludeProcessId: processId },
    { enabled: dialogOpen === "addUpstream" && searchQuery.length >= 2 }
  );

  const { data: vendorResults } = api.biaDependency.searchVendors.useQuery(
    { query: searchQuery, excludeProcessId: processId },
    { enabled: dialogOpen === "addVendor" && searchQuery.length >= 2 }
  );

  const { data: riskResults } = api.biaDependency.searchRisks.useQuery(
    { query: searchQuery, excludeProcessId: processId },
    { enabled: dialogOpen === "addRisk" && searchQuery.length >= 2 }
  );

  // Mutations
  const addUpstreamMutation = api.biaDependency.addUpstreamDependency.useMutation({
    onSuccess: () => {
      void utils.biaDependency.getProcessDependencies.invalidate({ processId });
      void utils.businessProcess.getById.invalidate({ id: processId });
      toast.success("Upstream dependency added");
      closeDialog();
    },
    onError: (error) => toast.error(error.message),
  });

  const removeDependencyMutation = api.biaDependency.removeDependency.useMutation({
    onSuccess: () => {
      void utils.biaDependency.getProcessDependencies.invalidate({ processId });
      void utils.businessProcess.getById.invalidate({ id: processId });
      toast.success("Dependency removed");
    },
    onError: (error) => toast.error(error.message),
  });

  const linkVendorMutation = api.biaDependency.linkVendor.useMutation({
    onSuccess: () => {
      void utils.biaDependency.getProcessDependencies.invalidate({ processId });
      void utils.businessProcess.getById.invalidate({ id: processId });
      toast.success("Vendor linked");
      closeDialog();
    },
    onError: (error) => toast.error(error.message),
  });

  const unlinkVendorMutation = api.biaDependency.unlinkVendor.useMutation({
    onSuccess: () => {
      void utils.biaDependency.getProcessDependencies.invalidate({ processId });
      void utils.businessProcess.getById.invalidate({ id: processId });
      toast.success("Vendor unlinked");
    },
    onError: (error) => toast.error(error.message),
  });

  const linkRiskMutation = api.biaDependency.linkRisk.useMutation({
    onSuccess: () => {
      void utils.biaDependency.getProcessDependencies.invalidate({ processId });
      void utils.businessProcess.getById.invalidate({ id: processId });
      toast.success("Risk linked");
      closeDialog();
    },
    onError: (error) => toast.error(error.message),
  });

  const unlinkRiskMutation = api.biaDependency.unlinkRisk.useMutation({
    onSuccess: () => {
      void utils.biaDependency.getProcessDependencies.invalidate({ processId });
      void utils.businessProcess.getById.invalidate({ id: processId });
      toast.success("Risk unlinked");
    },
    onError: (error) => toast.error(error.message),
  });

  const updatePeakTimeMutation = api.biaDependency.updatePeakTime.useMutation({
    onSuccess: () => {
      void utils.biaDependency.getProcessDependencies.invalidate({ processId });
      toast.success("Peak time information updated");
      closeDialog();
    },
    onError: (error) => toast.error(error.message),
  });

  const closeDialog = () => {
    setDialogOpen(null);
    setSearchQuery("");
    setSelectedProcessId("");
    setSelectedVendorId("");
    setVendorCriticality("MEDIUM");
    setVendorNotes("");
    setSelectedRiskId("");
    setRiskNotes("");
  };

  const openPeakTimeDialog = () => {
    if (data) {
      setPeakDescription(data.peakTime.description ?? "");
      setPeakDays(data.peakTime.days ?? []);
      setPeakStartTime(data.peakTime.startTime ?? "");
      setPeakEndTime(data.peakTime.endTime ?? "");
    }
    setDialogOpen("editPeakTime");
  };

  const handleSavePeakTime = () => {
    updatePeakTimeMutation.mutate({
      processId,
      description: peakDescription || null,
      days: peakDays.length > 0 ? peakDays : undefined,
      startTime: peakStartTime || null,
      endTime: peakEndTime || null,
    });
  };

  const togglePeakDay = (day: string) => {
    if (peakDays.includes(day)) {
      setPeakDays(peakDays.filter((d) => d !== day));
    } else {
      setPeakDays([...peakDays, day]);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <AlertTriangle className="h-12 w-12 mx-auto text-destructive mb-4" />
          <h3 className="text-lg font-medium mb-2">Error Loading Dependencies</h3>
          <p className="text-muted-foreground">{error.message}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  // Type cast the data properties
  const upstreamProcesses = data.upstreamProcesses as ProcessDependency[];
  const downstreamProcesses = data.downstreamProcesses as ProcessDependency[];
  const vendors = data.vendors as VendorLink[];
  const risks = data.risks as RiskLink[];
  const peopleDeps = data.peopleDependencies as PeopleDependency[];
  const facilitiesDeps = data.facilitiesDependencies as FacilityDependency[];
  const transportDeps = data.transportDependencies as TransportDependency[];
  const peakTime = data.peakTime;

  return (
    <>
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upstream Dependencies */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <GitMerge className="h-5 w-5" />
                    Upstream Dependencies
                  </CardTitle>
                  <CardDescription>Processes this depends on</CardDescription>
                </div>
                {canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDialogOpen("addUpstream")}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {upstreamProcesses.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No upstream dependencies defined
                </p>
              ) : (
                <ul className="space-y-2">
                  {upstreamProcesses.map((dep) => (
                    <li
                      key={dep.id}
                      className="flex items-center justify-between p-2 rounded bg-muted/50"
                    >
                      <div>
                        <Link
                          href={`/bia/processes/${dep.process.id}`}
                          className="text-primary hover:underline font-medium"
                        >
                          {dep.process.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {dep.process.identifier}
                        </p>
                      </div>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            removeDependencyMutation.mutate({ dependencyId: dep.id })
                          }
                          disabled={removeDependencyMutation.isPending}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Downstream Dependencies */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitMerge className="h-5 w-5 rotate-180" />
                Downstream Dependencies
              </CardTitle>
              <CardDescription>Processes that depend on this</CardDescription>
            </CardHeader>
            <CardContent>
              {downstreamProcesses.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No downstream dependencies
                </p>
              ) : (
                <ul className="space-y-2">
                  {downstreamProcesses.map((dep) => (
                    <li
                      key={dep.id}
                      className="flex items-center justify-between p-2 rounded bg-muted/50"
                    >
                      <div>
                        <Link
                          href={`/bia/processes/${dep.process.id}`}
                          className="text-primary hover:underline font-medium"
                        >
                          {dep.process.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {dep.process.identifier}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Vendor Links */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Vendor Dependencies
                  </CardTitle>
                  <CardDescription>Third-party vendors this process relies on</CardDescription>
                </div>
                {canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDialogOpen("addVendor")}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {vendors.length === 0 ? (
                <p className="text-muted-foreground text-sm">No vendors linked</p>
              ) : (
                <ul className="space-y-2">
                  {vendors.map((link) => (
                    <li
                      key={link.id}
                      className="flex items-center justify-between p-2 rounded bg-muted/50"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/vendors/${link.vendor.id}`}
                            className="text-primary hover:underline font-medium"
                          >
                            {link.vendor.name}
                          </Link>
                          {link.criticality && (
                            <Badge className={cn("text-xs", CRITICALITY_COLORS[link.criticality])}>
                              {link.criticality}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {link.vendor.identifier}
                        </p>
                        {link.notes && (
                          <p className="text-xs text-muted-foreground mt-1">{link.notes}</p>
                        )}
                      </div>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            unlinkVendorMutation.mutate({
                              linkId: link.id,
                            })
                          }
                          disabled={unlinkVendorMutation.isPending}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Risk Links */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5" />
                    Risk Linkages
                  </CardTitle>
                  <CardDescription>Risks associated with this process</CardDescription>
                </div>
                {canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDialogOpen("addRisk")}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {risks.length === 0 ? (
                <p className="text-muted-foreground text-sm">No risks linked</p>
              ) : (
                <ul className="space-y-2">
                  {risks.map((link) => (
                    <li
                      key={link.id}
                      className="flex items-center justify-between p-2 rounded bg-muted/50"
                    >
                      <div className="flex-1">
                        <Link
                          href={`/risks/${link.risk.id}`}
                          className="text-primary hover:underline font-medium"
                        >
                          {link.risk.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {link.risk.severity} severity
                        </p>
                        {link.notes && (
                          <p className="text-xs text-muted-foreground mt-1">{link.notes}</p>
                        )}
                      </div>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            unlinkRiskMutation.mutate({
                              linkId: link.id,
                            })
                          }
                          disabled={unlinkRiskMutation.isPending}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Resource Dependencies */}
        <Card>
          <CardHeader>
            <CardTitle>Resource Dependencies</CardTitle>
            <CardDescription>
              People, facilities, and transport dependencies
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  People Dependencies
                </div>
                {peopleDeps?.length ? (
                  <ul className="text-sm space-y-1">
                    {peopleDeps.map((dep, i) => (
                      <li key={i} className="flex items-center justify-between">
                        <span className="text-muted-foreground">{dep.role}</span>
                        <Badge className={cn("text-xs", CRITICALITY_COLORS[dep.criticality])}>
                          {dep.criticality}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">None defined</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  Facilities Dependencies
                </div>
                {facilitiesDeps?.length ? (
                  <ul className="text-sm space-y-1">
                    {facilitiesDeps.map((dep, i) => (
                      <li key={i} className="flex items-center justify-between">
                        <span className="text-muted-foreground">{dep.name}</span>
                        <Badge className={cn("text-xs", CRITICALITY_COLORS[dep.criticality])}>
                          {dep.criticality}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">None defined</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  Transport Dependencies
                </div>
                {transportDeps?.length ? (
                  <ul className="text-sm space-y-1">
                    {transportDeps.map((dep, i) => (
                      <li key={i} className="flex items-center justify-between">
                        <span className="text-muted-foreground">{dep.description}</span>
                        <Badge className={cn("text-xs", CRITICALITY_COLORS[dep.criticality])}>
                          {dep.criticality}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">None defined</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Peak Time */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Peak Time Information
                </CardTitle>
                <CardDescription>
                  When this process experiences highest demand
                </CardDescription>
              </div>
              {canEdit && (
                <Button variant="outline" size="sm" onClick={openPeakTimeDialog}>
                  <Edit2 className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium mb-2">Peak Days</h4>
                {peakTime.days?.length ? (
                  <div className="flex flex-wrap gap-1">
                    {peakTime.days.map((day: string, i: number) => (
                      <Badge key={i} variant="secondary">
                        {day}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Not defined</p>
                )}
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2">Peak Hours</h4>
                {peakTime.startTime || peakTime.endTime ? (
                  <p className="text-sm text-muted-foreground">
                    {peakTime.startTime || "?"} - {peakTime.endTime || "?"}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Not defined</p>
                )}
              </div>

              <div className="md:col-span-2">
                <h4 className="text-sm font-medium mb-2">Description</h4>
                {peakTime.description ? (
                  <p className="text-sm text-muted-foreground">{peakTime.description}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Not defined</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Upstream Dependency Dialog */}
      <Dialog open={dialogOpen === "addUpstream"} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Upstream Dependency</DialogTitle>
            <DialogDescription>
              Select a process that this process depends on
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search processes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {searchQuery.length >= 2 && (
              <div className="max-h-60 overflow-y-auto border rounded-md">
                {!processResults?.length ? (
                  <p className="p-4 text-sm text-muted-foreground text-center">
                    No processes found
                  </p>
                ) : (
                  <ul>
                    {processResults.map((proc) => (
                      <li
                        key={proc.id}
                        className={cn(
                          "p-3 cursor-pointer hover:bg-muted transition-colors border-b last:border-0",
                          selectedProcessId === proc.id && "bg-primary/10"
                        )}
                        onClick={() => setSelectedProcessId(proc.id)}
                      >
                        <div className="font-medium">{proc.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {proc.identifier}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                addUpstreamMutation.mutate({
                  processId,
                  upstreamProcessId: selectedProcessId,
                })
              }
              disabled={!selectedProcessId || addUpstreamMutation.isPending}
            >
              {addUpstreamMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Add Dependency
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Vendor Dialog */}
      <Dialog open={dialogOpen === "addVendor"} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Vendor</DialogTitle>
            <DialogDescription>
              Associate a vendor with this process
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search vendors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {searchQuery.length >= 2 && (
              <div className="max-h-40 overflow-y-auto border rounded-md">
                {!vendorResults?.length ? (
                  <p className="p-4 text-sm text-muted-foreground text-center">
                    No vendors found
                  </p>
                ) : (
                  <ul>
                    {vendorResults.map((vendor) => (
                      <li
                        key={vendor.id}
                        className={cn(
                          "p-3 cursor-pointer hover:bg-muted transition-colors border-b last:border-0",
                          selectedVendorId === vendor.id && "bg-primary/10"
                        )}
                        onClick={() => setSelectedVendorId(vendor.id)}
                      >
                        <div className="font-medium">{vendor.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {vendor.identifier}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {selectedVendorId && (
              <>
                <div className="space-y-2">
                  <Label>Criticality</Label>
                  <Select
                    value={vendorCriticality}
                    onValueChange={(v) => setVendorCriticality(v as "HIGH" | "MEDIUM" | "LOW")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HIGH">High</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="LOW">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Notes (optional)</Label>
                  <Textarea
                    placeholder="Notes about this vendor relationship..."
                    value={vendorNotes}
                    onChange={(e) => setVendorNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                linkVendorMutation.mutate({
                  processId,
                  vendorId: selectedVendorId,
                  criticality: vendorCriticality,
                  notes: vendorNotes || undefined,
                })
              }
              disabled={!selectedVendorId || linkVendorMutation.isPending}
            >
              {linkVendorMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Link Vendor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Risk Dialog */}
      <Dialog open={dialogOpen === "addRisk"} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Risk</DialogTitle>
            <DialogDescription>
              Associate a risk with this process
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search risks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {searchQuery.length >= 2 && (
              <div className="max-h-40 overflow-y-auto border rounded-md">
                {!riskResults?.length ? (
                  <p className="p-4 text-sm text-muted-foreground text-center">
                    No risks found
                  </p>
                ) : (
                  <ul>
                    {riskResults.map((risk) => (
                      <li
                        key={risk.id}
                        className={cn(
                          "p-3 cursor-pointer hover:bg-muted transition-colors border-b last:border-0",
                          selectedRiskId === risk.id && "bg-primary/10"
                        )}
                        onClick={() => setSelectedRiskId(risk.id)}
                      >
                        <div className="font-medium">{risk.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {risk.status} • {risk.severity}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {selectedRiskId && (
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea
                  placeholder="Notes about this risk relationship..."
                  value={riskNotes}
                  onChange={(e) => setRiskNotes(e.target.value)}
                  rows={3}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                linkRiskMutation.mutate({
                  processId,
                  riskId: selectedRiskId,
                  notes: riskNotes || undefined,
                })
              }
              disabled={!selectedRiskId || linkRiskMutation.isPending}
            >
              {linkRiskMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Link Risk
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Peak Time Dialog */}
      <Dialog open={dialogOpen === "editPeakTime"} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Peak Time Information</DialogTitle>
            <DialogDescription>
              Define when this process experiences highest demand
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Peak Days</Label>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((day) => (
                  <Button
                    key={day}
                    type="button"
                    variant={peakDays.includes(day) ? "default" : "outline"}
                    size="sm"
                    onClick={() => togglePeakDay(day)}
                  >
                    {day.slice(0, 3)}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={peakStartTime}
                  onChange={(e) => setPeakStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={peakEndTime}
                  onChange={(e) => setPeakEndTime(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Describe peak time patterns (e.g., 'Higher load during month-end reporting')"
                value={peakDescription}
                onChange={(e) => setPeakDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleSavePeakTime}
              disabled={updatePeakTimeMutation.isPending}
            >
              {updatePeakTimeMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Save Peak Time
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
