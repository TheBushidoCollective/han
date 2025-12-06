import { existsSync } from "node:fs";
import { query } from "@anthropic-ai/claude-agent-sdk";
import {
	fetchMarketplace,
	findClaudeExecutable,
	getClaudeSettingsPath,
	getInstalledPlugins,
	type InstallScope,
	type MarketplacePlugin,
} from "./shared.js";

interface PluginInfo {
	name: string;
	category?: string;
	description?: string;
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
		};
	});
}

/**
 * Generate summary of how Han is improving the repository
 */
export async function generateSummary(): Promise<void> {
	console.log("🏯 Generating Han Summary...\n");
	console.log("Analyzing installed plugins...");

	try {
		// Get installed plugins
		const installedPlugins = await getInstalledPluginsWithMetadata();

		if (installedPlugins.length === 0) {
			console.log("❌ No Han plugins installed");
			console.log("\nTo get started, run: han plugin install --auto");
			return;
		}

		console.log("Analyzing repository...");

		// Build prompt for AI analysis
		const pluginList = installedPlugins
			.map(
				(p) =>
					`- ${p.name}${p.category ? ` (${p.category})` : ""}${p.description ? `: ${p.description}` : ""}`,
			)
			.join("\n");

		const prompt = `You are analyzing how Han (Claude Code plugin marketplace) plugins are improving this repository.

INSTALLED HAN PLUGINS:
${pluginList}

Your task:
1. Analyze the repository structure and content
2. Identify how each installed plugin is improving the development workflow
3. Provide concrete examples of capabilities added by the plugins
4. Explain the overall impact on code quality, productivity, and developer experience

Format your response as a clear, structured summary that explains:
- What each plugin category brings to the repository
- Specific improvements and capabilities enabled
- Overall impact on the development workflow

Be specific and concrete. Focus on actual improvements, not generic descriptions.

Output a well-formatted summary suitable for display in a terminal.`;

		console.log("Generating AI summary...\n");

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

		console.log("🤖 AI Analysis:\n");

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
	} catch (error) {
		console.error(
			"Error generating summary:",
			error instanceof Error ? error.message : error,
		);
		process.exit(1);
	}
}
