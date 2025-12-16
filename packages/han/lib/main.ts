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
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { HAN_VERSION } from "./build-info.generated.ts";
import { registerAliasCommands } from "./commands/aliases.ts";
import { registerCheckpointCommands } from "./commands/checkpoint/index.ts";
import {
	handleGetCompletions,
	registerCompletionCommand,
} from "./commands/completion/index.ts";
import { registerHookCommands } from "./commands/hook/index.ts";
import { registerIndexCommand } from "./commands/index/index.ts";
import { registerMcpCommands } from "./commands/mcp/index.ts";
import { registerMemoryCommand } from "./commands/memory/index.ts";
import { registerMetricsCommand } from "./commands/metrics/index.ts";
import { registerPluginCommands } from "./commands/plugin/index.ts";
import { explainHan } from "./explain.ts";
import { analyzeGaps } from "./gaps.ts";
import { generateSummary } from "./summary.ts";
import { initTelemetry, shutdownTelemetry } from "./telemetry/index.ts";

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
		.version(version);

	// Register command groups
	registerPluginCommands(program);
	registerHookCommands(program);
	registerMcpCommands(program);
	registerMemoryCommand(program);
	registerMetricsCommand(program);
	registerCheckpointCommands(program);
	registerIndexCommand(program);
	registerAliasCommands(program);
	registerCompletionCommand(program);

	// Register top-level explain command
	program
		.command("explain")
		.description("Show comprehensive overview of Han configuration")
		.action(async () => {
			try {
				await explainHan();
				if (!options.exitOverride) {
					process.exit(0);
				}
			} catch (error: unknown) {
				const message = `Error showing Han configuration: ${error instanceof Error ? error.message : error}`;
				if (!options.suppressOutput) {
					console.error(message);
				}
				if (!options.exitOverride) {
					process.exit(1);
				}
				throw error;
			}
		});

	// Register top-level summary command
	program
		.command("summary")
		.description("AI-powered summary of how Han is improving this repository")
		.action(async () => {
			try {
				await generateSummary();
				if (!options.exitOverride) {
					process.exit(0);
				}
			} catch (error: unknown) {
				const message = `Error generating summary: ${error instanceof Error ? error.message : error}`;
				if (!options.suppressOutput) {
					console.error(message);
				}
				if (!options.exitOverride) {
					process.exit(1);
				}
				throw error;
			}
		});

	// Register top-level gaps command
	program
		.command("gaps")
		.description(
			"AI-powered analysis of repository gaps and Han plugin recommendations",
		)
		.action(async () => {
			try {
				await analyzeGaps();
				if (!options.exitOverride) {
					process.exit(0);
				}
			} catch (error: unknown) {
				const message = `Error analyzing gaps: ${error instanceof Error ? error.message : error}`;
				if (!options.suppressOutput) {
					console.error(message);
				}
				if (!options.exitOverride) {
					process.exit(1);
				}
				throw error;
			}
		});

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
