import { execSync } from "node:child_process";
import { dirname } from "node:path";
import { globby } from "globby";
import {
	getPluginNameFromRoot,
	type ResolvedHookConfig,
	resolveHookConfigs,
} from "./hook-config.js";

interface ValidateOptions {
	failFast: boolean;
	dirsWith: string | null;
	testDir?: string | null;
	command: string;
	stdinData?: string | null;
}

// Find directories containing marker files using globby (respects nested .gitignore files)
async function findDirectoriesWithMarker(
	rootDir: string,
	markerPatterns: string[],
): Promise<string[]> {
	// Convert marker patterns to glob patterns
	const globPatterns = markerPatterns.map((pattern) => `**/${pattern}`);

	// Use globby to find all matching files, respecting .gitignore files
	const matches = await globby(globPatterns, {
		cwd: rootDir,
		gitignore: true, // Respect all nested .gitignore files
		ignore: [".git/**"], // Only hardcode .git as ignored
		absolute: true,
		onlyFiles: true,
	});

	// Extract unique directories from matched files
	const dirs = [...new Set(matches.map((file) => dirname(file)))];
	return dirs;
}

// Run command in directory
function runCommand(
	dir: string,
	cmd: string,
	stdinData?: string | null,
): boolean {
	try {
		execSync(cmd, {
			cwd: dir,
			// If stdinData provided, pipe it; otherwise ignore stdin entirely
			stdio: stdinData
				? ["pipe", "inherit", "inherit"]
				: ["ignore", "inherit", "inherit"],
			input: stdinData || undefined,
			encoding: "utf8",
			shell: "/bin/sh",
			env: process.env,
		});
		return true;
	} catch (_e) {
		return false;
	}
}

// Run test command silently in directory (returns true if exit code 0)
function testDirCommand(dir: string, cmd: string): boolean {
	try {
		execSync(cmd, {
			cwd: dir,
			stdio: ["ignore", "ignore", "ignore"],
			encoding: "utf8",
			shell: "/bin/sh",
			env: process.env,
		});
		return true;
	} catch (_e) {
		return false;
	}
}

export async function validate(options: ValidateOptions): Promise<void> {
	const {
		failFast,
		dirsWith,
		testDir,
		command: commandToRun,
		stdinData,
	} = options;

	// Main execution
	const rootDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

	let targetDirs: string[];

	if (!dirsWith) {
		// No dirsWith specified - run in current directory only
		targetDirs = [rootDir];
	} else {
		// Parse comma-delimited patterns
		const patterns = dirsWith.split(",").map((p) => p.trim());

		// Find directories with marker files (respects nested .gitignore files)
		targetDirs = await findDirectoriesWithMarker(rootDir, patterns);

		// Filter directories using test command if specified
		if (testDir && targetDirs.length > 0) {
			targetDirs = targetDirs.filter((dir) => testDirCommand(dir, testDir));
		}

		if (targetDirs.length === 0) {
			console.log(`No directories found with ${dirsWith}`);
			process.exit(0);
		}
	}

	const failures: string[] = [];

	for (const dir of targetDirs) {
		const success = runCommand(dir, commandToRun, stdinData);

		if (!success) {
			const relativePath = dir.replace(`${rootDir}/`, "");
			failures.push(relativePath);

			console.error(
				`\nFailed when trying to run \`${commandToRun}\` in directory: \`${relativePath}\`\n`,
			);

			if (failFast) {
				process.exit(2);
			}
		}
	}

	if (failures.length > 0) {
		console.error(
			`\n❌ ${failures.length} director${failures.length === 1 ? "y" : "ies"} failed validation:\n`,
		);
		for (const dir of failures) {
			console.error(`  - ${dir}`);
		}
		process.exit(2);
	}

	console.log(
		`\n✅ All ${targetDirs.length} director${targetDirs.length === 1 ? "y" : "ies"} passed validation`,
	);
	process.exit(0);
}

/**
 * Options for running a configured hook
 */
export interface RunConfiguredHookOptions {
	hookName: string;
	failFast: boolean;
	stdinData?: string | null;
}

/**
 * Run a hook using plugin config and user overrides.
 * This is the new format: `han hook run <hookName> [--fail-fast]`
 */
export async function runConfiguredHook(
	options: RunConfiguredHookOptions,
): Promise<void> {
	const { hookName, failFast, stdinData } = options;

	const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
	const projectRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();

	if (!pluginRoot) {
		console.error(
			"Error: CLAUDE_PLUGIN_ROOT environment variable is not set.\n" +
				"This command must be run from within a Claude Code hook context.",
		);
		process.exit(1);
	}

	const pluginName = getPluginNameFromRoot(pluginRoot);

	// Resolve all hook configs (finds directories, applies user overrides)
	const configs = await resolveHookConfigs(pluginRoot, hookName, projectRoot);

	if (configs.length === 0) {
		console.log(
			`No directories found for hook "${hookName}" in plugin "${pluginName}"`,
		);
		process.exit(0);
	}

	// Filter to only enabled hooks
	const enabledConfigs = configs.filter((c) => c.enabled);

	if (enabledConfigs.length === 0) {
		console.log(
			`All directories have hook "${hookName}" disabled via han-config.yml`,
		);
		process.exit(0);
	}

	const failures: Array<{ dir: string; command: string }> = [];

	for (const config of enabledConfigs) {
		const relativePath = config.directory.replace(`${projectRoot}/`, "");
		console.log(`Running "${config.command}" in ${relativePath}...`);

		const success = runCommand(config.directory, config.command, stdinData);

		if (!success) {
			failures.push({ dir: relativePath, command: config.command });

			console.error(
				`\nFailed when trying to run \`${config.command}\` in directory: \`${relativePath}\`\n`,
			);

			if (failFast) {
				process.exit(2);
			}
		}
	}

	if (failures.length > 0) {
		console.error(
			`\n❌ ${failures.length} director${failures.length === 1 ? "y" : "ies"} failed:\n`,
		);
		for (const failure of failures) {
			console.error(`  - ${failure.dir}`);
		}
		process.exit(2);
	}

	console.log(
		`\n✅ All ${enabledConfigs.length} director${enabledConfigs.length === 1 ? "y" : "ies"} passed`,
	);
	process.exit(0);
}
