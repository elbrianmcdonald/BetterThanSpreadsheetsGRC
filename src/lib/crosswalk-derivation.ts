/**
 * Crosswalk suggestion derivation (Epic 26, Story 26.1).
 *
 * Pure functions for composing a one-hop transitive mapping relationship and its
 * confidence from the two edges in the chain:
 *   org control --type1--> framework-A control --type2--> framework-B control
 *
 * Both mapping-type enums (StandardMappingType, FrameworkMappingType) share the
 * same four NIST OLIR values, so we operate on the string union here and cast at
 * the router boundary.
 */

export type OlirType = "EQUIVALENT" | "SUBSET_OF" | "SUPERSET_OF" | "INTERSECTS";

/**
 * Use a crosswalk edge in the reverse direction. A crosswalk A→B typed SUBSET_OF
 * means "A is a subset of B"; traversed B→A it means "B is a superset of A".
 * EQUIVALENT and INTERSECTS are symmetric.
 */
export function invertMappingType(t: OlirType): OlirType {
  switch (t) {
    case "SUBSET_OF":
      return "SUPERSET_OF";
    case "SUPERSET_OF":
      return "SUBSET_OF";
    default:
      return t; // EQUIVALENT, INTERSECTS
  }
}

/**
 * Compose two chained relationship types into the derived relationship, taking
 * the WEAKEST reading:
 * - EQUIVALENT is the identity element (compose(EQUIVALENT, x) = x).
 * - Equal types compose to themselves (subset∘subset = subset, etc.).
 * - Any other mix (subset vs superset, or anything with intersects) → INTERSECTS.
 * A conservative downgrade: auditors reject over-claims more than under-claims.
 */
export function composeMappingType(a: OlirType, b: OlirType): OlirType {
  if (a === "EQUIVALENT") return b;
  if (b === "EQUIVALENT") return a;
  if (a === b) return a;
  return "INTERSECTS";
}

/** Per-edge confidence factor — any non-equivalent edge lowers the product. */
export const CONFIDENCE_FACTOR: Record<OlirType, number> = {
  EQUIVALENT: 1.0,
  SUBSET_OF: 0.85,
  SUPERSET_OF: 0.85,
  INTERSECTS: 0.6,
};

/**
 * Confidence (0-100) for a derived suggestion: the product of the two edge
 * factors. Weakest-edge downgrade falls out naturally — any INTERSECTS edge
 * caps the result at 60, and two strong edges keep it high.
 */
export function derivedConfidence(a: OlirType, b: OlirType): number {
  return Math.round(100 * CONFIDENCE_FACTOR[a] * CONFIDENCE_FACTOR[b]);
}

/**
 * Derive the suggested relationship AND its confidence from the two chain edges,
 * with a conservative cap: an INTERSECTS *conclusion* (which the composition
 * reaches by discarding directional information — e.g. SUBSET∘SUPERSET) must
 * never claim more confidence than a single directly-observed INTERSECTS edge
 * would. Without this, two strong-but-incompatible edges (0.85×0.85=72) would
 * out-rank a real observed overlap (60), contradicting the "conservative
 * downgrade" intent. (Story 26.1; hardened in the Epic 24-26 review.)
 */
export function deriveSuggestion(a: OlirType, b: OlirType): { type: OlirType; confidence: number } {
  const type = composeMappingType(a, b);
  let confidence = derivedConfidence(a, b);
  if (type === "INTERSECTS") {
    confidence = Math.min(confidence, Math.round(100 * CONFIDENCE_FACTOR.INTERSECTS));
  }
  return { type, confidence };
}
