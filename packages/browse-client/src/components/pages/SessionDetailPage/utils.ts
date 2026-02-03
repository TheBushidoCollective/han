/**
 * Utility functions for session detail components
 */

/**
 * Format a date for display
 */
export function formatDate(dateStr: string | null): string {
	if (!dateStr) return "-";
	const date = new Date(dateStr);
	return date.toLocaleString();
}

/**
 * Format a date as relative time (e.g., "2 minutes ago", "1 hour ago")
 */
export function formatRelativeTime(dateStr: string | null): string {
	if (!dateStr) return "-";

	const date = new Date(dateStr);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();

	// Handle future dates
	if (diffMs < 0) return "just now";

	const seconds = Math.floor(diffMs / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (seconds < 10) return "just now";
	if (seconds < 60) return `${seconds}s ago`;
	if (minutes < 60) return `${minutes}m ago`;
	if (hours < 24) return `${hours}h ago`;
	if (days < 7) return `${days}d ago`;

	// Fall back to date for older entries
	return date.toLocaleDateString();
}

/**
 * Format time duration between two dates
 */
export function formatDuration(
	startedAt: string | null,
	updatedAt: string | null,
): string {
	if (!startedAt || !updatedAt) return "-";

	const start = new Date(startedAt);
	const end = new Date(updatedAt);
	const diffMs = end.getTime() - start.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);

	if (diffMins < 1) return "< 1m";
	if (diffMins < 60) return `${diffMins}m`;
	if (diffHours < 24) return `${diffHours}h ${diffMins % 60}m`;
	return `${Math.floor(diffHours / 24)}d ${diffHours % 24}h`;
}

/**
 * Format task duration in seconds
 */
export function formatTaskDuration(seconds: number | null): string {
	if (seconds === null) return "-";
	if (seconds < 60) return `${seconds}s`;
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;
	if (mins < 60) return `${mins}m ${secs}s`;
	const hours = Math.floor(mins / 60);
	return `${hours}h ${mins % 60}m`;
}

/**
 * Format milliseconds as human-readable duration
 */
export function formatMs(ms: number): string {
	if (ms < 1000) return `${ms}ms`;

	const seconds = Math.floor(ms / 1000);
	if (seconds < 60) return `${seconds}s`;

	const minutes = Math.floor(seconds / 60);
	const remainingSecs = seconds % 60;
	if (minutes < 60) {
		return remainingSecs > 0 ? `${minutes}m ${remainingSecs}s` : `${minutes}m`;
	}

	const hours = Math.floor(minutes / 60);
	const remainingMins = minutes % 60;
	if (hours < 24) {
		return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
	}

	const days = Math.floor(hours / 24);
	const remainingHours = hours % 24;
	return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}
