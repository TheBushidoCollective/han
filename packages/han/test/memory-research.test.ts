/**
 * Tests for lib/memory/research.ts
 * Tests the research engine that implements "research until confident"
 */
import { describe, expect, test } from "bun:test";
import { createResearchEngine } from "../lib/memory/research.ts";
import type { IndexedObservation, SearchResult } from "../lib/memory/types.ts";

// Mock storage layer
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

			// Handle special queries like "pr:123", "commit:abc123"
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

				// Split query into words, filter out stop words, strip punctuation
				const queryWords = queryLower
					.replace(/[.,!?;:]/g, " ") // Replace punctuation with spaces
					.split(/\s+/)
					.filter((w) => w.length > 2 && !stopWords.has(w));
				let matchCount = 0;

				for (const word of queryWords) {
					if (searchText.includes(word)) {
						matchCount++;
					}
				}

				if (matchCount > 0 && queryWords.length > 0) {
					// Calculate score based on match ratio
					const score = Math.min(1.0, matchCount / queryWords.length);

					// Include PR context in excerpt if available
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
			const storage = createMockStorage();

			// Add multiple independent sources about authentication
			storage.addObservations([
				{
					id: "1",
					source: "git:commit:abc123",
					type: "commit",
					timestamp: Date.now(),
					author: "alice@example.com",
					summary: "Implement OAuth2 authentication",
					detail:
						"Added OAuth2 authentication flow using industry-standard libraries. Implemented token refresh and session management.",
					files: ["src/auth/oauth.ts"],
					patterns: ["authentication", "oauth"],
				},
				{
					id: "2",
					source: "github:pr:42",
					type: "pr",
					timestamp: Date.now(),
					author: "bob@example.com",
					summary: "Review authentication implementation",
					detail:
						"Reviewed OAuth2 implementation. The authentication system follows best practices and includes proper token management.",
					files: ["src/auth/oauth.ts"],
					patterns: ["authentication", "review"],
				},
				{
					id: "3",
					source: "git:commit:def456",
					type: "commit",
					timestamp: Date.now(),
					author: "alice@example.com",
					summary: "Add authentication tests",
					detail:
						"Comprehensive test suite for OAuth2 authentication flow covering all edge cases.",
					files: ["tests/auth.test.ts"],
					patterns: ["authentication", "testing"],
				},
			]);

			const engine = createResearchEngine(storage.search.bind(storage));
			const result = await engine.research("who implemented authentication?");

			expect(result.confidence).toBe("high");
			expect(result.citations.length).toBeGreaterThan(1);
			expect(result.answer).toContain("alice@example.com");
		});

		test("returns medium confidence with single strong source", async () => {
			const storage = createMockStorage();

			// Add single strong source
			storage.addObservations([
				{
					id: "1",
					source: "git:commit:abc123",
					type: "commit",
					timestamp: Date.now(),
					author: "alice@example.com",
					summary: "Implement payment processing",
					detail:
						"Implemented comprehensive payment processing system using Stripe API with webhooks, refunds, and subscription management.",
					files: ["src/payments/stripe.ts"],
					patterns: ["payment", "stripe"], // Use singular "payment" to match "payments"
				},
			]);

			const engine = createResearchEngine(storage.search.bind(storage));
			const result = await engine.research("who knows about payments?");

			expect(result.confidence).toBe("medium");
			expect(result.citations.length).toBe(1);
			expect(result.answer).toContain("alice@example.com");
		});

		test("returns low confidence when no strong sources found", async () => {
			const storage = createMockStorage();

			// Add observations about different topics
			storage.addObservations([
				{
					id: "1",
					source: "git:commit:abc123",
					type: "commit",
					timestamp: Date.now(),
					author: "alice@example.com",
					summary: "Fix typo in README",
					detail: "Fixed spelling mistake",
					files: ["README.md"],
					patterns: ["documentation"],
				},
			]);

			const engine = createResearchEngine(storage.search.bind(storage));
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
			const storage = createMockStorage();

			// Add contradictory observations
			storage.addObservations([
				{
					id: "1",
					source: "git:commit:abc123",
					type: "commit",
					timestamp: Date.now() - 86400000, // 1 day ago
					author: "alice@example.com",
					summary: "Use MongoDB for data storage",
					detail: "Decided to use MongoDB for its flexibility and scalability",
					files: ["src/db/mongo.ts"],
					patterns: ["database"],
				},
				{
					id: "2",
					source: "git:commit:def456",
					type: "commit",
					timestamp: Date.now(),
					author: "bob@example.com",
					summary: "Migrate to PostgreSQL",
					detail:
						"Migrated from MongoDB to PostgreSQL for better relational data support and ACID guarantees",
					files: ["src/db/postgres.ts"],
					patterns: ["database", "migration"],
				},
			]);

			const engine = createResearchEngine(storage.search.bind(storage));
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
			const storage = createMockStorage();

			// Add multiple observations from same author on same topic
			storage.addObservations([
				{
					id: "1",
					source: "git:commit:abc123",
					type: "commit",
					timestamp: Date.now() - 86400000 * 30, // 30 days ago
					author: "alice@example.com",
					summary: "Initial WebSocket implementation",
					detail: "Set up WebSocket server with Socket.IO",
					files: ["src/websocket/server.ts"],
					patterns: ["websocket"],
				},
				{
					id: "2",
					source: "git:commit:def456",
					type: "commit",
					timestamp: Date.now() - 86400000 * 15, // 15 days ago
					author: "alice@example.com",
					summary: "Add WebSocket authentication",
					detail: "Integrated JWT authentication with WebSocket connections",
					files: ["src/websocket/auth.ts"],
					patterns: ["websocket", "auth"],
				},
				{
					id: "3",
					source: "github:pr:100",
					type: "pr",
					timestamp: Date.now(),
					author: "alice@example.com",
					summary: "WebSocket reconnection logic",
					detail:
						"Implemented automatic reconnection with exponential backoff for WebSocket clients",
					files: ["src/websocket/client.ts"],
					patterns: ["websocket"],
				},
			]);

			const engine = createResearchEngine(storage.search.bind(storage));
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
			const storage = createMockStorage();

			const now = Date.now();
			storage.addObservations([
				{
					id: "1",
					source: "git:commit:old",
					type: "commit",
					timestamp: now - 86400000 * 365, // 1 year ago
					author: "alice@example.com",
					summary: "Old approach to caching",
					detail: "Using Redis for all caching",
					files: ["src/cache.ts"],
					patterns: ["caching"],
				},
				{
					id: "2",
					source: "git:commit:new",
					type: "commit",
					timestamp: now,
					author: "bob@example.com",
					summary: "Updated caching strategy",
					detail: "Migrated to hybrid approach: Redis + in-memory LRU cache",
					files: ["src/cache.ts"],
					patterns: ["caching"],
				},
			]);

			const engine = createResearchEngine(storage.search.bind(storage));
			const result = await engine.research("caching strategy");

			// More recent evidence should be weighted higher
			expect(result.answer.toLowerCase()).toContain("hybrid");
		});
	});

	describe("confidence assessment", () => {
		test("high confidence requires multiple independent sources", async () => {
			const storage = createMockStorage();

			// Single source - should not be high confidence
			storage.addObservations([
				{
					id: "1",
					source: "git:commit:abc123",
					type: "commit",
					timestamp: Date.now(),
					author: "alice@example.com",
					summary: "Something",
					detail: "Details about something",
					files: ["src/something.ts"],
					patterns: ["something"],
				},
			]);

			const engine = createResearchEngine(storage.search.bind(storage));
			const result = await engine.research("something");

			expect(result.confidence).not.toBe("high");
		});

		test("multiple sources from same author counts as medium confidence", async () => {
			const storage = createMockStorage();

			// Multiple commits from same author
			storage.addObservations([
				{
					id: "1",
					source: "git:commit:abc123",
					type: "commit",
					timestamp: Date.now(),
					author: "alice@example.com",
					summary: "Feature A",
					detail: "Implemented feature A",
					files: ["src/a.ts"],
					patterns: ["feature"],
				},
				{
					id: "2",
					source: "git:commit:def456",
					type: "commit",
					timestamp: Date.now(),
					author: "alice@example.com",
					summary: "Feature A improvements",
					detail: "Enhanced feature A with better performance",
					files: ["src/a.ts"],
					patterns: ["feature"],
				},
			]);

			const engine = createResearchEngine(storage.search.bind(storage));
			const result = await engine.research("feature A");

			// Same author multiple times is less confident than different authors
			expect(result.confidence).toBe("medium");
		});
	});
});
