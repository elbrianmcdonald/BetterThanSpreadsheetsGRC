"use client";

/**
 * Application Breadcrumb Navigation
 *
 * Displays breadcrumb trail for navigation context.
 *
 * Story 5.3: Breadcrumb Navigation
 * AC4: Truncate titles > 30 chars with ellipsis, show full title on hover
 * AC5: Client-side navigation via Next.js Link
 * AC6: Consistent styling across app
 */

import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface AppBreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
  /** Maximum characters before truncation (default: 30) */
  maxLength?: number;
}

/** Truncate text and add ellipsis if exceeds max length (AC4) */
function truncateText(text: string, maxLength: number): { truncated: string; isTruncated: boolean } {
  if (text.length <= maxLength) {
    return { truncated: text, isTruncated: false };
  }
  return { truncated: text.substring(0, maxLength) + "...", isTruncated: true };
}

/** Breadcrumb label with optional truncation and tooltip */
function BreadcrumbLabel({
  label,
  maxLength,
  isLink,
}: {
  label: string;
  maxLength: number;
  isLink: boolean;
}) {
  const { truncated, isTruncated } = truncateText(label, maxLength);

  const labelElement = (
    <span
      className={cn(
        "ml-2 text-sm font-medium",
        isLink ? "text-gray-500 hover:text-gray-700" : "text-gray-700"
      )}
    >
      {truncated}
    </span>
  );

  // AC4: Show full title on hover when truncated
  if (isTruncated) {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            {labelElement}
          </TooltipTrigger>
          <TooltipContent>
            <p className="max-w-xs">{label}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return labelElement;
}

export function AppBreadcrumb({ items, className, maxLength = 30 }: AppBreadcrumbProps) {
  return (
    <nav className={cn("flex", className)} aria-label="Breadcrumb">
      <ol className="flex items-center space-x-2">
        <li>
          <Link
            href="/"
            className="text-gray-400 hover:text-gray-500 flex items-center"
          >
            <Home className="h-4 w-4" />
            <span className="sr-only">Home</span>
          </Link>
        </li>
        {items.map((item, index) => (
          <li key={index} className="flex items-center">
            <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-400" />
            {item.href ? (
              <Link href={item.href} className="flex items-center">
                <BreadcrumbLabel label={item.label} maxLength={maxLength} isLink={true} />
              </Link>
            ) : (
              <BreadcrumbLabel label={item.label} maxLength={maxLength} isLink={false} />
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
