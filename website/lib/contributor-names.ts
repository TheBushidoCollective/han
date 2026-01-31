/**
 * Mapping from git author names/emails to display names
 * Add entries here to customize how contributors appear on the site
 */
export const contributorDisplayNames: Record<string, string> = {
	// Map by git username
	jwaldrip: "Jason Waldrip",
	"Jason Waldrip": "Jason Waldrip",

	// Map by email (without the @domain part for privacy)
	jason: "Jason Waldrip",

	// Add more mappings as needed:
	// "github-username": "Full Display Name",
};

/**
 * Get the display name for a contributor
 * Tries to match by name first, then by email prefix
 */
export function getDisplayName(name: string, email?: string): string {
	// Try exact name match
	if (contributorDisplayNames[name]) {
		return contributorDisplayNames[name];
	}

	// Try email prefix match (part before @)
	if (email) {
		const emailPrefix = email.split("@")[0];
		if (contributorDisplayNames[emailPrefix]) {
			return contributorDisplayNames[emailPrefix];
		}
	}

	// Return original name if no mapping found
	return name;
}
