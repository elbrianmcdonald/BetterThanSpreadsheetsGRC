/**
 * Threshold Templates Tests
 *
 * Story 7.8.6: Matrix Builder UI - Thresholds
 *
 * Tests for threshold template generation (AC20-AC22):
 * - AC20: "Apply Template" dropdown for common patterns
 * - AC21: Templates: 4-level (Low/Med/High/Critical), 3-level, 5-level
 * - AC22: Template applies based on current outputScaleMax
 */

import {
  getThresholdTemplate,
  getTemplateDisplayName,
  THRESHOLD_TEMPLATE_NAMES,
  type ThresholdTemplateName,
} from "@/lib/matrix/thresholdTemplates";
import type { Threshold } from "@/lib/matrix";

describe("Threshold Templates (AC20-AC22)", () => {
  describe("AC21: Template definitions", () => {
    it("should have 3-level template", () => {
      const template = getThresholdTemplate("3-level", 25);

      expect(template).toHaveLength(3);
      expect(template.map((t) => t.label)).toEqual(["Low", "Medium", "High"]);
    });

    it("should have 4-level template", () => {
      const template = getThresholdTemplate("4-level", 25);

      expect(template).toHaveLength(4);
      expect(template.map((t) => t.label)).toEqual([
        "Low",
        "Medium",
        "High",
        "Critical",
      ]);
    });

    it("should have 5-level template", () => {
      const template = getThresholdTemplate("5-level", 25);

      expect(template).toHaveLength(5);
      expect(template.map((t) => t.label)).toEqual([
        "Very Low",
        "Low",
        "Medium",
        "High",
        "Critical",
      ]);
    });
  });

  describe("AC22: Template scales to outputScaleMax", () => {
    it("should scale 3-level template to outputScaleMax 25", () => {
      const template = getThresholdTemplate("3-level", 25);

      // First threshold starts at 0
      expect(template[0]!.minValue).toBe(0);
      // Last threshold ends at 25
      expect(template[template.length - 1]!.maxValue).toBe(25);
    });

    it("should scale 4-level template to outputScaleMax 100", () => {
      const template = getThresholdTemplate("4-level", 100);

      expect(template[0]!.minValue).toBe(0);
      expect(template[template.length - 1]!.maxValue).toBe(100);

      // Each threshold should cover 25% (100/4 = 25)
      expect(template[0]!.maxValue).toBe(25);
      expect(template[1]!.minValue).toBe(25);
      expect(template[1]!.maxValue).toBe(50);
      expect(template[2]!.minValue).toBe(50);
      expect(template[2]!.maxValue).toBe(75);
      expect(template[3]!.minValue).toBe(75);
      expect(template[3]!.maxValue).toBe(100);
    });

    it("should scale to different outputScaleMax values", () => {
      const scales = [10, 25, 50, 100, 1000];

      for (const max of scales) {
        const template = getThresholdTemplate("4-level", max);

        expect(template[0]!.minValue).toBe(0);
        expect(template[template.length - 1]!.maxValue).toBe(max);
      }
    });
  });

  describe("Template contiguity", () => {
    const templateNames: ThresholdTemplateName[] = ["3-level", "4-level", "5-level"];
    const outputScaleMax = 25;

    templateNames.forEach((templateName) => {
      it(`${templateName} template should have contiguous boundaries`, () => {
        const template = getThresholdTemplate(templateName, outputScaleMax);

        // Check that each threshold's maxValue equals the next threshold's minValue
        for (let i = 0; i < template.length - 1; i++) {
          expect(template[i]!.maxValue).toBe(template[i + 1]!.minValue);
        }
      });
    });

    templateNames.forEach((templateName) => {
      it(`${templateName} template should start at 0`, () => {
        const template = getThresholdTemplate(templateName, outputScaleMax);

        expect(template[0]!.minValue).toBe(0);
      });
    });

    templateNames.forEach((templateName) => {
      it(`${templateName} template should end at outputScaleMax`, () => {
        const template = getThresholdTemplate(templateName, outputScaleMax);

        expect(template[template.length - 1]!.maxValue).toBe(outputScaleMax);
      });
    });
  });

  describe("Template colors", () => {
    it("should have valid hex colors for all thresholds", () => {
      const hexRegex = /^#[0-9A-Fa-f]{6}$/;
      const templateNames: ThresholdTemplateName[] = ["3-level", "4-level", "5-level"];

      templateNames.forEach((templateName) => {
        const template = getThresholdTemplate(templateName, 25);

        template.forEach((threshold) => {
          expect(threshold.color).toMatch(hexRegex);
        });
      });
    });

    it("should have green for lowest risk level", () => {
      const template = getThresholdTemplate("4-level", 25);

      // Green-ish color (starts with #22C or similar)
      expect(template[0]!.color.toLowerCase()).toMatch(/^#(22c55e|00ff00|22c)/);
    });

    it("should have red for highest risk level", () => {
      const template = getThresholdTemplate("4-level", 25);
      const lastThreshold = template[template.length - 1]!;

      // Red-ish color
      expect(lastThreshold.color.toLowerCase()).toMatch(/^#(ef4444|ff0000|dc|f00)/);
    });
  });

  describe("Template sortOrder", () => {
    const templateNames: ThresholdTemplateName[] = ["3-level", "4-level", "5-level"];

    templateNames.forEach((templateName) => {
      it(`${templateName} template should have sequential sortOrder`, () => {
        const template = getThresholdTemplate(templateName, 25);

        template.forEach((threshold, index) => {
          expect(threshold.sortOrder).toBe(index + 1);
        });
      });
    });
  });

  describe("getTemplateDisplayName", () => {
    it("should return display name for 3-level", () => {
      const displayName = getTemplateDisplayName("3-level");

      expect(displayName).toContain("3-Level");
      expect(displayName).toContain("Low");
      expect(displayName).toContain("High");
    });

    it("should return display name for 4-level", () => {
      const displayName = getTemplateDisplayName("4-level");

      expect(displayName).toContain("4-Level");
      expect(displayName).toContain("Critical");
    });

    it("should return display name for 5-level", () => {
      const displayName = getTemplateDisplayName("5-level");

      expect(displayName).toContain("5-Level");
      expect(displayName).toContain("Very");
    });
  });

  describe("THRESHOLD_TEMPLATE_NAMES", () => {
    it("should export all template names", () => {
      expect(THRESHOLD_TEMPLATE_NAMES).toContain("3-level");
      expect(THRESHOLD_TEMPLATE_NAMES).toContain("4-level");
      expect(THRESHOLD_TEMPLATE_NAMES).toContain("5-level");
    });

    it("should have 3 templates", () => {
      expect(THRESHOLD_TEMPLATE_NAMES).toHaveLength(3);
    });
  });

  describe("Template precision", () => {
    it("should handle decimal precision correctly", () => {
      const template = getThresholdTemplate("3-level", 25);

      // Check that values are reasonable decimals (not floating point errors)
      template.forEach((threshold) => {
        expect(Number.isFinite(threshold.minValue)).toBe(true);
        expect(Number.isFinite(threshold.maxValue)).toBe(true);

        // Values should not have excessive decimal places
        const minStr = threshold.minValue.toString();
        const maxStr = threshold.maxValue.toString();

        if (minStr.includes(".")) {
          expect(minStr.split(".")[1]!.length).toBeLessThanOrEqual(2);
        }
        // maxValue of last threshold is exactly outputScaleMax
        if (threshold !== template[template.length - 1]) {
          if (maxStr.includes(".")) {
            expect(maxStr.split(".")[1]!.length).toBeLessThanOrEqual(2);
          }
        }
      });
    });
  });

  describe("Template equal distribution", () => {
    it("3-level template should divide roughly into thirds", () => {
      const outputScaleMax = 30; // Divisible by 3
      const template = getThresholdTemplate("3-level", outputScaleMax);

      template.forEach((threshold) => {
        const range = threshold.maxValue - threshold.minValue;
        // Each should be roughly 10 (30/3)
        expect(range).toBeGreaterThanOrEqual(9);
        expect(range).toBeLessThanOrEqual(11);
      });
    });

    it("4-level template should divide into quarters", () => {
      const outputScaleMax = 100;
      const template = getThresholdTemplate("4-level", outputScaleMax);

      template.forEach((threshold) => {
        const range = threshold.maxValue - threshold.minValue;
        expect(range).toBe(25);
      });
    });

    it("5-level template should divide into fifths", () => {
      const outputScaleMax = 100;
      const template = getThresholdTemplate("5-level", outputScaleMax);

      template.forEach((threshold) => {
        const range = threshold.maxValue - threshold.minValue;
        expect(range).toBe(20);
      });
    });
  });
});
