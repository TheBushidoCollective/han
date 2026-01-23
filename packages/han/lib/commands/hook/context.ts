/**
 * Hook Context Command
 *
 * Consolidates session-id, session-context, and memory-context for SessionStart injection.
 * Outputs all contextual information needed at the start of a Claude Code session.
 */

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Command } from "commander";
import { hookExecutions, tasks } from "../../db/index.ts";
import { injectSessionContext } from "../../memory/index.ts";

/**
 * Hook payload from Claude Code containing session context
 */
interface SessionPayload {
	session_id?: string;
	[key: string]: unknown;
}

/**
 * Check if stdin has data available.
 */
function hasStdinData(): boolean {
	try {
		if (process.stdin.isTTY) {
			return false;
		}
		const { fstatSync } = require("node:fs");
		const stat = fstatSync(0);
		return stat.isFile() || stat.isFIFO() || stat.isSocket();
	} catch {
		return false;
	}
}

/**
 * Read and parse session payload from stdin
 */
function readPayload(): SessionPayload | null {
	try {
		if (!hasStdinData()) {
			return null;
		}
		const stdin = readFileSync(0, "utf-8");
		if (stdin.trim()) {
			return JSON.parse(stdin) as SessionPayload;
		}
	} catch {
		// stdin not available or invalid JSON
	}
	return null;
}

/**
 * Get calibration emoji based on score
 */
function getCalibrationEmoji(score: number): string {
	if (score >= 85) return "🎯";
	if (score >= 70) return "📈";
	if (score >= 50) return "⚠️";
	return "🔴";
}

/**
 * Generate performance context from database
 */
async function generatePerformanceContext(
	_sessionId: string,
): Promise<string | null> {
	try {
		// Query task metrics from database
		const metrics = await tasks.queryMetrics({ period: "week" });

		// Query hook stats
		const hookStats = await hookExecutions.queryStats("week");

		// No data case
		if (metrics.totalTasks === 0) {
			return null;
		}

		const lines: string[] = [];
		lines.push("## Your Recent Performance (Last 7 Days)\n");

		// Overall stats
		const successRate = Math.round(metrics.successRate * 100);
		const calibrationScore = Math.round((metrics.calibrationScore ?? 0) * 100);

		lines.push(
			`- **Tasks**: ${metrics.completedTasks} completed, ${successRate}% success rate`,
		);
		lines.push(
			`- **Calibration Score**: ${calibrationScore}% ${getCalibrationEmoji(calibrationScore)}`,
		);

		// Task type breakdown if available
		if (metrics.byType) {
			const types = Object.entries(metrics.byType);
			const sorted = types.sort(
				(a, b) =>
					(b[1] as { successRate?: number }).successRate ??
					0 - ((a[1] as { successRate?: number }).successRate ?? 0),
			);
			if (sorted.length > 0) {
				const [bestType, bestStats] = sorted[0];
				const bestRate = Math.round(
					((bestStats as { successRate?: number }).successRate ?? 0) * 100,
				);
				lines.push(
					`- **Best at**: \`${bestType}\` tasks (${bestRate}% success)`,
				);
			}
			if (sorted.length > 1) {
				const [worstType, worstStats] = sorted[sorted.length - 1];
				const worstRate = Math.round(
					((worstStats as { successRate?: number }).successRate ?? 0) * 100,
				);
				if (worstRate < 80) {
					lines.push(
						`- **Needs improvement**: \`${worstType}\` tasks (${worstRate}% success)`,
					);
				}
			}
		}

		// Hook failure patterns
		if (hookStats.totalExecutions > 0 && hookStats.totalFailed > 0) {
			const failureRate = Math.round(
				(hookStats.totalFailed / hookStats.totalExecutions) * 100,
			);
			if (failureRate > 10) {
				lines.push(`\n### Hook Status\n`);
				lines.push(
					`- ${hookStats.totalFailed}/${hookStats.totalExecutions} hook failures (${failureRate}%)`,
				);
			}
		}

		// Calibration guidance
		if (calibrationScore < 60) {
			lines.push("\n### Calibration Tips\n");
			lines.push(
				"Your calibration score is low. Focus on accurately predicting task outcomes.",
			);
			lines.push(
				"Run validation hooks before completing tasks to better assess success likelihood.",
			);
		}

		return lines.join("\n");
	} catch (error) {
		if (process.env.DEBUG) {
			console.error(
				"Performance context error:",
				error instanceof Error ? error.message : error,
			);
		}
		return null;
	}
}

/**
 * Generate memory context
 */
function generateMemoryContextOutput(): string | null {
	try {
		return injectSessionContext();
	} catch (error) {
		if (process.env.DEBUG) {
			console.error(
				"Memory context error:",
				error instanceof Error ? error.message : error,
			);
		}
		return null;
	}
}

/**
 * Output consolidated context for SessionStart
 */
async function outputContext(): Promise<void> {
	const payload = readPayload();
	const sessionId = payload?.session_id ?? randomUUID();

	// Output session ID in XML format
	console.log(`<session-id>${sessionId}</session-id>\n`);

	// Query existing SQLite database directly - DO NOT start coordinator during SessionStart
	// This prevents 30+ second delays when coordinator is slow to start
	// The coordinator will start lazily when actually needed
	try {
		const perfContext = await generatePerformanceContext(sessionId);
		if (perfContext) {
			console.log(perfContext);
			console.log("");
		}
	} catch {
		// Skip metrics on error - don't block session start
	}

	// Output memory context
	const memContext = generateMemoryContextOutput();
	if (memContext) {
		console.log(memContext);
	}
}

/**
 * Register the context command
 */
export function registerHookContext(hookCommand: Command): void {
	hookCommand
		.command("context")
		.description(
			"Output consolidated session context for SessionStart injection.\n" +
				"Includes: session ID, performance metrics, and memory context.",
		)
		.action(async () => {
			try {
				await outputContext();
			} catch (error) {
				// Silent failure for context - don't break session start
				if (process.env.DEBUG) {
					console.error(
						"Context error:",
						error instanceof Error ? error.message : error,
					);
				}
			}
		});
}
