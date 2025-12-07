import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Table from "cli-table3";
import {
	fetchMarketplace,
	getClaudeSettingsPath,
	getInstalledPlugins,
	type InstallScope,
	type MarketplacePlugin,
	readGlobalSettings,
} from "./shared.js";

interface PluginDetails {
	name: string;
	description?: string;
	category?: string;
	scope: string;
	hasCommands: boolean;
	hasSkills: boolean;
	hasHooks: boolean;
	hasMcp: boolean;
	hasAgents: boolean;
}

/**
 * Get plugin directory from global settings
 */
function getPluginDirectory(): string {
	const homeDir = process.env.HOME || process.env.USERPROFILE || "";
	const configDir = process.env.CLAUDE_CONFIG_DIR || join(homeDir, ".claude");
	return join(configDir, "plugins", "marketplaces", "han");
}

/**
 * Analyze a plugin's capabilities
 */
function analyzePlugin(
	pluginName: string,
	category?: string,
): Partial<PluginDetails> {
	const marketplaceDir = getPluginDirectory();

	// Determine plugin path based on category
	let pluginDir: string;
	if (category === "Core") {
		// Core plugins are in core/ or at root (bushido, core)
		const coreDir = join(marketplaceDir, "core", pluginName);
		const rootDir = join(marketplaceDir, pluginName);
		pluginDir = existsSync(coreDir) ? coreDir : rootDir;
	} else if (category === "Technique") {
		// Technique plugins are in jutsu/
		pluginDir = join(marketplaceDir, "jutsu", pluginName);
	} else if (category === "Discipline") {
		// Discipline plugins are in do/
		pluginDir = join(marketplaceDir, "do", pluginName);
	} else if (category === "Bridge") {
		// Bridge plugins are in hashi/
		pluginDir = join(marketplaceDir, "hashi", pluginName);
	} else {
		// Fallback: try direct path
		pluginDir = join(marketplaceDir, pluginName);
	}

	if (!existsSync(pluginDir)) {
		return {
			hasCommands: false,
			hasSkills: false,
			hasHooks: false,
			hasMcp: false,
			hasAgents: false,
		};
	}

	const commandsDir = join(pluginDir, "commands");
	const skillsDir = join(pluginDir, "skills");
	const agentsDir = join(pluginDir, "agents");
	const claudePluginDir = join(pluginDir, ".claude-plugin");
	const hooksFile = join(claudePluginDir, "hooks.json");

	const hasCommands =
		existsSync(commandsDir) && readdirSync(commandsDir).length > 0;
	const hasSkills = existsSync(skillsDir) && readdirSync(skillsDir).length > 0;
	const hasAgents = existsSync(agentsDir) && readdirSync(agentsDir).length > 0;
	const hasHooks = existsSync(hooksFile);

	// Check for MCP server configuration
	let hasMcp = false;
	if (existsSync(claudePluginDir)) {
		const pluginJsonPath = join(claudePluginDir, "plugin.json");
		if (existsSync(pluginJsonPath)) {
			try {
				const pluginJson = JSON.parse(readFileSync(pluginJsonPath, "utf-8"));
				hasMcp =
					!!pluginJson.mcpServers &&
					Object.keys(pluginJson.mcpServers).length > 0;
			} catch {
				// Ignore parse errors
			}
		}
	}

	return { hasCommands, hasSkills, hasHooks, hasMcp, hasAgents };
}

/**
 * Get capabilities emoji indicators
 */
function getCapabilitiesString(plugin: PluginDetails): string {
	const indicators: string[] = [];
	if (plugin.hasCommands) indicators.push("📜");
	if (plugin.hasSkills) indicators.push("⚔️");
	if (plugin.hasAgents) indicators.push("🤖");
	if (plugin.hasHooks) indicators.push("🪝");
	if (plugin.hasMcp) indicators.push("🔌");
	return indicators.join(" ") || "-";
}

/**
 * Show comprehensive overview of Han configuration
 */
export async function explainHan(): Promise<void> {
	console.log("🏯 Han Configuration Overview\n");

	// Fetch marketplace data
	console.log("Fetching plugin information...\n");
	const marketplacePlugins = await fetchMarketplace();
	const pluginInfoMap = new Map<string, MarketplacePlugin>();
	for (const plugin of marketplacePlugins) {
		pluginInfoMap.set(plugin.name, plugin);
	}

	// Collect all installed plugins from all scopes
	const scopes: InstallScope[] = ["user", "project", "local"];
	const scopeLabels = {
		user: "User",
		project: "Project",
		local: "Local",
	};

	const allPlugins: PluginDetails[] = [];

	for (const scope of scopes) {
		const settingsPath = getClaudeSettingsPath(scope);
		if (!existsSync(settingsPath)) {
			continue;
		}

		const plugins = getInstalledPlugins(scope);
		for (const pluginName of plugins) {
			const marketplaceInfo = pluginInfoMap.get(pluginName);
			const capabilities = analyzePlugin(pluginName, marketplaceInfo?.category);

			allPlugins.push({
				name: pluginName,
				description: marketplaceInfo?.description,
				category: marketplaceInfo?.category,
				scope: scopeLabels[scope],
				hasCommands: capabilities.hasCommands || false,
				hasSkills: capabilities.hasSkills || false,
				hasAgents: capabilities.hasAgents || false,
				hasHooks: capabilities.hasHooks || false,
				hasMcp: capabilities.hasMcp || false,
			});
		}
	}

	if (allPlugins.length === 0) {
		console.log("❌ No Han plugins installed\n");
		console.log("To get started:");
		console.log(
			"  • han plugin install --auto     # Auto-detect recommended plugins",
		);
		console.log("  • han plugin search <query>     # Search for plugins");
		console.log(
			"  • han plugin install <name>     # Install a specific plugin",
		);
		return;
	}

	// Display installed plugins
	console.log("📦 Installed Plugins\n");
	const table = new Table({
		head: ["Plugin", "Category", "Scope", "Features"],
		colWidths: [25, 15, 10, 15],
		wordWrap: true,
		style: {
			head: ["cyan", "bold"],
		},
	});

	for (const plugin of allPlugins) {
		table.push([
			plugin.name,
			plugin.category || "-",
			plugin.scope,
			getCapabilitiesString(plugin),
		]);
	}

	console.log(table.toString());

	// Legend
	console.log("\n📊 Features Legend:");
	console.log("  📜 Commands   - Slash commands available");
	console.log("  ⚔️  Skills     - Specialized skills/prompts");
	console.log("  🤖 Agents     - Specialized AI agents");
	console.log("  🪝 Hooks      - Lifecycle hooks configured");
	console.log("  🔌 MCP        - MCP servers enabled");

	// Summary
	const totalCommands = allPlugins.filter((p) => p.hasCommands).length;
	const totalSkills = allPlugins.filter((p) => p.hasSkills).length;
	const totalAgents = allPlugins.filter((p) => p.hasAgents).length;
	const totalHooks = allPlugins.filter((p) => p.hasHooks).length;
	const totalMcp = allPlugins.filter((p) => p.hasMcp).length;

	console.log("\n📈 Summary:");
	console.log(`  Total Plugins: ${allPlugins.length}`);
	console.log(`  With Commands: ${totalCommands}`);
	console.log(`  With Skills: ${totalSkills}`);
	console.log(`  With Agents: ${totalAgents}`);
	console.log(`  With Hooks: ${totalHooks}`);
	console.log(`  With MCP Servers: ${totalMcp}`);

	// Show marketplace info
	const globalSettings = readGlobalSettings();
	const hasMarketplace = !!globalSettings.extraKnownMarketplaces?.han;

	console.log("\n🏪 Marketplace:");
	if (hasMarketplace) {
		console.log("  ✓ Han marketplace configured");
		console.log(`  ✓ ${marketplacePlugins.length} plugins available`);
	} else {
		console.log("  ❌ Han marketplace not configured");
	}

	console.log("\n💡 Useful Commands:");
	console.log("  han plugin list              # List installed plugins");
	console.log("  han plugin search <query>    # Search marketplace");
	console.log("  han plugin install <name>    # Install a plugin");
	console.log("  han plugin install --auto    # Auto-detect recommended");
}
