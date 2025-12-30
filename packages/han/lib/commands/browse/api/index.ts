/**
 * API Router for Memory Browse Feature
 *
 * Routes API requests to appropriate handlers:
 * - /api/sessions - Session observations
 * - /api/summaries - Session summaries
 * - /api/rules - Project and user rules
 * - /api/team - Team memory search
 * - /api/transcripts - Transcript search
 * - /api/search - Global memory search (all layers)
 */

import { handleRulesRequest } from "./rules.ts";
import { handleSearchRequest } from "./search.ts";
import { handleSessionsRequest } from "./sessions.ts";
import { handleSummariesRequest } from "./summaries.ts";
import { handleTeamRequest } from "./team.ts";
import { handleTranscriptsRequest } from "./transcripts.ts";

/**
 * Standard error response format
 */
export interface ApiError {
	error: string;
	details?: string;
}

/**
 * Route API requests to appropriate handlers
 */
export async function handleApiRequest(req: Request): Promise<Response> {
	const url = new URL(req.url);
	const path = url.pathname;

	// Route to appropriate handler based on path prefix
	if (path.startsWith("/api/sessions")) {
		return handleSessionsRequest(req);
	}

	if (path.startsWith("/api/summaries")) {
		return handleSummariesRequest(req);
	}

	if (path.startsWith("/api/rules")) {
		return handleRulesRequest(req);
	}

	if (path.startsWith("/api/team")) {
		return handleTeamRequest(req);
	}

	if (path.startsWith("/api/transcripts")) {
		return handleTranscriptsRequest(req);
	}

	if (path.startsWith("/api/search")) {
		return handleSearchRequest(req);
	}

	// Unknown API endpoint
	return new Response(
		JSON.stringify({
			error: "Not found",
			details: `Unknown API endpoint: ${path}`,
		} satisfies ApiError),
		{
			status: 404,
			headers: { "Content-Type": "application/json" },
		},
	);
}

// Re-export types
export type { RuleContent, RuleFile } from "./rules.ts";
// Re-export handlers for direct use
export { handleRulesRequest } from "./rules.ts";
export type {
	Citation,
	MemorySearchParams,
	MemorySearchResponse,
} from "./search.ts";
export { handleSearchRequest, searchMemory } from "./search.ts";
export type {
	PaginatedResponse,
	SessionDetail,
	SessionListItem,
} from "./sessions.ts";
export { handleSessionsRequest } from "./sessions.ts";
export { handleSummariesRequest } from "./summaries.ts";
export type { TeamSearchResponse, TeamSearchResult } from "./team.ts";
export { handleTeamRequest } from "./team.ts";
export type { TranscriptSearchResponse } from "./transcripts.ts";
export { handleTranscriptsRequest } from "./transcripts.ts";
