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
import { queryTeamMemory, type TeamQueryResult } from "./team-memory.ts";

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
 * Classify a question - simplified to just detect personal session queries
 *
 * The hook (memory-confidence.md) guides Claude on WHEN to use memory.
 * This router just needs to detect personal session questions vs everything else.
 */
export function classifyQuestion(question: string): Classification {
	const q = question.toLowerCase();

	// Personal - recent sessions (what was I working on?)
	if (
		q.includes("i was") ||
		q.includes("what was i") ||
		q.includes("my recent") ||
		q.includes("my last session") ||
		q.includes("what did i")
	) {
		return { type: "personal_recent" };
	}

	// Personal - continue work (pick up where I left off)
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

	// Everything else: search all layers (rules, transcripts, team)
	// The hook tells Claude when to call memory; we just search effectively
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
 * Layer search result for combining
 */
interface LayerResult {
	layer: MemoryLayer;
	result: MemoryResult | null;
	hasContent: boolean;
}

/**
 * Search all layers in parallel and combine results
 * Every question searches everything - return what's relevant
 */
async function searchAllLayers(question: string): Promise<MemoryResult> {
	const layersSearched: MemoryLayer[] = [];
	const layerResults: LayerResult[] = [];

	// Race all layers in parallel
	const [rulesResult, summariesResult, transcriptsResult, teamResult] =
		await Promise.all([
			// Layer 1: Rules (.claude/rules/)
			(async (): Promise<LayerResult> => {
				const rules = checkRules(question);
				layersSearched.push("rules");
				if (rules) {
					return {
						layer: "rules",
						result: {
							success: true,
							answer: rules,
							source: "rules",
							confidence: "high",
							citations: [],
							caveats: ["From project conventions in .claude/rules/"],
							layersSearched: ["rules"],
						},
						hasContent: true,
					};
				}
				return { layer: "rules", result: null, hasContent: false };
			})(),

			// Layer 2: Summaries (personal session history)
			(async (): Promise<LayerResult> => {
				try {
					const store = getMemoryStore();
					const sessions = store.getRecentSessions(5);
					layersSearched.push("summaries");

					if (sessions.length === 0) {
						return { layer: "summaries", result: null, hasContent: false };
					}

					// Check if question is relevant to session content
					const questionLower = question.toLowerCase();
					const relevantSessions = sessions.filter((s) => {
						const summaryLower = s.summary.toLowerCase();
						const questionWords = questionLower
							.split(/\s+/)
							.filter((w) => w.length > 3);
						return questionWords.some((word) => summaryLower.includes(word));
					});

					if (relevantSessions.length === 0) {
						return { layer: "summaries", result: null, hasContent: false };
					}

					return {
						layer: "summaries",
						result: {
							success: true,
							answer: formatRecentSessions(relevantSessions),
							source: "personal",
							confidence: "medium",
							citations: relevantSessions.map((s) => ({
								source: `session:${s.session_id}`,
								excerpt: s.summary,
								timestamp: s.started_at,
							})),
							caveats: ["From recent session history"],
							layersSearched: ["summaries"],
						},
						hasContent: true,
					};
				} catch {
					layersSearched.push("summaries");
					return { layer: "summaries", result: null, hasContent: false };
				}
			})(),

			// Layer 4: Transcripts (conversation history)
			(async (): Promise<LayerResult> => {
				try {
					const result = await queryTranscripts(question, false);
					layersSearched.push("transcripts");
					const hasContent =
						result.success &&
						result.confidence !== "low" &&
						result.citations.length > 0;
					return { layer: "transcripts", result, hasContent };
				} catch {
					layersSearched.push("transcripts");
					return { layer: "transcripts", result: null, hasContent: false };
				}
			})(),

			// Layer 5: Team memory (git/PRs)
			(async (): Promise<LayerResult> => {
				try {
					const teamQueryResult = await queryTeamMemory({ question });
					const result = teamResultToMemoryResult(teamQueryResult);
					layersSearched.push("team");
					const hasContent =
						result.success &&
						result.confidence !== "low" &&
						result.citations.length > 0;
					return { layer: "team", result, hasContent };
				} catch {
					layersSearched.push("team");
					return { layer: "team", result: null, hasContent: false };
				}
			})(),
		]);

	layerResults.push(
		rulesResult,
		summariesResult,
		transcriptsResult,
		teamResult,
	);

	// Filter to layers with content
	const layersWithContent = layerResults.filter((lr) => lr.hasContent);

	// If no layers have content, return low confidence
	if (layersWithContent.length === 0) {
		return {
			success: true,
			answer:
				"I searched all memory layers but couldn't find relevant information.",
			source: "combined",
			confidence: "low",
			citations: [],
			caveats: [
				`Searched: ${layersSearched.join(", ")}`,
				"Try rephrasing your question or check if the information has been captured.",
			],
			layersSearched,
		};
	}

	// If only one layer has content, return it
	if (layersWithContent.length === 1) {
		const best = layersWithContent[0].result;
		if (best) {
			return {
				...best,
				layersSearched,
			};
		}
	}

	// Multiple layers have content - combine them
	const allCitations: MemoryResult["citations"] = [];
	const allCaveats: string[] = [];
	const answers: string[] = [];

	// Prioritize by layer authority: rules > summaries > transcripts > team
	const priorityOrder: MemoryLayer[] = [
		"rules",
		"summaries",
		"transcripts",
		"team",
	];

	for (const layer of priorityOrder) {
		const layerResult = layersWithContent.find((lr) => lr.layer === layer);
		if (layerResult?.result) {
			answers.push(
				`**From ${getLayerLabel(layer)}:**\n${layerResult.result.answer}`,
			);
			allCitations.push(...layerResult.result.citations);
			allCaveats.push(...layerResult.result.caveats);
		}
	}

	// Determine overall confidence
	const confidenceLevels = layersWithContent
		.map((lr) => lr.result?.confidence)
		.filter(Boolean);
	const hasHigh = confidenceLevels.includes("high");
	const hasMedium = confidenceLevels.includes("medium");
	const overallConfidence: "high" | "medium" | "low" = hasHigh
		? "high"
		: hasMedium
			? "medium"
			: "low";

	return {
		success: true,
		answer: answers.join("\n\n"),
		source: "combined",
		confidence: overallConfidence,
		citations: allCitations.slice(0, 10), // Limit citations
		caveats: [...new Set(allCaveats)], // Deduplicate caveats
		layersSearched,
	};
}

/**
 * Get human-readable label for a layer
 */
function getLayerLabel(layer: MemoryLayer): string {
	const labels: Record<MemoryLayer, string> = {
		rules: "Project Conventions",
		summaries: "Session Summaries",
		observations: "Tool Observations",
		transcripts: "Conversation History",
		team: "Team Memory",
	};
	return labels[layer];
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

	// Search ALL layers in parallel - return what's relevant
	// No routing, no classification - just search everything
	return searchAllLayers(question);
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
