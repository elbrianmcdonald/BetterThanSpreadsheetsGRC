/**
 * Unit tests for the risk CSV import parser/validator (src/lib/riskCsv.ts).
 */

import { parseCsv, parseRiskImportCsv } from "@/lib/riskCsv";

describe("parseCsv (RFC-4180)", () => {
  it("parses simple rows", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted fields with commas and newlines", () => {
    const csv = 'Title,Description\n"A, risk","line1\nline2"';
    expect(parseCsv(csv)).toEqual([
      ["Title", "Description"],
      ["A, risk", "line1\nline2"],
    ]);
  });

  it("handles doubled-quote escapes", () => {
    expect(parseCsv('x\n"she said ""hi"""')).toEqual([["x"], ['she said "hi"']]);
  });

  it("tolerates CRLF and a trailing newline", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("parseRiskImportCsv", () => {
  const header =
    "Risk ID,Title,Description,Severity,Status,Affected Systems,CVE ID,Finding Source,Asset Criticality,Discovery Date";

  it("parses valid rows and ignores derived/unknown columns", () => {
    const csv = [
      header,
      ',SQL Injection,Unsanitized input,HIGH,OPEN,web-01,CVE-2024-1,PENETRATION_TEST,CRITICAL,2026-01-15',
    ].join("\n");
    const { rows, errors } = parseRiskImportCsv(csv);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      title: "SQL Injection",
      description: "Unsanitized input",
      severity: "HIGH",
      affectedSystems: "web-01",
      cveId: "CVE-2024-1",
      findingSource: "PENETRATION_TEST",
      assetCriticality: "CRITICAL",
    });
    expect(rows[0]!.discoveryDate).toMatch(/^2026-01-15/);
  });

  it("skips the export 'Total:' footer row and blank lines", () => {
    const csv = [
      header,
      ",Risk A,Desc A,LOW,OPEN,,,,,",
      "",
      '"Total: 1 risks",,,,,,,,,',
    ].join("\n");
    const { rows, errors } = parseRiskImportCsv(csv);
    expect(errors).toEqual([]);
    expect(rows.map((r) => r.title)).toEqual(["Risk A"]);
  });

  it("is case-insensitive on severity and header names", () => {
    const csv = ["title,description,severity", "R1,D1,high"].join("\n");
    const { rows, errors } = parseRiskImportCsv(csv);
    expect(errors).toEqual([]);
    expect(rows[0]!.severity).toBe("HIGH");
  });

  it("reports a row error for invalid severity but keeps good rows", () => {
    const csv = [
      header,
      ",Good,Desc,MEDIUM,,,,,,",
      ",Bad,Desc,SEVERE,,,,,,",
    ].join("\n");
    const { rows, errors } = parseRiskImportCsv(csv);
    expect(rows.map((r) => r.title)).toEqual(["Good"]);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.line).toBe(3);
    expect(errors[0]!.message).toMatch(/Severity must be one of/);
  });

  it("flags missing required fields", () => {
    const csv = [header, ",,No title here,HIGH,,,,,,"].join("\n");
    const { rows, errors } = parseRiskImportCsv(csv);
    expect(rows).toHaveLength(0);
    expect(errors[0]!.message).toMatch(/Title is required/);
  });

  it("returns a file-level error when a required column is missing", () => {
    const csv = ["Title,Description\nR1,D1"].join("\n");
    const { rows, errors } = parseRiskImportCsv(csv);
    expect(rows).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toMatch(/Missing required column\(s\): Severity/);
  });

  it("errors on an unparseable discovery date", () => {
    const csv = [header, ",R1,D1,LOW,,,,,,not-a-date"].join("\n");
    const { errors } = parseRiskImportCsv(csv);
    expect(errors[0]!.message).toMatch(/Discovery Date .* not a valid date/);
  });
});
