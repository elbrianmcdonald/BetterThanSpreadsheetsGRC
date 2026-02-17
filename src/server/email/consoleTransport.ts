/**
 * Console Email Transport (Story 4.14)
 *
 * Logs emails to console instead of sending them.
 * Used for development and testing.
 *
 * AC9: Console transport for development (logs email to stdout)
 */

import type { EmailTransport, EmailSendOptions, EmailSendResult } from "./types";

/**
 * Console transport implementation
 * Logs email details to console for development/testing
 */
class ConsoleEmailTransport implements EmailTransport {
  readonly name = "console";

  /**
   * "Send" an email by logging it to console
   */
  async sendEmail(options: EmailSendOptions): Promise<EmailSendResult> {
    const messageId = `console-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const timestamp = new Date().toISOString();

    // Format recipients
    const recipients = Array.isArray(options.to) ? options.to.join(", ") : options.to;

    console.log("");
    console.log("=".repeat(60));
    console.log("EMAIL (Console Transport - Not Actually Sent)");
    console.log("=".repeat(60));
    console.log(`Timestamp:  ${timestamp}`);
    console.log(`Message ID: ${messageId}`);
    console.log("-".repeat(60));
    console.log(`From:       ${options.from.name ? `${options.from.name} <${options.from.email}>` : options.from.email}`);
    console.log(`To:         ${recipients}`);
    if (options.cc?.length) {
      console.log(`CC:         ${options.cc.join(", ")}`);
    }
    if (options.bcc?.length) {
      console.log(`BCC:        ${options.bcc.join(", ")}`);
    }
    if (options.replyTo) {
      console.log(`Reply-To:   ${options.replyTo}`);
    }
    console.log(`Subject:    ${options.subject}`);
    console.log("-".repeat(60));
    console.log("HTML Content:");
    console.log("-".repeat(60));
    // Truncate very long HTML for readability
    const htmlPreview = options.html.length > 1000
      ? options.html.substring(0, 1000) + "\n... [truncated]"
      : options.html;
    console.log(htmlPreview);
    if (options.text) {
      console.log("-".repeat(60));
      console.log("Plain Text Content:");
      console.log("-".repeat(60));
      const textPreview = options.text.length > 500
        ? options.text.substring(0, 500) + "\n... [truncated]"
        : options.text;
      console.log(textPreview);
    }
    if (options.headers && Object.keys(options.headers).length > 0) {
      console.log("-".repeat(60));
      console.log("Custom Headers:");
      for (const [key, value] of Object.entries(options.headers)) {
        console.log(`  ${key}: ${value}`);
      }
    }
    console.log("=".repeat(60));
    console.log("");

    return {
      success: true,
      messageId,
      providerResponse: { transport: "console", logged: true },
    };
  }

  /**
   * Test console transport connection (always succeeds)
   */
  async testConnection(): Promise<boolean> {
    console.log("[ConsoleEmailTransport] Test connection successful - console transport is always available");
    return true;
  }
}

/**
 * Singleton console transport instance
 */
export const consoleTransport = new ConsoleEmailTransport();
