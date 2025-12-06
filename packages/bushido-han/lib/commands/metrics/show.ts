import { fileURLToPath } from "node:url";
import { MetricsStorage } from "../../metrics/storage.js";
import type { MetricsQuery } from "../../metrics/types.js";

interface ShowMetricsOptions {
	period?: "day" | "week" | "month";
	taskType?: "implementation" | "fix" | "refactor" | "research";
	showCalibration?: boolean;
}

/**
 * Detect if running from compiled binary (Bun/pkg/etc)
 */
function isCompiledBinary(): boolean {
	try {
		// Check for Bun-specific global first (most reliable for Bun binaries)
		// biome-ignore lint/suspicious/noExplicitAny: checking for Bun runtime global
		if (typeof (globalThis as any).Bun !== "undefined") {
			const scriptPath = fileURLToPath(import.meta.url);
			// Bun can run .ts files directly, only consider it a binary if path is /$bunfs/
			if (
				scriptPath.includes("/$bunfs/") ||
				scriptPath.includes("/snapshot/")
			) {
				return true;
			}
		}

		const scriptPath = fileURLToPath(import.meta.url);

		// Check for pkg or other bundled environments
		if (scriptPath.includes("/pkg/")) {
			return true;
		}

		// If running from node_modules or dist with .js extension, it's NOT a binary
		return false;
	} catch {
		// If we can't determine, assume NOT a binary (safer for functionality)
		return false;
	}
}

/**
 * Show metrics dashboard
 */
export async function showMetrics(options: ShowMetricsOptions): Promise<void> {
	const isBinary = isCompiledBinary();

	// Binary builds don't support better-sqlite3 due to native module bundling issues
	// Direct users to use npx or local installation instead
	if (isBinary) {
		console.error(
			"\x1b[33m⚠ Metrics are not available in binary builds\x1b[0m\n",
		);
		console.error(
			"The metrics feature requires better-sqlite3, which uses native",
		);
		console.error("modules that cannot be bundled into standalone binaries.\n");
		console.error("\x1b[1mTo view metrics, use one of these methods:\x1b[0m\n");
		console.error(
			"  1. Via npm:   \x1b[36mnpx @thebushidocollective/han metrics\x1b[0m",
		);
		console.error(
			"  2. Via Node:  \x1b[36mnode dist/lib/main.js metrics\x1b[0m",
		);
		console.error(
			"  3. Install:   \x1b[36mnpm install -g @thebushidocollective/han && han metrics\x1b[0m\n",
		);
		process.exit(1);
	}

	// Query metrics (this will create the database if it doesn't exist)
	const storage = new MetricsStorage();
	const query: MetricsQuery = {
		period: options.period,
		task_type: options.taskType,
	};

	try {
		const result = storage.queryMetrics(query);

		// Try Ink UI, fall back to plain text if it fails
		try {
			const { render } = await import("ink");
			const React = await import("react");
			const { MetricsDisplay } = await import("./display.js");

			render(
				React.createElement(MetricsDisplay, {
					result,
					showCalibration: !!options.showCalibration,
				}),
			);
		} catch (_inkError) {
			// Fallback to plain text if Ink fails to load
			const { renderPlainText } = await import("./display-plain.js");
			renderPlainText(result, !!options.showCalibration);
		}
	} finally {
		storage.close();
	}
}
