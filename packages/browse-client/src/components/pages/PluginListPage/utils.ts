/**
 * Plugins Page Utilities
 *
 * Helper functions for plugin display formatting.
 */

/**
 * Get badge variant for plugin category
 */
export function getCategoryBadgeVariant(
	category: string,
): "default" | "success" | "warning" | "danger" | "purple" {
	switch (category) {
		case "jutsu":
			return "default";
		case "do":
			return "purple";
		case "hashi":
			return "success";
		case "core":
			return "warning";
		default:
			return "default";
	}
}

/**
 * Get badge variant for plugin scope
 */
export function getScopeBadgeVariant(
	scope: string,
): "default" | "success" | "warning" | "danger" | "purple" {
	switch (scope) {
		case "USER":
			return "default";
		case "PROJECT":
			return "success";
		case "LOCAL":
			return "warning";
		default:
			return "default";
	}
}

/**
 * Format scope for display
 */
export function formatScope(scope: string): string {
	switch (scope) {
		case "USER":
			return "User";
		case "PROJECT":
			return "Project";
		case "LOCAL":
			return "Local";
		default:
			return scope;
	}
}
