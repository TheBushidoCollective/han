import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { getAllPluginsAcrossCategories } from "@/lib/plugins";
import Header from "../components/Header";
import TagsClient from "../components/TagsClient";

export const metadata: Metadata = {
	title: "Browse by Tags - Han",
	description:
		"Explore Han plugins organized by technology tags. Find plugins for your favorite languages, frameworks, and tools.",
};

interface TagWithPlugins {
	name: string;
	count: number;
	plugins: Array<{
		name: string;
		description: string;
		category: string;
		path: string;
	}>;
}

// Helper to check if source is external (github:owner/repo)
function isExternalSource(source: string) {
	return source.startsWith("github:");
}

// Helper to get keywords for a plugin
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

export default function TagsPage() {
	const plugins = getAllPluginsAcrossCategories();

	// Build tags index
	const tagsMap = new Map<string, TagWithPlugins>();

	for (const plugin of plugins) {
		const tags = getPluginKeywords(plugin.source);

		for (const tag of tags) {
			if (!tagsMap.has(tag)) {
				tagsMap.set(tag, {
					name: tag,
					count: 0,
					plugins: [],
				});
			}

			const tagInfo = tagsMap.get(tag);
			if (!tagInfo) continue;

			tagInfo.count++;
			tagInfo.plugins.push({
				name: plugin.name,
				description: plugin.description,
				category: plugin.category,
				path: `/plugins/${plugin.category}/${plugin.name}`,
			});
		}
	}

	const allTags = Array.from(tagsMap.values()).sort(
		(a, b) => b.count - a.count,
	);

	return (
		<div className="min-h-screen bg-white dark:bg-gray-900">
			<Header />

			<div className="max-w-7xl mx-auto px-4 py-12">
				<div className="mb-8">
					<h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
						Browse by Tags
					</h1>
					<p className="text-gray-600 dark:text-gray-400">
						Explore {allTags.length} tags across {plugins.length} plugins
					</p>
				</div>

				<TagsClient allTags={allTags} />
			</div>
		</div>
	);
}
