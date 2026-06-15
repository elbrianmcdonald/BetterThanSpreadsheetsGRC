/**
 * Integration Tests for Evidence Framework Mapping (OSCAL Translation)
 *
 * Tests the evidence amplification engine that shows how evidence tagged
 * with control domains maps to framework-specific controls.
 *
 * **Test Coverage:**
 * - AC1-AC3: OSCAL mapping calculation
 * - AC4-AC6: Framework grouping and filtering
 * - AC21: Performance (< 500ms for 5 control domains)
 *
 * **Prerequisites:**
 * - Running PostgreSQL database
 * - Prisma migrations applied
 * - Test database seeded with:
 *   - Organizations and users
 *   - Control domains (12 simplified domains)
 *   - Control domain mappings (domain -> framework control mappings)
 *   - Frameworks (ISO 27001, SOC 2, NIST CSF)
 *   - Controls for each framework
 *
 * @see Story 3.4: Automatic OSCAL Mapping Display
 * @see src/server/services/evidence-mapping.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import { randomUUID } from "crypto";
import { db } from "@/server/db";
import { setOrganizationContext } from "@/server/db/middleware/organization-filter";
import { evidenceMappingService } from "@/server/services/evidence-mapping";
import type { Organization, User, Framework, Control, ControlDomain } from "@prisma/client";

describe("Evidence Framework Mapping Integration Tests", () => {
  let testOrg: Organization;
  let testUser: User;
  let testFramework: Framework;
  let testControls: Control[];
  let controlDomains: ControlDomain[];

  beforeAll(async () => {
    // Cleanup any residual data from previous failed runs
    const existingOrg = await db.organization.findUnique({
      where: { slug: "test-org-evidence-mapping" },
    });
    if (existingOrg) {
      setOrganizationContext(existingOrg.id);
      // Use raw query for EvidenceControlDomain since it doesn't have organizationId
      await db.$executeRaw`DELETE FROM "EvidenceControlDomain" WHERE "evidenceId" IN (SELECT id FROM "Evidence" WHERE "organizationId" = ${existingOrg.id})`;
      await db.evidence.deleteMany({ where: { organizationId: existingOrg.id } });
      await db.control.deleteMany({ where: { organizationId: existingOrg.id } });
      await db.framework.deleteMany({ where: { organizationId: existingOrg.id } });
      await db.user.deleteMany({ where: { organizationId: existingOrg.id } });
      await db.organization.delete({ where: { id: existingOrg.id } });
    }

    // Setup test organization
    testOrg = await db.organization.create({
      data: {
        id: randomUUID(),
        name: "Test Org Evidence Mapping",
        slug: "test-org-evidence-mapping",
        updatedAt: new Date(),
      },
    });

    setOrganizationContext(testOrg.id);

    // Create test user
    testUser = await db.user.create({
      data: {
        id: randomUUID(),
        email: "tester@evidence-mapping.com",
        name: "Test User",
        organizationId: testOrg.id,
        role: "GRC_ANALYST",
        updatedAt: new Date(),
      },
    });

    // Get existing control domains from seed data, or create them if not present
    controlDomains = await db.controlDomain.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });

    // Create control domains if they don't exist (for test isolation)
    if (controlDomains.length < 3) {
      const domainData = [
        { code: "TEST_DOMAIN_1", name: "Test Domain 1", description: "First test domain", sortOrder: 1 },
        { code: "TEST_DOMAIN_2", name: "Test Domain 2", description: "Second test domain", sortOrder: 2 },
        { code: "TEST_DOMAIN_3", name: "Test Domain 3", description: "Third test domain", sortOrder: 3 },
      ];

      for (const domain of domainData) {
        const existing = await db.controlDomain.findFirst({
          where: { code: domain.code },
        });
        if (!existing) {
          await db.controlDomain.create({
            data: {
              id: randomUUID(),
              ...domain,
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });
        }
      }

      // Re-fetch control domains
      controlDomains = await db.controlDomain.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      });
    }

    // Create test framework (active)
    testFramework = await db.framework.create({
      data: {
        id: randomUUID(),
        organizationId: testOrg.id,
        code: "TEST_FW",
        name: "Test Framework",
        version: "1.0",
        description: "Test framework for evidence mapping tests",
        isActive: true,
        activatedAt: new Date(),
        activatedBy: testUser.id,
        updatedAt: new Date(),
      },
    });

    // Create test controls for the framework
    testControls = [];
    const controlData = [
      { controlId: "TF.1.1", title: "Test Control 1", description: "First test control" },
      { controlId: "TF.1.2", title: "Test Control 2", description: "Second test control" },
      { controlId: "TF.2.1", title: "Test Control 3", description: "Third test control" },
    ];

    for (const ctrl of controlData) {
      const control = await db.control.create({
        data: {
          id: randomUUID(),
          organizationId: testOrg.id,
          frameworkId: testFramework.id,
          ...ctrl,
          isActive: true,
          updatedAt: new Date(),
        },
      });
      testControls.push(control);
    }

    // Create control domain mappings for our test framework
    // Map first control domain to TF.1.1 and TF.1.2
    await db.controlDomainMapping.createMany({
      data: [
        {
          id: randomUUID(),
          controlDomainId: controlDomains[0]!.id,
          frameworkCode: "TEST_FW",
          controlId: "TF.1.1",
          confidence: 100,
          updatedAt: new Date(),
        },
        {
          id: randomUUID(),
          controlDomainId: controlDomains[0]!.id,
          frameworkCode: "TEST_FW",
          controlId: "TF.1.2",
          confidence: 95,
          updatedAt: new Date(),
        },
        // Map second control domain to TF.2.1
        {
          id: randomUUID(),
          controlDomainId: controlDomains[1]!.id,
          frameworkCode: "TEST_FW",
          controlId: "TF.2.1",
          confidence: 90,
          updatedAt: new Date(),
        },
      ],
    });
  });

  afterAll(async () => {
    // Cleanup test data
    setOrganizationContext(testOrg.id);

    // Delete control domain mappings for our test framework
    await db.controlDomainMapping.deleteMany({
      where: { frameworkCode: "TEST_FW" },
    });

    // Delete test controls
    await db.control.deleteMany({
      where: { frameworkId: testFramework.id },
    });

    // Delete test framework
    await db.framework.delete({
      where: { id: testFramework.id },
    });

    // Delete test user
    await db.user.deleteMany({
      where: { id: testUser.id },
    });

    // Delete test organization
    await db.organization.delete({
      where: { id: testOrg.id },
    });

    await db.$disconnect();
  });

  // Reset organization context before each test (in case another test file cleared it)
  beforeEach(() => {
    if (testOrg?.id) {
      setOrganizationContext(testOrg.id);
    }
  });

  /**
   * AC1-AC3: Test OSCAL mapping calculation with single domain
   */
  it("should return framework controls for a single control domain", async () => {
    setOrganizationContext(testOrg.id);
    const result = await evidenceMappingService.calculateFrameworkMappings({
      controlDomainIds: [controlDomains[0]!.id],
      organizationId: testOrg.id,
    });

    // Should have our test framework
    expect(result.frameworkCount).toBeGreaterThanOrEqual(1);
    expect(result.totalControlCount).toBeGreaterThanOrEqual(2);

    // Find our test framework in results
    const testFw = result.frameworks.find((f) => f.frameworkCode === "TEST_FW");
    expect(testFw).toBeDefined();
    expect(testFw?.controlCount).toBe(2);
    expect(testFw?.controls.map((c) => c.controlId)).toContain("TF.1.1");
    expect(testFw?.controls.map((c) => c.controlId)).toContain("TF.1.2");
  });

  /**
   * AC1-AC3: Test mapping with multiple control domains (union of controls)
   */
  it("should return union of controls for multiple control domains", async () => {
    setOrganizationContext(testOrg.id);
    const result = await evidenceMappingService.calculateFrameworkMappings({
      controlDomainIds: [controlDomains[0]!.id, controlDomains[1]!.id],
      organizationId: testOrg.id,
    });

    // Find our test framework
    const testFw = result.frameworks.find((f) => f.frameworkCode === "TEST_FW");
    expect(testFw).toBeDefined();
    expect(testFw?.controlCount).toBe(3); // TF.1.1, TF.1.2, TF.2.1
    expect(testFw?.controls.map((c) => c.controlId)).toContain("TF.1.1");
    expect(testFw?.controls.map((c) => c.controlId)).toContain("TF.1.2");
    expect(testFw?.controls.map((c) => c.controlId)).toContain("TF.2.1");
  });

  /**
   * AC4: Test controls grouped by framework
   */
  it("should group controls by framework", async () => {
    setOrganizationContext(testOrg.id);
    const result = await evidenceMappingService.calculateFrameworkMappings({
      controlDomainIds: [controlDomains[0]!.id],
      organizationId: testOrg.id,
    });

    // Each framework should have its own group
    for (const framework of result.frameworks) {
      expect(framework.frameworkId).toBeDefined();
      expect(framework.frameworkCode).toBeDefined();
      expect(framework.frameworkName).toBeDefined();
      expect(framework.controls).toBeInstanceOf(Array);
      expect(framework.controlCount).toBe(framework.controls.length);
    }
  });

  /**
   * AC5: Test mapping excludes inactive frameworks
   */
  it("should exclude controls from inactive frameworks", async () => {
    setOrganizationContext(testOrg.id);
    // Create an inactive framework with controls
    const inactiveFramework = await db.framework.create({
      data: {
        id: randomUUID(),
        organizationId: testOrg.id,
        code: "INACTIVE_FW",
        name: "Inactive Framework",
        version: "1.0",
        description: "Inactive framework for testing",
        isActive: false, // Inactive!
        updatedAt: new Date(),
      },
    });

    await db.control.create({
      data: {
        id: randomUUID(),
        organizationId: testOrg.id,
        frameworkId: inactiveFramework.id,
        controlId: "IF.1.1",
        title: "Inactive Control",
        description: "Control from inactive framework",
        isActive: true,
        updatedAt: new Date(),
      },
    });

    await db.controlDomainMapping.create({
      data: {
        id: randomUUID(),
        controlDomainId: controlDomains[0]!.id,
        frameworkCode: "INACTIVE_FW",
        controlId: "IF.1.1",
        confidence: 100,
        updatedAt: new Date(),
      },
    });

    // Calculate mappings
    const result = await evidenceMappingService.calculateFrameworkMappings({
      controlDomainIds: [controlDomains[0]!.id],
      organizationId: testOrg.id,
    });

    // Should NOT include the inactive framework
    const inactiveFw = result.frameworks.find((f) => f.frameworkCode === "INACTIVE_FW");
    expect(inactiveFw).toBeUndefined();

    // Cleanup
    await db.controlDomainMapping.deleteMany({
      where: { frameworkCode: "INACTIVE_FW" },
    });
    await db.control.deleteMany({
      where: { frameworkId: inactiveFramework.id },
    });
    await db.framework.delete({
      where: { id: inactiveFramework.id },
    });
  });

  /**
   * AC6: Test empty framework groups are hidden
   */
  it("should hide frameworks with no matched controls", async () => {
    setOrganizationContext(testOrg.id);
    // Use a control domain that has no mappings to our test framework
    // First, create a control domain with no mappings
    const emptyDomain = await db.controlDomain.create({
      data: {
        id: randomUUID(),
        code: "TEST_EMPTY_DOMAIN",
        name: "Test Empty Domain",
        description: "Domain with no mappings",
        sortOrder: 999,
        isActive: true,
        updatedAt: new Date(),
      },
    });

    const result = await evidenceMappingService.calculateFrameworkMappings({
      controlDomainIds: [emptyDomain.id],
      organizationId: testOrg.id,
    });

    // Should return empty results (no frameworks with controls)
    expect(result.frameworkCount).toBe(0);
    expect(result.totalControlCount).toBe(0);
    expect(result.frameworks).toHaveLength(0);

    // Cleanup
    await db.controlDomain.delete({
      where: { id: emptyDomain.id },
    });
  });

  /**
   * Test empty input returns empty result
   */
  it("should return empty result for empty control domain array", async () => {
    setOrganizationContext(testOrg.id);
    const result = await evidenceMappingService.calculateFrameworkMappings({
      controlDomainIds: [],
      organizationId: testOrg.id,
    });

    expect(result.frameworks).toHaveLength(0);
    expect(result.totalControlCount).toBe(0);
    expect(result.frameworkCount).toBe(0);
  });

  /**
   * Test control details include title and description
   */
  it("should include control title and description in results", async () => {
    setOrganizationContext(testOrg.id);
    const result = await evidenceMappingService.calculateFrameworkMappings({
      controlDomainIds: [controlDomains[0]!.id],
      organizationId: testOrg.id,
    });

    const testFw = result.frameworks.find((f) => f.frameworkCode === "TEST_FW");
    expect(testFw).toBeDefined();

    const control = testFw?.controls.find((c) => c.controlId === "TF.1.1");
    expect(control).toBeDefined();
    expect(control?.title).toBe("Test Control 1");
    expect(control?.description).toBe("First test control");
  });

  /**
   * Test confidence scores are included
   */
  it("should include confidence scores for mapped controls", async () => {
    setOrganizationContext(testOrg.id);
    const result = await evidenceMappingService.calculateFrameworkMappings({
      controlDomainIds: [controlDomains[0]!.id],
      organizationId: testOrg.id,
    });

    const testFw = result.frameworks.find((f) => f.frameworkCode === "TEST_FW");
    expect(testFw).toBeDefined();

    // TF.1.1 has 100% confidence
    const control1 = testFw?.controls.find((c) => c.controlId === "TF.1.1");
    expect(control1?.confidence).toBe(100);

    // TF.1.2 has 95% confidence
    const control2 = testFw?.controls.find((c) => c.controlId === "TF.1.2");
    expect(control2?.confidence).toBe(95);
  });

  /**
   * Test calculateMappingsForEvidence method
   */
  it("should calculate mappings for evidence by ID", async () => {
    setOrganizationContext(testOrg.id);
    // Create test evidence with control domains using raw SQL to bypass organization middleware
    const evidenceId = randomUUID();
    const now = new Date();
    await db.$executeRaw`
      INSERT INTO "Evidence" (id, "organizationId", title, "originalFileName", "filePath", "fileSize", "fileType", "uploadedBy", "isActive", "currentVersion", "createdAt", "updatedAt")
      VALUES (${evidenceId}, ${testOrg.id}, 'Test Evidence for Mapping', 'test-mapping.pdf', '/uploads/test/test-mapping.pdf', 1024, 'application/pdf', ${testUser.id}, true, 1, ${now}, ${now})
    `;

    // Add control domain tags
    const ecdId1 = randomUUID();
    const ecdId2 = randomUUID();
    await db.$executeRaw`
      INSERT INTO "EvidenceControlDomain" (id, "evidenceId", "controlDomainId")
      VALUES (${ecdId1}, ${evidenceId}, ${controlDomains[0]!.id})
    `;
    await db.$executeRaw`
      INSERT INTO "EvidenceControlDomain" (id, "evidenceId", "controlDomainId")
      VALUES (${ecdId2}, ${evidenceId}, ${controlDomains[1]!.id})
    `;

    // Calculate mappings for evidence
    const result = await evidenceMappingService.calculateMappingsForEvidence({
      evidenceId: evidenceId,
      organizationId: testOrg.id,
    });

    expect(result).not.toBeNull();
    expect(result!.totalControlCount).toBeGreaterThanOrEqual(3);

    // Find our test framework
    const testFw = result!.frameworks.find((f) => f.frameworkCode === "TEST_FW");
    expect(testFw).toBeDefined();
    expect(testFw?.controlCount).toBe(3);

    // Cleanup
    await db.$executeRaw`DELETE FROM "EvidenceControlDomain" WHERE "evidenceId" = ${evidenceId}`;
    await db.$executeRaw`DELETE FROM "Evidence" WHERE "id" = ${evidenceId}`;
  });

  /**
   * Test calculateMappingsForEvidence returns null for non-existent evidence
   */
  it("should return null for non-existent evidence", async () => {
    setOrganizationContext(testOrg.id);
    const result = await evidenceMappingService.calculateMappingsForEvidence({
      evidenceId: "00000000-0000-0000-0000-000000000000",
      organizationId: testOrg.id,
    });

    expect(result).toBeNull();
  });

  /**
   * AC21: Test performance (< 500ms for 5 control domains)
   */
  it("should complete mapping calculation within 500ms for 5 domains", async () => {
    setOrganizationContext(testOrg.id);
    // Get 5 control domains
    const fiveDomains = controlDomains.slice(0, 5).map((d) => d.id);

    const startTime = Date.now();
    const result = await evidenceMappingService.calculateFrameworkMappings({
      controlDomainIds: fiveDomains,
      organizationId: testOrg.id,
    });
    const endTime = Date.now();

    const duration = endTime - startTime;
    console.log(`Mapping calculation took ${duration}ms for 5 domains`);

    // Should complete within 500ms
    expect(duration).toBeLessThan(500);

    // Should return results
    expect(result).toBeDefined();
  });

  /**
   * Test getControlCount method for lightweight counting
   */
  it("should return correct control count", async () => {
    setOrganizationContext(testOrg.id);
    const count = await evidenceMappingService.getControlCount({
      controlDomainIds: [controlDomains[0]!.id, controlDomains[1]!.id],
      organizationId: testOrg.id,
    });

    // Should be at least 3 (our test framework controls)
    expect(count).toBeGreaterThanOrEqual(3);
  });

  /**
   * Test getControlCount returns 0 for empty input
   */
  it("should return 0 count for empty domain array", async () => {
    setOrganizationContext(testOrg.id);
    const count = await evidenceMappingService.getControlCount({
      controlDomainIds: [],
      organizationId: testOrg.id,
    });

    expect(count).toBe(0);
  });

  /**
   * Test frameworks are sorted alphabetically
   */
  it("should sort frameworks alphabetically by name", async () => {
    setOrganizationContext(testOrg.id);
    const result = await evidenceMappingService.calculateFrameworkMappings({
      controlDomainIds: [controlDomains[0]!.id],
      organizationId: testOrg.id,
    });

    // Verify alphabetical sorting
    const frameworkNames = result.frameworks.map((f) => f.frameworkName);
    const sortedNames = [...frameworkNames].sort((a, b) => a.localeCompare(b));
    expect(frameworkNames).toEqual(sortedNames);
  });

  /**
   * Test no duplicate controls when same control mapped from multiple domains
   */
  it("should not duplicate controls when mapped from multiple domains", async () => {
    setOrganizationContext(testOrg.id);
    // Map a second domain to the same control
    await db.controlDomainMapping.create({
      data: {
        id: randomUUID(),
        controlDomainId: controlDomains[1]!.id,
        frameworkCode: "TEST_FW",
        controlId: "TF.1.1", // Same as domain 0
        confidence: 85,
        updatedAt: new Date(),
      },
    });

    const result = await evidenceMappingService.calculateFrameworkMappings({
      controlDomainIds: [controlDomains[0]!.id, controlDomains[1]!.id],
      organizationId: testOrg.id,
    });

    const testFw = result.frameworks.find((f) => f.frameworkCode === "TEST_FW");
    expect(testFw).toBeDefined();

    // TF.1.1 should appear only once (with highest confidence)
    const tf11Controls = testFw?.controls.filter((c) => c.controlId === "TF.1.1");
    expect(tf11Controls?.length).toBe(1);
    // Should keep the higher confidence (100 from domain 0)
    expect(tf11Controls?.[0]?.confidence).toBe(100);

    // Cleanup
    await db.controlDomainMapping.deleteMany({
      where: {
        controlDomainId: controlDomains[1]!.id,
        frameworkCode: "TEST_FW",
        controlId: "TF.1.1",
      },
    });
  });
});
