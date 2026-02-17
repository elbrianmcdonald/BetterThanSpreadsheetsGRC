"use client";

/**
 * Business Impact Statement Display Component
 *
 * Displays the auto-generated business impact statement with section formatting,
 * disclaimer, and edit button for GRC Analysts.
 *
 * Story 4.8: Business Impact Statement Display (AC23-AC27)
 * AC23: Risk detail page shows "Business Impact" section prominently
 * AC24: Impact statement rendered as formatted HTML with section headings
 * AC25: Each section (Regulatory, Operational, Context) visually separated
 * AC26: Includes disclaimer: "Auto-generated assessment based on risk attributes"
 * AC27: GRC_ANALYST can manually edit impact statement if auto-generation inadequate
 *
 * @see Story 4.8: Automated Business Impact Statement Generation
 */

import { FileText, Edit2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface BusinessImpactStatementProps {
  /** The business impact statement markdown content */
  statement: string | null | undefined;
  /** Whether the statement was manually edited */
  isManuallyEdited: boolean;
  /** When the statement was last generated */
  generatedAt: Date | null | undefined;
  /** Whether the current user can edit the statement (GRC_ANALYST, ORG_ADMIN) */
  canEdit?: boolean;
  /** Callback when user clicks the edit button */
  onEditClick?: () => void;
  /** Callback when user clicks regenerate button */
  onRegenerateClick?: () => void;
  /** Whether the component is loading */
  isLoading?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Parse markdown into HTML-safe sections
 */
function parseMarkdownSections(markdown: string): {
  regulatory: string;
  operational: string;
  businessContext: string;
} {
  // Split by section headers
  const sections = {
    regulatory: "",
    operational: "",
    businessContext: "",
  };

  // Regex to find sections
  const regulatoryMatch = markdown.match(/## Regulatory Impact\n\n([\s\S]*?)(?=## |$)/);
  const operationalMatch = markdown.match(/## Operational Impact\n\n([\s\S]*?)(?=## |$)/);
  const businessMatch = markdown.match(/## Business Context\n\n([\s\S]*?)(?=## |$)/);

  if (regulatoryMatch) sections.regulatory = regulatoryMatch[1]?.trim() ?? "";
  if (operationalMatch) sections.operational = operationalMatch[1]?.trim() ?? "";
  if (businessMatch) sections.businessContext = businessMatch[1]?.trim() ?? "";

  return sections;
}

/**
 * Simple markdown to HTML converter for bold text
 */
function markdownToHtml(text: string): string {
  // Convert **text** to <strong>text</strong>
  return text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

/**
 * Business Impact Statement section component
 */
function ImpactSection({
  title,
  content,
  icon,
  colorClass,
}: {
  title: string;
  content: string;
  icon: React.ReactNode;
  colorClass: string;
}) {
  if (!content) return null;

  // Split paragraphs and convert markdown
  const paragraphs = content.split("\n\n").filter((p) => p.trim());

  return (
    <div className="space-y-2">
      <div className={cn("flex items-center gap-2 font-semibold", colorClass)}>
        {icon}
        {title}
      </div>
      <div className="space-y-3 pl-6">
        {paragraphs.map((paragraph, index) => (
          <p
            key={index}
            className="text-sm text-muted-foreground leading-relaxed"
            dangerouslySetInnerHTML={{ __html: markdownToHtml(paragraph) }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Displays the business impact statement with formatted sections.
 *
 * @example
 * ```tsx
 * <BusinessImpactStatement
 *   statement={risk.businessImpactStatement}
 *   isManuallyEdited={risk.impactStatementManuallyEdited}
 *   generatedAt={risk.impactStatementGeneratedAt}
 *   canEdit={userRole === "GRC_ANALYST"}
 *   onEditClick={() => setEditDialogOpen(true)}
 * />
 * ```
 */
export function BusinessImpactStatement({
  statement,
  isManuallyEdited,
  generatedAt,
  canEdit = false,
  onEditClick,
  onRegenerateClick,
  isLoading = false,
  className,
}: BusinessImpactStatementProps) {
  // Loading state
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-8 w-20" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-5/6" />
        </CardContent>
      </Card>
    );
  }

  // No statement yet
  if (!statement) {
    return (
      <Card className={cn("border-dashed", className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5 text-muted-foreground" />
              Business Impact
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              No business impact statement generated yet.
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Link evidence to this risk to generate an impact assessment.
            </p>
            {canEdit && onRegenerateClick && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={onRegenerateClick}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Generate Statement
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Parse sections
  const sections = parseMarkdownSections(statement);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-primary" />
            Business Impact
          </CardTitle>

          <div className="flex items-center gap-2">
            {/* AC26: Manually edited badge */}
            {isManuallyEdited && (
              <Badge variant="outline" className="text-xs">
                Manually edited
              </Badge>
            )}

            {/* AC27: Edit button for GRC_ANALYST */}
            {canEdit && (
              <div className="flex gap-1">
                {isManuallyEdited && onRegenerateClick && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onRegenerateClick}
                    title="Regenerate auto-generated statement"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                )}
                {onEditClick && (
                  <Button variant="ghost" size="sm" onClick={onEditClick}>
                    <Edit2 className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* AC26: Disclaimer */}
        <div className="flex items-start gap-2 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            <span className="font-medium">Auto-generated assessment</span> based on
            risk attributes, severity, affected frameworks, and asset criticality.
            {isManuallyEdited
              ? " This statement has been manually edited."
              : " Review and edit as needed for your organization's context."}
          </div>
        </div>

        {/* AC25: Visually separated sections */}
        <div className="space-y-6">
          {/* Regulatory Impact */}
          <ImpactSection
            title="Regulatory Impact"
            content={sections.regulatory}
            icon={<span className="text-lg">&#9878;</span>}
            colorClass="text-blue-600 dark:text-blue-400"
          />

          {/* Operational Impact */}
          <ImpactSection
            title="Operational Impact"
            content={sections.operational}
            icon={<span className="text-lg">&#9881;</span>}
            colorClass="text-amber-600 dark:text-amber-400"
          />

          {/* Business Context */}
          <ImpactSection
            title="Business Context"
            content={sections.businessContext}
            icon={<span className="text-lg">&#128200;</span>}
            colorClass="text-purple-600 dark:text-purple-400"
          />
        </div>

        {/* Generated timestamp */}
        {generatedAt && (
          <div className="text-xs text-muted-foreground/70 pt-2 border-t">
            {isManuallyEdited ? "Last edited" : "Generated"}:{" "}
            {new Date(generatedAt).toLocaleString()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Compact version for list views or summaries
 */
export function BusinessImpactSummary({
  statement,
  isManuallyEdited,
  className,
}: {
  statement: string | null | undefined;
  isManuallyEdited?: boolean;
  className?: string;
}) {
  if (!statement) {
    return (
      <div className={cn("text-sm text-muted-foreground italic", className)}>
        No impact statement
      </div>
    );
  }

  // Get first paragraph only
  const sections = parseMarkdownSections(statement);
  const firstSection =
    sections.regulatory || sections.operational || sections.businessContext;
  const firstParagraph = firstSection.split("\n\n")[0] ?? "";
  const truncated =
    firstParagraph.length > 200
      ? firstParagraph.substring(0, 200) + "..."
      : firstParagraph;

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Business Impact</span>
        {isManuallyEdited && (
          <Badge variant="outline" className="text-xs">
            Edited
          </Badge>
        )}
      </div>
      <p
        className="text-sm text-muted-foreground"
        dangerouslySetInnerHTML={{ __html: markdownToHtml(truncated) }}
      />
    </div>
  );
}
