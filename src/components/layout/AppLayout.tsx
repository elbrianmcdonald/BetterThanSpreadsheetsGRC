"use client";

/**
 * Application Layout Component
 *
 * Provides consistent layout with sidebar navigation and top bar
 * for all authenticated pages.
 */

import type { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { AppTopBar } from "./AppTopBar";
import { type BreadcrumbItem } from "./AppBreadcrumb";
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
  fullWidth = true,
  showBreadcrumbs = true,
}: AppLayoutProps) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar Navigation */}
      <AppSidebar />

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Bar (breadcrumbs live here) */}
        <AppTopBar breadcrumbs={showBreadcrumbs ? breadcrumbs : []} />

        {/* Page Content */}
        <main
          className={cn(
            "flex-1 px-9 pb-16 pt-[30px]",
            fullWidth ? "w-full" : "mx-auto w-full max-w-[1240px]",
            className
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

// Re-export for convenience
export type { BreadcrumbItem };
