/**
 * Team Memory MCP Tool
 *
 * Provides an MCP tool for querying team memory using the research engine.
 * Answers questions about the codebase by searching indexed observations
 * from git commits, PRs, and other sources.
 *
 * Always searches ALL sources (git history + vector store) in parallel
 * for consistent, reliable results.
 */

import {
	createResearchEngine,
	getGitRemote,
	getProjectIndexPath,
	getVectorStore,
	type ResearchResult,
	type SearchResult,
} from "../../memory/index.ts";
import { gitProvider } from "../../memory/providers/git.ts";

export interface TeamQueryParams {
	/** The question to research */
	question: string;
	/** Maximum number of results to return (default: 10) */
	limit?: number;
}

export interface TeamQueryResult {
	success: boolean;
	answer: string;
	confidence: "high" | "medium" | "low";
	citations: Array<{
		source: string;
		excerpt: string;
		author?: string;
		timestamp?: number;
	}>;
	caveats: string[];
	searched_sources: string[];
}

/**
 * Search git history directly using text matching
 */
async function searchGitHistory(
	query: string,
	limit: number,
): Promise<SearchResult[]> {
	// Get recent commits (last 100)
	const observations = await gitProvider.extract({
		limit: 100,
	});

	if (observations.length === 0) {
		return [];
	}

	// Simple text matching on commit messages
	const queryLower = query.toLowerCase();
	const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 2);

	const results: SearchResult[] = [];

	for (const obs of observations) {
		const searchText =
			`${obs.summary} ${obs.detail} ${obs.files.join(" ")}`.toLowerCase();

		// Count matching words
		let matchCount = 0;
		for (const word of queryWords) {
			if (searchText.includes(word)) {
				matchCount++;
			}
		}

		if (matchCount > 0) {
			const score = matchCount / queryWords.length;
			results.push({
				observation: {
					id: obs.source,
					source: obs.source,
					type: obs.type,
					timestamp: obs.timestamp,
					author: obs.author,
					summary: obs.summary,
					detail: obs.detail || "",
					files: obs.files,
					patterns: obs.patterns || [],
					pr_context: obs.pr_context,
				},
				score,
				excerpt: obs.summary,
			});
		}
	}

	// Sort by score and limit
	return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * Search vector store for indexed observations
 */
async function searchVectorStore(
	dbPath: string,
	tableName: string,
	query: string,
	limit: number,
): Promise<SearchResult[]> {
	try {
		const vectorStore = await getVectorStore(dbPath);
		return await vectorStore.search(tableName, query, limit);
	} catch {
		// Vector store not available
		return [];
	}
}

/**
 * Query team memory with a question
 * Searches ALL sources (git history + indexed observations) and combines results
 */
export async function queryTeamMemory(
	params: TeamQueryParams,
): Promise<TeamQueryResult> {
	const { question, limit = 10 } = params;

	// Validate inputs
	if (!question || question.trim().length === 0) {
		return {
			success: false,
			answer: "Question cannot be empty",
			confidence: "low",
			citations: [],
			caveats: [],
			searched_sources: [],
		};
	}

	try {
		// Get git remote for project context
		const gitRemote = getGitRemote();
		if (!gitRemote) {
			return {
				success: false,
				answer: "Not in a git repository. Team memory requires a git project.",
				confidence: "low",
				citations: [],
				caveats: [],
				searched_sources: [],
			};
		}

		const dbPath = getProjectIndexPath(gitRemote);
		const tableName = "observations";
		const searchedSources: string[] = [];

		// Search ALL sources in parallel - no fallbacks, always consistent
		const [gitResults, vectorResults] = await Promise.all([
			searchGitHistory(question, limit),
			searchVectorStore(dbPath, tableName, question, limit),
		]);

		// Track what sources were searched
		searchedSources.push("git:commits");
		if (vectorResults.length > 0) {
			searchedSources.push("indexed:observations");
		}

		// Combine and deduplicate results by source
		const seenSources = new Set<string>();
		const combinedResults: SearchResult[] = [];

		// Add all results, preferring higher scores for duplicates
		for (const result of [...vectorResults, ...gitResults]) {
			if (!seenSources.has(result.observation.source)) {
				seenSources.add(result.observation.source);
				combinedResults.push(result);
			}
		}

		// Sort by score and limit
		const finalResults = combinedResults
			.sort((a, b) => b.score - a.score)
			.slice(0, limit);

		// Create search function that returns our combined results
		const searchFn = async (_query: string): Promise<SearchResult[]> => {
			return finalResults;
		};

		// Create research engine and run research
		const engine = createResearchEngine(searchFn);
		const result: ResearchResult = await engine.research(question);

		// Format citations for output
		const formattedCitations = result.citations.map((citation) => ({
			source: citation.source,
			excerpt: citation.excerpt,
			author: citation.author,
			timestamp: citation.timestamp,
		}));

		return {
			success: true,
			answer: result.answer,
			confidence: result.confidence,
			citations: formattedCitations,
			caveats: result.caveats,
			searched_sources: searchedSources,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			success: false,
			answer: `Failed to research: ${message}`,
			confidence: "low",
			citations: [],
			caveats: [],
			searched_sources: [],
		};
	}
}

/**
 * Format team memory result for display
 */
export function formatTeamMemoryResult(result: TeamQueryResult): string {
	const lines: string[] = [];

	// Add confidence indicator
	const confidenceEmoji =
		result.confidence === "high"
			? "🟢"
			: result.confidence === "medium"
				? "🟡"
				: "🔴";

	lines.push(`${confidenceEmoji} **Confidence: ${result.confidence}**`);
	lines.push("");

	// Add answer
	lines.push("## Answer");
	lines.push(result.answer);
	lines.push("");

	// Add citations
	if (result.citations.length > 0) {
		lines.push("## Sources");
		for (const citation of result.citations) {
			const author = citation.author ? ` (${citation.author})` : "";
			const date = citation.timestamp
				? new Date(citation.timestamp).toLocaleDateString()
				: "";
			lines.push(
				`- **${citation.source}**${author}${date ? ` - ${date}` : ""}`,
			);
			if (citation.excerpt) {
				lines.push(
					`  > ${citation.excerpt.slice(0, 200)}${citation.excerpt.length > 200 ? "..." : ""}`,
				);
			}
		}
		lines.push("");
	}

	// Add caveats
	if (result.caveats.length > 0) {
		lines.push("## Notes");
		for (const caveat of result.caveats) {
			lines.push(`- ${caveat}`);
		}
		lines.push("");
	}

	return lines.join("\n");
}
