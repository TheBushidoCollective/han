import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import yaml from "js-yaml";

const RUNBOOKS_BASE_DIR = path.join(process.cwd(), "content", "papers");

export interface RunbookGroup {
	id: string;
	name: string;
	icon: string;
	description: string;
	runbooks: string[];
}

export interface RunbooksConfig {
	groups: RunbookGroup[];
}

export interface Runbook {
	slug: string;
	paperSlug: string;
	phase: string;
	title: string;
	description: string;
	content: string;
}

export interface RunbookMetadata {
	slug: string;
	paperSlug: string;
	phase: string;
	title: string;
	description: string;
}

/**
 * Load runbooks config from runbooks.yml
 */
function loadRunbooksConfig(paperSlug: string): RunbooksConfig | null {
	try {
		const configPath = path.join(
			RUNBOOKS_BASE_DIR,
			paperSlug,
			"runbooks",
			"runbooks.yml",
		);
		if (!fs.existsSync(configPath)) {
			return null;
		}
		const content = fs.readFileSync(configPath, "utf-8");
		return yaml.load(content) as RunbooksConfig;
	} catch {
		return null;
	}
}

/**
 * Get all runbooks for a specific paper, ordered by config
 */
export function getRunbooksForPaper(paperSlug: string): RunbookMetadata[] {
	try {
		const runbooksDir = path.join(RUNBOOKS_BASE_DIR, paperSlug, "runbooks");

		if (!fs.existsSync(runbooksDir)) {
			return [];
		}

		const config = loadRunbooksConfig(paperSlug);

		// Build a map of all available runbooks
		const runbookMap = new Map<string, RunbookMetadata>();
		const categories = fs
			.readdirSync(runbooksDir)
			.filter(
				(item) =>
					fs.statSync(path.join(runbooksDir, item)).isDirectory() &&
					item !== "." &&
					item !== "..",
			);

		for (const category of categories) {
			const categoryDir = path.join(runbooksDir, category);
			const files = fs
				.readdirSync(categoryDir)
				.filter((file) => file.endsWith(".md"));

			for (const file of files) {
				const slug = file.replace(/\.md$/, "");
				const filePath = path.join(categoryDir, file);
				const fileContent = fs.readFileSync(filePath, "utf-8");
				const { data, content } = matter(fileContent);

				// Extract title from frontmatter or first H1
				let title = data.title || "";
				if (!title) {
					const h1Match = content.match(/^#\s+(.+)$/m);
					title = h1Match ? h1Match[1] : slug;
				}

				// Extract description from frontmatter or first blockquote
				let description = data.description || "";
				if (!description) {
					const blockquoteMatch = content.match(/^>\s*\*\*(.+?)\*\*/m);
					if (blockquoteMatch) {
						description = blockquoteMatch[1];
					} else {
						const simpleBlockquote = content.match(/^>\s+(.+)$/m);
						description = simpleBlockquote ? simpleBlockquote[1] : "";
					}
				}

				runbookMap.set(slug, {
					slug,
					paperSlug,
					phase: category,
					title,
					description,
				});
			}
		}

		// If config exists, use it for ordering
		if (config?.groups) {
			const orderedRunbooks: RunbookMetadata[] = [];
			for (const group of config.groups) {
				for (const runbookSlug of group.runbooks) {
					const runbook = runbookMap.get(runbookSlug);
					if (runbook) {
						// Ensure phase matches the group id from config
						runbook.phase = group.id;
						orderedRunbooks.push(runbook);
						runbookMap.delete(runbookSlug);
					}
				}
			}
			// Add any remaining runbooks not in config (alphabetically)
			const remaining = Array.from(runbookMap.values()).sort((a, b) =>
				a.title.localeCompare(b.title),
			);
			return [...orderedRunbooks, ...remaining];
		}

		// Fallback: sort alphabetically by category, then by title
		return Array.from(runbookMap.values()).sort((a, b) => {
			if (a.phase !== b.phase) return a.phase.localeCompare(b.phase);
			return a.title.localeCompare(b.title);
		});
	} catch (error) {
		console.error(`Error reading runbooks for ${paperSlug}:`, error);
		return [];
	}
}

/**
 * Get runbook groups with metadata, ordered by config
 */
export function getRunbookGroups(paperSlug: string): RunbookGroup[] {
	const config = loadRunbooksConfig(paperSlug);
	if (config?.groups) {
		return config.groups;
	}
	// Fallback: create groups from discovered categories
	const runbooks = getRunbooksForPaper(paperSlug);
	const categories = [...new Set(runbooks.map((r) => r.phase))].sort();
	return categories.map((id) => ({
		id,
		name: formatPhaseName(id),
		icon: getPhaseIcon(id),
		description: "",
		runbooks: runbooks.filter((r) => r.phase === id).map((r) => r.slug),
	}));
}

/**
 * Get unique categories/phases from runbooks (ordered by config)
 */
export function getRunbookCategories(paperSlug: string): string[] {
	const groups = getRunbookGroups(paperSlug);
	return groups.map((g) => g.id);
}

/**
 * Get a single runbook by paper slug and runbook slug
 */
export function getRunbook(
	paperSlug: string,
	runbookSlug: string,
): Runbook | null {
	try {
		const runbooksDir = path.join(RUNBOOKS_BASE_DIR, paperSlug, "runbooks");

		if (!fs.existsSync(runbooksDir)) {
			return null;
		}

		// Search all phases for the runbook
		const phases = fs
			.readdirSync(runbooksDir)
			.filter(
				(item) =>
					fs.statSync(path.join(runbooksDir, item)).isDirectory() &&
					item !== "." &&
					item !== "..",
			);

		for (const phase of phases) {
			const filePath = path.join(runbooksDir, phase, `${runbookSlug}.md`);

			if (fs.existsSync(filePath)) {
				const fileContent = fs.readFileSync(filePath, "utf-8");
				const { data, content } = matter(fileContent);

				// Extract title from frontmatter or first H1
				let title = data.title || "";
				let processedContent = content;

				if (!title) {
					const lines = content.split("\n");
					for (let i = 0; i < lines.length; i++) {
						const line = lines[i];
						if (line.startsWith("# ")) {
							title = line.replace(/^#\s+/, "");
							// Remove the H1 from content since we display it separately
							processedContent = lines
								.slice(i + 1)
								.join("\n")
								.trimStart();
							break;
						}
					}
				}

				// Extract description from frontmatter or first blockquote
				let description = data.description || "";
				if (!description) {
					const blockquoteMatch = processedContent.match(/^>\s*\*\*(.+?)\*\*/m);
					if (blockquoteMatch) {
						description = blockquoteMatch[1];
					} else {
						const simpleBlockquote = processedContent.match(/^>\s+(.+)$/m);
						description = simpleBlockquote ? simpleBlockquote[1] : "";
					}
				}

				return {
					slug: runbookSlug,
					paperSlug,
					phase,
					title: title || runbookSlug,
					description,
					content: processedContent,
				};
			}
		}

		return null;
	} catch (error) {
		console.error(`Error reading runbook ${runbookSlug}:`, error);
		return null;
	}
}

/**
 * Get all runbook slugs for static generation
 */
export function getAllRunbookSlugs(
	paperSlug: string,
): Array<{ runbook: string }> {
	const runbooks = getRunbooksForPaper(paperSlug);
	return runbooks.map((r) => ({ runbook: r.slug }));
}

/**
 * Format category/phase name for display
 */
export function formatPhaseName(
	category: string,
	paperSlug = "ai-dlc-2026",
): string {
	// Try to get from config first
	const config = loadRunbooksConfig(paperSlug);
	if (config?.groups) {
		const group = config.groups.find((g) => g.id === category);
		if (group) {
			return group.name;
		}
	}

	// Fallback: capitalize and format
	const formatted = category
		.split("-")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");

	return `${formatted} Phase`;
}

/**
 * Get category/phase icon
 */
export function getPhaseIcon(
	category: string,
	paperSlug = "ai-dlc-2026",
): string {
	// Try to get from config first
	const config = loadRunbooksConfig(paperSlug);
	if (config?.groups) {
		const group = config.groups.find((g) => g.id === category);
		if (group) {
			return group.icon;
		}
	}

	// Fallback
	return "📄";
}
