/**
 * Multi-Strategy Search for Han Memory
 *
 * Implements automatic strategy orchestration for memory queries.
 * Tries multiple search strategies in parallel and fuses results using
 * Reciprocal Rank Fusion (RRF) for improved confidence and coverage.
 *
 * Strategies:
 * - direct_fts: Direct FTS without query expansion
 * - expanded_fts: FTS with query expansion (acronyms/synonyms)
 * - semantic: Vector/embedding similarity search
 * - summaries: Search session summaries (Layer 2)
 *
 * @example
 * ```typescript
 * const result = await multiStrategySearch({
 *   query: "how do we handle authentication?",
 *   layer: "all",
 *   limit: 10,
 * });
 *
 * // Result includes:
 * // - Fused results from all strategies
 * // - Confidence level based on strategy coverage
 * // - Per-strategy statistics
 * ```
 */

import type { ExpansionLevel } from "./query-expansion.ts";
import type { FtsResult } from "./indexer.ts";

/**
 * Available search strategies
 */
export type SearchStrategy =
	| "direct_fts" // Direct FTS without expansion
	| "expanded_fts" // FTS with query expansion
	| "semantic" // Vector/embedding search
	| "summaries"; // Session summaries search

/**
 * Memory layers to search
 */
export type MemoryLayer = "rules" | "transcripts" | "team" | "all";

/**
 * Search result with citation metadata
 */
export interface SearchResultWithCitation extends FtsResult {
	layer: string;
	browseUrl?: string;
}

/**
 * Result from a single strategy execution
 */
export interface StrategyResult {
	strategy: SearchStrategy;
	results: SearchResultWithCitation[];
	duration: number;
	success: boolean;
	error?: string;
}

/**
 * Options for multi-strategy search
 */
export interface MultiStrategySearchOptions {
	/** The search query */
	query: string;
	/** Memory layer to search */
	layer: MemoryLayer;
	/** Maximum results to return (default: 10) */
	limit?: number;
	/** Query expansion level for FTS strategies (default: "minimal") */
	expansion?: ExpansionLevel;
	/** Per-strategy timeout in ms (default: 5000) */
	timeout?: number;
	/** Specific strategies to run (default: all) */
	strategies?: SearchStrategy[];
}

/**
 * Result from multi-strategy search
 */
export interface MultiStrategySearchResult {
	/** Fused and deduplicated results */
	results: SearchResultWithCitation[];
	/** Number of strategies attempted */
	strategiesAttempted: number;
	/** Number of strategies that returned results */
	strategiesSucceeded: number;
	/** Per-strategy results for debugging */
	strategyResults: StrategyResult[];
	/** Overall confidence based on strategy coverage */
	confidence: "high" | "medium" | "low";
	/** Search statistics */
	searchStats: {
		totalDuration: number;
		strategiesTimedOut: string[];
		deduplicatedCount: number;
	};
}

/** RRF constant - higher values smooth ranking differences */
const RRF_K = 60;

/** Default per-strategy timeout */
const DEFAULT_TIMEOUT = 5000;

/** All available strategies */
const ALL_STRATEGIES: SearchStrategy[] = [
	"direct_fts",
	"expanded_fts",
	"semantic",
	"summaries",
];

/**
 * Execute a single search strategy with timeout
 *
 * @internal
 */
export async function executeStrategy(
	strategy: SearchStrategy,
	query: string,
	layer: MemoryLayer,
	limit: number,
	expansion: ExpansionLevel,
	timeout: number,
	searchFns: {
		searchMemoryFts: (
			query: string,
			layer: MemoryLayer,
			limit: number,
			expansion: ExpansionLevel,
		) => Promise<SearchResultWithCitation[]>;
		searchMemoryVector: (
			query: string,
			layer: MemoryLayer,
			limit: number,
			expansion: ExpansionLevel,
		) => Promise<SearchResultWithCitation[]>;
		searchSummariesNative: (
			query: string,
			limit: number,
		) => Promise<SearchResultWithCitation[]>;
	},
): Promise<StrategyResult> {
	const startTime = Date.now();

	const timeoutPromise = new Promise<never>((_, reject) => {
		setTimeout(() => reject(new Error("Strategy timeout")), timeout);
	});

	const searchPromise = (async (): Promise<SearchResultWithCitation[]> => {
		switch (strategy) {
			case "direct_fts":
				return searchFns.searchMemoryFts(query, layer, limit, "none");
			case "expanded_fts":
				return searchFns.searchMemoryFts(query, layer, limit, expansion);
			case "semantic":
				return searchFns.searchMemoryVector(query, layer, limit, expansion);
			case "summaries":
				return searchFns.searchSummariesNative(query, limit);
		}
	})();

	try {
		const results = await Promise.race([searchPromise, timeoutPromise]);
		return {
			strategy,
			results,
			duration: Date.now() - startTime,
			success: true,
		};
	} catch (error) {
		return {
			strategy,
			results: [],
			duration: Date.now() - startTime,
			success: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * Fuse results from multiple strategies using Reciprocal Rank Fusion
 *
 * RRF formula: score = sum(1 / (k + rank_i)) for each ranking
 * Results appearing in multiple strategies get boosted.
 *
 * @internal
 */
export function fuseResults(
	strategyResults: StrategyResult[],
	limit: number,
): SearchResultWithCitation[] {
	const scores = new Map<
		string,
		{
			score: number;
			result: SearchResultWithCitation;
			strategies: Set<SearchStrategy>;
		}
	>();

	for (const sr of strategyResults) {
		if (!sr.success) continue;

		sr.results.forEach((result, rank) => {
			const rrfScore = 1 / (RRF_K + rank + 1);
			const existing = scores.get(result.id);

			if (existing) {
				existing.score += rrfScore;
				existing.strategies.add(sr.strategy);
			} else {
				scores.set(result.id, {
					score: rrfScore,
					result,
					strategies: new Set([sr.strategy]),
				});
			}
		});
	}

	// Boost for results found by multiple strategies
	for (const entry of scores.values()) {
		const multiStrategyBoost = 1 + (entry.strategies.size - 1) * 0.1;
		entry.score *= multiStrategyBoost;
	}

	return Array.from(scores.values())
		.sort((a, b) => b.score - a.score)
		.slice(0, limit)
		.map(({ result, score }) => ({ ...result, score }));
}

/**
 * Calculate confidence level based on strategy results
 *
 * High confidence: 3+ strategies succeeded, or 2+ with cross-validation
 * Medium confidence: 2+ strategies succeeded, or 1 with many results
 * Low confidence: 1 or fewer strategies with few results
 *
 * @internal
 */
export function calculateConfidence(
	strategyResults: StrategyResult[],
	fusedResults: SearchResultWithCitation[],
): "high" | "medium" | "low" {
	const successfulStrategies = strategyResults.filter(
		(sr) => sr.success && sr.results.length > 0,
	);

	const successCount = successfulStrategies.length;

	// Count cross-validated results (appearing in multiple strategies)
	const resultIds = new Map<string, number>();
	for (const sr of successfulStrategies) {
		for (const r of sr.results) {
			resultIds.set(r.id, (resultIds.get(r.id) || 0) + 1);
		}
	}
	const crossValidatedCount = Array.from(resultIds.values()).filter(
		(count) => count > 1,
	).length;

	// High: 3+ strategies succeeded, or 2+ with cross-validation
	if (successCount >= 3 || (successCount >= 2 && crossValidatedCount > 0)) {
		return "high";
	}

	// Medium: 2+ strategies succeeded, or 1 with many results
	if (successCount >= 2 || (successCount === 1 && fusedResults.length >= 5)) {
		return "medium";
	}

	return "low";
}

/**
 * Main multi-strategy search orchestrator
 *
 * Executes all specified strategies in parallel, fuses results using RRF,
 * and calculates confidence based on strategy coverage.
 *
 * @example
 * ```typescript
 * const result = await multiStrategySearch({
 *   query: "authentication flow",
 *   layer: "all",
 *   limit: 10,
 *   expansion: "minimal",
 *   timeout: 5000,
 * });
 *
 * console.log(result.confidence); // "high" | "medium" | "low"
 * console.log(result.strategiesSucceeded); // 3
 * console.log(result.results); // Fused results
 * ```
 */
export async function multiStrategySearch(
	options: MultiStrategySearchOptions,
	searchFns: {
		searchMemoryFts: (
			query: string,
			layer: MemoryLayer,
			limit: number,
			expansion: ExpansionLevel,
		) => Promise<SearchResultWithCitation[]>;
		searchMemoryVector: (
			query: string,
			layer: MemoryLayer,
			limit: number,
			expansion: ExpansionLevel,
		) => Promise<SearchResultWithCitation[]>;
		searchSummariesNative: (
			query: string,
			limit: number,
		) => Promise<SearchResultWithCitation[]>;
	},
): Promise<MultiStrategySearchResult> {
	const {
		query,
		layer,
		limit = 10,
		expansion = "minimal",
		timeout = DEFAULT_TIMEOUT,
		strategies = ALL_STRATEGIES,
	} = options;

	const startTime = Date.now();

	// Execute all strategies in parallel
	const strategyPromises = strategies.map((strategy) =>
		executeStrategy(
			strategy,
			query,
			layer,
			limit * 2, // Get more results for fusion
			expansion,
			timeout,
			searchFns,
		),
	);

	const strategyResults = await Promise.all(strategyPromises);

	// Fuse results using RRF
	const fusedResults = fuseResults(strategyResults, limit);

	// Calculate confidence
	const confidence = calculateConfidence(strategyResults, fusedResults);

	const strategiesTimedOut = strategyResults
		.filter((sr) => sr.error?.includes("timeout"))
		.map((sr) => sr.strategy);

	const totalResultsBeforeFusion = strategyResults.reduce(
		(sum, sr) => sum + sr.results.length,
		0,
	);

	return {
		results: fusedResults,
		strategiesAttempted: strategyResults.length,
		strategiesSucceeded: strategyResults.filter(
			(sr) => sr.success && sr.results.length > 0,
		).length,
		strategyResults,
		confidence,
		searchStats: {
			totalDuration: Date.now() - startTime,
			strategiesTimedOut,
			deduplicatedCount: totalResultsBeforeFusion - fusedResults.length,
		},
	};
}
