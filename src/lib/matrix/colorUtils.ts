/**
 * Color Utilities for Risk Matrix
 *
 * Story 7.8.6: Matrix Builder UI - Thresholds
 *
 * Shared color utilities used by ThresholdBar and MatrixPreview components.
 */

/**
 * Calculate whether to use light or dark text based on background color brightness.
 * Uses relative luminance formula for accessibility-compliant contrast.
 *
 * @param hexColor - Hex color string (e.g., "#FF5500")
 * @returns "#000000" for dark text on light backgrounds, "#FFFFFF" for light text on dark backgrounds
 */
export function getContrastColor(hexColor: string): string {
  // Default to dark text if color is invalid
  if (!hexColor || !hexColor.startsWith("#") || hexColor.length < 7) {
    return "#000000";
  }

  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);

  // Handle NaN from invalid hex
  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    return "#000000";
  }

  // Calculate relative luminance using sRGB coefficients
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.5 ? "#000000" : "#FFFFFF";
}

/**
 * Validate if a string is a valid hex color.
 *
 * @param color - String to validate
 * @returns true if valid hex color format (#RRGGBB)
 */
export function isValidHexColor(color: string): boolean {
  const hexRegex = /^#[0-9A-Fa-f]{6}$/;
  return hexRegex.test(color);
}
