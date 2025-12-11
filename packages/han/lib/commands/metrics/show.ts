import { render } from "ink";
import React from "react";
import { JsonlMetricsStorage } from "../../metrics/jsonl-storage.ts";
import type { MetricsQuery } from "../../metrics/types.ts";
import { MetricsDisplay } from "./display.tsx";
import { renderPlainText } from "./display-plain.ts";

interface ShowMetricsOptions {
	period?: "day" | "week" | "month";
	taskType?: "implementation" | "fix" | "refactor" | "research";
	showCalibration?: boolean;
}

/**
 * Show metrics dashboard
 */
export async function showMetrics(options: ShowMetricsOptions): Promise<void> {
	const storage = new JsonlMetricsStorage();
	const query: MetricsQuery = {
		period: options.period,
		task_type: options.taskType,
	};

	const result = storage.queryMetrics(query);
	const hookStats = storage.getHookFailureStats(options.period || "week");
	const allHookStats = storage.getAllHookStats(options.period || "week");
	const sessionMetrics = storage.querySessionMetrics(
		options.period || "week",
		10,
	);

	// Try Ink UI, fall back to plain text if it fails
	try {
		render(
			React.createElement(MetricsDisplay, {
				result,
				hookStats,
				allHookStats,
				sessionMetrics,
				showCalibration: !!options.showCalibration,
			}),
		);
	} catch (_inkError) {
		// Fallback to plain text if Ink fails to load
		renderPlainText(
			result,
			hookStats,
			allHookStats,
			sessionMetrics,
			!!options.showCalibration,
		);
	}
}
