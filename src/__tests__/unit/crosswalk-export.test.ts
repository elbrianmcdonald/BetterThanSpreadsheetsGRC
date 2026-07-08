/**
 * Unit tests for the crosswalk export file builder (Story 26.4).
 */

import { buildExportFile } from "@/lib/crosswalk-export";

describe("buildExportFile", () => {
  it("builds a quoted CSV with CRLF rows", () => {
    const f = buildExportFile("csv", ["A", "B"], [["1", "two, comma"]]);
    expect(f.encoding).toBe("utf8");
    expect(f.mimeType).toMatch(/csv/);
    expect(f.content).toBe('"A","B"\r\n"1","two, comma"');
  });

  it("escapes embedded quotes", () => {
    const f = buildExportFile("csv", ["H"], [['he said "hi"']]);
    expect(f.content).toContain('"he said ""hi"""');
  });

  it("neutralizes formula-injection cells (CSV)", () => {
    const f = buildExportFile("csv", ["H"], [["=1+1"], ["+cmd"], ["-2"], ["@x"], ["safe"]]);
    expect(f.content).toContain(`"'=1+1"`);
    expect(f.content).toContain(`"'+cmd"`);
    expect(f.content).toContain(`"'-2"`);
    expect(f.content).toContain(`"'@x"`);
    expect(f.content).toContain(`"safe"`);
  });

  it("produces a base64 xlsx payload", () => {
    const f = buildExportFile("xlsx", ["H"], [["v"]]);
    expect(f.encoding).toBe("base64");
    expect(f.mimeType).toMatch(/spreadsheetml/);
    expect(f.content.startsWith("UEsD")).toBe(true); // PK zip header
  });
});
