"use client";

/**
 * Application Layout Component
 *
 * Provides consistent layout with navigation and breadcrumbs
 * for all authenticated pages.
 */

import type { ReactNode } from "react";
import { AppNav } from "./AppNav";
import { AppBreadcrumb, type BreadcrumbItem } from "./AppBreadcrumb";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: ReactNode;
  /** Breadcrumb items (excluding Home which is automatic) */
  breadcrumbs?: BreadcrumbItem[];
  /** Additional className for the main content area */
  className?: string;
  /** Whether to use full width or constrained width */
  fullWidth?: boolean;
  /** Whether to show breadcrumbs */
  showBreadcrumbs?: boolean;
}

export function AppLayout({
  children,
  breadcrumbs = [],
  className,
  fullWidth = false,
  showBreadcrumbs = true,
}: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <AppNav />

      {showBreadcrumbs && breadcrumbs.length > 0 && (
        <div className={cn(
          "px-4 sm:px-6 lg:px-8 py-4",
          !fullWidth && "mx-auto max-w-7xl"
        )}>
          <AppBreadcrumb items={breadcrumbs} />
        </div>
      )}

      <main
        className={cn(
          "px-4 sm:px-6 lg:px-8 pb-8",
          !fullWidth && "mx-auto max-w-7xl",
          !showBreadcrumbs && "pt-6",
          className
        )}
      >
        {children}
      </main>
    </div>
  );
}

// Re-export for convenience
export type { BreadcrumbItem };
