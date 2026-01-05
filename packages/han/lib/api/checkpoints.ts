/**
 * Checkpoints API
 *
 * Reads checkpoint information from the han checkpoints directory.
 * Uses the new path structure: ~/.claude/projects/{project-slug}/{session-id}/checkpoint.json
 */

import {
	type Checkpoint,
	type CheckpointInfo,
	listCheckpoints as listCheckpointsFromHooks,
	loadCheckpoint,
} from "../hooks/index.ts";

export interface CheckpointSummary {
	id: string;
	type: "session" | "agent";
	createdAt: string;
	fileCount: number;
	patternCount: number;
	patterns: string[];
	path: string;
}

/**
 * Convert a CheckpointInfo to CheckpointSummary with full details
 */
function toCheckpointSummary(info: CheckpointInfo): CheckpointSummary | null {
	const checkpoint = loadCheckpoint(info.type, info.id);
	if (!checkpoint) {
		return null;
	}

	return {
		id: info.id,
		type: info.type,
		createdAt: info.createdAt,
		fileCount: info.fileCount,
		patternCount: checkpoint.patterns.length,
		patterns: checkpoint.patterns,
		path: info.path,
	};
}

/**
 * List all checkpoints for the current project
 */
export function listCheckpointSummaries(): CheckpointSummary[] {
	const checkpointInfos = listCheckpointsFromHooks();

	const summaries: CheckpointSummary[] = [];
	for (const info of checkpointInfos) {
		const summary = toCheckpointSummary(info);
		if (summary) {
			summaries.push(summary);
		}
	}

	return summaries;
}

/**
 * Get checkpoint stats
 */
export function getCheckpointStats(): {
	totalCheckpoints: number;
	sessionCheckpoints: number;
	agentCheckpoints: number;
	totalFiles: number;
} {
	const checkpoints = listCheckpointsFromHooks();

	return {
		totalCheckpoints: checkpoints.length,
		sessionCheckpoints: checkpoints.filter((c) => c.type === "session").length,
		agentCheckpoints: checkpoints.filter((c) => c.type === "agent").length,
		totalFiles: checkpoints.reduce((sum, c) => sum + c.fileCount, 0),
	};
}

/**
 * Get a specific checkpoint by type and id
 */
export function getCheckpoint(
	type: "session" | "agent",
	id: string,
): Checkpoint | null {
	return loadCheckpoint(type, id);
}

/**
 * Get a session checkpoint by session ID
 */
export function getSessionCheckpoint(
	sessionId: string,
): CheckpointSummary | null {
	const allCheckpoints = listCheckpointSummaries();

	// Find session checkpoint that matches the session ID
	const checkpoint = allCheckpoints.find(
		(c) => c.type === "session" && c.id === sessionId,
	);

	return checkpoint || null;
}

/**
 * Get all checkpoints related to a session (session + agent checkpoints)
 */
export function getCheckpointsForSession(
	sessionId: string,
): CheckpointSummary[] {
	const allCheckpoints = listCheckpointSummaries();

	// Filter checkpoints that match the session ID pattern
	return allCheckpoints.filter(
		(c) => c.id === sessionId || c.id.startsWith(`${sessionId}_`),
	);
}

/**
 * Get checkpoints for multiple sessions in a batch (for DataLoader)
 *
 * Fetches all checkpoints once and groups by session ID.
 * Used by the GraphQL DataLoader to batch checkpoint lookups.
 *
 * @param sessionIds - Array of session IDs to fetch checkpoints for
 * @returns Map of sessionId -> checkpoints array
 */
export async function getCheckpointsBySessionIds(
	sessionIds: string[],
): Promise<Map<string, CheckpointSummary[]>> {
	// Fetch all checkpoints once (more efficient than N individual calls)
	const allCheckpoints = listCheckpointSummaries();

	// Group checkpoints by session ID
	const result = new Map<string, CheckpointSummary[]>();

	// Initialize all requested session IDs with empty arrays
	for (const sessionId of sessionIds) {
		result.set(sessionId, []);
	}

	// Distribute checkpoints to their sessions
	for (const checkpoint of allCheckpoints) {
		for (const sessionId of sessionIds) {
			if (
				checkpoint.id === sessionId ||
				checkpoint.id.startsWith(`${sessionId}_`)
			) {
				const existing = result.get(sessionId) || [];
				existing.push(checkpoint);
				result.set(sessionId, existing);
			}
		}
	}

	return result;
}
