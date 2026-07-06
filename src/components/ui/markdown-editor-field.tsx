"use client";

/**
 * Markdown editor field — formatting toolbar + edit/preview toggle around a
 * textarea, rendering previews via MarkdownPreview.
 *
 * Extracted from the CreateRiskForm description/technicalDetails pattern
 * (Story 4.3 AC3/AC6) so the findings register form can offer the identical
 * documentation experience (Story 20.1 follow-up). Controlled value/onChange
 * interface — works inside react-hook-form FormControl or plain state.
 */

import { useRef, useState } from "react";
import { Bold, Italic, Code, List, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownPreview } from "@/components/ui/markdown-preview";
import { cn } from "@/lib/utils";

type MarkdownFormat = "bold" | "italic" | "code" | "list" | "link";

export interface MarkdownEditorFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Rendered left of the toolbar (e.g., the FormLabel). */
  label?: React.ReactNode;
  placeholder?: string;
  /** Tailwind min-height for both editor and preview (default min-h-40). */
  minHeightClass?: string;
  /**
   * Toolbar variant: "full" = bold/italic/code/list/link (description),
   * "compact" = bold/code/list (technical details).
   */
  toolbar?: "full" | "compact";
  /** Forwarded to the textarea (react-hook-form field name, cursor ops). */
  name?: string;
}

export function MarkdownEditorField({
  value,
  onChange,
  label,
  placeholder,
  minHeightClass = "min-h-40",
  toolbar = "full",
  name,
}: MarkdownEditorFieldProps) {
  const [showPreview, setShowPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  /** Insert markdown formatting at the cursor position. */
  const insertMarkdown = (format: MarkdownFormat) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);

    let insertion = "";
    let cursorOffset = 0;

    switch (format) {
      case "bold":
        insertion = `**${selectedText || "bold text"}**`;
        cursorOffset = selectedText ? insertion.length : 2;
        break;
      case "italic":
        insertion = `*${selectedText || "italic text"}*`;
        cursorOffset = selectedText ? insertion.length : 1;
        break;
      case "code":
        if (selectedText.includes("\n")) {
          insertion = `\`\`\`\n${selectedText || "code"}\n\`\`\``;
        } else {
          insertion = `\`${selectedText || "code"}\``;
        }
        cursorOffset = selectedText ? insertion.length : 1;
        break;
      case "list":
        insertion = `\n- ${selectedText || "list item"}`;
        cursorOffset = insertion.length;
        break;
      case "link":
        insertion = `[${selectedText || "link text"}](url)`;
        cursorOffset = selectedText ? insertion.length - 1 : 11;
        break;
    }

    onChange(value.substring(0, start) + insertion + value.substring(end));

    // Restore focus and cursor position after the controlled update lands.
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + cursorOffset, start + cursorOffset);
    }, 0);
  };

  const buttons: { format: MarkdownFormat; title: string; icon: React.ReactNode }[] = [
    { format: "bold", title: "Bold", icon: <Bold className="h-3.5 w-3.5" /> },
    ...(toolbar === "full"
      ? [{ format: "italic" as const, title: "Italic", icon: <Italic className="h-3.5 w-3.5" /> }]
      : []),
    { format: "code", title: "Code", icon: <Code className="h-3.5 w-3.5" /> },
    { format: "list", title: "List", icon: <List className="h-3.5 w-3.5" /> },
    ...(toolbar === "full"
      ? [{ format: "link" as const, title: "Link", icon: <Link2 className="h-3.5 w-3.5" /> }]
      : []),
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        {label ?? <span />}
        <div className="flex items-center gap-1 ml-auto">
          {buttons.map((b) => (
            <Button
              key={b.format}
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              title={b.title}
              onClick={() => insertMarkdown(b.format)}
            >
              {b.icon}
            </Button>
          ))}
          <div className="w-px h-4 bg-border mx-1" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? "Edit" : "Preview"}
          </Button>
        </div>
      </div>
      {showPreview ? (
        <div className={cn(minHeightClass, "rounded-md border bg-muted/30 p-3")}>
          <MarkdownPreview content={value} />
        </div>
      ) : (
        <Textarea
          ref={textareaRef}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(minHeightClass, "font-mono text-sm")}
        />
      )}
    </div>
  );
}
