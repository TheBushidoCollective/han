/**
 * Session display utilities
 *
 * Shared formatters for session rows across dashboard cards.
 */

/**
 * Format a date string as a relative date for display.
 * Returns "Today", "Yesterday", "Xd ago", or "Mon DD".
 */
export function formatRelativeDate(dateStr: string | null): string {
	if (!dateStr) return "";
	const d = new Date(dateStr);
	const now = new Date();
	const diffMs = now.getTime() - d.getTime();
	const diffDays = Math.floor(diffMs / 86400000);

	if (diffDays === 0) return "Today";
	if (diffDays === 1) return "Yesterday";
	if (diffDays < 7) return `${diffDays}d ago`;
	return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Format a USD cost value for compact display.
 */
export function formatCost(usd: number): string {
	if (usd < 0.01) return "< $0.01";
	if (usd < 100) return `$${usd.toFixed(2)}`;
	return `$${usd.toFixed(0)}`;
}

/**
 * Format a token count compactly (e.g., 1.2M, 450K).
 */
export function formatTokens(count: number): string {
	if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
	if (count >= 1_000) return `${(count / 1_000).toFixed(0)}K`;
	return `${count}`;
}

/**
 * Get foreground color for a score badge (0-100 scale).
 */
export function getScoreColor(score: number): string {
	if (score > 70) return "#10b981";
	if (score >= 40) return "#f59e0b";
	return "#ef4444";
}

/**
 * Get translucent background color for a score badge.
 */
export function getScoreBgColor(score: number): string {
	if (score > 70) return "rgba(16, 185, 129, 0.15)";
	if (score >= 40) return "rgba(245, 158, 11, 0.15)";
	return "rgba(239, 68, 68, 0.15)";
}
