/**
 * Email Validation Utility (Story 4.14)
 *
 * Provides email address validation and content sanitization for email sending.
 * Implements AC18-AC22 security requirements.
 */

/**
 * Result of email validation
 */
export interface EmailValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Email validation regex pattern
 * Based on RFC 5322 official standard (simplified for practical use)
 */
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/**
 * SQL injection patterns to detect
 */
const SQL_INJECTION_PATTERNS = [
  /['"].*[;].*--/i,
  /union\s+select/i,
  /insert\s+into/i,
  /delete\s+from/i,
  /drop\s+table/i,
  /update\s+.*\s+set/i,
  /exec\s*\(/i,
  /execute\s*\(/i,
  /xp_/i,
  /sp_/i,
];

/**
 * Validates an email address format and checks for injection attacks
 *
 * AC18: Email addresses validated before sending (proper format, no SQL injection)
 *
 * @param email - The email address to validate
 * @returns Validation result with valid flag and optional error message
 */
export function validateEmailAddress(email: string): EmailValidationResult {
  // Check for empty or null
  if (!email || email.trim().length === 0) {
    return { valid: false, error: "Email address is required" };
  }

  // Trim whitespace
  const trimmedEmail = email.trim();

  // Check length (RFC 5321 limits)
  if (trimmedEmail.length > 254) {
    return { valid: false, error: "Email address exceeds maximum length of 254 characters" };
  }

  // Check local part length (before @)
  const atIndex = trimmedEmail.indexOf("@");
  if (atIndex > 64) {
    return { valid: false, error: "Local part of email exceeds maximum length of 64 characters" };
  }

  // Validate format
  if (!EMAIL_REGEX.test(trimmedEmail)) {
    return { valid: false, error: "Invalid email address format" };
  }

  // Check for SQL injection patterns (AC18)
  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(trimmedEmail)) {
      return { valid: false, error: "Email address contains potentially malicious content" };
    }
  }

  // Check for dangerous characters that shouldn't appear in email
  const dangerousChars = ["\0", "\n", "\r", "\x1a"];
  for (const char of dangerousChars) {
    if (trimmedEmail.includes(char)) {
      return { valid: false, error: "Email address contains invalid characters" };
    }
  }

  return { valid: true };
}

/**
 * Validates multiple email addresses
 *
 * @param emails - Array of email addresses to validate
 * @returns Validation result for all emails
 */
export function validateEmailAddresses(emails: string[]): EmailValidationResult {
  for (const email of emails) {
    const result = validateEmailAddress(email);
    if (!result.valid) {
      return { valid: false, error: `${email}: ${result.error}` };
    }
  }
  return { valid: true };
}

/**
 * Dangerous HTML tags that should be removed
 */
const FORBIDDEN_TAGS = [
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "form",
  "input",
  "button",
  "link",
  "meta",
  "base",
];

/**
 * Dangerous event handlers that should be removed
 */
const FORBIDDEN_ATTRS = [
  "onerror",
  "onload",
  "onclick",
  "onmouseover",
  "onfocus",
  "onblur",
  "onchange",
  "onsubmit",
  "onkeydown",
  "onkeyup",
  "onkeypress",
  "onmousedown",
  "onmouseup",
  "ondblclick",
];

/**
 * Sanitizes HTML content for email
 *
 * AC19: Email content sanitized (no script injection in HTML)
 *
 * Uses regex-based sanitization for simplicity and compatibility.
 * For production use with untrusted input, consider DOMPurify.
 *
 * @param html - HTML content to sanitize
 * @returns Sanitized HTML safe for email
 */
export function sanitizeEmailHtml(html: string): string {
  let sanitized = html;

  // Remove forbidden tags and their contents
  for (const tag of FORBIDDEN_TAGS) {
    // Remove opening and closing tags with content
    const tagPattern = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi");
    sanitized = sanitized.replace(tagPattern, "");

    // Remove self-closing or orphan opening tags
    const selfClosingPattern = new RegExp(`<${tag}[^>]*\\/?>`, "gi");
    sanitized = sanitized.replace(selfClosingPattern, "");
  }

  // Remove forbidden attributes from all tags
  for (const attr of FORBIDDEN_ATTRS) {
    // Match attribute with value (both quote styles and unquoted)
    const attrPatterns = [
      new RegExp(`\\s${attr}\\s*=\\s*"[^"]*"`, "gi"),
      new RegExp(`\\s${attr}\\s*=\\s*'[^']*'`, "gi"),
      new RegExp(`\\s${attr}\\s*=\\s*[^\\s>]+`, "gi"),
      // Also handle attributes without values
      new RegExp(`\\s${attr}(?=[\\s>])`, "gi"),
    ];

    for (const pattern of attrPatterns) {
      sanitized = sanitized.replace(pattern, "");
    }
  }

  // Remove javascript: and data: URLs from href and src attributes
  sanitized = sanitized.replace(
    /\s(href|src)\s*=\s*["']?\s*javascript:[^"'\s>]*/gi,
    ""
  );
  sanitized = sanitized.replace(
    /\s(href|src)\s*=\s*["']?\s*data:[^"'\s>]*/gi,
    ""
  );

  // Remove expression() in style attributes (IE-specific XSS vector)
  sanitized = sanitized.replace(/expression\s*\([^)]*\)/gi, "");

  return sanitized;
}

/**
 * Validates that the from address matches allowed sender domains
 *
 * AC20: From address must match verified sender in SendGrid/SES (anti-spoofing)
 *
 * @param fromAddress - The from email address
 * @param verifiedDomains - List of verified sender domains (optional, if empty all are allowed)
 * @returns Validation result
 */
export function validateFromAddress(
  fromAddress: string,
  verifiedDomains?: string[]
): EmailValidationResult {
  // First validate the email format
  const formatValidation = validateEmailAddress(fromAddress);
  if (!formatValidation.valid) {
    return formatValidation;
  }

  // If no verified domains specified, allow any valid email
  if (!verifiedDomains || verifiedDomains.length === 0) {
    return { valid: true };
  }

  // Extract domain from email
  const domain = fromAddress.split("@")[1]?.toLowerCase();
  if (!domain) {
    return { valid: false, error: "Unable to extract domain from email address" };
  }

  // Check if domain is in verified list
  const isVerified = verifiedDomains.some(
    (verifiedDomain) => domain === verifiedDomain.toLowerCase()
  );

  if (!isVerified) {
    return {
      valid: false,
      error: `Domain '${domain}' is not a verified sender domain. Verified domains: ${verifiedDomains.join(", ")}`,
    };
  }

  return { valid: true };
}

/**
 * Converts HTML to plain text for email fallback
 *
 * @param html - HTML content to convert
 * @returns Plain text version
 */
export function htmlToPlainText(html: string): string {
  // Remove style and script tags and their contents
  let text = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");

  // Replace common HTML entities
  text = text.replace(/&nbsp;/gi, " ");
  text = text.replace(/&amp;/gi, "&");
  text = text.replace(/&lt;/gi, "<");
  text = text.replace(/&gt;/gi, ">");
  text = text.replace(/&quot;/gi, '"');
  text = text.replace(/&#39;/gi, "'");

  // Replace line breaks
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/p>/gi, "\n\n");
  text = text.replace(/<\/div>/gi, "\n");
  text = text.replace(/<\/h[1-6]>/gi, "\n\n");
  text = text.replace(/<\/li>/gi, "\n");
  text = text.replace(/<\/tr>/gi, "\n");

  // Add bullet points for list items
  text = text.replace(/<li[^>]*>/gi, "  - ");

  // Remove remaining HTML tags
  text = text.replace(/<[^>]*>/g, "");

  // Clean up whitespace
  text = text.replace(/\n\s*\n\s*\n/g, "\n\n"); // Multiple blank lines to double
  text = text.replace(/[ \t]+/g, " "); // Multiple spaces to single
  text = text.trim();

  return text;
}
