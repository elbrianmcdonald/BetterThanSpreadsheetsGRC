/**
 * Unit tests for crosswalk suggestion derivation (Story 26.1).
 */

import {
  invertMappingType,
  composeMappingType,
  derivedConfidence,
  deriveSuggestion,
  type OlirType,
} from "@/lib/crosswalk-derivation";

const ALL: OlirType[] = ["EQUIVALENT", "SUBSET_OF", "SUPERSET_OF", "INTERSECTS"];

describe("invertMappingType", () => {
  it("swaps subset/superset and leaves equivalent/intersects", () => {
    expect(invertMappingType("SUBSET_OF")).toBe("SUPERSET_OF");
    expect(invertMappingType("SUPERSET_OF")).toBe("SUBSET_OF");
    expect(invertMappingType("EQUIVALENT")).toBe("EQUIVALENT");
    expect(invertMappingType("INTERSECTS")).toBe("INTERSECTS");
  });

  it("round-trips", () => {
    for (const t of ALL) expect(invertMappingType(invertMappingType(t))).toBe(t);
  });
});

describe("composeMappingType", () => {
  it("EQUIVALENT is the identity element", () => {
    for (const t of ALL) {
      expect(composeMappingType("EQUIVALENT", t)).toBe(t);
      expect(composeMappingType(t, "EQUIVALENT")).toBe(t);
    }
  });

  it("equal types compose to themselves", () => {
    expect(composeMappingType("SUBSET_OF", "SUBSET_OF")).toBe("SUBSET_OF");
    expect(composeMappingType("SUPERSET_OF", "SUPERSET_OF")).toBe("SUPERSET_OF");
    expect(composeMappingType("INTERSECTS", "INTERSECTS")).toBe("INTERSECTS");
  });

  it("mixed subset/superset downgrades to INTERSECTS", () => {
    expect(composeMappingType("SUBSET_OF", "SUPERSET_OF")).toBe("INTERSECTS");
    expect(composeMappingType("SUPERSET_OF", "SUBSET_OF")).toBe("INTERSECTS");
  });

  it("any INTERSECTS edge yields INTERSECTS", () => {
    expect(composeMappingType("INTERSECTS", "SUBSET_OF")).toBe("INTERSECTS");
    expect(composeMappingType("SUPERSET_OF", "INTERSECTS")).toBe("INTERSECTS");
  });
});

describe("derivedConfidence", () => {
  it("two equivalents = 100", () => {
    expect(derivedConfidence("EQUIVALENT", "EQUIVALENT")).toBe(100);
  });

  it("weakest-edge downgrade ordering", () => {
    const eqEq = derivedConfidence("EQUIVALENT", "EQUIVALENT");
    const eqSub = derivedConfidence("EQUIVALENT", "SUBSET_OF");
    const subSub = derivedConfidence("SUBSET_OF", "SUBSET_OF");
    const withInt = derivedConfidence("EQUIVALENT", "INTERSECTS");
    expect(eqEq).toBeGreaterThan(eqSub);
    expect(eqSub).toBeGreaterThan(subSub);
    expect(withInt).toBeLessThanOrEqual(60);
  });

  it("any intersects edge caps confidence at 60", () => {
    for (const t of ALL) {
      expect(derivedConfidence("INTERSECTS", t)).toBeLessThanOrEqual(60);
    }
  });
});

describe("deriveSuggestion", () => {
  it("caps an INTERSECTS conclusion at the observed-overlap confidence (60)", () => {
    // SUBSET_OF ∘ SUPERSET_OF downgrades to INTERSECTS; raw product would be 72,
    // but an INTERSECTS conclusion must not out-claim a real INTERSECTS edge (60).
    const d = deriveSuggestion("SUBSET_OF", "SUPERSET_OF");
    expect(d.type).toBe("INTERSECTS");
    expect(d.confidence).toBe(60);
    expect(deriveSuggestion("SUBSET_OF", "SUPERSET_OF").confidence).toBeLessThanOrEqual(
      derivedConfidence("EQUIVALENT", "INTERSECTS"),
    );
  });

  it("leaves directional/equivalent conclusions at their full product", () => {
    expect(deriveSuggestion("EQUIVALENT", "EQUIVALENT")).toEqual({ type: "EQUIVALENT", confidence: 100 });
    expect(deriveSuggestion("EQUIVALENT", "SUBSET_OF")).toEqual({ type: "SUBSET_OF", confidence: 85 });
    expect(deriveSuggestion("SUBSET_OF", "SUBSET_OF").type).toBe("SUBSET_OF");
  });
});
