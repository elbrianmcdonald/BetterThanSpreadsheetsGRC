/**
 * Markdown Utilities
 *
 * Provides safe markdown rendering with sanitization to prevent XSS attacks.
 *
 * Story 4.3: Task 6 - Markdown Sanitization
 * AC3: Description field shows live markdown preview
 * AC5: Description renders as formatted HTML on risk detail pages
 *
 * This is a lightweight implementation that sanitizes HTML output
 * without requiring heavy dependencies like DOMPurify.
 *
 * @see Story 4.3: Risk Finding Documentation
 */

/**
 * Escapes HTML special characters to prevent XSS
 */
function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return text.replace(/[&<>"']/g, (char) => htmlEscapes[char] || char);
}

/**
 * Converts markdown to sanitized HTML
 *
 * Supports:
 * - Headers (# ## ###)
 * - Bold (**text**)
 * - Italic (*text* or _text_)
 * - Code blocks (```code```)
 * - Inline code (`code`)
 * - Unordered lists (- item)
 * - Ordered lists (1. item)
 * - Links ([text](url))
 * - Blockquotes (> text)
 * - Horizontal rules (---)
 * - Paragraphs
 *
 * All output is sanitized to prevent XSS attacks.
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown) return "";

  // Split into lines for processing
  const lines = markdown.split("\n");
  const result: string[] = [];
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let inList = false;
  let listType: "ul" | "ol" | null = null;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i] || "";

    // Handle code blocks
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        // End code block
        result.push(
          `<pre class="bg-muted p-3 rounded-md overflow-x-auto my-2"><code>${codeBlockContent.join("\n")}</code></pre>`
        );
        codeBlockContent = [];
        inCodeBlock = false;
      } else {
        // Start code block
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(escapeHtml(line));
      continue;
    }

    // Handle lists
    const unorderedListMatch = line.match(/^[-*]\s+(.+)$/);
    const orderedListMatch = line.match(/^\d+\.\s+(.+)$/);

    if (unorderedListMatch) {
      if (!inList || listType !== "ul") {
        if (inList) result.push(listType === "ol" ? "</ol>" : "</ul>");
        result.push('<ul class="list-disc list-inside my-2 space-y-1">');
        inList = true;
        listType = "ul";
      }
      result.push(`<li>${processInlineMarkdown(unorderedListMatch[1] || "")}</li>`);
      continue;
    }

    if (orderedListMatch) {
      if (!inList || listType !== "ol") {
        if (inList) result.push(listType === "ol" ? "</ol>" : "</ul>");
        result.push('<ol class="list-decimal list-inside my-2 space-y-1">');
        inList = true;
        listType = "ol";
      }
      result.push(`<li>${processInlineMarkdown(orderedListMatch[1] || "")}</li>`);
      continue;
    }

    // Close list if we're no longer in one
    if (inList && !unorderedListMatch && !orderedListMatch) {
      result.push(listType === "ol" ? "</ol>" : "</ul>");
      inList = false;
      listType = null;
    }

    // Handle headers
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      const level = headerMatch[1]?.length || 1;
      const headerClasses: Record<number, string> = {
        1: "text-xl font-bold mt-4 mb-2",
        2: "text-lg font-bold mt-3 mb-2",
        3: "text-base font-semibold mt-2 mb-1",
        4: "text-sm font-semibold mt-2 mb-1",
        5: "text-sm font-medium mt-1 mb-1",
        6: "text-xs font-medium mt-1 mb-1",
      };
      result.push(
        `<h${level} class="${headerClasses[level] || ""}">${processInlineMarkdown(headerMatch[2] || "")}</h${level}>`
      );
      continue;
    }

    // Handle blockquotes
    if (line.startsWith("> ")) {
      result.push(
        `<blockquote class="border-l-4 border-muted-foreground/30 pl-4 italic my-2">${processInlineMarkdown(line.slice(2))}</blockquote>`
      );
      continue;
    }

    // Handle horizontal rules
    if (/^[-*_]{3,}$/.test(line.trim())) {
      result.push('<hr class="my-4 border-t border-border">');
      continue;
    }

    // Handle empty lines
    if (line.trim() === "") {
      result.push("");
      continue;
    }

    // Handle regular paragraphs
    result.push(
      `<p class="my-1">${processInlineMarkdown(line)}</p>`
    );
  }

  // Close any open lists
  if (inList) {
    result.push(listType === "ol" ? "</ol>" : "</ul>");
  }

  // Close any open code blocks
  if (inCodeBlock) {
    result.push(
      `<pre class="bg-muted p-3 rounded-md overflow-x-auto my-2"><code>${codeBlockContent.join("\n")}</code></pre>`
    );
  }

  return result.join("\n");
}

/**
 * Processes inline markdown elements (bold, italic, code, links)
 */
function processInlineMarkdown(text: string): string {
  let result = escapeHtml(text);

  // Inline code (must be processed before bold/italic to avoid conflicts)
  result = result.replace(
    /`([^`]+)`/g,
    '<code class="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">$1</code>'
  );

  // Bold (**text** or __text__)
  result = result.replace(
    /\*\*([^*]+)\*\*/g,
    '<strong class="font-bold">$1</strong>'
  );
  result = result.replace(
    /__([^_]+)__/g,
    '<strong class="font-bold">$1</strong>'
  );

  // Italic (*text* or _text_) - be careful not to match ** or __
  result = result.replace(
    /(?<!\*)\*([^*]+)\*(?!\*)/g,
    '<em class="italic">$1</em>'
  );
  result = result.replace(
    /(?<!_)_([^_]+)_(?!_)/g,
    '<em class="italic">$1</em>'
  );

  // Links [text](url) - sanitize URL
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => {
    const sanitizedUrl = sanitizeUrl(url);
    if (sanitizedUrl) {
      return `<a href="${sanitizedUrl}" class="text-primary underline hover:no-underline" target="_blank" rel="noopener noreferrer">${text}</a>`;
    }
    return text; // If URL is invalid, just return the text
  });

  return result;
}

/**
 * Sanitizes a URL to prevent javascript: and other dangerous protocols
 */
function sanitizeUrl(url: string): string | null {
  try {
    const trimmed = url.trim();

    // Allow relative URLs
    if (trimmed.startsWith("/") || trimmed.startsWith("#")) {
      return escapeHtml(trimmed);
    }

    // Parse and validate URL
    const parsed = new URL(trimmed);

    // Only allow safe protocols
    const safeProtocols = ["http:", "https:", "mailto:"];
    if (!safeProtocols.includes(parsed.protocol)) {
      return null;
    }

    return escapeHtml(trimmed);
  } catch {
    // If URL parsing fails, it might be a relative path
    if (/^[a-zA-Z0-9_\-/.#?&=]+$/.test(url)) {
      return escapeHtml(url);
    }
    return null;
  }
}

/**
 * Strips markdown formatting and returns plain text
 * Useful for previews and summaries
 */
export function stripMarkdown(markdown: string): string {
  if (!markdown) return "";

  let result = markdown;

  // Remove code blocks
  result = result.replace(/```[\s\S]*?```/g, "");

  // Remove inline code
  result = result.replace(/`[^`]+`/g, "");

  // Remove headers
  result = result.replace(/^#{1,6}\s+/gm, "");

  // Remove bold
  result = result.replace(/\*\*([^*]+)\*\*/g, "$1");
  result = result.replace(/__([^_]+)__/g, "$1");

  // Remove italic
  result = result.replace(/\*([^*]+)\*/g, "$1");
  result = result.replace(/_([^_]+)_/g, "$1");

  // Remove links, keep text
  result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // Remove blockquotes
  result = result.replace(/^>\s+/gm, "");

  // Remove list markers
  result = result.replace(/^[-*]\s+/gm, "");
  result = result.replace(/^\d+\.\s+/gm, "");

  // Remove horizontal rules
  result = result.replace(/^[-*_]{3,}$/gm, "");

  // Collapse multiple newlines
  result = result.replace(/\n{3,}/g, "\n\n");

  return result.trim();
}

/**
 * Truncates markdown text to a specified length
 * Strips formatting first to get accurate length
 */
export function truncateMarkdown(
  markdown: string,
  maxLength: number,
  suffix = "..."
): string {
  const plain = stripMarkdown(markdown);
  if (plain.length <= maxLength) {
    return plain;
  }
  return plain.slice(0, maxLength - suffix.length).trim() + suffix;
}
