/**
 * Plugin Migration Module
 *
 * Migrates old plugin names (e.g., `jutsu-typescript@han`) to new short names
 * (e.g., `typescript@han`) in Claude Code settings files.
 *
 * This ensures backwards compatibility during the transition from the old
 * naming scheme to the new organizational structure.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PLUGIN_ALIASES, } from "./plugin-aliases.ts";

/**
 * Get the old plugin name prefix that should be replaced with short form.
 * Maps from old names like "jutsu-typescript" to short names like "typescript".
 *
 * @param oldName - The old plugin name (e.g., "jutsu-typescript")
 * @returns The short name (e.g., "typescript") or null if not a known alias
 */
function getShortName(oldName: string): string | null {
	const normalized = oldName.toLowerCase();

	// Check if this is a known old name that should be migrated
	if (!(normalized in PLUGIN_ALIASES)) {
		return null;
	}

	// Extract short name from the new path format (e.g., "languages/typescript" -> "typescript")
	const newPath = PLUGIN_ALIASES[normalized];
	const parts = newPath.split("/");
	return parts[parts.length - 1];
}

/**
 * Check if a plugin name is an old-style name that should be migrated.
 *
 * Old names follow patterns like:
 * - jutsu-typescript
 * - do-frontend-development
 * - hashi-github
 *
 * @param name - The plugin name to check (without @han suffix)
 * @returns True if this is an old name that should be migrated
 */
export function isOldPluginName(name: string): boolean {
	const normalized = name.toLowerCase();
	return normalized in PLUGIN_ALIASES;
}

/**
 * Result of a migration operation
 */
export interface MigrationResult {
	/** Path to the settings file that was migrated */
	path: string;
	/** Whether any changes were made */
	modified: boolean;
	/** Old plugin names that were migrated */
	migratedPlugins: Array<{ oldName: string; newName: string }>;
	/** Error message if migration failed */
	error?: string;
}

/**
 * Claude settings structure (subset relevant to migration)
 */
interface ClaudeSettings {
	enabledPlugins?: Record<string, boolean>;
	permissions?: {
		allow?: string[];
		deny?: string[];
		[key: string]: unknown;
	};
	[key: string]: unknown;
}

/**
 * Read and parse a JSON settings file
 */
function readSettingsFile(path: string): ClaudeSettings | null {
	if (!existsSync(path)) {
		return null;
	}

	try {
		const content = readFileSync(path, "utf-8");
		return JSON.parse(content) as ClaudeSettings;
	} catch {
		return null;
	}
}

/**
 * Write settings to a JSON file, preserving formatting
 */
function writeSettingsFile(path: string, settings: ClaudeSettings): void {
	writeFileSync(path, `${JSON.stringify(settings, null, 2)}\n`, "utf-8");
}

/**
 * Migrate plugin names in enabledPlugins section.
 * Converts old names like "jutsu-typescript@han" to "typescript@han".
 *
 * @param enabledPlugins - The enabledPlugins object to migrate
 * @returns Object with migrated plugins and list of changes
 */
function migrateEnabledPlugins(enabledPlugins: Record<string, boolean>): {
	migrated: Record<string, boolean>;
	changes: Array<{ oldName: string; newName: string }>;
} {
	const migrated: Record<string, boolean> = {};
	const changes: Array<{ oldName: string; newName: string }> = [];

	for (const [key, enabled] of Object.entries(enabledPlugins)) {
		// Check if this is a @han plugin
		if (!key.endsWith("@han")) {
			migrated[key] = enabled;
			continue;
		}

		const pluginName = key.slice(0, -4); // Remove "@han" suffix
		const shortName = getShortName(pluginName);

		if (shortName && shortName !== pluginName) {
			// This is an old name - migrate it
			const newKey = `${shortName}@han`;
			migrated[newKey] = enabled;
			changes.push({ oldName: key, newName: newKey });
		} else {
			// Keep as-is (either already migrated or not a known alias)
			migrated[key] = enabled;
		}
	}

	return { migrated, changes };
}

/**
 * Migrate plugin names in permissions.allow/deny arrays.
 * Converts old names like "jutsu-typescript@han" to "typescript@han".
 *
 * @param items - The array of permission items to migrate
 * @returns Object with migrated array and list of changes
 */
function migratePermissionItems(items: string[]): {
	migrated: string[];
	changes: Array<{ oldName: string; newName: string }>;
} {
	const migrated: string[] = [];
	const changes: Array<{ oldName: string; newName: string }> = [];

	for (const item of items) {
		// Check if this is a @han plugin permission
		if (!item.endsWith("@han")) {
			migrated.push(item);
			continue;
		}

		const pluginName = item.slice(0, -4); // Remove "@han" suffix
		const shortName = getShortName(pluginName);

		if (shortName && shortName !== pluginName) {
			// This is an old name - migrate it
			const newItem = `${shortName}@han`;
			migrated.push(newItem);
			changes.push({ oldName: item, newName: newItem });
		} else {
			// Keep as-is
			migrated.push(item);
		}
	}

	return { migrated, changes };
}

/**
 * Migrate a single settings file.
 *
 * @param path - Path to the settings.json file
 * @returns Migration result
 */
export function migrateSettingsFile(path: string): MigrationResult {
	const result: MigrationResult = {
		path,
		modified: false,
		migratedPlugins: [],
	};

	const settings = readSettingsFile(path);
	if (!settings) {
		return result;
	}

	let modified = false;

	// Migrate enabledPlugins
	if (settings.enabledPlugins) {
		const { migrated, changes } = migrateEnabledPlugins(settings.enabledPlugins);
		if (changes.length > 0) {
			settings.enabledPlugins = migrated;
			result.migratedPlugins.push(...changes);
			modified = true;
		}
	}

	// Migrate permissions.allow
	if (settings.permissions?.allow && Array.isArray(settings.permissions.allow)) {
		const { migrated, changes } = migratePermissionItems(settings.permissions.allow);
		if (changes.length > 0) {
			settings.permissions.allow = migrated;
			result.migratedPlugins.push(...changes);
			modified = true;
		}
	}

	// Migrate permissions.deny
	if (settings.permissions?.deny && Array.isArray(settings.permissions.deny)) {
		const { migrated, changes } = migratePermissionItems(settings.permissions.deny);
		if (changes.length > 0) {
			settings.permissions.deny = migrated;
			result.migratedPlugins.push(...changes);
			modified = true;
		}
	}

	if (modified) {
		try {
			writeSettingsFile(path, settings);
			result.modified = true;
		} catch (error) {
			result.error = error instanceof Error ? error.message : String(error);
		}
	}

	return result;
}

/**
 * Get paths to all Claude settings files that may contain plugin references.
 *
 * @param projectPath - Optional project path for project/local settings
 * @returns Array of settings file paths
 */
export function getSettingsFilePaths(projectPath?: string): string[] {
	const paths: string[] = [];

	// User settings
	const homeDir = process.env.HOME || process.env.USERPROFILE || "";
	const configDir = process.env.CLAUDE_CONFIG_DIR || join(homeDir, ".claude");
	paths.push(join(configDir, "settings.json"));

	// Project settings
	if (projectPath) {
		paths.push(join(projectPath, ".claude", "settings.json"));
		paths.push(join(projectPath, ".claude", "settings.local.json"));
	}

	return paths;
}

/**
 * Migrate plugin names in all settings files.
 *
 * This function is idempotent - running it multiple times will have no effect
 * after the first successful migration.
 *
 * @param projectPath - Optional project path for project/local settings
 * @returns Array of migration results for each settings file
 */
export function migratePluginNames(projectPath?: string): MigrationResult[] {
	const paths = getSettingsFilePaths(projectPath);
	const results: MigrationResult[] = [];

	for (const path of paths) {
		results.push(migrateSettingsFile(path));
	}

	return results;
}

/**
 * Log migration results to console.
 *
 * @param results - Array of migration results
 * @param verbose - Whether to show detailed output
 */
export function logMigrationResults(
	results: MigrationResult[],
	verbose = false,
): void {
	const modifiedResults = results.filter((r) => r.modified);

	if (modifiedResults.length === 0) {
		if (verbose) {
			console.log("No plugin names needed migration.");
		}
		return;
	}

	console.log("Migrated plugin names:");
	for (const result of modifiedResults) {
		console.log(`  ${result.path}:`);
		for (const { oldName, newName } of result.migratedPlugins) {
			console.log(`    ${oldName} -> ${newName}`);
		}
	}
}

/**
 * Run migration as a standalone operation.
 * This can be called from a startup hook to migrate settings automatically.
 *
 * @param options - Migration options
 * @returns True if any migrations were performed
 */
export function runMigration(options: {
	projectPath?: string;
	verbose?: boolean;
	silent?: boolean;
} = {}): boolean {
	const { projectPath = process.cwd(), verbose = false, silent = false } = options;

	const results = migratePluginNames(projectPath);

	if (!silent) {
		logMigrationResults(results, verbose);
	}

	return results.some((r) => r.modified);
}
