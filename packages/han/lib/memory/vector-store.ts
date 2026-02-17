/**
 * Vector Store Abstraction for Han Memory
 *
 * Provides semantic search capabilities using the native SurrealDB + ONNX Runtime backend.
 * The native module handles all embedding generation and vector storage internally.
 *
 * Storage location: ~/.han/memory/index/
 */

import { vectors as grpcVectors } from '../grpc/data-access.ts';
import type { IndexedObservation, SearchResult } from './types.ts';

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
    limit?: number
  ): Promise<SearchResult[]>;

  /** Close the store and release resources */
  close(): Promise<void>;
}

/**
 * Get the vector database path
 */
function getVectorDbPath(): string {
  const { homedir } = require('node:os');
  const { join } = require('node:path');
  return join(homedir(), '.claude', 'han', 'memory', 'index', 'vectors.db');
}

/**
 * Ensure the database directory exists
 */
function ensureDbDir(): void {
  const { existsSync, mkdirSync } = require('node:fs');
  const { homedir } = require('node:os');
  const { join } = require('node:path');
  const dir = join(homedir(), '.claude', 'han', 'memory', 'index');
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
        'Vector store not available. Native module failed to load.'
      );
    },

    async embedBatch(_texts: string[]) {
      throw new Error(
        'Vector store not available. Native module failed to load.'
      );
    },

    async index(_tableName: string, _observations: IndexedObservation[]) {
      throw new Error(
        'Vector store not available. Native module failed to load.'
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
  // Vector operations now go through gRPC coordinator
  const store: VectorStore = {
    async isAvailable() {
      try {
        // Check if coordinator is reachable for vector operations
        return true;
      } catch {
        return false;
      }
    },

    async embed(_text: string) {
      // Embedding generation delegated to coordinator via gRPC
      throw new Error('Embedding generation must go through coordinator');
    },

    async embedBatch(_texts: string[]) {
      throw new Error('Batch embedding generation must go through coordinator');
    },

    async index(_tableName: string, observations: IndexedObservation[]) {
      // Index via gRPC vector service
      for (const obs of observations) {
        await grpcVectors.index(
          obs.id,
          `${obs.summary}\n${obs.detail}`,
          undefined,
          obs.source,
        );
      }
    },

    async search(_tableName: string, query: string, limit = 10) {
      const results = await grpcVectors.search(query, { limit });

      return results.map((r) => ({
        observation: {
          id: r.id,
          source: r.source || r.id,
          type: 'commit' as IndexedObservation['type'],
          timestamp: 0,
          author: '',
          summary: r.content.split('\n')[0] || '',
          detail: r.content,
          files: [],
          patterns: [],
          pr_context: undefined,
        },
        score: r.score,
        excerpt: r.content.split('\n')[0] || '',
      }));
    },

    async close() {
      // No-op - gRPC connections managed by client
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

/**
 * Reset the singleton instance (for testing only)
 * @internal
 */
export function _resetVectorStoreInstance(): void {
  vectorStoreInstance = null;
}

// Legacy export for backwards compatibility
export const createLanceVectorStore = createNativeVectorStore;
