import Link from "next/link";
import { Suspense } from "react";
import { getAllPluginsAcrossCategories } from "@/lib/plugins";
import Header from "../components/Header";
import SearchResults from "../components/SearchResults";

export const metadata = {
	title: "Search Plugins - Han",
	description: "Search and discover Han plugins, skills, and agents",
};

export default function SearchPage() {
	const plugins = getAllPluginsAcrossCategories();

	// Build search index
	const fs = require("node:fs");
	const path = require("node:path");

	// Helper to check if source is external (github:owner/repo)
	const isExternalSource = (source: string) => source.startsWith("github:");

	// Helper to get keywords for a plugin
	const getPluginKeywords = (source: string): string[] => {
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
				const marketPlugin = marketplaceData.plugins.find(
					(p: { source: string }) => p.source === source,
				);
				return marketPlugin?.keywords || [];
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
	};

	const searchIndex = plugins.map((plugin) => {
		const tags = getPluginKeywords(plugin.source);

		// Detect components by checking plugin structure
		// For external plugins, we can't detect components
		const components: string[] = [];

		if (!isExternalSource(plugin.source)) {
			const pluginPath = path.join(process.cwd(), "..", plugin.source);

			if (fs.existsSync(path.join(pluginPath, "skills"))) {
				components.push("skill");
			}
			if (fs.existsSync(path.join(pluginPath, "agents"))) {
				components.push("agent");
			}
			if (fs.existsSync(path.join(pluginPath, "commands"))) {
				components.push("command");
			}
			if (fs.existsSync(path.join(pluginPath, "hooks"))) {
				components.push("hook");
			}
		}

		return {
			id: plugin.name,
			name: plugin.name,
			description: plugin.description,
			category: plugin.category,
			tags,
			path: `/plugins/${plugin.category}/${plugin.name}`,
			components,
		};
	});

	return (
		<div className="min-h-screen bg-white dark:bg-gray-900">
			<Header />

			<div className="max-w-4xl mx-auto px-4 py-12">
				<div className="mb-8">
					<h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
						Search Plugins
					</h1>
					<p className="text-gray-600 dark:text-gray-400">
						Discover plugins, skills, and agents from the Han marketplace
					</p>
				</div>

				<div className="mb-12">
					<Suspense
						fallback={
							<div className="text-center py-8 text-gray-500 dark:text-gray-400">
								Loading results...
							</div>
						}
					>
						<SearchResults index={searchIndex} />
					</Suspense>
				</div>

				<div className="mb-8">
					<h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
						Quick Links
					</h2>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<Link
							href="/tags"
							className="block p-6 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-gray-900 dark:hover:border-white transition"
						>
							<h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
								Browse by Tags
							</h3>
							<p className="text-gray-600 dark:text-gray-400">
								Explore plugins organized by technology and category
							</p>
						</Link>

						<Link
							href="/plugins"
							className="block p-6 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-gray-900 dark:hover:border-white transition"
						>
							<h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
								All Plugins
							</h3>
							<p className="text-gray-600 dark:text-gray-400">
								View the complete list of available plugins
							</p>
						</Link>
					</div>
				</div>

				<div>
					<h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
						Categories
					</h2>
					<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
						{[
							"core",
							"languages",
							"frameworks",
							"validation",
							"tools",
							"services",
							"disciplines",
							"patterns",
							"specialized",
						].map((category) => {
							const count = plugins.filter(
								(p) => p.category === category,
							).length;
							return (
								<Link
									key={category}
									href={`/plugins/${category}`}
									className="block p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-gray-900 dark:hover:border-white transition text-center"
								>
									<div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
										{count}
									</div>
									<div className="text-sm text-gray-600 dark:text-gray-400 capitalize">
										{category}
									</div>
								</Link>
							);
						})}
					</div>
				</div>
			</div>
		</div>
	);
}
