import { execSync } from "node:child_process";
import path from "node:path";
import { getDisplayName } from "./contributor-names";

export interface Contributor {
	name: string;
	email: string;
	commits: number;
}

/**
 * Get all contributors for a file from git history, sorted by number of commits (descending)
 */
export function getFileContributors(filePath: string): Contributor[] {
	try {
		// Get the absolute path relative to the git root
		const absolutePath = path.isAbsolute(filePath)
			? filePath
			: path.join(process.cwd(), filePath);

		// Use git shortlog to get contributors with commit counts
		// -s: summary (commit counts only)
		// -n: sort by number of commits (descending)
		// -e: show email addresses
		const result = execSync(`git shortlog -sne --all -- "${absolutePath}"`, {
			encoding: "utf-8",
			cwd: process.cwd(),
			stdio: ["pipe", "pipe", "pipe"],
		});

		if (!result.trim()) {
			return [];
		}

		// Parse the output: "   123\tName <email>"
		const contributors: Contributor[] = result
			.trim()
			.split("\n")
			.map((line) => {
				const match = line.match(/^\s*(\d+)\t(.+?)\s*<(.+?)>\s*$/);
				if (match) {
					return {
						commits: parseInt(match[1], 10),
						name: match[2].trim(),
						email: match[3].trim(),
					};
				}
				// Fallback for lines without email
				const simpleMatch = line.match(/^\s*(\d+)\t(.+)$/);
				if (simpleMatch) {
					return {
						commits: parseInt(simpleMatch[1], 10),
						name: simpleMatch[2].trim(),
						email: "",
					};
				}
				return null;
			})
			.filter((c): c is Contributor => c !== null);

		return contributors;
	} catch (error) {
		// Return empty array if git command fails (e.g., not in a git repo)
		console.error(`Error getting contributors for ${filePath}:`, error);
		return [];
	}
}

/**
 * Get contributor display names for a file, sorted by number of commits
 * Maps git usernames to full display names using contributor-names.ts
 */
export function getFileContributorNames(filePath: string): string[] {
	return getFileContributors(filePath).map((c) =>
		getDisplayName(c.name, c.email),
	);
}

/**
 * Format contributors as a display string
 * Example: "Alice (5), Bob (3), Charlie (1)"
 */
export function formatContributorsWithCounts(
	contributors: Contributor[],
): string {
	return contributors.map((c) => `${c.name} (${c.commits})`).join(", ");
}

/**
 * Format contributors as a simple list
 * Example: "Alice, Bob, Charlie"
 */
export function formatContributorNames(contributors: Contributor[]): string {
	return contributors.map((c) => c.name).join(", ");
}
