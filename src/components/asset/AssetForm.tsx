"use client";

/**
 * Asset Form Component
 *
 * Epic 14: Asset Registry & BIA Integration
 * Story 14.4: Create/Edit Asset Forms
 */

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "@/trpc/react";
import { AssetType, AssetStatus, UserRole } from "@prisma/client";
import { useHasRole } from "@/hooks/useHasRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Server,
  Database,
  AppWindow,
  Network,
  HardDrive,
  Monitor,
} from "lucide-react";
import { CreatableBusinessUnitPicker } from "@/components/business-unit/CreatableBusinessUnitPicker";
import { CreateOwnerDialog } from "./CreateOwnerDialog";

// Asset type display config
const ASSET_TYPE_CONFIG: Record<
  AssetType,
  { label: string; icon: React.ReactNode }
> = {
  SERVER: { label: "Server", icon: <Server className="h-4 w-4" /> },
  DATABASE: { label: "Database", icon: <Database className="h-4 w-4" /> },
  APPLICATION: { label: "Application", icon: <AppWindow className="h-4 w-4" /> },
  NETWORK: { label: "Network Device", icon: <Network className="h-4 w-4" /> },
  STORAGE: { label: "Storage System", icon: <HardDrive className="h-4 w-4" /> },
  ENDPOINT: { label: "Endpoint", icon: <Monitor className="h-4 w-4" /> },
};

const STATUS_LABELS: Record<AssetStatus, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  DECOMMISSIONED: "Decommissioned",
  UNDER_MAINTENANCE: "Under Maintenance",
};

// Form schema
const assetFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name too long"),
  type: z.nativeEnum(AssetType),
  status: z.nativeEnum(AssetStatus).optional(),
  description: z.string().max(4000, "Description too long").optional(),
  ownerId: z.string().optional(),
  businessUnitId: z.string().optional(),
  // Loss Event Range — financial impact bounds in USD
  lossMinimum: z.number().min(0).max(1e12).nullable().optional(),
  lossProbable: z.number().min(0).max(1e12).nullable().optional(),
  lossMaximum: z.number().min(0).max(1e12).nullable().optional(),
});

export type AssetFormValues = z.infer<typeof assetFormSchema>;

interface Props {
  defaultValues?: Partial<AssetFormValues>;
  onSubmit: (values: AssetFormValues) => void;
  isSubmitting?: boolean;
  mode: "create" | "edit";
}

export function AssetForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  mode,
}: Props) {
  const form = useForm<AssetFormValues>({
    resolver: zodResolver(assetFormSchema),
    defaultValues: {
      name: "",
      type: AssetType.APPLICATION,
      status: AssetStatus.ACTIVE,
      description: "",
      ownerId: "",
      businessUnitId: "",
      ...defaultValues,
    },
  });

  // Check if user can create owners and business units
  const canCreate = useHasRole([UserRole.ADMINISTRATOR, UserRole.ANALYST, UserRole.ANALYST]);

  // Fetch owners
  const { data: owners } = api.asset.getAvailableOwners.useQuery({});

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Name */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name *</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Payroll Database Server" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Type */}
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Asset Type *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select asset type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(ASSET_TYPE_CONFIG).map(([type, config]) => (
                    <SelectItem key={type} value={type}>
                      <span className="flex items-center gap-2">
                        {config.icon}
                        {config.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Status (edit mode only) */}
        {mode === "edit" && (
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([status, label]) => (
                      <SelectItem key={status} value={status}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Description */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe the asset, its purpose, and any relevant details..."
                  className="h-32"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Optional description of the asset (max 4000 characters)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Owner */}
        <FormField
          control={form.control}
          name="ownerId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Owner</FormLabel>
              <div className="flex gap-2">
                <Select
                  onValueChange={(value) => field.onChange(value === "_none" ? "" : value)}
                  value={field.value || "_none"}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select owner" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="_none">No owner assigned</SelectItem>
                    {owners?.map((owner) => (
                      <SelectItem key={owner.id} value={owner.id}>
                        {owner.name}{owner.department ? ` (${owner.department})` : owner.email ? ` (${owner.email})` : ""}
                      </SelectItem>
                    ))}
                    {canCreate && (
                      <>
                        <SelectSeparator />
                        <CreateOwnerDialog
                          onCreated={(owner) => {
                            field.onChange(owner.id);
                          }}
                        />
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <FormDescription>
                Person responsible for this asset
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Business Unit */}
        <FormField
          control={form.control}
          name="businessUnitId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Business Unit</FormLabel>
              <FormControl>
                <CreatableBusinessUnitPicker
                  value={field.value || null}
                  onChange={(value) => field.onChange(value ?? "")}
                  placeholder="Select or create business unit..."
                />
              </FormControl>
              <FormDescription>
                Business unit that owns this asset
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Loss Event Range (USD) */}
        <div className="space-y-2">
          <FormLabel>Loss Event Range (USD)</FormLabel>
          <FormDescription>Estimated financial loss if a loss event occurs.</FormDescription>
          <div className="grid grid-cols-3 gap-3">
            <FormField
              control={form.control}
              name="lossMinimum"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Minimum</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="$"
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lossProbable"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Probable</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="$"
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lossMaximum"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Maximum</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="$"
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? mode === "create"
                ? "Creating..."
                : "Saving..."
              : mode === "create"
              ? "Create Asset"
              : "Save Changes"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
