"use client";

/**
 * Standard Detail Client Component
 *
 * Displays standard details with controls, mappings, and exceptions management.
 */

import { useState, useCallback, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import {
  ArrowLeft,
  Plus,
  Loader2,
  Shield,
  Calendar,
  User,
  Edit,
  Trash2,
  Link as LinkIcon,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  MoreVertical,
  ChevronDown,
  ChevronRight,
  Upload,
} from "lucide-react";
import {
  UserRole,
  StandardStatus,
  StandardControlCriticality,
  StandardMappingType,
  ControlExceptionStatus,
} from "@prisma/client";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Select,
  SelectContent,
  SelectItem,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { BulkControlUpload } from "@/components/standards/BulkControlUpload";

/** Roles that can manage standards */
const CAN_MANAGE_STANDARD_ROLES: UserRole[] = [
  UserRole.MANAGER,
  UserRole.ANALYST,
  UserRole.ADMINISTRATOR,
];

/** Status badge configuration */
const statusConfig: Record<StandardStatus, { color: string; label: string }> = {
  DRAFT: { color: "bg-slate-100 text-slate-700 border-slate-200", label: "Draft" },
  ACTIVE: { color: "bg-green-100 text-green-700 border-green-200", label: "Active" },
  DEPRECATED: { color: "bg-amber-100 text-amber-700 border-amber-200", label: "Deprecated" },
};

/** Criticality badge configuration */
const criticalityConfig: Record<StandardControlCriticality, { color: string; label: string }> = {
  HIGH: { color: "bg-red-100 text-red-700 border-red-200", label: "High" },
  MEDIUM: { color: "bg-amber-100 text-amber-700 border-amber-200", label: "Medium" },
  LOW: { color: "bg-blue-100 text-blue-700 border-blue-200", label: "Low" },
};

/** Mapping type configuration */
const mappingTypeConfig: Record<StandardMappingType, { color: string; label: string }> = {
  EQUIVALENT: { color: "bg-green-100 text-green-700", label: "Equivalent" },
  SUBSET_OF: { color: "bg-purple-100 text-purple-700", label: "Subset of" },
  SUPERSET_OF: { color: "bg-blue-100 text-blue-700", label: "Superset of" },
  INTERSECTS: { color: "bg-amber-100 text-amber-700", label: "Intersects" },
};

/** Exception status configuration */
const exceptionStatusConfig: Record<ControlExceptionStatus, { color: string; label: string; icon: typeof Clock }> = {
  PENDING: { color: "bg-amber-100 text-amber-700", label: "Pending", icon: Clock },
  APPROVED: { color: "bg-green-100 text-green-700", label: "Approved", icon: CheckCircle },
  DENIED: { color: "bg-red-100 text-red-700", label: "Denied", icon: AlertTriangle },
  EXPIRED: { color: "bg-slate-100 text-slate-700", label: "Expired", icon: Clock },
};

export function StandardDetailClient() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const utils = api.useUtils();

  const standardId = params.id as string;

  // Track client-side mount
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [addControlDialogOpen, setAddControlDialogOpen] = useState(false);
  const [bulkUploadDialogOpen, setBulkUploadDialogOpen] = useState(false);
  const [editControlId, setEditControlId] = useState<string | null>(null);
  const [deleteControlId, setDeleteControlId] = useState<string | null>(null);
  const [addMappingDialogOpen, setAddMappingDialogOpen] = useState(false);
  const [mappingControlId, setMappingControlId] = useState<string | null>(null);
  const [deleteMappingId, setDeleteMappingId] = useState<string | null>(null);

  // Form states
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    status: "DRAFT" as StandardStatus,
    effectiveDate: "",
    reviewCycleMonths: 12,
    ownerId: "",
  });

  const [controlForm, setControlForm] = useState({
    code: "",
    title: "",
    description: "",
    criticality: "MEDIUM" as StandardControlCriticality,
  });

  const [mappingForm, setMappingForm] = useState({
    frameworkId: "",
    controlId: "",
    mappingType: "EQUIVALENT" as StandardMappingType,
    notes: "",
  });

  // Check permissions
  const userRole = session?.user?.role as UserRole | undefined;
  const canManage = userRole && CAN_MANAGE_STANDARD_ROLES.includes(userRole);

  // Fetch standard details
  const { data: standard, isLoading, error } = api.standard.getById.useQuery(
    { id: standardId },
    { enabled: !!standardId }
  );

  // Fetch users for owner selection
  const { data: users } = api.user.listUsers.useQuery(
    { skip: 0, take: 100 },
    { enabled: editDialogOpen }
  );

  // Fetch frameworks for mapping
  const { data: frameworks } = api.framework.list.useQuery(
    { isActive: true },
    { enabled: addMappingDialogOpen }
  );

  // Fetch controls for selected framework
  const { data: frameworkControls } = api.framework.getControls.useQuery(
    { frameworkId: mappingForm.frameworkId, pageSize: 100, topLevelOnly: false },
    { enabled: addMappingDialogOpen && !!mappingForm.frameworkId }
  );

  // Mutations
  const updateMutation = api.standard.update.useMutation({
    onSuccess: () => {
      toast.success("Standard updated successfully");
      setEditDialogOpen(false);
      void utils.standard.getById.invalidate({ id: standardId });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update standard");
    },
  });

  const deleteMutation = api.standard.delete.useMutation({
    onSuccess: () => {
      toast.success("Standard deleted successfully");
      router.push("/standards");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete standard");
    },
  });

  const createControlMutation = api.standard.createControl.useMutation({
    onSuccess: () => {
      toast.success("Control added successfully");
      setAddControlDialogOpen(false);
      setControlForm({ code: "", title: "", description: "", criticality: "MEDIUM" });
      void utils.standard.getById.invalidate({ id: standardId });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to add control");
    },
  });

  const updateControlMutation = api.standard.updateControl.useMutation({
    onSuccess: () => {
      toast.success("Control updated successfully");
      setEditControlId(null);
      void utils.standard.getById.invalidate({ id: standardId });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update control");
    },
  });

  const deleteControlMutation = api.standard.deleteControl.useMutation({
    onSuccess: () => {
      toast.success("Control deleted successfully");
      setDeleteControlId(null);
      void utils.standard.getById.invalidate({ id: standardId });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete control");
    },
  });

  const createMappingMutation = api.standard.createMapping.useMutation({
    onSuccess: () => {
      toast.success("Framework mapping created successfully");
      setAddMappingDialogOpen(false);
      setMappingControlId(null);
      setMappingForm({ frameworkId: "", controlId: "", mappingType: "EQUIVALENT", notes: "" });
      void utils.standard.getById.invalidate({ id: standardId });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create mapping");
    },
  });

  const deleteMappingMutation = api.standard.deleteMapping.useMutation({
    onSuccess: () => {
      toast.success("Framework mapping deleted successfully");
      setDeleteMappingId(null);
      void utils.standard.getById.invalidate({ id: standardId });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete mapping");
    },
  });

  // Initialize edit form when standard loads
  useEffect(() => {
    if (standard) {
      setEditForm({
        title: standard.title,
        description: standard.description,
        status: standard.status,
        effectiveDate: format(new Date(standard.effectiveDate), "yyyy-MM-dd"),
        reviewCycleMonths: standard.reviewCycleMonths,
        ownerId: standard.ownerId || "",
      });
    }
  }, [standard]);

  // Handlers
  const handleEditSubmit = useCallback(() => {
    updateMutation.mutate({
      id: standardId,
      title: editForm.title,
      description: editForm.description,
      status: editForm.status,
      effectiveDate: new Date(editForm.effectiveDate),
      reviewCycleMonths: editForm.reviewCycleMonths,
      ownerId: editForm.ownerId || null,
    });
  }, [standardId, editForm, updateMutation]);

  const handleDeleteSubmit = useCallback(() => {
    deleteMutation.mutate({ id: standardId });
  }, [standardId, deleteMutation]);

  const handleAddControl = useCallback(() => {
    if (!controlForm.code.trim() || !controlForm.title.trim()) {
      toast.error("Code and title are required");
      return;
    }
    createControlMutation.mutate({
      standardId,
      code: controlForm.code.trim(),
      title: controlForm.title.trim(),
      description: controlForm.description.trim() || null,
      criticality: controlForm.criticality,
    });
  }, [standardId, controlForm, createControlMutation]);

  const handleEditControl = useCallback((controlId: string) => {
    const control = standard?.Controls.find((c) => c.id === controlId);
    if (control) {
      setControlForm({
        code: control.code,
        title: control.title,
        description: control.description || "",
        criticality: control.criticality,
      });
      setEditControlId(controlId);
    }
  }, [standard]);

  const handleUpdateControl = useCallback(() => {
    if (!editControlId) return;
    updateControlMutation.mutate({
      id: editControlId,
      code: controlForm.code.trim(),
      title: controlForm.title.trim(),
      description: controlForm.description.trim() || null,
      criticality: controlForm.criticality,
    });
  }, [editControlId, controlForm, updateControlMutation]);

  const handleDeleteControl = useCallback(() => {
    if (!deleteControlId) return;
    deleteControlMutation.mutate({ id: deleteControlId });
  }, [deleteControlId, deleteControlMutation]);

  const handleOpenMappingDialog = useCallback((controlId: string) => {
    setMappingControlId(controlId);
    setMappingForm({ frameworkId: "", controlId: "", mappingType: "EQUIVALENT", notes: "" });
    setAddMappingDialogOpen(true);
  }, []);

  const handleCreateMapping = useCallback(() => {
    if (!mappingControlId || !mappingForm.controlId) {
      toast.error("Please select a framework control");
      return;
    }
    createMappingMutation.mutate({
      standardControlId: mappingControlId,
      controlId: mappingForm.controlId,
      mappingType: mappingForm.mappingType,
      notes: mappingForm.notes || null,
    });
  }, [mappingControlId, mappingForm, createMappingMutation]);

  const handleDeleteMapping = useCallback(() => {
    if (!deleteMappingId) return;
    deleteMappingMutation.mutate({ id: deleteMappingId });
  }, [deleteMappingId, deleteMappingMutation]);

  // Loading state
  if (!isMounted || sessionStatus === "loading" || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Error state
  if (error || !standard) {
    return (
      <AppLayout breadcrumbs={[{ label: "Standards", href: "/standards" }, { label: "Not Found" }]}>
        <div className="container mx-auto px-4 py-8">
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Standard Not Found</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                {error?.message || "The requested standard could not be found."}
              </p>
              <Button variant="outline" className="mt-4" onClick={() => router.push("/standards")}>
                Back to Standards
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const statusCfg = statusConfig[standard.status];

  return (
    <AppLayout
      breadcrumbs={[
        { label: "Standards", href: "/standards" },
        { label: standard.title },
      ]}
    >
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Back Button */}
        <Button variant="ghost" size="sm" onClick={() => router.push("/standards")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Standards
        </Button>

        {/* Header Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-2xl">{standard.title}</CardTitle>
                    <Badge variant="outline" className={statusCfg.color}>
                      {statusCfg.label}
                    </Badge>
                  </div>
                  <CardDescription className="mt-2 max-w-2xl">
                    {standard.description}
                  </CardDescription>
                </div>
              </div>
              {canManage && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => setEditDialogOpen(true)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDeleteDialogOpen(true)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Standard
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Effective Date</p>
                  <p className="font-medium">{format(new Date(standard.effectiveDate), "MMM d, yyyy")}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Review Cycle</p>
                  <p className="font-medium">{standard.reviewCycleMonths} months</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Owner</p>
                  <p className="font-medium">
                    {standard.Owner?.name || standard.Owner?.email || "Unassigned"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Version</p>
                  <p className="font-medium">v{standard.version}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs for Controls & Mappings */}
        <Tabs defaultValue="controls" className="space-y-4">
          <TabsList>
            <TabsTrigger value="controls">
              <FileText className="h-4 w-4 mr-2" />
              Controls ({standard.Controls.length})
            </TabsTrigger>
            <TabsTrigger value="mappings">
              <LinkIcon className="h-4 w-4 mr-2" />
              Framework Mappings
            </TabsTrigger>
            <TabsTrigger value="exceptions">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Exceptions
            </TabsTrigger>
          </TabsList>

          {/* Controls Tab */}
          <TabsContent value="controls">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Standard Controls</CardTitle>
                    <CardDescription>
                      Specific requirements and controls within this standard
                    </CardDescription>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-2">
                      <Button variant="outline" onClick={() => setBulkUploadDialogOpen(true)}>
                        <Upload className="h-4 w-4 mr-2" />
                        Bulk Upload
                      </Button>
                      <Button onClick={() => setAddControlDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Control
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {standard.Controls.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No controls defined yet</p>
                    {canManage && (
                      <Button className="mt-4" onClick={() => setAddControlDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add First Control
                      </Button>
                    )}
                  </div>
                ) : (
                  <Accordion type="multiple" className="space-y-2">
                    {standard.Controls.map((control) => {
                      const critCfg = criticalityConfig[control.criticality];
                      return (
                        <AccordionItem key={control.id} value={control.id} className="border rounded-lg px-4">
                          <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-center gap-4 text-left">
                              <Badge variant="outline" className="font-mono">
                                {control.code}
                              </Badge>
                              <span className="font-medium">{control.title}</span>
                              <Badge variant="outline" className={critCfg.color}>
                                {critCfg.label}
                              </Badge>
                              {control.FrameworkMappings.length > 0 && (
                                <Badge variant="secondary">
                                  {control.FrameworkMappings.length} mapping{control.FrameworkMappings.length !== 1 ? "s" : ""}
                                </Badge>
                              )}
                              {control.Exceptions.length > 0 && (
                                <Badge variant="outline" className="bg-amber-50 text-amber-700">
                                  {control.Exceptions.length} exception{control.Exceptions.length !== 1 ? "s" : ""}
                                </Badge>
                              )}
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="pt-4 space-y-4">
                              {control.description && (
                                <p className="text-muted-foreground">{control.description}</p>
                              )}

                              {/* Framework Mappings */}
                              {control.FrameworkMappings.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-medium mb-2">Framework Mappings</h4>
                                  <div className="flex flex-wrap gap-2">
                                    {control.FrameworkMappings.map((mapping) => (
                                      <Badge key={mapping.id} variant="outline" className="gap-1 pr-1">
                                        <span className="font-mono text-xs">
                                          {mapping.FrameworkControl.Framework.code}
                                        </span>
                                        <span>{mapping.FrameworkControl.controlId}</span>
                                        <Badge className={`ml-1 text-xs ${mappingTypeConfig[mapping.mappingType].color}`}>
                                          {mappingTypeConfig[mapping.mappingType].label}
                                        </Badge>
                                        {canManage && (
                                          <button
                                            className="ml-1 p-0.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setDeleteMappingId(mapping.id);
                                            }}
                                            title="Delete mapping"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </button>
                                        )}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Actions */}
                              {canManage && (
                                <div className="flex items-center gap-2 pt-2 border-t">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEditControl(control.id)}
                                  >
                                    <Edit className="h-3 w-3 mr-1" />
                                    Edit
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleOpenMappingDialog(control.id)}
                                  >
                                    <LinkIcon className="h-3 w-3 mr-1" />
                                    Add Mapping
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => setDeleteControlId(control.id)}
                                  >
                                    <Trash2 className="h-3 w-3 mr-1" />
                                    Delete
                                  </Button>
                                </div>
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Mappings Tab */}
          <TabsContent value="mappings">
            <Card>
              <CardHeader>
                <CardTitle>Framework Mappings</CardTitle>
                <CardDescription>
                  How standard controls map to framework controls
                </CardDescription>
              </CardHeader>
              <CardContent>
                {standard.Controls.every((c) => c.FrameworkMappings.length === 0) ? (
                  <div className="text-center py-8">
                    <LinkIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No framework mappings yet</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Map standard controls to framework controls to track coverage
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Standard Control</TableHead>
                        <TableHead>Framework</TableHead>
                        <TableHead>Framework Control</TableHead>
                        <TableHead>Mapping Type</TableHead>
                        <TableHead>Notes</TableHead>
                        {canManage && <TableHead className="w-16">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {standard.Controls.flatMap((control) =>
                        control.FrameworkMappings.map((mapping) => (
                          <TableRow key={mapping.id}>
                            <TableCell>
                              <Badge variant="outline" className="font-mono">
                                {control.code}
                              </Badge>
                              <span className="ml-2 text-sm">{control.title}</span>
                            </TableCell>
                            <TableCell>{mapping.FrameworkControl.Framework.name}</TableCell>
                            <TableCell>
                              <span className="font-mono text-sm">
                                {mapping.FrameworkControl.controlId}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge className={mappingTypeConfig[mapping.mappingType].color}>
                                {mappingTypeConfig[mapping.mappingType].label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {mapping.notes || "-"}
                            </TableCell>
                            {canManage && (
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  onClick={() => setDeleteMappingId(mapping.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Exceptions Tab */}
          <TabsContent value="exceptions">
            <Card>
              <CardHeader>
                <CardTitle>Control Exceptions</CardTitle>
                <CardDescription>
                  Time-bound exemptions from standard controls
                </CardDescription>
              </CardHeader>
              <CardContent>
                {standard.Controls.every((c) => c.Exceptions.length === 0) ? (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                    <p className="font-medium">No Active Exceptions</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      All controls are being followed without exceptions
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Control</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Requested By</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead>Justification</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {standard.Controls.flatMap((control) =>
                        control.Exceptions.map((exception) => {
                          const excCfg = exceptionStatusConfig[exception.status];
                          const ExcIcon = excCfg.icon;
                          return (
                            <TableRow key={exception.id}>
                              <TableCell>
                                <Badge variant="outline" className="font-mono">
                                  {control.code}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge className={excCfg.color}>
                                  <ExcIcon className="h-3 w-3 mr-1" />
                                  {excCfg.label}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {exception.RequestedBy?.name || exception.RequestedBy?.email}
                              </TableCell>
                              <TableCell>
                                {format(new Date(exception.expiresAt), "MMM d, yyyy")}
                              </TableCell>
                              <TableCell className="max-w-xs truncate text-sm">
                                {exception.justification}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit Standard Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Edit Standard</DialogTitle>
              <DialogDescription>Update the standard details</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  value={editForm.title}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  rows={4}
                  value={editForm.description}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-status">Status</Label>
                  <Select
                    value={editForm.status}
                    onValueChange={(value) => setEditForm((prev) => ({ ...prev, status: value as StandardStatus }))}
                  >
                    <SelectTrigger id="edit-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DRAFT">Draft</SelectItem>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="DEPRECATED">Deprecated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-effective">Effective Date</Label>
                  <Input
                    id="edit-effective"
                    type="date"
                    value={editForm.effectiveDate}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, effectiveDate: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-review">Review Cycle</Label>
                  <Select
                    value={String(editForm.reviewCycleMonths)}
                    onValueChange={(value) => setEditForm((prev) => ({ ...prev, reviewCycleMonths: parseInt(value) }))}
                  >
                    <SelectTrigger id="edit-review">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="6">6 months</SelectItem>
                      <SelectItem value="12">12 months</SelectItem>
                      <SelectItem value="24">24 months</SelectItem>
                      <SelectItem value="36">36 months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-owner">Owner</Label>
                  <Select
                    value={editForm.ownerId}
                    onValueChange={(value) => setEditForm((prev) => ({ ...prev, ownerId: value }))}
                  >
                    <SelectTrigger id="edit-owner">
                      <SelectValue placeholder="Select owner" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Unassigned</SelectItem>
                      {users?.users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name || user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={updateMutation.isPending}>
                Cancel
              </Button>
              <Button onClick={handleEditSubmit} disabled={updateMutation.isPending}>
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

        {/* Delete Standard Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Standard?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete &quot;{standard.title}&quot; and all its controls,
                mappings, and exceptions. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleDeleteSubmit}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete Standard"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Add Control Dialog */}
        <Dialog open={addControlDialogOpen} onOpenChange={setAddControlDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Control</DialogTitle>
              <DialogDescription>Add a new control to this standard</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="control-code">Code *</Label>
                  <Input
                    id="control-code"
                    placeholder="e.g., SEC-001"
                    value={controlForm.code}
                    onChange={(e) => setControlForm((prev) => ({ ...prev, code: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="control-criticality">Criticality</Label>
                  <Select
                    value={controlForm.criticality}
                    onValueChange={(value) => setControlForm((prev) => ({ ...prev, criticality: value as StandardControlCriticality }))}
                  >
                    <SelectTrigger id="control-criticality">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HIGH">High</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="LOW">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="control-title">Title *</Label>
                <Input
                  id="control-title"
                  placeholder="Control title"
                  value={controlForm.title}
                  onChange={(e) => setControlForm((prev) => ({ ...prev, title: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="control-description">Description</Label>
                <Textarea
                  id="control-description"
                  rows={3}
                  placeholder="Describe the control requirement..."
                  value={controlForm.description}
                  onChange={(e) => setControlForm((prev) => ({ ...prev, description: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddControlDialogOpen(false)} disabled={createControlMutation.isPending}>
                Cancel
              </Button>
              <Button onClick={handleAddControl} disabled={createControlMutation.isPending}>
                {createControlMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add Control"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Control Dialog */}
        <Dialog open={!!editControlId} onOpenChange={(open) => !open && setEditControlId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Control</DialogTitle>
              <DialogDescription>Update the control details</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-control-code">Code *</Label>
                  <Input
                    id="edit-control-code"
                    value={controlForm.code}
                    onChange={(e) => setControlForm((prev) => ({ ...prev, code: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-control-criticality">Criticality</Label>
                  <Select
                    value={controlForm.criticality}
                    onValueChange={(value) => setControlForm((prev) => ({ ...prev, criticality: value as StandardControlCriticality }))}
                  >
                    <SelectTrigger id="edit-control-criticality">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HIGH">High</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="LOW">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-control-title">Title *</Label>
                <Input
                  id="edit-control-title"
                  value={controlForm.title}
                  onChange={(e) => setControlForm((prev) => ({ ...prev, title: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-control-description">Description</Label>
                <Textarea
                  id="edit-control-description"
                  rows={3}
                  value={controlForm.description}
                  onChange={(e) => setControlForm((prev) => ({ ...prev, description: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditControlId(null)} disabled={updateControlMutation.isPending}>
                Cancel
              </Button>
              <Button onClick={handleUpdateControl} disabled={updateControlMutation.isPending}>
                {updateControlMutation.isPending ? (
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

        {/* Delete Control Dialog */}
        <AlertDialog open={!!deleteControlId} onOpenChange={(open) => !open && setDeleteControlId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Control?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this control and all its mappings and exceptions.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteControlMutation.isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleDeleteControl}
                disabled={deleteControlMutation.isPending}
              >
                {deleteControlMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete Control"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Add Mapping Dialog */}
        <Dialog open={addMappingDialogOpen} onOpenChange={(open) => {
          if (!open) {
            setAddMappingDialogOpen(false);
            setMappingControlId(null);
            setMappingForm({ frameworkId: "", controlId: "", mappingType: "EQUIVALENT", notes: "" });
          }
        }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Framework Mapping</DialogTitle>
              <DialogDescription>
                Map this standard control to a framework control to track coverage.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="mapping-framework">Framework *</Label>
                <Select
                  value={mappingForm.frameworkId}
                  onValueChange={(value) => setMappingForm((prev) => ({ ...prev, frameworkId: value, controlId: "" }))}
                >
                  <SelectTrigger id="mapping-framework">
                    <SelectValue placeholder="Select a framework" />
                  </SelectTrigger>
                  <SelectContent>
                    {frameworks?.map((fw) => (
                      <SelectItem key={fw.id} value={fw.id}>
                        {fw.code} - {fw.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="mapping-control">Framework Control *</Label>
                <Select
                  value={mappingForm.controlId}
                  onValueChange={(value) => setMappingForm((prev) => ({ ...prev, controlId: value }))}
                  disabled={!mappingForm.frameworkId}
                >
                  <SelectTrigger id="mapping-control">
                    <SelectValue placeholder={mappingForm.frameworkId ? "Select a control" : "Select a framework first"} />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {frameworkControls?.controls?.map((ctrl) => (
                      <SelectItem key={ctrl.id} value={ctrl.id}>
                        <span className="font-mono">{ctrl.controlId}</span>
                        <span className="ml-2 text-muted-foreground truncate">{(ctrl.title ?? "").slice(0, 50)}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="mapping-type">Mapping Type</Label>
                <Select
                  value={mappingForm.mappingType}
                  onValueChange={(value) => setMappingForm((prev) => ({ ...prev, mappingType: value as StandardMappingType }))}
                >
                  <SelectTrigger id="mapping-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EQUIVALENT">Equivalent - Functionally the same</SelectItem>
                    <SelectItem value="SUBSET_OF">Subset of - Narrower than the requirement</SelectItem>
                    <SelectItem value="SUPERSET_OF">Superset of - Goes beyond the requirement</SelectItem>
                    <SelectItem value="INTERSECTS">Intersects - Partial overlap</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="mapping-notes">Notes (optional)</Label>
                <Textarea
                  id="mapping-notes"
                  placeholder="Additional context about this mapping..."
                  value={mappingForm.notes}
                  onChange={(e) => setMappingForm((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddMappingDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateMapping}
                disabled={!mappingForm.controlId || createMappingMutation.isPending}
              >
                {createMappingMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <LinkIcon className="h-4 w-4 mr-2" />
                    Create Mapping
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Upload Dialog */}
        <BulkControlUpload
          standardId={standardId}
          open={bulkUploadDialogOpen}
          onOpenChange={setBulkUploadDialogOpen}
          onSuccess={() => {
            void utils.standard.getById.invalidate({ id: standardId });
          }}
        />

        {/* Delete Mapping Dialog */}
        <AlertDialog open={!!deleteMappingId} onOpenChange={(open) => !open && setDeleteMappingId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Framework Mapping?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove this framework mapping from the standard control.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteMappingMutation.isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleDeleteMapping}
                disabled={deleteMappingMutation.isPending}
              >
                {deleteMappingMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete Mapping"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
