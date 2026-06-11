/**
 * Epic 17 execute — REAL Chromium PDF render across all body shapes.
 *
 * Exercises the generalized deliverablePdf renderer (findings table for
 * risk/stub; generic section tables for compliance/maturity/roadmap) against the
 * actual Chromium binary. Writes one PDF per type and asserts a non-trivial
 * size. Auto-skips unless PUPPETEER_EXECUTABLE_PATH is set, so the normal
 * (Puppeteer-mocked) suite is unaffected.
 */

import fs from "fs";
import path from "path";
import {
  generateDeliverablePdf,
  type DeliverableDocData,
} from "@/server/services/deliverablePdf";

const hasChromium = !!process.env.PUPPETEER_EXECUTABLE_PATH;
const describeReal = hasChromium ? describe : describe.skip;

const base = {
  engagement: "Acme Industries",
  period: "Q2 2026",
  preparedBy: "M. Okafor, Lead Assessor",
};

const docs: Record<string, DeliverableDocData> = {
  risk: {
    ...base,
    type: "risk",
    id: "RISK",
    eyebrow: "Cybersecurity Assessment",
    title: "Risk & Findings Assessment",
    scorecard: [
      { label: "Security posture", value: 62, suffix: "/ 100", tone: "ok" },
      { label: "Risk exposure", value: 41, suffix: "/ 100", tone: "high" },
      { label: "Critical findings", value: 3, tone: "crit" },
    ],
    findings: [
      { identifier: "F-01", title: "Exposed mgmt interface", likelihood: 5, impact: 5, domain: "External" },
      { identifier: "F-02", title: "Flat IT/OT network", likelihood: 4, impact: 5, domain: "Network" },
    ],
  },
  compliance: {
    ...base,
    type: "compliance",
    id: "COMP",
    eyebrow: "Compliance · NIST CSF 2.0",
    title: "SOC 2 Readiness Assessment",
    scorecard: [
      { label: "Compliance score", value: 74, suffix: "/ 100", tone: "med" },
      { label: "Compliant", value: 28, tone: "ok" },
      { label: "Non-compliant", value: 6, tone: "crit" },
    ],
    findings: [],
    sections: [
      {
        n: "01",
        title: "Control Status",
        columns: ["Control", "Title", "Status"],
        rows: [
          [{ text: "AC-01", mono: true }, "Access control policy", { text: "Compliant", color: "oklch(0.490 0.075 160)" }],
          [{ text: "AC-02", mono: true }, "Account management", { text: "Partially compliant", color: "oklch(0.520 0.100 75)" }],
          [{ text: "SC-07", mono: true }, "Boundary protection", { text: "Non compliant", color: "oklch(0.495 0.155 25)" }],
        ],
      },
      {
        n: "02",
        title: "Gap Register",
        columns: ["Control", "Title", "Gap", "Remediation"],
        rows: [
          [{ text: "SC-07", mono: true }, "Boundary protection", "No egress filtering", "Deploy NGFW egress rules"],
        ],
        empty: "No gaps.",
      },
    ],
  },
  maturity: {
    ...base,
    type: "maturity",
    id: "MAT",
    eyebrow: "Maturity · C2M2",
    title: "Capability Maturity Assessment",
    scorecard: [
      { label: "Overall level", value: 3, suffix: "/ 5", tone: "med" },
      { label: "Overall score", value: 64, suffix: "/ 100", tone: "brand" },
      { label: "Domains below target", value: 2, tone: "high" },
    ],
    findings: [],
    sections: [
      {
        n: "01",
        title: "Domain Maturity",
        columns: ["Domain", "Current", "Target"],
        rows: [
          ["Identity & Access", { text: "3", mono: true }, { text: "4", mono: true }],
          ["Detection & Response", { text: "2", mono: true }, { text: "4", mono: true }],
        ],
      },
      {
        n: "02",
        title: "Below Target",
        columns: ["Domain", "Current", "Target", "Gap"],
        rows: [["Detection & Response", { text: "2", mono: true }, { text: "4", mono: true }, { text: "2", mono: true, color: "oklch(0.495 0.155 25)" }]],
      },
    ],
  },
  roadmap: {
    ...base,
    type: "roadmap",
    id: "ROAD",
    eyebrow: "Action Plan",
    title: "Remediation Roadmap",
    scorecard: [
      { label: "Initiatives", value: 9, tone: "brand" },
      { label: "Break pathway", value: 0, tone: "crit" },
      { label: "Quick wins", value: 4, tone: "ok" },
    ],
    findings: [],
    sections: [
      {
        n: "01",
        title: "0–30 days",
        columns: ["Action", "Owner", "Effort", "Cost", "Risk↓"],
        rows: [["Enforce MFA on admin accounts", "IT Director", { text: "S", mono: true }, { text: "$", mono: true }, { text: "5", mono: true }]],
        empty: "No actions in this window.",
      },
    ],
  },
};

describeReal("Epic 17 — real PDF per deliverable type", () => {
  it.each(Object.keys(docs))("renders a real %s PDF > 5KB", async (type) => {
    const { buffer, filename } = await generateDeliverablePdf(docs[type]!);
    expect(buffer.subarray(0, 5).toString("utf-8")).toBe("%PDF-");
    expect(buffer.length).toBeGreaterThan(5 * 1024);
    fs.writeFileSync(path.join(process.cwd(), filename), buffer);
    // eslint-disable-next-line no-console
    console.log(`[Epic17 PDF] ${type}: ${filename} (${buffer.length} bytes)`);
  }, 60000);
});
