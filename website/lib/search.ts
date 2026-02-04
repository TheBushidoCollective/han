import fs from "node:fs";
import path from "node:path";
import { getAllPluginsAcrossCategories } from "./plugins";

export interface SearchIndexEntry {
	id: string;
	type: "plugin" | "skill" | "agent";
	name: string;
	title: string;
	description: string;
	category: string;
	tags: string[];
	path: string;
	searchText: string;
}

export interface SearchIndex {
	entries: SearchIndexEntry[];
	tags: TagInfo[];
}

export interface TagInfo {
	name: string;
	count: number;
	category:
		| "all"
		| "language"
		| "framework"
		| "testing"
		| "tooling"
		| "paradigm";
}

/**
 * Check if a plugin source is external (hosted on GitHub, not local)
 */
function isExternalSource(source: string): boolean {
	return source.startsWith("github:");
}

/**
 * Get keywords for a plugin - from local filesystem or marketplace.json
 */
function getPluginKeywords(source: string): string[] {
	// For external plugins, read keywords from marketplace.json
	if (isExternalSource(source)) {
		try {
			const marketplacePath = path.join(
				process.cwd(),
				"..",
				".claude-plugin",
				"marketplace.json",
			);
			const marketplaceData = JSON.parse(
				fs.readFileSync(marketplacePath, "utf-8"),
			);
			const plugin = marketplaceData.plugins.find(
				(p: { source: string }) => p.source === source,
			);
			return plugin?.keywords || [];
		} catch {
			return [];
		}
	}

	// For local plugins, read from plugin.json
	try {
		const pluginJson = JSON.parse(
			fs.readFileSync(
				path.join(process.cwd(), "..", source, ".claude-plugin/plugin.json"),
				"utf-8",
			),
		);
		return pluginJson.keywords || [];
	} catch {
		return [];
	}
}

// Build the search index from all plugins
export function buildSearchIndex(): SearchIndex {
	const plugins = getAllPluginsAcrossCategories();
	const entries: SearchIndexEntry[] = [];
	const tagCounts = new Map<string, number>();

	for (const plugin of plugins) {
		const tags = getPluginKeywords(plugin.source);

		// Track tag usage
		for (const tag of tags) {
			tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
		}

		// Add plugin entry
		entries.push({
			id: plugin.name,
			type: "plugin",
			name: plugin.name,
			title: plugin.name,
			description: plugin.description,
			category: plugin.category,
			tags,
			path: `/plugins/${plugin.category}/${plugin.name}`,
			searchText: [plugin.name, plugin.description, ...tags, plugin.category]
				.join(" ")
				.toLowerCase(),
		});
	}

	// Convert tag counts to TagInfo
	const tags: TagInfo[] = Array.from(tagCounts.entries())
		.map(([name, count]) => ({
			name,
			count,
			category: categorizeTag(name),
		}))
		.sort((a, b) => b.count - a.count);

	return { entries, tags };
}

// Categorize tags for better organization
function categorizeTag(tag: string): TagInfo["category"] {
	const languageTags = [
		"javascript",
		"typescript",
		"python",
		"java",
		"go",
		"rust",
		"ruby",
		"elixir",
		"erlang",
		"php",
		"swift",
		"kotlin",
		"scala",
		"csharp",
		"cpp",
		"c",
		"lua",
		"crystal",
		"nim",
		"gleam",
		"objective-c",
	];
	const frameworkTags = [
		"react",
		"nextjs",
		"vue",
		"angular",
		"django",
		"rails",
		"nestjs",
		"fastapi",
		"phoenix",
		"express",
		"flask",
	];
	const testingTags = [
		"testing",
		"jest",
		"cypress",
		"playwright",
		"vitest",
		"mocha",
		"rspec",
		"pytest",
		"junit",
		"testng",
		"cucumber",
		"bdd",
	];
	const toolingTags = [
		"linting",
		"formatting",
		"biome",
		"eslint",
		"prettier",
		"rubocop",
		"clippy",
		"pylint",
		"checkstyle",
	];
	const paradigmTags = [
		"functional-programming",
		"oop",
		"object-oriented",
		"fp",
	];

	const lowerTag = tag.toLowerCase();

	if (languageTags.includes(lowerTag)) return "language";
	if (frameworkTags.includes(lowerTag)) return "framework";
	if (testingTags.includes(lowerTag)) return "testing";
	if (toolingTags.includes(lowerTag)) return "tooling";
	if (paradigmTags.includes(lowerTag)) return "paradigm";

	return "all";
}

// Search the index
export function searchIndex(
	index: SearchIndex,
	query: string,
	filters?: {
		category?: string;
		tags?: string[];
	},
): SearchIndexEntry[] {
	const lowerQuery = query.toLowerCase().trim();

	if (!lowerQuery && !filters?.tags?.length) {
		return index.entries;
	}

	let results = index.entries;

	// Filter by category
	if (filters?.category) {
		results = results.filter((entry) => entry.category === filters.category);
	}

	// Filter by tags
	if (filters?.tags?.length) {
		results = results.filter((entry) =>
			filters.tags?.some((tag) => entry.tags.includes(tag)),
		);
	}

	// Search query
	if (lowerQuery) {
		results = results.filter((entry) => {
			// Exact name match gets highest priority
			if (entry.name.toLowerCase() === lowerQuery) return true;

			// Check if search text contains all query terms
			const terms = lowerQuery.split(/\s+/);
			return terms.every((term) => entry.searchText.includes(term));
		});

		// Sort by relevance
		results.sort((a, b) => {
			const aNameMatch = a.name.toLowerCase().includes(lowerQuery);
			const bNameMatch = b.name.toLowerCase().includes(lowerQuery);

			if (aNameMatch && !bNameMatch) return -1;
			if (!aNameMatch && bNameMatch) return 1;

			return 0;
		});
	}

	return results;
}

// Get suggestions for autocomplete
export function getSuggestions(
	index: SearchIndex,
	query: string,
	limit = 5,
): string[] {
	const lowerQuery = query.toLowerCase().trim();

	if (!lowerQuery) return [];

	const suggestions = new Set<string>();

	// Add matching plugin names
	for (const entry of index.entries) {
		if (entry.name.toLowerCase().includes(lowerQuery)) {
			suggestions.add(entry.name);
		}
		if (suggestions.size >= limit) break;
	}

	// Add matching tags
	if (suggestions.size < limit) {
		for (const tag of index.tags) {
			if (tag.name.toLowerCase().includes(lowerQuery)) {
				suggestions.add(tag.name);
			}
			if (suggestions.size >= limit) break;
		}
	}

	return Array.from(suggestions).slice(0, limit);
}

// Find related plugins by tags
export function findRelatedPlugins(
	index: SearchIndex,
	pluginName: string,
	limit = 4,
): SearchIndexEntry[] {
	const plugin = index.entries.find((e) => e.name === pluginName);
	if (!plugin) return [];

	const related = index.entries
		.filter((e) => e.name !== pluginName)
		.map((entry) => {
			const sharedTags = entry.tags.filter((tag) => plugin.tags.includes(tag));
			return {
				entry,
				score: sharedTags.length,
			};
		})
		.filter((r) => r.score > 0)
		.sort((a, b) => b.score - a.score)
		.slice(0, limit)
		.map((r) => r.entry);

	return related;
}
