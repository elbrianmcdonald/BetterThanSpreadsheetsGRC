"use client";

/**
 * Framework Configuration Client Component
 *
 * Provides framework activation/deactivation with target completion dates.
 *
 * @see Story 2.5: Framework Activation and Configuration
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Settings,
  Loader2,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Shield,
  Target,
} from "lucide-react";

interface Framework {
  id: string;
  code: string;
  name: string;
  version: string;
  description: string | null;
  isActive: boolean;
  activatedAt: Date | null;
  targetCompletionDate: Date | null;
  controlCount?: number;
}

export function FrameworkConfigureClient() {
  const [activationDialog, setActivationDialog] = useState<{
    open: boolean;
    framework: Framework | null;
    action: "activate" | "deactivate";
  }>({ open: false, framework: null, action: "activate" });
  const [targetDate, setTargetDate] = useState<string>("");

  const utils = api.useUtils();

  // Fetch all frameworks
  const { data: frameworks, isLoading } = api.framework.list.useQuery({
    includeControlCount: true,
  });

  // Fetch active frameworks count
  const { data: activeFrameworks } = api.framework.listActive.useQuery();

  // Mutations
  const activateMutation = api.framework.activate.useMutation({
    onSuccess: () => {
      void utils.framework.list.invalidate();
      void utils.framework.listActive.invalidate();
      setActivationDialog({ open: false, framework: null, action: "activate" });
      setTargetDate("");
    },
  });

  const deactivateMutation = api.framework.deactivate.useMutation({
    onSuccess: () => {
      void utils.framework.list.invalidate();
      void utils.framework.listActive.invalidate();
      setActivationDialog({ open: false, framework: null, action: "deactivate" });
    },
  });

  // Check dependencies query (for deactivation warning)
  const { data: dependencies } = api.framework.checkDependencies.useQuery(
    { id: activationDialog.framework?.id ?? "" },
    { enabled: activationDialog.open && activationDialog.action === "deactivate" && !!activationDialog.framework }
  );

  const handleToggle = (framework: Framework) => {
    if (framework.isActive) {
      // Deactivate - show confirmation dialog
      setActivationDialog({ open: true, framework, action: "deactivate" });
    } else {
      // Activate - show target date dialog
      setActivationDialog({ open: true, framework, action: "activate" });
    }
  };

  const handleActivate = () => {
    if (!activationDialog.framework) return;

    const targetCompletionDate = targetDate ? new Date(targetDate) : undefined;

    activateMutation.mutate({
      id: activationDialog.framework.id,
      targetCompletionDate,
    });
  };

  const handleDeactivate = () => {
    if (!activationDialog.framework) return;

    deactivateMutation.mutate({
      id: activationDialog.framework.id,
      force: true,
    });
  };

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return "Not set";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Calculate minimum date (tomorrow)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split("T")[0];

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              href="/admin/frameworks"
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Frameworks
            </Link>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <Settings className="h-6 w-6" />
            Configure Frameworks
          </h1>
          <p className="mt-2 text-sm text-gray-700">
            Activate compliance frameworks and set target completion dates for your organization.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Frameworks</p>
                <p className="text-2xl font-semibold">{frameworks?.length ?? 0}</p>
              </div>
              <Shield className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Active Frameworks</p>
                <p className="text-2xl font-semibold text-green-600">
                  {activeFrameworks?.length ?? 0}
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Inactive Frameworks</p>
                <p className="text-2xl font-semibold text-gray-500">
                  {(frameworks?.length ?? 0) - (activeFrameworks?.length ?? 0)}
                </p>
              </div>
              <Shield className="h-8 w-8 text-gray-300" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Frameworks Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Framework Activation</CardTitle>
          <CardDescription>
            Toggle frameworks on or off to control which compliance programs your organization tracks.
            Setting a target completion date helps track your compliance timeline.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : frameworks?.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Shield className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-4 font-medium">No frameworks available</p>
              <p className="text-sm">Import an OSCAL catalog first to configure frameworks.</p>
              <Link href="/admin/frameworks">
                <Button className="mt-4" variant="outline">
                  Import Framework
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {frameworks?.map((framework) => (
                <div
                  key={framework.id}
                  className={`flex items-center justify-between p-4 border rounded-lg transition-colors ${
                    framework.isActive
                      ? "border-green-200 bg-green-50"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{framework.name}</h3>
                      <Badge variant="outline" className="font-mono text-xs">
                        {framework.code}
                      </Badge>
                      <span className="text-sm text-gray-500">v{framework.version}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
                      <span>{framework.controlCount ?? 0} controls</span>
                      {framework.isActive && framework.activatedAt && (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                          Activated {formatDate(framework.activatedAt)}
                        </span>
                      )}
                      {framework.isActive && framework.targetCompletionDate && (
                        <span className="flex items-center gap-1">
                          <Target className="h-3 w-3 text-blue-500" />
                          Target: {formatDate(framework.targetCompletionDate)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {framework.isActive && (
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                        Active
                      </Badge>
                    )}
                    <Switch
                      checked={framework.isActive}
                      onCheckedChange={() => handleToggle(framework as Framework)}
                      disabled={activateMutation.isPending || deactivateMutation.isPending}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activation/Deactivation Dialog */}
      <Dialog
        open={activationDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setActivationDialog({ open: false, framework: null, action: "activate" });
            setTargetDate("");
          }
        }}
      >
        <DialogContent>
          {activationDialog.action === "activate" ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  Activate Framework
                </DialogTitle>
                <DialogDescription>
                  Activate <strong>{activationDialog.framework?.name}</strong> to start tracking
                  compliance for this framework.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="targetDate" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Target Completion Date (Optional)
                  </Label>
                  <Input
                    id="targetDate"
                    type="date"
                    value={targetDate}
                    min={minDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                  />
                  <p className="text-sm text-gray-500">
                    Set a target date for when you aim to achieve compliance with this framework.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setActivationDialog({ open: false, framework: null, action: "activate" })}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleActivate}
                  disabled={activateMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {activateMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Activating...
                    </>
                  ) : (
                    "Activate Framework"
                  )}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  Deactivate Framework
                </DialogTitle>
                <DialogDescription>
                  Are you sure you want to deactivate <strong>{activationDialog.framework?.name}</strong>?
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                {dependencies?.hasDependencies ? (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center gap-2 text-yellow-800 font-medium mb-2">
                      <AlertTriangle className="h-4 w-4" />
                      Warning: This framework has dependencies
                    </div>
                    <ul className="text-sm text-yellow-700 list-disc list-inside">
                      {dependencies.evidenceCount > 0 && (
                        <li>{dependencies.evidenceCount} evidence items reference this framework</li>
                      )}
                      {dependencies.riskCount > 0 && (
                        <li>{dependencies.riskCount} risks are linked to this framework</li>
                      )}
                    </ul>
                    <p className="mt-2 text-sm text-yellow-700">
                      Deactivating will hide this framework from dropdowns but preserve existing data.
                    </p>
                  </div>
                ) : (
                  <p className="text-gray-600">
                    Deactivating this framework will hide it from compliance tracking views.
                    You can reactivate it at any time.
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setActivationDialog({ open: false, framework: null, action: "deactivate" })}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeactivate}
                  disabled={deactivateMutation.isPending}
                >
                  {deactivateMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deactivating...
                    </>
                  ) : (
                    "Deactivate Framework"
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
