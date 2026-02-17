/**
 * @jest-environment jsdom
 *
 * Scale Editor Component Tests
 *
 * Story 7.8.5: Matrix Builder UI - Scales
 *
 * Tests for ScaleEditor component (AC6-AC12):
 * - 6.1: Component test: add/remove levels
 * - 6.2: Component test: validation errors display
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ScaleEditor } from "@/components/matrix/ScaleEditor";
import type { ScaleLevel } from "@/lib/matrix";

// Mock the validation hook
jest.mock("@/hooks/useScaleValidation", () => ({
  useScaleValidation: (levels: ScaleLevel[]) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const levelErrors = new Map<number, string>();

    if (levels.length < 3) {
      errors.push(`At least 3 levels are required (currently ${levels.length})`);
    }

    // Check for duplicates
    const values = levels.map((l) => l.value);
    const uniqueValues = new Set(values);
    if (uniqueValues.size !== values.length) {
      errors.push("Duplicate values found");
    }

    // Check for non-positive
    const nonPositive = levels.filter((l) => l.value <= 0);
    if (nonPositive.length > 0) {
      errors.push("Non-positive values found");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      levelErrors,
    };
  },
}));

describe("ScaleEditor Component", () => {
  const defaultLevels: ScaleLevel[] = [
    { value: 1, label: "Low", description: "Minimal" },
    { value: 2, label: "Medium", description: "Moderate" },
    { value: 3, label: "High", description: "Significant" },
  ];

  describe("Rendering", () => {
    it("should render the scale name", () => {
      render(
        <ScaleEditor
          name="Likelihood"
          levels={defaultLevels}
          onChange={() => {}}
        />
      );

      expect(screen.getByText("Likelihood Scale")).toBeInTheDocument();
    });

    it("should render all level rows", () => {
      render(
        <ScaleEditor
          name="Impact"
          levels={defaultLevels}
          onChange={() => {}}
        />
      );

      expect(screen.getByDisplayValue("Low")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Medium")).toBeInTheDocument();
      expect(screen.getByDisplayValue("High")).toBeInTheDocument();
    });

    it("should show level count", () => {
      render(
        <ScaleEditor
          name="Test"
          levels={defaultLevels}
          onChange={() => {}}
        />
      );

      expect(screen.getByText("3 / 10 levels (minimum 3)")).toBeInTheDocument();
    });

    it("should render in read-only mode", () => {
      render(
        <ScaleEditor
          name="Test"
          levels={defaultLevels}
          onChange={() => {}}
          readOnly
        />
      );

      // In read-only mode, there should be no Add Level button
      expect(screen.queryByText("Add Level")).not.toBeInTheDocument();

      // Values should be displayed as text, not inputs
      expect(screen.getByText("Low")).toBeInTheDocument();
      expect(screen.getByText("Medium")).toBeInTheDocument();
      expect(screen.getByText("High")).toBeInTheDocument();
    });
  });

  describe("6.1: Add/Remove Levels (AC8, AC11)", () => {
    it("should add a new level when Add Level is clicked", () => {
      const onChange = jest.fn();

      render(
        <ScaleEditor
          name="Test"
          levels={defaultLevels}
          onChange={onChange}
        />
      );

      const addButton = screen.getByRole("button", { name: /add level/i });
      fireEvent.click(addButton);

      expect(onChange).toHaveBeenCalledWith([
        ...defaultLevels,
        expect.objectContaining({ value: 4, label: "", description: "" }),
      ]);
    });

    it("should disable Add Level button at max (10) levels", () => {
      const tenLevels: ScaleLevel[] = Array.from({ length: 10 }, (_, i) => ({
        value: i + 1,
        label: `Level ${i + 1}`,
        description: "",
      }));

      render(
        <ScaleEditor
          name="Test"
          levels={tenLevels}
          onChange={() => {}}
        />
      );

      const addButton = screen.getByRole("button", { name: /add level/i });
      expect(addButton).toBeDisabled();
    });

    it("should remove a level when delete is clicked", () => {
      const onChange = jest.fn();

      const fourLevels: ScaleLevel[] = [
        { value: 1, label: "Low", description: "" },
        { value: 2, label: "Medium", description: "" },
        { value: 3, label: "High", description: "" },
        { value: 4, label: "Critical", description: "" },
      ];

      render(
        <ScaleEditor
          name="Test"
          levels={fourLevels}
          onChange={onChange}
        />
      );

      // Find all delete buttons by looking for buttons with trash icon
      const allButtons = screen.getAllByRole("button");
      const deleteButtons = allButtons.filter(
        (btn) => btn.querySelector("svg.lucide-trash-2")
      );

      expect(deleteButtons.length).toBe(4);

      // Click the first delete button
      fireEvent.click(deleteButtons[0]!);

      expect(onChange).toHaveBeenCalled();
      const newLevels = onChange.mock.calls[0]![0] as ScaleLevel[];
      expect(newLevels.length).toBe(3);
    });

    it("should disable delete buttons at minimum (3) levels", () => {
      render(
        <ScaleEditor
          name="Test"
          levels={defaultLevels}
          onChange={() => {}}
        />
      );

      // Find all delete buttons
      const allButtons = screen.getAllByRole("button");
      const deleteButtons = allButtons.filter(
        (btn) => btn.querySelector("svg.lucide-trash-2")
      );

      deleteButtons.forEach((btn) => {
        expect(btn).toBeDisabled();
      });
    });
  });

  describe("Inline Editing (AC9, AC10)", () => {
    it("should update label on input change", () => {
      const onChange = jest.fn();

      render(
        <ScaleEditor
          name="Test"
          levels={defaultLevels}
          onChange={onChange}
        />
      );

      const labelInput = screen.getByDisplayValue("Low");
      fireEvent.change(labelInput, { target: { value: "Very Low" } });

      expect(onChange).toHaveBeenCalled();
    });

    it("should update value on input change", () => {
      const onChange = jest.fn();

      render(
        <ScaleEditor
          name="Test"
          levels={defaultLevels}
          onChange={onChange}
        />
      );

      // Find the first value input (should have value 1)
      const valueInputs = screen.getAllByRole("spinbutton");
      const firstValueInput = valueInputs[0]!;

      fireEvent.change(firstValueInput, { target: { value: "1.5" } });

      expect(onChange).toHaveBeenCalled();
    });

    it("should update description on input change", () => {
      const onChange = jest.fn();

      render(
        <ScaleEditor
          name="Test"
          levels={defaultLevels}
          onChange={onChange}
        />
      );

      const descInput = screen.getByDisplayValue("Minimal");
      fireEvent.change(descInput, { target: { value: "Very minimal impact" } });

      expect(onChange).toHaveBeenCalled();
    });
  });

  describe("6.2: Validation Errors Display (AC13-AC17)", () => {
    it("should display error when fewer than 3 levels", () => {
      const twoLevels: ScaleLevel[] = [
        { value: 1, label: "Low", description: "" },
        { value: 2, label: "High", description: "" },
      ];

      render(
        <ScaleEditor
          name="Test"
          levels={twoLevels}
          onChange={() => {}}
        />
      );

      expect(screen.getByText(/at least 3 levels are required/i)).toBeInTheDocument();
    });

    it("should display error for duplicate values", () => {
      const duplicateLevels: ScaleLevel[] = [
        { value: 1, label: "Low", description: "" },
        { value: 1, label: "Also Low", description: "" },
        { value: 2, label: "High", description: "" },
      ];

      render(
        <ScaleEditor
          name="Test"
          levels={duplicateLevels}
          onChange={() => {}}
        />
      );

      expect(screen.getByText(/duplicate values found/i)).toBeInTheDocument();
    });

    it("should display error for non-positive values", () => {
      const nonPositiveLevels: ScaleLevel[] = [
        { value: 0, label: "Zero", description: "" },
        { value: 1, label: "Low", description: "" },
        { value: 2, label: "High", description: "" },
      ];

      render(
        <ScaleEditor
          name="Test"
          levels={nonPositiveLevels}
          onChange={() => {}}
        />
      );

      expect(screen.getByText(/non-positive values found/i)).toBeInTheDocument();
    });

    it("should not display errors for valid scale", () => {
      render(
        <ScaleEditor
          name="Test"
          levels={defaultLevels}
          onChange={() => {}}
        />
      );

      // Should not have any error alerts
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  describe("Apply Template (AC21-AC23)", () => {
    it("should show template dropdown", () => {
      render(
        <ScaleEditor
          name="Test"
          levels={defaultLevels}
          onChange={() => {}}
        />
      );

      expect(screen.getByRole("button", { name: /apply template/i })).toBeInTheDocument();
    });

    it("should not show template dropdown in read-only mode", () => {
      render(
        <ScaleEditor
          name="Test"
          levels={defaultLevels}
          onChange={() => {}}
          readOnly
        />
      );

      expect(screen.queryByRole("button", { name: /apply template/i })).not.toBeInTheDocument();
    });
  });

  describe("Empty State", () => {
    it("should show empty state message when no levels", () => {
      render(
        <ScaleEditor
          name="Test"
          levels={[]}
          onChange={() => {}}
        />
      );

      expect(
        screen.getByText(/no levels defined/i)
      ).toBeInTheDocument();
    });
  });

  describe("Drag and Drop Reordering (AC12)", () => {
    it("should have draggable rows in edit mode", () => {
      render(
        <ScaleEditor
          name="Test"
          levels={defaultLevels}
          onChange={() => {}}
        />
      );

      // Get table rows (excluding header)
      const rows = screen.getAllByRole("row").slice(1); // Skip header row

      // Each row should be draggable
      rows.forEach((row) => {
        expect(row).toHaveAttribute("draggable", "true");
      });
    });

    it("should not have draggable rows in read-only mode", () => {
      render(
        <ScaleEditor
          name="Test"
          levels={defaultLevels}
          onChange={() => {}}
          readOnly
        />
      );

      // Get table rows (excluding header)
      const rows = screen.getAllByRole("row").slice(1);

      // Rows should not be draggable
      rows.forEach((row) => {
        expect(row).toHaveAttribute("draggable", "false");
      });
    });

    it("should swap values when drag and drop completes", () => {
      const onChange = jest.fn();

      const fourLevels: ScaleLevel[] = [
        { value: 1, label: "Low", description: "" },
        { value: 2, label: "Medium", description: "" },
        { value: 3, label: "High", description: "" },
        { value: 4, label: "Critical", description: "" },
      ];

      render(
        <ScaleEditor
          name="Test"
          levels={fourLevels}
          onChange={onChange}
        />
      );

      // Get table rows (excluding header)
      const rows = screen.getAllByRole("row").slice(1);

      // Simulate drag from row 0 to row 2
      fireEvent.dragStart(rows[0]!, { dataTransfer: { effectAllowed: "move", setData: jest.fn() } });
      fireEvent.dragOver(rows[2]!, { preventDefault: jest.fn(), dataTransfer: { dropEffect: "move" } });
      fireEvent.drop(rows[2]!, { preventDefault: jest.fn() });
      fireEvent.dragEnd(rows[0]!);

      // onChange should be called with swapped values
      expect(onChange).toHaveBeenCalled();
      const newLevels = onChange.mock.calls[0]![0] as ScaleLevel[];

      // After swapping index 0 and index 2, values should be swapped
      // Original: [1,2,3,4] -> After swapping positions 0 and 2: values swap
      const lowLevel = newLevels.find((l) => l.label === "Low");
      const highLevel = newLevels.find((l) => l.label === "High");

      // Low should now have value 3, High should have value 1
      expect(lowLevel?.value).toBe(3);
      expect(highLevel?.value).toBe(1);
    });

    it("should not swap when dragging to same position", () => {
      const onChange = jest.fn();

      render(
        <ScaleEditor
          name="Test"
          levels={defaultLevels}
          onChange={onChange}
        />
      );

      const rows = screen.getAllByRole("row").slice(1);

      // Drag and drop to same position
      fireEvent.dragStart(rows[0]!, { dataTransfer: { effectAllowed: "move", setData: jest.fn() } });
      fireEvent.dragOver(rows[0]!, { preventDefault: jest.fn(), dataTransfer: { dropEffect: "move" } });
      fireEvent.drop(rows[0]!, { preventDefault: jest.fn() });
      fireEvent.dragEnd(rows[0]!);

      // onChange should NOT be called when dropping at same position
      expect(onChange).not.toHaveBeenCalled();
    });

    it("should show drag handle icons", () => {
      render(
        <ScaleEditor
          name="Test"
          levels={defaultLevels}
          onChange={() => {}}
        />
      );

      // Should have grip icons for dragging
      const gripIcons = document.querySelectorAll("svg.lucide-grip-vertical");
      expect(gripIcons.length).toBe(defaultLevels.length);
    });

    it("should not show drag handles in read-only mode", () => {
      render(
        <ScaleEditor
          name="Test"
          levels={defaultLevels}
          onChange={() => {}}
          readOnly
        />
      );

      // Should NOT have grip icons in read-only mode
      const gripIcons = document.querySelectorAll("svg.lucide-grip-vertical");
      expect(gripIcons.length).toBe(0);
    });
  });
});
