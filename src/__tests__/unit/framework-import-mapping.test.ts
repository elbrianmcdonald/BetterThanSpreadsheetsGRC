/**
 * Unit Tests for Framework Import Column Mapping (Story 24.2)
 *
 * Tests the canonical field set and the pure suggestColumnMapping helper that
 * proposes a column-index-per-canonical-field mapping from raw file headers.
 *
 * @see docs/sprint-artifacts/24-2-column-mapping.md
 */

import {
  CANONICAL_FIELDS,
  suggestColumnMapping,
  buildControlsFromMapping,
  type CanonicalFieldKey,
  type ColumnMapping,
} from "@/lib/framework-import-mapping";

// A fully-populated mapping (controlId=0, title=1, description=2, family=3, parent=4)
const FULL_MAPPING: ColumnMapping = {
  controlId: 0,
  title: 1,
  description: 2,
  family: 3,
  parentControlId: 4,
};

describe("Framework Import Mapping", () => {
  describe("CANONICAL_FIELDS", () => {
    it("defines controlId and title as required, the rest optional", () => {
      const byKey = Object.fromEntries(CANONICAL_FIELDS.map((f) => [f.key, f]));
      expect(byKey.controlId?.required).toBe(true);
      expect(byKey.title?.required).toBe(true);
      expect(byKey.description?.required).toBe(false);
      expect(byKey.family?.required).toBe(false);
      expect(byKey.parentControlId?.required).toBe(false);
    });

    it("exposes exactly the five canonical fields", () => {
      const keys = CANONICAL_FIELDS.map((f) => f.key).sort();
      expect(keys).toEqual(
        ["controlId", "description", "family", "parentControlId", "title"].sort(),
      );
    });
  });

  describe("suggestColumnMapping", () => {
    it("maps exact canonical header labels to their column indices", () => {
      const headers = ["Control ID", "Title", "Description", "Family", "Parent Control ID"];
      const mapping = suggestColumnMapping(headers);

      expect(mapping.controlId).toBe(0);
      expect(mapping.title).toBe(1);
      expect(mapping.description).toBe(2);
      expect(mapping.family).toBe(3);
      expect(mapping.parentControlId).toBe(4);
    });

    it("matches common aliases (Code→controlId, Name→title, Domain→family)", () => {
      const headers = ["Code", "Name", "Details", "Domain", "Parent"];
      const mapping = suggestColumnMapping(headers);

      expect(mapping.controlId).toBe(0);
      expect(mapping.title).toBe(1);
      expect(mapping.description).toBe(2);
      expect(mapping.family).toBe(3);
      expect(mapping.parentControlId).toBe(4);
    });

    it("is case-insensitive and tolerates surrounding whitespace", () => {
      const headers = ["  CONTROL ID  ", "tItLe"];
      const mapping = suggestColumnMapping(headers);

      expect(mapping.controlId).toBe(0);
      expect(mapping.title).toBe(1);
    });

    it("leaves unmatched fields null", () => {
      const headers = ["Foo", "Bar", "Baz"];
      const mapping = suggestColumnMapping(headers);

      expect(mapping.controlId).toBeNull();
      expect(mapping.title).toBeNull();
      expect(mapping.description).toBeNull();
      expect(mapping.family).toBeNull();
      expect(mapping.parentControlId).toBeNull();
    });

    it("never assigns the same column index to two fields", () => {
      // Only one column, and it could alias to multiple fields; must claim once.
      const headers = ["ID"]; // "id" aliases controlId
      const mapping = suggestColumnMapping(headers);

      const assigned = Object.values(mapping).filter((v): v is number => v !== null);
      expect(new Set(assigned).size).toBe(assigned.length);
    });

    it("maps only the first matching header when duplicates alias to one field", () => {
      const headers = ["Control ID", "Control ID"]; // both alias controlId
      const mapping = suggestColumnMapping(headers);

      expect(mapping.controlId).toBe(0); // first wins
      // the second is left unmapped (no field to receive it)
      const assigned = Object.values(mapping).filter((v): v is number => v !== null);
      expect(new Set(assigned).size).toBe(assigned.length);
    });

    it("returns a mapping object keyed by every canonical field", () => {
      const mapping: ColumnMapping = suggestColumnMapping([]);
      const keys = Object.keys(mapping).sort();
      const canonicalKeys = CANONICAL_FIELDS.map((f) => f.key).sort();
      expect(keys).toEqual(canonicalKeys);
      // Empty headers → all null
      (Object.values(mapping) as (number | null)[]).forEach((v) => expect(v).toBeNull());
    });
  });

  describe("buildControlsFromMapping", () => {
    it("extracts controls from rows using the column mapping", () => {
      const rows = [
        ["AC-01", "Access Control Policy", "Develops a policy", "Access Control", ""],
        ["AC-02", "Account Management", "Manages accounts", "Access Control", "AC-01"],
      ];
      const { controls, errors } = buildControlsFromMapping(rows, FULL_MAPPING);

      expect(errors).toHaveLength(0);
      expect(controls).toEqual([
        {
          controlId: "AC-01",
          title: "Access Control Policy",
          description: "Develops a policy",
          family: "Access Control",
          parentControlId: undefined,
        },
        {
          controlId: "AC-02",
          title: "Account Management",
          description: "Manages accounts",
          family: "Access Control",
          parentControlId: "AC-01",
        },
      ]);
    });

    it("omits optional fields whose columns are unmapped", () => {
      const mapping: ColumnMapping = {
        controlId: 0,
        title: 1,
        description: null,
        family: null,
        parentControlId: null,
      };
      const { controls, errors } = buildControlsFromMapping([["AC-01", "Policy"]], mapping);

      expect(errors).toHaveLength(0);
      expect(controls[0]).toEqual({
        controlId: "AC-01",
        title: "Policy",
        description: undefined,
        family: undefined,
        parentControlId: undefined,
      });
    });

    it("reports a row error when a required control ID cell is blank", () => {
      const rows = [
        ["AC-01", "Policy", "", "", ""],
        ["", "Orphan Title", "", "", ""],
      ];
      const { controls, errors } = buildControlsFromMapping(rows, FULL_MAPPING);

      expect(errors.some((e) => e.row === 2 && /control id/i.test(e.message))).toBe(true);
      // The valid row is still extracted; the caller decides to block on errors
      expect(controls.some((c) => c.controlId === "AC-01")).toBe(true);
    });

    it("reports a row error when a required title cell is blank", () => {
      const rows = [["AC-01", "", "", "", ""]];
      const { errors } = buildControlsFromMapping(rows, FULL_MAPPING);

      expect(errors.some((e) => e.row === 1 && /title/i.test(e.message))).toBe(true);
    });

    it("reports duplicate control IDs within the file, citing the first-seen row", () => {
      const rows = [
        ["AC-01", "First", "", "", ""],
        ["AC-02", "Second", "", "", ""],
        ["AC-01", "Dup", "", "", ""],
      ];
      const { errors } = buildControlsFromMapping(rows, FULL_MAPPING);

      expect(
        errors.some((e) => e.row === 3 && /duplicate/i.test(e.message) && e.message.includes("1")),
      ).toBe(true);
    });

    it("reports a parent reference that is not a control ID present in the file", () => {
      const rows = [
        ["AC-01", "Policy", "", "", "NONEXISTENT"],
        ["AC-02", "Accounts", "", "", "AC-01"],
      ];
      const { errors } = buildControlsFromMapping(rows, FULL_MAPPING);

      expect(errors.some((e) => e.row === 1 && /parent/i.test(e.message))).toBe(true);
      // AC-02's parent AC-01 exists → no error for row 2
      expect(errors.some((e) => e.row === 2)).toBe(false);
    });

    it("reports a control that lists itself as its parent", () => {
      const rows = [["AC-01", "Policy", "", "", "AC-01"]];
      const { errors } = buildControlsFromMapping(rows, FULL_MAPPING);

      expect(errors.some((e) => e.row === 1 && /its own parent/i.test(e.message))).toBe(true);
    });

    it("trims whitespace around cell values", () => {
      const { controls } = buildControlsFromMapping(
        [["  AC-01  ", "  Policy  ", "", "", ""]],
        FULL_MAPPING,
      );
      expect(controls[0]!.controlId).toBe("AC-01");
      expect(controls[0]!.title).toBe("Policy");
    });
  });
});
