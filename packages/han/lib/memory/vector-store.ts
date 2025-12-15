/**
 * Vector Store Abstraction for Han Memory
 *
 * Provides semantic search capabilities using the native SurrealDB + ONNX Runtime backend.
 * The native module handles all embedding generation and vector storage internally.
 *
 * Storage location: ~/.claude/han/memory/index/
 */

import type { IndexedObservation, SearchResult } from "./types.ts";

/**
 * Native module type definition
 */
type NativeModule = typeof import("../../../han-native");

/**
 * Lazy-loaded native module with graceful degradation.
 * Returns null if native module cannot be loaded.
 */
let _nativeModule: NativeModule | null | undefined;
function getNativeModule(): NativeModule | null {
	if (_nativeModule === undefined) {
		try {
			// Bun requires require() for .node files
			_nativeModule = require("../../native/han-native.node") as NativeModule;
		} catch {
			// Native module not available
			_nativeModule = null;
		}
	}
	return _nativeModule;
}

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
 * Get the vector database path
 */
function getVectorDbPath(): string {
	const { homedir } = require("node:os");
	const { join } = require("node:path");
	return join(homedir(), ".claude", "han", "memory", "index", "vectors.db");
}

/**
 * Ensure the database directory exists
 */
function ensureDbDir(): void {
	const { existsSync, mkdirSync } = require("node:fs");
	const { homedir } = require("node:os");
	const { join } = require("node:path");
	const dir = join(homedir(), ".claude", "han", "memory", "index");
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
}

/**
 * Placeholder vector store that reports unavailability
 * Used when native module cannot be loaded
 */
export function createFallbackVectorStore(): VectorStore {
	return {
		async isAvailable() {
			return false;
		},

		async embed(_text: string) {
			throw new Error(
				"Vector store not available. Native module failed to load.",
			);
		},

		async embedBatch(_texts: string[]) {
			throw new Error(
				"Vector store not available. Native module failed to load.",
			);
		},

		async index(_tableName: string, _observations: IndexedObservation[]) {
			throw new Error(
				"Vector store not available. Native module failed to load.",
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
 * Create native-backed vector store using SurrealDB + ONNX Runtime
 */
export async function createNativeVectorStore(): Promise<VectorStore> {
	const nativeModule = getNativeModule();
	if (!nativeModule) {
		return createFallbackVectorStore();
	}

	// Check if embeddings are available, ensure dependencies downloaded
	let embeddingsReady = false;
	try {
		embeddingsReady = await nativeModule.embeddingIsAvailable();
		if (!embeddingsReady) {
			// Download ONNX Runtime and model on first use
			await nativeModule.embeddingEnsureAvailable();
			embeddingsReady = true;
		}
	} catch {
		// Embedding system failed to initialize
		return createFallbackVectorStore();
	}

	// Initialize database
	const dbPath = getVectorDbPath();
	ensureDbDir();
	try {
		await nativeModule.dbInit(dbPath);
	} catch {
		return createFallbackVectorStore();
	}

	const store: VectorStore = {
		async isAvailable() {
			return embeddingsReady;
		},

		async embed(text: string) {
			if (!nativeModule) throw new Error("Native module not available");
			return nativeModule.generateEmbedding(text);
		},

		async embedBatch(texts: string[]) {
			if (!nativeModule) throw new Error("Native module not available");
			return nativeModule.generateEmbeddings(texts);
		},

		async index(tableName: string, observations: IndexedObservation[]) {
			if (!nativeModule) throw new Error("Native module not available");

			// Generate embeddings for observations without them
			const docsWithEmbeddings = await Promise.all(
				observations.map(async (obs) => {
					let embedding = obs.embedding;
					if (!embedding) {
						embedding = await this.embed(`${obs.summary} ${obs.detail}`);
					}
					return {
						id: obs.id,
						content: `${obs.summary}\n${obs.detail}`,
						vector: embedding,
						metadata: JSON.stringify({
							source: obs.source,
							type: obs.type,
							timestamp: obs.timestamp,
							author: obs.author,
							files: obs.files,
							patterns: obs.patterns,
							pr_context: obs.pr_context,
						}),
					};
				}),
			);

			await nativeModule.vectorIndex(dbPath, tableName, docsWithEmbeddings);
		},

		async search(tableName: string, query: string, limit = 10) {
			if (!nativeModule) return [];

			// Generate query embedding
			const queryEmbedding = await this.embed(query);

			// Search by vector similarity
			const results = await nativeModule.vectorSearch(
				dbPath,
				tableName,
				queryEmbedding,
				limit,
			);

			return results.map((r) => {
				let metadata: Record<string, unknown> = {};
				try {
					metadata = r.metadata ? JSON.parse(r.metadata) : {};
				} catch {
					// Invalid metadata JSON
				}

				return {
					observation: {
						id: r.id,
						source: (metadata.source as string) || r.id,
						type: (metadata.type as IndexedObservation["type"]) || "commit",
						timestamp: (metadata.timestamp as number) || 0,
						author: (metadata.author as string) || "",
						summary: r.content.split("\n")[0] || "",
						detail: r.content,
						files: (metadata.files as string[]) || [],
						patterns: (metadata.patterns as string[]) || [],
						pr_context: metadata.pr_context as IndexedObservation["pr_context"],
					},
					score: r.score,
					excerpt: r.content.split("\n")[0] || "",
				};
			});
		},

		async close() {
			// SurrealDB handles cleanup automatically
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
 * Uses native SurrealDB + ONNX Runtime backend
 */
export async function getVectorStore(_dbPath?: string): Promise<VectorStore> {
	if (!vectorStoreInstance) {
		vectorStoreInstance = await createNativeVectorStore();
	}
	return vectorStoreInstance;
}

// Legacy export for backwards compatibility
export const createLanceVectorStore = createNativeVectorStore;
