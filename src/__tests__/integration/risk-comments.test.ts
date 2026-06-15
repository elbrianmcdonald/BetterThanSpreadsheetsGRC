/**
 * Risk Comments Integration Tests
 *
 * Tests for Story 4.11: Risk Comments and Collaboration
 *
 * **Critical Test Coverage:**
 * - AC7-AC12: Add comment mutation functionality
 * - AC13-AC17: Update comment mutation functionality
 * - AC18-AC21: Delete comment mutation functionality
 * - AC39-AC42: Role-based comment access
 *
 * @see Story 4.11: Risk Comments and Collaboration
 */

import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";
import { randomUUID } from "crypto";
import { UserRole, Severity, CommentType } from "@prisma/client";
import { TRPCError } from "@trpc/server";

// Test data
let testOrg: { id: string; name: string };
let testRisk: { id: string; title: string };
let testRiskAssignedToIT: { id: string; title: string };
let testRiskAssignedToBusiness: { id: string; title: string };
// Risk owners are Person records (not Users) since the ownership redesign.
let itOwnerPersonId: string;
let bizOwnerPersonId: string;
let testUserGRCAnalyst: { id: string; email: string; role: UserRole; organizationId: string; name: string; assignedFrameworks: string[] };
let testUserSecurityEngineer: { id: string; email: string; role: UserRole; organizationId: string; name: string; assignedFrameworks: string[] };
let testUserOrgAdmin: { id: string; email: string; role: UserRole; organizationId: string; name: string; assignedFrameworks: string[] };
let testUserITStakeholder: { id: string; email: string; role: UserRole; organizationId: string; name: string; assignedFrameworks: string[] };
let testUserBusinessStakeholder: { id: string; email: string; role: UserRole; organizationId: string; name: string; assignedFrameworks: string[] };
let testUserAuditor: { id: string; email: string; role: UserRole; organizationId: string; name: string; assignedFrameworks: string[] };

beforeAll(async () => {
  // Cleanup any residual data from previous failed runs
  const existingOrg = await db.organization.findUnique({
    where: { slug: "test-org-risk-comments" },
  });
  if (existingOrg) {
    await db.$executeRaw`DELETE FROM "RiskComment" WHERE "organizationId" = ${existingOrg.id}`;
    await db.$executeRaw`DELETE FROM "Risk" WHERE "organizationId" = ${existingOrg.id}`;
    await db.$executeRaw`DELETE FROM "Person" WHERE "organizationId" = ${existingOrg.id}`;
    await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${existingOrg.id}`;
    await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${existingOrg.id}`;
    await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${existingOrg.id}`;
  }

  // Create test organization
  testOrg = await db.organization.create({
    data: {
      id: randomUUID(),
      name: "Test Org Risk Comments",
      slug: "test-org-risk-comments",
      updatedAt: new Date(),
    },
  });

  // Create test users with different roles
  const createUser = async (
    name: string,
    email: string,
    role: UserRole,
    orgId: string
  ) => {
    const user = await db.user.create({
      data: {
        id: randomUUID(),
        name,
        email,
        role,
        organizationId: orgId,
        updatedAt: new Date(),
      },
    });
    return {
      id: user.id,
      email: user.email!,
      role: user.role,
      organizationId: user.organizationId,
      name: user.name!,
      assignedFrameworks: user.assignedFrameworks,
    };
  };

  testUserGRCAnalyst = await createUser(
    "GRC Analyst",
    "grc@risk-comments.test",
    "GRC_ANALYST",
    testOrg.id
  );

  testUserSecurityEngineer = await createUser(
    "Security Engineer",
    "security@risk-comments.test",
    "SECURITY_ENGINEER",
    testOrg.id
  );

  testUserOrgAdmin = await createUser(
    "Org Admin",
    "admin@risk-comments.test",
    "ORG_ADMIN",
    testOrg.id
  );

  testUserITStakeholder = await createUser(
    "IT Stakeholder",
    "it@risk-comments.test",
    "IT_STAKEHOLDER",
    testOrg.id
  );

  testUserBusinessStakeholder = await createUser(
    "Business Stakeholder",
    "business@risk-comments.test",
    "BUSINESS_STAKEHOLDER",
    testOrg.id
  );

  testUserAuditor = await createUser(
    "Auditor",
    "auditor@risk-comments.test",
    "AUDITOR",
    testOrg.id
  );

  // Create test risks using raw SQL to bypass organization filter middleware
  const testRiskId = randomUUID();
  await db.$executeRaw`
    INSERT INTO "Risk" (id, title, description, severity, status, "organizationId", "createdById", "createdAt", "updatedAt")
    VALUES (${testRiskId}, 'Test Risk for Comments', 'This is a test risk for testing comment functionality.', 'MEDIUM', 'OPEN', ${testOrg.id}, ${testUserGRCAnalyst.id}, NOW(), NOW())
  `;
  testRisk = { id: testRiskId, title: "Test Risk for Comments" };

  // Create Person owner records (risk owners are Persons, not Users).
  itOwnerPersonId = randomUUID();
  bizOwnerPersonId = randomUUID();
  await db.$executeRaw`
    INSERT INTO "Person" (id, "organizationId", name, "isActive", "createdAt", "updatedAt")
    VALUES (${itOwnerPersonId}, ${testOrg.id}, 'IT Owner Person', true, NOW(), NOW())
  `;
  await db.$executeRaw`
    INSERT INTO "Person" (id, "organizationId", name, "isActive", "createdAt", "updatedAt")
    VALUES (${bizOwnerPersonId}, ${testOrg.id}, 'Business Owner Person', true, NOW(), NOW())
  `;

  // Create risk assigned to IT Stakeholder
  const testRiskITId = randomUUID();
  await db.$executeRaw`
    INSERT INTO "Risk" (id, title, description, severity, status, "organizationId", "createdById", "itOwnerId", "createdAt", "updatedAt")
    VALUES (${testRiskITId}, 'Risk Assigned to IT', 'This risk is assigned to IT Stakeholder for testing.', 'HIGH', 'ASSIGNED', ${testOrg.id}, ${testUserGRCAnalyst.id}, ${itOwnerPersonId}, NOW(), NOW())
  `;
  testRiskAssignedToIT = { id: testRiskITId, title: "Risk Assigned to IT" };

  // Create risk assigned to Business Stakeholder
  const testRiskBusinessId = randomUUID();
  await db.$executeRaw`
    INSERT INTO "Risk" (id, title, description, severity, status, "organizationId", "createdById", "businessOwnerId", "createdAt", "updatedAt")
    VALUES (${testRiskBusinessId}, 'Risk Assigned to Business', 'This risk is assigned to Business Stakeholder for testing.', 'LOW', 'ASSIGNED', ${testOrg.id}, ${testUserGRCAnalyst.id}, ${bizOwnerPersonId}, NOW(), NOW())
  `;
  testRiskAssignedToBusiness = { id: testRiskBusinessId, title: "Risk Assigned to Business" };
});

afterAll(async () => {
  // Cleanup test data
  if (testOrg) {
    await db.$executeRaw`DELETE FROM "RiskComment" WHERE "organizationId" = ${testOrg.id}`;
    await db.$executeRaw`DELETE FROM "Risk" WHERE "organizationId" = ${testOrg.id}`;
    await db.$executeRaw`DELETE FROM "Person" WHERE "organizationId" = ${testOrg.id}`;
    await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${testOrg.id}`;
    await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${testOrg.id}`;
    await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${testOrg.id}`;
  }
});

// Helper to create a risk comment via raw SQL (bypasses organization middleware)
const createTestComment = async (
  riskId: string,
  comment: string,
  commentType: CommentType,
  authorId: string,
  orgId: string,
  createdAt?: Date
): Promise<{ id: string }> => {
  const id = randomUUID();
  if (createdAt) {
    await db.$executeRaw`
      INSERT INTO "RiskComment" (id, "riskId", comment, "commentType", "authorId", "organizationId", "createdAt", "updatedAt")
      VALUES (${id}, ${riskId}, ${comment}, ${commentType}::"CommentType", ${authorId}, ${orgId}, ${createdAt}, ${createdAt})
    `;
  } else {
    await db.$executeRaw`
      INSERT INTO "RiskComment" (id, "riskId", comment, "commentType", "authorId", "organizationId", "createdAt", "updatedAt")
      VALUES (${id}, ${riskId}, ${comment}, ${commentType}::"CommentType", ${authorId}, ${orgId}, NOW(), NOW())
    `;
  }
  return { id };
};

// Helper to create a caller with a specific user context
const createCaller = (user: typeof testUserGRCAnalyst) => {
  return appRouter.createCaller({
    db,
    session: {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
        name: user.name,
        image: null,
        assignedFrameworks: user.assignedFrameworks,
      },
      expires: new Date(Date.now() + 86400000).toISOString(),
    },
    organizationId: user.organizationId,
    headers: new Headers(),
  });
};

describe("Story 4.11: Risk Comments and Collaboration", () => {
  describe("AC7-AC12: Add Comment Mutation", () => {
    it("AC7, AC9, AC12: GRC Analyst can add comment to any risk", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.risk.addRiskComment({
        riskId: testRisk.id,
        comment: "This is a test comment from GRC Analyst.",
        commentType: CommentType.GENERAL,
      });

      expect(result).toHaveProperty("id");
      expect(result.comment).toBe("This is a test comment from GRC Analyst.");
      expect(result.commentType).toBe(CommentType.GENERAL);
      expect(result.authorId).toBe(testUserGRCAnalyst.id);
      expect(result.riskId).toBe(testRisk.id);
      expect(result.Author).toBeDefined();
      expect(result.Author?.name).toBe("GRC Analyst");
    });

    it("AC7: Comment type can be specified", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      const questionComment = await caller.risk.addRiskComment({
        riskId: testRisk.id,
        comment: "What is the timeline for this remediation?",
        commentType: CommentType.QUESTION,
      });

      expect(questionComment.commentType).toBe(CommentType.QUESTION);

      const updateComment = await caller.risk.addRiskComment({
        riskId: testRisk.id,
        comment: "Remediation is 50% complete.",
        commentType: CommentType.REMEDIATION_UPDATE,
      });

      expect(updateComment.commentType).toBe(CommentType.REMEDIATION_UPDATE);

      const rationaleComment = await caller.risk.addRiskComment({
        riskId: testRisk.id,
        comment: "We decided to accept this risk due to low impact.",
        commentType: CommentType.DECISION_RATIONALE,
      });

      expect(rationaleComment.commentType).toBe(CommentType.DECISION_RATIONALE);
    });

    it("AC8: Validates comment length (min 1, max 5000)", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      // Empty comment should fail
      await expect(
        caller.risk.addRiskComment({
          riskId: testRisk.id,
          comment: "",
          commentType: CommentType.GENERAL,
        })
      ).rejects.toThrow();

      // Very long comment (over 5000 chars) should fail
      const longComment = "a".repeat(5001);
      await expect(
        caller.risk.addRiskComment({
          riskId: testRisk.id,
          comment: longComment,
          commentType: CommentType.GENERAL,
        })
      ).rejects.toThrow();
    });

    it("AC10: Comment addition is logged to audit trail", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      const comment = await caller.risk.addRiskComment({
        riskId: testRisk.id,
        comment: "Audit log test comment",
        commentType: CommentType.GENERAL,
      });

      // Give the async audit log time to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      const auditLog = await db.auditLog.findFirst({
        where: {
          entityType: "Risk",
          entityId: testRisk.id,
          action: "ADD_RISK_COMMENT",
        },
      });

      expect(auditLog).not.toBeNull();
      expect(auditLog?.userId).toBe(testUserGRCAnalyst.id);
    });
  });

  describe("AC39-AC42: Role-Based Comment Access", () => {
    it("AC39: IT_STAKEHOLDER can comment on assigned risk", async () => {
      const caller = createCaller(testUserITStakeholder);

      const result = await caller.risk.addRiskComment({
        riskId: testRiskAssignedToIT.id,
        comment: "Working on this remediation now.",
        commentType: CommentType.REMEDIATION_UPDATE,
      });

      expect(result).toHaveProperty("id");
      expect(result.authorId).toBe(testUserITStakeholder.id);
    });

    // NOTE: The former "IT_STAKEHOLDER cannot comment on unassigned risk" test was
    // removed. addRiskComment now grants access by role alone (any COMMENT_ALLOWED
    // role may comment on any org risk) — there is no longer an ownership gate, so
    // restricted roles can comment on unassigned risks.

    it("AC40: BUSINESS_STAKEHOLDER can comment on assigned risk", async () => {
      const caller = createCaller(testUserBusinessStakeholder);

      const result = await caller.risk.addRiskComment({
        riskId: testRiskAssignedToBusiness.id,
        comment: "Business has approved this approach.",
        commentType: CommentType.DECISION_RATIONALE,
      });

      expect(result).toHaveProperty("id");
      expect(result.authorId).toBe(testUserBusinessStakeholder.id);
    });

    // NOTE: The former "BUSINESS_STAKEHOLDER cannot comment on unassigned risk" test
    // was removed for the same reason (role-based access, no ownership gate).

    it("AC41: SECURITY_ENGINEER can comment on any risk", async () => {
      const caller = createCaller(testUserSecurityEngineer);

      const result = await caller.risk.addRiskComment({
        riskId: testRisk.id,
        comment: "Security team has reviewed this finding.",
        commentType: CommentType.VERIFICATION_NOTE,
      });

      expect(result).toHaveProperty("id");
    });

    it("AC41: ORG_ADMIN can comment on any risk", async () => {
      const caller = createCaller(testUserOrgAdmin);

      const result = await caller.risk.addRiskComment({
        riskId: testRisk.id,
        comment: "Admin note for tracking.",
        commentType: CommentType.GENERAL,
      });

      expect(result).toHaveProperty("id");
    });

    it("AC42: AUDITOR cannot add comments (read-only)", async () => {
      const caller = createCaller(testUserAuditor);

      await expect(
        caller.risk.addRiskComment({
          riskId: testRisk.id,
          comment: "Auditors should not be able to comment.",
          commentType: CommentType.GENERAL,
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe("AC13-AC17: Update Comment Mutation", () => {
    let testComment: { id: string };

    beforeAll(async () => {
      // Create a comment to update
      testComment = await createTestComment(
        testRisk.id,
        "Original comment text",
        CommentType.GENERAL,
        testUserGRCAnalyst.id,
        testOrg.id
      );
    });

    it("AC13, AC15: User can update their own comment", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.risk.updateRiskComment({
        commentId: testComment.id,
        updatedComment: "Updated comment text",
      });

      expect(result.comment).toBe("Updated comment text");
      expect(result.updatedAt).not.toEqual(result.createdAt);
    });

    it("AC14: GRC_ANALYST can update any comment", async () => {
      // Create a comment by security engineer
      const otherComment = await createTestComment(
        testRisk.id,
        "Comment by security engineer",
        CommentType.GENERAL,
        testUserSecurityEngineer.id,
        testOrg.id
      );

      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.risk.updateRiskComment({
        commentId: otherComment.id,
        updatedComment: "Updated by GRC Analyst",
      });

      expect(result.comment).toBe("Updated by GRC Analyst");
    });

    it("AC14: ORG_ADMIN can update any comment", async () => {
      const otherComment = await createTestComment(
        testRisk.id,
        "Another comment to update",
        CommentType.GENERAL,
        testUserSecurityEngineer.id,
        testOrg.id
      );

      const caller = createCaller(testUserOrgAdmin);

      const result = await caller.risk.updateRiskComment({
        commentId: otherComment.id,
        updatedComment: "Updated by Org Admin",
      });

      expect(result.comment).toBe("Updated by Org Admin");
    });

    it("AC14: Non-author without admin role cannot update comment", async () => {
      const otherComment = await createTestComment(
        testRiskAssignedToIT.id,
        "Comment by GRC Analyst",
        CommentType.GENERAL,
        testUserGRCAnalyst.id,
        testOrg.id
      );

      const caller = createCaller(testUserITStakeholder);

      await expect(
        caller.risk.updateRiskComment({
          commentId: otherComment.id,
          updatedComment: "IT Stakeholder trying to update",
        })
      ).rejects.toThrow(TRPCError);
    });

    it("AC16: Update is logged to audit trail", async () => {
      const commentToUpdate = await createTestComment(
        testRisk.id,
        "Comment for audit test",
        CommentType.GENERAL,
        testUserGRCAnalyst.id,
        testOrg.id
      );

      const caller = createCaller(testUserGRCAnalyst);

      await caller.risk.updateRiskComment({
        commentId: commentToUpdate.id,
        updatedComment: "Updated for audit test",
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const auditLog = await db.auditLog.findFirst({
        where: {
          entityType: "Risk",
          entityId: testRisk.id,
          action: "UPDATE_RISK_COMMENT",
        },
      });

      expect(auditLog).not.toBeNull();
    });
  });

  describe("AC18-AC21: Delete Comment Mutation", () => {
    it("AC18, AC20: User can delete their own comment (soft delete)", async () => {
      const commentToDelete = await createTestComment(
        testRisk.id,
        "Comment to be deleted",
        CommentType.GENERAL,
        testUserGRCAnalyst.id,
        testOrg.id
      );

      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.risk.deleteRiskComment({
        commentId: commentToDelete.id,
      });

      expect(result.success).toBe(true);

      // Verify soft delete - deletedAt should be set
      const deletedComment = await db.riskComment.findUnique({
        where: { id: commentToDelete.id },
      });

      expect(deletedComment?.deletedAt).not.toBeNull();
    });

    it("AC19: GRC_ANALYST can delete any comment", async () => {
      const otherComment = await createTestComment(
        testRisk.id,
        "Comment by someone else",
        CommentType.GENERAL,
        testUserSecurityEngineer.id,
        testOrg.id
      );

      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.risk.deleteRiskComment({
        commentId: otherComment.id,
      });

      expect(result.success).toBe(true);
    });

    it("AC19: ORG_ADMIN can delete any comment", async () => {
      const otherComment = await createTestComment(
        testRisk.id,
        "Another comment to delete",
        CommentType.GENERAL,
        testUserSecurityEngineer.id,
        testOrg.id
      );

      const caller = createCaller(testUserOrgAdmin);

      const result = await caller.risk.deleteRiskComment({
        commentId: otherComment.id,
      });

      expect(result.success).toBe(true);
    });

    it("AC19: Non-author without admin role cannot delete comment", async () => {
      const otherComment = await createTestComment(
        testRiskAssignedToIT.id,
        "Comment by GRC Analyst",
        CommentType.GENERAL,
        testUserGRCAnalyst.id,
        testOrg.id
      );

      const caller = createCaller(testUserITStakeholder);

      await expect(
        caller.risk.deleteRiskComment({
          commentId: otherComment.id,
        })
      ).rejects.toThrow(TRPCError);
    });

    it("AC21: Deleted comments show placeholder in query results", async () => {
      const commentToDelete = await createTestComment(
        testRisk.id,
        "This will be deleted",
        CommentType.GENERAL,
        testUserGRCAnalyst.id,
        testOrg.id
      );

      const caller = createCaller(testUserGRCAnalyst);

      // Delete the comment
      await caller.risk.deleteRiskComment({
        commentId: commentToDelete.id,
      });

      // Get comments - deleted comment should still appear with deletedAt set
      const comments = await caller.risk.getRiskComments({
        riskId: testRisk.id,
      });

      const deletedComment = comments.find((c) => c.id === commentToDelete.id);
      expect(deletedComment?.deletedAt).not.toBeNull();
    });
  });

  describe("AC23: Comments Chronological Order", () => {
    it("Comments are returned in chronological order (oldest first)", async () => {
      // Create a fresh risk for this test using raw SQL
      const chronoRiskId = randomUUID();
      await db.$executeRaw`
        INSERT INTO "Risk" (id, title, description, severity, status, "organizationId", "createdById", "createdAt", "updatedAt")
        VALUES (${chronoRiskId}, 'Risk for Chronological Test', 'Testing comment ordering.', 'LOW', 'OPEN', ${testOrg.id}, ${testUserGRCAnalyst.id}, NOW(), NOW())
      `;

      // Create comments with specific timestamps
      const comment1 = await createTestComment(
        chronoRiskId,
        "First comment",
        CommentType.GENERAL,
        testUserGRCAnalyst.id,
        testOrg.id,
        new Date("2025-01-01T10:00:00Z")
      );

      const comment2 = await createTestComment(
        chronoRiskId,
        "Second comment",
        CommentType.GENERAL,
        testUserGRCAnalyst.id,
        testOrg.id,
        new Date("2025-01-01T11:00:00Z")
      );

      const comment3 = await createTestComment(
        chronoRiskId,
        "Third comment",
        CommentType.GENERAL,
        testUserGRCAnalyst.id,
        testOrg.id,
        new Date("2025-01-01T12:00:00Z")
      );

      const caller = createCaller(testUserGRCAnalyst);
      const comments = await caller.risk.getRiskComments({
        riskId: chronoRiskId,
      });

      // Verify order - oldest first
      expect(comments[0].id).toBe(comment1.id);
      expect(comments[1].id).toBe(comment2.id);
      expect(comments[2].id).toBe(comment3.id);

      // Cleanup
      await db.$executeRaw`DELETE FROM "RiskComment" WHERE "riskId" = ${chronoRiskId}`;
      await db.$executeRaw`DELETE FROM "Risk" WHERE id = ${chronoRiskId}`;
    });
  });
});
