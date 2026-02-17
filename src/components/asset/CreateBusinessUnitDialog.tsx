"use client";

/**
 * Create Business Unit Dialog
 *
 * Inline dialog for creating a business unit from within form dropdowns.
 * Epic 14: Asset Registry - Story 14.4 Enhancement
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "@/trpc/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Plus, Building2 } from "lucide-react";
import { toast } from "sonner";

const createBUSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  code: z.string().max(20, "Code too long").optional(),
});

type CreateBUFormValues = z.infer<typeof createBUSchema>;

interface Props {
  onCreated: (businessUnit: { id: string; name: string }) => void;
}

export function CreateBusinessUnitDialog({ onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const utils = api.useUtils();

  const form = useForm<CreateBUFormValues>({
    resolver: zodResolver(createBUSchema),
    defaultValues: {
      name: "",
      code: "",
    },
  });

  const createMutation = api.businessUnit.quickCreate.useMutation({
    onSuccess: (data) => {
      toast.success(`Business Unit "${data.name}" created`);
      void utils.businessUnit.getAll.invalidate();
      onCreated({ id: data.id, name: data.name });
      setOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create business unit");
    },
  });

  const onSubmit = (values: CreateBUFormValues) => {
    createMutation.mutate({
      name: values.name,
      code: values.code || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
          <Plus className="h-4 w-4" />
          Create New Business Unit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Create Business Unit
          </DialogTitle>
          <DialogDescription>
            Create a new business unit to assign to this asset.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., IT Operations" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Code</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., IT-OPS" {...field} />
                  </FormControl>
                  <FormDescription>
                    Optional short code for the business unit
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
