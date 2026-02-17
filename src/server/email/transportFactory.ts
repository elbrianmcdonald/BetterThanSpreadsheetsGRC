/**
 * Email Transport Factory (Story 4.14)
 *
 * Creates the appropriate email transport based on configuration.
 *
 * AC4: Email service auto-detects provider based on which env vars are set
 * AC7: Nodemailer transport created for SendGrid using API key
 * AC8: Nodemailer transport created for AWS SES using AWS SDK credentials
 * AC10: Transport connection tested on startup
 * AC11: Transport errors logged with actionable troubleshooting guidance
 */

import { env } from "@/env";
import type { EmailTransport, EmailProvider } from "./types";
import { consoleTransport } from "./consoleTransport";
import { sendgridTransport } from "./sendgridTransport";
import { sesTransport } from "./sesTransport";

/**
 * Cached transport instance
 */
let cachedTransport: EmailTransport | null = null;

/**
 * Get the configured email provider
 *
 * AC4: Auto-detects provider based on env vars (SendGrid takes precedence)
 */
export function getEmailProvider(): EmailProvider {
  return env.EMAIL_PROVIDER;
}

/**
 * Validate that the required configuration is present for the provider
 *
 * AC6: Email configuration validated on app startup
 */
export function validateEmailConfig(): { valid: boolean; errors: string[] } {
  const provider = getEmailProvider();
  const errors: string[] = [];

  // Console mode requires no additional configuration
  if (provider === "console") {
    return { valid: true, errors: [] };
  }

  // All providers (except console) require from address
  if (!env.EMAIL_FROM_ADDRESS) {
    errors.push(
      "EMAIL_FROM_ADDRESS is required when EMAIL_PROVIDER is not 'console'"
    );
  }

  // Provider-specific validation
  if (provider === "sendgrid") {
    if (!env.SENDGRID_API_KEY) {
      errors.push(
        "SENDGRID_API_KEY is required when EMAIL_PROVIDER is 'sendgrid'"
      );
    }
  }

  if (provider === "ses") {
    if (!env.AWS_SES_REGION) {
      errors.push("AWS_SES_REGION is required when EMAIL_PROVIDER is 'ses'");
    }
    if (!env.AWS_SES_ACCESS_KEY_ID) {
      errors.push(
        "AWS_SES_ACCESS_KEY_ID is required when EMAIL_PROVIDER is 'ses'"
      );
    }
    if (!env.AWS_SES_SECRET_ACCESS_KEY) {
      errors.push(
        "AWS_SES_SECRET_ACCESS_KEY is required when EMAIL_PROVIDER is 'ses'"
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get the email transport instance
 *
 * Returns the appropriate transport based on EMAIL_PROVIDER env var.
 * Caches the transport instance for reuse.
 *
 * @throws Error if configuration is invalid in production
 */
export function getEmailTransport(): EmailTransport {
  // Return cached transport if available
  if (cachedTransport) {
    return cachedTransport;
  }

  const provider = getEmailProvider();

  // Validate configuration
  const validation = validateEmailConfig();
  if (!validation.valid) {
    const errorMsg = `Email configuration invalid:\n${validation.errors.map((e) => `  - ${e}`).join("\n")}`;

    // In production, throw error for invalid config (AC6)
    if (env.NODE_ENV === "production") {
      throw new Error(errorMsg);
    }

    // In development, log warning and fall back to console
    console.warn(`[TransportFactory] ${errorMsg}`);
    console.warn("[TransportFactory] Falling back to console transport");
    cachedTransport = consoleTransport;
    return cachedTransport;
  }

  // Create transport based on provider
  switch (provider) {
    case "sendgrid":
      console.log("[TransportFactory] Using SendGrid email transport");
      cachedTransport = sendgridTransport;
      break;

    case "ses":
      console.log("[TransportFactory] Using AWS SES email transport");
      cachedTransport = sesTransport;
      break;

    case "console":
    default:
      console.log("[TransportFactory] Using console email transport (development mode)");
      cachedTransport = consoleTransport;
      break;
  }

  return cachedTransport;
}

/**
 * Test the email transport connection
 *
 * AC10: Transport connection tested on startup
 *
 * @returns True if connection is successful
 */
export async function testEmailTransport(): Promise<boolean> {
  try {
    const transport = getEmailTransport();
    const result = await transport.testConnection();

    if (result) {
      console.log(
        `[TransportFactory] Email transport '${transport.name}' connection test successful`
      );
    } else {
      console.error(
        `[TransportFactory] Email transport '${transport.name}' connection test failed`
      );
    }

    return result;
  } catch (error) {
    // AC11: Log errors with troubleshooting guidance
    console.error("[TransportFactory] Email transport test failed:", error);

    const provider = getEmailProvider();
    console.error(`[TransportFactory] Troubleshooting for ${provider}:`);

    switch (provider) {
      case "sendgrid":
        console.error(
          "  1. Verify SENDGRID_API_KEY is correct and has 'Mail Send' permission"
        );
        console.error(
          "  2. Ensure sender email is verified at https://app.sendgrid.com/settings/sender_auth"
        );
        console.error(
          "  3. Check if your account is still in sandbox mode"
        );
        break;

      case "ses":
        console.error(
          "  1. Verify AWS_SES_ACCESS_KEY_ID and AWS_SES_SECRET_ACCESS_KEY are correct"
        );
        console.error(
          "  2. Verify AWS_SES_REGION matches your SES region"
        );
        console.error(
          "  3. Ensure sender email/domain is verified in SES console"
        );
        console.error(
          "  4. If in sandbox, verify recipient emails are also verified"
        );
        break;

      default:
        console.error("  Console transport should always succeed");
    }

    return false;
  }
}

/**
 * Reset the cached transport (useful for testing)
 */
export function resetEmailTransport(): void {
  cachedTransport = null;
}

/**
 * Get the configured sender email and name
 */
export function getEmailSender(): { email: string; name: string } {
  return {
    email: env.EMAIL_FROM_ADDRESS ?? "noreply@example.com",
    name: env.EMAIL_FROM_NAME ?? "BetterThanSpreadsheetsGRC",
  };
}
