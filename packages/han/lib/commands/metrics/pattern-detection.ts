import { JsonlMetricsStorage } from "../../metrics/jsonl-storage.ts";

/**
 * Get storage instance
 */
let storageInstance: JsonlMetricsStorage | null = null;
function getStorage(): JsonlMetricsStorage {
	if (!storageInstance) {
		storageInstance = new JsonlMetricsStorage();
	}
	return storageInstance;
}

/**
 * Reset the storage instance (for testing)
 */
export function resetStorageInstance(): void {
	storageInstance = null;
}

export type Severity = "low" | "medium" | "high";

export interface Pattern {
	type: string;
	severity: Severity;
	message: string;
	guidance?: string;
}

/**
 * Detect failure patterns and generate guidance
 */
export async function detectPatterns(options: {
	minSeverity?: Severity;
	json?: boolean;
}): Promise<void> {
	const storage = getStorage();
	const patterns: Pattern[] = [];

	// Pattern 1: Consecutive failures (last 3 tasks)
	const recentTasks = storage
		.queryMetrics({})
		.tasks.sort(
			(a, b) =>
				new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
		)
		.slice(0, 3);

	if (
		recentTasks.length === 3 &&
		recentTasks.every((t) => t.outcome === "failure")
	) {
		patterns.push({
			type: "consecutive_failures",
			severity: "high",
			message: "Last 3 tasks all failed",
			guidance:
				"Review hook output carefully. Consider breaking tasks into smaller steps. If stuck, ask for user guidance.",
		});
	}

	// Pattern 2: Hook failure patterns
	const hookStats = storage.getHookFailureStats("week");
	for (const stat of hookStats) {
		if (stat.failureRate > 50) {
			patterns.push({
				type: "hook_failure_pattern",
				severity: "high",
				message: `Hook "${stat.name}" failing ${stat.failureRate}% of the time (${stat.failures}/${stat.total})`,
				guidance: getHookGuidance(stat.name),
			});
		} else if (stat.failureRate > 30) {
			patterns.push({
				type: "hook_failure_pattern",
				severity: "medium",
				message: `Hook "${stat.name}" failing ${stat.failureRate}% of the time (${stat.failures}/${stat.total})`,
				guidance: getHookGuidance(stat.name),
			});
		}
	}

	// Pattern 3: Calibration drift
	const weekMetrics = storage.queryMetrics({ period: "week" });
	if (weekMetrics.completed_tasks >= 5 && weekMetrics.calibration_score < 0.5) {
		const direction = determineCalibrationDirection(weekMetrics);
		patterns.push({
			type: "calibration_drift",
			severity: weekMetrics.calibration_score < 0.3 ? "high" : "medium",
			message: `Low calibration score: ${Math.round(weekMetrics.calibration_score * 100)}%`,
			guidance: getCalibrationGuidance(direction),
		});
	}

	// Filter by severity
	const minSeverityLevel = getSeverityLevel(options.minSeverity || "low");
	const filteredPatterns = patterns.filter(
		(p) => getSeverityLevel(p.severity) >= minSeverityLevel,
	);

	// Output
	if (options.json) {
		console.log(JSON.stringify({ patterns: filteredPatterns }, null, 2));
	} else if (filteredPatterns.length > 0) {
		const output = buildPatternMarkdown(filteredPatterns);
		console.log(output);
	}
	// No output if no patterns detected
}

/**
 * Get severity level as number for comparison
 */
export function getSeverityLevel(severity: Severity): number {
	switch (severity) {
		case "low":
			return 1;
		case "medium":
			return 2;
		case "high":
			return 3;
	}
}

/**
 * Build markdown output for patterns
 */
export function buildPatternMarkdown(patterns: Pattern[]): string {
	const lines: string[] = [];

	lines.push("⚠️ **Pattern Alert**\n");

	for (const pattern of patterns) {
		const emoji = pattern.severity === "high" ? "🔴" : "⚠️";
		lines.push(`${emoji} ${pattern.message}`);

		if (pattern.guidance) {
			lines.push(`\n${pattern.guidance}\n`);
		}
	}

	return lines.join("\n");
}

/**
 * Determine calibration direction
 */
function determineCalibrationDirection(
	metrics: ReturnType<JsonlMetricsStorage["queryMetrics"]>,
): "overconfident" | "underconfident" | "neutral" {
	const tasksWithConf = metrics.tasks.filter(
		(t) => t.outcome && t.confidence !== null && t.confidence !== undefined,
	);

	if (tasksWithConf.length === 0) return "neutral";

	let overconfidentCount = 0;
	let underconfidentCount = 0;

	for (const task of tasksWithConf) {
		const actualSuccess = task.outcome === "success" ? 1 : 0;
		const confidence = task.confidence ?? 0;
		const diff = confidence - actualSuccess;

		if (diff > 0.2) overconfidentCount++;
		if (diff < -0.2) underconfidentCount++;
	}

	if (overconfidentCount > underconfidentCount * 1.5) return "overconfident";
	if (underconfidentCount > overconfidentCount * 1.5) return "underconfident";
	return "neutral";
}

/**
 * Get calibration guidance
 */
function getCalibrationGuidance(
	direction: "overconfident" | "underconfident" | "neutral",
): string {
	if (direction === "overconfident") {
		return "**You're being overconfident.** Be more conservative with confidence ratings. If you haven't run hooks yourself, max confidence should be 0.7.";
	}

	if (direction === "underconfident") {
		return "**You're being underconfident.** Trust your implementation more. If hooks pass during development, confidence can be 0.8+.";
	}

	return "**Focus on calibration.** Run validation hooks before completing tasks to better assess success likelihood.";
}

/**
 * Get hook-specific guidance
 */
export function getHookGuidance(hookName: string): string {
	const guidance: Record<string, string> = {
		"typescript-typecheck":
			"**Tip:** Run `npx -y --package typescript tsc` during development, not just at completion.",
		"biome-lint":
			"**Tip:** Run `npx biome check --write .` before marking complete.",
		"bun-test":
			"**Tip:** Run `bun test` locally before completion. Update tests when changing behavior.",
		"check-commits":
			"**Tip:** Follow conventional format: `type(scope): description`. Valid types: feat, fix, docs, refactor, test, chore.",
		markdownlint:
			"**Tip:** Run `npx markdownlint-cli --fix .` before completion.",
	};

	return (
		guidance[hookName] ||
		`**Tip:** Review the output from ${hookName} and fix issues before completion.`
	);
}
