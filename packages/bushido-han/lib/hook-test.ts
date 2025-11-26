import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getInstalledPlugins } from "./shared.js";

interface HookCommand {
	plugin: string;
	command: string;
}

interface HooksByType {
	[hookType: string]: HookCommand[];
}

interface ValidationResult {
	plugin: string;
	errors: string[];
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
 * Execute a single hook command and stream output
 */
async function executeHookCommand(
	command: string,
	plugin: string,
	hookType: string,
): Promise<{ success: boolean; output: string }> {
	return new Promise((resolve) => {
		const child = spawn(command, {
			shell: true,
			env: { ...process.env },
		});

		let stdout = "";
		let stderr = "";

		child.stdout?.on("data", (data) => {
			const text = data.toString();
			stdout += text;
			process.stdout.write(`  [${plugin}/${hookType}] ${text}`);
		});

		child.stderr?.on("data", (data) => {
			const text = data.toString();
			stderr += text;
			process.stderr.write(`  [${plugin}/${hookType}] ${text}`);
		});

		child.on("close", (code) => {
			const success = code === 0;
			const output = (stderr || stdout).trim();

			if (success) {
				console.log(`  ✓ ${plugin}/${hookType} completed`);
			} else {
				console.error(`  ✗ ${plugin}/${hookType} failed (exit code: ${code})`);
			}

			resolve({ success, output });
		});

		child.on("error", (error) => {
			console.error(`  ✗ ${plugin}/${hookType} error: ${error.message}`);
			resolve({ success: false, output: error.message });
		});
	});
}

/**
 * Get the marketplace root directory
 */
function getMarketplaceRoot(): string | null {
	const projectRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();

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
 * Get plugin directory based on plugin name
 */
function getPluginDir(plugin: string, marketplaceRoot: string): string | null {
	if (plugin.startsWith("buki-")) {
		return join(marketplaceRoot, "buki", plugin);
	}
	if (plugin.startsWith("do-")) {
		return join(marketplaceRoot, "do", plugin);
	}
	if (plugin.startsWith("sensei-")) {
		return join(marketplaceRoot, "sensei", plugin);
	}
	if (plugin === "bushido") {
		return join(marketplaceRoot, "bushido");
	}
	return null;
}

/**
 * Collect and aggregate all hooks by type across all plugins
 */
function collectHooks(
	allPlugins: string[],
	marketplaceRoot: string,
): { hooksByType: HooksByType; validationResults: ValidationResult[] } {
	const hooksByType: HooksByType = {};
	const validationResults: ValidationResult[] = [];

	for (const plugin of allPlugins) {
		const pluginDir = getPluginDir(plugin, marketplaceRoot);
		if (!pluginDir) {
			validationResults.push({
				plugin,
				errors: ["Unknown plugin type"],
			});
			continue;
		}

		const hooksPath = join(pluginDir, "hooks", "hooks.json");
		if (!existsSync(hooksPath)) {
			continue; // Skip plugins without hooks
		}

		try {
			const hooksContent = readFileSync(hooksPath, "utf8");
			const hooksConfig = JSON.parse(hooksContent);

			if (!hooksConfig.hooks || typeof hooksConfig.hooks !== "object") {
				validationResults.push({
					plugin,
					errors: ["Invalid hooks.json structure: missing 'hooks' object"],
				});
				continue;
			}

			const errors: string[] = [];

			// Collect hooks by type
			for (const hookType of Object.keys(hooksConfig.hooks)) {
				// Validate hook type
				if (!VALID_HOOK_TYPES.includes(hookType)) {
					errors.push(`Unknown event type '${hookType}'`);
					continue;
				}

				const hookConfig = hooksConfig.hooks[hookType];
				if (!Array.isArray(hookConfig)) {
					errors.push(`Hook type '${hookType}' must be an array`);
					continue;
				}

				// Extract hook commands
				for (const hook of hookConfig) {
					if (!hook.hooks || !Array.isArray(hook.hooks)) {
						errors.push(
							`Hook type '${hookType}' missing 'hooks' array in configuration`,
						);
						continue;
					}

					for (const individualHook of hook.hooks) {
						if (individualHook.type === "command") {
							if (
								!individualHook.command ||
								typeof individualHook.command !== "string"
							) {
								errors.push(
									`Hook type '${hookType}' has command hook with missing or invalid command`,
								);
							} else {
								// Validate -- separator for han hook run
								if (
									individualHook.command.includes("han hook run") &&
									!individualHook.command.includes(" -- ")
								) {
									errors.push(
										`Hook command uses 'han hook run' but missing '--' separator`,
									);
								}

								// Add to hooks by type
								if (!hooksByType[hookType]) {
									hooksByType[hookType] = [];
								}
								hooksByType[hookType].push({
									plugin,
									command: individualHook.command,
								});
							}
						}
					}
				}
			}

			if (errors.length > 0) {
				validationResults.push({ plugin, errors });
			}
		} catch (error: unknown) {
			validationResults.push({
				plugin,
				errors: [
					`Failed to parse hooks.json: ${error instanceof Error ? error.message : String(error)}`,
				],
			});
		}
	}

	return { hooksByType, validationResults };
}

/**
 * Test all hooks in installed plugins
 */
export async function testHooks(options?: {
	execute?: boolean;
}): Promise<void> {
	const executeHooks = options?.execute ?? false;
	const action = executeHooks ? "Testing and executing" : "Validating";

	console.log(`🔍 ${action} hooks for installed plugins...\\n`);

	const marketplaceRoot = getMarketplaceRoot();
	if (!marketplaceRoot) {
		console.error("Error: Could not find marketplace root directory");
		console.error(
			"This usually means the Han marketplace is not installed yet.",
		);
		console.error('Run "han plugin install" first to set up the marketplace.');
		process.exit(1);
	}

	const projectPlugins = getInstalledPlugins("project");
	const localPlugins = getInstalledPlugins("local");
	const allPlugins = Array.from(new Set([...projectPlugins, ...localPlugins]));

	if (allPlugins.length === 0) {
		console.log("No plugins installed");
		process.exit(0);
	}

	// Collect all hooks grouped by type
	const { hooksByType, validationResults } = collectHooks(
		allPlugins,
		marketplaceRoot,
	);

	// Display validation results
	if (validationResults.length > 0) {
		console.log("\\n❌ Validation Errors:\\n");
		for (const result of validationResults) {
			console.error(`  ${result.plugin}:`);
			for (const error of result.errors) {
				console.error(`    - ${error}`);
			}
		}
		console.log();
		process.exit(1);
	}

	// Display what hooks were found
	const hookTypesFound = Object.keys(hooksByType);
	if (hookTypesFound.length === 0) {
		console.log("No hooks configured in any installed plugins");
		process.exit(0);
	}

	console.log("\\nFound hooks:");
	for (const hookType of hookTypesFound.sort()) {
		const count = hooksByType[hookType].length;
		const plugins = [
			...new Set(hooksByType[hookType].map((h) => h.plugin)),
		].join(", ");
		console.log(`  ${hookType}: ${count} hook(s) from ${plugins}`);
	}
	console.log();

	if (!executeHooks) {
		console.log("✅ All hooks validated successfully");
		console.log(
			"\\nTip: Run with --execute to test hook execution\\n");
		process.exit(0);
	}

	// Execute hooks by type (like Claude Code does)
	console.log("\\n🚀 Executing hooks...\\n");

	let hadFailures = false;

	for (const hookType of hookTypesFound.sort()) {
		const hooks = hooksByType[hookType];
		console.log(`\\n📌 Executing ${hookType} hooks (${hooks.length}):\\n`);

		// Run all hooks of this type in parallel (like Claude Code)
		const results = await Promise.all(
			hooks.map((hook) =>
				executeHookCommand(hook.command, hook.plugin, hookType),
			),
		);

		// Check for failures
		const failures = results.filter((r) => !r.success);
		if (failures.length > 0) {
			hadFailures = true;
			console.error(
				`\\n  ⚠️  ${failures.length}/${hooks.length} ${hookType} hook(s) failed\\n`,
			);
		} else {
			console.log(
				`\\n  ✓ All ${hooks.length} ${hookType} hook(s) passed\\n`,
			);
		}
	}

	console.log("\\n" + "=".repeat(60));
	if (hadFailures) {
		console.error("\\n❌ Some hooks failed execution\\n");
		process.exit(1);
	}
	console.log("\\n✅ All hooks executed successfully\\n");
}
