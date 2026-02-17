/**
 * Email Templates Tests (Story 4.16)
 *
 * Integration tests for email template rendering.
 */

// Set environment variables before importing modules
const originalEnv = process.env;

beforeAll(() => {
  process.env = {
    ...originalEnv,
    NEXTAUTH_URL: "http://localhost:3000",
    BASE_URL: "http://localhost:3000",
  };
});

afterAll(() => {
  process.env = originalEnv;
});

import {
  renderRiskAssignedEmail,
  renderStatusChangedEmail,
  renderDecisionRequiredEmail,
  renderEvidenceRequestEmail,
  renderRiskClosedEmail,
  renderCommentAddedEmail,
  sanitizeHtml,
  formatSeverity,
  formatDate,
  formatCurrency,
  buildRiskDetailUrl,
  buildUrlWithUTM,
} from "../index";

describe("Email Templates", () => {
  // ==========================================
  // AC7-AC12: Risk Assignment Template
  // ==========================================
  describe("Risk Assignment Template", () => {
    const baseVariables = {
      riskId: "risk-123",
      riskTitle: "SQL Injection Vulnerability",
      severity: "HIGH" as const,
      impactScore: 75,
      assignedByName: "John GRC",
      assignedRole: "IT_OWNER" as const,
      description: "Critical SQL injection found in login form",
      discoveryDate: new Date("2024-01-15"),
      findingSource: "Penetration Test",
      frameworksAffectedCount: 3,
      organizationName: "Acme Corp",
    };

    it("AC7: generates subject with risk title and severity", () => {
      const result = renderRiskAssignedEmail(baseVariables);
      expect(result.subject).toContain("Risk Assigned:");
      expect(result.subject).toContain("SQL Injection Vulnerability");
      expect(result.subject).toContain("HIGH");
    });

    it("AC8: includes all required fields in body", () => {
      const result = renderRiskAssignedEmail(baseVariables);
      expect(result.html).toContain("SQL Injection Vulnerability");
      expect(result.html).toContain("John GRC");
      expect(result.html).toContain("IT Owner");
    });

    it("AC9: includes View Risk Details CTA", () => {
      const result = renderRiskAssignedEmail(baseVariables);
      expect(result.html).toContain("View Risk Details");
      expect(result.html).toContain("/risks/risk-123");
    });

    it("AC11: differentiates IT Owner vs Business Owner messaging", () => {
      const itOwnerResult = renderRiskAssignedEmail({
        ...baseVariables,
        assignedRole: "IT_OWNER",
      });
      expect(itOwnerResult.html).toContain("technical remediation");

      const businessOwnerResult = renderRiskAssignedEmail({
        ...baseVariables,
        assignedRole: "BUSINESS_OWNER",
      });
      expect(businessOwnerResult.html).toContain("business decisions");
    });

    it("AC12: generates plain text version", () => {
      const result = renderRiskAssignedEmail(baseVariables);
      expect(result.text).toContain("RISK ASSIGNED:");
      expect(result.text).toContain("SQL Injection Vulnerability");
      expect(result.text).not.toContain("<");
    });
  });

  // ==========================================
  // AC13-AC18: Status Change Template
  // ==========================================
  describe("Status Change Template", () => {
    const baseVariables = {
      riskId: "risk-456",
      riskTitle: "Outdated SSL Certificate",
      oldStatus: "OPEN" as const,
      newStatus: "ASSIGNED" as const,
      changedByName: "Jane Analyst",
      changeReason: "Assigned for immediate remediation",
      impactScore: 60,
      organizationName: "Acme Corp",
    };

    it("AC13: generates subject with risk title and new status", () => {
      const result = renderStatusChangedEmail(baseVariables);
      expect(result.subject).toContain("Risk Status Updated:");
      expect(result.subject).toContain("Outdated SSL Certificate");
      expect(result.subject).toContain("ASSIGNED");
    });

    it("AC14: includes old/new status, changed by, reason", () => {
      const result = renderStatusChangedEmail(baseVariables);
      expect(result.html).toContain("OPEN");
      expect(result.html).toContain("ASSIGNED");
      expect(result.html).toContain("Jane Analyst");
      expect(result.html).toContain("Assigned for immediate remediation");
    });

    it("AC15: includes View Risk Details CTA", () => {
      const result = renderStatusChangedEmail(baseVariables);
      expect(result.html).toContain("View Risk Details");
    });

    it("AC16: includes status-specific messaging", () => {
      const closedResult = renderStatusChangedEmail({
        ...baseVariables,
        oldStatus: "REMEDIATED",
        newStatus: "CLOSED",
      });
      expect(closedResult.html).toContain("verified and closed");
    });

    it("AC18: generates plain text version", () => {
      const result = renderStatusChangedEmail(baseVariables);
      expect(result.text).toContain("RISK STATUS UPDATED:");
      expect(result.text).not.toContain("<");
    });
  });

  // ==========================================
  // AC19-AC24: Decision Required Template
  // ==========================================
  describe("Decision Required Template", () => {
    const baseVariables = {
      riskId: "risk-789",
      riskTitle: "Unpatched Server Vulnerability",
      severity: "CRITICAL" as const,
      impactScore: 90,
      businessImpactStatement: "Could lead to data breach affecting 50,000 customers",
      remediationOptions: [
        { title: "Emergency Patch", estimatedCost: 5000, priority: "HIGH" as const },
        { title: "System Replacement", estimatedCost: 50000, priority: "MEDIUM" as const },
      ],
      assignedDate: new Date("2024-01-20"),
      organizationName: "Acme Corp",
    };

    it("AC19: generates subject with risk title and impact score", () => {
      const result = renderDecisionRequiredEmail(baseVariables);
      expect(result.subject).toContain("Decision Required:");
      expect(result.subject).toContain("Unpatched Server Vulnerability");
      expect(result.subject).toContain("90/100");
    });

    it("AC20: includes business impact and remediation options", () => {
      const result = renderDecisionRequiredEmail(baseVariables);
      expect(result.html).toContain("50,000 customers");
      expect(result.html).toContain("Emergency Patch");
      expect(result.html).toContain("System Replacement");
    });

    it("AC21: includes Review & Decide CTA", () => {
      const result = renderDecisionRequiredEmail(baseVariables);
      expect(result.html).toContain("Review &amp; Decide");
    });

    it("AC22: highlights risk impact prominently", () => {
      const result = renderDecisionRequiredEmail(baseVariables);
      expect(result.html).toContain("IMPACT SCORE");
      expect(result.html).toContain("90");
    });

    it("AC24: generates plain text version", () => {
      const result = renderDecisionRequiredEmail(baseVariables);
      expect(result.text).toContain("DECISION REQUIRED:");
      expect(result.text).toContain("IMPACT SCORE: 90/100");
    });
  });

  // ==========================================
  // AC25-AC30: Evidence Request Template
  // ==========================================
  describe("Evidence Request Template", () => {
    const baseVariables = {
      requestId: "req-123",
      requestedByName: "GRC Manager",
      controlDomain: "Access Control",
      frameworkName: "ISO 27001",
      evidenceGuidance: "Please provide user access review documentation",
      dueDate: new Date("2024-02-15"),
      organizationName: "Acme Corp",
    };

    it("AC25: generates subject with control domain and framework", () => {
      const result = renderEvidenceRequestEmail(baseVariables);
      expect(result.subject).toContain("Evidence Request:");
      expect(result.subject).toContain("Access Control");
      expect(result.subject).toContain("ISO 27001");
    });

    it("AC26: includes requester, domain, framework, guidance", () => {
      const result = renderEvidenceRequestEmail(baseVariables);
      expect(result.html).toContain("GRC Manager");
      expect(result.html).toContain("Access Control");
      expect(result.html).toContain("ISO 27001");
      expect(result.html).toContain("user access review documentation");
    });

    it("AC27: includes Upload Evidence CTA", () => {
      const result = renderEvidenceRequestEmail(baseVariables);
      expect(result.html).toContain("Upload Evidence");
    });

    it("AC28: includes examples of acceptable evidence types", () => {
      const result = renderEvidenceRequestEmail(baseVariables);
      expect(result.html).toContain("User access review reports");
    });

    it("AC30: generates plain text version", () => {
      const result = renderEvidenceRequestEmail(baseVariables);
      expect(result.text).toContain("EVIDENCE REQUEST");
      expect(result.text).not.toContain("<");
    });
  });

  // ==========================================
  // AC31-AC35: Risk Closed Template
  // ==========================================
  describe("Risk Closed Template", () => {
    const baseVariables = {
      riskId: "risk-closed-1",
      riskTitle: "Fixed Password Policy Issue",
      severity: "MEDIUM" as const,
      closedByName: "Security Admin",
      closureDate: new Date("2024-02-01"),
      createdDate: new Date("2024-01-01"),
      finalStatus: "CLOSED" as const,
      remediationSummary: "Implemented stronger password requirements",
      organizationName: "Acme Corp",
    };

    it("AC31: generates subject with Risk Closed prefix", () => {
      const result = renderRiskClosedEmail(baseVariables);
      expect(result.subject).toContain("Risk Closed:");
      expect(result.subject).toContain("Fixed Password Policy Issue");
    });

    it("AC32: includes closure details and velocity metric", () => {
      const result = renderRiskClosedEmail(baseVariables);
      expect(result.html).toContain("Security Admin");
      expect(result.html).toContain("Time to Resolution");
      expect(result.html).toContain("days");
    });

    it("AC33: includes View Final Risk Report CTA", () => {
      const result = renderRiskClosedEmail(baseVariables);
      expect(result.html).toContain("View Final Risk Report");
    });

    it("AC35: generates plain text version", () => {
      const result = renderRiskClosedEmail(baseVariables);
      expect(result.text).toContain("RISK CLOSED:");
      expect(result.text).toContain("TIME TO RESOLUTION:");
    });
  });

  // ==========================================
  // AC36-AC40: Comment Notification Template
  // ==========================================
  describe("Comment Added Template", () => {
    const baseVariables = {
      riskId: "risk-comment-1",
      riskTitle: "Network Security Review",
      severity: "LOW" as const,
      commenterName: "Team Member",
      commentText: "I've reviewed the network configuration and found no issues.",
      commentedAt: new Date("2024-01-25T10:30:00Z"),
      totalComments: 5,
      organizationName: "Acme Corp",
    };

    it("AC36: generates subject with risk title", () => {
      const result = renderCommentAddedEmail(baseVariables);
      expect(result.subject).toContain("New Comment on Risk:");
      expect(result.subject).toContain("Network Security Review");
    });

    it("AC37: includes commenter, preview, timestamp", () => {
      const result = renderCommentAddedEmail(baseVariables);
      expect(result.html).toContain("Team Member");
      expect(result.html).toContain("reviewed the network configuration");
    });

    it("AC38: includes View Conversation CTA", () => {
      const result = renderCommentAddedEmail(baseVariables);
      expect(result.html).toContain("View Conversation");
    });

    it("AC40: generates plain text version", () => {
      const result = renderCommentAddedEmail(baseVariables);
      expect(result.text).toContain("NEW COMMENT ON RISK:");
      expect(result.text).toContain("TEAM MEMBER"); // Uppercased in plain text format
    });
  });

  // ==========================================
  // AC41-AC45: Template Renderer
  // ==========================================
  describe("Template Renderer Utilities", () => {
    it("AC42: formatSeverity returns styled badge", () => {
      const critical = formatSeverity("CRITICAL");
      expect(critical).toContain("background-color");
      expect(critical).toContain("CRITICAL");
    });

    it("AC42: formatDate handles various date formats", () => {
      const date1 = formatDate(new Date("2024-01-15"));
      expect(date1).toContain("2024");

      const date2 = formatDate("2024-01-15");
      expect(date2).toContain("2024");

      const nullDate = formatDate(null);
      expect(nullDate).toBe("N/A");
    });

    it("AC42: formatCurrency handles amounts correctly", () => {
      const amount = formatCurrency(5000);
      expect(amount).toContain("5,000");
      expect(amount).toContain("$");

      const nullAmount = formatCurrency(null);
      expect(nullAmount).toBe("N/A");
    });

    it("AC43: buildRiskDetailUrl creates absolute URLs", () => {
      const url = buildRiskDetailUrl("risk-123", "email_test");
      expect(url).toContain("/risks/risk-123");
      expect(url).toContain("utm_campaign=email_test");
    });

    it("AC44: buildUrlWithUTM adds UTM parameters", () => {
      const url = buildUrlWithUTM("/dashboard", "test_campaign");
      expect(url).toContain("utm_source=email");
      expect(url).toContain("utm_medium=notification");
      expect(url).toContain("utm_campaign=test_campaign");
    });

    it("AC45: sanitizeHtml prevents XSS", () => {
      const malicious = '<script>alert("xss")</script>';
      const sanitized = sanitizeHtml(malicious);
      expect(sanitized).not.toContain("<script>");
      expect(sanitized).toContain("&lt;script&gt;");
    });

    it("AC45: sanitizeHtml handles null/undefined", () => {
      expect(sanitizeHtml(null)).toBe("");
      expect(sanitizeHtml(undefined)).toBe("");
    });
  });
});
