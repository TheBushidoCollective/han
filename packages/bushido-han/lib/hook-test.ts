import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getInstalledPlugins, readOrCreateSettings } from "./shared.js";

interface HookTestResult {
	plugin: string;
	status: "pass" | "fail" | "skip";
	message: string;
	hookType?: string;
	error?: string;
}

// Valid hook event types according to Claude Code spec
const VALID_HOOK_TYPES = [
	"Notification",
	"PostToolUse",
	"PreCompact",
	"PreToolUse",
	"SessionEnd",
	"SessionStart",
	"Stop",
	"SubagentStop",
	"UserPromptSubmit",
];

/**
 * Test a single hook configuration
 */
function testHookConfig(
	pluginName: string,
	hooksPath: string,
): HookTestResult {
	// Check if hooks.json exists
	if (!existsSync(hooksPath)) {
		return {
			plugin: pluginName,
			status: "skip",
			message: "No hooks.json found",
		};
	}

	try {
		// Parse hooks.json
		const hooksContent = readFileSync(hooksPath, "utf8");
		const hooksConfig = JSON.parse(hooksContent);

		if (!hooksConfig.hooks || typeof hooksConfig.hooks !== "object") {
			return {
				plugin: pluginName,
				status: "fail",
				message: "Invalid hooks.json structure: missing 'hooks' object",
			};
		}

		// Validate each hook type
		const errors: string[] = [];
		for (const hookType of Object.keys(hooksConfig.hooks)) {
			if (!VALID_HOOK_TYPES.includes(hookType)) {
				errors.push(`Unknown event type '${hookType}'`);
			}

			const hookConfig = hooksConfig.hooks[hookType];
			if (!Array.isArray(hookConfig)) {
				errors.push(`Hook type '${hookType}' must be an array`);
				continue;
			}

			// Validate each hook in the array
			for (const hook of hookConfig) {
				if (!hook.hooks || !Array.isArray(hook.hooks)) {
					errors.push(
						`Hook type '${hookType}' missing 'hooks' array in configuration`,
					);
					continue;
				}

				// Validate individual hook commands
				for (const individualHook of hook.hooks) {
					if (individualHook.type === "command") {
						if (!individualHook.command || typeof individualHook.command !== "string") {
							errors.push(
								`Hook type '${hookType}' has command hook with missing or invalid command`,
							);
						} else {
							// Test if command uses -- separator for han hook run
							if (
								individualHook.command.includes("han hook run") &&
								!individualHook.command.includes(" -- ")
							) {
								errors.push(
									`Hook command uses 'han hook run' but missing '--' separator: ${individualHook.command}`,
								);
							}
						}
					}
				}
			}
		}

		if (errors.length > 0) {
			return {
				plugin: pluginName,
				status: "fail",
				message: errors.join("; "),
			};
		}

		return {
			plugin: pluginName,
			status: "pass",
			message: `Valid hooks configuration (${Object.keys(hooksConfig.hooks).join(", ")})`,
		};
	} catch (error: unknown) {
		return {
			plugin: pluginName,
			status: "fail",
			message: "Failed to parse hooks.json",
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * Get the marketplace root directory
 * This is the directory containing buki/, do/, sensei/, bushido/ folders
 */
function getMarketplaceRoot(): string | null {
	// Plugins are installed relative to the project root (CLAUDE_PROJECT_DIR)
	// The marketplace structure is at the root level
	const projectRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();

	// Check if this looks like the Han marketplace repo
	if (
		existsSync(join(projectRoot, "buki")) &&
		existsSync(join(projectRoot, "do")) &&
		existsSync(join(projectRoot, "bushido"))
	) {
		return projectRoot;
	}

	return null;
}

/**
 * Test all hooks in installed plugins
 */
export async function testHooks(): Promise<void> {
	console.log("🔍 Testing hooks for installed plugins...\n");

	const marketplaceRoot = getMarketplaceRoot();
	if (!marketplaceRoot) {
		console.error("Error: Could not find marketplace root directory");
		console.error(
			"This usually means the Han marketplace is not installed yet.",
		);
		console.error('Run "han plugin install" first to set up the marketplace.');
		process.exit(1);
	}

	// Get all installed plugins from both scopes
	const projectPlugins = getInstalledPlugins("project");
	const localPlugins = getInstalledPlugins("local");
	const allPlugins = Array.from(new Set([...projectPlugins, ...localPlugins]));

	if (allPlugins.length === 0) {
		console.log("No plugins installed");
		process.exit(0);
	}

	const results: HookTestResult[] = [];

	// Test each plugin
	for (const plugin of allPlugins) {
		// Determine plugin directory based on prefix
		let pluginDir: string;
		if (plugin.startsWith("buki-")) {
			pluginDir = join(marketplaceRoot, "buki", plugin);
		} else if (plugin.startsWith("do-")) {
			pluginDir = join(marketplaceRoot, "do", plugin);
		} else if (plugin.startsWith("sensei-")) {
			pluginDir = join(marketplaceRoot, "sensei", plugin);
		} else if (plugin === "bushido") {
			pluginDir = join(marketplaceRoot, "bushido");
		} else {
			results.push({
				plugin,
				status: "skip",
				message: "Unknown plugin type",
			});
			continue;
		}

		const hooksPath = join(pluginDir, "hooks", "hooks.json");
		const result = testHookConfig(plugin, hooksPath);
		results.push(result);
	}

	// Display results
	const passed = results.filter((r) => r.status === "pass");
	const failed = results.filter((r) => r.status === "fail");
	const skipped = results.filter((r) => r.status === "skip");

	console.log("Results:");
	console.log("========\n");

	if (passed.length > 0) {
		console.log("✅ Passed:");
		for (const result of passed) {
			console.log(`  ${result.plugin}: ${result.message}`);
		}
		console.log();
	}

	if (skipped.length > 0) {
		console.log("⊘ Skipped (no hooks):");
		for (const result of skipped) {
			console.log(`  ${result.plugin}: ${result.message}`);
		}
		console.log();
	}

	if (failed.length > 0) {
		console.log("❌ Failed:");
		for (const result of failed) {
			console.log(`  ${result.plugin}: ${result.message}`);
			if (result.error) {
				console.log(`    Error: ${result.error}`);
			}
		}
		console.log();
	}

	// Summary
	console.log("Summary:");
	console.log(`  Total: ${results.length}`);
	console.log(`  Passed: ${passed.length}`);
	console.log(`  Failed: ${failed.length}`);
	console.log(`  Skipped: ${skipped.length}`);

	// Exit with error if any failed
	if (failed.length > 0) {
		process.exit(1);
	}
}
