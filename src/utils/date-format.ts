/**
 * Date Formatting Utilities
 *
 * Shared date formatting functions for consistent date display across the application.
 */

/**
 * Format a date for display in a user-friendly format.
 *
 * @param date - Date object or ISO string to format
 * @returns Formatted date string (e.g., "Dec 20, 2025")
 */
export function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format a date with time for display.
 *
 * @param date - Date object or ISO string to format
 * @returns Formatted date-time string (e.g., "Dec 20, 2025, 2:30 PM")
 */
export function formatDateTime(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Format a date as relative time (e.g., "2 days ago").
 *
 * @param date - Date object or ISO string to format
 * @returns Relative time string
 */
export function formatRelativeTime(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      if (diffMins === 0) return "Just now";
      return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;
    }
    return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
  }

  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks !== 1 ? "s" : ""} ago`;
  }

  return formatDate(date);
}
