"use client";

/**
 * Control Detail Modal Component
 *
 * Displays detailed information about a framework control including:
 * - Control ID and title
 * - Framework name and version
 * - Full description from OSCAL catalog
 * - Guidance text (if available)
 *
 * @see Story 3.4: AC15-AC16 - Control detail modal
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Shield, BookOpen, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface ControlDetailModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** Control data to display */
  control: {
    controlId: string;
    title: string;
    description: string;
    guidance?: string | null;
    confidence?: number;
  } | null;
  /** Framework information */
  framework?: {
    name: string;
    code: string;
    version?: string;
  };
}

/**
 * Get framework-specific badge color
 */
function getFrameworkBadgeColor(code?: string): string {
  if (!code) return "bg-gray-100 text-gray-700";

  switch (code.toUpperCase()) {
    case "ISO27001":
      return "bg-blue-100 text-blue-700";
    case "SOC2":
      return "bg-green-100 text-green-700";
    case "NISTCSF":
      return "bg-purple-100 text-purple-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

export function ControlDetailModal({
  open,
  onClose,
  control,
  framework,
}: ControlDetailModalProps) {
  if (!control) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <Shield className="h-6 w-6 text-blue-500 mt-1 flex-shrink-0" />
            <div className="space-y-1">
              <DialogTitle className="text-xl">
                {control.controlId}
              </DialogTitle>
              <DialogDescription className="text-base font-medium text-gray-700">
                {control.title}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto pr-4">
          <div className="space-y-6">
            {/* Framework badge */}
            {framework && (
              <div className="flex items-center gap-2">
                <Badge
                  variant="secondary"
                  className={cn(getFrameworkBadgeColor(framework.code))}
                >
                  {framework.name}
                  {framework.version && (
                    <span className="ml-1 opacity-70">v{framework.version}</span>
                  )}
                </Badge>
                {control.confidence !== undefined && control.confidence < 100 && (
                  <Badge variant="outline" className="text-amber-600 border-amber-300">
                    {control.confidence}% confidence
                  </Badge>
                )}
              </div>
            )}

            {/* Description section */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Info className="h-4 w-4" />
                <span>Description</span>
              </div>
              <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-4 whitespace-pre-wrap">
                {control.description || "No description available."}
              </div>
            </div>

            {/* Guidance section */}
            {control.guidance && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <BookOpen className="h-4 w-4" />
                  <span>Implementation Guidance</span>
                </div>
                <div className="text-sm text-gray-600 bg-blue-50 rounded-lg p-4 whitespace-pre-wrap border border-blue-100">
                  {control.guidance}
                </div>
              </div>
            )}

            {/* OSCAL reference note */}
            <div className="text-xs text-gray-400 pt-4 border-t">
              Control data sourced from authoritative OSCAL catalog.
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
