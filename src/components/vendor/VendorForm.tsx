"use client";

/**
 * Vendor Form Component
 *
 * Epic 1: TPRM Vendor Registry
 * Story 1.1: Vendor Data Model and Create Form (FR1)
 * Story 1.4: Edit Vendor Information (FR4)
 * Story 1.6: Business Unit and Owner Assignment (FR6, FR7)
 *
 * Epic 2: Vendor Risk Tiering
 * Story 2.1: Risk Tier Classification (FR11)
 *
 * Shared form component for creating and editing vendors.
 */

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Loader2, AlertTriangle, ShieldAlert, Shield, ShieldCheck } from "lucide-react";
import { VendorRiskTier } from "@prisma/client";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreatableBusinessUnitPicker } from "@/components/business-unit/CreatableBusinessUnitPicker";
import { PersonPicker } from "@/components/person/PersonPicker";

/**
 * Form validation schema
 */
const vendorFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name must be less than 200 characters"),
  category: z.string().max(100).optional(),
  riskTier: z.string().optional(),
  primaryContactName: z.string().max(100).optional(),
  primaryContactEmail: z.string().email("Invalid email format").optional().or(z.literal("")),
  businessUnitId: z.string().optional(),
  itOwnerId: z.string().optional(),
  businessOwnerId: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

/**
 * Risk tier options with icons
 */
const RISK_TIER_OPTIONS = [
  { value: "CRITICAL", label: "Critical", sublabel: "6-month review cycle", icon: AlertTriangle, className: "text-red-600" },
  { value: "HIGH", label: "High", sublabel: "12-month review cycle", icon: ShieldAlert, className: "text-orange-600" },
  { value: "MEDIUM", label: "Medium", sublabel: "18-month review cycle", icon: Shield, className: "text-yellow-600" },
  { value: "LOW", label: "Low", sublabel: "24-month review cycle", icon: ShieldCheck, className: "text-green-600" },
];

type VendorFormValues = z.infer<typeof vendorFormSchema>;

interface VendorFormProps {
  mode: "create" | "edit";
  vendorId?: string;
  defaultValues?: Partial<VendorFormValues>;
  onSuccess?: (vendor: { id: string; identifier: string }) => void;
}

export function VendorForm({
  mode,
  vendorId,
  defaultValues,
  onSuccess,
}: VendorFormProps) {
  const router = useRouter();
  const utils = api.useUtils();

  // Create mutation
  const createMutation = api.vendor.create.useMutation({
    onSuccess: (vendor) => {
      toast.success(`Vendor ${vendor.identifier} created successfully`);
      void utils.vendor.list.invalidate();
      if (onSuccess) {
        onSuccess({ id: vendor.id, identifier: vendor.identifier });
      } else {
        router.push(`/vendors/${vendor.id}`);
      }
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create vendor");
    },
  });

  // Update mutation
  const updateMutation = api.vendor.update.useMutation({
    onSuccess: (vendor) => {
      toast.success("Vendor updated successfully");
      void utils.vendor.list.invalidate();
      void utils.vendor.getById.invalidate({ id: vendor.id });
      if (onSuccess) {
        onSuccess({ id: vendor.id, identifier: vendor.identifier });
      } else {
        router.push(`/vendors/${vendor.id}`);
      }
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update vendor");
    },
  });

  const form = useForm<VendorFormValues>({
    resolver: zodResolver(vendorFormSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      category: defaultValues?.category ?? "",
      riskTier: defaultValues?.riskTier || "__none__",
      primaryContactName: defaultValues?.primaryContactName ?? "",
      primaryContactEmail: defaultValues?.primaryContactEmail ?? "",
      businessUnitId: defaultValues?.businessUnitId ?? undefined,
      itOwnerId: defaultValues?.itOwnerId ?? undefined,
      businessOwnerId: defaultValues?.businessOwnerId ?? undefined,
      notes: defaultValues?.notes ?? "",
    },
  });

  // Update risk tier mutation (separate from main form)
  const updateRiskTierMutation = api.vendor.updateRiskTier.useMutation({
    onSuccess: () => {
      toast.success("Risk tier updated - next review date calculated");
      void utils.vendor.list.invalidate();
      if (vendorId) {
        void utils.vendor.getById.invalidate({ id: vendorId });
      }
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update risk tier");
    },
  });

  const onSubmit = (values: VendorFormValues) => {
    // Clean up empty strings and special "none" values to undefined
    // Note: riskTier is handled separately via updateRiskTier mutation
    const { riskTier, ...rest } = values;
    const cleanedValues = {
      ...rest,
      category: rest.category || undefined,
      primaryContactName: rest.primaryContactName || undefined,
      primaryContactEmail: rest.primaryContactEmail || undefined,
      businessUnitId: rest.businessUnitId || undefined,
      itOwnerId: rest.itOwnerId || undefined,
      businessOwnerId: rest.businessOwnerId || undefined,
      notes: rest.notes || undefined,
    };

    if (mode === "create") {
      createMutation.mutate(cleanedValues);
    } else if (vendorId) {
      // Update basic info first
      updateMutation.mutate({ id: vendorId, ...cleanedValues });

      // If risk tier changed from default, update it separately
      const selectedTier = riskTier === "__none__" ? null : riskTier as VendorRiskTier;
      const originalTier = defaultValues?.riskTier === "__none__" ? null : defaultValues?.riskTier as VendorRiskTier | undefined;
      if (selectedTier && selectedTier !== originalTier) {
        updateRiskTierMutation.mutate({ id: vendorId, riskTier: selectedTier });
      }
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Basic Information</h3>

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Vendor Name <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input placeholder="Enter vendor name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g., Cloud Services, Security Tools"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Categorize the vendor by service type
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Risk Classification (FR11) */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Risk Classification</h3>

          <FormField
            control={form.control}
            name="riskTier"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Risk Tier</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select risk tier" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="__none__">Not Classified</SelectItem>
                    {RISK_TIER_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      return (
                        <SelectItem key={option.value} value={option.value}>
                          <span className="flex items-center gap-2">
                            <Icon className={`h-4 w-4 ${option.className}`} />
                            {option.label}
                            <span className="text-muted-foreground text-xs">
                              ({option.sublabel})
                            </span>
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Classify the vendor by risk level. This determines the review cycle frequency.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Primary Contact */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Primary Contact</h3>

          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="primaryContactName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter contact name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="primaryContactEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="contact@vendor.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Ownership */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Ownership</h3>

          <FormField
            control={form.control}
            name="businessUnitId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Business Unit</FormLabel>
                <FormControl>
                  <CreatableBusinessUnitPicker
                    value={field.value ?? null}
                    onChange={(value) => field.onChange(value ?? undefined)}
                    placeholder="Select or create business unit..."
                  />
                </FormControl>
                <FormDescription>
                  Which business unit owns this vendor relationship. You can create a new one inline.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="itOwnerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>IT Owner</FormLabel>
                  <FormControl>
                    <PersonPicker
                      value={field.value ?? null}
                      onChange={(value) => field.onChange(value ?? undefined)}
                    />
                  </FormControl>
                  <FormDescription>
                    Technical stakeholder responsible for this vendor
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="businessOwnerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Business Owner</FormLabel>
                  <FormControl>
                    <PersonPicker
                      value={field.value ?? null}
                      onChange={(value) => field.onChange(value ?? undefined)}
                    />
                  </FormControl>
                  <FormDescription>
                    Business stakeholder responsible for this vendor relationship
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Additional notes about this vendor..."
                    className="min-h-[100px]"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Any additional information or context about the vendor
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Submit Buttons */}
        <div className="flex gap-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "create" ? "Create Vendor" : "Save Changes"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
