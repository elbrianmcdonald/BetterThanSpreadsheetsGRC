"use client";

/**
 * Controls Documentation Component
 *
 * Story 16.3: Risk Form Controls Documentation
 *
 * Provides a collapsible section for documenting risk controls:
 * - AC7: "Controls Documentation" section with 4 textareas
 * - AC8: Mitigating Controls in Place field
 * - AC9: Preventative Controls in Place field
 * - AC10: Mitigating Controls Needed field
 * - AC11: Preventative Controls Needed field
 * - AC12-AC14: Markdown support with toolbar and preview
 *
 * @see Story 16.3: Risk Form Controls Documentation
 */

import { useState, useCallback } from "react";
import {
  Shield,
  ShieldCheck,
  ShieldPlus,
  ChevronDown,
  ChevronRight,
  Bold,
  Italic,
  Code,
  List,
  Link2,
} from "lucide-react";
import type { UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { MarkdownPreview } from "@/components/ui/markdown-preview";
import { cn } from "@/lib/utils";

/**
 * Control field configuration
 */
interface ControlField {
  name: "mitigatingControlsInPlace" | "preventativeControlsInPlace" | "mitigatingControlsNeeded" | "preventativeControlsNeeded";
  label: string;
  description: string;
  placeholder: string;
  icon: React.ComponentType<{ className?: string }>;
  category: "inPlace" | "needed";
}

const CONTROL_FIELDS: ControlField[] = [
  {
    name: "mitigatingControlsInPlace",
    label: "Mitigating Controls in Place",
    description: "Document controls that reduce the impact of this risk if it materializes",
    placeholder: `List current mitigating controls:
- Backup procedures and recovery processes
- Incident response plan for this risk type
- Insurance or financial reserves
- Manual workarounds available`,
    icon: ShieldCheck,
    category: "inPlace",
  },
  {
    name: "preventativeControlsInPlace",
    label: "Preventative Controls in Place",
    description: "Document controls that prevent this risk from occurring",
    placeholder: `List current preventative controls:
- Access control measures
- Security monitoring and alerting
- Automated scanning or testing
- Policy enforcement mechanisms`,
    icon: Shield,
    category: "inPlace",
  },
  {
    name: "mitigatingControlsNeeded",
    label: "Mitigating Controls Needed",
    description: "Document additional controls needed to reduce impact",
    placeholder: `List needed mitigating controls:
- Enhanced backup procedures
- Improved incident response
- Additional training for staff
- Better recovery processes`,
    icon: ShieldPlus,
    category: "needed",
  },
  {
    name: "preventativeControlsNeeded",
    label: "Preventative Controls Needed",
    description: "Document additional controls needed to prevent this risk",
    placeholder: `List needed preventative controls:
- Stronger access controls
- Additional security tools
- Process improvements
- Policy updates`,
    icon: ShieldPlus,
    category: "needed",
  },
];

interface ControlsDocumentationProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>;
  /** Whether the form is in read-only mode */
  isReadOnly?: boolean;
  /** Whether the section starts expanded */
  defaultExpanded?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * A single control field with markdown toolbar and preview
 */
function ControlField({
  field,
  form,
  isReadOnly,
}: {
  field: ControlField;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>;
  isReadOnly?: boolean;
}) {
  const [showPreview, setShowPreview] = useState(false);
  const fieldValue = form.watch(field.name);

  /**
   * Insert markdown formatting at cursor position
   */
  const insertMarkdown = useCallback((format: string) => {
    const textarea = document.querySelector(
      `textarea[name="${field.name}"]`
    ) as HTMLTextAreaElement | null;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);

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

    const newValue = text.substring(0, start) + insertion + text.substring(end);
    form.setValue(field.name, newValue);

    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + cursorOffset, start + cursorOffset);
    }, 0);
  }, [field.name, form]);

  const Icon = field.icon;

  return (
    <FormField
      control={form.control}
      name={field.name}
      render={({ field: formField }) => (
        <FormItem>
          <div className="flex items-center justify-between">
            <FormLabel className="flex items-center gap-2">
              <Icon className={cn(
                "h-4 w-4",
                field.category === "inPlace" ? "text-green-600" : "text-amber-600"
              )} />
              {field.label}
            </FormLabel>
            {!isReadOnly && (
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  title="Bold"
                  onClick={() => insertMarkdown("bold")}
                >
                  <Bold className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  title="Italic"
                  onClick={() => insertMarkdown("italic")}
                >
                  <Italic className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  title="Code"
                  onClick={() => insertMarkdown("code")}
                >
                  <Code className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  title="List"
                  onClick={() => insertMarkdown("list")}
                >
                  <List className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  title="Link"
                  onClick={() => insertMarkdown("link")}
                >
                  <Link2 className="h-3.5 w-3.5" />
                </Button>
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
            )}
          </div>
          <FormControl>
            {showPreview || isReadOnly ? (
              <div className="min-h-24 rounded-md border bg-muted/30 p-3">
                {fieldValue ? (
                  <MarkdownPreview content={fieldValue} />
                ) : (
                  <span className="text-muted-foreground text-sm italic">
                    {isReadOnly ? "No controls documented" : "Nothing to preview"}
                  </span>
                )}
              </div>
            ) : (
              <Textarea
                placeholder={field.placeholder}
                className="min-h-24 font-mono text-sm"
                {...formField}
                value={formField.value ?? ""}
              />
            )}
          </FormControl>
          <FormDescription>{field.description}</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/**
 * Controls Documentation section for risk forms.
 *
 * Provides a collapsible section with 4 control fields for documenting
 * both in-place and needed controls (mitigating and preventative).
 *
 * @example
 * ```tsx
 * <ControlsDocumentation form={form} defaultExpanded={true} />
 * ```
 */
export function ControlsDocumentation({
  form,
  isReadOnly = false,
  defaultExpanded = false,
  className,
}: ControlsDocumentationProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Check if any control fields have content
  const hasContent = CONTROL_FIELDS.some(
    (field) => form.watch(field.name)?.trim()
  );

  return (
    <div className={cn("border rounded-lg", className)}>
      <button
        type="button"
        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <Shield className="h-5 w-5 text-primary" />
          <span className="font-medium">Controls Documentation</span>
          {hasContent && !isExpanded && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
              Documented
            </span>
          )}
          {!hasContent && !isReadOnly && (
            <span className="text-sm text-muted-foreground">(Optional)</span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          Markdown supported
        </span>
      </button>

      {isExpanded && (
        <div className="border-t p-4 space-y-6">
          {/* In Place Controls */}
          <Card className="bg-green-50/50 dark:bg-green-950/20">
            <CardContent className="p-4 space-y-4">
              <p className="text-sm font-medium text-green-800 dark:text-green-300 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Current Controls in Place
              </p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {CONTROL_FIELDS.filter((f) => f.category === "inPlace").map(
                  (field) => (
                    <ControlField
                      key={field.name}
                      field={field}
                      form={form}
                      isReadOnly={isReadOnly}
                    />
                  )
                )}
              </div>
            </CardContent>
          </Card>

          {/* Needed Controls */}
          <Card className="bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="p-4 space-y-4">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300 flex items-center gap-2">
                <ShieldPlus className="h-4 w-4" />
                Additional Controls Needed
              </p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {CONTROL_FIELDS.filter((f) => f.category === "needed").map(
                  (field) => (
                    <ControlField
                      key={field.name}
                      field={field}
                      form={form}
                      isReadOnly={isReadOnly}
                    />
                  )
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
