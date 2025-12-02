/**
 * Category icon mapping - shared constants that can be used in both
 * server and client components
 */
export function getCategoryIcon(
	category: "bushido" | "jutsu" | "do" | "hashi",
): string {
	switch (category) {
		case "bushido":
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
