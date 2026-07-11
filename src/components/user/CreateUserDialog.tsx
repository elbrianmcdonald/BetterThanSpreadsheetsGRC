/**
 * CreateUserDialog Component
 *
 * Dialog form for creating a new user in the organization.
 * Validates input and shows success/error messages.
 */

"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, Copy, Loader2 } from "lucide-react";
import { api } from "@/trpc/react";
import { UserRole } from "@prisma/client";
import { roleDisplayConfig } from "@/schemas/user";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CreateUserDialogProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateUserDialog({
  onClose,
  onSuccess,
}: CreateUserDialogProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>(UserRole.BUSINESS_USER);
  const [error, setError] = useState<string | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [passwordCopied, setPasswordCopied] = useState(false);

  const utils = api.useUtils();

  const copyPasswordToClipboard = async () => {
    if (generatedPassword) {
      try {
        await navigator.clipboard.writeText(generatedPassword);
        setPasswordCopied(true);
        toast.success("Password copied to clipboard!");
        setTimeout(() => setPasswordCopied(false), 3000);
      } catch (error) {
        toast.error("Failed to copy password");
      }
    }
  };

  const createUserMutation = api.user.createUser.useMutation({
    onMutate: async (newUser) => {
      // Cancel outgoing refetches
      await utils.user.listUsers.cancel();

      // Snapshot previous value
      const previousUsers = utils.user.listUsers.getData();

      // Optimistically update to the new value (Story 3.8: Include assignedFrameworks, Story 7.0.4: Include businessUnit)
      if (previousUsers) {
        utils.user.listUsers.setData(
          { skip: 0, take: 50 },
          (old) => {
            if (!old) return old;
            return {
              ...old,
              users: [
                {
                  id: "temp-id", // Temporary ID
                  name: newUser.name,
                  email: newUser.email,
                  role: newUser.role ?? UserRole.BUSINESS_USER, // Default to most-restrictive
                  // Role Consolidation Epic 2: staff carry platformRole; BUSINESS_USER is null.
                  platformRole:
                    newUser.role && newUser.role !== UserRole.BUSINESS_USER
                      ? newUser.role
                      : null,
                  assignedFrameworks: newUser.assignedFrameworks ?? [], // Story 3.8
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  // Story 7.0.4: Add businessUnit fields for type compatibility
                  businessUnitId: null,
                  businessUnit: null,
                },
                ...old.users,
              ],
              total: old.total + 1,
            };
          }
        );
      }

      return { previousUsers };
    },
    onError: (err, newUser, context) => {
      // Rollback on error
      if (context?.previousUsers) {
        utils.user.listUsers.setData({ skip: 0, take: 50 }, context.previousUsers);
      }
      toast.error(err.message);
      setError(err.message);
    },
    onSuccess: (data) => {
      // Capture generated password for one-time display
      if ('generatedPassword' in data) {
        setGeneratedPassword(data.generatedPassword as string);
      }
      toast.success(`User "${data.name}" created successfully!`);
    },
    onSettled: () => {
      // Refetch to ensure consistency
      void utils.user.listUsers.invalidate();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    createUserMutation.mutate({
      name,
      email,
      role,
    });
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
          <DialogDescription>
            Add a new user to your organization.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Password Display - One-time only */}
          {generatedPassword && (
            <div className="rounded-md border border-primary/30 bg-primary/10 p-4">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 flex-shrink-0 text-primary" />
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-foreground">
                    User Created - Save This Password Now!
                  </h3>
                  <div className="mt-2 text-sm text-muted-foreground">
                    <p className="mb-3 font-semibold text-foreground">
                      This password will only be shown once. Copy it now and securely communicate it to the new user.
                    </p>
                    <div className="flex items-center gap-2 rounded-md border bg-muted p-3">
                      <code className="flex-1 break-all font-mono text-lg text-foreground">
                        {generatedPassword}
                      </code>
                      <Button
                        type="button"
                        onClick={copyPasswordToClipboard}
                        className="whitespace-nowrap"
                      >
                        {passwordCopied ? (
                          <>
                            <Check className="mr-2 h-4 w-4" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="mr-2 h-4 w-4" />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Once you close this dialog, you will not be able to retrieve this password again.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="rounded-md bg-destructive/10 p-4">
              <h3 className="text-sm font-medium text-destructive">
                Error creating user
              </h3>
              <p className="mt-2 text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Form fields - hide after user created */}
          {!generatedPassword && (
            <>
              {/* Name Input */}
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="John Doe"
                />
              </div>

              {/* Email Input */}
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="john.doe@example.com"
                />
              </div>

              {/* Role Select */}
              <div className="grid gap-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={role}
                  onValueChange={(value) => setRole(value as UserRole)}
                >
                  <SelectTrigger id="role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(roleDisplayConfig).map(([roleKey, config]) => (
                      <SelectItem key={roleKey} value={roleKey}>
                        {config.label} - {config.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Default: Business User (most restrictive role)
                </p>
              </div>
            </>
          )}

          <DialogFooter>
            {generatedPassword ? (
              // After user created - show only close button
              <Button type="button" onClick={onClose} className="w-full sm:w-auto">
                Close
              </Button>
            ) : (
              // Before user created - show create and cancel buttons
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={createUserMutation.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createUserMutation.isPending}>
                  {createUserMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create User"
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
