import { MetricsStorage } from "../../metrics/storage.js";
import type { MetricsQuery } from "../../metrics/types.js";

interface ShowMetricsOptions {
	period?: "day" | "week" | "month";
	taskType?: "implementation" | "fix" | "refactor" | "research";
	showCalibration?: boolean;
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
