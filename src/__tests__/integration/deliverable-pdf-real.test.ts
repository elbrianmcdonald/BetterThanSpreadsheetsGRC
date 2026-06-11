/**
 * Story 17.1 — AC23 hard fidelity gate: REAL PDF render.
 *
 * Unlike deliverable-shell.test.ts, this does NOT mock Puppeteer. It drives the
 * actual Chromium binary (PUPPETEER_EXECUTABLE_PATH) so the gradient cover band
 * and oklch token colors are really rasterized. It writes the PDF to disk and
 * asserts a non-trivial size, then leaves the file for manual inspection.
 *
 * Skipped automatically unless a Chromium binary is available, so the normal
 * suite (which mocks Puppeteer) is unaffected.
 */

import fs from "fs";
import path from "path";
import { generateDeliverablePdf, type DeliverableDocData } from "@/server/services/deliverablePdf";

const hasChromium = !!process.env.PUPPETEER_EXECUTABLE_PATH;
const describeReal = hasChromium ? describe : describe.skip;

describeReal("Deliverable real PDF render - Story 17.1 AC23", () => {
  it("renders a real PDF > 5KB starting with %PDF and writes it to disk", async () => {
    const doc: DeliverableDocData = {
      type: "stub",
      id: "AC23",
      eyebrow: "Cybersecurity Assessment",
      title: "Security Posture Assessment",
      engagement: "Acme Industries",
      period: "Q2 2026",
      preparedBy: "M. Okafor, Lead Assessor",
      scorecard: [
        { label: "Security posture", value: 62, suffix: "/ 100", tone: "ok", deltaNote: "+8 vs. prior" },
        { label: "Risk exposure", value: 41, suffix: "/ 100", tone: "high", deltaNote: "−5 vs. prior" },
        { label: "Critical findings", value: 3, tone: "crit", deltaNote: "of 12 total" },
      ],
      findings: [
        { identifier: "F-01", title: "Internet-exposed management interface", likelihood: 5, impact: 5, domain: "External Attack Surface" },
        { identifier: "F-02", title: "Flat IT/OT network — no segmentation", likelihood: 4, impact: 5, domain: "Network & Architecture" },
        { identifier: "F-03", title: "No phishing-resistant MFA on admin accounts", likelihood: 4, impact: 4, domain: "Identity & Access" },
      ],
    };

    const { buffer, filename } = await generateDeliverablePdf(doc);

    expect(buffer.subarray(0, 5).toString("utf-8")).toBe("%PDF-");
    expect(buffer.length).toBeGreaterThan(5 * 1024);

    const outPath = path.join(process.cwd(), filename);
    fs.writeFileSync(outPath, buffer);
    // eslint-disable-next-line no-console
    console.log(`[AC23] real PDF written: ${outPath} (${buffer.length} bytes)`);
  }, 60000);
});
