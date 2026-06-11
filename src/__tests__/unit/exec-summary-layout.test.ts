/**
 * Unit tests for the kind-aware executive-summary section layout normalizer.
 */

import {
  defaultLayout,
  normalizeLayout,
  isValidLayoutPayload,
  sectionsForKind,
} from "@/components/deliverable/execSummaryLayout";

const RISK_KEYS = sectionsForKind("RISK");

describe("execSummaryLayout.normalizeLayout (kind-aware)", () => {
  it("returns the kind's canonical default (all enabled, in order) for null/garbage", () => {
    for (const raw of [null, undefined, {}, "nope", 42]) {
      const layout = normalizeLayout("RISK", raw);
      expect(layout.map((l) => l.key)).toEqual(RISK_KEYS);
      expect(layout.every((l) => l.enabled)).toBe(true);
    }
  });

  it("preserves saved order and disabled flags, appending missing keys", () => {
    const layout = normalizeLayout("RISK", [
      { key: "findings", enabled: true },
      { key: "statement", enabled: false },
    ]);
    expect(layout[0]!.key).toBe("findings");
    expect(layout[1]!.key).toBe("statement");
    expect(layout[1]!.enabled).toBe(false);
    expect(layout).toHaveLength(RISK_KEYS.length);
    expect(new Set(layout.map((l) => l.key)).size).toBe(RISK_KEYS.length);
  });

  it("drops keys not valid for the kind, and de-duplicates", () => {
    // "controls" is a compliance key — invalid for RISK and dropped.
    const layout = normalizeLayout("RISK", [
      { key: "risks", enabled: true },
      { key: "controls", enabled: true },
      { key: "risks", enabled: false },
    ]);
    expect(layout.filter((l) => l.key === "risks")).toHaveLength(1);
    expect(layout.some((l) => (l.key as string) === "controls")).toBe(false);
    expect(layout).toHaveLength(RISK_KEYS.length);
  });

  it("uses per-kind section sets", () => {
    expect(sectionsForKind("COMPLIANCE")).toContain("controls");
    expect(sectionsForKind("COMPLIANCE")).toContain("gaps");
    expect(sectionsForKind("BIA")).toContain("biaRisks");
    expect(sectionsForKind("RISK")).not.toContain("controls");
    expect(defaultLayout("MATURITY").map((l) => l.key)).toEqual(sectionsForKind("MATURITY"));
  });

  it("isValidLayoutPayload guards key/enabled shape per kind", () => {
    expect(isValidLayoutPayload("COMPLIANCE", [{ key: "controls", enabled: true }])).toBe(true);
    expect(isValidLayoutPayload("RISK", [{ key: "controls", enabled: true }])).toBe(false); // wrong kind
    expect(isValidLayoutPayload("RISK", [{ key: "risks", enabled: "yes" }])).toBe(false);
    expect(isValidLayoutPayload("RISK", [])).toBe(false);
    expect(isValidLayoutPayload("RISK", null)).toBe(false);
  });
});
