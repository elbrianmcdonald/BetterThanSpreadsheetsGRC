"use client";

/**
 * Overdue Controls Dashboard Widget
 *
 * Surfaces organizational controls whose next test is overdue.
 * Sub-Epic C.5 (tech-spec: docs/sprint-artifacts/tech-spec-org-controls-redesign.md)
 */

import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle, Loader2 } from "lucide-react";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function daysSince(date: Date | string | null | undefined): number | null {
  if (!date) return null;
  const ms = Date.now() - new Date(date).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function OverdueControlsWidget({ className }: { className?: string }) {
  const { data, isLoading, error } = api.organizationalControl.overdueTests.useQuery({
    limit: 5,
  });

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-[17px] w-[17px] text-primary" />
            Overdue Control Tests
          </CardTitle>
          <CardDescription>Controls whose next test date has passed</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-[17px] w-[17px] text-primary" />
            Overdue Control Tests
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{error.message}</p>
        </CardContent>
      </Card>
    );
  }

  const total = data?.total ?? 0;
  const controls = data?.controls ?? [];

  if (total === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-[17px] w-[17px] text-success" />
            Overdue Control Tests
          </CardTitle>
          <CardDescription>Controls whose next test date has passed</CardDescription>
        </CardHeader>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          All clear — no overdue controls.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-[17px] w-[17px] text-primary" />
          Overdue Control Tests
          <Badge variant="critical" className="ml-auto">
            {total}
          </Badge>
        </CardTitle>
        <CardDescription>
          {total === 1 ? "1 control has" : `${total} controls have`} passed their next-test date.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {controls.map((c) => {
          const days = daysSince(c.nextTestDueDate);
          return (
            <Link
              key={c.id}
              href={`/controls/${c.id}`}
              className="flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-secondary"
            >
              <Badge variant="code" className="w-20 shrink-0 justify-center">
                {c.localControlId}
              </Badge>
              <span className="flex-1 truncate text-sm font-semibold text-foreground">
                {c.name}
              </span>
              {days !== null && (
                <Badge variant="critical">{days}d overdue</Badge>
              )}
            </Link>
          );
        })}
      </CardContent>
      <CardFooter>
        <Button variant="outline" size="sm" asChild className="ml-auto">
          <Link href="/controls?overdue=true">
            View all
            <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
