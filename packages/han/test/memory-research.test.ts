/**
 * Tests for lib/memory/research.ts
 * Tests the research engine that implements "research until confident"
 */
import { describe, expect, test } from "bun:test";
import { createResearchEngine } from "../lib/memory/research.ts";
import type { IndexedObservation, SearchResult } from "../lib/memory/types.ts";

/**
 * Create a simple mock search function that returns fixed results.
 * This is the most deterministic approach for testing confidence levels.
 */
function createMockSearchFn(
	results: SearchResult[],
): (query: string) => Promise<SearchResult[]> {
	return async (_query: string) => results;
}

/**
 * Helper to create an observation with sensible defaults
 */
function makeObservation(
	overrides: Partial<IndexedObservation> & { id: string },
): IndexedObservation {
	return {
		source: `git:commit:${overrides.id}`,
		type: "commit",
		timestamp: Date.now(),
		author: "test@example.com",
		summary: "Test observation",
		detail: "Test detail",
		files: ["test.ts"],
		patterns: ["test"],
		...overrides,
	};
}

/**
 * Helper to create a search result
 */
function makeResult(
	obs: IndexedObservation,
	score: number,
	excerpt?: string,
): SearchResult {
	return {
		observation: obs,
		score,
		excerpt: excerpt || obs.detail.slice(0, 200),
	};
}

// Legacy mock storage for tests that need more complex behavior
function createMockStorage() {
	const observations: IndexedObservation[] = [];

	return {
		observations,
		addObservations(obs: IndexedObservation[]) {
			observations.push(...obs);
		},
		async search(query: string): Promise<SearchResult[]> {
			const queryLower = query.toLowerCase();
			const results: SearchResult[] = [];

			// Handle special queries like "pr:123"
			const prMatch = query.match(/^pr:(\d+)$/);
			if (prMatch) {
				const prNumber = prMatch[1];
				for (const obs of observations) {
					if (obs.source === `github:pr:${prNumber}`) {
						results.push({
							observation: obs,
							score: 1.0,
							excerpt: obs.detail.slice(0, 200),
						});
					}
				}
				return results;
			}

			// Filter out common stop words
			const stopWords = new Set([
				"who",
				"what",
				"when",
				"where",
				"why",
				"how",
				"the",
				"a",
				"an",
				"and",
				"or",
				"but",
				"is",
				"are",
				"was",
				"were",
				"do",
				"does",
				"did",
				"about",
				"to",
				"from",
				"in",
				"on",
				"at",
				"for",
				"with",
			]);

			for (const obs of observations) {
				const searchText =
					`${obs.summary} ${obs.detail} ${obs.author} ${obs.files.join(" ")} ${obs.patterns.join(" ")}`.toLowerCase();

				const queryWords = queryLower
					.replace(/[.,!?;:]/g, " ")
					.split(/\s+/)
					.filter((w) => w.length > 2 && !stopWords.has(w));
				let matchCount = 0;

				for (const word of queryWords) {
					if (searchText.includes(word)) {
						matchCount++;
					}
				}

				if (matchCount > 0 && queryWords.length > 0) {
					const score = Math.min(1.0, matchCount / queryWords.length);
					let excerpt = obs.detail.slice(0, 200);
					if (obs.pr_context?.description) {
						excerpt = `${obs.detail} ${obs.pr_context.description}`.slice(
							0,
							200,
						);
					}

					results.push({
						observation: obs,
						score,
						excerpt,
					});
				}
			}

			return results.sort((a, b) => b.score - a.score);
		},
	};
}

describe("research.ts", () => {
	describe("research engine", () => {
		test("returns high confidence when multiple independent sources found", async () => {
			// High confidence: 2+ unique authors with 2+ strong evidence (score >= 0.5)
			const obs1 = makeObservation({
				id: "1",
				author: "alice@example.com",
				summary: "Implement OAuth2 authentication",
				detail: "Added OAuth2 authentication flow",
			});
			const obs2 = makeObservation({
				id: "2",
				author: "bob@example.com", // Different author
				summary: "Review authentication implementation",
				detail: "Reviewed OAuth2 implementation",
			});

			const searchFn = createMockSearchFn([
				makeResult(obs1, 0.8),
				makeResult(obs2, 0.7),
			]);

			const engine = createResearchEngine(searchFn);
			const result = await engine.research("who implemented authentication?");

			expect(result.confidence).toBe("high");
			expect(result.citations.length).toBeGreaterThan(1);
			expect(result.answer).toContain("alice@example.com");
		});

		test("returns medium confidence with single strong source", async () => {
			// Medium confidence: 1 strong evidence (score >= 0.5) from 1 author
			const obs = makeObservation({
				id: "1",
				author: "alice@example.com",
				summary: "Implement payment processing",
				detail: "Implemented comprehensive payment processing system",
			});

			const searchFn = createMockSearchFn([makeResult(obs, 0.7)]);

			const engine = createResearchEngine(searchFn);
			const result = await engine.research("who knows about payments?");

			expect(result.confidence).toBe("medium");
			expect(result.citations.length).toBe(1);
			expect(result.answer).toContain("alice@example.com");
		});

		test("returns low confidence when no strong sources found", async () => {
			// Low confidence: no results
			const searchFn = createMockSearchFn([]);

			const engine = createResearchEngine(searchFn);
			const result = await engine.research(
				"who knows about blockchain integration?",
			);

			expect(result.confidence).toBe("low");
			expect(result.caveats.length).toBeGreaterThan(0);
			expect(result.answer).toContain("couldn't find");
		});

		test("includes citations in results", async () => {
			const storage = createMockStorage();

			storage.addObservations([
				{
					id: "1",
					source: "git:commit:abc123",
					type: "commit",
					timestamp: 1234567890,
					author: "alice@example.com",
					summary: "Add database migration",
					detail:
						"Added migration for user table with email and password fields",
					files: ["migrations/001_users.sql"],
					patterns: ["database", "migration"],
				},
			]);

			const engine = createResearchEngine(storage.search.bind(storage));
			const result = await engine.research("database migrations");

			expect(result.citations.length).toBeGreaterThan(0);

			const citation = result.citations[0];
			expect(citation).toBeDefined();
			expect(citation.source).toBe("git:commit:abc123");
			expect(citation.excerpt).toBeDefined();
			expect(citation.relevance).toBeGreaterThan(0);
			expect(citation.relevance).toBeLessThanOrEqual(1);
		});

		test("discovers new leads during investigation", async () => {
			const storage = createMockStorage();

			// Add observations that reference each other
			storage.addObservations([
				{
					id: "1",
					source: "git:commit:abc123",
					type: "commit",
					timestamp: Date.now(),
					author: "alice@example.com",
					summary: "Initial API design",
					detail: "See PR #123 for full discussion of API design decisions",
					files: ["src/api/routes.ts"],
					patterns: ["api"],
				},
				{
					id: "2",
					source: "github:pr:123",
					type: "pr",
					timestamp: Date.now(),
					author: "bob@example.com",
					summary: "API Design Discussion",
					detail:
						"After reviewing RFC-42, we decided to use REST over GraphQL for simplicity. Alice implemented the final design.",
					files: ["src/api/routes.ts"],
					patterns: ["api", "design"],
				},
			]);

			const engine = createResearchEngine(storage.search.bind(storage));
			const result = await engine.research("API design decisions");

			// Should find at least one citation (may find more if following leads)
			expect(result.citations.length).toBeGreaterThan(0);
			// The research engine extracts PR references but may not follow them if already confident
			expect(result.searched_sources.length).toBeGreaterThan(0);
		});

		test("includes caveats for contradictory evidence", async () => {
			// Contradictory evidence: different technologies mentioned over time
			const now = Date.now();
			const obs1 = makeObservation({
				id: "1",
				source: "git:commit:abc123",
				timestamp: now - 86400000, // 1 day ago
				author: "alice@example.com",
				summary: "Use MongoDB for data storage",
				detail: "Decided to use MongoDB for its flexibility and scalability",
			});
			const obs2 = makeObservation({
				id: "2",
				source: "git:commit:def456",
				timestamp: now, // More recent
				author: "bob@example.com",
				summary: "Migrate to PostgreSQL",
				detail:
					"Migrated from MongoDB to PostgreSQL for better relational data support",
			});

			const searchFn = createMockSearchFn([
				makeResult(obs1, 0.8),
				makeResult(obs2, 0.9),
			]);

			const engine = createResearchEngine(searchFn);
			const result = await engine.research("what database do we use?");

			expect(result.caveats.length).toBeGreaterThan(0);
			expect(result.answer.toLowerCase()).toContain("postgres");
			// Should mention the change or conflicting information
			expect(
				result.caveats.some(
					(c) => c.toLowerCase().includes("changed") || c.includes("previous"),
				),
			).toBe(true);
		});

		test("tracks searched sources", async () => {
			const storage = createMockStorage();

			storage.addObservations([
				{
					id: "1",
					source: "git:commit:abc123",
					type: "commit",
					timestamp: Date.now(),
					author: "alice@example.com",
					summary: "Add logging",
					detail: "Added structured logging with Winston",
					files: ["src/logger.ts"],
					patterns: ["logging"],
				},
			]);

			const engine = createResearchEngine(storage.search.bind(storage));
			const result = await engine.research("logging implementation");

			expect(result.searched_sources).toBeDefined();
			expect(result.searched_sources.length).toBeGreaterThan(0);
		});

		test("handles empty index gracefully", async () => {
			const storage = createMockStorage();
			const engine = createResearchEngine(storage.search.bind(storage));
			const result = await engine.research("anything");

			expect(result.confidence).toBe("low");
			expect(result.citations).toHaveLength(0);
			expect(result.answer).toContain("couldn't find");
		});

		test("extracts author expertise from multiple contributions", async () => {
			// High confidence: 3+ strong contributions from same author
			const now = Date.now();
			const obs1 = makeObservation({
				id: "1",
				timestamp: now - 86400000 * 30, // 30 days ago
				author: "alice@example.com",
				summary: "Initial WebSocket implementation",
				detail: "Set up WebSocket server with Socket.IO",
			});
			const obs2 = makeObservation({
				id: "2",
				timestamp: now - 86400000 * 15, // 15 days ago
				author: "alice@example.com",
				summary: "Add WebSocket authentication",
				detail: "Integrated JWT authentication with WebSocket connections",
			});
			const obs3 = makeObservation({
				id: "3",
				timestamp: now,
				author: "alice@example.com",
				summary: "WebSocket reconnection logic",
				detail: "Implemented automatic reconnection with exponential backoff",
			});

			const searchFn = createMockSearchFn([
				makeResult(obs1, 0.7),
				makeResult(obs2, 0.8),
				makeResult(obs3, 0.9),
			]);

			const engine = createResearchEngine(searchFn);
			const result = await engine.research("who knows about WebSocket?");

			expect(result.confidence).toBe("high");
			expect(result.answer).toContain("alice@example.com");
			expect(result.citations.length).toBeGreaterThan(1);
		});
	});

	describe("lead investigation", () => {
		test("follows commit references to PRs", async () => {
			const storage = createMockStorage();

			storage.addObservations([
				{
					id: "1",
					source: "git:commit:abc123",
					type: "commit",
					timestamp: Date.now(),
					author: "alice@example.com",
					summary: "Fix bug #456",
					detail: "Fixed critical bug described in PR #456",
					files: ["src/bug-fix.ts"],
					patterns: ["bugfix"],
					pr_context: {
						number: 456,
						title: "Critical bug in payment processing",
						description:
							"Bug was causing double charges. Root cause was race condition in payment flow.",
					},
				},
			]);

			const engine = createResearchEngine(storage.search.bind(storage));
			const result = await engine.research("payment bug");

			expect(result.citations.length).toBeGreaterThan(0);
			// Should use PR context for better understanding
			expect(
				result.citations.some((c) => c.excerpt.includes("race condition")),
			).toBe(true);
		});

		test("prioritizes more recent evidence", async () => {
			// Recency: more recent evidence should be weighted higher in the answer
			const now = Date.now();
			const obs1 = makeObservation({
				id: "1",
				source: "git:commit:old",
				timestamp: now - 86400000 * 365, // 1 year ago
				author: "alice@example.com",
				summary: "Old approach to caching",
				detail: "Using Redis for all caching",
			});
			const obs2 = makeObservation({
				id: "2",
				source: "git:commit:new",
				timestamp: now, // More recent
				author: "bob@example.com",
				summary: "Updated caching strategy",
				detail: "Migrated to hybrid approach: Redis + in-memory LRU cache",
			});

			const searchFn = createMockSearchFn([
				makeResult(obs1, 0.7),
				makeResult(obs2, 0.8),
			]);

			const engine = createResearchEngine(searchFn);
			const result = await engine.research("caching strategy");

			// More recent evidence should be weighted higher
			expect(result.answer.toLowerCase()).toContain("hybrid");
		});
	});

	describe("confidence assessment", () => {
		test("high confidence requires multiple independent sources", async () => {
			// Single strong source = medium confidence (not high)
			const obs = makeObservation({
				id: "1",
				author: "alice@example.com",
				summary: "Something important",
				detail: "Details about something",
			});

			const searchFn = createMockSearchFn([makeResult(obs, 0.6)]);

			const engine = createResearchEngine(searchFn);
			const result = await engine.research("something");

			expect(result.confidence).not.toBe("high");
		});

		test("multiple sources from same author counts as medium confidence", async () => {
			// 2 contributions from same author = medium confidence, need 3 for high
			const obs1 = makeObservation({
				id: "1",
				author: "alice@example.com",
				summary: "Feature A",
				detail: "Implemented feature A",
			});
			const obs2 = makeObservation({
				id: "2",
				author: "alice@example.com", // Same author
				summary: "Feature A improvements",
				detail: "Enhanced feature A with better performance",
			});

			const searchFn = createMockSearchFn([
				makeResult(obs1, 0.7),
				makeResult(obs2, 0.8),
			]);

			const engine = createResearchEngine(searchFn);
			const result = await engine.research("feature A");

			// Same author multiple times is less confident than different authors
			expect(result.confidence).toBe("medium");
		});
	});
});
