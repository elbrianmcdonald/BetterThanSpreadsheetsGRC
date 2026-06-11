"use client";

/**
 * Stale Drafts Dashboard Widget
 *
 * Displays a widget showing draft assessments that haven't been updated in X days.
 *
 * Story 7.13: Stale Draft Dashboard Widget
 * AC4: Widget displays on main dashboard
 * AC5: Widget title: "Stale Draft Assessments"
 * AC6: Widget shows count of stale assessments
 * AC7: Widget shows list of up to 5 stale assessments (sorted by oldest first)
 * AC9: "View All" link navigates to filtered assessments list
 * AC10: Widget shows "All clear!" when no stale drafts
 * AC16: Widget refreshes on dashboard load
 * AC17: Optional: Manual refresh button
 * AC18: Loading state while fetching
 * AC19: Warning color scheme (yellow/orange) for attention
 * AC22: Consistent with other dashboard widgets
 */

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Loader2,
  RefreshCw,
  CheckCircle,
} from "lucide-react";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StaleDraftItem } from "./StaleDraftItem";

interface StaleDraftsWidgetProps {
  className?: string;
  /** Number of days to consider a draft stale (default: 7) */
  daysThreshold?: number;
}

/**
 * Dashboard widget showing draft assessments that have not been updated.
 *
 * @example
 * ```tsx
 * <StaleDraftsWidget />
 * <StaleDraftsWidget daysThreshold={14} />
 * ```
 */
export function StaleDraftsWidget({
  className,
  daysThreshold = 7,
}: StaleDraftsWidgetProps) {
  const {
    data,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = api.riskAssessment.listStale.useQuery({
    daysThreshold,
    limit: 5,
  });

  // Loading state
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-[17px] w-[17px] text-primary" />
            Stale Draft Assessments
          </CardTitle>
          <CardDescription>
            Drafts not updated in {daysThreshold}+ days
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-[17px] w-[17px] text-primary" />
            Stale Draft Assessments
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-6 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive mb-2" />
          <p className="text-sm text-muted-foreground">
            Unable to load stale drafts
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            className="mt-2"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const hasStale = data && data.count > 0;
  const showViewAll = data && data.count > 5;

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-[17px] w-[17px] text-primary" />
            Stale Draft Assessments
            {hasStale && (
              <Badge variant="warning" className="ml-1">
                {data.count}
              </Badge>
            )}
          </CardTitle>

          {/* Refresh button (AC17) */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="text-muted-foreground/70 hover:text-foreground"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <CardDescription>
          Drafts not updated in {daysThreshold}+ days
        </CardDescription>
      </CardHeader>

      <CardContent>
        {hasStale ? (
          <div className="space-y-1">
            {data.items.map((item) => (
              <StaleDraftItem key={item.id} assessment={item} />
            ))}
          </div>
        ) : (
          <div className="text-center py-4">
            <CheckCircle className="h-10 w-10 text-success mx-auto mb-2" />
            <p className="text-sm font-medium text-success">All clear!</p>
            <p className="text-xs text-muted-foreground mt-1">
              No stale drafts found
            </p>
          </div>
        )}
      </CardContent>

      {/* View All link (AC9) */}
      {showViewAll && (
        <CardFooter className="pt-0">
          <Button variant="ghost" size="sm" asChild className="w-full">
            <Link href="/assessments?status=DRAFT&sort=updatedAt&order=asc">
              View all {data.count} stale drafts
              <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
