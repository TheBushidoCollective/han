import { MetricsStorage } from "../../metrics/storage.js";

/**
 * Lazy-load storage to avoid native binding issues in CI
 */
let storageInstance: MetricsStorage | null = null;
function getStorage(): MetricsStorage {
	if (!storageInstance) {
		storageInstance = new MetricsStorage();
	}
	return storageInstance;
}

interface HookFailureStats {
	name: string;
	source: string;
	total: number;
	failures: number;
	failureRate: number;
}

/**
 * Generate session context markdown for SessionStart injection
 */
export async function generateSessionContext(): Promise<void> {
	const storage = getStorage();

	// Query last 7 days of metrics
	const metrics = storage.queryMetrics({ period: "week" });

	// Query hook failure statistics
	const hookStats = await getHookFailureStats();

	// Generate markdown output
	const context = buildContextMarkdown(metrics, hookStats);

	console.log(context);
}

/**
 * Get hook failure statistics
 */
async function getHookFailureStats(): Promise<HookFailureStats[]> {
	const storage = getStorage();
	return storage.getHookFailureStats("week");
}

/**
 * Build context markdown
 */
function buildContextMarkdown(
	metrics: ReturnType<MetricsStorage["queryMetrics"]>,
	hookStats: HookFailureStats[],
): string {
	// Handle no data case
	if (metrics.total_tasks === 0) {
		return `## Getting Started with Metrics

No tasks tracked yet. The metrics system will track your work once you start using \`start_task()\`.

Use metrics tracking to improve calibration and identify patterns in your development work.
`;
	}

	const lines: string[] = [];

	lines.push("## Your Recent Performance (Last 7 Days)\n");

	// Overall stats
	const successRate = Math.round(metrics.success_rate * 100);
	const calibrationScore = Math.round(metrics.calibration_score * 100);

	lines.push(
		`- **Tasks**: ${metrics.completed_tasks} completed, ${successRate}% success rate`,
	);
	lines.push(
		`- **Calibration Score**: ${calibrationScore}% ${getCalibrationEmoji(calibrationScore)}`,
	);

	// Task type performance
	const bestType = getBestTaskType(metrics);
	const weakestType = getWeakestTaskType(metrics);

	if (bestType) {
		lines.push(
			`- **Best at**: \`${bestType.type}\` tasks (${Math.round(bestType.successRate * 100)}% success)`,
		);
	}

	if (weakestType && weakestType.type !== bestType?.type) {
		lines.push(
			`- **Needs improvement**: \`${weakestType.type}\` tasks (${Math.round(weakestType.successRate * 100)}% success)`,
		);
	}

	// Hook failure patterns
	if (hookStats.length > 0) {
		lines.push("\n### Common Hook Failures\n");

		for (const stat of hookStats) {
			lines.push(
				`- **${stat.name}** (${stat.source}): ${stat.failureRate}% failure rate (${stat.failures}/${stat.total})`,
			);
		}

		// Add specific guidance for the most problematic hook
		const mostProblematic = hookStats[0];
		if (mostProblematic) {
			const guidance = getHookSpecificGuidance(mostProblematic.name);
			if (guidance) {
				lines.push(`\n${guidance}`);
			}
		}
	}

	// Calibration guidance
	if (calibrationScore < 60) {
		lines.push("\n### Calibration Tips\n");
		const direction = getCalibrationDirection(metrics);
		lines.push(getCalibrationGuidance(direction, calibrationScore));
	}

	return lines.join("\n");
}

/**
 * Get best task type performance
 */
function getBestTaskType(
	metrics: ReturnType<MetricsStorage["queryMetrics"]>,
): { type: string; successRate: number } | null {
	const taskTypes = ["implementation", "fix", "refactor", "research"];
	let best: { type: string; successRate: number } | null = null;

	for (const type of taskTypes) {
		const typeTasks = metrics.tasks.filter((t) => t.type === type);
		if (typeTasks.length < 3) continue; // Need at least 3 tasks

		const successes = typeTasks.filter((t) => t.outcome === "success").length;
		const successRate = successes / typeTasks.length;

		if (!best || successRate > best.successRate) {
			best = { type, successRate };
		}
	}

	return best;
}

/**
 * Get weakest task type performance
 */
function getWeakestTaskType(
	metrics: ReturnType<MetricsStorage["queryMetrics"]>,
): { type: string; successRate: number } | null {
	const taskTypes = ["implementation", "fix", "refactor", "research"];
	let weakest: { type: string; successRate: number } | null = null;

	for (const type of taskTypes) {
		const typeTasks = metrics.tasks.filter((t) => t.type === type);
		if (typeTasks.length < 3) continue; // Need at least 3 tasks

		const successes = typeTasks.filter((t) => t.outcome === "success").length;
		const successRate = successes / typeTasks.length;

		if (!weakest || successRate < weakest.successRate) {
			weakest = { type, successRate };
		}
	}

	return weakest;
}

/**
 * Get calibration emoji
 */
function getCalibrationEmoji(score: number): string {
	if (score >= 85) return "🎯";
	if (score >= 70) return "📈";
	if (score >= 50) return "⚠️";
	return "🔴";
}

/**
 * Determine if overconfident or underconfident
 */
function getCalibrationDirection(
	metrics: ReturnType<MetricsStorage["queryMetrics"]>,
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
 * Get calibration guidance based on direction
 */
function getCalibrationGuidance(
	direction: "overconfident" | "underconfident" | "neutral",
	score: number,
): string {
	if (direction === "overconfident") {
		return `You tend to be **overconfident** - confidence ratings often higher than actual success.

**Recommendation:** Be more conservative. If you haven't personally run the hooks, max confidence should be 0.7.`;
	}

	if (direction === "underconfident") {
		return `You tend to be **underconfident** - you're doing better than you think!

**Recommendation:** Trust your implementation more. If hooks pass during development, confidence can be 0.8+.`;
	}

	return `Calibration score is low (${score}%). Focus on accurately predicting task outcomes.

**Recommendation:** Run validation hooks before completing tasks to better assess success likelihood.`;
}

/**
 * Get hook-specific guidance
 */
function getHookSpecificGuidance(hookName: string): string | null {
	const guidance: Record<string, string> = {
		"typescript-typecheck": `**TypeScript Tip:** Run \`npx -y --package typescript tsc\` during development, not just at completion. Common issues: missing imports, generic constraints, circular dependencies.`,

		"biome-lint": `**Biome Tip:** Run \`npx biome check --write .\` before marking complete. Biome is strict - fix all warnings, don't ignore them.`,

		"bun-test": `**Testing Tip:** Run \`bun test\` locally before completion. Update tests when changing behavior. Check for async timing issues.`,

		"check-commits": `**Commit Message Tip:** Follow conventional format: \`type(scope): description\`. Valid types: feat, fix, docs, refactor, test, chore.`,

		markdownlint: `**Markdown Tip:** Run \`npx markdownlint-cli --fix .\` before completion. Common issues: heading levels, line length, trailing spaces.`,
	};

	return guidance[hookName] || null;
}
