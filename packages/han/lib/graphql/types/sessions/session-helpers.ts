/**
 * Session Helper Functions
 *
 * Helper functions for working with sessions.
 */

import {
	getSessionAsync,
	listSessions,
	listSessionsAsync,
} from "../../../api/sessions.ts";
import {
	applyConnectionArgs,
	type ConnectionArgs,
	encodeCursor,
} from "../pagination.ts";
import type { SessionConnectionData } from "../session-connection.ts";
import { getAgentTask, getAgentTasksForSession } from "./session-type.ts";

/**
 * Get all sessions
 */
export function getAllSessions(params: URLSearchParams) {
	return listSessions(params);
}

/**
 * Get a session by ID (async - reads from database)
 */
export async function getSessionById(id: string) {
	return getSessionAsync(id);
}

/**
 * Get agent task IDs for a session
 */
export function getAgentTaskIds(sessionId: string): string[] {
	return getAgentTasksForSession(sessionId);
}

/**
 * Get agent task by ID
 */
export function getAgentTaskById(sessionId: string, agentId: string) {
	return getAgentTask(sessionId, agentId);
}

/**
 * Get sessions with cursor-based pagination from database
 */
export async function getSessionsConnection(
	args: ConnectionArgs & {
		projectId?: string | null;
		worktreeName?: string | null;
	},
): Promise<SessionConnectionData> {
	const startTime = Date.now();

	// Build params for the underlying listSessions function
	const params = new URLSearchParams();

	// Set a large page size to get all sessions for cursor-based filtering
	// In production, you'd want to optimize this with proper database cursors
	params.set("pageSize", "1000");

	if (args.projectId) {
		params.set("projectId", args.projectId);
	}
	if (args.worktreeName) {
		params.set("worktree", args.worktreeName);
	}

	// Use async version that reads from database
	const listStart = Date.now();
	const result = await listSessionsAsync(params);
	const listEnd = Date.now();
	console.log(
		`[getSessionsConnection] listSessionsAsync took ${listEnd - listStart}ms, returned ${result.data.length} sessions`,
	);

	// Filter out sessions with no messages
	const filterStart = Date.now();
	const sessions = result.data.filter((s) => s.messageCount > 0);
	const filterEnd = Date.now();
	console.log(
		`[getSessionsConnection] Filtering took ${filterEnd - filterStart}ms, ${sessions.length} sessions with messages`,
	);

	// Apply cursor-based pagination
	const paginationStart = Date.now();
	const connection = applyConnectionArgs(sessions, args, (session) =>
		encodeCursor(
			"session",
			session.sessionId,
			session.startedAt ? new Date(session.startedAt).getTime() : undefined,
		),
	);
	const paginationEnd = Date.now();
	console.log(
		`[getSessionsConnection] Pagination took ${paginationEnd - paginationStart}ms`,
	);

	const totalTime = Date.now() - startTime;
	console.log(`[getSessionsConnection] Total time: ${totalTime}ms`);

	return connection;
}
