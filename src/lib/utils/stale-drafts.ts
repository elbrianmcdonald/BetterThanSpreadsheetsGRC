/**
 * Stale Draft Utility Functions
 *
 * Story 7.13: Stale Draft Dashboard Widget (AC3, AC20)
 *
 * Utilities for calculating days stale and determining severity colors.
 */

/**
 * Calculate the number of days since a date
 *
 * AC3: Age calculated from updatedAt timestamp
 */
export function calculateDaysStale(updatedAt: Date | string): number {
  const now = new Date();
  const updated = typeof updatedAt === "string" ? new Date(updatedAt) : updatedAt;
  const diffTime = now.getTime() - updated.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Get the color class for days stale indicator
 *
 * AC20: Days stale shown with visual indicator
 * - 7-13 days: yellow/orange (warning)
 * - 14+ days: red (critical)
 * - <7 days: gray (normal, though shouldn't show in widget)
 */
export function getDaysStaleColor(days: number): string {
  if (days >= 14) return "text-red-600";
  if (days >= 7) return "text-amber-600";
  return "text-gray-600";
}

/**
 * Get background color class for days stale badge
 */
export function getDaysStaleBgColor(days: number): string {
  if (days >= 14) return "bg-red-100 text-red-800 border-red-200";
  if (days >= 7) return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-gray-100 text-gray-800 border-gray-200";
}

/**
 * Format days stale as a human-readable string
 */
export function formatDaysStale(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "1 day";
  return `${days} days`;
}
