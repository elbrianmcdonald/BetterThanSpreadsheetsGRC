/**
 * Finding Scoring Options Unit Tests
 *
 * Story 20.1: Score a Finding at Creation (Risk Model Cleanup Epic 20)
 *
 * Tests the pure helpers shared by every finding-creation entry point:
 * - severityFromLabel: matrix threshold label → coarse Severity enum (AC2)
 * - severityForThresholdIndex: position-based enum mapping for dropdowns
 * - buildSeverityOptions: matrix thresholds → categorical dropdown options
 * - buildScoringSubmitFields: normalized scoring state → finding.create fields (AC1)
 */

import { Severity } from "@prisma/client";
import type { Threshold } from "@/lib/matrix/types";
import {
  severityFromLabel,
  severityForThresholdIndex,
  buildSeverityOptions,
  buildScoringSubmitFields,
  FALLBACK_SEVERITY_OPTIONS,
  type FindingScoringValue,
} from "@/lib/findings/scoring-options";

const THRESHOLDS: Threshold[] = [
  { minValue: 0, maxValue: 6, label: "Low", color: "#22C55E", sortOrder: 0, slaDays: 90 },
  { minValue: 6, maxValue: 12, label: "Medium", color: "#EAB308", sortOrder: 1, slaDays: 30 },
  { minValue: 12, maxValue: 20, label: "High", color: "#F97316", sortOrder: 2, slaDays: 14 },
  { minValue: 20, maxValue: 25.1, label: "Critical", color: "#EF4444", sortOrder: 3, slaDays: 7 },
];

describe("severityFromLabel (AC2: coarse severity derived from matrix label)", () => {
  it("maps Critical and High to HIGH", () => {
    expect(severityFromLabel("Critical")).toBe(Severity.HIGH);
    expect(severityFromLabel("High")).toBe(Severity.HIGH);
  });

  it("maps Low to LOW", () => {
    expect(severityFromLabel("Low")).toBe(Severity.LOW);
  });

  it("maps everything else (and null/undefined) to MEDIUM", () => {
    expect(severityFromLabel("Medium")).toBe(Severity.MEDIUM);
    expect(severityFromLabel("Elevated")).toBe(Severity.MEDIUM);
    expect(severityFromLabel(null)).toBe(Severity.MEDIUM);
    expect(severityFromLabel(undefined)).toBe(Severity.MEDIUM);
  });

  it("is case-insensitive", () => {
    expect(severityFromLabel("CRITICAL")).toBe(Severity.HIGH);
    expect(severityFromLabel("low")).toBe(Severity.LOW);
  });
});

describe("severityForThresholdIndex", () => {
  it("maps bottom tier to LOW, top tier to HIGH, middles to MEDIUM", () => {
    expect(severityForThresholdIndex(0, 4)).toBe(Severity.LOW);
    expect(severityForThresholdIndex(1, 4)).toBe(Severity.MEDIUM);
    expect(severityForThresholdIndex(2, 4)).toBe(Severity.MEDIUM);
    expect(severityForThresholdIndex(3, 4)).toBe(Severity.HIGH);
  });

  it("maps a single-tier matrix to MEDIUM", () => {
    expect(severityForThresholdIndex(0, 1)).toBe(Severity.MEDIUM);
  });
});

describe("buildSeverityOptions", () => {
  it("falls back to HIGH/MEDIUM/LOW when no thresholds exist (AC3)", () => {
    expect(buildSeverityOptions(null)).toEqual(FALLBACK_SEVERITY_OPTIONS);
    expect(buildSeverityOptions(undefined)).toEqual(FALLBACK_SEVERITY_OPTIONS);
    expect(buildSeverityOptions([])).toEqual(FALLBACK_SEVERITY_OPTIONS);
  });

  it("builds one option per threshold, highest tier first, with colors", () => {
    const options = buildSeverityOptions(THRESHOLDS);
    expect(options).toHaveLength(4);
    expect(options[0]).toMatchObject({
      key: "Critical",
      label: "Critical",
      color: "#EF4444",
      severity: Severity.HIGH,
      severityLabel: "Critical",
    });
    expect(options[3]).toMatchObject({
      key: "Low",
      severity: Severity.LOW,
      severityLabel: "Low",
    });
    // Middle tiers map to MEDIUM (position-based, not label-based)
    expect(options[1]!.severity).toBe(Severity.MEDIUM); // "High" tier at index 2 of 4
    expect(options[2]!.severity).toBe(Severity.MEDIUM);
  });
});

describe("buildScoringSubmitFields (AC1: matrix fields flow to finding.create)", () => {
  const base: FindingScoringValue = {
    mode: "matrix",
    likelihood: 4,
    impact: 5,
    exposure: null,
    is3D: false,
    severity: Severity.HIGH,
    severityLabel: "Critical",
    matrixVersionId: "mv-1",
    isComplete: true,
  };

  it("matrix mode sends L/I + matrixVersionId and omits severityLabel (server computes it)", () => {
    const fields = buildScoringSubmitFields(base);
    expect(fields).toEqual({
      severity: Severity.HIGH,
      likelihood: 4,
      impact: 5,
      exposure: undefined,
      matrixVersionId: "mv-1",
    });
    expect(fields).not.toHaveProperty("severityLabel", expect.anything());
  });

  it("matrix mode includes exposure only for 3D matrices", () => {
    const fields3D = buildScoringSubmitFields({
      ...base,
      is3D: true,
      exposure: 3,
    });
    expect(fields3D.exposure).toBe(3);

    const fields2D = buildScoringSubmitFields({ ...base, exposure: 3 });
    expect(fields2D.exposure).toBeUndefined();
  });

  it("categorical mode sends severity + severityLabel + matrixVersionId when tiers come from a matrix", () => {
    const fields = buildScoringSubmitFields({
      mode: "categorical",
      likelihood: null,
      impact: null,
      exposure: null,
      is3D: false,
      severity: Severity.MEDIUM,
      severityLabel: "Medium",
      matrixVersionId: "mv-1",
      isComplete: true,
    });
    expect(fields).toEqual({
      severity: Severity.MEDIUM,
      severityLabel: "Medium",
      matrixVersionId: "mv-1",
    });
  });

  it("categorical mode without a matrix sends only the coarse severity (AC3 fallback)", () => {
    const fields = buildScoringSubmitFields({
      mode: "categorical",
      likelihood: null,
      impact: null,
      exposure: null,
      is3D: false,
      severity: Severity.LOW,
      severityLabel: null,
      matrixVersionId: null,
      isComplete: true,
    });
    expect(fields).toEqual({ severity: Severity.LOW });
  });

  it("incomplete matrix state falls back to categorical fields rather than sending partial L/I", () => {
    const fields = buildScoringSubmitFields({
      ...base,
      impact: null,
      isComplete: false,
    });
    expect(fields.likelihood).toBeUndefined();
    expect(fields.impact).toBeUndefined();
  });
});
