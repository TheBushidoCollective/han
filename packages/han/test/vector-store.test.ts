/**
 * Tests for vector store abstraction
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("vector store", () => {
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

	describe("createFallbackVectorStore", () => {
		test("creates a fallback store that reports unavailable", async () => {
			const { createFallbackVectorStore } = await import(
				"../lib/memory/vector-store.ts"
			);
			const store = createFallbackVectorStore();

			expect(await store.isAvailable()).toBe(false);
		});

		test("fallback store embed throws error", async () => {
			const { createFallbackVectorStore } = await import(
				"../lib/memory/vector-store.ts"
			);
			const store = createFallbackVectorStore();

			await expect(store.embed("test")).rejects.toThrow(
				"Vector store not available",
			);
		});

		test("fallback store embedBatch throws error", async () => {
			const { createFallbackVectorStore } = await import(
				"../lib/memory/vector-store.ts"
			);
			const store = createFallbackVectorStore();

			await expect(store.embedBatch(["test1", "test2"])).rejects.toThrow(
				"Vector store not available",
			);
		});

		test("fallback store index throws error", async () => {
			const { createFallbackVectorStore } = await import(
				"../lib/memory/vector-store.ts"
			);
			const store = createFallbackVectorStore();

			await expect(store.index("table", [])).rejects.toThrow(
				"Vector store not available",
			);
		});

		test("fallback store search returns empty array", async () => {
			const { createFallbackVectorStore } = await import(
				"../lib/memory/vector-store.ts"
			);
			const store = createFallbackVectorStore();

			const results = await store.search("table", "query");
			expect(results).toEqual([]);
		});

		test("fallback store close is a no-op", async () => {
			const { createFallbackVectorStore } = await import(
				"../lib/memory/vector-store.ts"
			);
			const store = createFallbackVectorStore();

			// Should not throw
			await store.close();
		});
	});

	describe("VectorStore interface", () => {
		test("interface methods are correctly typed", async () => {
			const { createFallbackVectorStore } = await import(
				"../lib/memory/vector-store.ts"
			);
			const store = createFallbackVectorStore();

			// Type check - these should compile
			expect(typeof store.isAvailable).toBe("function");
			expect(typeof store.embed).toBe("function");
			expect(typeof store.embedBatch).toBe("function");
			expect(typeof store.index).toBe("function");
			expect(typeof store.search).toBe("function");
			expect(typeof store.close).toBe("function");
		});
	});

	describe("createNativeVectorStore", () => {
		test("returns fallback store when native module unavailable", async () => {
			// This test depends on environment - if native is available, it may succeed
			const { createNativeVectorStore } = await import(
				"../lib/memory/vector-store.ts"
			);
			const { tryGetNativeModule } = await import("../lib/native.ts");

			const store = await createNativeVectorStore();
			const nativeAvailable = tryGetNativeModule() !== null;

			// If native is unavailable, should return fallback
			if (!nativeAvailable) {
				expect(await store.isAvailable()).toBe(false);
			}
		});

		test("getVectorStore returns consistent store", async () => {
			// Import once to ensure we're working with the same module instance
			const vectorStoreModule = await import("../lib/memory/vector-store.ts");
			const { getVectorStore, _resetVectorStoreInstance } = vectorStoreModule;

			// Reset singleton state before testing
			_resetVectorStoreInstance();

			const store1 = await getVectorStore();
			const store2 = await getVectorStore();

			// Verify both calls return stores with the same availability status
			// (This tests the singleton caches the native module check)
			const available1 = await store1.isAvailable();
			const available2 = await store2.isAvailable();
			expect(available1).toBe(available2);

			// Both stores should have the same interface
			expect(typeof store1.embed).toBe("function");
			expect(typeof store2.embed).toBe("function");

			// Clean up
			_resetVectorStoreInstance();
		});
	});

	describe("native vector store functionality", () => {
		test("native store can generate embeddings when available", async () => {
			const { createNativeVectorStore } = await import(
				"../lib/memory/vector-store.ts"
			);
			const store = await createNativeVectorStore();

			if (await store.isAvailable()) {
				const embedding = await store.embed("test text");
				expect(Array.isArray(embedding)).toBe(true);
				expect(embedding.length).toBeGreaterThan(0);
				// all-MiniLM-L6-v2 produces 384-dimensional embeddings
				expect(embedding.length).toBe(384);
			}
		});

		test("native store can batch generate embeddings when available", async () => {
			const { createNativeVectorStore } = await import(
				"../lib/memory/vector-store.ts"
			);
			const store = await createNativeVectorStore();

			if (await store.isAvailable()) {
				const embeddings = await store.embedBatch(["text one", "text two"]);
				expect(Array.isArray(embeddings)).toBe(true);
				expect(embeddings.length).toBe(2);
				expect(embeddings[0].length).toBe(384);
				expect(embeddings[1].length).toBe(384);
			}
		});

		test("native store can index and search when available", async () => {
			const { createNativeVectorStore } = await import(
				"../lib/memory/vector-store.ts"
			);
			const store = await createNativeVectorStore();

			if (await store.isAvailable()) {
				// Index some test documents
				await store.index("test_table", [
					{
						id: "doc1",
						source: "test",
						type: "commit",
						timestamp: Date.now(),
						author: "test",
						summary: "Added authentication feature",
						detail: "Implemented JWT-based authentication with refresh tokens",
						files: ["auth.ts"],
						patterns: ["authentication"],
					},
					{
						id: "doc2",
						source: "test",
						type: "commit",
						timestamp: Date.now(),
						author: "test",
						summary: "Fixed database connection",
						detail: "Resolved connection pooling issue in PostgreSQL adapter",
						files: ["db.ts"],
						patterns: ["database"],
					},
				]);

				// Search for related content
				const results = await store.search(
					"test_table",
					"authentication tokens",
					10,
				);
				expect(Array.isArray(results)).toBe(true);
			}
		});
	});
});

describe("legacy exports", () => {
	test("createLanceVectorStore is exported for backwards compatibility", async () => {
		const { createLanceVectorStore, createNativeVectorStore } = await import(
			"../lib/memory/vector-store.ts"
		);
		expect(createLanceVectorStore).toBe(createNativeVectorStore);
	});
});
