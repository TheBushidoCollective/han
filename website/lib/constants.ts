/**
 * Category icon mapping - shared constants that can be used in both
 * server and client components
 */
export function getCategoryIcon(
  category: "bushido" | "buki" | "do" | "sensei",
): string {
  switch (category) {
    case "bushido":
      return "⛩️";
    case "buki":
      return "⚔️";
    case "do":
      return "🛤️";
    case "sensei":
      return "🏮";
    default:
      return "📦";
  }
}
