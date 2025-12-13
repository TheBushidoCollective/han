/**
 * Han Memory Storage Layer
 *
 * Provides storage for personal sessions and team memory.
 * Uses JSONL for observations (append-only) and YAML for summaries.
 * Vector search via LanceDB when available.
 */

import {
	appendFileSync,
	existsSync,
	readdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import {
	ensureMemoryDirs,
	ensureProjectDirs,
	generateId,
	getProjectIndexPath,
	getProjectMemoryPath,
	getProjectMetaPath,
	getSessionFilePath,
	getSummariesPath,
	getSummaryFilePath,
} from "./paths.ts";
import type {
	IndexedObservation,
	IndexMetadata,
	RawObservation,
	SearchFilters,
	SearchResult,
	SessionSummary,
} from "./types.ts";

/**
 * Memory store interface
 */
export interface MemoryStore {
	// Personal memory
	appendObservation(sessionId: string, obs: RawObservation): void;
	getSessionObservations(sessionId: string): RawObservation[];
	storeSessionSummary(sessionId: string, summary: SessionSummary): void;
	getRecentSessions(limit: number): SessionSummary[];

	// Team memory (index)
	indexObservations(
		gitRemote: string,
		observations: IndexedObservation[],
	): Promise<void>;
	search(
		gitRemote: string,
		query: string,
		filters?: SearchFilters,
	): Promise<SearchResult[]>;

	// Metadata
	getIndexMetadata(gitRemote: string): IndexMetadata | null;
	updateIndexMetadata(gitRemote: string, meta: Partial<IndexMetadata>): void;
}

/**
 * Parse a JSONL file into an array of objects
 */
function parseJsonl<T>(filePath: string): T[] {
	if (!existsSync(filePath)) {
		return [];
	}
	const content = readFileSync(filePath, "utf-8");
	return content
		.split("\n")
		.filter((line) => line.trim())
		.map((line) => JSON.parse(line) as T);
}

/**
 * Parse a YAML file (simple key: value format for now)
 */
function parseYaml<T>(filePath: string): T | null {
	if (!existsSync(filePath)) {
		return null;
	}
	const content = readFileSync(filePath, "utf-8");
	// Simple YAML parsing - for complex nested structures, use yaml package
	try {
		// Handle JSON-compatible YAML (most of our use cases)
		return JSON.parse(content) as T;
	} catch {
		// TODO: Add proper YAML parsing if needed
		return null;
	}
}

/**
 * Stringify to YAML format (JSON for now, human-readable)
 */
function stringifyYaml(obj: unknown): string {
	return JSON.stringify(obj, null, 2);
}

/**
 * Create file-based memory store
 */
export function createMemoryStore(): MemoryStore {
	return {
		/**
		 * Append an observation to the session file
		 */
		appendObservation(sessionId: string, obs: RawObservation): void {
			ensureMemoryDirs();
			const filePath = getSessionFilePath(sessionId);
			const line = `${JSON.stringify(obs)}\n`;
			appendFileSync(filePath, line);
		},

		/**
		 * Get all observations for a session
		 */
		getSessionObservations(sessionId: string): RawObservation[] {
			const filePath = getSessionFilePath(sessionId);
			return parseJsonl<RawObservation>(filePath);
		},

		/**
		 * Store a session summary
		 */
		storeSessionSummary(sessionId: string, summary: SessionSummary): void {
			ensureMemoryDirs();
			const filePath = getSummaryFilePath(sessionId);
			writeFileSync(filePath, stringifyYaml(summary));
		},

		/**
		 * Get recent session summaries
		 */
		getRecentSessions(limit: number): SessionSummary[] {
			const summariesPath = getSummariesPath();
			if (!existsSync(summariesPath)) {
				return [];
			}

			const files = readdirSync(summariesPath)
				.filter((f) => f.endsWith(".yaml") || f.endsWith(".json"))
				.sort()
				.reverse()
				.slice(0, limit);

			const summaries: SessionSummary[] = [];
			for (const file of files) {
				const filePath = `${summariesPath}/${file}`;
				const summary = parseYaml<SessionSummary>(filePath);
				if (summary) {
					summaries.push(summary);
				}
			}
			return summaries;
		},

		/**
		 * Index observations for team memory search
		 * Currently stores as JSONL, will add vector embeddings later
		 */
		async indexObservations(
			gitRemote: string,
			observations: IndexedObservation[],
		): Promise<void> {
			ensureProjectDirs(gitRemote);
			const indexPath = getProjectIndexPath(gitRemote);
			const dataFile = `${indexPath}/observations.jsonl`;

			// Append new observations
			for (const obs of observations) {
				const obsWithId = { ...obs, id: obs.id || generateId() };
				appendFileSync(dataFile, `${JSON.stringify(obsWithId)}\n`);
			}
		},

		/**
		 * Search team memory
		 * Currently uses simple text matching, will add vector search later
		 */
		async search(
			gitRemote: string,
			query: string,
			filters?: SearchFilters,
		): Promise<SearchResult[]> {
			const indexPath = getProjectIndexPath(gitRemote);
			const dataFile = `${indexPath}/observations.jsonl`;

			if (!existsSync(dataFile)) {
				return [];
			}

			const observations = parseJsonl<IndexedObservation>(dataFile);
			const queryLower = query.toLowerCase();

			// Simple text matching for now
			const results: SearchResult[] = [];
			for (const obs of observations) {
				// Apply filters
				if (
					filters?.timeframe?.start &&
					obs.timestamp < filters.timeframe.start
				) {
					continue;
				}
				if (filters?.timeframe?.end && obs.timestamp > filters.timeframe.end) {
					continue;
				}
				if (filters?.authors?.length && !filters.authors.includes(obs.author)) {
					continue;
				}
				if (filters?.types?.length && !filters.types.includes(obs.type)) {
					continue;
				}

				// Calculate relevance score based on text matching
				const searchText = `${obs.summary} ${obs.detail}`.toLowerCase();
				const queryWords = queryLower.split(/\s+/);
				let matchCount = 0;
				for (const word of queryWords) {
					if (searchText.includes(word)) {
						matchCount++;
					}
				}

				if (matchCount > 0) {
					const score = matchCount / queryWords.length;
					const excerpt = extractExcerpt(obs.detail || obs.summary, query);
					results.push({ observation: obs, score, excerpt });
				}
			}

			// Sort by score descending
			return results.sort((a, b) => b.score - a.score);
		},

		/**
		 * Get index metadata for a project
		 */
		getIndexMetadata(gitRemote: string): IndexMetadata | null {
			const metaPath = getProjectMetaPath(gitRemote);
			return parseYaml<IndexMetadata>(metaPath);
		},

		/**
		 * Update index metadata
		 */
		updateIndexMetadata(gitRemote: string, meta: Partial<IndexMetadata>): void {
			ensureProjectDirs(gitRemote);
			const metaPath = getProjectMetaPath(gitRemote);
			const existing = this.getIndexMetadata(gitRemote) || {
				project_path: getProjectMemoryPath(gitRemote),
				created_at: Date.now(),
				updated_at: Date.now(),
				sources: {},
			};

			const updated: IndexMetadata = {
				...existing,
				...meta,
				updated_at: Date.now(),
				sources: {
					...existing.sources,
					...(meta.sources || {}),
				},
			};

			writeFileSync(metaPath, stringifyYaml(updated));
		},
	};
}

/**
 * Extract a relevant excerpt from text based on query
 */
function extractExcerpt(text: string, query: string, maxLength = 200): string {
	const queryWords = query.toLowerCase().split(/\s+/);
	const textLower = text.toLowerCase();

	// Find first occurrence of any query word
	let bestIndex = 0;
	for (const word of queryWords) {
		const idx = textLower.indexOf(word);
		if (idx !== -1 && (bestIndex === 0 || idx < bestIndex)) {
			bestIndex = idx;
		}
	}

	// Extract context around the match
	const start = Math.max(0, bestIndex - 50);
	const end = Math.min(text.length, start + maxLength);
	let excerpt = text.slice(start, end);

	if (start > 0) excerpt = `...${excerpt}`;
	if (end < text.length) excerpt = `${excerpt}...`;

	return excerpt;
}

/**
 * Singleton memory store instance
 */
let storeInstance: MemoryStore | null = null;

/**
 * Get the memory store singleton
 */
export function getMemoryStore(): MemoryStore {
	if (!storeInstance) {
		storeInstance = createMemoryStore();
	}
	return storeInstance;
}
