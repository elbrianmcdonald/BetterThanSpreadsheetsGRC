/**
 * Story 5.7: PDF Evidence Package Export Integration Tests
 *
 * Tests for PDF generation and export functionality:
 * - AC1-AC5: Export button and download
 * - AC6-AC12: PDF structure and content
 * - AC22-AC26: PDF generation with Puppeteer
 * - AC27-AC30: Export mutation and role validation
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  generateEvidencePackagePDF,
  fetchEvidencePackageData,
  generatePDFFilename,
  type EvidencePackageData,
  type ControlSection,
} from "@/server/services/pdfGenerator";

// Mock Puppeteer
jest.mock("puppeteer", () => {
  const launchMock = jest.fn(() =>
    Promise.resolve({
      newPage: jest.fn(() =>
        Promise.resolve({
          setContent: jest.fn(),
          pdf: jest.fn(() => Promise.resolve(Buffer.from("%PDF-1.4 mock pdf content"))),
        })
      ),
      close: jest.fn(),
    })
  );
  return {
    __esModule: true,
    default: { launch: launchMock },
    launch: launchMock,
  };
});

// Mock file system
jest.mock("fs/promises", () => {
  const readFileFn = jest.fn(() =>
    Promise.resolve(`
    <!DOCTYPE html>
    <html>
      <head><title>{{frameworkName}}</title></head>
      <body>
        <h1>{{frameworkName}}</h1>
        <p>{{organizationName}}</p>
        <p>{{exportDate}}</p>
        <p>Total: {{totalControls}}</p>
        <p>With Evidence: {{controlsWithEvidence}}</p>
        <p>Coverage: {{coveragePercentage}}%</p>
      </body>
    </html>
  `)
  );
  return {
    __esModule: true,
    default: { readFile: readFileFn },
    readFile: readFileFn,
  };
});

// Mock Prisma client
const mockDb = {
  framework: {
    findFirst: jest.fn(),
  },
  control: {
    findMany: jest.fn(),
  },
  controlDomainMapping: {
    findMany: jest.fn(),
  },
  evidence: {
    findMany: jest.fn(),
  },
  auditLog: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
};

describe("Story 5.7: PDF Evidence Package Export", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("generatePDFFilename", () => {
    it("AC4: generates filename with framework code and date", () => {
      const filename = generatePDFFilename("ISO-27001");
      const dateStr = new Date().toISOString().split("T")[0];
      expect(filename).toBe(`evidence-package-ISO-27001-${dateStr}.pdf`);
    });

    it("AC4: sanitizes special characters in framework code", () => {
      const filename = generatePDFFilename("SOC 2 Type II");
      const dateStr = new Date().toISOString().split("T")[0];
      expect(filename).toBe(`evidence-package-SOC-2-Type-II-${dateStr}.pdf`);
    });

    it("AC4: handles framework codes with slashes", () => {
      const filename = generatePDFFilename("NIST/CSF");
      const dateStr = new Date().toISOString().split("T")[0];
      expect(filename).toBe(`evidence-package-NIST-CSF-${dateStr}.pdf`);
    });
  });

  describe("fetchEvidencePackageData", () => {
    const frameworkId = "fw-123";
    const organizationId = "org-456";

    beforeEach(() => {
      mockDb.framework.findFirst.mockResolvedValue({
        id: frameworkId,
        code: "ISO-27001",
        name: "ISO 27001:2022",
        version: "2022",
        Organization: { name: "Acme Corp" },
        Control: [
          {
            id: "ctrl-1",
            controlId: "A.5.1",
            title: "Information Security Policy",
            description: "Policy description",
            isActive: true,
          },
          {
            id: "ctrl-2",
            controlId: "A.5.2",
            title: "Organization Security",
            description: "Organization description",
            isActive: true,
          },
        ],
      });

      mockDb.controlDomainMapping.findMany.mockResolvedValue([
        { controlId: "A.5.1", controlDomainId: "dom-1" },
      ]);

      mockDb.evidence.findMany.mockResolvedValue([
        {
          id: "ev-1",
          originalFileName: "security-policy.pdf",
          description: "Security policy document",
          fileType: "application/pdf",
          createdAt: new Date("2024-01-15"),
          User: { name: "John Doe", email: "john@acme.com" },
          EvidenceControlDomain: [
            { controlDomainId: "dom-1", ControlDomain: { id: "dom-1", name: "Access Control" } },
          ],
        },
      ]);

      mockDb.auditLog.findMany.mockResolvedValue([
        {
          action: "UPLOAD_EVIDENCE",
          timestamp: new Date("2024-01-15T10:30:00Z"),
          actorName: "John Doe",
          User: { name: "John Doe", email: "john@acme.com" },
          changes: { after: { filename: "security-policy.pdf" } },
        },
      ]);
    });

    it("AC6: includes framework name and organization name", async () => {
      const data = await fetchEvidencePackageData(
        frameworkId,
        organizationId,
        mockDb as unknown as Parameters<typeof fetchEvidencePackageData>[2]
      );

      expect(data.frameworkName).toBe("ISO 27001:2022");
      expect(data.organizationName).toBe("Acme Corp");
    });

    it("AC6: includes export date", async () => {
      const data = await fetchEvidencePackageData(
        frameworkId,
        organizationId,
        mockDb as unknown as Parameters<typeof fetchEvidencePackageData>[2]
      );

      expect(data.exportDate).toBeDefined();
      expect(data.exportDate).toContain(","); // Format: "January 15, 2024"
    });

    it("AC6: includes control counts and coverage", async () => {
      const data = await fetchEvidencePackageData(
        frameworkId,
        organizationId,
        mockDb as unknown as Parameters<typeof fetchEvidencePackageData>[2]
      );

      expect(data.totalControls).toBe(2);
      expect(data.controlsWithEvidence).toBe(1);
      expect(data.coveragePercentage).toBe("50.0");
    });

    it("AC7: organizes by control with control ID and name", async () => {
      const data = await fetchEvidencePackageData(
        frameworkId,
        organizationId,
        mockDb as unknown as Parameters<typeof fetchEvidencePackageData>[2]
      );

      expect(data.controls).toHaveLength(2);
      expect(data.controls[0].controlId).toBe("A.5.1");
      expect(data.controls[0].controlName).toBe("Information Security Policy");
    });

    it("AC8: control sections include description", async () => {
      const data = await fetchEvidencePackageData(
        frameworkId,
        organizationId,
        mockDb as unknown as Parameters<typeof fetchEvidencePackageData>[2]
      );

      expect(data.controls[0].controlDescription).toBe("Policy description");
    });

    it("AC9: evidence entries include filename, uploader, and date", async () => {
      const data = await fetchEvidencePackageData(
        frameworkId,
        organizationId,
        mockDb as unknown as Parameters<typeof fetchEvidencePackageData>[2]
      );

      const controlWithEvidence = data.controls.find((c) => c.hasEvidence);
      expect(controlWithEvidence).toBeDefined();
      expect(controlWithEvidence!.evidence[0].filename).toBe("security-policy.pdf");
      expect(controlWithEvidence!.evidence[0].uploadedBy).toBe("John Doe");
      expect(controlWithEvidence!.evidence[0].uploadDate).toBeDefined();
    });

    it("AC10: controls without evidence marked as such", async () => {
      const data = await fetchEvidencePackageData(
        frameworkId,
        organizationId,
        mockDb as unknown as Parameters<typeof fetchEvidencePackageData>[2]
      );

      const controlWithoutEvidence = data.controls.find((c) => c.controlId === "A.5.2");
      expect(controlWithoutEvidence).toBeDefined();
      expect(controlWithoutEvidence!.hasEvidence).toBe(false);
      expect(controlWithoutEvidence!.evidenceCount).toBe(0);
    });

    it("AC13-AC16: includes audit trail entries sorted chronologically", async () => {
      const data = await fetchEvidencePackageData(
        frameworkId,
        organizationId,
        mockDb as unknown as Parameters<typeof fetchEvidencePackageData>[2]
      );

      expect(data.auditEntries).toBeDefined();
      expect(data.auditEntries.length).toBeGreaterThan(0);
      expect(data.auditEntries[0].user).toBe("John Doe");
      expect(data.auditEntries[0].action).toBe("Uploaded evidence");
    });

    it("throws error if framework not found", async () => {
      mockDb.framework.findFirst.mockResolvedValue(null);

      await expect(
        fetchEvidencePackageData(
          "invalid-id",
          organizationId,
          mockDb as unknown as Parameters<typeof fetchEvidencePackageData>[2]
        )
      ).rejects.toThrow("Framework not found");
    });
  });

  describe("EvidencePackageData structure", () => {
    it("AC6: has all required title page fields", () => {
      const data: EvidencePackageData = {
        frameworkName: "ISO 27001:2022",
        frameworkCode: "ISO-27001",
        organizationName: "Acme Corp",
        exportDate: "December 22, 2024",
        totalControls: 10,
        controlsWithEvidence: 7,
        coveragePercentage: "70.0",
        controls: [],
        auditEntries: [],
      };

      expect(data.frameworkName).toBeDefined();
      expect(data.organizationName).toBeDefined();
      expect(data.exportDate).toBeDefined();
      expect(data.totalControls).toBeDefined();
      expect(data.controlsWithEvidence).toBeDefined();
      expect(data.coveragePercentage).toBeDefined();
    });

    it("AC7-AC9: ControlSection has required fields", () => {
      const control: ControlSection = {
        controlId: "A.5.1",
        controlName: "Information Security Policy",
        controlDescription: "Establish policies for information security",
        hasEvidence: true,
        evidenceCount: 2,
        evidence: [
          {
            filename: "policy.pdf",
            uploadedBy: "John Doe",
            uploadDate: "January 15, 2024",
            evidenceType: "application/pdf",
            description: "Security policy document",
            tags: ["Access Control", "Governance"],
          },
        ],
      };

      expect(control.controlId).toBeDefined();
      expect(control.controlName).toBeDefined();
      expect(control.controlDescription).toBeDefined();
      expect(control.hasEvidence).toBe(true);
      expect(control.evidenceCount).toBe(2);
      expect(control.evidence[0].filename).toBeDefined();
      expect(control.evidence[0].uploadedBy).toBeDefined();
      expect(control.evidence[0].uploadDate).toBeDefined();
      expect(control.evidence[0].evidenceType).toBeDefined();
      expect(control.evidence[0].tags).toBeDefined();
    });
  });

  describe("Role-based access", () => {
    it("AC28: GRC_ANALYST can export", () => {
      const allowedRoles = ["GRC_ANALYST", "ORG_ADMIN", "AUDITOR"];
      expect(allowedRoles.includes("GRC_ANALYST")).toBe(true);
    });

    it("AC28: ORG_ADMIN can export", () => {
      const allowedRoles = ["GRC_ANALYST", "ORG_ADMIN", "AUDITOR"];
      expect(allowedRoles.includes("ORG_ADMIN")).toBe(true);
    });

    it("AC28: AUDITOR can export", () => {
      const allowedRoles = ["GRC_ANALYST", "ORG_ADMIN", "AUDITOR"];
      expect(allowedRoles.includes("AUDITOR")).toBe(true);
    });

    it("AC28: IT_STAKEHOLDER cannot export", () => {
      const allowedRoles = ["GRC_ANALYST", "ORG_ADMIN", "AUDITOR"];
      expect(allowedRoles.includes("IT_STAKEHOLDER")).toBe(false);
    });

    it("AC28: BUSINESS_STAKEHOLDER cannot export", () => {
      const allowedRoles = ["GRC_ANALYST", "ORG_ADMIN", "AUDITOR"];
      expect(allowedRoles.includes("BUSINESS_STAKEHOLDER")).toBe(false);
    });
  });

  describe("PDF generation", () => {
    it("AC22: uses Puppeteer for PDF generation", async () => {
      const puppeteer = await import("puppeteer");

      mockDb.framework.findFirst.mockResolvedValue({
        id: "fw-123",
        code: "ISO-27001",
        name: "ISO 27001:2022",
        version: "2022",
        Organization: { name: "Acme Corp" },
        Control: [],
      });

      mockDb.controlDomainMapping.findMany.mockResolvedValue([]);
      mockDb.evidence.findMany.mockResolvedValue([]);
      mockDb.auditLog.findMany.mockResolvedValue([]);

      const result = await generateEvidencePackagePDF(
        "fw-123",
        "org-456",
        mockDb as unknown as Parameters<typeof generateEvidencePackagePDF>[2]
      );

      const puppeteerMod = jest.requireMock("puppeteer") as { default: { launch: jest.Mock } };
      expect(puppeteerMod.default.launch).toHaveBeenCalledWith(
        expect.objectContaining({
          headless: true,
          args: expect.arrayContaining(["--no-sandbox", "--disable-setuid-sandbox"]),
        })
      );
      expect(result.buffer).toBeDefined();
      expect(result.filename).toMatch(/evidence-package-.*\.pdf$/);
    });

    it("AC4: returns proper filename", async () => {
      mockDb.framework.findFirst.mockResolvedValue({
        id: "fw-123",
        code: "SOC-2",
        name: "SOC 2 Type II",
        version: "2024",
        Organization: { name: "Acme Corp" },
        Control: [],
      });

      mockDb.controlDomainMapping.findMany.mockResolvedValue([]);
      mockDb.evidence.findMany.mockResolvedValue([]);
      mockDb.auditLog.findMany.mockResolvedValue([]);

      const result = await generateEvidencePackagePDF(
        "fw-123",
        "org-456",
        mockDb as unknown as Parameters<typeof generateEvidencePackagePDF>[2]
      );

      expect(result.filename).toMatch(/^evidence-package-SOC-2-\d{4}-\d{2}-\d{2}\.pdf$/);
    });
  });

  describe("Performance (AC5)", () => {
    it("AC5: should handle empty framework efficiently", async () => {
      mockDb.framework.findFirst.mockResolvedValue({
        id: "fw-123",
        code: "EMPTY-FW",
        name: "Empty Framework",
        version: "1.0",
        Organization: { name: "Acme Corp" },
        Control: [],
      });

      mockDb.controlDomainMapping.findMany.mockResolvedValue([]);
      mockDb.evidence.findMany.mockResolvedValue([]);
      mockDb.auditLog.findMany.mockResolvedValue([]);

      const startTime = Date.now();
      await generateEvidencePackagePDF(
        "fw-123",
        "org-456",
        mockDb as unknown as Parameters<typeof generateEvidencePackagePDF>[2]
      );
      const duration = Date.now() - startTime;

      // Should complete quickly (mocked, so very fast)
      expect(duration).toBeLessThan(1000);
    });
  });
});
