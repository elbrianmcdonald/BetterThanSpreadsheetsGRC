"use client";

/**
 * Threshold Row Component
 *
 * Story 7.8.6: Matrix Builder UI - Thresholds
 * Story 11.6: Severity Threshold Configuration
 *
 * Individual row in the threshold table (AC3, AC6, AC7, 11.6 AC1-AC5):
 * - AC3: Table view: minValue, maxValue, label, color
 * - AC6: Color picker for each threshold
 * - AC7: Inline editing for label
 * - 11.6 AC1-AC5: SLA days editing with validation
 */

import React, { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Trash2 } from "lucide-react";
import { isValidHexColor, type Threshold } from "@/lib/matrix";

/**
 * Decimal input component with local state to allow typing decimals freely
 */
function DecimalInput({
  value,
  onChange,
  min,
  max,
  disabled,
  className,
}: {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  className?: string;
}) {
  const [localValue, setLocalValue] = useState(String(value));

  // Sync local value when external value changes
  useEffect(() => {
    setLocalValue(String(value));
  }, [value]);

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={localValue}
      onChange={(e) => {
        const val = e.target.value;
        // Allow empty, numbers, decimals, and partial decimal input
        if (val === "" || val === "." || /^-?\d*\.?\d*$/.test(val)) {
          setLocalValue(val);
        }
      }}
      onBlur={() => {
        const parsed = parseFloat(localValue);
        if (isNaN(parsed)) {
          setLocalValue(String(value)); // Reset to previous valid value
        } else {
          // Clamp to min/max if specified
          let clamped = parsed;
          if (min !== undefined && clamped < min) clamped = min;
          if (max !== undefined && clamped > max) clamped = max;
          onChange(clamped);
          setLocalValue(String(clamped));
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        }
      }}
      disabled={disabled}
      className={className}
    />
  );
}

interface ThresholdRowProps {
  threshold: Threshold;
  isFirst: boolean;
  isLast: boolean;
  outputScaleMax: number;
  onChange: (updates: Partial<Threshold>) => void;
  onRemove: () => void;
  canRemove: boolean;
  readOnly?: boolean;
}

export function ThresholdRow({
  threshold,
  isFirst,
  isLast,
  outputScaleMax,
  onChange,
  onRemove,
  canRemove,
  readOnly = false,
}: ThresholdRowProps) {
  const [colorOpen, setColorOpen] = useState(false);
  const [localColor, setLocalColor] = useState(threshold.color);
  const colorInputRef = useRef<HTMLInputElement>(null);

  // Sync local color with prop
  useEffect(() => {
    setLocalColor(threshold.color);
  }, [threshold.color]);

  // Handle color picker (native input type="color" - always valid hex)
  const handleColorPickerChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newColor = e.target.value;
      setLocalColor(newColor);
      onChange({ color: newColor });
    },
    [onChange]
  );

  // Handle text input for color - validate before updating
  const handleColorTextChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newColor = e.target.value;
      setLocalColor(newColor); // Always update local for typing feedback
      // Only propagate valid hex colors to parent
      if (isValidHexColor(newColor)) {
        onChange({ color: newColor });
      }
    },
    [onChange]
  );

  const handleLabelChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ label: e.target.value });
    },
    [onChange]
  );

  // Story 11.6 AC2-AC4: Handle SLA days change
  const handleSlaDaysChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value, 10);
      if (!isNaN(value)) {
        onChange({ slaDays: value });
      }
    },
    [onChange]
  );

  return (
    <TableRow>
      {/* Min Value - AC3, AC9 */}
      <TableCell>
        {readOnly || isFirst ? (
          <span className="font-mono text-sm">{threshold.minValue}</span>
        ) : (
          <DecimalInput
            value={threshold.minValue}
            onChange={(val) => onChange({ minValue: val })}
            min={0}
            max={threshold.maxValue - 0.01}
            className="w-20 font-mono text-sm"
          />
        )}
      </TableCell>

      {/* Max Value - AC3, AC9 */}
      <TableCell>
        {readOnly || isLast ? (
          <span className="font-mono text-sm">
            {isLast ? outputScaleMax : threshold.maxValue}
          </span>
        ) : (
          <DecimalInput
            value={threshold.maxValue}
            onChange={(val) => onChange({ maxValue: val })}
            min={threshold.minValue + 0.01}
            max={outputScaleMax}
            className="w-20 font-mono text-sm"
          />
        )}
      </TableCell>

      {/* Label - AC3, AC7 */}
      <TableCell>
        {readOnly ? (
          <span>{threshold.label || "-"}</span>
        ) : (
          <Input
            value={threshold.label}
            onChange={handleLabelChange}
            placeholder="e.g., Low, Critical"
            maxLength={50}
            className="w-32"
          />
        )}
      </TableCell>

      {/* Color Picker - AC6 */}
      <TableCell>
        {readOnly ? (
          <div
            className="w-8 h-8 rounded border"
            style={{ backgroundColor: threshold.color }}
            title={threshold.color}
          />
        ) : (
          <Popover open={colorOpen} onOpenChange={setColorOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="w-8 h-8 rounded border cursor-pointer hover:ring-2 hover:ring-primary focus:ring-2 focus:ring-primary focus:outline-none"
                style={{ backgroundColor: localColor }}
                title="Click to change color"
                aria-label={`Choose color for ${threshold.label || "threshold"}, current color: ${localColor}`}
              />
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3" align="start">
              <div className="space-y-2">
                <p className="text-sm font-medium">Choose color</p>
                <input
                  ref={colorInputRef}
                  type="color"
                  value={isValidHexColor(localColor) ? localColor : "#888888"}
                  onChange={handleColorPickerChange}
                  className="w-full h-10 cursor-pointer border rounded"
                />
                <Input
                  value={localColor}
                  onChange={handleColorTextChange}
                  placeholder="#000000"
                  maxLength={7}
                  className={`font-mono text-sm ${!isValidHexColor(localColor) ? "border-destructive" : ""}`}
                />
                {!isValidHexColor(localColor) && (
                  <p className="text-xs text-destructive">Enter valid hex (e.g., #FF5500)</p>
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </TableCell>

      {/* SLA Days - Story 11.6 AC1-AC5 */}
      <TableCell>
        {readOnly ? (
          <span className="font-mono text-sm">{threshold.slaDays ?? 30} days</span>
        ) : (
          <Input
            type="number"
            value={threshold.slaDays ?? 30}
            onChange={handleSlaDaysChange}
            min={1}
            max={365}
            step={1}
            className="w-20 font-mono text-sm"
            placeholder="Days"
          />
        )}
      </TableCell>

      {/* Delete Button - AC5 */}
      {!readOnly && (
        <TableCell>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            disabled={!canRemove}
            className="text-muted-foreground hover:text-destructive"
            title={canRemove ? "Remove threshold" : "Minimum 2 thresholds required"}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </TableCell>
      )}
    </TableRow>
  );
}
