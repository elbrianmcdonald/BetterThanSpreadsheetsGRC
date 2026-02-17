"use client";

/**
 * Save Indicator Component
 *
 * Story 7.6: Risk Assessment Form with Auto-Save (AC23-AC25)
 *
 * Shows auto-save status with visual feedback:
 * - AC23: "Saving..." during mutation
 * - AC24: "Saved ✓" on success (fades after 2s)
 * - AC25: "Error saving" on failure with retry option
 *
 * @see Story 7.6: Risk Assessment Form with Auto-Save
 */

import { useEffect, useState } from "react";
import { Loader2, Check, AlertCircle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface SaveIndicatorProps {
  /** Current save status */
  status: SaveStatus;
  /** Callback when retry button is clicked */
  onRetry?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays auto-save status with appropriate icons and messages.
 *
 * @example
 * ```tsx
 * <SaveIndicator
 *   status={mutation.isPending ? "saving" : mutation.isError ? "error" : "saved"}
 *   onRetry={() => mutation.mutate(data)}
 * />
 * ```
 */
export function SaveIndicator({
  status,
  onRetry,
  className,
}: SaveIndicatorProps) {
  const [visible, setVisible] = useState(false);

  // Show indicator when status changes, hide after 2s for "saved"
  useEffect(() => {
    if (status === "idle") {
      setVisible(false);
      return;
    }

    setVisible(true);

    if (status === "saved") {
      const timer = setTimeout(() => {
        setVisible(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  if (!visible && status !== "saving" && status !== "error") {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 text-sm transition-opacity duration-300",
        visible ? "opacity-100" : "opacity-0",
        className
      )}
    >
      {/* AC23: Saving state */}
      {status === "saving" && (
        <>
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Saving...</span>
        </>
      )}

      {/* AC24: Saved state */}
      {status === "saved" && (
        <>
          <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
          <span className="text-green-600 dark:text-green-400">Saved</span>
        </>
      )}

      {/* AC25: Error state with retry */}
      {status === "error" && (
        <>
          <AlertCircle className="h-4 w-4 text-destructive" />
          <span className="text-destructive">Error saving</span>
          {onRetry && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRetry}
              className="h-6 px-2 text-xs"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          )}
        </>
      )}
    </div>
  );
}
