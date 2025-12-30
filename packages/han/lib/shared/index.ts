/**
 * Shared Module
 *
 * Re-exports shared utilities, types, and functions used across the codebase.
 */

export {
	// Types
	type AgentUpdate,
	type ClaudeSettings,
	type DetectPluginsCallbacks,
	// Settings functions
	detectHanScopes,
	// Plugin detection
	detectPluginsWithAgent,
	ensureClaudeDirectory,
	ensureDispatchHooks,
	fetchMarketplace,
	findClaudeExecutable,
	getClaudeSettingsPath,
	getEffectiveProjectScope,
	getGlobalClaudeSettingsPath,
	getInstalledPlugins,
	getPluginNameFromRoot,
	getSettingsFilename,
	// Constants
	HAN_MARKETPLACE_REPO,
	type HookEntry,
	type HookGroup,
	type InstallScope,
	type Marketplace,
	type MarketplacePlugin,
	type MarketplaceSource,
	type Marketplaces,
	type Plugins,
	parsePluginRecommendations,
	readGlobalSettings,
	readOrCreateSettings,
	removeInvalidPlugins,
	writeGlobalSettings,
	writeSettings,
} from "./shared.ts";
