/**
 * Email Template Renderer (Story 4.16)
 *
 * Provides template rendering, variable substitution, and helper functions.
 *
 * AC41: renderEmailTemplate(templateName, variables) generates HTML and text
 * AC42: Helper functions for formatting
 * AC43: Absolute URLs for risk detail links
 * AC44: UTM parameters for email tracking
 * AC45: Variable sanitization to prevent XSS
 */

import type { Severity } from "@prisma/client";

/** Type alias for severity (matches Prisma Severity enum) */
type RiskSeverity = Severity;

/**
 * Template output with HTML and plain text versions
 */
export interface TemplateOutput {
  html: string;
  text: string;
  subject: string;
}

/**
 * UTM parameters for email tracking
 */
export interface UTMParams {
  source?: string;
  medium?: string;
  campaign?: string;
}

/**
 * Default UTM parameters for email links
 */
const DEFAULT_UTM: UTMParams = {
  source: "email",
  medium: "notification",
};

/**
 * Get the base URL from environment
 */
export function getBaseUrl(): string {
  return process.env.NEXTAUTH_URL || process.env.BASE_URL || "http://localhost:3000";
}

/**
 * Sanitize HTML to prevent XSS attacks
 * AC45: All variables sanitized to prevent XSS in email content
 */
export function sanitizeHtml(text: string | number | null | undefined): string {
  if (text === null || text === undefined) {
    return "";
  }
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Build URL with UTM parameters
 * AC44: Links include UTM parameters for email tracking
 */
export function buildUrlWithUTM(
  path: string,
  campaign: string,
  customParams?: Record<string, string>
): string {
  const baseUrl = getBaseUrl();
  const url = new URL(path, baseUrl);

  // Add UTM parameters
  url.searchParams.set("utm_source", DEFAULT_UTM.source || "email");
  url.searchParams.set("utm_medium", DEFAULT_UTM.medium || "notification");
  url.searchParams.set("utm_campaign", campaign);

  // Add any custom parameters
  if (customParams) {
    for (const [key, value] of Object.entries(customParams)) {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}

/**
 * Build risk detail URL
 * AC43: Templates include risk detail page links with absolute URLs
 */
export function buildRiskDetailUrl(riskId: string, campaign: string): string {
  return buildUrlWithUTM(`/risks/${riskId}`, campaign);
}

/**
 * Build unsubscribe URL
 */
export function buildUnsubscribeUrl(): string {
  return buildUrlWithUTM("/settings/notifications", "unsubscribe");
}

/**
 * Format severity with color-coded badge
 * AC42: Helper function for severity formatting
 */
export function formatSeverity(severity: RiskSeverity | string): string {
  const severityColors: Record<string, { bg: string; text: string }> = {
    CRITICAL: { bg: "#DC2626", text: "#FFFFFF" },
    HIGH: { bg: "#EF4444", text: "#FFFFFF" },
    MEDIUM: { bg: "#F59E0B", text: "#FFFFFF" },
    LOW: { bg: "#3B82F6", text: "#FFFFFF" },
  };

  const colors = severityColors[severity] || { bg: "#6B7280", text: "#FFFFFF" };

  return `<span style="background-color: ${colors.bg}; color: ${colors.text}; padding: 4px 12px; border-radius: 4px; font-weight: 600; font-size: 12px; text-transform: uppercase;">${severity}</span>`;
}

/**
 * Get plain text severity label
 */
export function formatSeverityPlainText(severity: RiskSeverity | string): string {
  return `[${severity}]`;
}

/**
 * Format impact score with color indicator
 * AC42: Helper function for impact score formatting
 */
export function formatImpactScore(score: number | null | undefined): string {
  const safeScore = score ?? 0;
  const color = safeScore >= 70 ? "#EF4444" : safeScore >= 40 ? "#F59E0B" : "#10B981";

  return `<span style="color: ${color}; font-weight: 700; font-size: 24px;">${safeScore}</span><span style="color: #6B7280; font-size: 14px;">/100</span>`;
}

/**
 * Get impact score color class
 */
export function getImpactScoreColor(score: number | null | undefined): string {
  const safeScore = score ?? 0;
  if (safeScore >= 70) return "#EF4444"; // Red
  if (safeScore >= 40) return "#F59E0B"; // Yellow
  return "#10B981"; // Green
}

/**
 * Format date for display
 * AC42: Helper function for date formatting
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "N/A";

  const d = typeof date === "string" ? new Date(date) : date;

  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Format date with time
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "N/A";

  const d = typeof date === "string" ? new Date(date) : date;

  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format currency
 * AC42: Helper function for currency formatting
 */
export function formatCurrency(
  amount: number | null | undefined,
  currency: string = "USD"
): string {
  if (amount === null || amount === undefined) return "N/A";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format risk status with color
 */
export function formatStatus(status: string): string {
  const statusColors: Record<string, { bg: string; text: string }> = {
    OPEN: { bg: "#FEE2E2", text: "#991B1B" },
    ASSIGNED: { bg: "#DBEAFE", text: "#1E40AF" },
    REMEDIATED: { bg: "#FEF3C7", text: "#92400E" },
    CLOSED: { bg: "#D1FAE5", text: "#065F46" },
    ACCEPTED: { bg: "#E5E7EB", text: "#374151" },
  };

  const colors = statusColors[status] || { bg: "#E5E7EB", text: "#374151" };

  return `<span style="background-color: ${colors.bg}; color: ${colors.text}; padding: 4px 12px; border-radius: 4px; font-weight: 500; font-size: 12px;">${status}</span>`;
}

/**
 * Format status transition (old → new)
 */
export function formatStatusTransition(oldStatus: string, newStatus: string): string {
  return `${formatStatus(oldStatus)} → ${formatStatus(newStatus)}`;
}

/**
 * Truncate text to specified length
 */
export function truncateText(text: string | null | undefined, maxLength: number = 200): string {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + "...";
}

/**
 * Calculate days since a date
 */
export function daysSince(date: Date | string | null | undefined): number {
  if (!date) return 0;

  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - d.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Format days as urgency indicator
 */
export function formatUrgency(days: number): string {
  if (days >= 14) {
    return `<span style="color: #EF4444; font-weight: 600;">${days} days (Overdue)</span>`;
  } else if (days >= 7) {
    return `<span style="color: #F59E0B; font-weight: 600;">${days} days</span>`;
  }
  return `<span style="color: #6B7280;">${days} days</span>`;
}

/**
 * Replace template variables
 * Replaces {{variableName}} with sanitized values
 */
export function replaceVariables(
  template: string,
  variables: Record<string, unknown>,
  sanitize: boolean = true
): string {
  let result = template;

  for (const [key, value] of Object.entries(variables)) {
    const placeholder = new RegExp(`{{${key}}}`, "g");
    const replacement = sanitize ? sanitizeHtml(value as string) : String(value ?? "");
    result = result.replace(placeholder, replacement);
  }

  return result;
}

/**
 * Generate a primary CTA button
 */
export function generatePrimaryButton(text: string, url: string): string {
  return `
    <a href="${url}" style="display: inline-block; background-color: #3B82F6; color: #FFFFFF; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; text-align: center; margin-top: 16px;">
      ${sanitizeHtml(text)}
    </a>
  `.trim();
}

/**
 * Generate a secondary CTA button
 */
export function generateSecondaryButton(text: string, url: string): string {
  return `
    <a href="${url}" style="display: inline-block; background-color: #E5E7EB; color: #374151; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px; text-align: center; margin-top: 12px;">
      ${sanitizeHtml(text)}
    </a>
  `.trim();
}

/**
 * Generate an info row (label: value)
 */
export function generateInfoRow(label: string, value: string, isHtml: boolean = false): string {
  const displayValue = isHtml ? value : sanitizeHtml(value);
  return `
    <tr>
      <td style="padding: 8px 0; color: #6B7280; font-size: 14px; vertical-align: top; width: 140px;">${sanitizeHtml(label)}</td>
      <td style="padding: 8px 0; color: #1F2937; font-size: 14px; vertical-align: top;">${displayValue}</td>
    </tr>
  `.trim();
}

/**
 * Generate a callout box
 */
export function generateCallout(
  content: string,
  type: "info" | "warning" | "success" | "error" = "info"
): string {
  const colors = {
    info: { border: "#3B82F6", bg: "#EFF6FF" },
    warning: { border: "#F59E0B", bg: "#FFFBEB" },
    success: { border: "#10B981", bg: "#ECFDF5" },
    error: { border: "#DC2626", bg: "#FEF2F2" },
  };

  const { border, bg } = colors[type];

  return `
    <div style="background-color: ${bg}; border-left: 4px solid ${border}; padding: 16px; margin: 16px 0; border-radius: 0 4px 4px 0;">
      ${content}
    </div>
  `.trim();
}
