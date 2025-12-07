import { readFileSync } from "node:fs";
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

interface HookExecutionData {
	hookType: string;
	hookName: string;
	hookSource?: string;
	durationMs: number;
	exitCode: number;
	passed: boolean;
	output?: string;
	error?: string;
	sessionId?: string;
	taskId?: string;
}

/**
 * Record a hook execution (reads from stdin)
 */
export async function recordHookExecution(): Promise<void> {
	try {
		// Read JSON from stdin
		const stdin = readFileSync(0, "utf-8");
		const data: HookExecutionData = JSON.parse(stdin);

		const storage = getStorage();

		// If no session ID provided, try to get current session
		let sessionId = data.sessionId;
		if (!sessionId) {
			const current = storage.getCurrentSession();
			sessionId = current?.session_id;
		}

		storage.recordHookExecution({
			sessionId,
			taskId: data.taskId,
			hookType: data.hookType,
			hookName: data.hookName,
			hookSource: data.hookSource,
			durationMs: data.durationMs,
			exitCode: data.exitCode,
			passed: data.passed,
			output: data.output,
			error: data.error,
		});

		console.log(JSON.stringify({ success: true }));
	} catch (error) {
		console.error("Failed to record hook execution:", error);
		process.exit(1);
	}
}

/**
 * Extract plugin name from plugin root path
 */
export function extractPluginName(pluginRoot: string): string {
	// Examples:
	// /path/to/plugins/marketplaces/han/jutsu/jutsu-typescript -> jutsu-typescript
	// /path/to/plugins/marketplaces/han/core -> core
	const parts = pluginRoot.split("/");
	return parts[parts.length - 1];
}
