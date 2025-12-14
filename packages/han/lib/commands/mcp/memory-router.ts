/**
 * Han Memory Query Router
 *
 * Provides a unified `memory` MCP tool that auto-routes questions
 * to the appropriate memory layer:
 * - Layer 1: Rules (.claude/rules/) - Project conventions
 * - Layer 2: Summaries (~/.claude/han/memory/summaries/) - Session overviews
 * - Layer 3: Observations (~/.claude/han/memory/sessions/) - Tool usage
 * - Layer 4: Transcripts (~/.claude/projects/) - Full conversations
 * - Layer 5: Team Memory (git history) - Commits, PRs, decisions
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getMemoryStore, type SessionSummary } from "../../memory/index.ts";
import { getGitRemote } from "../../memory/paths.ts";
import {
	searchTranscripts,
	searchTranscriptsText,
	type TranscriptSearchResult,
} from "../../memory/transcript-search.ts";
import {
	queryTeamMemory,
	type TeamQueryParams,
	type TeamQueryResult,
} from "./team-memory.ts";

/**
 * Question classification types
 */
export type QuestionType =
	| "personal_recent"
	| "personal_continue"
	| "personal_search"
	| "transcript_conversation"
	| "transcript_reasoning"
	| "team_expertise"
	| "team_temporal"
	| "team_decisions"
	| "team_changes"
	| "conventions"
	| "general";

/**
 * Memory layer types
 */
export type MemoryLayer =
	| "rules"
	| "summaries"
	| "observations"
	| "transcripts"
	| "team";

/**
 * Classification result
 */
export interface Classification {
	type: QuestionType;
	timeframe?: {
		start?: number;
		end?: number;
		description?: string;
	};
	focus?: string[];
}

/**
 * Memory query parameters (unified tool)
 */
export interface MemoryParams {
	question: string;
}

/**
 * Memory query result
 */
export interface MemoryResult {
	success: boolean;
	answer: string;
	source: "personal" | "team" | "rules" | "transcripts" | "combined";
	confidence: "high" | "medium" | "low";
	citations: Array<{
		source: string;
		excerpt: string;
		author?: string;
		timestamp?: number;
		layer?: MemoryLayer;
	}>;
	caveats: string[];
	layersSearched?: MemoryLayer[];
}

/**
 * Classify a question to determine which memory layer to query
 */
export function classifyQuestion(question: string): Classification {
	const q = question.toLowerCase();

	// Personal - recent sessions
	if (
		q.includes("i was") ||
		q.includes("what was i") ||
		q.includes("my recent") ||
		q.includes("my last session") ||
		q.includes("what did i")
	) {
		return { type: "personal_recent" };
	}

	// Personal - continue work
	if (
		q.includes("continue") ||
		q.includes("pick up") ||
		q.includes("left off") ||
		q.includes("resume") ||
		q.includes("where was i")
	) {
		return { type: "personal_continue" };
	}

	// Personal - search personal history
	if (
		q.includes("my work on") ||
		q.includes("did i ever") ||
		q.includes("have i worked on")
	) {
		return { type: "personal_search" };
	}

	// Transcript - conversation history queries
	if (
		q.includes("we discuss") ||
		q.includes("we talked about") ||
		q.includes("conversation about") ||
		q.includes("discussed") ||
		q.includes("you said") ||
		q.includes("i asked") ||
		q.includes("earlier session") ||
		q.includes("previous conversation") ||
		q.includes("chat history")
	) {
		return { type: "transcript_conversation" };
	}

	// Transcript - reasoning/thinking queries
	if (
		q.includes("why did you") ||
		q.includes("your reasoning") ||
		q.includes("how did you decide") ||
		q.includes("your thinking") ||
		q.includes("what was your approach")
	) {
		return { type: "transcript_reasoning" };
	}

	// Team - expertise queries
	if (
		q.includes("who knows") ||
		q.includes("who worked on") ||
		q.includes("who is expert") ||
		q.includes("who understands") ||
		q.includes("who implemented") ||
		q.includes("who created") ||
		q.includes("who wrote")
	) {
		return { type: "team_expertise" };
	}

	// Team - temporal queries
	const temporalResult = extractTimeframe(q);
	if (
		temporalResult &&
		(q.includes("what happened") ||
			q.includes("what changed") ||
			q.includes("what was done") ||
			q.includes("activity"))
	) {
		return {
			type: "team_temporal",
			timeframe: temporalResult,
		};
	}

	// Team - decision archaeology
	if (
		q.includes("decision") ||
		q.includes("why did we") ||
		q.includes("why was") ||
		q.includes("chose") ||
		q.includes("reason for") ||
		q.includes("rationale")
	) {
		return { type: "team_decisions" };
	}

	// Team - changes to specific areas
	if (
		q.includes("changes to") ||
		q.includes("history of") ||
		q.includes("evolution of") ||
		q.includes("how has") ||
		q.includes("what changes")
	) {
		return {
			type: "team_changes",
			timeframe: temporalResult || undefined,
		};
	}

	// Conventions - check rules first
	if (
		q.includes("convention") ||
		q.includes("how do we") ||
		q.includes("should we") ||
		q.includes("how should") ||
		q.includes("best practice") ||
		q.includes("our approach") ||
		q.includes("standard way")
	) {
		return { type: "conventions" };
	}

	// If temporal indicators present, treat as team temporal
	if (temporalResult) {
		return {
			type: "team_temporal",
			timeframe: temporalResult,
		};
	}

	// Default to general research
	return { type: "general" };
}

/**
 * Extract timeframe from question text
 */
export function extractTimeframe(
	text: string,
): Classification["timeframe"] | null {
	const now = Date.now();
	const day = 24 * 60 * 60 * 1000;
	const week = 7 * day;
	const month = 30 * day;

	const lower = text.toLowerCase();

	// Last N days/weeks/months
	const lastNMatch = lower.match(/last (\d+) (day|week|month)s?/);
	if (lastNMatch) {
		const n = Number.parseInt(lastNMatch[1], 10);
		const unit = lastNMatch[2];
		const multiplier = unit === "day" ? day : unit === "week" ? week : month;
		return {
			start: now - n * multiplier,
			description: `last ${n} ${unit}${n > 1 ? "s" : ""}`,
		};
	}

	// Simple temporal phrases
	if (lower.includes("last week") || lower.includes("past week")) {
		return { start: now - week, description: "last week" };
	}
	if (lower.includes("last month") || lower.includes("past month")) {
		return { start: now - month, description: "last month" };
	}
	if (lower.includes("yesterday")) {
		return { start: now - day, end: now, description: "yesterday" };
	}
	if (lower.includes("today")) {
		const startOfDay = new Date();
		startOfDay.setHours(0, 0, 0, 0);
		return { start: startOfDay.getTime(), description: "today" };
	}
	if (lower.includes("this week")) {
		const startOfWeek = new Date();
		startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
		startOfWeek.setHours(0, 0, 0, 0);
		return { start: startOfWeek.getTime(), description: "this week" };
	}
	if (lower.includes("this month")) {
		const startOfMonth = new Date();
		startOfMonth.setDate(1);
		startOfMonth.setHours(0, 0, 0, 0);
		return { start: startOfMonth.getTime(), description: "this month" };
	}
	if (lower.includes("recently") || lower.includes("recent")) {
		return { start: now - 2 * week, description: "recently" };
	}

	return null;
}

/**
 * Format recent sessions for personal memory
 */
function formatRecentSessions(sessions: SessionSummary[]): string {
	if (sessions.length === 0) {
		return "No recent sessions found.";
	}

	const lines: string[] = ["## Recent Sessions\n"];

	for (const session of sessions) {
		const date = new Date(session.started_at).toLocaleDateString();
		lines.push(`### ${date} - ${session.project || "Unknown Project"}`);
		lines.push(session.summary);

		if (session.work_items && session.work_items.length > 0) {
			lines.push("\n**Work completed:**");
			for (const item of session.work_items) {
				const status = item.outcome === "completed" ? "+" : "~";
				lines.push(`- [${status}] ${item.description}`);
			}
		}

		if (session.in_progress && session.in_progress.length > 0) {
			lines.push("\n**In progress:**");
			for (const item of session.in_progress) {
				lines.push(`- [ ] ${item}`);
			}
		}

		lines.push("");
	}

	return lines.join("\n");
}

/**
 * Format continuation context from most recent session
 */
function formatContinuationContext(session: SessionSummary): string {
	const lines: string[] = ["## Continue From Last Session\n"];

	const date = new Date(session.started_at).toLocaleDateString();
	lines.push(`**Last session:** ${date}`);
	lines.push(`**Project:** ${session.project || "Unknown"}`);
	lines.push(`\n${session.summary}\n`);

	if (session.in_progress && session.in_progress.length > 0) {
		lines.push("### Still In Progress");
		for (const item of session.in_progress) {
			lines.push(`- [ ] ${item}`);
		}
		lines.push("");
	}

	if (session.decisions && session.decisions.length > 0) {
		lines.push("### Recent Decisions");
		for (const decision of session.decisions) {
			lines.push(`- **${decision.description}**`);
			if (decision.rationale) {
				lines.push(`  _Rationale: ${decision.rationale}_`);
			}
		}
		lines.push("");
	}

	return lines.join("\n");
}

/**
 * Check .claude/rules/ for relevant conventions
 */
function checkRules(question: string): string | null {
	const rulesPath = join(process.cwd(), ".claude", "rules");

	if (!existsSync(rulesPath)) {
		return null;
	}

	try {
		const files = readdirSync(rulesPath).filter((f) => f.endsWith(".md"));
		const questionLower = question.toLowerCase();
		const matches: Array<{ file: string; content: string; score: number }> = [];

		for (const file of files) {
			const filePath = join(rulesPath, file);
			const content = readFileSync(filePath, "utf-8");
			const contentLower = content.toLowerCase();

			// Calculate relevance score
			const questionWords = questionLower
				.split(/\s+/)
				.filter((w) => w.length > 3);
			let matchCount = 0;
			for (const word of questionWords) {
				if (contentLower.includes(word)) {
					matchCount++;
				}
			}

			if (matchCount > 0) {
				const score = matchCount / questionWords.length;
				matches.push({ file, content, score });
			}
		}

		if (matches.length === 0) {
			return null;
		}

		// Sort by score and return top matches
		matches.sort((a, b) => b.score - a.score);

		const lines: string[] = ["## Relevant Conventions\n"];
		const topMatches = matches.slice(0, 3);

		for (const match of topMatches) {
			lines.push(`### From \`.claude/rules/${match.file}\`\n`);
			// Extract first 500 chars of content
			const excerpt =
				match.content.length > 500
					? `${match.content.slice(0, 500)}...`
					: match.content;
			lines.push(excerpt);
			lines.push("");
		}

		return lines.join("\n");
	} catch {
		return null;
	}
}

/**
 * Query personal memory (recent sessions)
 */
async function queryPersonalMemory(
	type: "recent" | "continue" | "search",
	_searchText?: string,
): Promise<MemoryResult> {
	const store = getMemoryStore();

	try {
		if (type === "recent") {
			const sessions = store.getRecentSessions(5);
			return {
				success: true,
				answer: formatRecentSessions(sessions),
				source: "personal",
				confidence: sessions.length > 0 ? "high" : "low",
				citations: sessions.map((s) => ({
					source: `session:${s.session_id}`,
					excerpt: s.summary,
					timestamp: s.started_at,
				})),
				caveats:
					sessions.length === 0
						? ["No session history found. This may be your first session."]
						: [],
			};
		}

		if (type === "continue") {
			const sessions = store.getRecentSessions(1);
			if (sessions.length === 0) {
				return {
					success: true,
					answer: "No recent sessions found to continue from.",
					source: "personal",
					confidence: "low",
					citations: [],
					caveats: ["This appears to be your first session in this project."],
				};
			}

			return {
				success: true,
				answer: formatContinuationContext(sessions[0]),
				source: "personal",
				confidence: "high",
				citations: [
					{
						source: `session:${sessions[0].session_id}`,
						excerpt: sessions[0].summary,
						timestamp: sessions[0].started_at,
					},
				],
				caveats: [],
			};
		}

		// Search not yet implemented - fallback to recent
		const sessions = store.getRecentSessions(10);
		return {
			success: true,
			answer: formatRecentSessions(sessions),
			source: "personal",
			confidence: "medium",
			citations: sessions.map((s) => ({
				source: `session:${s.session_id}`,
				excerpt: s.summary,
				timestamp: s.started_at,
			})),
			caveats: [
				"Personal search not yet implemented. Showing recent sessions.",
			],
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			success: false,
			answer: `Failed to query personal memory: ${message}`,
			source: "personal",
			confidence: "low",
			citations: [],
			caveats: [],
		};
	}
}

/**
 * Convert team query result to unified memory result
 */
function teamResultToMemoryResult(result: TeamQueryResult): MemoryResult {
	return {
		success: result.success,
		answer: result.answer,
		source: "team",
		confidence: result.confidence,
		citations: result.citations.map((c) => ({ ...c, layer: "team" as const })),
		caveats: result.caveats,
		layersSearched: ["team"],
	};
}

/**
 * Format transcript search results for display
 */
function formatTranscriptResults(
	results: TranscriptSearchResult[],
	query: string,
): string {
	if (results.length === 0) {
		return `No transcript results found for "${query}".`;
	}

	const lines: string[] = ["## Transcript Search Results\n"];

	for (const result of results) {
		const date = result.timestamp
			? new Date(result.timestamp).toLocaleDateString()
			: "Unknown date";
		const roleLabel = result.type === "user" ? "User" : "Assistant";
		const peerIndicator = result.isPeerWorktree ? " (peer worktree)" : "";

		lines.push(`### ${date} - ${roleLabel}${peerIndicator}`);
		lines.push(`_Session: ${result.sessionId}_`);
		lines.push("");
		lines.push(result.excerpt);
		lines.push("");
	}

	return lines.join("\n");
}

/**
 * Query transcript history
 */
async function queryTranscripts(
	question: string,
	includeThinking = false,
): Promise<MemoryResult> {
	try {
		const gitRemote = getGitRemote() || undefined;

		// Try FTS search first, fall back to text search
		let results: TranscriptSearchResult[];
		try {
			results = await searchTranscripts({
				query: question,
				gitRemote,
				limit: 10,
				scope: "peers", // Search current and peer worktrees
				includeThinking,
			});
		} catch {
			// Fall back to text-based search
			results = searchTranscriptsText({
				query: question,
				gitRemote,
				limit: 10,
				scope: "peers",
				includeThinking,
			});
		}

		if (results.length === 0) {
			return {
				success: true,
				answer: `No relevant conversations found for "${question}".`,
				source: "transcripts",
				confidence: "low",
				citations: [],
				caveats: [
					"No matching transcripts found. Try different keywords or check if transcripts have been indexed.",
				],
				layersSearched: ["transcripts"],
			};
		}

		return {
			success: true,
			answer: formatTranscriptResults(results, question),
			source: "transcripts",
			confidence: results[0].score > 0.5 ? "high" : "medium",
			citations: results.map((r) => ({
				source: `transcript:${r.sessionId}`,
				excerpt: r.excerpt.slice(0, 200),
				timestamp: r.timestamp ? new Date(r.timestamp).getTime() : undefined,
				layer: "transcripts" as const,
			})),
			caveats: results.some((r) => r.isPeerWorktree)
				? ["Some results are from peer worktrees (same git repository)."]
				: [],
			layersSearched: ["transcripts"],
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			success: false,
			answer: `Failed to search transcripts: ${message}`,
			source: "transcripts",
			confidence: "low",
			citations: [],
			caveats: [],
			layersSearched: ["transcripts"],
		};
	}
}

/**
 * Query memory with auto-routing
 */
export async function queryMemory(params: MemoryParams): Promise<MemoryResult> {
	const { question } = params;

	if (!question || question.trim().length === 0) {
		return {
			success: false,
			answer: "Question cannot be empty.",
			source: "personal",
			confidence: "low",
			citations: [],
			caveats: [],
		};
	}

	const classification = classifyQuestion(question);

	// Route based on classification
	switch (classification.type) {
		case "personal_recent":
			return queryPersonalMemory("recent");

		case "personal_continue":
			return queryPersonalMemory("continue");

		case "personal_search":
			return queryPersonalMemory("search", question);

		case "transcript_conversation":
			return queryTranscripts(question, false);

		case "transcript_reasoning":
			return queryTranscripts(question, true);

		case "conventions": {
			// Check rules first
			const rules = checkRules(question);
			if (rules) {
				return {
					success: true,
					answer: rules,
					source: "rules",
					confidence: "high",
					citations: [],
					caveats: ["Answer based on project conventions in .claude/rules/"],
					layersSearched: ["rules"],
				};
			}
			// Fall through to team memory
			const teamResult = await queryTeamMemory({ question });
			return teamResultToMemoryResult(teamResult);
		}

		case "team_expertise":
		case "team_decisions":
		case "team_changes":
		case "general": {
			const teamResult = await queryTeamMemory({ question });
			return teamResultToMemoryResult(teamResult);
		}

		case "team_temporal": {
			// Include timeframe in team query
			const teamParams: TeamQueryParams = { question };
			// Timeframe would be passed to team memory for filtering
			// For now, include in question context
			const teamResult = await queryTeamMemory(teamParams);
			return teamResultToMemoryResult(teamResult);
		}

		default: {
			// General fallback to team memory
			const teamResult = await queryTeamMemory({ question });
			return teamResultToMemoryResult(teamResult);
		}
	}
}

/**
 * Format memory result for display
 */
export function formatMemoryResult(result: MemoryResult): string {
	const lines: string[] = [];

	// Source indicator
	const sourceLabels: Record<MemoryResult["source"], string> = {
		personal: "Personal Memory",
		team: "Team Memory",
		rules: "Project Conventions",
		transcripts: "Conversation History",
		combined: "Combined Sources",
	};
	const sourceIcon = sourceLabels[result.source];

	const confidenceEmoji =
		result.confidence === "high"
			? "high"
			: result.confidence === "medium"
				? "medium"
				: "low";

	lines.push(`**Source:** ${sourceIcon} | **Confidence:** ${confidenceEmoji}`);
	lines.push("");
	lines.push(result.answer);

	if (result.citations.length > 0 && result.source !== "rules") {
		lines.push("\n---\n**Sources:**");
		for (const citation of result.citations.slice(0, 5)) {
			const author = citation.author ? ` (${citation.author})` : "";
			const date = citation.timestamp
				? new Date(citation.timestamp).toLocaleDateString()
				: "";
			lines.push(`- ${citation.source}${author}${date ? ` - ${date}` : ""}`);
		}
	}

	if (result.caveats.length > 0) {
		lines.push("\n_Notes:_");
		for (const caveat of result.caveats) {
			lines.push(`- _${caveat}_`);
		}
	}

	return lines.join("\n");
}
