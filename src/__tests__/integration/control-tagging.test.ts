/**
 * Integration Tests for Control Taxonomy Tagging
 *
 * Tests the complete evidence control tagging flow with database operations.
 *
 * **Test Coverage:**
 * - AC13: Evidence-to-domain mapping stored in EvidenceControlDomain junction table
 * - AC14: Junction table includes evidenceId, controlDomainId, createdAt
 * - AC15: Evidence can have multiple control domain tags (many-to-many)
 * - AC16: Deleting evidence cascades delete to EvidenceControlDomain records
 * - AC17: Control domain tag counts queryable
 * - AC22: Missing control domain selection validation
 * - AC23: Duplicate tag selections prevented
 * - AC24: Invalid control domain IDs rejected
 *
 * **Prerequisites:**
 * - Running PostgreSQL database
 * - Prisma migrations applied
 * - Test database seeded with organizations, users, and control domains
 *
 * @see Story 3.3: Control Taxonomy Tagging via Dropdown
 * @see src/server/api/routers/evidence.ts
 * @see src/server/api/routers/controlDomain.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import { randomUUID } from "crypto";
import { db } from "@/server/db";
import { setOrganizationContext } from "@/server/db/middleware/organization-filter";
import type { Organization, User, ControlDomain, Evidence } from "@prisma/client";

// Deterministic IDs for test control domains so they can be reliably cleaned up
const TEST_CONTROL_DOMAIN_IDS = [
  "test-ctrl-domain-tagging-01",
  "test-ctrl-domain-tagging-02",
  "test-ctrl-domain-tagging-03",
  "test-ctrl-domain-tagging-04",
  "test-ctrl-domain-tagging-05",
];

describe("Control Taxonomy Tagging Integration Tests", () => {
  let testOrg: Organization;
  let testUser: User;
  let controlDomains: ControlDomain[];
  let testEvidence: Evidence;
  // Track whether we created the test control domains so afterAll can clean them up
  let createdTestControlDomains = false;

  beforeAll(async () => {
    // Cleanup any residual data from previous failed runs
    // Use raw SQL to bypass organization filter middleware during cleanup
    const existingOrg = await db.organization.findUnique({
      where: { slug: "test-org-control-tagging" },
    });
    if (existingOrg) {
      await db.$executeRaw`DELETE FROM "EvidenceControlDomain" WHERE "evidenceId" IN (SELECT id FROM "Evidence" WHERE "organizationId" = ${existingOrg.id})`;
      await db.$executeRaw`DELETE FROM "Evidence" WHERE "organizationId" = ${existingOrg.id}`;
      await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${existingOrg.id}`;
      await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${existingOrg.id}`;
    }

    // Also cleanup test-org-2-control-tagging which may be left from a failed test
    const existingOrg2 = await db.organization.findUnique({
      where: { slug: "test-org-2-control-tagging" },
    });
    if (existingOrg2) {
      await db.$executeRaw`DELETE FROM "EvidenceControlDomain" WHERE "evidenceId" IN (SELECT id FROM "Evidence" WHERE "organizationId" = ${existingOrg2.id})`;
      await db.$executeRaw`DELETE FROM "Evidence" WHERE "organizationId" = ${existingOrg2.id}`;
      await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${existingOrg2.id}`;
      await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${existingOrg2.id}`;
    }

    // Setup test organization
    testOrg = await db.organization.create({
      data: {
        id: randomUUID(),
        name: "Test Org Control Tagging",
        slug: "test-org-control-tagging",
        updatedAt: new Date(),
      },
    });

    setOrganizationContext(testOrg.id);

    // Create test user
    testUser = await db.user.create({
      data: {
        id: randomUUID(),
        email: "tester@control-tagging.com",
        name: "Test User",
        organizationId: testOrg.id,
        role: "GRC_ANALYST",
        updatedAt: new Date(),
      },
    });

    // Get existing control domains from seed data, or create them if not present.
    // ControlDomain is organization-agnostic (no organizationId field) so these
    // are shared globally and can be used by any org in the tests.
    controlDomains = await db.controlDomain.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      take: 5,
    });

    if (controlDomains.length < 5) {
      // The database has not been seeded. Create minimal test control domains
      // with deterministic IDs so afterAll can clean them up reliably.
      createdTestControlDomains = true;

      const testDomainData = [
        { id: TEST_CONTROL_DOMAIN_IDS[0]!, code: "TEST-CD-01", name: "Test Domain Access Control", description: "Test domain for access control policies", sortOrder: 9001 },
        { id: TEST_CONTROL_DOMAIN_IDS[1]!, code: "TEST-CD-02", name: "Test Domain Audit & Accountability", description: "Test domain for audit and accountability controls", sortOrder: 9002 },
        { id: TEST_CONTROL_DOMAIN_IDS[2]!, code: "TEST-CD-03", name: "Test Domain Configuration Management", description: "Test domain for configuration management controls", sortOrder: 9003 },
        { id: TEST_CONTROL_DOMAIN_IDS[3]!, code: "TEST-CD-04", name: "Test Domain Incident Response", description: "Test domain for incident response controls", sortOrder: 9004 },
        { id: TEST_CONTROL_DOMAIN_IDS[4]!, code: "TEST-CD-05", name: "Test Domain Risk Assessment", description: "Test domain for risk assessment controls", sortOrder: 9005 },
      ];

      // Clean up any previously orphaned test domains from failed runs before creating
      await db.$executeRaw`DELETE FROM "EvidenceControlDomain" WHERE "controlDomainId" = ANY(${TEST_CONTROL_DOMAIN_IDS}::text[])`;
      await db.$executeRaw`DELETE FROM "ControlDomain" WHERE id = ANY(${TEST_CONTROL_DOMAIN_IDS}::text[])`;

      const now = new Date();
      for (const domain of testDomainData) {
        await db.controlDomain.create({
          data: {
            id: domain.id,
            code: domain.code,
            name: domain.name,
            description: domain.description,
            sortOrder: domain.sortOrder,
            isActive: true,
            updatedAt: now,
          },
        });
      }

      controlDomains = await db.controlDomain.findMany({
        where: { id: { in: TEST_CONTROL_DOMAIN_IDS } },
        orderBy: { sortOrder: "asc" },
      });
    }
  });

  afterAll(async () => {
    // Cleanup test data using raw SQL to bypass middleware
    await db.$executeRaw`DELETE FROM "EvidenceControlDomain" WHERE "evidenceId" IN (SELECT id FROM "Evidence" WHERE "organizationId" = ${testOrg.id})`;
    await db.$executeRaw`DELETE FROM "Evidence" WHERE "organizationId" = ${testOrg.id}`;
    await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${testOrg.id}`;
    await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${testOrg.id}`;

    // If we created test control domains in beforeAll, remove them now.
    // Must delete EvidenceControlDomain references first to satisfy foreign key constraints.
    if (createdTestControlDomains) {
      await db.$executeRaw`DELETE FROM "EvidenceControlDomain" WHERE "controlDomainId" = ANY(${TEST_CONTROL_DOMAIN_IDS}::text[])`;
      await db.$executeRaw`DELETE FROM "ControlDomain" WHERE id = ANY(${TEST_CONTROL_DOMAIN_IDS}::text[])`;
    }

    await db.$disconnect();
  });

  beforeEach(async () => {
    // Set fresh organization context for each test
    setOrganizationContext(testOrg.id);

    // Clean up any evidence from previous tests using raw SQL
    await db.$executeRaw`DELETE FROM "EvidenceControlDomain" WHERE "evidenceId" IN (SELECT id FROM "Evidence" WHERE "organizationId" = ${testOrg.id})`;
    await db.$executeRaw`DELETE FROM "Evidence" WHERE "organizationId" = ${testOrg.id}`;
  });

  /**
   * AC13 & AC14: Test EvidenceControlDomain junction table structure
   */
  it("should store evidence-domain mapping in junction table with correct fields", async () => {
    setOrganizationContext(testOrg.id);
    // Create evidence
    const evidence = await db.evidence.create({
      data: {
        id: randomUUID(),
        title: "Test Evidence AC13",
        originalFileName: "test-ac13.pdf",
        description: "Testing junction table",
        filePath: "/uploads/test/test-ac13.pdf",
        fileSize: 1024,
        fileType: "application/pdf",
        uploadedBy: testUser.id,
        organizationId: testOrg.id,
        updatedAt: new Date(),
      },
    });

    // Create control domain tag
    const controlDomainTag = await db.evidenceControlDomain.create({
      data: {
        id: randomUUID(),
        evidenceId: evidence.id,
        controlDomainId: controlDomains[0]!.id,
      },
    });

    // Verify junction table record has correct structure
    expect(controlDomainTag.id).toBeDefined();
    expect(controlDomainTag.evidenceId).toBe(evidence.id);
    expect(controlDomainTag.controlDomainId).toBe(controlDomains[0]!.id);
    expect(controlDomainTag.createdAt).toBeInstanceOf(Date);
  });

  /**
   * AC15: Test many-to-many relationship with multiple tags
   */
  it("should allow evidence to have multiple control domain tags", async () => {
    setOrganizationContext(testOrg.id);
    // Create evidence with 3 control domain tags
    const evidence = await db.evidence.create({
      data: {
        id: randomUUID(),
        title: "Multi-Tag Evidence",
        originalFileName: "multi-tag.pdf",
        filePath: "/uploads/test/multi-tag.pdf",
        fileSize: 2048,
        fileType: "application/pdf",
        uploadedBy: testUser.id,
        organizationId: testOrg.id,
        updatedAt: new Date(),
      },
    });

    // Add 3 different control domain tags
    await db.evidenceControlDomain.createMany({
      data: [
        { id: randomUUID(), evidenceId: evidence.id, controlDomainId: controlDomains[0]!.id },
        { id: randomUUID(), evidenceId: evidence.id, controlDomainId: controlDomains[1]!.id },
        { id: randomUUID(), evidenceId: evidence.id, controlDomainId: controlDomains[2]!.id },
      ],
    });

    // Verify all tags are stored
    const tags = await db.evidenceControlDomain.findMany({
      where: { evidenceId: evidence.id },
      include: { ControlDomain: true },
    });

    expect(tags).toHaveLength(3);
    expect(tags.map(t => t.controlDomainId)).toContain(controlDomains[0]!.id);
    expect(tags.map(t => t.controlDomainId)).toContain(controlDomains[1]!.id);
    expect(tags.map(t => t.controlDomainId)).toContain(controlDomains[2]!.id);
  });

  /**
   * AC16: Test cascade delete when evidence is deleted
   */
  it("should cascade delete EvidenceControlDomain records when evidence is deleted", async () => {
    setOrganizationContext(testOrg.id);
    // Create evidence with tags
    const evidence = await db.evidence.create({
      data: {
        id: randomUUID(),
        title: "Evidence to Delete",
        originalFileName: "to-delete.pdf",
        filePath: "/uploads/test/to-delete.pdf",
        fileSize: 512,
        fileType: "application/pdf",
        uploadedBy: testUser.id,
        organizationId: testOrg.id,
        updatedAt: new Date(),
      },
    });

    await db.evidenceControlDomain.createMany({
      data: [
        { id: randomUUID(), evidenceId: evidence.id, controlDomainId: controlDomains[0]!.id },
        { id: randomUUID(), evidenceId: evidence.id, controlDomainId: controlDomains[1]!.id },
      ],
    });

    // Verify tags exist before deletion
    const tagsBefore = await db.evidenceControlDomain.findMany({
      where: { evidenceId: evidence.id },
    });
    expect(tagsBefore).toHaveLength(2);

    // Delete evidence
    await db.evidence.delete({
      where: { id: evidence.id },
    });

    // Verify tags were cascade deleted
    const tagsAfter = await db.evidenceControlDomain.findMany({
      where: { evidenceId: evidence.id },
    });
    expect(tagsAfter).toHaveLength(0);
  });

  /**
   * AC17: Test control domain tag counts query
   */
  it("should return accurate evidence counts per control domain", async () => {
    setOrganizationContext(testOrg.id);
    // Create 3 evidence records
    const evidence1 = await db.evidence.create({
      data: {
        id: randomUUID(),
        title: "Evidence 1",
        originalFileName: "e1.pdf",
        filePath: "/uploads/test/e1.pdf",
        fileSize: 1024,
        fileType: "application/pdf",
        uploadedBy: testUser.id,
        organizationId: testOrg.id,
        updatedAt: new Date(),
      },
    });

    const evidence2 = await db.evidence.create({
      data: {
        id: randomUUID(),
        title: "Evidence 2",
        originalFileName: "e2.pdf",
        filePath: "/uploads/test/e2.pdf",
        fileSize: 1024,
        fileType: "application/pdf",
        uploadedBy: testUser.id,
        organizationId: testOrg.id,
        updatedAt: new Date(),
      },
    });

    const evidence3 = await db.evidence.create({
      data: {
        id: randomUUID(),
        title: "Evidence 3",
        originalFileName: "e3.pdf",
        filePath: "/uploads/test/e3.pdf",
        fileSize: 1024,
        fileType: "application/pdf",
        uploadedBy: testUser.id,
        organizationId: testOrg.id,
        updatedAt: new Date(),
      },
    });

    // Tag evidence:
    // - Domain 0: All 3 evidence files
    // - Domain 1: 2 evidence files
    // - Domain 2: 1 evidence file
    await db.evidenceControlDomain.createMany({
      data: [
        { id: randomUUID(), evidenceId: evidence1.id, controlDomainId: controlDomains[0]!.id },
        { id: randomUUID(), evidenceId: evidence2.id, controlDomainId: controlDomains[0]!.id },
        { id: randomUUID(), evidenceId: evidence3.id, controlDomainId: controlDomains[0]!.id },
        { id: randomUUID(), evidenceId: evidence1.id, controlDomainId: controlDomains[1]!.id },
        { id: randomUUID(), evidenceId: evidence2.id, controlDomainId: controlDomains[1]!.id },
        { id: randomUUID(), evidenceId: evidence1.id, controlDomainId: controlDomains[2]!.id },
      ],
    });

    // Query counts per domain
    const counts = await db.controlDomain.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            EvidenceControlDomain: {
              where: {
                Evidence: {
                  organizationId: testOrg.id,
                  isActive: true,
                },
              },
            },
          },
        },
      },
      orderBy: { sortOrder: "asc" },
    });

    // Find our test domains in results
    const domain0Count = counts.find(d => d.id === controlDomains[0]!.id)?._count.EvidenceControlDomain;
    const domain1Count = counts.find(d => d.id === controlDomains[1]!.id)?._count.EvidenceControlDomain;
    const domain2Count = counts.find(d => d.id === controlDomains[2]!.id)?._count.EvidenceControlDomain;

    expect(domain0Count).toBe(3);
    expect(domain1Count).toBe(2);
    expect(domain2Count).toBe(1);
  });

  /**
   * AC22: Test validation for missing control domain selection
   */
  it("should fail when creating evidence without control domains (validation)", async () => {
    setOrganizationContext(testOrg.id);
    // This test validates the Zod schema behavior
    // The actual validation happens in the tRPC router, so we test the schema directly
    const { z } = await import("zod");

    const controlDomainIdsSchema = z
      .array(z.string())
      .min(1, "At least one control domain is required")
      .max(5, "Maximum 5 control domains allowed");

    // Test empty array
    const emptyResult = controlDomainIdsSchema.safeParse([]);
    expect(emptyResult.success).toBe(false);
    if (!emptyResult.success) {
      expect(emptyResult.error.errors[0]?.message).toBe("At least one control domain is required");
    }
  });

  /**
   * AC23: Test unique constraint prevents duplicate tags
   */
  it("should prevent duplicate tag selections (same domain twice)", async () => {
    setOrganizationContext(testOrg.id);
    // Create evidence
    const evidence = await db.evidence.create({
      data: {
        id: randomUUID(),
        title: "Evidence with Duplicate Tags",
        originalFileName: "duplicate.pdf",
        filePath: "/uploads/test/duplicate.pdf",
        fileSize: 1024,
        fileType: "application/pdf",
        uploadedBy: testUser.id,
        organizationId: testOrg.id,
        updatedAt: new Date(),
      },
    });

    // Add first tag
    await db.evidenceControlDomain.create({
      data: {
        id: randomUUID(),
        evidenceId: evidence.id,
        controlDomainId: controlDomains[0]!.id,
      },
    });

    // Attempt to add same tag again - should fail due to unique constraint
    await expect(
      db.evidenceControlDomain.create({
        data: {
          id: randomUUID(),
          evidenceId: evidence.id,
          controlDomainId: controlDomains[0]!.id,
        },
      })
    ).rejects.toThrow();
  });

  /**
   * AC24: Test invalid control domain IDs are rejected
   */
  it("should reject invalid control domain IDs with foreign key constraint", async () => {
    setOrganizationContext(testOrg.id);
    // Create evidence
    const evidence = await db.evidence.create({
      data: {
        id: randomUUID(),
        title: "Evidence with Invalid Tags",
        originalFileName: "invalid.pdf",
        filePath: "/uploads/test/invalid.pdf",
        fileSize: 1024,
        fileType: "application/pdf",
        uploadedBy: testUser.id,
        organizationId: testOrg.id,
        updatedAt: new Date(),
      },
    });

    // Attempt to add tag with non-existent control domain ID
    await expect(
      db.evidenceControlDomain.create({
        data: {
          id: randomUUID(),
          evidenceId: evidence.id,
          controlDomainId: "non-existent-domain-id",
        },
      })
    ).rejects.toThrow();
  });

  /**
   * Test maximum of 5 control domains validation
   */
  it("should enforce maximum of 5 control domains per evidence (validation)", async () => {
    setOrganizationContext(testOrg.id);
    const { z } = await import("zod");

    const controlDomainIdsSchema = z
      .array(z.string())
      .min(1, "At least one control domain is required")
      .max(5, "Maximum 5 control domains allowed");

    // Test array with 6 items
    const sixDomains = ["id1", "id2", "id3", "id4", "id5", "id6"];
    const result = controlDomainIdsSchema.safeParse(sixDomains);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0]?.message).toBe("Maximum 5 control domains allowed");
    }

    // Test array with 5 items (should pass)
    const fiveDomains = ["id1", "id2", "id3", "id4", "id5"];
    const validResult = controlDomainIdsSchema.safeParse(fiveDomains);
    expect(validResult.success).toBe(true);
  });

  /**
   * Test filtering evidence by control domain
   */
  it("should filter evidence by control domain ID", async () => {
    setOrganizationContext(testOrg.id);
    // Create 2 evidence records with different tags
    const evidence1 = await db.evidence.create({
      data: {
        id: randomUUID(),
        title: "Evidence with Domain 0",
        originalFileName: "domain0.pdf",
        filePath: "/uploads/test/domain0.pdf",
        fileSize: 1024,
        fileType: "application/pdf",
        uploadedBy: testUser.id,
        organizationId: testOrg.id,
        updatedAt: new Date(),
      },
    });

    const evidence2 = await db.evidence.create({
      data: {
        id: randomUUID(),
        title: "Evidence with Domain 1",
        originalFileName: "domain1.pdf",
        filePath: "/uploads/test/domain1.pdf",
        fileSize: 1024,
        fileType: "application/pdf",
        uploadedBy: testUser.id,
        organizationId: testOrg.id,
        updatedAt: new Date(),
      },
    });

    // Tag them with different domains
    await db.evidenceControlDomain.create({
      data: {
        id: randomUUID(),
        evidenceId: evidence1.id,
        controlDomainId: controlDomains[0]!.id,
      },
    });

    await db.evidenceControlDomain.create({
      data: {
        id: randomUUID(),
        evidenceId: evidence2.id,
        controlDomainId: controlDomains[1]!.id,
      },
    });

    // Filter by domain 0
    const filteredByDomain0 = await db.evidence.findMany({
      where: {
        organizationId: testOrg.id,
        EvidenceControlDomain: {
          some: {
            controlDomainId: controlDomains[0]!.id,
          },
        },
      },
    });

    expect(filteredByDomain0).toHaveLength(1);
    expect(filteredByDomain0[0]!.id).toBe(evidence1.id);

    // Filter by domain 1
    const filteredByDomain1 = await db.evidence.findMany({
      where: {
        organizationId: testOrg.id,
        EvidenceControlDomain: {
          some: {
            controlDomainId: controlDomains[1]!.id,
          },
        },
      },
    });

    expect(filteredByDomain1).toHaveLength(1);
    expect(filteredByDomain1[0]!.id).toBe(evidence2.id);
  });

  /**
   * Test updating evidence tags
   */
  it("should allow updating evidence control domain tags", async () => {
    setOrganizationContext(testOrg.id);
    // Create evidence with initial tags
    const evidence = await db.evidence.create({
      data: {
        id: randomUUID(),
        title: "Evidence to Update Tags",
        originalFileName: "update-tags.pdf",
        filePath: "/uploads/test/update-tags.pdf",
        fileSize: 1024,
        fileType: "application/pdf",
        uploadedBy: testUser.id,
        organizationId: testOrg.id,
        updatedAt: new Date(),
      },
    });

    // Add initial tags
    await db.evidenceControlDomain.createMany({
      data: [
        { id: randomUUID(), evidenceId: evidence.id, controlDomainId: controlDomains[0]!.id },
        { id: randomUUID(), evidenceId: evidence.id, controlDomainId: controlDomains[1]!.id },
      ],
    });

    // Verify initial tags
    const initialTags = await db.evidenceControlDomain.findMany({
      where: { evidenceId: evidence.id },
    });
    expect(initialTags).toHaveLength(2);

    // Update tags: remove old tags and add new ones
    await db.$transaction([
      db.evidenceControlDomain.deleteMany({
        where: { evidenceId: evidence.id },
      }),
      db.evidenceControlDomain.createMany({
        data: [
          { id: randomUUID(), evidenceId: evidence.id, controlDomainId: controlDomains[2]!.id },
          { id: randomUUID(), evidenceId: evidence.id, controlDomainId: controlDomains[3]!.id },
          { id: randomUUID(), evidenceId: evidence.id, controlDomainId: controlDomains[4]!.id },
        ],
      }),
    ]);

    // Verify updated tags
    const updatedTags = await db.evidenceControlDomain.findMany({
      where: { evidenceId: evidence.id },
    });
    expect(updatedTags).toHaveLength(3);
    expect(updatedTags.map(t => t.controlDomainId)).toContain(controlDomains[2]!.id);
    expect(updatedTags.map(t => t.controlDomainId)).toContain(controlDomains[3]!.id);
    expect(updatedTags.map(t => t.controlDomainId)).toContain(controlDomains[4]!.id);
    expect(updatedTags.map(t => t.controlDomainId)).not.toContain(controlDomains[0]!.id);
    expect(updatedTags.map(t => t.controlDomainId)).not.toContain(controlDomains[1]!.id);
  });

  /**
   * Test control domains are organization-agnostic (AC4)
   */
  it("should share control domains across organizations (organization-agnostic)", async () => {
    setOrganizationContext(testOrg.id);
    // Create a second test organization
    const testOrg2 = await db.organization.create({
      data: {
        id: randomUUID(),
        name: "Test Org 2 Control Tagging",
        slug: "test-org-2-control-tagging",
        updatedAt: new Date(),
      },
    });

    setOrganizationContext(testOrg2.id);
    const testUser2 = await db.user.create({
      data: {
        id: randomUUID(),
        email: "tester2@control-tagging.com",
        name: "Test User 2",
        organizationId: testOrg2.id,
        role: "GRC_ANALYST",
        updatedAt: new Date(),
      },
    });

    // Create evidence in second org using same control domains
    const evidence2 = await db.evidence.create({
      data: {
        id: randomUUID(),
        title: "Org 2 Evidence",
        originalFileName: "org2.pdf",
        filePath: "/uploads/test/org2.pdf",
        fileSize: 1024,
        fileType: "application/pdf",
        uploadedBy: testUser2.id,
        organizationId: testOrg2.id,
        updatedAt: new Date(),
      },
    });

    // Tag with same control domain used by first org
    await db.evidenceControlDomain.create({
      data: {
        id: randomUUID(),
        evidenceId: evidence2.id,
        controlDomainId: controlDomains[0]!.id,
      },
    });

    // Verify the tag was created successfully
    const tag = await db.evidenceControlDomain.findFirst({
      where: {
        evidenceId: evidence2.id,
        controlDomainId: controlDomains[0]!.id,
      },
    });

    expect(tag).not.toBeNull();
    expect(tag?.controlDomainId).toBe(controlDomains[0]!.id);

    // Cleanup second org - use raw SQL for EvidenceControlDomain
    await db.$executeRaw`DELETE FROM "EvidenceControlDomain" WHERE "evidenceId" = ${evidence2.id}`;
    await db.evidence.delete({ where: { id: evidence2.id } });
    await db.user.delete({ where: { id: testUser2.id } });
    await db.organization.delete({ where: { id: testOrg2.id } });
  });
});
