/**
 * Fallback Search Mechanisms for Han Memory
 *
 * Provides fallback search strategies when primary search methods return empty results.
 * Implements a cascading fallback chain:
 *
 * 1. FTS + semantic + summaries (multi-strategy, default)
 * 2. Recent sessions scan (for temporal queries like "what was I working on")
 * 3. Raw JSONL grep (slow but thorough, last resort)
 * 4. Clarification prompt (when query is ambiguous or no results found)
 *
 * @example
 * ```typescript
 * const result = await multiStrategySearchWithFallbacks({
 *   query: "what was I working on yesterday",
 *   layer: "all",
 *   enableFallbacks: true,
 * });
 *
 * if (result.clarificationPrompt) {
 *   // Ask user for more details
 * }
 * ```
 */

import { createReadStream, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createInterface } from "node:readline";
import { join, basename, dirname } from "node:path";
import type { SearchResultWithCitation } from "./multi-strategy-search.ts";
import { findAllTranscriptFiles, getClaudeProjectsDir } from "./transcript-search.ts";

/**
 * Fallback strategies available
 */
export type FallbackStrategy =
	| "recent_sessions" // Scan last N sessions by modification time
	| "transcript_grep" // Raw grep through JSONL files
	| "clarification"; // Ask user for more details

/**
 * Result from a single fallback strategy execution
 */
export interface FallbackResult {
	strategy: FallbackStrategy;
	results: SearchResultWithCitation[];
	duration: number;
	success: boolean;
	error?: string;
	needsClarification?: boolean;
	clarificationPrompt?: string;
}

/**
 * Temporal query patterns
 */
const TEMPORAL_PATTERNS = [
	/what (?:was|have) (?:i|we) (?:working|worked) on/i,
	/\brecently\b/i,
	/\brecent\b/i,
	/\byesterday\b/i,
	/\btoday\b/i,
	/last (?:week|month|hour|session)/i,
	/this (?:week|morning|afternoon)/i,
	/\bearlier\b/i,
	/\bbefore\b/i,
	/\bprevious\b/i,
	/\bcurrent\b/i,
];

/**
 * Vague/ambiguous query patterns that might need clarification
 */
const VAGUE_PATTERNS = [
	/^what$/i,
	/^how$/i,
	/^why$/i,
	/^where$/i,
	/^.{1,10}$/i, // Very short queries (less than 10 chars)
	/^(?:the|a|an)\s+\w+$/i, // "the X" or "a X" without context
];

/**
 * Check if a query is a temporal query (e.g., "what was I working on")
 */
export function detectTemporalQuery(query: string): boolean {
	return TEMPORAL_PATTERNS.some((pattern) => pattern.test(query));
}

/**
 * Check if a query is too vague and needs clarification
 */
export function isVagueQuery(query: string): boolean {
	const trimmed = query.trim();

	// Very short queries are vague
	if (trimmed.length < 5) return true;

	// Check against vague patterns
	return VAGUE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * Determine if we need to ask for clarification
 */
export function needsClarification(
	query: string,
	resultCount: number,
	strategiesSucceeded: number,
): { needs: boolean; prompt?: string } {
	// If we got results, no clarification needed
	if (resultCount > 0) {
		return { needs: false };
	}

	// If query is vague and no results
	if (isVagueQuery(query)) {
		return {
			needs: true,
			prompt: `Your query "${query}" is quite broad. Could you be more specific? For example:
- What specific topic, feature, or file are you looking for?
- When approximately did this happen (today, this week, recently)?
- What type of information are you looking for (code, discussions, decisions)?`,
		};
	}

	// If all strategies failed with no results
	if (strategiesSucceeded === 0) {
		return {
			needs: true,
			prompt: `I couldn't find any information about "${query}". This might mean:
- The topic wasn't discussed in indexed sessions
- Try different keywords or synonyms
- Check if the sessions containing this information have been indexed`,
		};
	}

	// Strategies succeeded but returned no matches
	return {
		needs: true,
		prompt: `No results found for "${query}". Try:
- Using different keywords or phrasing
- Checking for typos
- Broadening your search terms`,
	};
}

/**
 * Calculate temporal score for a session based on recency
 * Returns a score between 0 and 1, with more recent sessions scoring higher
 */
export function calculateTemporalScore(
	lastModified: number,
	now = Date.now(),
): number {
	const hoursAgo = (now - lastModified) / (1000 * 60 * 60);

	// Exponential decay: 1.0 for now, 0.5 for 24h ago, 0.25 for 48h ago
	return Math.exp(-hoursAgo / 24);
}

/**
 * Simple keyword matching score
 * Returns a score between 0 and 1 based on how many query words match
 */
export function calculateKeywordScore(content: string, query: string): number {
	const contentLower = content.toLowerCase();
	const queryWords = query
		.toLowerCase()
		.split(/\s+/)
		.filter((w) => w.length > 2); // Skip very short words

	if (queryWords.length === 0) return 0;

	let matchCount = 0;
	for (const word of queryWords) {
		if (contentLower.includes(word)) matchCount++;
	}

	return matchCount / queryWords.length;
}

/**
 * Session info for recent sessions scan
 */
interface RecentSession {
	sessionId: string;
	projectSlug: string;
	filePath: string;
	lastModified: number;
}

/**
 * Get recent sessions sorted by modification time
 */
export function getRecentSessions(limit = 10): RecentSession[] {
	const allTranscripts = findAllTranscriptFiles();
	const sessions: RecentSession[] = [];

	for (const [slug, files] of allTranscripts) {
		for (const filePath of files) {
			try {
				const stat = statSync(filePath);
				const sessionId = basename(filePath, ".jsonl").replace(/-han$/, "");

				sessions.push({
					sessionId,
					projectSlug: slug,
					filePath,
					lastModified: stat.mtimeMs,
				});
			} catch {
				// Skip files that can't be stat'd
			}
		}
	}

	// Sort by modification time (newest first) and limit
	return sessions.sort((a, b) => b.lastModified - a.lastModified).slice(0, limit);
}

/**
 * Scan recent sessions for temporal queries
 *
 * Checks the most recently modified sessions and searches their summaries
 * or first few lines for keyword matches.
 */
export async function scanRecentSessions(
	query: string,
	options: { limit?: number } = {},
): Promise<FallbackResult> {
	const { limit = 10 } = options;
	const startTime = Date.now();

	try {
		const recentSessions = getRecentSessions(limit);
		const results: SearchResultWithCitation[] = [];
		const now = Date.now();

		for (const session of recentSessions) {
			try {
				// Read first ~100 lines of the session file for a quick scan
				const content = readFileSync(session.filePath, "utf-8");
				const lines = content.split("\n").slice(0, 100);

				// Extract text content from JSONL entries
				const textContent: string[] = [];
				for (const line of lines) {
					if (!line.trim()) continue;
					try {
						const entry = JSON.parse(line);
						if (entry.message?.content) {
							const msgContent = entry.message.content;
							if (typeof msgContent === "string") {
								textContent.push(msgContent);
							} else if (Array.isArray(msgContent)) {
								for (const block of msgContent) {
									if (block.type === "text" && block.text) {
										textContent.push(block.text);
									}
								}
							}
						}
						// Also check for summary content
						if (entry.type === "summary" && entry.summary) {
							textContent.push(entry.summary);
						}
					} catch {
						// Skip unparseable lines
					}
				}

				const combinedContent = textContent.join("\n");
				const keywordScore = calculateKeywordScore(combinedContent, query);
				const temporalScore = calculateTemporalScore(session.lastModified, now);

				// Combine scores: temporal matters for "what was I working on" queries
				const isTemporalQuery = detectTemporalQuery(query);
				const finalScore = isTemporalQuery
					? temporalScore * 0.7 + keywordScore * 0.3 // Temporal queries weight recency heavily
					: keywordScore * 0.7 + temporalScore * 0.3; // Normal queries weight keywords

				// Only include if we have some relevance
				if (finalScore > 0.1 || (isTemporalQuery && temporalScore > 0.5)) {
					results.push({
						id: `recent:${session.sessionId}`,
						content: combinedContent.slice(0, 500), // First 500 chars as excerpt
						score: finalScore,
						layer: "recent_sessions",
						metadata: {
							sessionId: session.sessionId,
							projectSlug: session.projectSlug,
							lastModified: session.lastModified,
						},
						browseUrl: `/sessions/${session.sessionId}`,
					});
				}
			} catch (sessionError) {
				// Log at debug level - skip sessions that can't be read
				if (process.env.HAN_DEBUG) {
					console.warn(`[recent_sessions] Failed to read session ${session.sessionId}:`, sessionError instanceof Error ? sessionError.message : String(sessionError));
				}
			}
		}

		// Sort by score and return top results
		results.sort((a, b) => b.score - a.score);

		return {
			strategy: "recent_sessions",
			results: results.slice(0, limit),
			duration: Date.now() - startTime,
			success: true,
		};
	} catch (error) {
		return {
			strategy: "recent_sessions",
			results: [],
			duration: Date.now() - startTime,
			success: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * Grep through raw JSONL transcript files
 *
 * This is the slowest but most thorough fallback. It reads JSONL files
 * directly and searches for exact matches. Use only when FTS fails.
 */
export async function grepTranscripts(
	query: string,
	options: { timeout?: number; limit?: number; projectSlug?: string } = {},
): Promise<FallbackResult> {
	const { timeout = 5000, limit = 10, projectSlug } = options;
	const startTime = Date.now();

	try {
		const allTranscripts = findAllTranscriptFiles();
		const results: SearchResultWithCitation[] = [];
		const queryLower = query.toLowerCase();
		const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 2);

		// If no useful words, return empty
		if (queryWords.length === 0) {
			return {
				strategy: "transcript_grep",
				results: [],
				duration: Date.now() - startTime,
				success: true,
			};
		}

		// Sort transcripts by modification time (newest first)
		const sortedTranscripts: Array<{
			slug: string;
			filePath: string;
			mtime: number;
		}> = [];

		for (const [slug, files] of allTranscripts) {
			// Filter by project if specified
			if (projectSlug && slug !== projectSlug) continue;

			for (const filePath of files) {
				try {
					const stat = statSync(filePath);
					sortedTranscripts.push({ slug, filePath, mtime: stat.mtimeMs });
				} catch (statError) {
					// Log at debug level - skip files that can't be stat'd
					if (process.env.HAN_DEBUG) {
						console.warn(`[grep] Failed to stat ${filePath}:`, statError instanceof Error ? statError.message : String(statError));
					}
				}
			}
		}

		sortedTranscripts.sort((a, b) => b.mtime - a.mtime);

		// Search through files using streaming to avoid OOM on large files
		for (const { slug, filePath, mtime } of sortedTranscripts) {
			// Check timeout
			if (Date.now() - startTime > timeout) {
				break;
			}

			// Check if we have enough results
			if (results.length >= limit * 2) {
				break;
			}

			try {
				const sessionId = basename(filePath, ".jsonl").replace(/-han$/, "");

				// Use streaming to read file line-by-line (avoids OOM on large files)
				await new Promise<void>((resolve, reject) => {
					const stream = createReadStream(filePath, { encoding: "utf-8" });
					const rl = createInterface({ input: stream, crlfDelay: Infinity });
					let lineNum = 0;
					let aborted = false;

					rl.on("line", (line) => {
						if (aborted) return;

						// Check timeout during streaming
						if (Date.now() - startTime > timeout) {
							aborted = true;
							rl.close();
							stream.destroy();
							return;
						}

						lineNum++;
						if (!line.trim()) return;

						try {
							const entry = JSON.parse(line);
							let text = "";

							// Extract searchable text
							if (entry.message?.content) {
								const msgContent = entry.message.content;
								if (typeof msgContent === "string") {
									text = msgContent;
								} else if (Array.isArray(msgContent)) {
									for (const block of msgContent) {
										if (block.type === "text" && block.text) {
											text += block.text + " ";
										}
									}
								}
							} else if (entry.type === "summary" && entry.summary) {
								text = entry.summary;
							}

							if (!text) return;

							// Check for query match
							const textLower = text.toLowerCase();
							let matchCount = 0;
							for (const word of queryWords) {
								if (textLower.includes(word)) matchCount++;
							}

							if (matchCount > 0) {
								const score = matchCount / queryWords.length;
								results.push({
									id: `grep:${sessionId}:${lineNum}`,
									content: text.slice(0, 500), // First 500 chars
									score,
									layer: "grep",
									metadata: {
										sessionId,
										projectSlug: slug,
										lineNumber: lineNum,
										lastModified: mtime,
									},
									browseUrl: `/sessions/${sessionId}#line-${lineNum}`,
								});
							}
						} catch (parseError) {
							// Skip unparseable lines - this is expected for malformed JSON
							if (process.env.HAN_DEBUG) {
								console.warn(`[grep] Skipping unparseable line ${lineNum} in ${filePath}`);
							}
						}
					});

					rl.on("close", resolve);
					rl.on("error", (err) => {
						if (process.env.HAN_DEBUG) {
							console.warn(`[grep] Error reading ${filePath}:`, err.message);
						}
						resolve(); // Don't reject, just skip this file
					});
					stream.on("error", (err) => {
						if (process.env.HAN_DEBUG) {
							console.warn(`[grep] Stream error for ${filePath}:`, err.message);
						}
						resolve(); // Don't reject, just skip this file
					});
				});
			} catch (fileError) {
				// Log file read errors at debug level
				if (process.env.HAN_DEBUG) {
					console.warn(`[grep] Failed to process ${filePath}:`, fileError instanceof Error ? fileError.message : String(fileError));
				}
			}
		}

		// Sort by score and deduplicate by session (keep best match per session)
		results.sort((a, b) => b.score - a.score);

		const seenSessions = new Set<string>();
		const deduped: SearchResultWithCitation[] = [];
		for (const result of results) {
			// Use nullish coalescing for type safety instead of 'as string'
			const sessionId = typeof result.metadata?.sessionId === "string"
				? result.metadata.sessionId
				: "unknown";
			if (!seenSessions.has(sessionId)) {
				seenSessions.add(sessionId);
				deduped.push(result);
			}
			if (deduped.length >= limit) break;
		}

		return {
			strategy: "transcript_grep",
			results: deduped,
			duration: Date.now() - startTime,
			success: true,
		};
	} catch (error) {
		return {
			strategy: "transcript_grep",
			results: [],
			duration: Date.now() - startTime,
			success: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * Options for search with fallbacks
 */
export interface SearchWithFallbacksOptions {
	/** Whether to enable fallback strategies (default: true) */
	enableFallbacks?: boolean;
	/** Whether to run grep fallback (slow, default: true) */
	enableGrep?: boolean;
	/** Timeout for grep in ms (default: 5000) */
	grepTimeout?: number;
	/** Number of recent sessions to scan (default: 10) */
	recentSessionsLimit?: number;
}

/**
 * Result from search with fallbacks
 */
export interface SearchWithFallbacksResult {
	/** Combined results from all strategies */
	results: SearchResultWithCitation[];
	/** Fallback strategies that were used */
	fallbacksUsed: FallbackStrategy[];
	/** Clarification prompt if query needs more details */
	clarificationPrompt?: string;
	/** Whether any fallbacks were attempted */
	fallbacksAttempted: boolean;
	/** Duration of fallback execution */
	fallbackDuration: number;
}

/**
 * Execute fallback strategies when primary search returns empty
 *
 * @param query - The search query
 * @param primaryResultCount - Number of results from primary search
 * @param options - Fallback options
 * @returns Fallback results with any clarification prompts
 */
export async function executeFallbacks(
	query: string,
	primaryResultCount: number,
	primaryStrategiesSucceeded: number,
	options: SearchWithFallbacksOptions = {},
): Promise<SearchWithFallbacksResult> {
	const {
		enableFallbacks = true,
		enableGrep = true,
		grepTimeout = 5000,
		recentSessionsLimit = 10,
	} = options;

	const startTime = Date.now();
	const results: SearchResultWithCitation[] = [];
	const fallbacksUsed: FallbackStrategy[] = [];

	// If fallbacks are disabled or we have results, skip
	if (!enableFallbacks || primaryResultCount > 0) {
		return {
			results: [],
			fallbacksUsed: [],
			fallbacksAttempted: false,
			fallbackDuration: 0,
		};
	}

	// Fallback 1: Recent sessions scan (especially for temporal queries)
	const isTemporalQuery = detectTemporalQuery(query);
	if (isTemporalQuery || primaryResultCount === 0) {
		const recentResult = await scanRecentSessions(query, {
			limit: recentSessionsLimit,
		});

		if (recentResult.success && recentResult.results.length > 0) {
			results.push(...recentResult.results);
			fallbacksUsed.push("recent_sessions");
		}
	}

	// Fallback 2: Raw grep (only if still no results and grep is enabled)
	if (enableGrep && results.length === 0) {
		const grepResult = await grepTranscripts(query, {
			timeout: grepTimeout,
			limit: 10,
		});

		if (grepResult.success && grepResult.results.length > 0) {
			results.push(...grepResult.results);
			fallbacksUsed.push("transcript_grep");
		}
	}

	// Fallback 3: Check if we need clarification
	const totalResults = primaryResultCount + results.length;
	const clarification = needsClarification(
		query,
		totalResults,
		primaryStrategiesSucceeded + (fallbacksUsed.length > 0 ? 1 : 0),
	);

	if (clarification.needs) {
		fallbacksUsed.push("clarification");
	}

	return {
		results,
		fallbacksUsed,
		clarificationPrompt: clarification.prompt,
		fallbacksAttempted: true,
		fallbackDuration: Date.now() - startTime,
	};
}
