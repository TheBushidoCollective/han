#!/usr/bin/env bun
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import YAML from "yaml";

const __dirname = dirname(new URL(import.meta.url).pathname);
const repoRoot = join(__dirname, "..", "..", "..");

/**
 * JSON plugin hook definition (han-config.json)
 */
interface JsonPluginHookDefinition {
	dirsWith?: string[];
	dirTest?: string;
	command: string;
	description?: string;
	ifChanged?: string[];
	idleTimeout?: number;
}

interface JsonPluginConfig {
	hooks: Record<string, JsonPluginHookDefinition>;
}

/**
 * YAML plugin hook definition (han-plugin.yml)
 */
interface YamlPluginHookDefinition {
	dirs_with?: string[];
	dir_test?: string;
	command: string;
	description?: string;
	if_changed?: string[];
	idle_timeout?: number;
}

interface YamlPluginConfig {
	name?: string;
	version?: string;
	description?: string;
	keywords?: string[];
	hooks: Record<string, YamlPluginHookDefinition>;
}

/**
 * Convert JSON camelCase hook to YAML snake_case for comparison
 */
function jsonToYamlHook(
	jsonHook: JsonPluginHookDefinition,
): YamlPluginHookDefinition {
	const yamlHook: YamlPluginHookDefinition = {
		command: jsonHook.command,
	};

	if (jsonHook.dirsWith) {
		yamlHook.dirs_with = jsonHook.dirsWith;
	}
	if (jsonHook.dirTest) {
		yamlHook.dir_test = jsonHook.dirTest;
	}
	if (jsonHook.description) {
		yamlHook.description = jsonHook.description;
	}
	if (jsonHook.ifChanged) {
		yamlHook.if_changed = jsonHook.ifChanged;
	}
	if (jsonHook.idleTimeout !== undefined) {
		yamlHook.idle_timeout = jsonHook.idleTimeout;
	}

	return yamlHook;
}

/**
 * Deep equality check for hook definitions
 */
function areHooksEqual(
	hook1: YamlPluginHookDefinition,
	hook2: YamlPluginHookDefinition,
): boolean {
	// Compare all fields
	const fields: (keyof YamlPluginHookDefinition)[] = [
		"command",
		"dirs_with",
		"dir_test",
		"description",
		"if_changed",
		"idle_timeout",
	];

	for (const field of fields) {
		const val1 = hook1[field];
		const val2 = hook2[field];

		// Both undefined/null
		if (val1 == null && val2 == null) continue;

		// One is defined, other is not
		if (val1 == null || val2 == null) return false;

		// Array comparison
		if (Array.isArray(val1) && Array.isArray(val2)) {
			if (val1.length !== val2.length) return false;
			for (let i = 0; i < val1.length; i++) {
				if (val1[i] !== val2[i]) return false;
			}
			continue;
		}

		// Direct comparison
		if (val1 !== val2) return false;
	}

	return true;
}

/**
 * Find all directories with both han-config.json and han-plugin.yml
 */
function findPluginDirectories(rootDir: string): string[] {
	const pluginDirs: string[] = [];

	function scan(dir: string, depth: number): void {
		if (depth > 4) return; // Limit depth

		try {
			const entries = readdirSync(dir, { withFileTypes: true });
			let hasJsonConfig = false;
			let hasYamlConfig = false;

			// Check for both config files
			for (const entry of entries) {
				if (entry.isFile()) {
					if (entry.name === "han-config.json") {
						hasJsonConfig = true;
					}
					if (entry.name === "han-plugin.yml") {
						hasYamlConfig = true;
					}
				}
			}

			// If both exist, add to list
			if (hasJsonConfig && hasYamlConfig) {
				pluginDirs.push(dir);
			}

			// Recurse into subdirectories
			for (const entry of entries) {
				if (
					entry.isDirectory() &&
					!entry.name.startsWith(".") &&
					entry.name !== "node_modules" &&
					entry.name !== "dist"
				) {
					scan(join(dir, entry.name), depth + 1);
				}
			}
		} catch (_error) {
			// Ignore permission errors
		}
	}

	scan(rootDir, 0);
	return pluginDirs;
}

/**
 * Get plugin name from directory path
 */
function getPluginName(dir: string): string {
	return dir.split("/").pop() || dir;
}

/**
 * Find differences between JSON and YAML hook definitions
 */
function findHookDifferences(
	_hookName: string,
	jsonHook: JsonPluginHookDefinition,
	yamlHook: YamlPluginHookDefinition,
): string[] {
	const differences: string[] = [];

	// Convert JSON to YAML format for comparison
	const jsonAsYaml = jsonToYamlHook(jsonHook);

	// Compare each field
	if (jsonAsYaml.command !== yamlHook.command) {
		differences.push(
			`  - JSON has command '${jsonAsYaml.command}'`,
			`  - YAML has command '${yamlHook.command}'`,
		);
	}

	if (
		JSON.stringify(jsonAsYaml.dirs_with) !== JSON.stringify(yamlHook.dirs_with)
	) {
		differences.push(
			`  - JSON has dirs_with ${JSON.stringify(jsonAsYaml.dirs_with || null)}`,
			`  - YAML has dirs_with ${JSON.stringify(yamlHook.dirs_with || null)}`,
		);
	}

	if (jsonAsYaml.dir_test !== yamlHook.dir_test) {
		differences.push(
			`  - JSON has dir_test ${JSON.stringify(jsonAsYaml.dir_test || null)}`,
			`  - YAML has dir_test ${JSON.stringify(yamlHook.dir_test || null)}`,
		);
	}

	if (jsonAsYaml.description !== yamlHook.description) {
		differences.push(
			`  - JSON has description ${JSON.stringify(jsonAsYaml.description || null)}`,
			`  - YAML has description ${JSON.stringify(yamlHook.description || null)}`,
		);
	}

	if (
		JSON.stringify(jsonAsYaml.if_changed) !==
		JSON.stringify(yamlHook.if_changed)
	) {
		differences.push(
			`  - JSON has if_changed ${JSON.stringify(jsonAsYaml.if_changed || null)}`,
			`  - YAML has if_changed ${JSON.stringify(yamlHook.if_changed || null)}`,
		);
	}

	if (jsonAsYaml.idle_timeout !== yamlHook.idle_timeout) {
		differences.push(
			`  - JSON has idle_timeout ${JSON.stringify(jsonAsYaml.idle_timeout ?? null)}`,
			`  - YAML has idle_timeout ${JSON.stringify(yamlHook.idle_timeout ?? null)}`,
		);
	}

	return differences;
}

/**
 * Check if configs are in sync
 */
function checkConfigSync(pluginDir: string): {
	inSync: boolean;
	differences: string[];
} {
	const jsonPath = join(pluginDir, "han-config.json");
	const yamlPath = join(pluginDir, "han-plugin.yml");

	try {
		// Load both configs
		const jsonContent = readFileSync(jsonPath, "utf-8");
		const yamlContent = readFileSync(yamlPath, "utf-8");

		const jsonConfig: JsonPluginConfig = JSON.parse(jsonContent);
		const yamlConfig: YamlPluginConfig = YAML.parse(yamlContent);

		if (!jsonConfig.hooks || !yamlConfig.hooks) {
			return {
				inSync: false,
				differences: ["Missing hooks section in one or both configs"],
			};
		}

		const differences: string[] = [];

		// Get all hook names from both configs
		const jsonHookNames = new Set(Object.keys(jsonConfig.hooks));
		const yamlHookNames = new Set(Object.keys(yamlConfig.hooks));

		// Check for hooks only in JSON
		for (const hookName of jsonHookNames) {
			if (!yamlHookNames.has(hookName)) {
				differences.push(`Hook '${hookName}' exists in JSON but not in YAML`);
			}
		}

		// Check for hooks only in YAML
		for (const hookName of yamlHookNames) {
			if (!jsonHookNames.has(hookName)) {
				differences.push(`Hook '${hookName}' exists in YAML but not in JSON`);
			}
		}

		// Compare hooks that exist in both
		for (const hookName of jsonHookNames) {
			if (yamlHookNames.has(hookName)) {
				const jsonHook = jsonConfig.hooks[hookName];
				const yamlHook = yamlConfig.hooks[hookName];

				const jsonAsYaml = jsonToYamlHook(jsonHook);
				if (!areHooksEqual(jsonAsYaml, yamlHook)) {
					const hookDiffs = findHookDifferences(hookName, jsonHook, yamlHook);
					differences.push(`Hook '${hookName}' has differences:`, ...hookDiffs);
				}
			}
		}

		return {
			inSync: differences.length === 0,
			differences,
		};
	} catch (error) {
		return {
			inSync: false,
			differences: [
				`Error reading configs: ${error instanceof Error ? error.message : String(error)}`,
			],
		};
	}
}

/**
 * Main function
 */
function main() {
	console.log("Checking plugin config sync...");

	const pluginDirs = findPluginDirectories(repoRoot);

	if (pluginDirs.length === 0) {
		console.log(
			"No plugins found with both han-config.json and han-plugin.yml",
		);
		process.exit(0);
	}

	const results: Array<{
		plugin: string;
		inSync: boolean;
		differences: string[];
	}> = [];

	for (const dir of pluginDirs) {
		const pluginName = getPluginName(dir);
		const result = checkConfigSync(dir);
		results.push({
			plugin: pluginName,
			inSync: result.inSync,
			differences: result.differences,
		});
	}

	// Print results
	let outOfSyncCount = 0;
	for (const result of results) {
		if (result.inSync) {
			console.log(`✓ ${result.plugin}: in sync`);
		} else {
			console.log(`✗ ${result.plugin}: OUT OF SYNC`);
			for (const diff of result.differences) {
				console.log(diff);
			}
			outOfSyncCount++;
		}
	}

	// Print summary
	console.log(
		`\nSummary: ${results.length - outOfSyncCount}/${results.length} plugins in sync`,
	);
	if (outOfSyncCount > 0) {
		console.log(`${outOfSyncCount} out of sync`);
		process.exit(1);
	}

	process.exit(0);
}

main();
