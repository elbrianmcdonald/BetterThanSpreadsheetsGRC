/**
 * Unit tests for OLIR mapping-type labels (Story 25.1).
 *
 * Guards that both mapping-type enums expose exactly the four NIST OLIR values and
 * that every value resolves to a human-readable label (never a raw-value fallback),
 * and that the legacy COVERS/PARTIAL/EXCEEDS trio is gone.
 */

import { StandardMappingType, FrameworkMappingType } from "@prisma/client";
import {
  MAPPING_TYPE_OPTIONS,
  FRAMEWORK_MAPPING_TYPE_OPTIONS,
  OLIR_MAPPING_TYPE_META,
  labelForMappingType,
  labelForFrameworkMappingType,
} from "@/components/organizational-control/enum-labels";

const OLIR_VALUES = ["EQUIVALENT", "SUBSET_OF", "SUPERSET_OF", "INTERSECTS"] as const;
const LEGACY_VALUES = ["COVERS", "PARTIAL", "EXCEEDS"];

describe("OLIR mapping-type enums - Story 25.1", () => {
  it("StandardMappingType has exactly the four OLIR values and no legacy values", () => {
    expect(Object.values(StandardMappingType).sort()).toEqual([...OLIR_VALUES].sort());
    for (const legacy of LEGACY_VALUES) {
      expect(Object.values(StandardMappingType)).not.toContain(legacy);
    }
  });

  it("FrameworkMappingType has exactly the four OLIR values and no legacy values", () => {
    expect(Object.values(FrameworkMappingType).sort()).toEqual([...OLIR_VALUES].sort());
    for (const legacy of LEGACY_VALUES) {
      expect(Object.values(FrameworkMappingType)).not.toContain(legacy);
    }
  });
});

describe("OLIR mapping-type labels - Story 25.1", () => {
  it("shared meta covers all four values with distinct human labels + hints", () => {
    expect(OLIR_MAPPING_TYPE_META.map((o) => o.value).sort()).toEqual([...OLIR_VALUES].sort());
    for (const meta of OLIR_MAPPING_TYPE_META) {
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.label).not.toBe(meta.value); // a real label, not the raw enum token
      expect(meta.hint.length).toBeGreaterThan(0);
    }
  });

  it("MAPPING_TYPE_OPTIONS and FRAMEWORK_MAPPING_TYPE_OPTIONS each list all four values", () => {
    expect(MAPPING_TYPE_OPTIONS.map((o) => o.value).sort()).toEqual([...OLIR_VALUES].sort());
    expect(FRAMEWORK_MAPPING_TYPE_OPTIONS.map((o) => o.value).sort()).toEqual([...OLIR_VALUES].sort());
  });

  it("every StandardMappingType value resolves to a non-fallback label", () => {
    for (const v of Object.values(StandardMappingType)) {
      const label = labelForMappingType(v);
      expect(label).not.toBe(v); // fallback returns the raw value; a mapped label never equals it
    }
  });

  it("every FrameworkMappingType value resolves to a non-fallback label", () => {
    for (const v of Object.values(FrameworkMappingType)) {
      const label = labelForFrameworkMappingType(v);
      expect(label).not.toBe(v);
    }
  });

  it("maps the specific OLIR labels", () => {
    expect(labelForMappingType(StandardMappingType.EQUIVALENT)).toBe("Equivalent");
    expect(labelForMappingType(StandardMappingType.SUBSET_OF)).toBe("Subset of");
    expect(labelForFrameworkMappingType(FrameworkMappingType.SUPERSET_OF)).toBe("Superset of");
    expect(labelForFrameworkMappingType(FrameworkMappingType.INTERSECTS)).toBe("Intersects");
  });
});
