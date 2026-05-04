"use client";

import { useState, useEffect } from "react";
import { FileText, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface BusinessImpactStatementProps {
  riskId: string;
  statement: string | null | undefined;
  canEdit?: boolean;
  isLoading?: boolean;
  onSaved?: () => void;
  className?: string;
}

export function BusinessImpactStatement({
  riskId,
  statement,
  canEdit = false,
  isLoading = false,
  onSaved,
  className,
}: BusinessImpactStatementProps) {
  const [value, setValue] = useState(statement ?? "");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setValue(statement ?? "");
    setDirty(false);
  }, [statement]);

  const updateMutation = api.risk.updateBusinessImpact.useMutation({
    onSuccess: () => {
      toast.success("Business impact saved");
      setDirty(false);
      onSaved?.();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to save business impact");
    },
  });

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  const handleSave = () => {
    updateMutation.mutate({ riskId, businessImpactStatement: value });
  };

  const handleReset = () => {
    setValue(statement ?? "");
    setDirty(false);
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5 text-primary" />
          Business Impact
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {canEdit ? (
          <>
            <Textarea
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setDirty(e.target.value !== (statement ?? ""));
              }}
              placeholder="Describe the business impact of this risk..."
              className="min-h-[160px]"
              disabled={updateMutation.isPending}
            />
            <div className="flex justify-end gap-2">
              {dirty && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  disabled={updateMutation.isPending}
                >
                  Cancel
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!dirty || updateMutation.isPending}
              >
                {updateMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Save
              </Button>
            </div>
          </>
        ) : statement ? (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">
            {statement}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            No business impact recorded.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function BusinessImpactSummary({
  statement,
  className,
}: {
  statement: string | null | undefined;
  className?: string;
}) {
  if (!statement) {
    return (
      <div className={cn("text-sm text-muted-foreground italic", className)}>
        No impact statement
      </div>
    );
  }

  const truncated =
    statement.length > 200 ? statement.substring(0, 200) + "..." : statement;

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Business Impact</span>
      </div>
      <p className="whitespace-pre-wrap text-sm text-muted-foreground">{truncated}</p>
    </div>
  );
}
