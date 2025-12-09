import { existsSync } from "node:fs";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { analyzeCodebase, formatStatsForPrompt } from "./codebase-analyzer.ts";
import {
	fetchMarketplace,
	findClaudeExecutable,
	getClaudeSettingsPath,
	getInstalledPlugins,
	type InstallScope,
	type MarketplacePlugin,
} from "./shared.ts";

interface PluginInfo {
	name: string;
	category?: string;
	description?: string;
	keywords?: string[];
}

/**
 * Get all installed plugins with their metadata
 */
async function getInstalledPluginsWithMetadata(): Promise<PluginInfo[]> {
	const marketplacePlugins = await fetchMarketplace();
	const pluginMap = new Map<string, MarketplacePlugin>();
	for (const plugin of marketplacePlugins) {
		pluginMap.set(plugin.name, plugin);
	}

	const scopes: InstallScope[] = ["user", "project", "local"];
	const allPlugins = new Set<string>();

	for (const scope of scopes) {
		const settingsPath = getClaudeSettingsPath(scope);
		if (!existsSync(settingsPath)) continue;

		const plugins = getInstalledPlugins(scope);
		for (const plugin of plugins) {
			allPlugins.add(plugin);
		}
	}

	return Array.from(allPlugins).map((name) => {
		const plugin = pluginMap.get(name);
		return {
			name,
			category: plugin?.category,
			description: plugin?.description,
			keywords: plugin?.keywords,
		};
	});
}

/**
 * Get all available plugins from marketplace
 */
async function getAvailablePluginsWithMetadata(): Promise<PluginInfo[]> {
	const marketplacePlugins = await fetchMarketplace();
	return marketplacePlugins.map((p) => ({
		name: p.name,
		category: p.category,
		description: p.description,
		keywords: p.keywords,
	}));
}

/**
 * Analyze gaps in the repository and suggest plugins
 */
export async function analyzeGaps(): Promise<void> {
	console.log("🔍 Analyzing Repository Gaps...\n");
	console.log("Analyzing codebase...");

	try {
		// Analyze codebase
		const codebaseStats = analyzeCodebase(process.cwd());
		const statsPrompt = formatStatsForPrompt(codebaseStats);

		console.log("Fetching plugin data...");

		// Get installed and available plugins
		const installedPlugins = await getInstalledPluginsWithMetadata();
		const availablePlugins = await getAvailablePluginsWithMetadata();

		const installedNames = new Set(installedPlugins.map((p) => p.name));
		const notInstalledPlugins = availablePlugins.filter(
			(p) => !installedNames.has(p.name),
		);

		console.log("Exploring repository structure...");

		// Build prompt for gap analysis
		const installedList =
			installedPlugins.length > 0
				? installedPlugins
						.map(
							(p) =>
								`- ${p.name}${p.category ? ` (${p.category})` : ""}${p.description ? `: ${p.description}` : ""}`,
						)
						.join("\n")
				: "None";

		const availableList = notInstalledPlugins
			.map(
				(p) =>
					`- ${p.name}${p.category ? ` (${p.category})` : ""}${p.description ? `: ${p.description}` : ""}`,
			)
			.join("\n");

		const prompt = `You are analyzing a repository to identify gaps in its development workflow and suggest Han plugins to fill those gaps.

CODEBASE STATISTICS:
${statsPrompt}

CURRENTLY INSTALLED HAN PLUGINS:
${installedList}

AVAILABLE HAN PLUGINS (NOT INSTALLED):
${availableList}

Your task:
1. Explore the repository structure and content using the available tools (glob, grep, read_file)
2. Identify technologies, frameworks, and patterns being used
3. Identify gaps in the current plugin setup based on what the repository actually uses
4. Suggest specific Han plugins that would fill these gaps
5. Explain WHY each suggested plugin would be valuable for THIS repository

Focus on:
- Technologies actually used in the repo (check package.json, config files, code files)
- Missing validation/testing/quality tools for those technologies
- Missing integrations for services/frameworks used in the code
- Development workflow improvements relevant to this specific project

Format your response as:

## Repository Analysis
[Brief overview of technologies and patterns found]

## Identified Gaps
[List specific gaps with evidence from the repository]

## Recommended Plugins
[For each recommendation, explain the gap it fills with specific examples]

## Summary
[Overall impact of implementing these recommendations]

Be specific and evidence-based. Only recommend plugins that clearly address actual gaps in THIS repository.`;

		console.log("Generating AI analysis...\n");

		// Query Claude using Agent SDK
		const claudePath = findClaudeExecutable();
		const allowedTools: string[] = ["read_file", "glob", "grep"];

		const agent = query({
			prompt,
			options: {
				model: "haiku",
				includePartialMessages: true,
				allowedTools,
				pathToClaudeCodeExecutable: claudePath,
			},
		});

		console.log("🤖 Gap Analysis:\n");

		// Stream the response
		for await (const sdkMessage of agent) {
			if (sdkMessage.type === "assistant" && sdkMessage.message.content) {
				for (const block of sdkMessage.message.content) {
					if (block.type === "text") {
						process.stdout.write(block.text);
					}
				}
			}
		}

		console.log("\n");
		console.log(
			"💡 To install recommended plugins, run: han plugin install <plugin-name>",
		);
		console.log("   Or use: han plugin install --auto\n");
	} catch (error) {
		console.error(
			"Error analyzing gaps:",
			error instanceof Error ? error.message : error,
		);
		process.exit(1);
	}
}
