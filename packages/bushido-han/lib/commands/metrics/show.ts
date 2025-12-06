import { existsSync } from "node:fs";
import { render } from "ink";
import React from "react";
import { getMetricsDbPath, MetricsStorage } from "../../metrics/storage.js";
import type { MetricsQuery } from "../../metrics/types.js";
import { MetricsDisplay } from "./display.js";

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

		// Render Ink UI
		render(
			React.createElement(MetricsDisplay, {
				result,
				showCalibration: !!options.showCalibration,
			}),
		);
	} finally {
		storage.close();
	}
}
