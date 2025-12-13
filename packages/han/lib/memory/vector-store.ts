/**
 * Vector Store Abstraction for Han Memory
 *
 * Provides semantic search capabilities using LanceDB when available.
 * Falls back to simple text matching if LanceDB is not installed.
 *
 * LanceDB is pure WebAssembly - no native bindings, no setup required.
 */

import type { IndexedObservation, SearchResult } from "./types.ts";

/**
 * Vector store interface for semantic search
 */
export interface VectorStore {
	/** Check if vector search is available */
	isAvailable(): Promise<boolean>;

	/** Generate embeddings for text */
	embed(text: string): Promise<number[]>;

	/** Generate embeddings for multiple texts (batch) */
	embedBatch(texts: string[]): Promise<number[][]>;

	/** Index observations with embeddings */
	index(tableName: string, observations: IndexedObservation[]): Promise<void>;

	/** Search by semantic similarity */
	search(
		tableName: string,
		query: string,
		limit?: number,
	): Promise<SearchResult[]>;

	/** Close the store and release resources */
	close(): Promise<void>;
}

/**
 * Placeholder vector store that reports unavailability
 * Used when LanceDB is not installed
 */
export function createFallbackVectorStore(): VectorStore {
	return {
		async isAvailable() {
			return false;
		},

		async embed(_text: string) {
			throw new Error(
				"Vector store not available. Install @lancedb/lancedb for semantic search.",
			);
		},

		async embedBatch(_texts: string[]) {
			throw new Error(
				"Vector store not available. Install @lancedb/lancedb for semantic search.",
			);
		},

		async index(_tableName: string, _observations: IndexedObservation[]) {
			throw new Error(
				"Vector store not available. Install @lancedb/lancedb for semantic search.",
			);
		},

		async search(_tableName: string, _query: string, _limit?: number) {
			return [];
		},

		async close() {
			// No-op
		},
	};
}

/**
 * Create LanceDB-backed vector store
 * Lazily loads LanceDB and transformers.js to avoid startup cost
 */
/**
 * LanceDB module type (when available)
 */
interface LanceDBModule {
	connect: (path: string) => Promise<unknown>;
}

export async function createLanceVectorStore(
	dbPath: string,
): Promise<VectorStore> {
	// Try to load LanceDB
	let lancedb: LanceDBModule | null = null;
	let pipeline: (() => Promise<unknown>) | null = null;
	let db: unknown = null;

	try {
		// Dynamic import to avoid bundling if not used
		// These are optional dependencies - will throw if not installed
		// Use Function constructor to prevent TypeScript from analyzing these imports
		const dynamicImport = new Function(
			"moduleName",
			"return import(moduleName)",
		) as (name: string) => Promise<unknown>;

		const lanceModule = await dynamicImport("@lancedb/lancedb").catch(
			() => null,
		);
		const transformersModule = await dynamicImport(
			"@xenova/transformers",
		).catch(() => null);

		if (!lanceModule || !transformersModule) {
			return createFallbackVectorStore();
		}

		lancedb = lanceModule as LanceDBModule;
		pipeline = () =>
			(
				transformersModule as {
					pipeline: (...args: unknown[]) => Promise<unknown>;
				}
			).pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
	} catch {
		return createFallbackVectorStore();
	}

	let embedder: unknown = null;

	const store: VectorStore = {
		async isAvailable() {
			return lancedb !== null;
		},

		async embed(text: string) {
			if (!embedder && pipeline) {
				embedder = await pipeline();
			}
			const result = await (
				embedder as (
					text: string,
					options: unknown,
				) => Promise<{ data: Float32Array }>
			)(text, {
				pooling: "mean",
				normalize: true,
			});
			return Array.from(result.data);
		},

		async embedBatch(texts: string[]) {
			const results: number[][] = [];
			for (const text of texts) {
				results.push(await this.embed(text));
			}
			return results;
		},

		async index(tableName: string, observations: IndexedObservation[]) {
			if (!db && lancedb) {
				db = await lancedb.connect(dbPath);
			}

			// Generate embeddings for observations without them
			const withEmbeddings = await Promise.all(
				observations.map(async (obs) => {
					if (obs.embedding) return obs;
					const embedding = await this.embed(`${obs.summary} ${obs.detail}`);
					return { ...obs, embedding };
				}),
			);

			// Upsert into table
			const table = await (
				db as { openTable: (name: string) => Promise<unknown> }
			)
				.openTable(tableName)
				.catch(async () => {
					// Create table if it doesn't exist
					return (
						db as {
							createTable: (name: string, data: unknown[]) => Promise<unknown>;
						}
					).createTable(tableName, withEmbeddings);
				});

			if (table && withEmbeddings.length > 0) {
				await (table as { add: (data: unknown[]) => Promise<void> }).add(
					withEmbeddings,
				);
			}
		},

		async search(tableName: string, query: string, limit = 10) {
			if (!db && lancedb) {
				db = await lancedb.connect(dbPath);
			}

			try {
				const table = await (
					db as { openTable: (name: string) => Promise<unknown> }
				).openTable(tableName);
				const queryEmbedding = await this.embed(query);

				const results = await (
					table as {
						search: (embedding: number[]) => {
							limit: (n: number) => {
								execute: () => Promise<
									Array<IndexedObservation & { _distance: number }>
								>;
							};
						};
					}
				)
					.search(queryEmbedding)
					.limit(limit)
					.execute();

				return results.map((row) => ({
					observation: row as IndexedObservation,
					score: 1 - (row._distance || 0), // LanceDB returns distance, convert to similarity
					excerpt: row.summary || "",
				}));
			} catch {
				// Table doesn't exist yet
				return [];
			}
		},

		async close() {
			if (db) {
				// LanceDB doesn't require explicit close
				db = null;
			}
		},
	};

	return store;
}

/**
 * Singleton vector store instance
 */
let vectorStoreInstance: VectorStore | null = null;

/**
 * Get or create the vector store
 * Attempts to use LanceDB, falls back to placeholder if unavailable
 */
export async function getVectorStore(dbPath: string): Promise<VectorStore> {
	if (!vectorStoreInstance) {
		vectorStoreInstance = await createLanceVectorStore(dbPath);
	}
	return vectorStoreInstance;
}
