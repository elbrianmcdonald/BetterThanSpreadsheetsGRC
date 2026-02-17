/**
 * Business Impact Statement Generation - Integration Tests
 *
 * Story 4.8: Automated Business Impact Statement Generation
 *
 * Tests:
 * - Regulatory impact generation based on frameworks
 * - Operational impact based on severity + asset criticality
 * - Business context based on risk template category
 * - Manual edit flag functionality
 * - Word count validation
 *
 * @see Story 4.8 AC1-AC36
 */

import {
  generateRegulatoryImpact,
  generateOperationalImpact,
  generateBusinessContext,
  generateBusinessImpact,
} from "@/server/services/businessImpactGenerator";
import type { Severity, AssetCriticality, RiskTemplateCategory } from "@prisma/client";

// Mock PrismaClient for tests
const mockDb = {
  riskEvidence: {
    findMany: jest.fn(),
  },
  framework: {
    findMany: jest.fn(),
  },
  risk: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
} as unknown as import("@prisma/client").PrismaClient;

describe("Business Impact Generator Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =====================================
  // AC8-AC12: Regulatory Impact Tests
  // =====================================
  describe("Regulatory Impact Generation (AC8-AC12)", () => {
    // AC8: ISO 27001 framework mention
    it("should mention ISO 27001 certification when framework affected (AC8)", () => {
      const frameworks = [
        { code: "ISO-27001", name: "ISO 27001" },
      ];

      const result = generateRegulatoryImpact(frameworks);

      expect(result).toContain("ISO 27001 certification");
      expect(result).toContain("certification suspension");
      expect(result).toContain("audit findings");
    });

    // AC9: SOC 2 framework mention
    it("should mention SOC 2 compliance for enterprise customers (AC9)", () => {
      const frameworks = [
        { code: "SOC-2", name: "SOC 2" },
      ];

      const result = generateRegulatoryImpact(frameworks);

      expect(result).toContain("SOC 2 compliance");
      expect(result).toContain("enterprise customer");
    });

    // AC10: GDPR framework mention with fines
    it("should mention GDPR violations with €20M fines (AC10)", () => {
      const frameworks = [
        { code: "GDPR", name: "GDPR" },
      ];

      const result = generateRegulatoryImpact(frameworks);

      expect(result).toContain("GDPR");
      expect(result).toContain("€20M");
      expect(result).toContain("4% of annual");
    });

    // AC11: HIPAA framework mention with per-record fines
    it("should mention HIPAA violations with $50K per record (AC11)", () => {
      const frameworks = [
        { code: "HIPAA", name: "HIPAA" },
      ];

      const result = generateRegulatoryImpact(frameworks);

      expect(result).toContain("HIPAA");
      expect(result).toContain("$50,000 per record");
      expect(result).toContain("PHI");
    });

    // AC12: No frameworks affected
    it("should indicate no direct regulatory impact when no frameworks (AC12)", () => {
      const frameworks: { code: string; name: string }[] = [];

      const result = generateRegulatoryImpact(frameworks);

      expect(result).toContain("No direct regulatory compliance impact");
      expect(result).toContain("security risk");
    });

    // Multiple frameworks
    it("should combine multiple framework impacts", () => {
      const frameworks = [
        { code: "ISO-27001", name: "ISO 27001" },
        { code: "SOC-2", name: "SOC 2" },
      ];

      const result = generateRegulatoryImpact(frameworks);

      expect(result).toContain("ISO 27001");
      expect(result).toContain("SOC 2");
    });
  });

  // =====================================
  // AC13-AC17: Operational Impact Tests
  // =====================================
  describe("Operational Impact Generation (AC13-AC17)", () => {
    // AC13: HIGH severity + CRITICAL asset
    it("should mention complete service outage for HIGH + CRITICAL (AC13)", () => {
      const result = generateOperationalImpact("HIGH", "CRITICAL");

      expect(result).toContain("Critical risk");
      expect(result).toContain("complete service outage");
      expect(result).toContain("all users");
    });

    // AC14: HIGH severity + HIGH asset
    it("should mention service degradation for HIGH + HIGH (AC14)", () => {
      const result = generateOperationalImpact("HIGH", "HIGH");

      expect(result).toContain("Significant risk");
      expect(result).toContain("service degradation");
    });

    // AC15: MEDIUM severity + MEDIUM asset
    it("should mention moderate risk for MEDIUM + MEDIUM (AC15)", () => {
      const result = generateOperationalImpact("MEDIUM", "MEDIUM");

      expect(result).toContain("Moderate risk");
      expect(result).toContain("data exposure");
      expect(result).toContain("service disruption");
    });

    // AC16: LOW severity + LOW asset
    it("should mention limited impact for LOW + LOW (AC16)", () => {
      const result = generateOperationalImpact("LOW", "LOW");

      expect(result).toContain("Limited operational impact");
      expect(result).toContain("non-critical");
    });

    // AC17: Asset-specific context
    it("should add database-specific context for database systems (AC17)", () => {
      const result = generateOperationalImpact("HIGH", "HIGH", "Production database server");

      expect(result).toContain("data loss");
      expect(result).toContain("integrity");
    });

    it("should add API-specific context for API systems (AC17)", () => {
      const result = generateOperationalImpact("MEDIUM", "MEDIUM", "Customer API gateway");

      expect(result).toContain("API");
      expect(result).toContain("service unavailability");
    });

    it("should add network-specific context for network systems (AC17)", () => {
      const result = generateOperationalImpact("HIGH", "HIGH", "Core network infrastructure");

      expect(result).toContain("lateral movement");
      expect(result).toContain("Network");
    });
  });

  // =====================================
  // AC18-AC22: Business Context Tests
  // =====================================
  describe("Business Context Generation (AC18-AC22)", () => {
    // AC18: Cloud Infrastructure
    it("should reference Verizon DBIR for cloud risks (AC18)", () => {
      const result = generateBusinessContext("CLOUD_INFRASTRUCTURE");

      expect(result).toContain("Cloud misconfigurations");
      expect(result).toContain("leading cause of data breaches");
      expect(result).toContain("DBIR");
    });

    // AC19: Access Control
    it("should reference IBM 74% stat for access control risks (AC19)", () => {
      const result = generateBusinessContext("ACCESS_CONTROL");

      expect(result).toContain("74%");
      expect(result.toLowerCase()).toContain("privileged access");
      expect(result).toContain("IBM");
    });

    // AC20: Data Security
    it("should reference $4.45M breach cost for data security risks (AC20)", () => {
      const result = generateBusinessContext("DATA_SECURITY");

      expect(result).toContain("$4.45M");
      expect(result).toContain("data breach");
      expect(result).toContain("IBM Cost of Data Breach");
    });

    // AC21: Network Security
    it("should reference lateral movement for network risks (AC21)", () => {
      const result = generateBusinessContext("NETWORK_SECURITY");

      expect(result).toContain("lateral");
      expect(result).toContain("ransomware");
    });

    // AC22: Application Security
    it("should reference OWASP Top 10 for application risks (AC22)", () => {
      const result = generateBusinessContext("APPLICATION_SECURITY");

      expect(result).toContain("OWASP Top 10");
      expect(result).toContain("#1 attack vector");
    });

    // Default context
    it("should provide default context when no category specified", () => {
      const result = generateBusinessContext(null);

      expect(result).toContain("remediation");
      expect(result).toContain("security maturity");
    });
  });

  // =====================================
  // AC28-AC32: Service Function Tests
  // =====================================
  describe("Generate Business Impact Service (AC28-AC32)", () => {
    beforeEach(() => {
      // Mock no linked evidence (empty frameworks)
      (mockDb.riskEvidence.findMany as jest.Mock).mockResolvedValue([]);
      (mockDb.framework.findMany as jest.Mock).mockResolvedValue([]);
    });

    // AC28: Service accepts risk with related data
    it("should accept risk with severity, criticality, and category (AC28)", async () => {
      const options = {
        riskId: "risk-123",
        severity: "HIGH" as Severity,
        assetCriticality: "CRITICAL" as AssetCriticality,
        templateCategory: "CLOUD_INFRASTRUCTURE" as RiskTemplateCategory,
      };

      const result = await generateBusinessImpact(options, mockDb);

      expect(result).toBeDefined();
      expect(result.statement).toBeDefined();
      expect(result.sections).toBeDefined();
    });

    // AC29: Service queries affected frameworks
    it("should query linked evidence for frameworks (AC29)", async () => {
      const options = {
        riskId: "risk-123",
        severity: "MEDIUM" as Severity,
        assetCriticality: "MEDIUM" as AssetCriticality,
      };

      await generateBusinessImpact(options, mockDb);

      expect(mockDb.riskEvidence.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { riskId: "risk-123" },
        })
      );
    });

    // AC31: Returns formatted markdown
    it("should return formatted markdown with sections (AC31)", async () => {
      const options = {
        riskId: "risk-123",
        severity: "HIGH" as Severity,
        assetCriticality: "HIGH" as AssetCriticality,
        templateCategory: "ACCESS_CONTROL" as RiskTemplateCategory,
      };

      const result = await generateBusinessImpact(options, mockDb);

      expect(result.statement).toContain("## Regulatory Impact");
      expect(result.statement).toContain("## Operational Impact");
      expect(result.statement).toContain("## Business Context");
    });

    // AC32: Idempotent (same inputs → same output)
    it("should be idempotent - same inputs produce same output (AC32)", async () => {
      const options = {
        riskId: "risk-123",
        severity: "MEDIUM" as Severity,
        assetCriticality: "HIGH" as AssetCriticality,
        templateCategory: "DATA_SECURITY" as RiskTemplateCategory,
      };

      const result1 = await generateBusinessImpact(options, mockDb);
      const result2 = await generateBusinessImpact(options, mockDb);

      expect(result1.statement).toBe(result2.statement);
      expect(result1.wordCount).toBe(result2.wordCount);
    });

    // AC7: Word count in range
    it("should generate statement with appropriate word count (AC7)", async () => {
      const options = {
        riskId: "risk-123",
        severity: "HIGH" as Severity,
        assetCriticality: "CRITICAL" as AssetCriticality,
        templateCategory: "CLOUD_INFRASTRUCTURE" as RiskTemplateCategory,
      };

      const result = await generateBusinessImpact(options, mockDb);

      // Should be substantial enough to be useful (> 100 words)
      expect(result.wordCount).toBeGreaterThan(100);
    });
  });

  // =====================================
  // AC33-AC36: Manual Edit Tests
  // =====================================
  describe("Manual Edit Functionality (AC33-AC36)", () => {
    // These tests would require more mocking of the full Prisma client
    // to test the generateAndSaveBusinessImpact function

    it("should skip regeneration if impactStatementManuallyEdited is true (AC36)", async () => {
      // Mock risk with manual edit flag
      (mockDb.risk.findUnique as jest.Mock).mockResolvedValue({
        id: "risk-123",
        severity: "HIGH",
        assetCriticality: "HIGH",
        affectedSystems: null,
        impactStatementManuallyEdited: true,
        Template: null,
      });

      // Import the function that should skip regeneration
      const { generateAndSaveBusinessImpact } = await import(
        "@/server/services/businessImpactGenerator"
      );

      const result = await generateAndSaveBusinessImpact("risk-123", mockDb);

      // Should return null when manually edited
      expect(result).toBeNull();
      // Should not update the risk
      expect(mockDb.risk.update).not.toHaveBeenCalled();
    });
  });
});

// =====================================
// Word Count Helper Tests
// =====================================
describe("Word Count Helper", () => {
  it("should count words correctly", () => {
    const countWords = (text: string) =>
      text.split(/\s+/).filter((word) => word.length > 0).length;

    expect(countWords("Hello world")).toBe(2);
    expect(countWords("This is a test")).toBe(4);
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
    expect(countWords("One")).toBe(1);
  });
});
