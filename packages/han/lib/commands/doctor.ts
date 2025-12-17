import { existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Command } from "commander";
import { getMergedHanConfig } from "../han-settings.ts";
import { tryGetNativeModule } from "../native.ts";
import { readGlobalSettings } from "../shared.ts";

interface DiagnosticResult {
	name: string;
	status: "ok" | "warning" | "error";
	message: string;
	details?: string[];
}

/**
 * Check binary location and version
 */
function checkBinary(): DiagnosticResult {
	const binaryPath = process.argv[1] || "unknown";
	const isReexec = process.env.HAN_REEXEC === "1";

	return {
		name: "Binary",
		status: "ok",
		message: binaryPath,
		details: isReexec ? ["Running via hanBinary re-exec"] : undefined,
	};
}

/**
 * Check hanBinary configuration
 */
function checkHanBinaryConfig(): DiagnosticResult {
	try {
		const config = getMergedHanConfig();
		if (config.hanBinary) {
			const isActive = process.env.HAN_REEXEC === "1";
			return {
				name: "hanBinary Override",
				status: isActive ? "ok" : "warning",
				message: config.hanBinary,
				details: isActive
					? ["Override is active"]
					: ["Override configured but not active (running directly)"],
			};
		}
		return {
			name: "hanBinary Override",
			status: "ok",
			message: "not configured",
		};
	} catch {
		return {
			name: "hanBinary Override",
			status: "ok",
			message: "not configured (no config file)",
		};
	}
}

/**
 * Check configuration files
 */
function checkConfigFiles(): DiagnosticResult {
	const configLocations = [
		{ path: join(homedir(), ".claude", "han.yml"), label: "~/.claude/han.yml" },
		{
			path: join(process.cwd(), ".claude", "han.yml"),
			label: ".claude/han.yml",
		},
		{
			path: join(process.cwd(), ".claude", "han.local.yml"),
			label: ".claude/han.local.yml",
		},
		{ path: join(process.cwd(), "han.yml"), label: "han.yml" },
	];

	const found: string[] = [];
	const notFound: string[] = [];

	for (const { path, label } of configLocations) {
		if (existsSync(path)) {
			found.push(`${label} ✓`);
		} else {
			notFound.push(`${label} ✗`);
		}
	}

	return {
		name: "Config Files",
		status: found.length > 0 ? "ok" : "warning",
		message: `${found.length} found`,
		details: [...found, ...notFound],
	};
}

/**
 * Check installed plugins
 */
function checkPlugins(): DiagnosticResult {
	const pluginsDir = join(
		homedir(),
		".claude",
		"plugins",
		"marketplaces",
		"han",
	);
	const pluginTypes = ["jutsu", "do", "hashi"];
	const installed: string[] = [];

	for (const type of pluginTypes) {
		const typeDir = join(pluginsDir, type);
		if (existsSync(typeDir)) {
			try {
				const { readdirSync } = require("node:fs");
				const plugins = readdirSync(typeDir);
				for (const plugin of plugins) {
					installed.push(`${type}/${plugin}`);
				}
			} catch {
				// Directory exists but can't read
			}
		}
	}

	// Also check bushido
	if (existsSync(join(pluginsDir, "bushido"))) {
		installed.unshift("bushido");
	}

	return {
		name: "Installed Plugins",
		status: installed.length > 0 ? "ok" : "warning",
		message: `${installed.length} plugins`,
		details: installed.length > 0 ? installed : ["No plugins installed"],
	};
}

/**
 * Check native module availability
 */
function checkNativeModule(): DiagnosticResult {
	const nativeModule = tryGetNativeModule();
	if (nativeModule) {
		return {
			name: "Native Module",
			status: "ok",
			message: "available",
		};
	}
	return {
		name: "Native Module",
		status: "warning",
		message: "not available",
		details: ["Some features may be limited without han-native"],
	};
}

/**
 * Check global settings for dispatch hooks
 */
function checkGlobalHooks(): DiagnosticResult {
	try {
		const settings = readGlobalSettings();
		const hooks = settings.hooks as Record<string, unknown[]> | undefined;

		const hookTypes = ["SessionStart", "UserPromptSubmit"];
		const configured: string[] = [];
		const missing: string[] = [];

		for (const hookType of hookTypes) {
			const hookList = hooks?.[hookType];
			if (hookList && Array.isArray(hookList) && hookList.length > 0) {
				configured.push(`${hookType} ✓`);
			} else {
				missing.push(`${hookType} ✗`);
			}
		}

		return {
			name: "Global Hooks",
			status: missing.length === 0 ? "ok" : "warning",
			message: `${configured.length}/${hookTypes.length} configured`,
			details: [...configured, ...missing],
		};
	} catch {
		return {
			name: "Global Hooks",
			status: "warning",
			message: "could not read settings",
		};
	}
}

/**
 * Check memory system status
 */
function checkMemorySystem(): DiagnosticResult {
	const memoryDir = join(homedir(), ".claude", "han", "memory");
	const indexDir = join(memoryDir, "index");
	const details: string[] = [];

	// Check index database
	const ftsDb = join(indexDir, "fts.db");
	if (existsSync(ftsDb)) {
		try {
			const stats = statSync(ftsDb);
			const sizeKb = Math.round(stats.size / 1024);
			details.push(`Index database: ${sizeKb} KB`);
		} catch {
			details.push("Index database: exists");
		}
	} else {
		details.push("Index database: not created");
	}

	// Check sessions directory
	const sessionsDir = join(memoryDir, "personal", "sessions");
	if (existsSync(sessionsDir)) {
		try {
			const { readdirSync } = require("node:fs");
			const sessions = readdirSync(sessionsDir).filter((f: string) =>
				f.endsWith(".jsonl"),
			);
			details.push(`Session files: ${sessions.length}`);
		} catch {
			details.push("Session files: directory exists");
		}
	} else {
		details.push("Session files: none");
	}

	const hasIndex = existsSync(ftsDb);
	return {
		name: "Memory System",
		status: hasIndex ? "ok" : "warning",
		message: hasIndex ? "initialized" : "not initialized",
		details,
	};
}

/**
 * Run all diagnostics and return results
 */
export function runDiagnostics(): DiagnosticResult[] {
	return [
		checkBinary(),
		checkHanBinaryConfig(),
		checkConfigFiles(),
		checkPlugins(),
		checkNativeModule(),
		checkGlobalHooks(),
		checkMemorySystem(),
	];
}

/**
 * Format diagnostic results for console output
 */
function formatResults(results: DiagnosticResult[]): string {
	const lines: string[] = [];
	lines.push("han doctor\n");

	for (const result of results) {
		const statusIcon =
			result.status === "ok" ? "✓" : result.status === "warning" ? "⚠" : "✗";
		const statusColor =
			result.status === "ok"
				? "\x1b[32m"
				: result.status === "warning"
					? "\x1b[33m"
					: "\x1b[31m";
		const reset = "\x1b[0m";

		lines.push(`${statusColor}${statusIcon}${reset} ${result.name}`);
		lines.push(`  ${result.message}`);

		if (result.details && result.details.length > 0) {
			for (const detail of result.details) {
				lines.push(`    ${detail}`);
			}
		}
		lines.push("");
	}

	const hasErrors = results.some((r) => r.status === "error");
	const hasWarnings = results.some((r) => r.status === "warning");

	if (hasErrors) {
		lines.push("\x1b[31m✗ Some checks failed\x1b[0m");
	} else if (hasWarnings) {
		lines.push("\x1b[33m⚠ Some checks have warnings\x1b[0m");
	} else {
		lines.push("\x1b[32m✓ All checks passed\x1b[0m");
	}

	return lines.join("\n");
}

/**
 * Register the doctor command
 */
export function registerDoctorCommand(program: Command): void {
	program
		.command("doctor")
		.description("Run diagnostics to check han configuration and status")
		.option("--json", "Output results as JSON")
		.action((options: { json?: boolean }) => {
			const results = runDiagnostics();

			if (options.json) {
				console.log(JSON.stringify(results, null, 2));
			} else {
				console.log(formatResults(results));
			}

			const hasErrors = results.some((r) => r.status === "error");
			process.exit(hasErrors ? 1 : 0);
		});
}
