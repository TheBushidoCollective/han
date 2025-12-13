/**
 * Session summarization logic
 *
 * Extracts patterns from raw observations to create session summaries
 * without AI - uses simple heuristics and pattern matching.
 */

import { getGitRemote } from "./paths.ts";
import type { MemoryStore } from "./storage.ts";
import type {
	Decision,
	RawObservation,
	SessionSummary,
	WorkItem,
} from "./types.ts";

export interface SummarizeOptions {
	/**
	 * Automatically store the summary after generation
	 */
	autoStore?: boolean;
}

/**
 * Create a session summary from observations
 *
 * Uses pattern extraction to identify:
 * - Work items from file modifications
 * - In-progress work from reads without edits
 * - Decisions from research + implementation patterns
 */
export function summarizeSession(
	sessionId: string,
	store: MemoryStore,
	options: SummarizeOptions = {},
): SessionSummary | null {
	const observations = store.getSessionObservations(sessionId);

	if (observations.length === 0) {
		return null;
	}

	const started_at = observations[0].timestamp;
	const ended_at = observations[observations.length - 1].timestamp;

	// Extract work items from file modifications
	const work_items = extractWorkItems(observations);

	// Identify in-progress work from reads without corresponding edits
	const in_progress = extractInProgress(observations, work_items);

	// Extract decisions from research + implementation patterns
	const decisions = extractDecisions(observations);

	// Generate high-level summary
	const summary = generateSummaryText(observations, work_items);

	// Get project name from git remote or use fallback
	const gitRemote = getGitRemote();
	const project = gitRemote ? extractProjectName(gitRemote) : "unknown";

	const sessionSummary: SessionSummary = {
		session_id: sessionId,
		project,
		started_at,
		ended_at,
		summary,
		work_items,
		in_progress,
		decisions,
	};

	if (options.autoStore) {
		store.storeSessionSummary(sessionId, sessionSummary);
	}

	return sessionSummary;
}

/**
 * Extract work items from file modifications
 */
function extractWorkItems(observations: RawObservation[]): WorkItem[] {
	const fileGroups = new Map<string, string[]>();

	// Group files by common prefix/directory
	for (const obs of observations) {
		if (obs.files_modified.length === 0) continue;

		for (const file of obs.files_modified) {
			const key = getFileGroupKey(file);
			if (!fileGroups.has(key)) {
				fileGroups.set(key, []);
			}
			const group = fileGroups.get(key);
			if (group && !group.includes(file)) {
				group.push(file);
			}
		}
	}

	// Create work items for each group
	const workItems: WorkItem[] = [];
	for (const [key, files] of fileGroups.entries()) {
		const description = generateWorkDescription(key, files);
		const outcome = determineOutcome(files, observations);

		workItems.push({
			description,
			files,
			outcome,
		});
	}

	return workItems;
}

/**
 * Get a grouping key for a file based on directory and component name
 */
function getFileGroupKey(file: string): string {
	// Extract component name from file path
	// e.g., "src/components/LoginForm.tsx" -> "LoginForm"
	// e.g., "src/auth/login.ts" -> "auth"

	const parts = file.split("/");
	const fileName = parts[parts.length - 1];
	const baseName = fileName.split(".")[0];

	// If in test directory, group by test subject
	if (
		file.includes("/test/") ||
		fileName.includes(".test.") ||
		fileName.includes(".spec.")
	) {
		return baseName.replace(/\.(test|spec)$/, "");
	}

	// Group by directory + base name for related files
	const directory = parts.length > 1 ? parts[parts.length - 2] : "";
	return directory ? `${directory}/${baseName}` : baseName;
}

/**
 * Generate work description from file group
 */
function generateWorkDescription(key: string, files: string[]): string {
	const hasTests = files.some(
		(f) => f.includes("/test/") || f.includes(".test.") || f.includes(".spec."),
	);
	const hasSource = files.some(
		(f) => !f.includes("/test/") && !f.includes(".test."),
	);

	const componentName = key.split("/").pop() || key;

	if (hasTests && hasSource) {
		return `Implemented ${componentName} with tests`;
	}
	if (hasTests) {
		return `Added tests for ${componentName}`;
	}

	// Infer action from file path patterns
	if (files.some((f) => f.includes("auth"))) {
		return `Updated authentication: ${componentName}`;
	}
	if (files.some((f) => f.includes("payment"))) {
		return `Updated payments: ${componentName}`;
	}
	if (files.some((f) => f.includes("component"))) {
		return `Updated component: ${componentName}`;
	}

	return `Updated ${componentName}`;
}

/**
 * Determine outcome based on subsequent observations
 */
function determineOutcome(
	files: string[],
	observations: RawObservation[],
): WorkItem["outcome"] {
	// Check if tests or builds failed after modifications
	const relevantObs = observations.filter((obs) =>
		files.some((f) => obs.files_modified.includes(f)),
	);

	if (relevantObs.length === 0) return "completed";

	// Find observations after the last file modification
	const lastModTime = Math.max(...relevantObs.map((obs) => obs.timestamp));
	const afterMods = observations.filter((obs) => obs.timestamp > lastModTime);

	// Check for error indicators
	const hasErrors = afterMods.some(
		(obs) =>
			obs.output_summary.toLowerCase().includes("error") ||
			obs.output_summary.toLowerCase().includes("failed") ||
			obs.output_summary.toLowerCase().includes("fail:"),
	);

	if (hasErrors) {
		return "partial";
	}

	// Check for explicit success indicators
	const hasSuccess = afterMods.some(
		(obs) =>
			obs.output_summary.toLowerCase().includes("pass") ||
			obs.output_summary.toLowerCase().includes("success") ||
			obs.output_summary.toLowerCase().includes("ok"),
	);

	return hasSuccess ? "completed" : "completed";
}

/**
 * Extract in-progress work from reads without edits
 */
function extractInProgress(
	observations: RawObservation[],
	workItems: WorkItem[],
): string[] {
	const inProgress: Set<string> = new Set();
	const modifiedFiles = new Set(workItems.flatMap((item) => item.files));

	// Group consecutive reads by area
	let currentArea: string | null = null;
	let currentFiles: string[] = [];

	for (const obs of observations) {
		if (obs.tool === "Read" && obs.files_read.length > 0) {
			const file = obs.files_read[0];

			// Skip if this file was modified (it's completed work)
			if (modifiedFiles.has(file)) continue;

			const area = extractAreaFromPath(file);
			if (area !== currentArea) {
				if (currentArea && currentFiles.length > 0) {
					inProgress.add(`Investigating ${currentArea}`);
				}
				currentArea = area;
				currentFiles = [file];
			} else {
				currentFiles.push(file);
			}
		}
	}

	// Add final area
	if (currentArea && currentFiles.length > 0) {
		inProgress.add(`Investigating ${currentArea}`);
	}

	// Check for blocked work (reads with errors)
	const blockedReads = observations.filter(
		(obs) =>
			obs.tool === "Read" &&
			(obs.output_summary.toLowerCase().includes("not found") ||
				obs.output_summary.toLowerCase().includes("error")),
	);

	if (blockedReads.length > 0) {
		const areas = blockedReads.map((obs) =>
			extractAreaFromPath(obs.input_summary),
		);
		for (const area of areas) {
			inProgress.add(`Blocked: ${area}`);
		}
	}

	return Array.from(inProgress);
}

/**
 * Extract area/topic from file path or description
 */
function extractAreaFromPath(pathOrDesc: string): string {
	// Extract meaningful keywords
	const lower = pathOrDesc.toLowerCase();

	if (lower.includes("auth")) return "authentication";
	if (lower.includes("payment")) return "payments";
	if (lower.includes("user")) return "user management";
	if (lower.includes("api")) return "API";
	if (lower.includes("component")) return "components";
	if (lower.includes("test")) return "testing";
	if (lower.includes("doc")) return "documentation";

	// Extract from path structure
	const parts = pathOrDesc.split("/");
	if (parts.length > 1) {
		const dir = parts[parts.length - 2];
		return dir;
	}

	return "code";
}

/**
 * Extract decisions from research + implementation patterns
 */
function extractDecisions(observations: RawObservation[]): Decision[] {
	const decisions: Decision[] = [];

	// Look for research followed by implementation
	for (let i = 0; i < observations.length - 1; i++) {
		const current = observations[i];
		const next = observations[i + 1];

		// Pattern: WebSearch/research followed by Write/Edit
		if (
			(current.tool === "WebSearch" || current.tool === "Read") &&
			(next.tool === "Write" || next.tool === "Edit")
		) {
			const topic = extractTopicFromResearch(current);
			if (topic) {
				decisions.push({
					description: `Chose ${topic} approach`,
					rationale: current.output_summary,
				});
			}
		}
	}

	return decisions;
}

/**
 * Extract topic from research observation
 */
function extractTopicFromResearch(obs: RawObservation): string | null {
	const summary = obs.input_summary.toLowerCase();

	// Extract key technical terms
	if (summary.includes("jwt")) return "JWT";
	if (summary.includes("session")) return "session-based auth";
	if (summary.includes("oauth")) return "OAuth";
	if (summary.includes("graphql")) return "GraphQL";
	if (summary.includes("rest")) return "REST API";
	if (summary.includes("websocket")) return "WebSocket";
	if (summary.includes("redux")) return "Redux";
	if (summary.includes("context")) return "React Context";

	return null;
}

/**
 * Generate summary text from observations
 */
function generateSummaryText(
	_observations: RawObservation[],
	workItems: WorkItem[],
): string {
	if (workItems.length === 0) {
		return "Explored codebase";
	}

	// Extract key terms from all work
	const allText = workItems
		.map((item) => `${item.description} ${item.files.join(" ")}`)
		.join(" ")
		.toLowerCase();

	// Look for specific topics in the combined text
	const topics: string[] = [];

	if (allText.includes("register") || allText.includes("registration")) {
		topics.push("user registration");
	}
	if (allText.includes("login") || allText.includes("auth")) {
		topics.push("authentication");
	}
	if (allText.includes("payment")) {
		topics.push("payments");
	}
	if (allText.includes("validation")) {
		topics.push("validation");
	}
	if (allText.includes("component")) {
		topics.push("UI components");
	}
	if (allText.includes("test")) {
		topics.push("testing");
	}

	if (topics.length > 0) {
		return `Worked on ${topics.join(", ")}`;
	}

	// Fallback to area-based summary
	const areas = new Set<string>();
	for (const item of workItems) {
		const area = extractAreaFromWorkItem(item);
		areas.add(area);
	}

	if (areas.size === 1) {
		const area = Array.from(areas)[0];
		return `Worked on ${area}`;
	}

	return `Worked on ${Array.from(areas).join(", ")}`;
}

/**
 * Extract area from work item
 */
function extractAreaFromWorkItem(item: WorkItem): string {
	const desc = item.description.toLowerCase();

	if (desc.includes("auth")) return "authentication";
	if (desc.includes("payment")) return "payments";
	if (desc.includes("user")) return "user management";
	if (desc.includes("component")) return "UI components";
	if (desc.includes("test")) return "testing";
	if (desc.includes("api")) return "API";

	// Use first word after "Updated" or "Implemented"
	const match = desc.match(/(?:updated|implemented)\s+(\w+)/);
	if (match) return match[1];

	return "features";
}

/**
 * Extract project name from git remote
 */
function extractProjectName(gitRemote: string): string {
	// Extract repo name from git remote
	// git@github.com:org/repo.git -> repo
	// https://github.com/org/repo -> repo

	const match = gitRemote.match(/[/:]([\w-]+)(\.git)?$/);
	if (match) {
		return match[1];
	}

	return "unknown";
}
