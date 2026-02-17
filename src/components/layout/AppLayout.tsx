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
  fullWidth = true,
  showBreadcrumbs = true,
}: AppLayoutProps) {
  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar Navigation */}
      <AppSidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <AppTopBar />

        {/* Breadcrumbs */}
        {showBreadcrumbs && breadcrumbs.length > 0 && (
          <div className={cn(
            "px-6 py-4 bg-white border-b",
            !fullWidth && "max-w-7xl"
          )}>
            <AppBreadcrumb items={breadcrumbs} />
          </div>
        )}

        {/* Page Content */}
        <main
          className={cn(
            "flex-1 px-6 py-6",
            !fullWidth && "max-w-7xl",
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
