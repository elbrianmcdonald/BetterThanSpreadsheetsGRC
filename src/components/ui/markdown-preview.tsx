"use client";

/**
 * Markdown Preview Component
 *
 * Renders markdown content as sanitized HTML.
 *
 * Story 4.3: AC3, AC5, AC23
 * - AC3: Description field shows live markdown preview below textarea
 * - AC5: Description renders as formatted HTML on risk detail pages
 * - AC23: Risk detail page shows finding description as rendered markdown
 *
 * @see Story 4.3: Risk Finding Documentation
 */

import { useMemo } from "react";
import { markdownToHtml } from "@/lib/markdown";
import { cn } from "@/lib/utils";

interface MarkdownPreviewProps {
  /** The markdown content to render */
  content: string;
  /** Additional CSS classes for the container */
  className?: string;
  /** Maximum height before scrolling (default: no max) */
  maxHeight?: string;
}

/**
 * Renders markdown content as sanitized HTML
 *
 * @example
 * ```tsx
 * <MarkdownPreview content="# Hello\n\nThis is **bold** text." />
 * ```
 */
export function MarkdownPreview({
  content,
  className,
  maxHeight,
}: MarkdownPreviewProps) {
  const html = useMemo(() => markdownToHtml(content), [content]);

  if (!content) {
    return (
      <div className={cn("text-muted-foreground italic text-sm", className)}>
        No content to preview
      </div>
    );
  }

  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none",
        "prose-headings:font-semibold prose-headings:text-foreground",
        "prose-p:text-foreground prose-p:leading-relaxed",
        "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
        "prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm",
        "prose-pre:bg-muted prose-pre:border prose-pre:border-border",
        "prose-blockquote:border-l-primary/50 prose-blockquote:text-muted-foreground",
        "prose-ul:list-disc prose-ol:list-decimal",
        maxHeight && "overflow-y-auto",
        className
      )}
      style={maxHeight ? { maxHeight } : undefined}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/**
 * Inline markdown preview for single-line content
 */
export function InlineMarkdownPreview({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const html = useMemo(() => markdownToHtml(content), [content]);

  return (
    <span
      className={cn("inline", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
