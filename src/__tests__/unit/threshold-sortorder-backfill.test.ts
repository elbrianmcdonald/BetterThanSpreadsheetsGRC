/**
 * Regression: legacy/seeded matrix versions stored thresholds without
 * `sortOrder`, which made riskMatrix.updateVersion reject any edit
 * ("expected number, received undefined"). thresholdArraySchema now backfills a
 * missing sortOrder from min-value rank at the validation boundary.
 */

import { thresholdArraySchema } from "@/lib/matrix/types";

const band = (
  minValue: number,
  maxValue: number,
  label: string,
  extra: Record<string, unknown> = {},
) => ({ minValue, maxValue, label, color: "#123456", slaDays: 30, ...extra });

describe("thresholdArraySchema sortOrder backfill", () => {
  it("accepts thresholds with no sortOrder and assigns it by min-value rank", () => {
    const parsed = thresholdArraySchema.parse([
      band(0, 3, "Low"),
      band(3, 6, "Medium"),
      band(6, 9, "High"),
    ]);
    expect(parsed.map((t) => t.sortOrder)).toEqual([0, 1, 2]);
  });

  it("assigns sortOrder by min-value even when input is out of order", () => {
    const parsed = thresholdArraySchema.parse([
      band(6, 9, "High"),
      band(0, 3, "Low"),
      band(3, 6, "Medium"),
    ]);
    const byLabel = Object.fromEntries(parsed.map((t) => [t.label, t.sortOrder]));
    expect(byLabel).toEqual({ Low: 0, Medium: 1, High: 2 });
  });

  it("preserves explicit sortOrder values when present", () => {
    const parsed = thresholdArraySchema.parse([
      band(0, 3, "Low", { sortOrder: 5 }),
      band(3, 6, "Medium", { sortOrder: 7 }),
    ]);
    expect(parsed.map((t) => t.sortOrder)).toEqual([5, 7]);
  });

  it("still rejects a genuinely invalid threshold (missing numeric maxValue)", () => {
    expect(() =>
      thresholdArraySchema.parse([{ minValue: 0, label: "Low", color: "#123456", slaDays: 30 }]),
    ).toThrow();
  });
});
