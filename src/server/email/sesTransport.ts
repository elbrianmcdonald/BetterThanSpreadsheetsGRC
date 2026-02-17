/**
 * AWS SES Email Transport (Story 4.14)
 *
 * Implements email sending via AWS Simple Email Service (SES).
 *
 * AC28: AWS SES integration uses AWS SDK v3 (@aws-sdk/client-ses)
 * AC29: SES credentials validated on startup
 * AC30: SES errors mapped to user-friendly messages
 * AC31: SES sender email must be verified (sandbox) or domain verified (production)
 * AC32: Documentation includes AWS SES setup guide
 */

import {
  SESClient,
  SendEmailCommand,
  GetIdentityVerificationAttributesCommand,
  type SendEmailCommandInput,
} from "@aws-sdk/client-ses";
import type { EmailTransport, EmailSendOptions, EmailSendResult } from "./types";
import { env } from "@/env";

/**
 * Map AWS SES error codes to user-friendly messages
 */
function mapSESError(error: unknown): string {
  if (error && typeof error === "object" && "name" in error) {
    const errorName = (error as { name: string }).name;
    const errorMessage = (error as { message?: string }).message ?? "";

    switch (errorName) {
      case "MessageRejected":
        if (errorMessage.includes("not verified")) {
          return "Sender email address is not verified in AWS SES. Please verify your sender at the SES console.";
        }
        if (errorMessage.includes("sandbox")) {
          return "AWS SES is in sandbox mode. Recipients must be verified, or request production access.";
        }
        return `Email rejected by AWS SES: ${errorMessage}`;

      case "MailFromDomainNotVerifiedException":
        return "Sender domain is not verified in AWS SES. Please verify your domain at the SES console.";

      case "ConfigurationSetDoesNotExistException":
        return "AWS SES configuration set not found. Please check your SES configuration.";

      case "AccountSendingPausedException":
        return "AWS SES sending is paused for this account. Please check your SES account status.";

      case "LimitExceededException":
        return "AWS SES sending limit exceeded. Please wait or request a limit increase.";

      case "InvalidParameterValue":
        return `Invalid email parameter: ${errorMessage}`;

      case "CredentialsError":
      case "UnrecognizedClientException":
        return "Invalid AWS credentials. Please check your AWS_SES_ACCESS_KEY_ID and AWS_SES_SECRET_ACCESS_KEY.";

      case "InvalidClientTokenId":
        return "Invalid AWS access key ID. Please check your AWS_SES_ACCESS_KEY_ID.";

      case "SignatureDoesNotMatch":
        return "Invalid AWS secret access key. Please check your AWS_SES_SECRET_ACCESS_KEY.";

      case "ExpiredTokenException":
        return "AWS credentials have expired. Please refresh your credentials.";

      default:
        break;
    }
  }

  // Generic error message
  if (error instanceof Error) {
    return `AWS SES error: ${error.message}`;
  }

  return "Unknown AWS SES error occurred. Please check your configuration.";
}

/**
 * AWS SES transport implementation
 */
class SESEmailTransport implements EmailTransport {
  readonly name = "ses";
  private client: SESClient | null = null;

  /**
   * Initialize SES client with credentials
   */
  private initialize(): SESClient {
    if (this.client) return this.client;

    const region = env.AWS_SES_REGION;
    const accessKeyId = env.AWS_SES_ACCESS_KEY_ID;
    const secretAccessKey = env.AWS_SES_SECRET_ACCESS_KEY;

    if (!region) {
      throw new Error(
        "AWS_SES_REGION is not configured. Please set the environment variable."
      );
    }

    if (!accessKeyId || !secretAccessKey) {
      throw new Error(
        "AWS SES credentials are not configured. Please set AWS_SES_ACCESS_KEY_ID and AWS_SES_SECRET_ACCESS_KEY."
      );
    }

    this.client = new SESClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    return this.client;
  }

  /**
   * Send an email via AWS SES
   */
  async sendEmail(options: EmailSendOptions): Promise<EmailSendResult> {
    try {
      const client = this.initialize();

      // Build recipient list
      const toAddresses = Array.isArray(options.to) ? options.to : [options.to];

      // Build SES send email command input
      const input: SendEmailCommandInput = {
        Source: options.from.name
          ? `${options.from.name} <${options.from.email}>`
          : options.from.email,
        Destination: {
          ToAddresses: toAddresses,
          CcAddresses: options.cc,
          BccAddresses: options.bcc,
        },
        Message: {
          Subject: {
            Data: options.subject,
            Charset: "UTF-8",
          },
          Body: {
            Html: {
              Data: options.html,
              Charset: "UTF-8",
            },
            ...(options.text && {
              Text: {
                Data: options.text,
                Charset: "UTF-8",
              },
            }),
          },
        },
      };

      // Add reply-to if specified
      if (options.replyTo) {
        input.ReplyToAddresses = [options.replyTo];
      }

      // Send email
      const command = new SendEmailCommand(input);
      const response = await client.send(command);

      return {
        success: true,
        messageId: response.MessageId ?? `ses-${Date.now()}`,
        providerResponse: {
          messageId: response.MessageId,
          requestId: response.$metadata.requestId,
        },
      };
    } catch (error) {
      const errorMessage = mapSESError(error);
      console.error("[SESTransport] Send failed:", errorMessage, error);

      return {
        success: false,
        error: errorMessage,
        providerResponse: error,
      };
    }
  }

  /**
   * Test SES connection by validating credentials and checking sender verification
   *
   * AC29: SES credentials validated on startup
   */
  async testConnection(): Promise<boolean> {
    try {
      const client = this.initialize();

      // Check if from address is configured
      const fromAddress = env.EMAIL_FROM_ADDRESS;
      if (!fromAddress) {
        console.warn("[SESTransport] Warning: EMAIL_FROM_ADDRESS not configured");
        return true; // Still return true as credentials are valid
      }

      // Verify the sender identity is verified in SES
      const command = new GetIdentityVerificationAttributesCommand({
        Identities: [fromAddress],
      });

      const response = await client.send(command);
      const verificationStatus =
        response.VerificationAttributes?.[fromAddress]?.VerificationStatus;

      if (verificationStatus === "Success") {
        console.log(
          `[SESTransport] Sender ${fromAddress} is verified in AWS SES`
        );
        return true;
      } else if (verificationStatus === "Pending") {
        console.warn(
          `[SESTransport] Sender ${fromAddress} verification is pending in AWS SES`
        );
        return true; // May still work for domain-verified senders
      } else {
        console.warn(
          `[SESTransport] Sender ${fromAddress} is NOT verified in AWS SES. Status: ${verificationStatus ?? "unknown"}`
        );
        // Still return true as the credentials are valid, just the sender isn't verified
        return true;
      }
    } catch (error) {
      console.error("[SESTransport] Connection test failed:", mapSESError(error));
      return false;
    }
  }
}

/**
 * Singleton SES transport instance
 */
export const sesTransport = new SESEmailTransport();
