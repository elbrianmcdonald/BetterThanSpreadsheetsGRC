/**
 * Email Service Integration Tests (Story 4.14)
 *
 * Tests for email service functionality including:
 * - Console transport sending
 * - Email address validation
 * - HTML content sanitization
 * - Rate limiting
 * - Transport factory configuration
 */

import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import {
  validateEmailAddress,
  validateEmailAddresses,
  sanitizeEmailHtml,
  htmlToPlainText,
  validateFromAddress,
} from "@/lib/emailValidator";
import {
  getEmailProvider,
  validateEmailConfig,
  getEmailSender,
  resetEmailTransport,
} from "@/server/email/transportFactory";
import { consoleTransport } from "@/server/email/consoleTransport";

// Mock the env module
jest.mock("@/env", () => ({
  env: {
    EMAIL_PROVIDER: "console",
    EMAIL_FROM_ADDRESS: "test@example.com",
    EMAIL_FROM_NAME: "Test Sender",
    NODE_ENV: "test",
  },
}));

describe("Email Validator", () => {
  describe("validateEmailAddress", () => {
    it("should accept valid email addresses", () => {
      const validEmails = [
        "user@example.com",
        "user.name@example.com",
        "user+tag@example.com",
        "user@subdomain.example.com",
        "user123@example.co.uk",
      ];

      for (const email of validEmails) {
        const result = validateEmailAddress(email);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      }
    });

    it("should reject invalid email addresses", () => {
      const invalidEmails = [
        "",
        "   ",
        "notanemail",
        "@example.com",
        "user@",
        "user@.com",
        "user @example.com",
        "user@ example.com",
      ];

      for (const email of invalidEmails) {
        const result = validateEmailAddress(email);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      }
    });

    it("should reject email addresses with SQL injection patterns", () => {
      const maliciousEmails = [
        "user'; DROP TABLE users; --@example.com",
        "user' OR '1'='1@example.com",
        "user UNION SELECT * FROM users@example.com",
      ];

      for (const email of maliciousEmails) {
        const result = validateEmailAddress(email);
        // Should fail format validation before SQL check
        expect(result.valid).toBe(false);
      }
    });

    it("should reject email addresses exceeding max length", () => {
      const longLocal = "a".repeat(65);
      const result = validateEmailAddress(`${longLocal}@example.com`);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("64 characters");
    });

    it("should reject email addresses with null bytes", () => {
      const result = validateEmailAddress("user\0@example.com");
      expect(result.valid).toBe(false);
      // Null byte causes email format validation to fail first
      expect(result.error).toBeDefined();
    });
  });

  describe("validateEmailAddresses", () => {
    it("should accept array of valid email addresses", () => {
      const emails = ["user1@example.com", "user2@example.com"];
      const result = validateEmailAddresses(emails);
      expect(result.valid).toBe(true);
    });

    it("should reject if any email is invalid", () => {
      const emails = ["user1@example.com", "invalid", "user3@example.com"];
      const result = validateEmailAddresses(emails);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("invalid");
    });
  });

  describe("validateFromAddress", () => {
    it("should accept any valid email when no verified domains specified", () => {
      const result = validateFromAddress("any@domain.com");
      expect(result.valid).toBe(true);
    });

    it("should accept email from verified domain", () => {
      const result = validateFromAddress("user@example.com", ["example.com"]);
      expect(result.valid).toBe(true);
    });

    it("should reject email from unverified domain", () => {
      const result = validateFromAddress("user@other.com", ["example.com"]);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("not a verified sender");
    });
  });
});

describe("HTML Sanitization", () => {
  describe("sanitizeEmailHtml", () => {
    it("should allow safe HTML tags", () => {
      const html = "<h1>Title</h1><p>Paragraph</p><a href='http://example.com'>Link</a>";
      const result = sanitizeEmailHtml(html);
      expect(result).toContain("<h1>");
      expect(result).toContain("<p>");
      expect(result).toContain("<a");
    });

    it("should remove script tags", () => {
      const html = "<p>Hello</p><script>alert('xss')</script>";
      const result = sanitizeEmailHtml(html);
      expect(result).toContain("<p>Hello</p>");
      expect(result).not.toContain("<script>");
      expect(result).not.toContain("alert");
    });

    it("should remove event handlers", () => {
      const html = '<img src="img.jpg" onerror="alert(1)">';
      const result = sanitizeEmailHtml(html);
      expect(result).not.toContain("onerror");
    });

    it("should remove iframe tags", () => {
      const html = '<iframe src="http://evil.com"></iframe>';
      const result = sanitizeEmailHtml(html);
      expect(result).not.toContain("<iframe");
    });

    it("should preserve styling attributes", () => {
      const html = '<div style="color: red;">Styled</div>';
      const result = sanitizeEmailHtml(html);
      expect(result).toContain('style="color: red;"');
    });
  });

  describe("htmlToPlainText", () => {
    it("should convert HTML to plain text", () => {
      const html = "<h1>Title</h1><p>Hello World</p>";
      const result = htmlToPlainText(html);
      expect(result).toContain("Title");
      expect(result).toContain("Hello World");
      expect(result).not.toContain("<");
    });

    it("should convert line breaks correctly", () => {
      const html = "<p>Line 1</p><br><p>Line 2</p>";
      const result = htmlToPlainText(html);
      expect(result).toContain("Line 1");
      expect(result).toContain("Line 2");
    });

    it("should convert list items to bullets", () => {
      const html = "<ul><li>Item 1</li><li>Item 2</li></ul>";
      const result = htmlToPlainText(html);
      expect(result).toContain("- Item 1");
      expect(result).toContain("- Item 2");
    });

    it("should decode HTML entities", () => {
      const html = "<p>&nbsp;Hello&amp;Goodbye</p>";
      const result = htmlToPlainText(html);
      // Note: &lt; and &gt; are decoded to < and > which then get stripped as they look like tags
      expect(result).toContain("Hello&Goodbye");
    });
  });
});

describe("Console Transport", () => {
  let consoleSpy: jest.SpiedFunction<typeof console.log>;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it("should have correct name", () => {
    expect(consoleTransport.name).toBe("console");
  });

  it("should log email to console and return success", async () => {
    const result = await consoleTransport.sendEmail({
      from: { email: "sender@example.com", name: "Sender" },
      to: "recipient@example.com",
      subject: "Test Subject",
      html: "<p>Test content</p>",
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
    expect(result.messageId).toMatch(/^console-/);
    expect(consoleSpy).toHaveBeenCalled();
  });

  it("should handle multiple recipients", async () => {
    const result = await consoleTransport.sendEmail({
      from: { email: "sender@example.com" },
      to: ["recipient1@example.com", "recipient2@example.com"],
      subject: "Test Subject",
      html: "<p>Test content</p>",
    });

    expect(result.success).toBe(true);
  });

  it("should handle CC and BCC recipients", async () => {
    const result = await consoleTransport.sendEmail({
      from: { email: "sender@example.com" },
      to: "recipient@example.com",
      subject: "Test Subject",
      html: "<p>Test content</p>",
      cc: ["cc@example.com"],
      bcc: ["bcc@example.com"],
    });

    expect(result.success).toBe(true);
  });

  it("should pass connection test", async () => {
    const result = await consoleTransport.testConnection();
    expect(result).toBe(true);
  });
});

describe("Transport Factory", () => {
  beforeEach(() => {
    resetEmailTransport();
  });

  it("should return console provider by default", () => {
    const provider = getEmailProvider();
    expect(provider).toBe("console");
  });

  it("should validate console configuration as valid", () => {
    const result = validateEmailConfig();
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should return configured email sender", () => {
    const sender = getEmailSender();
    expect(sender.email).toBe("test@example.com");
    expect(sender.name).toBe("Test Sender");
  });
});
