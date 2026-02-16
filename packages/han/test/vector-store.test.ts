/**
 * Tests for vector store abstraction
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('vector store', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `han-vector-store-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('createFallbackVectorStore', () => {
    test('creates a fallback store that reports unavailable', async () => {
      const { createFallbackVectorStore } = await import(
        '../lib/memory/vector-store.ts'
      );
      const store = createFallbackVectorStore();

      expect(await store.isAvailable()).toBe(false);
    });

    test('fallback store embed throws error', async () => {
      const { createFallbackVectorStore } = await import(
        '../lib/memory/vector-store.ts'
      );
      const store = createFallbackVectorStore();

      await expect(store.embed('test')).rejects.toThrow(
        'Vector store not available'
      );
    });

    test('fallback store embedBatch throws error', async () => {
      const { createFallbackVectorStore } = await import(
        '../lib/memory/vector-store.ts'
      );
      const store = createFallbackVectorStore();

      await expect(store.embedBatch(['test1', 'test2'])).rejects.toThrow(
        'Vector store not available'
      );
    });

    test('fallback store index throws error', async () => {
      const { createFallbackVectorStore } = await import(
        '../lib/memory/vector-store.ts'
      );
      const store = createFallbackVectorStore();

      await expect(store.index('table', [])).rejects.toThrow(
        'Vector store not available'
      );
    });

    test('fallback store search returns empty array', async () => {
      const { createFallbackVectorStore } = await import(
        '../lib/memory/vector-store.ts'
      );
      const store = createFallbackVectorStore();

      const results = await store.search('table', 'query');
      expect(results).toEqual([]);
    });

    test('fallback store close is a no-op', async () => {
      const { createFallbackVectorStore } = await import(
        '../lib/memory/vector-store.ts'
      );
      const store = createFallbackVectorStore();

      // Should not throw
      await store.close();
    });
  });

  describe('VectorStore interface', () => {
    test('interface methods are correctly typed', async () => {
      const { createFallbackVectorStore } = await import(
        '../lib/memory/vector-store.ts'
      );
      const store = createFallbackVectorStore();

      // Type check - these should compile
      expect(typeof store.isAvailable).toBe('function');
      expect(typeof store.embed).toBe('function');
      expect(typeof store.embedBatch).toBe('function');
      expect(typeof store.index).toBe('function');
      expect(typeof store.search).toBe('function');
      expect(typeof store.close).toBe('function');
    });
  });
});

describe('legacy exports', () => {
  test('createLanceVectorStore is exported for backwards compatibility', async () => {
    const { createLanceVectorStore, createNativeVectorStore } = await import(
      '../lib/memory/vector-store.ts'
    );
    expect(createLanceVectorStore).toBe(createNativeVectorStore);
  });
});
