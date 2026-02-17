/**
 * Create Finding Form Component
 *
 * Story 7.2: Finding Creation Form
 *
 * A form for creating new findings with validation, BU picker, and assignee selection.
 * Follows patterns from CreateRiskForm.tsx.
 *
 * @see AC5-AC22: Form fields, validation, and submission
 */

"use client";

import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { FindingSource, Severity } from "@prisma/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { BusinessUnitPicker } from "@/components/business-unit/BusinessUnitPicker";
import { AssigneePicker } from "@/components/assignment/AssigneePicker";
import { Plus } from "lucide-react";

/**
 * Finding Source Options (AC7)
 */
const FINDING_SOURCE_OPTIONS = [
  { value: "AUDIT", label: "Audit", description: "From security/compliance audit" },
  { value: "PENTEST", label: "Penetration Test", description: "From security testing" },
  { value: "SCANNER", label: "Vulnerability Scanner", description: "From automated scanning" },
  { value: "INCIDENT", label: "Security Incident", description: "Discovered during incident" },
  { value: "MANUAL", label: "Manual Discovery", description: "Manually discovered" },
] as const;

/**
 * Severity Options (AC8)
 */
const SEVERITY_OPTIONS = [
  { value: "CRITICAL", label: "Critical", color: "text-purple-600", description: "Immediate action required" },
  { value: "HIGH", label: "High", color: "text-red-600", description: "Urgent attention required" },
  { value: "MEDIUM", label: "Medium", color: "text-amber-600", description: "Should be addressed soon" },
  { value: "LOW", label: "Low", color: "text-blue-600", description: "Address when resources allow" },
] as const;

/**
 * Form validation schema (AC5-AC11, AC13-AC16)
 * Matches tRPC input validation
 */
const createFindingSchema = z.object({
  title: z
    .string()
    .min(5, "Title must be at least 5 characters")
    .max(500, "Title must be less than 500 characters"),
  description: z
    .string()
    .min(20, "Description must be at least 20 characters"),
  source: z.nativeEnum(FindingSource, {
    required_error: "Please select a source",
  }),
  severity: z.nativeEnum(Severity, {
    required_error: "Please select a severity",
  }),
  affectedAssets: z.string().optional(),
  affectedBusinessUnitIds: z.array(z.string()).optional(),
  assigneeId: z.string().optional(),
});

type CreateFindingFormValues = z.infer<typeof createFindingSchema>;

export function CreateFindingForm() {
  const router = useRouter();
  const [selectedBUs, setSelectedBUs] = useState<string[]>([]);
  const [createBUDialogOpen, setCreateBUDialogOpen] = useState(false);
  const [newBUName, setNewBUName] = useState("");
  const [newBUCode, setNewBUCode] = useState("");
  const [newBUParentId, setNewBUParentId] = useState<string | null>(null);

  const utils = api.useUtils();

  // Fetch all business units for parent selection
  const { data: buData } = api.businessUnit.list.useQuery({
    includeInactive: false,
  });

  // Quick create BU mutation
  const createBUMutation = api.businessUnit.quickCreate.useMutation({
    onSuccess: (data) => {
      if (data.created) {
        toast.success(`Created business unit "${data.name}"`);
      } else {
        toast.info(`Business unit "${data.name}" already exists`);
      }
      // Add to selection
      const currentBUs = form.getValues("affectedBusinessUnitIds") ?? [];
      const newBUs = [...currentBUs, data.id];
      form.setValue("affectedBusinessUnitIds", newBUs);
      setSelectedBUs(newBUs);
      // Invalidate the list to refresh
      void utils.businessUnit.list.invalidate();
      // Reset and close dialog
      setNewBUName("");
      setNewBUCode("");
      setNewBUParentId(null);
      setCreateBUDialogOpen(false);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create business unit");
    },
  });

  // Flatten BU tree for parent selection
  const allBusinessUnits = useMemo(() => {
    if (!buData?.tree) return [];
    const flatten = (nodes: typeof buData.tree): Array<{ id: string; name: string; code: string | null }> => {
      const result: Array<{ id: string; name: string; code: string | null }> = [];
      for (const node of nodes) {
        result.push({ id: node.id, name: node.name, code: node.code });
        if (node.children?.length) {
          result.push(...flatten(node.children));
        }
      }
      return result;
    };
    return flatten(buData.tree);
  }, [buData?.tree]);

  const handleCreateBU = () => {
    if (!newBUName.trim()) return;
    createBUMutation.mutate({
      name: newBUName.trim(),
      code: newBUCode.trim() || undefined,
      parentId: newBUParentId || undefined,
    });
  };

  // Create mutation (AC17)
  const createMutation = api.finding.create.useMutation({
    onSuccess: (data) => {
      // AC19: Success toast
      toast.success(`Finding ${data.identifier} created successfully`);
      // AC20: Redirect to finding detail page
      router.push(`/findings/${data.id}`);
    },
    onError: (error) => {
      // AC21: Server validation errors
      toast.error(error.message || "Failed to create finding");
    },
  });

  // Form setup (AC13: validate on blur)
  const form = useForm<CreateFindingFormValues>({
    resolver: zodResolver(createFindingSchema),
    defaultValues: {
      title: "",
      description: "",
      source: undefined,
      severity: undefined,
      affectedAssets: "",
      affectedBusinessUnitIds: [],
      assigneeId: undefined,
    },
    mode: "onBlur", // AC13: Client-side validation on blur
  });

  // Transform affected assets from string to array
  const onSubmit = (values: CreateFindingFormValues) => {
    const affectedAssets = values.affectedAssets
      ? values.affectedAssets
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    createMutation.mutate({
      title: values.title,
      description: values.description,
      source: values.source,
      severity: values.severity,
      affectedAssets,
      affectedBusinessUnitIds: values.affectedBusinessUnitIds,
      assigneeId: values.assigneeId,
    });
  };

  // Watch BU selection for assignee suggestions (AC11)
  const affectedBUs = form.watch("affectedBusinessUnitIds");
  const suggestedBUs = useMemo(() => affectedBUs ?? [], [affectedBUs]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Title Field (AC5, AC14) */}
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Title <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Input
                  placeholder="Enter a descriptive title for the finding"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                A clear, concise title (5-500 characters)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Description Field (AC6, AC15) */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Description <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Provide a detailed description of the finding, including context, impact, and any relevant technical details..."
                  className="min-h-[150px]"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Detailed description of the finding (minimum 20 characters). Markdown supported.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Source and Severity Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Source Field (AC7) */}
          <FormField
            control={form.control}
            name="source"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Source <span className="text-destructive">*</span>
                </FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select source..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {FINDING_SOURCE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex flex-col">
                          <span>{option.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {option.description}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Severity Field (AC8) */}
          <FormField
            control={form.control}
            name="severity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Severity <span className="text-destructive">*</span>
                </FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select severity..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {SEVERITY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex flex-col">
                          <span className={option.color}>{option.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {option.description}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Affected Assets Field (AC9) */}
        <FormField
          control={form.control}
          name="affectedAssets"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Affected Assets</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Enter affected assets, one per line:&#10;server-prod-01&#10;database-main&#10;api.example.com"
                  className="min-h-[100px]"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                List of affected systems, servers, or assets (one per line)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Business Units Field (AC10) */}
        <FormField
          control={form.control}
          name="affectedBusinessUnitIds"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>Affected Business Units</FormLabel>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setCreateBUDialogOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Create New
                </Button>
              </div>
              <FormControl>
                <BusinessUnitPicker
                  mode="multi"
                  value={field.value ?? null}
                  onChange={(value) => {
                    const newValue = value ? (Array.isArray(value) ? value : [value]) : [];
                    field.onChange(newValue);
                    setSelectedBUs(newValue);
                  }}
                  placeholder="Search business units..."
                />
              </FormControl>
              <FormDescription>
                Select business units affected by this finding. Can&apos;t find one? Click &quot;Create New&quot; above.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Assignee Field (AC11) */}
        <FormField
          control={form.control}
          name="assigneeId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Assignee</FormLabel>
              <FormControl>
                <AssigneePicker
                  value={field.value ?? null}
                  onChange={(value) => field.onChange(value ?? undefined)}
                  suggestedFromBUs={suggestedBUs}
                  placeholder="Select assignee..."
                />
              </FormControl>
              <FormDescription>
                Assign to a team member for triage
                {suggestedBUs.length > 0 && " (suggestions based on affected BUs)"}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Submit Button (AC17, AC18) */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={createMutation.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating Finding...
              </>
            ) : (
              "Create Finding"
            )}
          </Button>
        </div>
      </form>

      {/* Create Business Unit Dialog */}
      <Dialog open={createBUDialogOpen} onOpenChange={setCreateBUDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Business Unit</DialogTitle>
            <DialogDescription>
              Add a new business unit to your organization. It will be automatically
              added to the affected business units for this finding.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-bu-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="new-bu-name"
                placeholder="Enter business unit name"
                value={newBUName}
                onChange={(e) => setNewBUName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-bu-code">Code (optional)</Label>
              <Input
                id="new-bu-code"
                placeholder="e.g., ENG, SALES, HR"
                value={newBUCode}
                onChange={(e) => setNewBUCode(e.target.value)}
                maxLength={20}
              />
              <p className="text-xs text-muted-foreground">
                Short identifier for quick reference (max 20 characters)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-bu-parent">Parent Business Unit (optional)</Label>
              <Select
                value={newBUParentId ?? "__none__"}
                onValueChange={(v) => setNewBUParentId(v === "__none__" ? null : v)}
              >
                <SelectTrigger id="new-bu-parent">
                  <SelectValue placeholder="None (top-level)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None (top-level)</SelectItem>
                  {allBusinessUnits.map((bu) => (
                    <SelectItem key={bu.id} value={bu.id}>
                      {bu.name}
                      {bu.code && ` (${bu.code})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Optionally place this under an existing business unit
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateBUDialogOpen(false)}
              disabled={createBUMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateBU}
              disabled={!newBUName.trim() || createBUMutation.isPending}
            >
              {createBUMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Business Unit"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Form>
  );
}
