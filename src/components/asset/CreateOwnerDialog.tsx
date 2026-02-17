"use client";

/**
 * Create Asset Owner Dialog
 *
 * Inline dialog for creating an asset owner from within form dropdowns.
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
import { Plus, UserCircle } from "lucide-react";
import { toast } from "sonner";

const createOwnerSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name too long"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().max(50, "Phone too long").optional(),
  department: z.string().max(100, "Department too long").optional(),
  title: z.string().max(100, "Title too long").optional(),
});

type CreateOwnerFormValues = z.infer<typeof createOwnerSchema>;

interface Props {
  onCreated: (owner: { id: string; name: string; email: string | null }) => void;
}

export function CreateOwnerDialog({ onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const utils = api.useUtils();

  const form = useForm<CreateOwnerFormValues>({
    resolver: zodResolver(createOwnerSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      department: "",
      title: "",
    },
  });

  const createMutation = api.assetOwner.quickCreate.useMutation({
    onSuccess: (data) => {
      toast.success(`Owner "${data.name}" created`);
      void utils.asset.getAvailableOwners.invalidate();
      onCreated({ id: data.id, name: data.name, email: data.email });
      setOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create owner");
    },
  });

  const onSubmit = (values: CreateOwnerFormValues) => {
    createMutation.mutate({
      name: values.name,
      email: values.email || undefined,
      phone: values.phone || undefined,
      department: values.department || undefined,
      title: values.title || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
          <Plus className="h-4 w-4" />
          Create New Owner
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCircle className="h-5 w-5" />
            Create Asset Owner
          </DialogTitle>
          <DialogDescription>
            Create a new owner to assign to this asset.
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
                    <Input placeholder="e.g., John Smith" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="john@company.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="+1 555-0123" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., IT Operations" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., IT Manager" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create Owner"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
