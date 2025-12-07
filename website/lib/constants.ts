/**
 * Category icon mapping - shared constants that can be used in both
 * server and client components
 */
export function getCategoryIcon(
	category: "core" | "jutsu" | "do" | "hashi",
): string {
	switch (category) {
		case "core":
			return "⛩️";
		case "jutsu":
			return "🎯";
		case "do":
			return "🛤️";
		case "hashi":
			return "🌉";
		default:
			return "📦";
	}
}
