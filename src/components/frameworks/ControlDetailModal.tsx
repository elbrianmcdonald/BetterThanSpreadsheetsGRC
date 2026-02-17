"use client";

/**
 * Control Detail Modal Component
 *
 * Displays full control details including hierarchy (parent/children).
 *
 * @see Story 2.2: OSCAL Catalog Storage and Retrieval (AC25-AC29)
 */

import { api } from "@/trpc/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, ArrowUp, ArrowDown, FileText, Link as LinkIcon } from "lucide-react";
import Link from "next/link";

interface ControlDetailModalProps {
  controlId: string;
  onClose: () => void;
}

export function ControlDetailModal({ controlId, onClose }: ControlDetailModalProps) {
  const { data: control, isLoading, error } = api.framework.getControlById.useQuery(
    { id: controlId },
    { enabled: !!controlId }
  );

  return (
    <Dialog open={!!controlId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : error ? (
          <div className="py-8 text-center">
            <p className="text-red-600">{error.message || "Failed to load control"}</p>
          </div>
        ) : control ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="font-mono">
                  {control.controlId}
                </Badge>
                <Badge variant="secondary">
                  {control.Framework.code}
                </Badge>
              </div>
              <DialogTitle className="text-xl mt-2">{control.title}</DialogTitle>
              <DialogDescription>
                From {control.Framework.name} v{control.Framework.version}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 space-y-6">
              {/* Description */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Description</h3>
                <p className="text-sm text-gray-900 whitespace-pre-wrap">
                  {control.description || "No description available"}
                </p>
              </div>

              {/* Guidance */}
              {control.guidance && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Guidance</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-md">
                    {control.guidance}
                  </p>
                </div>
              )}

              <Separator />

              {/* Parent Control */}
              {control.Control && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-2">
                    <ArrowUp className="h-4 w-4" />
                    Parent Control
                  </h3>
                  <div className="bg-blue-50 p-3 rounded-md">
                    <button
                      onClick={() => {
                        // Close current and open parent
                        onClose();
                        // Note: In a real implementation, we'd want to open the parent modal
                        // For now, just show the info
                      }}
                      className="flex items-center gap-2 text-left w-full hover:bg-blue-100 rounded p-2 -m-2 transition-colors"
                    >
                      <span className="font-mono text-sm text-blue-700">
                        {control.Control.controlId}
                      </span>
                      <span className="text-sm text-gray-700">
                        {control.Control.title}
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* Child Controls */}
              {control.other_Control && control.other_Control.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-2">
                    <ArrowDown className="h-4 w-4" />
                    Sub-Controls ({control.other_Control.length})
                  </h3>
                  <div className="space-y-2">
                    {control.other_Control.map((child) => (
                      <div
                        key={child.id}
                        className="bg-gray-50 p-3 rounded-md hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-start gap-2">
                          <span className="font-mono text-sm text-gray-600">
                            {child.controlId}
                          </span>
                          <span className="text-sm text-gray-700">
                            {child.title}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              {/* Framework Link */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <FileText className="h-4 w-4" />
                  <span>Framework: {control.Framework.name}</span>
                </div>
                <Link
                  href={`/admin/frameworks/${control.Framework.id}`}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                  onClick={onClose}
                >
                  <LinkIcon className="h-4 w-4" />
                  View Framework
                </Link>
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
