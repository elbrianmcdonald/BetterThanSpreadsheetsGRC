"use client";

/**
 * Risk Controls Section Component
 *
 * Provides a picker-based interface for managing organizational controls
 * linked to a risk. Replaces the old text-based ControlsDocumentation.
 *
 * Features:
 * - Two sections: "Controls in Place" and "Controls Needed"
 * - Inline control creation (quick create or advanced dialog)
 * - Framework control mapping for compliance tracking
 * - Multi-select support with badges showing control type and framework
 *
 * @see RiskOrganizationalControl model for the join table
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import {
  Shield,
  ShieldCheck,
  ShieldPlus,
  ChevronDown,
  ChevronRight,
  Plus,
  X,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { OrgControlType, RiskOrgControlRole } from "@prisma/client";

import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreatableControlPicker, type CreatableControlPickerProps } from "@/components/control/CreatableControlPicker";

interface ControlLink {
  id?: string; // undefined for new links not yet saved
  organizationalControlId: string;
  role: RiskOrgControlRole;
  notes?: string | null;
  OrganizationalControl: {
    id: string;
    name: string;
    controlType: OrgControlType;
    FrameworkControl?: {
      id: string;
      controlId: string;
      title: string;
      Framework: {
        id: string;
        code: string;
      };
    } | null;
  };
}

interface RiskControlsSectionProps {
  /** Risk ID for existing risks (enables direct API calls) */
  riskId?: string;
  /** For new risks: callback when controls change */
  onControlsChange?: (controls: { inPlace: string[]; needed: string[] }) => void;
  /** Initial control IDs for new risks */
  initialControlsInPlace?: string[];
  initialControlsNeeded?: string[];
  /** Whether the section is read-only */
  isReadOnly?: boolean;
  /** Whether the section starts expanded */
  defaultExpanded?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays a single linked control with remove button
 */
function ControlChip({
  control,
  onRemove,
  isRemoving,
  isReadOnly,
}: {
  control: ControlLink["OrganizationalControl"];
  onRemove?: () => void;
  isRemoving?: boolean;
  isReadOnly?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 bg-background border rounded-md px-3 py-2 group">
      <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="flex-1 text-sm truncate">{control.name}</span>
      <div className="flex items-center gap-1.5 shrink-0">
        <Badge
          variant="secondary"
          className={cn(
            "text-xs",
            control.controlType === OrgControlType.PREVENTATIVE
              ? "bg-blue-100 text-blue-700"
              : "bg-purple-100 text-purple-700"
          )}
        >
          {control.controlType === OrgControlType.PREVENTATIVE ? "Preventative" : "Mitigating"}
        </Badge>
        {control.FrameworkControl && (
          <Badge variant="outline" className="text-xs">
            {control.FrameworkControl.Framework.code}:{" "}
            {control.FrameworkControl.controlId}
          </Badge>
        )}
        {!isReadOnly && onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={onRemove}
            disabled={isRemoving}
          >
            {isRemoving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <X className="h-3.5 w-3.5" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Section for a specific role (IN_PLACE or NEEDED)
 */
function ControlRoleSection({
  title,
  description,
  role,
  icon: Icon,
  bgColor,
  controls,
  onAddControl,
  onRemoveControl,
  isAddingControl,
  removingControlId,
  excludeIds,
  isReadOnly,
  defaultControlType,
}: {
  title: string;
  description: string;
  role: RiskOrgControlRole;
  icon: React.ComponentType<{ className?: string }>;
  bgColor: string;
  controls: ControlLink[];
  onAddControl: (controlId: string, control: NonNullable<Parameters<CreatableControlPickerProps["onChange"]>[1]>) => void;
  onRemoveControl: (controlId: string) => void;
  isAddingControl: boolean;
  removingControlId: string | null;
  excludeIds: string[];
  isReadOnly?: boolean;
  defaultControlType: OrgControlType;
}) {
  const [pickerValue, setPickerValue] = useState<string | null>(null);

  const handlePickerChange = useCallback(
    (value: string | null, control?: NonNullable<Parameters<CreatableControlPickerProps["onChange"]>[1]>) => {
      if (value && control) {
        onAddControl(value, control);
        setPickerValue(null); // Reset picker after selection
      }
    },
    [onAddControl]
  );

  return (
    <Card className={bgColor}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <p className="text-sm font-medium">{title}</p>
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>

        {/* Existing controls */}
        {controls.length > 0 && (
          <div className="space-y-2">
            {controls.map((link) => (
              <ControlChip
                key={link.organizationalControlId}
                control={link.OrganizationalControl}
                onRemove={() => onRemoveControl(link.organizationalControlId)}
                isRemoving={removingControlId === link.organizationalControlId}
                isReadOnly={isReadOnly}
              />
            ))}
          </div>
        )}

        {/* Add control picker */}
        {!isReadOnly && (
          <div className="pt-2">
            <CreatableControlPicker
              value={pickerValue}
              onChange={handlePickerChange}
              placeholder={`Add ${role === RiskOrgControlRole.IN_PLACE ? "existing" : "needed"} control...`}
              excludeIds={excludeIds}
              defaultControlType={defaultControlType}
              disabled={isAddingControl}
            />
          </div>
        )}

        {controls.length === 0 && isReadOnly && (
          <p className="text-sm text-muted-foreground italic">No controls documented</p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Risk Controls Section - manages organizational controls linked to a risk
 */
export function RiskControlsSection({
  riskId,
  onControlsChange,
  initialControlsInPlace = [],
  initialControlsNeeded = [],
  isReadOnly = false,
  defaultExpanded = false,
  className,
}: RiskControlsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [removingControlId, setRemovingControlId] = useState<string | null>(null);

  // Local state for new risks (no riskId yet)
  const [localControlsInPlace, setLocalControlsInPlace] = useState<ControlLink[]>([]);
  const [localControlsNeeded, setLocalControlsNeeded] = useState<ControlLink[]>([]);

  const utils = api.useUtils();

  // Fetch linked controls for existing risks
  const { data: linkedControls, isLoading: isLoadingControls } = api.organizationalControl.getForRisk.useQuery(
    { riskId: riskId! },
    { enabled: !!riskId }
  );

  // Link control mutation
  const linkMutation = api.organizationalControl.linkToRisk.useMutation({
    onSuccess: () => {
      void utils.organizationalControl.getForRisk.invalidate({ riskId: riskId! });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to link control");
    },
  });

  // Unlink control mutation
  const unlinkMutation = api.organizationalControl.unlinkFromRisk.useMutation({
    onSuccess: () => {
      void utils.organizationalControl.getForRisk.invalidate({ riskId: riskId! });
      setRemovingControlId(null);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to remove control");
      setRemovingControlId(null);
    },
  });

  // Get controls by role (API returns already separated by role)
  const controlsInPlace = useMemo((): ControlLink[] => {
    if (riskId && linkedControls) {
      return linkedControls.inPlace.map((c) => ({
        id: c.id,
        organizationalControlId: c.organizationalControlId,
        role: RiskOrgControlRole.IN_PLACE,
        notes: c.notes,
        OrganizationalControl: c.OrganizationalControl,
      }));
    }
    return localControlsInPlace;
  }, [riskId, linkedControls, localControlsInPlace]);

  const controlsNeeded = useMemo((): ControlLink[] => {
    if (riskId && linkedControls) {
      return linkedControls.needed.map((c) => ({
        id: c.id,
        organizationalControlId: c.organizationalControlId,
        role: RiskOrgControlRole.NEEDED,
        notes: c.notes,
        OrganizationalControl: c.OrganizationalControl,
      }));
    }
    return localControlsNeeded;
  }, [riskId, linkedControls, localControlsNeeded]);

  // Get all control IDs to exclude from pickers
  const allExcludeIds = useMemo(() => {
    return [
      ...controlsInPlace.map((c) => c.organizationalControlId),
      ...controlsNeeded.map((c) => c.organizationalControlId),
    ];
  }, [controlsInPlace, controlsNeeded]);

  // Notify parent of changes for new risks
  useEffect(() => {
    if (!riskId && onControlsChange) {
      onControlsChange({
        inPlace: localControlsInPlace.map((c) => c.organizationalControlId),
        needed: localControlsNeeded.map((c) => c.organizationalControlId),
      });
    }
  }, [riskId, localControlsInPlace, localControlsNeeded, onControlsChange]);

  // Handle adding a control
  const handleAddControl = useCallback(
    (role: RiskOrgControlRole) =>
      (controlId: string, control: NonNullable<Parameters<CreatableControlPickerProps["onChange"]>[1]>) => {
        if (riskId) {
          // For existing risks, link via API
          linkMutation.mutate({
            riskId,
            controlId,
            role,
          });
        } else {
          // For new risks, add to local state
          const newLink: ControlLink = {
            organizationalControlId: controlId,
            role,
            OrganizationalControl: {
              id: control.id,
              name: control.name,
              controlType: control.controlType,
              FrameworkControl: control.FrameworkControl,
            },
          };
          if (role === RiskOrgControlRole.IN_PLACE) {
            setLocalControlsInPlace((prev) => [...prev, newLink]);
          } else {
            setLocalControlsNeeded((prev) => [...prev, newLink]);
          }
        }
      },
    [riskId, linkMutation]
  );

  // Handle removing a control
  const handleRemoveControl = useCallback(
    (role: RiskOrgControlRole) => (controlId: string) => {
      if (riskId) {
        // For existing risks, unlink via API
        setRemovingControlId(controlId);
        unlinkMutation.mutate({ riskId, controlId });
      } else {
        // For new risks, remove from local state
        if (role === RiskOrgControlRole.IN_PLACE) {
          setLocalControlsInPlace((prev) =>
            prev.filter((c) => c.organizationalControlId !== controlId)
          );
        } else {
          setLocalControlsNeeded((prev) =>
            prev.filter((c) => c.organizationalControlId !== controlId)
          );
        }
      }
    },
    [riskId, unlinkMutation]
  );

  const hasControls = controlsInPlace.length > 0 || controlsNeeded.length > 0;

  return (
    <div className={cn("border rounded-lg", className)}>
      <button
        type="button"
        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <Shield className="h-5 w-5 text-primary" />
          <span className="font-medium">Controls</span>
          {hasControls && !isExpanded && (
            <Badge variant="secondary" className="text-xs">
              {controlsInPlace.length + controlsNeeded.length} linked
            </Badge>
          )}
          {!hasControls && !isReadOnly && (
            <span className="text-sm text-muted-foreground">(Optional)</span>
          )}
        </div>
        {isLoadingControls && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t p-4 space-y-4">
          {/* Controls in Place */}
          <ControlRoleSection
            title="Controls in Place"
            description="Existing controls that currently address this risk"
            role={RiskOrgControlRole.IN_PLACE}
            icon={ShieldCheck}
            bgColor="bg-green-50/50 dark:bg-green-950/20"
            controls={controlsInPlace}
            onAddControl={handleAddControl(RiskOrgControlRole.IN_PLACE)}
            onRemoveControl={handleRemoveControl(RiskOrgControlRole.IN_PLACE)}
            isAddingControl={linkMutation.isPending}
            removingControlId={removingControlId}
            excludeIds={allExcludeIds}
            isReadOnly={isReadOnly}
            defaultControlType={OrgControlType.MITIGATING}
          />

          {/* Controls Needed */}
          <ControlRoleSection
            title="Controls Needed"
            description="Additional controls required to address this risk"
            role={RiskOrgControlRole.NEEDED}
            icon={ShieldPlus}
            bgColor="bg-amber-50/50 dark:bg-amber-950/20"
            controls={controlsNeeded}
            onAddControl={handleAddControl(RiskOrgControlRole.NEEDED)}
            onRemoveControl={handleRemoveControl(RiskOrgControlRole.NEEDED)}
            isAddingControl={linkMutation.isPending}
            removingControlId={removingControlId}
            excludeIds={allExcludeIds}
            isReadOnly={isReadOnly}
            defaultControlType={OrgControlType.PREVENTATIVE}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Hook to get control IDs from local state for form submission
 * Used by parent forms when creating new risks
 */
export function useRiskControlsState() {
  const [controlsInPlace, setControlsInPlace] = useState<string[]>([]);
  const [controlsNeeded, setControlsNeeded] = useState<string[]>([]);

  const handleControlsChange = useCallback(
    (controls: { inPlace: string[]; needed: string[] }) => {
      setControlsInPlace(controls.inPlace);
      setControlsNeeded(controls.needed);
    },
    []
  );

  return {
    controlsInPlace,
    controlsNeeded,
    handleControlsChange,
  };
}
