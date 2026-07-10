/**
 * Story 17.1: Deliverable Shell — integration tests.
 *
 * Covers:
 * - AC26: stub rendering data is type-agnostic and complete.
 * - AC20/AC23 (automated portion): exportPdf returns a base64 PDF (%PDF header).
 * - AC24: cross-org isolation — each caller only ever sees their own org's data.
 * - AC25: export writes an EXPORT_DELIVERABLE audit log.
 *
 * The HTML render is asserted directly (no browser) as the structural guard for
 * the shell markup. True visual fidelity (gradient/serif/oklch) is the manual
 * E2E gate (AC23) and must be confirmed against the Docker Chromium binary.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// Mock Puppeteer the same way Story 5.7's pdf-export test does — the launch
// returns a minimal %PDF buffer so the pipeline can be exercised without Chromium.
jest.mock("puppeteer", () => {
  const launchMock = jest.fn(() =>
    Promise.resolve({
      newPage: jest.fn(() =>
        Promise.resolve({
          setContent: jest.fn(),
          pdf: jest.fn(() =>
            Promise.resolve(Buffer.from("%PDF-1.4 mock deliverable pdf content")),
          ),
        }),
      ),
      close: jest.fn(),
    }),
  );
  return { __esModule: true, default: { launch: launchMock }, launch: launchMock };
});

import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";
import { randomUUID } from "crypto";
import { UserRole } from "@prisma/client";
import { renderDeliverableHtml, type DeliverableDocData } from "@/server/services/deliverablePdf";

type TestUser = {
  id: string;
  email: string | null;
  organizationId: string;
  role: UserRole;
};

const createCaller = (user: TestUser) =>
  appRouter.createCaller({
    db,
    session: {
      user: {
        id: user.id,
        email: user.email,
        organizationId: user.organizationId,
        role: user.role,
        name: "Test Assessor",
        image: null,
        assignedFrameworks: [],
      },
      expires: new Date(Date.now() + 86400000).toISOString(),
    },
    organizationId: user.organizationId,
    headers: new Headers(),
  } as any);

describe("Deliverable Shell - Story 17.1", () => {
  let orgA: { id: string; name: string };
  let orgB: { id: string; name: string };
  let analystA: TestUser;
  let analystB: TestUser;

  beforeAll(async () => {
    const stamp = Date.now();
    orgA = await db.organization.create({
      data: { id: randomUUID(), name: `Deliverable Org A ${stamp}`, slug: `deliv-a-${stamp}`, updatedAt: new Date() },
    });
    orgB = await db.organization.create({
      data: { id: randomUUID(), name: `Deliverable Org B ${stamp}`, slug: `deliv-b-${stamp}`, updatedAt: new Date() },
    });
    analystA = {
      ...(await db.user.create({
        data: { id: randomUUID(), email: `a-${stamp}@example.com`, name: "Analyst A", organizationId: orgA.id, platformRole: UserRole.ANALYST, updatedAt: new Date() },
      })),
      role: UserRole.ANALYST,
    };
    analystB = {
      ...(await db.user.create({
        data: { id: randomUUID(), email: `b-${stamp}@example.com`, name: "Analyst B", organizationId: orgB.id, platformRole: UserRole.ANALYST, updatedAt: new Date() },
      })),
      role: UserRole.ANALYST,
    };
  });

  afterAll(async () => {
    // Raw SQL deletes to bypass the org-context middleware (project convention).
    for (const org of [orgA, orgB]) {
      if (!org) continue;
      await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "Organization" WHERE "id" = ${org.id}`;
    }
  });

  describe("renderDeliverableHtml (AC1-AC13 structural guard)", () => {
    const doc: DeliverableDocData = {
      type: "stub",
      id: "DEL-TEST",
      eyebrow: "Cybersecurity Assessment",
      title: "Security Posture Assessment",
      engagement: "Acme Industries",
      period: "Q2 2026",
      preparedBy: "Lead Assessor",
      scorecard: [
        { label: "Security posture", value: 62, suffix: "/ 100", tone: "ok" },
        { label: "Risk exposure", value: 41, suffix: "/ 100", tone: "high" },
        { label: "Critical findings", value: 3, tone: "crit" },
      ],
      findings: [
        { identifier: "F-01", title: "Exposed mgmt interface", likelihood: 5, impact: 5, domain: "External" },
      ],
    };

    it("renders the gradient cover band with title + confidential label", () => {
      const html = renderDeliverableHtml(doc);
      expect(html).toContain("linear-gradient(135deg, var(--primary), var(--primary-light))");
      expect(html).toContain("CONFIDENTIAL");
      expect(html).toContain("Security Posture Assessment");
    });

    it("renders all three scorecard cells and the findings rows", () => {
      const html = renderDeliverableHtml(doc);
      expect(html).toContain("Security posture");
      expect(html).toContain("Risk exposure");
      expect(html).toContain("Critical findings");
      expect(html).toContain("F-01");
      expect(html).toContain("5×5");
      // L×I = 25 -> critical tier color (destructive token value)
      expect(html).toContain("oklch(0.495 0.155 25)");
    });

    it("escapes HTML in untrusted fields", () => {
      const html = renderDeliverableHtml({ ...doc, title: "<script>x</script>" });
      expect(html).not.toContain("<script>x</script>");
      expect(html).toContain("&lt;script&gt;");
    });

    it("renders a prose-only section (no table) and escapes its body", () => {
      const html = renderDeliverableHtml({
        ...doc,
        findings: [],
        sections: [
          {
            n: "01",
            title: "Executive Statement",
            columns: [],
            rows: [],
            body: "Line one.\n\nLine two with <b>markup</b>.",
          },
        ],
      });
      expect(html).toContain("Executive Statement");
      expect(html).toContain('<div class="prose">');
      // Paragraph split + HTML escaped.
      expect(html).toContain("<p>Line one.</p>");
      expect(html).toContain("&lt;b&gt;markup&lt;/b&gt;");
      // Prose-only section must NOT emit a table.
      const sectionHtml = html.slice(html.indexOf("Executive Statement"));
      expect(sectionHtml).not.toContain("<table>");
    });

    it("renders a matrix heatmap section as inline SVG with band-colored cells and dots", () => {
      const html = renderDeliverableHtml({
        ...doc,
        findings: [],
        sections: [
          {
            n: "01",
            title: "Risk Heatmap",
            columns: [],
            rows: [],
            heatmap: {
              cols: [
                { value: 1, label: "Rare" },
                { value: 2, label: "Possible" },
                { value: 3, label: "Likely" },
              ],
              rows: [
                { value: 3, label: "Severe" },
                { value: 2, label: "Moderate" },
                { value: 1, label: "Minor" },
              ],
              cells: [
                [
                  { color: "#EAB308", score: 3 },
                  { color: "#F97316", score: 6 },
                  { color: "#EF4444", score: 9 },
                ],
                [
                  { color: "#22C55E", score: 2 },
                  { color: "#EAB308", score: 4 },
                  { color: "#F97316", score: 6 },
                ],
                [
                  { color: "#22C55E", score: 1 },
                  { color: "#22C55E", score: 2 },
                  { color: "#EAB308", score: 3 },
                ],
              ],
              dots: [{ colIndex: 2, rowIndex: 0, color: "#EF4444", label: "1" }],
              legend: [
                { label: "Low", color: "#22C55E", count: 0 },
                { label: "Critical", color: "#EF4444", count: 1 },
              ],
            },
          },
        ],
      });
      expect(html).toContain("<svg");
      expect(html).toContain('aria-label="Likelihood by impact risk heatmap"');
      // Cells filled with the matrix band hex colors.
      expect(html).toContain('fill="#EF4444"');
      // A finding dot is a band-stroked circle carrying its display number.
      expect(html).toContain("<circle");
      expect(html).toContain('stroke="#EF4444"');
      expect(html).toContain('class="hm-legend"');
      expect(html).toContain("Critical");
      // Heatmap-only section emits no table.
      const sectionHtml = html.slice(html.indexOf("Risk Heatmap"));
      expect(sectionHtml).not.toContain("<table>");
    });

    it("renders a section with both a narrative body and a steps table", () => {
      const html = renderDeliverableHtml({
        ...doc,
        findings: [],
        sections: [
          {
            n: "01",
            title: "Exploitation Pathway",
            columns: ["#", "Tactic", "Technique", "MITRE"],
            rows: [[{ text: "1", mono: true }, "Initial Access", "Phishing", { text: "T1566", mono: true }]],
            body: "Verdict: exploitable in three steps.",
          },
        ],
      });
      expect(html).toContain('<div class="prose">');
      expect(html).toContain("exploitable in three steps");
      expect(html).toContain("<table>");
      expect(html).toContain("T1566");
    });
  });

  describe("getStub (AC26, AC24)", () => {
    it("returns complete, type-agnostic stub data scoped to the caller's org", async () => {
      const caller = createCaller(analystA);
      const doc = await caller.deliverable.getStub({ id: "DEL-1" });
      expect(doc.scorecard).toHaveLength(3);
      expect(doc.findings.length).toBeGreaterThan(0);
      // Org-scoped: org A's name appears, not org B's (AC24).
      expect(doc.engagement).toBe(orgA.name);
    });

    it("isolates orgs — org B caller sees org B data only (AC24)", async () => {
      const docB = await createCaller(analystB).deliverable.getStub({ id: "DEL-1" });
      expect(docB.engagement).toBe(orgB.name);
      expect(docB.engagement).not.toBe(orgA.name);
    });
  });

  describe("exportPdf (AC20, AC23 automated, AC25)", () => {
    it("returns a base64 PDF starting with %PDF and logs the export", async () => {
      const caller = createCaller(analystA);
      const res = await caller.deliverable.exportPdf({ id: "DEL-1" });

      expect(res.mimeType).toBe("application/pdf");
      expect(res.filename).toMatch(/^deliverable-stub-DEL-1-\d{4}-\d{2}-\d{2}\.pdf$/);
      const decoded = Buffer.from(res.data, "base64").toString("utf-8");
      expect(decoded.startsWith("%PDF")).toBe(true);

      // AC25: audit log written (fire-and-forget — allow a brief tick).
      await new Promise((r) => setTimeout(r, 300));
      const log = await db.auditLog.findFirst({
        where: { organizationId: orgA.id, action: "EXPORT_DELIVERABLE" as any, entityId: "DEL-1" },
      });
      expect(log).not.toBeNull();
    });
  });
});
