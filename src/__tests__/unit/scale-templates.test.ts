/**
 * Scale Templates Tests
 *
 * Story 7.8.5: Matrix Builder UI - Scales
 *
 * Tests for scale templates (AC21-AC23):
 * - AC22: Templates: 3-level, 5-level, 10-level
 */

import {
  SCALE_TEMPLATES,
  SCALE_TEMPLATE_INFO,
  getScaleTemplate,
  type ScaleTemplateName,
} from "@/lib/matrix/scaleTemplates";

describe("Scale Templates (AC21-AC23)", () => {
  describe("Template Definitions", () => {
    it("should have 3-level template", () => {
      expect(SCALE_TEMPLATES["3-level"]).toBeDefined();
      expect(SCALE_TEMPLATES["3-level"]).toHaveLength(3);
    });

    it("should have 5-level template", () => {
      expect(SCALE_TEMPLATES["5-level"]).toBeDefined();
      expect(SCALE_TEMPLATES["5-level"]).toHaveLength(5);
    });

    it("should have 10-level template", () => {
      expect(SCALE_TEMPLATES["10-level"]).toBeDefined();
      expect(SCALE_TEMPLATES["10-level"]).toHaveLength(10);
    });
  });

  describe("3-Level Template", () => {
    const template = SCALE_TEMPLATES["3-level"];

    it("should have Low, Medium, High labels", () => {
      const labels = template.map((l) => l.label);
      expect(labels).toContain("Low");
      expect(labels).toContain("Medium");
      expect(labels).toContain("High");
    });

    it("should have ascending values", () => {
      for (let i = 1; i < template.length; i++) {
        expect(template[i]!.value).toBeGreaterThan(template[i - 1]!.value);
      }
    });

    it("should have values 1, 2, 3", () => {
      expect(template.map((l) => l.value)).toEqual([1, 2, 3]);
    });

    it("should have descriptions for each level", () => {
      template.forEach((level) => {
        expect(level.description).toBeDefined();
        expect(level.description.length).toBeGreaterThan(0);
      });
    });
  });

  describe("5-Level Template", () => {
    const template = SCALE_TEMPLATES["5-level"];

    it("should have expected labels", () => {
      const labels = template.map((l) => l.label);
      expect(labels).toEqual([
        "Very Low",
        "Low",
        "Medium",
        "High",
        "Very High",
      ]);
    });

    it("should have ascending values", () => {
      for (let i = 1; i < template.length; i++) {
        expect(template[i]!.value).toBeGreaterThan(template[i - 1]!.value);
      }
    });

    it("should have values 1-5", () => {
      expect(template.map((l) => l.value)).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe("10-Level Template", () => {
    const template = SCALE_TEMPLATES["10-level"];

    it("should have 10 levels", () => {
      expect(template).toHaveLength(10);
    });

    it("should have sequential values 1-10", () => {
      const values = template.map((l) => l.value);
      expect(values).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });

    it("should have Level N labels", () => {
      template.forEach((level, i) => {
        expect(level.label).toBe(`Level ${i + 1}`);
      });
    });
  });

  describe("Template Info", () => {
    it("should have info for all templates", () => {
      const templateNames: ScaleTemplateName[] = ["3-level", "5-level", "10-level"];
      templateNames.forEach((name) => {
        expect(SCALE_TEMPLATE_INFO[name]).toBeDefined();
        expect(SCALE_TEMPLATE_INFO[name].name).toBeDefined();
        expect(SCALE_TEMPLATE_INFO[name].description).toBeDefined();
        expect(SCALE_TEMPLATE_INFO[name].levelCount).toBeDefined();
      });
    });

    it("should have correct level counts", () => {
      expect(SCALE_TEMPLATE_INFO["3-level"].levelCount).toBe(3);
      expect(SCALE_TEMPLATE_INFO["5-level"].levelCount).toBe(5);
      expect(SCALE_TEMPLATE_INFO["10-level"].levelCount).toBe(10);
    });
  });

  describe("getScaleTemplate", () => {
    it("should return a deep copy of 3-level template", () => {
      const template1 = getScaleTemplate("3-level");
      const template2 = getScaleTemplate("3-level");

      // Should be equal but not the same reference
      expect(template1).toEqual(template2);
      expect(template1).not.toBe(template2);

      // Individual levels should also be copies
      expect(template1[0]).not.toBe(template2[0]);
    });

    it("should return a deep copy of 5-level template", () => {
      const template = getScaleTemplate("5-level");
      expect(template).toHaveLength(5);

      // Modifying returned template shouldn't affect original
      template[0]!.label = "Modified";
      expect(SCALE_TEMPLATES["5-level"][0]!.label).toBe("Very Low");
    });

    it("should return a deep copy of 10-level template", () => {
      const template = getScaleTemplate("10-level");
      expect(template).toHaveLength(10);
    });
  });

  describe("Template Validity", () => {
    const templates = Object.entries(SCALE_TEMPLATES);

    it.each(templates)("%s template should have all positive values", (name, template) => {
      template.forEach((level) => {
        expect(level.value).toBeGreaterThan(0);
      });
    });

    it.each(templates)("%s template should have unique values", (name, template) => {
      const values = template.map((l) => l.value);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(values.length);
    });

    it.each(templates)("%s template should have non-empty labels", (name, template) => {
      template.forEach((level) => {
        expect(level.label.length).toBeGreaterThan(0);
      });
    });

    it.each(templates)("%s template should meet minimum 3 levels", (name, template) => {
      expect(template.length).toBeGreaterThanOrEqual(3);
    });

    it.each(templates)("%s template should not exceed 10 levels", (name, template) => {
      expect(template.length).toBeLessThanOrEqual(10);
    });
  });
});
