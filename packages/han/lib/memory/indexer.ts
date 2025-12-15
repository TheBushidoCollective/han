/**
 * Han Memory Indexer
 *
 * Orchestrates indexing of memory content via han-native using SurrealDB.
 * Provides FTS (BM25) search and embedding generation for the 5-layer
 * memory system: rules, summaries, observations, transcripts, and team memory.
 *
 * Storage location: ~/.claude/han/memory/index/
 *
 * @note The native module uses pure Rust dependencies (SurrealDB with kv-surrealkv,
 * ort with load-dynamic) for cross-compilation compatibility.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
	getGitRemote,
	getSessionsPath,
	getSummariesPath,
	normalizeGitRemote,
} from "./paths.ts";
import type {
	ExtractedObservation,
	RawObservation,
	SessionSummary,
} from "./types.ts";
import { tryGetNativeModule } from "../native.ts";

/**
 * Document for FTS indexing
 */
export interface IndexDocument {
	id: string;
	content: string;
	metadata?: string;
}

/**
 * Search result from FTS
 */
export interface FtsResult {
	id: string;
	content: string;
	metadata?: Record<string, unknown>;
	score: number;
}

/**
 * Index layer types
 */
export type IndexLayer = "observations" | "summaries" | "transcripts" | "team";

/**
 * Index status for a layer
 */
export interface IndexStatus {
	layer: IndexLayer;
	documentCount: number;
	lastIndexed: number | null;
	isStale: boolean;
}

/**
 * Get the index database path
 */
export function getIndexDbPath(): string {
	return join(homedir(), ".claude", "han", "memory", "index", "fts.db");
}

/**
 * Ensure index directory exists
 */
export function ensureIndexDir(): void {
	const indexDir = join(homedir(), ".claude", "han", "memory", "index");
	if (!existsSync(indexDir)) {
		mkdirSync(indexDir, { recursive: true });
	}
}

/**
 * Get table name for a layer and optional project scope
 */
export function getTableName(layer: IndexLayer, gitRemote?: string): string {
	const base = `han_${layer}`;
	if (gitRemote) {
		const normalized = normalizeGitRemote(gitRemote);
		return `${base}_${normalized}`;
	}
	return base;
}

/**
 * Initialize the database (creates if not exists)
 */
export async function initTable(_tableName: string): Promise<boolean> {
	const nativeModule = tryGetNativeModule();
	if (!nativeModule) return false;
	ensureIndexDir();
	const dbPath = getIndexDbPath();
	// dbInit initializes the database; tables are created implicitly on first index
	return nativeModule.dbInit(dbPath);
}

/**
 * Index documents into FTS
 */
export async function indexDocuments(
	tableName: string,
	documents: IndexDocument[],
): Promise<number> {
	const nativeModule = tryGetNativeModule();
	if (!nativeModule) return 0;
	ensureIndexDir();
	const dbPath = getIndexDbPath();

	// Convert to native format
	const nativeDocs = documents.map((doc) => ({
		id: doc.id,
		content: doc.content,
		metadata: doc.metadata,
	}));

	return nativeModule.ftsIndex(dbPath, tableName, nativeDocs);
}

/**
 * Search FTS index
 */
export async function searchFts(
	tableName: string,
	query: string,
	limit = 10,
): Promise<FtsResult[]> {
	const nativeModule = tryGetNativeModule();
	if (!nativeModule) return [];
	const dbPath = getIndexDbPath();

	// Check if DB exists
	if (!existsSync(dbPath)) {
		return [];
	}

	const results = await nativeModule.ftsSearch(dbPath, tableName, query, limit);

	return results.map((r) => ({
		id: r.id,
		content: r.content,
		metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
		score: r.score,
	}));
}

/**
 * Delete documents from FTS index
 */
export async function deleteDocuments(
	tableName: string,
	ids: string[],
): Promise<number> {
	const nativeModule = tryGetNativeModule();
	if (!nativeModule) return 0;
	const dbPath = getIndexDbPath();
	return nativeModule.ftsDelete(dbPath, tableName, ids);
}

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
	const nativeModule = tryGetNativeModule();
	if (!nativeModule) return [];
	return nativeModule.generateEmbedding(text);
}

/**
 * Generate embeddings for multiple texts (batched)
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
	const nativeModule = tryGetNativeModule();
	if (!nativeModule) return [];
	return nativeModule.generateEmbeddings(texts);
}

/**
 * Get embedding dimension (384 for all-MiniLM-L6-v2)
 */
export function getEmbeddingDimension(): number {
	const nativeModule = tryGetNativeModule();
	if (!nativeModule) return 384; // Default for all-MiniLM-L6-v2
	return nativeModule.getEmbeddingDimension();
}

/**
 * Convert RawObservation to IndexDocument
 */
function rawObservationToDocument(obs: RawObservation): IndexDocument {
	const content = [
		`Tool: ${obs.tool}`,
		obs.input_summary,
		obs.output_summary,
		obs.files_read.length > 0 ? `Files read: ${obs.files_read.join(", ")}` : "",
		obs.files_modified.length > 0
			? `Files modified: ${obs.files_modified.join(", ")}`
			: "",
	]
		.filter(Boolean)
		.join("\n");

	return {
		id: obs.id,
		content,
		metadata: JSON.stringify({
			session_id: obs.session_id,
			timestamp: obs.timestamp,
			tool: obs.tool,
			files_read: obs.files_read,
			files_modified: obs.files_modified,
			layer: "observations",
		}),
	};
}

/**
 * Convert SessionSummary to IndexDocument
 */
function summaryToDocument(summary: SessionSummary): IndexDocument {
	const workItems = summary.work_items
		.map((w) => `- ${w.description} (${w.outcome})`)
		.join("\n");

	const decisions = summary.decisions
		.map((d) => `- ${d.description}: ${d.rationale}`)
		.join("\n");

	const content = [
		summary.summary,
		workItems ? `Work completed:\n${workItems}` : "",
		summary.in_progress.length > 0
			? `In progress: ${summary.in_progress.join(", ")}`
			: "",
		decisions ? `Decisions:\n${decisions}` : "",
	]
		.filter(Boolean)
		.join("\n\n");

	return {
		id: summary.session_id,
		content,
		metadata: JSON.stringify({
			session_id: summary.session_id,
			project: summary.project,
			started_at: summary.started_at,
			ended_at: summary.ended_at,
			layer: "summaries",
		}),
	};
}

/**
 * Convert ExtractedObservation to IndexDocument (for team memory)
 */
function extractedObservationToDocument(
	obs: ExtractedObservation,
): IndexDocument {
	const content = [
		obs.summary,
		obs.detail,
		obs.files.length > 0 ? `Files: ${obs.files.join(", ")}` : "",
		obs.pr_context
			? `PR #${obs.pr_context.number}: ${obs.pr_context.title}`
			: "",
	]
		.filter(Boolean)
		.join("\n");

	return {
		id: obs.source,
		content,
		metadata: JSON.stringify({
			source: obs.source,
			type: obs.type,
			timestamp: obs.timestamp,
			author: obs.author,
			files: obs.files,
			patterns: obs.patterns,
			pr_context: obs.pr_context,
			layer: "team",
		}),
	};
}

/**
 * Index personal session observations
 */
export async function indexObservations(sessionId?: string): Promise<number> {
	const sessionsPath = getSessionsPath();
	if (!existsSync(sessionsPath)) {
		return 0;
	}

	const tableName = getTableName("observations");
	await initTable(tableName);

	const documents: IndexDocument[] = [];

	// Find session files to index
	const files = readdirSync(sessionsPath).filter((f) => f.endsWith(".jsonl"));

	for (const file of files) {
		// If sessionId provided, only index that session
		if (sessionId && !file.includes(sessionId)) {
			continue;
		}

		const filePath = join(sessionsPath, file);
		const content = readFileSync(filePath, "utf-8");
		const lines = content.split("\n").filter((line) => line.trim());

		for (const line of lines) {
			try {
				const obs = JSON.parse(line) as RawObservation;
				documents.push(rawObservationToDocument(obs));
			} catch {
				// Skip invalid lines
			}
		}
	}

	if (documents.length === 0) {
		return 0;
	}

	return indexDocuments(tableName, documents);
}

/**
 * Index personal session summaries
 */
export async function indexSummaries(): Promise<number> {
	const summariesPath = getSummariesPath();
	if (!existsSync(summariesPath)) {
		return 0;
	}

	const tableName = getTableName("summaries");
	await initTable(tableName);

	const documents: IndexDocument[] = [];

	// Find summary files to index
	const files = readdirSync(summariesPath).filter(
		(f) => f.endsWith(".yaml") || f.endsWith(".json"),
	);

	for (const file of files) {
		const filePath = join(summariesPath, file);
		try {
			const content = readFileSync(filePath, "utf-8");
			const summary = JSON.parse(content) as SessionSummary;
			documents.push(summaryToDocument(summary));
		} catch {
			// Skip invalid files
		}
	}

	if (documents.length === 0) {
		return 0;
	}

	return indexDocuments(tableName, documents);
}

/**
 * Index team memory observations (from git/github)
 */
export async function indexTeamMemory(
	gitRemote: string,
	observations: ExtractedObservation[],
): Promise<number> {
	if (observations.length === 0) {
		return 0;
	}

	const tableName = getTableName("team", gitRemote);
	await initTable(tableName);

	const documents = observations.map(extractedObservationToDocument);
	return indexDocuments(tableName, documents);
}

/**
 * Index options for the CLI command
 */
export interface IndexOptions {
	layer?: IndexLayer;
	gitRemote?: string;
	sessionId?: string;
	projectSlug?: string;
	verbose?: boolean;
}

/**
 * Run full indexing
 */
export async function runIndex(options: IndexOptions = {}): Promise<{
	observations: number;
	summaries: number;
	team: number;
	transcripts: number;
}> {
	const results = {
		observations: 0,
		summaries: 0,
		team: 0,
		transcripts: 0,
	};

	const layers = options.layer
		? [options.layer]
		: ["observations", "summaries"];

	for (const layer of layers) {
		switch (layer) {
			case "observations":
				results.observations = await indexObservations(options.sessionId);
				if (options.verbose) {
					console.log(`Indexed ${results.observations} observations`);
				}
				break;

			case "summaries":
				results.summaries = await indexSummaries();
				if (options.verbose) {
					console.log(`Indexed ${results.summaries} summaries`);
				}
				break;

			case "team": {
				// Team memory requires git remote
				const remote = options.gitRemote || getGitRemote();
				if (!remote) {
					if (options.verbose) {
						console.log("Skipping team memory: not in a git repository");
					}
					break;
				}
				// Team memory indexing is handled by the providers
				// This will be called from the memory command
				if (options.verbose) {
					console.log("Team memory indexing requires running memory providers");
				}
				break;
			}

			case "transcripts": {
				// Import transcript indexing dynamically to avoid circular deps
				const { indexTranscripts } = await import("./transcript-search.ts");
				results.transcripts = await indexTranscripts(options.projectSlug);
				if (options.verbose) {
					console.log(`Indexed ${results.transcripts} transcript messages`);
				}
				break;
			}
		}
	}

	return results;
}

/**
 * Search across all indexed layers
 */
export async function searchAll(
	query: string,
	options: {
		layers?: IndexLayer[];
		gitRemote?: string;
		limit?: number;
	} = {},
): Promise<FtsResult[]> {
	const layers = options.layers || ["observations", "summaries"];
	const limit = options.limit || 10;
	const allResults: FtsResult[] = [];

	for (const layer of layers) {
		const tableName = getTableName(
			layer,
			layer === "team" ? options.gitRemote : undefined,
		);

		try {
			const results = await searchFts(tableName, query, limit);
			allResults.push(...results);
		} catch {
			// Table may not exist yet, skip
		}
	}

	// Sort by score and limit
	return allResults.sort((a, b) => b.score - a.score).slice(0, limit);
}
