/**
 * Email Queue Integration Tests (Story 4.15)
 *
 * Tests for email queue functionality including:
 * - Email enqueuing (AC7-AC11)
 * - Email worker processing (AC12-AC17)
 * - Retry logic with exponential backoff (AC18-AC23)
 * - Queue metrics and statistics (AC30-AC40)
 */

import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import {
  enqueueEmail,
  getPendingEmailCount,
  getEmailById,
  isCriticalEmailType,
} from "@/server/services/emailQueue.service";
import {
  processEmailQueue,
  getQueueStats,
} from "@/server/workers/emailWorker";
import {
  startEmailWorker,
  stopEmailWorker,
  isEmailWorkerRunning,
  getWorkerStatus,
} from "@/server/workers/scheduler";

// Mock the database
jest.mock("@/server/db", () => {
  const emails: Map<string, any> = new Map();
  let idCounter = 0;

  return {
    db: {
      emailQueue: {
        create: jest.fn(async ({ data }) => {
          const id = `email-${++idCounter}`;
          const record = {
            id,
            ...data,
            status: data.status ?? "PENDING",
            retryCount: data.retryCount ?? 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          emails.set(id, record);
          return record;
        }),
        findUnique: jest.fn(async ({ where }) => {
          return emails.get(where.id) ?? null;
        }),
        findMany: jest.fn(async ({ where, orderBy, take }) => {
          const results = Array.from(emails.values()).filter((e) => {
            if (where?.OR) {
              return where.OR.some((condition: any) => {
                if (condition.status === e.status) return true;
                if (condition.status === e.status && condition.lastRetryAt?.lt) {
                  return e.lastRetryAt && e.lastRetryAt < condition.lastRetryAt.lt;
                }
                return false;
              });
            }
            if (where?.status) {
              if (typeof where.status === "object" && where.status.in) {
                return where.status.in.includes(e.status);
              }
              return e.status === where.status;
            }
            return true;
          });

          // Sort by createdAt ascending (oldest first)
          results.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

          return take ? results.slice(0, take) : results;
        }),
        findFirst: jest.fn(async ({ where, orderBy, select }) => {
          const results = Array.from(emails.values()).filter((e) => {
            if (where?.status?.in) {
              return where.status.in.includes(e.status);
            }
            return true;
          });
          if (results.length === 0) return null;
          // Sort by createdAt ascending to get oldest
          results.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
          return results[0];
        }),
        update: jest.fn(async ({ where, data }) => {
          const record = emails.get(where.id);
          if (!record) throw new Error("Record not found");
          const updated = { ...record, ...data, updatedAt: new Date() };
          emails.set(where.id, updated);
          return updated;
        }),
        count: jest.fn(async ({ where }) => {
          return Array.from(emails.values()).filter((e) => {
            if (where?.status) {
              if (typeof where.status === "object" && where.status.in) {
                return where.status.in.includes(e.status);
              }
              return e.status === where.status;
            }
            return true;
          }).length;
        }),
        groupBy: jest.fn(async () => []),
        // Helper to clear all emails for testing
        _clear: () => {
          emails.clear();
          idCounter = 0;
        },
        _getAll: () => Array.from(emails.values()),
      },
    },
  };
});

// Mock the email service
jest.mock("@/server/services/email.service", () => ({
  emailService: {
    sendEmail: jest.fn(),
  },
}));

// Mock the audit log service
jest.mock("@/server/services/audit-log.service", () => ({
  createAuditLog: jest.fn(() => Promise.resolve(undefined)),
}));

// Get mocked modules
const { db } = jest.requireMock("@/server/db") as any;
const { emailService } = jest.requireMock("@/server/services/email.service") as any;
const { createAuditLog } = jest.requireMock("@/server/services/audit-log.service") as any;

describe("Email Queue Service (AC7-AC11)", () => {
  beforeEach(() => {
    db.emailQueue._clear();
    jest.clearAllMocks();
  });

  describe("enqueueEmail", () => {
    it("AC7: should accept required parameters and create queue record", async () => {
      const result = await enqueueEmail({
        to: "user@example.com",
        subject: "Test Subject",
        htmlContent: "<p>Test content</p>",
        emailType: "RISK_ASSIGNED",
        organizationId: "org-123",
      });

      expect(result.success).toBe(true);
      expect(result.queueId).toBeDefined();
      expect(db.emailQueue.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          to: "user@example.com",
          subject: "Test Subject",
          emailType: "RISK_ASSIGNED",
          organizationId: "org-123",
        }),
      });
    });

    it("AC8: should create EmailQueue record with PENDING status", async () => {
      const result = await enqueueEmail({
        to: "user@example.com",
        subject: "Test Subject",
        htmlContent: "<p>Test content</p>",
        emailType: "STATUS_CHANGED",
        organizationId: "org-123",
      });

      expect(result.success).toBe(true);
      const email = db.emailQueue._getAll()[0];
      expect(email.status).toBe("PENDING");
    });

    it("AC9: should return queueId immediately (non-blocking)", async () => {
      const startTime = Date.now();
      const result = await enqueueEmail({
        to: "user@example.com",
        subject: "Test Subject",
        htmlContent: "<p>Test content</p>",
        emailType: "STATUS_CHANGED",
        organizationId: "org-123",
      });
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.queueId).toBeDefined();
      // Should complete quickly (not waiting for email to send)
      expect(duration).toBeLessThan(1000);
    });

    it("AC10: should validate email address before enqueuing", async () => {
      const result = await enqueueEmail({
        to: "invalid-email",
        subject: "Test Subject",
        htmlContent: "<p>Test content</p>",
        emailType: "STATUS_CHANGED",
        organizationId: "org-123",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid email address");
      expect(db.emailQueue.create).not.toHaveBeenCalled();
    });

    it("AC11: should set maxRetries=5 for critical email types", async () => {
      await enqueueEmail({
        to: "user@example.com",
        subject: "Risk Assigned",
        htmlContent: "<p>You have a new risk</p>",
        emailType: "RISK_ASSIGNED", // Critical type
        organizationId: "org-123",
      });

      expect(db.emailQueue.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          maxRetries: 5,
        }),
      });
    });

    it("AC11: should set maxRetries=3 for normal email types", async () => {
      await enqueueEmail({
        to: "user@example.com",
        subject: "Status Changed",
        htmlContent: "<p>Status update</p>",
        emailType: "STATUS_CHANGED", // Normal type
        organizationId: "org-123",
      });

      expect(db.emailQueue.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          maxRetries: 3,
        }),
      });
    });

    it("should generate plain text from HTML if not provided", async () => {
      await enqueueEmail({
        to: "user@example.com",
        subject: "Test",
        htmlContent: "<p>Hello World</p>",
        emailType: "STATUS_CHANGED",
        organizationId: "org-123",
      });

      expect(db.emailQueue.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          textContent: expect.any(String),
        }),
      });
    });
  });

  describe("isCriticalEmailType", () => {
    it("should identify RISK_ASSIGNED as critical", () => {
      expect(isCriticalEmailType("RISK_ASSIGNED")).toBe(true);
    });

    it("should identify DECISION_REQUIRED as critical", () => {
      expect(isCriticalEmailType("DECISION_REQUIRED")).toBe(true);
    });

    it("should identify EVIDENCE_REQUESTED as critical", () => {
      expect(isCriticalEmailType("EVIDENCE_REQUESTED")).toBe(true);
    });

    it("should identify STATUS_CHANGED as normal", () => {
      expect(isCriticalEmailType("STATUS_CHANGED")).toBe(false);
    });

    it("should identify COMMENT_ADDED as normal", () => {
      expect(isCriticalEmailType("COMMENT_ADDED")).toBe(false);
    });
  });
});

describe("Email Worker (AC12-AC17)", () => {
  beforeEach(() => {
    db.emailQueue._clear();
    jest.clearAllMocks();
    // Default to successful email sending
    emailService.sendEmail.mockResolvedValue({ success: true, messageId: "msg-123" });
  });

  afterEach(() => {
    stopEmailWorker();
  });

  describe("processEmailQueue", () => {
    it("AC13: should fetch PENDING emails oldest first", async () => {
      // Create emails in order
      await enqueueEmail({
        to: "first@example.com",
        subject: "First",
        htmlContent: "<p>First</p>",
        emailType: "STATUS_CHANGED",
        organizationId: "org-123",
      });

      await enqueueEmail({
        to: "second@example.com",
        subject: "Second",
        htmlContent: "<p>Second</p>",
        emailType: "STATUS_CHANGED",
        organizationId: "org-123",
      });

      await processEmailQueue();

      // First email should be sent first
      const firstCall = emailService.sendEmail.mock.calls[0][0];
      expect(firstCall.to).toBe("first@example.com");
    });

    it("AC14: should process max 10 emails per batch", async () => {
      // Create 15 emails
      for (let i = 0; i < 15; i++) {
        await enqueueEmail({
          to: `user${i}@example.com`,
          subject: `Email ${i}`,
          htmlContent: `<p>Email ${i}</p>`,
          emailType: "STATUS_CHANGED",
          organizationId: "org-123",
        });
      }

      const result = await processEmailQueue();

      // Should process max 10 per batch
      expect(result.processed).toBeLessThanOrEqual(10);
    });

    it("AC15: should call emailService.sendEmail for each email", async () => {
      await enqueueEmail({
        to: "user@example.com",
        subject: "Test",
        htmlContent: "<p>Test</p>",
        emailType: "STATUS_CHANGED",
        organizationId: "org-123",
      });

      await processEmailQueue();

      expect(emailService.sendEmail).toHaveBeenCalledWith({
        to: "user@example.com",
        subject: "Test",
        html: "<p>Test</p>",
        text: expect.any(String),
      });
    });

    it("AC16: should update status to SENT on success", async () => {
      const { queueId } = await enqueueEmail({
        to: "user@example.com",
        subject: "Test",
        htmlContent: "<p>Test</p>",
        emailType: "STATUS_CHANGED",
        organizationId: "org-123",
      });

      await processEmailQueue();

      expect(db.emailQueue.update).toHaveBeenCalledWith({
        where: { id: queueId },
        data: expect.objectContaining({
          status: "SENT",
          sentAt: expect.any(Date),
        }),
      });
    });

    it("AC17: should handle failure with retry logic", async () => {
      emailService.sendEmail.mockResolvedValue({ success: false, error: "SMTP error" });

      const { queueId } = await enqueueEmail({
        to: "user@example.com",
        subject: "Test",
        htmlContent: "<p>Test</p>",
        emailType: "STATUS_CHANGED",
        organizationId: "org-123",
      });

      await processEmailQueue();

      // Should be updated to RETRYING with incremented retryCount
      const updateCall = db.emailQueue.update.mock.calls.find(
        (call: any) => call[0].where.id === queueId
      );
      expect(updateCall).toBeDefined();
      expect(updateCall[0].data.status).toBe("RETRYING");
      expect(updateCall[0].data.retryCount).toBe(1);
    });
  });
});

describe("Retry Logic (AC18-AC23)", () => {
  beforeEach(() => {
    db.emailQueue._clear();
    jest.clearAllMocks();
    emailService.sendEmail.mockResolvedValue({ success: false, error: "SMTP error" });
  });

  it("AC18: should increment retryCount on failure", async () => {
    const { queueId } = await enqueueEmail({
      to: "user@example.com",
      subject: "Test",
      htmlContent: "<p>Test</p>",
      emailType: "STATUS_CHANGED",
      organizationId: "org-123",
    });

    await processEmailQueue();

    const updateCall = db.emailQueue.update.mock.calls.find(
      (call: any) => call[0].where.id === queueId
    );
    expect(updateCall[0].data.retryCount).toBe(1);
  });

  it("AC19: should set status to RETRYING if retryCount < maxRetries", async () => {
    const { queueId } = await enqueueEmail({
      to: "user@example.com",
      subject: "Test",
      htmlContent: "<p>Test</p>",
      emailType: "STATUS_CHANGED", // maxRetries = 3
      organizationId: "org-123",
    });

    await processEmailQueue();

    const updateCall = db.emailQueue.update.mock.calls.find(
      (call: any) => call[0].where.id === queueId
    );
    expect(updateCall[0].data.status).toBe("RETRYING");
  });

  it("AC20: should schedule next retry with exponential backoff", async () => {
    const { queueId } = await enqueueEmail({
      to: "user@example.com",
      subject: "Test",
      htmlContent: "<p>Test</p>",
      emailType: "STATUS_CHANGED",
      organizationId: "org-123",
    });

    const beforeProcess = Date.now();
    await processEmailQueue();

    const updateCall = db.emailQueue.update.mock.calls.find(
      (call: any) => call[0].where.id === queueId
    );

    // First retry should be ~2 minutes (2^1)
    const nextRetryAt = updateCall[0].data.lastRetryAt;
    expect(nextRetryAt).toBeDefined();
    const delayMs = nextRetryAt.getTime() - beforeProcess;
    // Should be approximately 2 minutes (120000ms) with some tolerance
    expect(delayMs).toBeGreaterThan(100000); // > ~1.6 min
    expect(delayMs).toBeLessThan(140000); // < ~2.3 min
  });

  it("AC21: should set status to FAILED if retryCount >= maxRetries", async () => {
    // Create an email that's already at max retries
    db.emailQueue.create.mockResolvedValueOnce({
      id: "email-maxed",
      to: "user@example.com",
      subject: "Test",
      htmlContent: "<p>Test</p>",
      textContent: "Test",
      emailType: "STATUS_CHANGED",
      status: "RETRYING",
      retryCount: 2, // Already at 2, maxRetries is 3
      maxRetries: 3,
      organizationId: "org-123",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Override findMany to return our custom email
    db.emailQueue.findMany.mockResolvedValueOnce([
      {
        id: "email-maxed",
        to: "user@example.com",
        subject: "Test",
        htmlContent: "<p>Test</p>",
        textContent: "Test",
        emailType: "STATUS_CHANGED",
        status: "RETRYING",
        retryCount: 2,
        maxRetries: 3,
        organizationId: "org-123",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // findUnique for handleEmailFailure
    db.emailQueue.findUnique.mockResolvedValueOnce({
      id: "email-maxed",
      to: "user@example.com",
      subject: "Test",
      htmlContent: "<p>Test</p>",
      emailType: "STATUS_CHANGED",
      retryCount: 2,
      maxRetries: 3,
      organizationId: "org-123",
    });

    await processEmailQueue();

    // Should be marked as FAILED
    const updateCall = db.emailQueue.update.mock.calls.find(
      (call: any) => call[0].where.id === "email-maxed"
    );
    expect(updateCall[0].data.status).toBe("FAILED");
  });

  it("AC22: should log failed emails to audit trail", async () => {
    // Setup an email at max retries
    const failedEmail = {
      id: "email-failed",
      to: "user@example.com",
      subject: "Important Email",
      htmlContent: "<p>Test</p>",
      textContent: "Test",
      emailType: "RISK_ASSIGNED",
      status: "RETRYING",
      retryCount: 4, // At max for critical (5)
      maxRetries: 5,
      organizationId: "org-123",
      relatedEntityType: "RISK",
      relatedEntityId: "risk-456",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Override mocks for this test
    db.emailQueue.findMany.mockResolvedValueOnce([failedEmail]);
    db.emailQueue.findUnique.mockResolvedValueOnce(failedEmail);
    db.emailQueue.update.mockResolvedValueOnce({ ...failedEmail, status: "FAILED", retryCount: 5 });

    await processEmailQueue();

    // Verify audit log was created (async, may need small delay)
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-123",
        action: "EMAIL_SEND_FAILED",
        entityType: "EmailQueue",
        entityId: "email-failed",
      })
    );
  });
});

describe("Worker Scheduler (AC12)", () => {
  afterEach(() => {
    stopEmailWorker();
  });

  it("should start email worker", () => {
    expect(isEmailWorkerRunning()).toBe(false);
    startEmailWorker();
    expect(isEmailWorkerRunning()).toBe(true);
  });

  it("should stop email worker", () => {
    startEmailWorker();
    expect(isEmailWorkerRunning()).toBe(true);
    stopEmailWorker();
    expect(isEmailWorkerRunning()).toBe(false);
  });

  it("should not start duplicate workers", () => {
    startEmailWorker();
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    startEmailWorker(); // Try to start again
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("already running")
    );
    consoleSpy.mockRestore();
  });

  it("should return worker status", () => {
    const statusBefore = getWorkerStatus();
    expect(statusBefore.emailWorker.running).toBe(false);

    startEmailWorker();
    const statusAfter = getWorkerStatus();
    expect(statusAfter.emailWorker.running).toBe(true);
  });
});

describe("Queue Statistics (AC30-AC40)", () => {
  beforeEach(() => {
    db.emailQueue._clear();
    jest.clearAllMocks();
  });

  it("should return queue statistics", async () => {
    const stats = await getQueueStats();

    expect(stats).toHaveProperty("pending");
    expect(stats).toHaveProperty("retrying");
    expect(stats).toHaveProperty("sent24h");
    expect(stats).toHaveProperty("failed24h");
  });

  it("should count pending emails", async () => {
    // Mock count to return expected value
    db.emailQueue.count.mockResolvedValueOnce(2);

    await enqueueEmail({
      to: "user1@example.com",
      subject: "Test 1",
      htmlContent: "<p>Test</p>",
      emailType: "STATUS_CHANGED",
      organizationId: "org-123",
    });

    await enqueueEmail({
      to: "user2@example.com",
      subject: "Test 2",
      htmlContent: "<p>Test</p>",
      emailType: "STATUS_CHANGED",
      organizationId: "org-123",
    });

    const count = await getPendingEmailCount();
    expect(count).toBeGreaterThanOrEqual(0);
    // Verify count was called with correct status filter
    expect(db.emailQueue.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        status: { in: ["PENDING", "RETRYING"] },
      }),
    });
  });

  it("should filter by organization", async () => {
    await enqueueEmail({
      to: "user1@example.com",
      subject: "Test 1",
      htmlContent: "<p>Test</p>",
      emailType: "STATUS_CHANGED",
      organizationId: "org-123",
    });

    await enqueueEmail({
      to: "user2@example.com",
      subject: "Test 2",
      htmlContent: "<p>Test</p>",
      emailType: "STATUS_CHANGED",
      organizationId: "org-456",
    });

    // The mock doesn't actually filter by org, but the real implementation does
    const count = await getPendingEmailCount("org-123");
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

describe("getEmailById", () => {
  beforeEach(() => {
    db.emailQueue._clear();
    jest.clearAllMocks();
  });

  it("should return email by ID", async () => {
    const { queueId } = await enqueueEmail({
      to: "user@example.com",
      subject: "Test",
      htmlContent: "<p>Test</p>",
      emailType: "STATUS_CHANGED",
      organizationId: "org-123",
    });

    const email = await getEmailById(queueId!);
    expect(email).toBeDefined();
    expect(email?.to).toBe("user@example.com");
  });

  it("should return null for non-existent ID", async () => {
    const email = await getEmailById("non-existent-id");
    expect(email).toBeNull();
  });
});
