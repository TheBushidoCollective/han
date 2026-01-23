#!/usr/bin/env node
/**
 * Han CLI - Binary-Only Distribution
 *
 * This package is distributed as platform-specific Bun binaries.
 * The npm package contains only the bin/han.js wrapper which loads
 * the appropriate binary for the current platform.
 *
 * Metrics feature uses bun:sqlite (built-in) for binary compatibility.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { HAN_VERSION } from "./build-info.generated.ts";
import { registerAliasCommands } from "./commands/aliases.ts";
import { registerBlueprintsCommands } from "./commands/blueprints/index.ts";
import { browse } from "./commands/browse/index.ts";
import {
	handleGetCompletions,
	registerCompletionCommand,
} from "./commands/completion/index.ts";
import { registerCoordinatorCommands } from "./commands/coordinator/index.ts";
import { registerDoctorCommand } from "./commands/doctor.ts";
import { registerHookCommands } from "./commands/hook/index.ts";
import { registerReindexCommand } from "./commands/index/index.ts";
import { registerMcpCommands } from "./commands/mcp/index.ts";
import { registerMemoryCommand } from "./commands/memory/index.ts";
import { registerPluginCommands } from "./commands/plugin/index.ts";
import { getMergedHanConfig } from "./config/han-settings.ts";
import { initTelemetry, shutdownTelemetry } from "./telemetry/index.ts";

/**
 * Get extended version information including binary location and config status.
 */
export function getVersionInfo(): string {
	const lines = [`han ${version}`];

	// Show binary location
	const binaryPath = process.argv[1] || "unknown";
	lines.push(`  Binary: ${binaryPath}`);

	// Check hanBinary configuration
	try {
		const config = getMergedHanConfig();
		if (config.hanBinary) {
			const isActive = process.env.HAN_REEXEC === "1";
			lines.push(
				`  hanBinary: ${config.hanBinary}${isActive ? " (active)" : ""}`,
			);
		}
	} catch {
		// Config loading failed, skip hanBinary info
	}

	return lines.join("\n");
}

/**
 * Check if we should re-exec to a different han binary.
 * This allows development setups to redirect all han commands to a local version.
 *
 * @returns Object with reexec flag and binary path if re-exec is needed
 */
export function shouldReexec(): { reexec: boolean; binary?: string } {
	// Skip if we're already a re-exec (prevent infinite loops)
	if (process.env.HAN_REEXEC === "1") {
		return { reexec: false };
	}

	// Skip for --version and --help (show current binary info)
	const args = process.argv.slice(2);
	if (
		args.includes("--version") ||
		args.includes("-V") ||
		args.includes("--help") ||
		args.includes("-h") ||
		args.includes("doctor")
	) {
		return { reexec: false };
	}

	let config: ReturnType<typeof getMergedHanConfig>;
	try {
		config = getMergedHanConfig();
	} catch {
		// Config loading failed, don't re-exec
		return { reexec: false };
	}

	if (!config.hanBinary) {
		return { reexec: false };
	}

	// Check if hanBinary points to a different binary
	const currentBinary = process.argv[1]; // Current script path
	if (config.hanBinary === "han" || config.hanBinary === currentBinary) {
		return { reexec: false };
	}

	// Check if the configured binary matches our current location
	// e.g., "bun run /path/to/main.ts" should match when we're running from that path
	if (currentBinary && config.hanBinary.includes(currentBinary)) {
		return { reexec: false };
	}

	return { reexec: true, binary: config.hanBinary };
}

/**
 * Re-exec to a different han binary if configured.
 * This function never returns if re-exec happens.
 */
export function maybeReexec(): void {
	const { reexec, binary } = shouldReexec();
	if (reexec && binary) {
		const args = process.argv.slice(2);
		const result = spawnSync(binary, args, {
			stdio: "inherit",
			env: { ...process.env, HAN_REEXEC: "1" },
			shell: true,
		});
		process.exit(result.status ?? 0);
	}
}

/**
 * Options for creating the CLI program.
 * Used primarily for testing to prevent process.exit() and suppress output.
 */
export interface MakeProgramOptions {
	/** Throw CommanderError instead of calling process.exit() */
	exitOverride?: boolean;
	/** Suppress stdout/stderr output */
	suppressOutput?: boolean;
	/** Custom write function for stdout (for capturing output in tests) */
	writeOut?: (str: string) => void;
	/** Custom write function for stderr (for capturing output in tests) */
	writeErr?: (str: string) => void;
}

// Version is injected at build time for binary builds, otherwise read from package.json
const version = (() => {
	if (HAN_VERSION) {
		return HAN_VERSION;
	}
	try {
		const __dirname = dirname(fileURLToPath(import.meta.url));
		const packageJson = JSON.parse(
			readFileSync(join(__dirname, "..", "..", "package.json"), "utf-8"),
		);
		return packageJson.version;
	} catch {
		return "0.0.0-unknown";
	}
})();

/**
 * Create a fresh Command instance for the Han CLI.
 * Returns a new instance each time, enabling test isolation.
 *
 * @param options - Configuration options for testing
 * @returns Configured Command instance
 *
 * @example
 * // Normal CLI usage (in main.ts)
 * const program = makeProgram();
 * program.parse();
 *
 * @example
 * // Testing usage
 * const program = makeProgram({ exitOverride: true, suppressOutput: true });
 * await program.parseAsync(["node", "han", "plugin", "list"]);
 */
export function makeProgram(options: MakeProgramOptions = {}): Command {
	const program = new Command();

	// Configure for testing if requested
	if (options.exitOverride) {
		program.exitOverride();
	}

	if (options.suppressOutput || options.writeOut || options.writeErr) {
		program.configureOutput({
			writeOut: options.suppressOutput
				? () => {}
				: (options.writeOut ?? ((str) => process.stdout.write(str))),
			writeErr: options.suppressOutput
				? () => {}
				: (options.writeErr ?? ((str) => process.stderr.write(str))),
		});
	}

	program
		.name("han")
		.description("Utilities for The Bushido Collective's Han Code Marketplace")
		.version(getVersionInfo(), "-V, --version", "output the version number");

	// Register command groups
	registerPluginCommands(program);
	registerHookCommands(program);
	registerMcpCommands(program);
	registerBlueprintsCommands(program);
	registerMemoryCommand(program);
	registerReindexCommand(program);
	registerAliasCommands(program);
	registerCompletionCommand(program);
	registerDoctorCommand(program);

	// Register browse command
	program
		.command("browse")
		.description("Start the Han system browser dashboard")
		.option("-p, --port <port>", "Port to run the server on", "41956")
		.option("--no-open", "Don't automatically open the browser")
		.option(
			"-l, --local",
			"Run local dev server with HTTP (for offline use; default: open remote dashboard)",
		)
		.action(async (opts) => {
			try {
				await browse({
					port: parseInt(opts.port, 10),
					autoOpen: opts.open !== false,
					local: opts.local === true,
				});
			} catch (error: unknown) {
				const message = `Error starting browse server: ${error instanceof Error ? error.message : error}`;
				if (!options.suppressOutput) {
					console.error(message);
				}
				if (!options.exitOverride) {
					process.exit(1);
				}
				throw error;
			}
		});

	// Register coordinator commands (includes launchd management on macOS)
	registerCoordinatorCommands(program);

	return program;
}

// Only parse when run directly (not when imported for testing)
// Check if this file is the main module being executed
const isMainModule = (() => {
	try {
		const currentFile = fileURLToPath(import.meta.url);
		const mainFile = process.argv[1];
		// Handle both direct execution and bun run scenarios
		return (
			currentFile === mainFile ||
			mainFile?.endsWith("main.ts") ||
			mainFile?.endsWith("han")
		);
	} catch {
		return true; // Default to running if we can't determine
	}
})();

if (isMainModule) {
	// Check if we should re-exec to a configured hanBinary
	// This must happen BEFORE any other processing
	maybeReexec();

	// Handle --get-completions before Commander.js parsing
	// This is used by shell completion scripts for dynamic completions
	const getCompletionsIndex = process.argv.indexOf("--get-completions");
	if (getCompletionsIndex !== -1) {
		const words = process.argv.slice(getCompletionsIndex + 1);
		handleGetCompletions(words)
			.then(() => process.exit(0))
			.catch(() => process.exit(1));
	} else {
		// Initialize OpenTelemetry if enabled
		initTelemetry();

		// Setup graceful shutdown
		process.on("beforeExit", async () => {
			await shutdownTelemetry();
		});

		const program = makeProgram();
		program.parse();
	}
}
