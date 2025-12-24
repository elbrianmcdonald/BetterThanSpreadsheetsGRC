"use client";

/**
 * VersionHistoryPanel
 *
 * Story 7.8.7: Matrix Version Publishing (AC8-AC13)
 *
 * Displays version history for a matrix template in a sidebar panel.
 * Allows switching between versions and creating new versions from published ones.
 */

import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Copy, GitCompare, Check } from "lucide-react";

interface VersionInfo {
  id: string;
  versionNumber: number;
  isActive: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  publisher?: { name: string | null } | null;
}

interface VersionHistoryPanelProps {
  versions: VersionInfo[];
  currentVersionId: string | null;
  selectedVersionId: string | null;
  onSelectVersion: (id: string) => void;
  onCreateFromVersion: (id: string) => void;
  onCompareVersions?: () => void;
  className?: string;
}

export function VersionHistoryPanel({
  versions,
  currentVersionId,
  selectedVersionId,
  onSelectVersion,
  onCreateFromVersion,
  onCompareVersions,
  className,
}: VersionHistoryPanelProps) {
  // Sort versions by version number descending (newest first)
  const sortedVersions = [...versions].sort(
    (a, b) => b.versionNumber - a.versionNumber
  );

  return (
    <Card className={cn("w-72 flex-shrink-0", className)}>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Version History</CardTitle>
          {onCompareVersions && versions.length > 1 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2"
              onClick={onCompareVersions}
              aria-label="Compare versions side by side"
            >
              <GitCompare className="h-4 w-4 mr-1" aria-hidden="true" />
              Compare
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-2 py-0 pb-2">
        <ScrollArea className="h-[400px] pr-2">
          <div className="space-y-2">
            {sortedVersions.map((version) => {
              const isSelected = selectedVersionId === version.id;
              const isCurrent = currentVersionId === version.id;
              const isPublished = !!version.publishedAt;

              return (
                <div
                  key={version.id}
                  className={cn(
                    "p-3 rounded-lg border cursor-pointer transition-all",
                    "hover:bg-muted/50",
                    isSelected && "bg-muted border-primary",
                    isCurrent && "ring-2 ring-primary ring-offset-1"
                  )}
                  onClick={() => onSelectVersion(version.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectVersion(version.id);
                    }
                  }}
                >
                  {/* Header row */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        v{version.versionNumber}
                      </span>
                      {isCurrent && (
                        <Check className="h-3 w-3 text-primary" />
                      )}
                    </div>
                    <Badge
                      variant={isPublished ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {isPublished ? "Published" : "Draft"}
                    </Badge>
                  </div>

                  {/* Date and publisher info */}
                  <div className="mt-1 text-xs text-muted-foreground">
                    {isPublished && version.publishedAt ? (
                      <>
                        {format(new Date(version.publishedAt), "MMM d, yyyy")}
                        {version.publisher?.name && (
                          <span> by {version.publisher.name}</span>
                        )}
                      </>
                    ) : (
                      <>Created {format(new Date(version.createdAt), "MMM d, yyyy")}</>
                    )}
                  </div>

                  {/* Current version indicator */}
                  {isCurrent && (
                    <div className="mt-1.5 text-xs text-primary font-medium">
                      Active version
                    </div>
                  )}

                  {/* Create from this button (only for published versions) */}
                  {isPublished && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-full mt-2 h-7 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCreateFromVersion(version.id);
                      }}
                    >
                      <Copy className="h-3 w-3 mr-1.5" />
                      Create new from this
                    </Button>
                  )}
                </div>
              );
            })}

            {versions.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-8">
                No versions yet
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
