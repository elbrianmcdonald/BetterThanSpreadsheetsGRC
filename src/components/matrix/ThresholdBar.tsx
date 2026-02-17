"use client";

/**
 * Threshold Bar Component
 *
 * Story 7.8.6: Matrix Builder UI - Thresholds
 * Story 11.6: Severity Threshold Configuration
 *
 * Visual representation of threshold ranges (AC2, AC15-AC19, 11.6 AC14):
 * - AC2: Visual representation of threshold ranges on a color bar
 * - AC15: Color bar shows threshold distribution proportionally
 * - AC16: Hover shows threshold label and range via Tooltip
 * - AC17: Validation errors highlighted inline
 * - AC18: Real-time update as boundaries change
 * - AC19: Proportional width based on range size
 * - 11.6 AC14: Tooltip shows SLA days
 *
 * With drag handles for AC8-AC10:
 * - AC8: Drag handles to adjust threshold boundaries visually
 * - AC9: Manual input for precise boundary values
 * - AC10: Boundaries snap to 0.5 increments
 */

import React, { useRef, useCallback, useEffect } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getContrastColor, type Threshold } from "@/lib/matrix";

interface ThresholdBarProps {
  thresholds: Threshold[];
  outputScaleMax: number;
  onBoundaryDrag: (index: number, newValue: number) => void;
  readOnly?: boolean;
}

export function ThresholdBar({
  thresholds,
  outputScaleMax,
  onBoundaryDrag,
  readOnly = false,
}: ThresholdBarProps) {
  // Sort thresholds by sortOrder for display
  const sorted = [...thresholds].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="relative h-12 rounded-lg overflow-hidden flex shadow-sm border">
        {sorted.map((threshold, index) => {
          // Calculate proportional width (AC15, AC19)
          const range = threshold.maxValue - threshold.minValue;
          const width = (range / outputScaleMax) * 100;

          // Determine text color based on background brightness
          const textColor = getContrastColor(threshold.color);

          return (
            <Tooltip key={index}>
              <TooltipTrigger asChild>
                <div
                  className="h-full flex items-center justify-center text-sm font-medium relative transition-all"
                  style={{
                    width: `${Math.max(width, 3)}%`, // Min 3% for very small ranges
                    backgroundColor: threshold.color,
                    color: textColor,
                  }}
                >
                  {/* Show label if enough space */}
                  {width > 15 && (
                    <span className="truncate px-1">{threshold.label}</span>
                  )}

                  {/* Drag handle between segments (AC8) */}
                  {!readOnly && index < sorted.length - 1 && (
                    <DragHandle
                      index={index}
                      threshold={threshold}
                      nextThreshold={sorted[index + 1]!}
                      outputScaleMax={outputScaleMax}
                      onDrag={onBoundaryDrag}
                    />
                  )}
                </div>
              </TooltipTrigger>
              {/* AC16: Hover tooltip, 11.6 AC14: Include SLA days */}
              <TooltipContent side="bottom" className="font-medium">
                <p className="font-semibold">{threshold.label}</p>
                <p className="text-xs text-muted-foreground">
                  Range: {threshold.minValue.toFixed(1)} - {threshold.maxValue.toFixed(1)}
                </p>
                <p className="text-xs text-muted-foreground">
                  SLA: {threshold.slaDays ?? 30} days
                </p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

/**
 * Drag Handle Component
 *
 * AC8: Drag handles to adjust threshold boundaries visually
 * AC10: Boundaries snap to 0.5 increments
 */
interface DragHandleProps {
  index: number;
  threshold: Threshold;
  nextThreshold: Threshold;
  outputScaleMax: number;
  onDrag: (index: number, newValue: number) => void;
}

function DragHandle({
  index,
  threshold,
  nextThreshold,
  outputScaleMax,
  onDrag,
}: DragHandleProps) {
  const handleRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startValueRef = useRef(0);
  const containerWidthRef = useRef(0);
  // Cleanup ref to prevent memory leaks on unmount during drag
  const cleanupRef = useRef<(() => void) | null>(null);

  // Cleanup event listeners on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      startXRef.current = e.clientX;
      startValueRef.current = threshold.maxValue;

      // Find the parent bar container for width calculation
      const bar = handleRef.current?.closest(".flex.h-12");
      containerWidthRef.current = bar?.clientWidth ?? 1;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startXRef.current;
        const deltaValue = (deltaX / containerWidthRef.current) * outputScaleMax;
        let newValue = startValueRef.current + deltaValue;

        // Clamp to valid range (min 0.5 between thresholds)
        const minAllowed = threshold.minValue + 0.5;
        const maxAllowed = nextThreshold.maxValue - 0.5;
        newValue = Math.max(minAllowed, Math.min(maxAllowed, newValue));

        // AC10: Snap to 0.5 increments
        newValue = Math.round(newValue * 2) / 2;

        onDrag(index, newValue);
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        cleanupRef.current = null;
      };

      // Store cleanup function in case component unmounts during drag
      cleanupRef.current = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [index, threshold, nextThreshold, outputScaleMax, onDrag]
  );

  return (
    <div
      ref={handleRef}
      className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize bg-black/20 hover:bg-black/40 hover:w-3 transition-all z-10"
      onMouseDown={handleMouseDown}
      title="Drag to adjust boundary"
    />
  );
}

