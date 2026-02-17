/**
 * Email Transport Types (Story 4.14)
 *
 * Shared types for all email transport implementations.
 */

/**
 * Email sender information
 */
export interface EmailSender {
  email: string;
  name?: string;
}

/**
 * Options for sending an email
 */
export interface EmailSendOptions {
  /** Sender information */
  from: EmailSender;
  /** Recipient email address(es) */
  to: string | string[];
  /** Email subject */
  subject: string;
  /** HTML content */
  html: string;
  /** Plain text content (optional, auto-generated from HTML if not provided) */
  text?: string;
  /** CC recipients */
  cc?: string[];
  /** BCC recipients */
  bcc?: string[];
  /** Reply-To address */
  replyTo?: string;
  /** Custom headers */
  headers?: Record<string, string>;
}

/**
 * Result of sending an email
 */
export interface EmailSendResult {
  /** Whether the email was sent successfully */
  success: boolean;
  /** Message ID from the email provider */
  messageId?: string;
  /** Error message if sending failed */
  error?: string;
  /** Provider-specific response data */
  providerResponse?: unknown;
}

/**
 * Email transport interface
 * All transport implementations must implement this interface.
 */
export interface EmailTransport {
  /** Transport name for logging */
  readonly name: string;

  /**
   * Send an email
   * @param options - Email send options
   * @returns Result with success status and message ID
   */
  sendEmail(options: EmailSendOptions): Promise<EmailSendResult>;

  /**
   * Test the transport connection
   * @returns True if the transport is properly configured and connected
   */
  testConnection(): Promise<boolean>;
}

/**
 * Email provider type
 */
export type EmailProvider = "sendgrid" | "ses" | "console";
