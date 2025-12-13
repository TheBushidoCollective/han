/**
 * Team Memory MCP Tool
 *
 * Provides an MCP tool for querying team memory using the research engine.
 * Answers questions about the codebase by searching indexed observations
 * from git commits, PRs, and other sources.
 */

import {
	createResearchEngine,
	getGitRemote,
	getProjectIndexPath,
	getVectorStore,
	type ResearchResult,
	type SearchResult,
} from "../../memory/index.ts";

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
 * Create a search function that queries the vector store
 */
function createSearchFunction(
	dbPath: string,
	tableName: string,
	limit: number,
): (query: string) => Promise<SearchResult[]> {
	return async (query: string): Promise<SearchResult[]> => {
		const vectorStore = await getVectorStore(dbPath);

		// Search for relevant observations
		const results = await vectorStore.search(tableName, query, limit);

		return results;
	};
}

/**
 * Query team memory with a question
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
		// Get git remote for vector store
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

		// Create search function with the vector store
		const searchFn = createSearchFunction(dbPath, tableName, limit);

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
			searched_sources: result.searched_sources,
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
