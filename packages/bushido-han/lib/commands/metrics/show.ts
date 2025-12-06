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
		const scriptPath = fileURLToPath(import.meta.url);
		// Check for Bun binary path or other bundled environments
		return (
			scriptPath.includes("/$bunfs/") ||
			scriptPath.includes("/snapshot/") ||
			!scriptPath.includes("node_modules")
		);
	} catch {
		return false;
	}
}

/**
 * Show metrics dashboard
 */
export async function showMetrics(options: ShowMetricsOptions): Promise<void> {
	// Query metrics (this will create the database if it doesn't exist)
	const storage = new MetricsStorage();
	const query: MetricsQuery = {
		period: options.period,
		task_type: options.taskType,
	};

	try {
		const result = storage.queryMetrics(query);

		// Use plain text output when running from compiled binary
		// Ink has issues with module resolution in bundled environments
		if (isCompiledBinary()) {
			const { renderPlainText } = await import("./display-plain.js");
			renderPlainText(result, !!options.showCalibration);
		} else {
			const { render } = await import("ink");
			const React = await import("react");
			const { MetricsDisplay } = await import("./display.js");

			render(
				React.createElement(MetricsDisplay, {
					result,
					showCalibration: !!options.showCalibration,
				}),
			);
		}
	} finally {
		storage.close();
	}
}
