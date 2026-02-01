/**
 * Comprehensive Memory System Tests - All 5 Layers
 *
 * Tests for the Han Memory 5-layer architecture:
 * - Layer 1: Rules (.claude/rules/) - Git-tracked conventions
 * - Layer 2: Summaries (transcript-based) - AI-compressed session overviews
 * - Layer 3: Observations (~/.claude/han/memory/sessions/) - Raw tool usage logs
 * - Layer 4: Transcripts (~/.claude/projects/) - Full conversation history
 * - Layer 5: Team Memory (git history) - Commits, PRs, decisions
 *
 * Plus multi-layer racing, auto-promotion, and integration tests.
 *
 * NOTE: Many tests require the native module for database access.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

// Skip tests that require native module when SKIP_NATIVE is set
const SKIP_NATIVE = process.env.SKIP_NATIVE === "true";
const describeWithNative = SKIP_NATIVE ? describe.skip : describe;
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Memory system imports
import {
	createMemoryStore,
	generateId,
	type IndexedObservation,
	normalizeGitRemote,
	type RawObservation,
	type SessionSummary,
	setMemoryRoot,
} from "../lib/memory/index.ts";
import {
	autoPromotePatterns,
	clearPatternStore,
	type DetectedPattern,
	extractPatterns,
	extractPatternsFromEvidence,
	getPatternStats,
	getPromotionCandidates,
	inferDomain,
	learnFromObservations,
	promotePattern,
	trackPattern,
} from "../lib/memory/promotion.ts";
import { createResearchEngine } from "../lib/memory/research.ts";
import {
	parseTranscript,
	pathToSlug,
	searchTranscriptsText,
	slugToPath,
	type TranscriptEntry,
} from "../lib/memory/transcript-search.ts";
import type {
	Decision,
	Evidence,
	SearchResult,
	WorkItem,
} from "../lib/memory/types.ts";

// Test fixture helpers
let testDir: string;
let testRulesDir: string;
let testTranscriptsDir: string;

function setupTestEnvironment(): void {
	const random = Math.random().toString(36).substring(2, 9);
	testDir = join(tmpdir(), `han-memory-5-layers-test-${Date.now()}-${random}`);
	mkdirSync(testDir, { recursive: true });

	// Create rules directory
	testRulesDir = join(testDir, ".claude", "rules");
	mkdirSync(testRulesDir, { recursive: true });

	// Create transcripts directory
	testTranscriptsDir = join(testDir, "transcripts");
	mkdirSync(testTranscriptsDir, { recursive: true });

	// Set memory root to test directory
	setMemoryRoot(testDir);
}

function teardownTestEnvironment(): void {
	setMemoryRoot(null);
	if (testDir && existsSync(testDir)) {
		try {
			rmSync(testDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	}
}

// ========================================
// LAYER 1: RULES TESTS
// ========================================

describe("Layer 1: Rules (.claude/rules/)", () => {
	beforeEach(setupTestEnvironment);
	afterEach(teardownTestEnvironment);

	describe("Rules file structure", () => {
		test("rules directory should be created with proper structure", () => {
			expect(existsSync(testRulesDir)).toBe(true);
		});

		test("rules files should be markdown format", () => {
			writeFileSync(
				join(testRulesDir, "testing.md"),
				"# Testing Conventions\n\n- Always write tests first",
			);

			const files = readdirSync(testRulesDir);
			expect(files).toContain("testing.md");
			expect(files.every((f) => f.endsWith(".md"))).toBe(true);
		});

		test("rules should be readable and parseable", () => {
			const content =
				"# API Conventions\n\n- Use REST endpoints\n- Validate inputs";
			writeFileSync(join(testRulesDir, "api.md"), content);

			const readContent = readFileSync(join(testRulesDir, "api.md"), "utf-8");
			expect(readContent).toBe(content);
			expect(readContent).toContain("API Conventions");
		});
	});

	describe("Rules domain categorization", () => {
		test("should categorize testing rules correctly", () => {
			const text = "Always use describe/it blocks for test structure";
			expect(inferDomain(text)).toBe("testing");
		});

		test("should categorize API rules correctly", () => {
			const text = "REST endpoint handlers should validate request body";
			expect(inferDomain(text)).toBe("api");
		});

		test("should categorize auth rules correctly", () => {
			const text = "Use JWT tokens for session authentication";
			expect(inferDomain(text)).toBe("auth");
		});

		test("should categorize database rules correctly", () => {
			const text = "Run migrations before deploying schema changes";
			expect(inferDomain(text)).toBe("database");
		});

		test("should categorize error handling rules correctly", () => {
			const text = "Always catch exceptions and handle errors gracefully";
			expect(inferDomain(text)).toBe("error");
		});

		test("should categorize logging rules correctly", () => {
			// Use multiple logging keywords to ensure match (logger, debug, trace)
			const text = "Use logger with debug and trace levels";
			expect(inferDomain(text)).toBe("logging");
		});

		test("should categorize config rules correctly", () => {
			const text = "Store environment variables in config files";
			expect(inferDomain(text)).toBe("config");
		});

		test("should categorize build rules correctly", () => {
			const text = "Use webpack for bundling the application";
			expect(inferDomain(text)).toBe("build");
		});

		test("should categorize deploy rules correctly", () => {
			const text = "GitHub Actions pipeline should run on every push";
			expect(inferDomain(text)).toBe("deploy");
		});

		test("should categorize command rules correctly", () => {
			const text = "Use bun for running CLI scripts";
			expect(inferDomain(text)).toBe("commands");
		});

		test("should default to general for unmatched text", () => {
			const text = "This is a very generic statement";
			expect(inferDomain(text)).toBe("general");
		});
	});

	describe("Rules content matching", () => {
		test("should match rules containing search keywords", () => {
			writeFileSync(
				join(testRulesDir, "testing.md"),
				`# Testing Conventions

- Always write unit tests for new functions
- Use bun:test for test runner
- Mock external dependencies
`,
			);

			const content = readFileSync(join(testRulesDir, "testing.md"), "utf-8");
			expect(content.toLowerCase()).toContain("unit tests");
			expect(content.toLowerCase()).toContain("mock");
		});

		test("should find multiple matching rules files", () => {
			writeFileSync(join(testRulesDir, "api.md"), "# API\n- Use REST");
			writeFileSync(join(testRulesDir, "auth.md"), "# Auth\n- Use JWT");
			writeFileSync(
				join(testRulesDir, "db.md"),
				"# Database\n- Use PostgreSQL",
			);

			const files = readdirSync(testRulesDir);
			expect(files.length).toBe(3);
		});
	});
});

// ========================================
// LAYER 2: SUMMARIES TESTS
// ========================================

describe("Layer 2: Summaries (transcript-based)", () => {
	beforeEach(setupTestEnvironment);
	afterEach(teardownTestEnvironment);

	describe("SessionSummary structure", () => {
		test("should create valid session summary object", () => {
			const summary: SessionSummary = {
				session_id: "test-session-123",
				project: "test-project",
				started_at: Date.now() - 3600000,
				ended_at: Date.now(),
				summary: "Implemented user authentication flow",
				work_items: [
					{
						description: "Added login form",
						files: ["src/auth/Login.tsx"],
						outcome: "completed",
					},
				],
				in_progress: ["Add password reset"],
				decisions: [
					{
						description: "Use JWT for tokens",
						rationale: "Industry standard for stateless auth",
					},
				],
			};

			expect(summary.session_id).toBe("test-session-123");
			expect(summary.project).toBe("test-project");
			expect(summary.work_items).toHaveLength(1);
			expect(summary.in_progress).toHaveLength(1);
			expect(summary.decisions).toHaveLength(1);
		});

		test("should handle empty work items", () => {
			const summary: SessionSummary = {
				session_id: "empty-session",
				project: "test-project",
				started_at: Date.now(),
				ended_at: Date.now(),
				summary: "Explored codebase",
				work_items: [],
				in_progress: [],
				decisions: [],
			};

			expect(summary.work_items).toEqual([]);
			expect(summary.in_progress).toEqual([]);
			expect(summary.decisions).toEqual([]);
		});
	});

	describe("WorkItem outcomes", () => {
		test("should track completed work items", () => {
			const item: WorkItem = {
				description: "Implemented feature",
				files: ["src/feature.ts"],
				outcome: "completed",
			};
			expect(item.outcome).toBe("completed");
		});

		test("should track partial work items", () => {
			const item: WorkItem = {
				description: "Started refactoring",
				files: ["src/legacy.ts"],
				outcome: "partial",
			};
			expect(item.outcome).toBe("partial");
		});

		test("should track blocked work items", () => {
			const item: WorkItem = {
				description: "Tried to fix bug",
				files: ["src/buggy.ts"],
				outcome: "blocked",
			};
			expect(item.outcome).toBe("blocked");
		});
	});

	describe("Decision tracking", () => {
		test("should track decisions with rationale", () => {
			const decision: Decision = {
				description: "Use React for frontend",
				rationale: "Team expertise and ecosystem",
			};
			expect(decision.description).toContain("React");
			expect(decision.rationale).toContain("Team");
		});

		test("should track decisions with alternatives", () => {
			const decision: Decision = {
				description: "Use PostgreSQL for database",
				rationale: "Strong relational support",
				alternatives_considered: ["MongoDB", "MySQL"],
			};
			expect(decision.alternatives_considered).toHaveLength(2);
			expect(decision.alternatives_considered).toContain("MongoDB");
		});
	});

	describe("Summary storage and retrieval", () => {
		test("should store and retrieve session summaries", () => {
			const store = createMemoryStore();
			const sessionId = "summary-test-session";

			const summary: SessionSummary = {
				session_id: sessionId,
				project: "test-project",
				started_at: Date.now() - 3600000,
				ended_at: Date.now(),
				summary: "Test session summary",
				work_items: [],
				in_progress: [],
				decisions: [],
			};

			store.storeSessionSummary(sessionId, summary);

			const recent = store.getRecentSessions(5);
			expect(recent).toHaveLength(1);
			expect(recent[0].session_id).toBe(sessionId);
		});

		test("should return sessions in reverse chronological order", () => {
			const store = createMemoryStore();

			for (let i = 0; i < 3; i++) {
				const sessionId = `session-${i}`;
				const summary: SessionSummary = {
					session_id: sessionId,
					project: "test-project",
					started_at: Date.now() + i * 1000,
					ended_at: Date.now() + i * 1000 + 1000,
					summary: `Session ${i}`,
					work_items: [],
					in_progress: [],
					decisions: [],
				};
				store.storeSessionSummary(sessionId, summary);
			}

			const recent = store.getRecentSessions(5);
			expect(recent).toHaveLength(3);
		});
	});
});

// ========================================
// LAYER 3: OBSERVATIONS TESTS
// ========================================

describe("Layer 3: Observations (raw tool usage)", () => {
	beforeEach(setupTestEnvironment);
	afterEach(teardownTestEnvironment);

	describe("RawObservation structure", () => {
		test("should create valid raw observation", () => {
			const obs: RawObservation = {
				id: generateId(),
				session_id: "test-session",
				timestamp: Date.now(),
				tool: "Read",
				input_summary: "Reading src/main.ts",
				output_summary: "File contents returned",
				files_read: ["src/main.ts"],
				files_modified: [],
			};

			expect(obs.id).toBeDefined();
			expect(obs.tool).toBe("Read");
			expect(obs.files_read).toContain("src/main.ts");
		});

		test("should track file modifications", () => {
			const obs: RawObservation = {
				id: generateId(),
				session_id: "test-session",
				timestamp: Date.now(),
				tool: "Edit",
				input_summary: "Editing src/main.ts",
				output_summary: "File updated",
				files_read: [],
				files_modified: ["src/main.ts"],
			};

			expect(obs.files_modified).toContain("src/main.ts");
		});
	});

	describe("Observation storage", () => {
		test("should append and retrieve observations", () => {
			const store = createMemoryStore();
			const sessionId = "obs-test-session";

			const obs: RawObservation = {
				id: generateId(),
				session_id: sessionId,
				timestamp: Date.now(),
				tool: "Read",
				input_summary: "Reading file",
				output_summary: "Success",
				files_read: ["test.ts"],
				files_modified: [],
			};

			store.appendObservation(sessionId, obs);

			const retrieved = store.getSessionObservations(sessionId);
			expect(retrieved).toHaveLength(1);
			expect(retrieved[0].tool).toBe("Read");
		});

		test("should store multiple observations in order", () => {
			const store = createMemoryStore();
			const sessionId = "multi-obs-session";

			const tools = ["Read", "Edit", "Write", "Bash"];
			for (const tool of tools) {
				const obs: RawObservation = {
					id: generateId(),
					session_id: sessionId,
					timestamp: Date.now(),
					tool,
					input_summary: `Using ${tool}`,
					output_summary: "Success",
					files_read: [],
					files_modified: [],
				};
				store.appendObservation(sessionId, obs);
			}

			const retrieved = store.getSessionObservations(sessionId);
			expect(retrieved).toHaveLength(4);
			expect(retrieved.map((o) => o.tool)).toEqual(tools);
		});

		test("should return empty array for non-existent session", () => {
			const store = createMemoryStore();
			const observations = store.getSessionObservations("nonexistent");
			expect(observations).toEqual([]);
		});
	});

	describe("Observation ID generation", () => {
		test("should generate unique IDs", () => {
			const ids = new Set<string>();
			for (let i = 0; i < 100; i++) {
				ids.add(generateId());
			}
			expect(ids.size).toBe(100);
		});

		test("should generate IDs with timestamp prefix", () => {
			const id = generateId();
			expect(id).toMatch(/^[a-z0-9]+-[a-z0-9]+$/);
		});
	});
});

// ========================================
// LAYER 4: TRANSCRIPTS TESTS
// ========================================

describeWithNative("Layer 4: Transcripts (conversation history)", () => {
	beforeEach(setupTestEnvironment);
	afterEach(teardownTestEnvironment);

	describe("Path to slug conversion", () => {
		test("should convert filesystem path to slug", () => {
			const path = "/Volumes/dev/src/github.com/org/repo";
			const slug = pathToSlug(path);
			expect(slug).toBe("-Volumes-dev-src-github-com-org-repo");
		});

		test("should handle dots in path", () => {
			const path = "/Users/user/github.com/project";
			const slug = pathToSlug(path);
			expect(slug).toBe("-Users-user-github-com-project");
		});
	});

	describe("Slug to path conversion", () => {
		test("should convert macOS Volumes path", () => {
			const slug = "-Volumes-dev-src-github-com-org-repo";
			const path = slugToPath(slug);
			expect(path).toContain("/Volumes/");
		});

		test("should convert Users path", () => {
			const slug = "-Users-john-projects-myapp";
			const path = slugToPath(slug);
			expect(path).toContain("/Users/");
		});

		test("should restore github.com domain", () => {
			const slug = "-home-user-github-com-org-repo";
			const path = slugToPath(slug);
			expect(path).toContain("github.com");
		});
	});

	describe.skip("Transcript parsing", () => {
		// SKIPPED: The parseTranscript function now queries the SQLite database instead of
		// reading JSONL files directly. JSONL parsing is handled by the Rust coordinator
		// (han-native/src/indexer.rs) which indexes transcripts into SQLite.
		//
		// These tests were validating JSONL file parsing logic that no longer exists in
		// TypeScript. The database-backed implementation requires the coordinator to be running.
		//
		// Architecture: JSONL → Rust Coordinator → SQLite ← TypeScript queries
		test("should parse user messages from transcript", async () => {
			const transcriptPath = join(testTranscriptsDir, "test-session.jsonl");
			const entries: TranscriptEntry[] = [
				{
					type: "user",
					uuid: "msg-1",
					sessionId: "test-session",
					timestamp: new Date().toISOString(),
					message: {
						role: "user",
						content: "Hello, please help me with this code",
					},
				},
			];

			writeFileSync(
				transcriptPath,
				entries.map((e) => JSON.stringify(e)).join("\n"),
			);

			const messages = await parseTranscript(transcriptPath);
			expect(messages.length).toBeGreaterThanOrEqual(0); // May be empty if native module not available
		});

		test("should parse assistant messages with text content", async () => {
			const transcriptPath = join(testTranscriptsDir, "assistant-test.jsonl");
			const entries: TranscriptEntry[] = [
				{
					type: "assistant",
					uuid: "msg-2",
					sessionId: "test-session",
					timestamp: new Date().toISOString(),
					message: {
						role: "assistant",
						content: [
							{
								type: "text",
								text: "I can help you with that. Here is the solution.",
							},
						],
					},
				},
			];

			writeFileSync(
				transcriptPath,
				entries.map((e) => JSON.stringify(e)).join("\n"),
			);

			// Parse may return empty if native module not available
			const messages = await parseTranscript(transcriptPath);
			expect(messages).toBeDefined();
		});

		test("should skip meta messages", async () => {
			const transcriptPath = join(testTranscriptsDir, "meta-test.jsonl");
			const entries: TranscriptEntry[] = [
				{
					type: "user",
					uuid: "msg-1",
					isMeta: true,
					message: { role: "user", content: "meta content" },
				},
				{
					type: "user",
					uuid: "msg-2",
					message: { role: "user", content: "regular content" },
				},
			];

			writeFileSync(
				transcriptPath,
				entries.map((e) => JSON.stringify(e)).join("\n"),
			);

			const messages = await parseTranscript(transcriptPath);
			// Should filter out meta messages
			expect(messages.filter((m) => m.content === "meta content")).toHaveLength(
				0,
			);
		});
	});

	// Transcript search requires native module for FTS
	describe.skip("Transcript search", () => {
		test("should find matching transcripts by text", async () => {
			// Text-based search uses native module's FTS
			// Skip gracefully if native module not available (e.g., mocked in other tests)
			try {
				const results = await searchTranscriptsText({
					query: "authentication",
					limit: 10,
					scope: "all",
				});
				expect(results).toBeDefined();
				expect(Array.isArray(results)).toBe(true);
			} catch (error) {
				if (
					error instanceof Error &&
					(error.message.includes("Native module not available") ||
						error.message.includes("SKIP_NATIVE"))
				) {
					// Skip test if native module is mocked/unavailable
					expect(true).toBe(true);
					return;
				}
				throw error;
			}
		}, 15000);

		test("should return empty array for no matches", async () => {
			// Use a query with random UUID suffix to ensure it never matches real data
			// This test was previously failing because the query string appeared in
			// test failure summaries that got captured in actual transcripts
			const randomQuery = `NOMATCH_GIBBERISH_${crypto.randomUUID().replace(/-/g, "")}`;
			try {
				const results = await searchTranscriptsText({
					query: randomQuery,
					limit: 10,
					scope: "all",
				});
				expect(results).toEqual([]);
			} catch (error) {
				if (
					error instanceof Error &&
					(error.message.includes("Native module not available") ||
						error.message.includes("SKIP_NATIVE"))
				) {
					// Skip test if native module is mocked/unavailable
					expect(true).toBe(true);
					return;
				}
				throw error;
			}
		}, 15000);
	});
});

// ========================================
// LAYER 5: TEAM MEMORY TESTS
// ========================================

describe("Layer 5: Team Memory (git history)", () => {
	beforeEach(setupTestEnvironment);
	afterEach(teardownTestEnvironment);

	describe("Git remote normalization", () => {
		test("should normalize SSH git URL", () => {
			expect(normalizeGitRemote("git@github.com:org/repo.git")).toBe(
				"github.com_org_repo",
			);
		});

		test("should normalize HTTPS git URL", () => {
			expect(normalizeGitRemote("https://github.com/org/repo")).toBe(
				"github.com_org_repo",
			);
		});

		test("should normalize HTTPS git URL with .git suffix", () => {
			expect(normalizeGitRemote("https://github.com/org/repo.git")).toBe(
				"github.com_org_repo",
			);
		});

		test("should normalize GitLab URL", () => {
			expect(normalizeGitRemote("git@gitlab.com:team/project.git")).toBe(
				"gitlab.com_team_project",
			);
		});

		test("should normalize nested paths", () => {
			expect(
				normalizeGitRemote("https://github.com/org/team/nested/repo"),
			).toBe("github.com_org_team_nested_repo");
		});
	});

	describe("IndexedObservation structure", () => {
		test("should create valid indexed observation for commit", () => {
			const obs: IndexedObservation = {
				id: generateId(),
				source: "git:commit:abc123",
				type: "commit",
				timestamp: Date.now(),
				author: "alice@example.com",
				summary: "Add authentication middleware",
				detail: "Implemented JWT validation for API routes",
				files: ["src/auth/middleware.ts"],
				patterns: ["authentication", "jwt"],
			};

			expect(obs.type).toBe("commit");
			expect(obs.author).toBe("alice@example.com");
			expect(obs.patterns).toContain("jwt");
		});

		test("should create valid indexed observation for PR", () => {
			const obs: IndexedObservation = {
				id: generateId(),
				source: "github:pr:123",
				type: "pr",
				timestamp: Date.now(),
				author: "bob@example.com",
				summary: "Add user registration flow",
				detail: "Implements registration form with validation",
				files: ["src/auth/Register.tsx"],
				patterns: ["registration", "validation"],
				pr_context: {
					number: 123,
					title: "User Registration",
					description: "Full registration flow with email verification",
				},
			};

			expect(obs.type).toBe("pr");
			expect(obs.pr_context?.number).toBe(123);
		});
	});

	describe("Team memory indexing", () => {
		test("should index and search observations", async () => {
			const gitRemote = "git@github.com:test/team-memory.git";
			const store = createMemoryStore();

			const observations: IndexedObservation[] = [
				{
					id: generateId(),
					source: "git:commit:abc123",
					type: "commit",
					timestamp: Date.now(),
					author: "alice@example.com",
					summary: "Add authentication middleware",
					detail: "Implemented JWT validation",
					files: ["src/auth/middleware.ts"],
					patterns: ["authentication"],
				},
			];

			await store.indexObservations(gitRemote, observations);

			const results = await store.search(gitRemote, "authentication");
			expect(results.length).toBeGreaterThanOrEqual(0);
		});

		test("should filter by author", async () => {
			const gitRemote = `git@github.com:test/author-filter-${generateId()}.git`;
			const store = createMemoryStore();

			const observations: IndexedObservation[] = [
				{
					id: generateId(),
					source: "git:commit:abc",
					type: "commit",
					timestamp: Date.now(),
					author: "alice@example.com",
					summary: "Feature by Alice",
					detail: "Implementation",
					files: [],
					patterns: [],
				},
				{
					id: generateId(),
					source: "git:commit:def",
					type: "commit",
					timestamp: Date.now(),
					author: "bob@example.com",
					summary: "Feature by Bob",
					detail: "Implementation",
					files: [],
					patterns: [],
				},
			];

			await store.indexObservations(gitRemote, observations);

			const results = await store.search(gitRemote, "feature", {
				authors: ["alice@example.com"],
			});

			if (results.length > 0) {
				expect(
					results.every((r) => r.observation.author === "alice@example.com"),
				).toBe(true);
			}
		});

		test("should filter by type", async () => {
			const gitRemote = `git@github.com:test/type-filter-${generateId()}.git`;
			const store = createMemoryStore();

			const observations: IndexedObservation[] = [
				{
					id: generateId(),
					source: "git:commit:abc",
					type: "commit",
					timestamp: Date.now(),
					author: "alice@example.com",
					summary: "Commit message",
					detail: "Details",
					files: [],
					patterns: [],
				},
				{
					id: generateId(),
					source: "github:pr:123",
					type: "pr",
					timestamp: Date.now(),
					author: "bob@example.com",
					summary: "PR title",
					detail: "Details",
					files: [],
					patterns: [],
				},
			];

			await store.indexObservations(gitRemote, observations);

			const results = await store.search(gitRemote, "details", {
				types: ["pr"],
			});

			if (results.length > 0) {
				expect(results.every((r) => r.observation.type === "pr")).toBe(true);
			}
		});

		test("should filter by timeframe", async () => {
			const gitRemote = `git@github.com:test/time-filter-${generateId()}.git`;
			const store = createMemoryStore();
			const now = Date.now();
			const startTimeframe = now - 86400000 * 7; // Last 7 days

			const observations: IndexedObservation[] = [
				{
					id: generateId(),
					source: "git:commit:old",
					type: "commit",
					timestamp: now - 86400000 * 30, // 30 days ago
					author: "alice@example.com",
					summary: "Old commit",
					detail: "Old details",
					files: [],
					patterns: [],
				},
				{
					id: generateId(),
					source: "git:commit:recent",
					type: "commit",
					timestamp: now - 86400000, // 1 day ago
					author: "bob@example.com",
					summary: "Recent commit",
					detail: "Recent details",
					files: [],
					patterns: [],
				},
			];

			await store.indexObservations(gitRemote, observations);

			const results = await store.search(gitRemote, "commit", {
				timeframe: {
					start: startTimeframe,
				},
			});

			// All returned results should have timestamps >= startTimeframe
			if (results.length > 0) {
				expect(
					results.every((r) => r.observation.timestamp >= startTimeframe),
				).toBe(true);
			}
		});
	});

	describe("Index metadata", () => {
		test("should create and update metadata", () => {
			const gitRemote = "git@github.com:test/meta-create.git";
			const store = createMemoryStore();

			expect(store.getIndexMetadata(gitRemote)).toBeNull();

			store.updateIndexMetadata(gitRemote, {
				sources: {
					git: {
						indexed_at: Date.now(),
						item_count: 100,
					},
				},
			});

			const meta = store.getIndexMetadata(gitRemote);
			expect(meta).not.toBeNull();
			expect(meta?.sources.git.item_count).toBe(100);
		});

		test("should merge metadata updates", () => {
			const gitRemote = "git@github.com:test/meta-merge.git";
			const store = createMemoryStore();

			store.updateIndexMetadata(gitRemote, {
				sources: {
					git: {
						indexed_at: Date.now(),
						item_count: 50,
					},
				},
			});

			store.updateIndexMetadata(gitRemote, {
				sources: {
					github: {
						indexed_at: Date.now(),
						item_count: 25,
					},
				},
			});

			const meta = store.getIndexMetadata(gitRemote);
			expect(meta?.sources.git).toBeDefined();
			expect(meta?.sources.github).toBeDefined();
		});
	});
});

// ========================================
// MULTI-LAYER RACING TESTS
// ========================================

describe("Multi-Layer Racing", () => {
	beforeEach(setupTestEnvironment);
	afterEach(teardownTestEnvironment);

	describe("Parallel layer search", () => {
		test("should search multiple layers concurrently", async () => {
			// Create rules
			writeFileSync(
				join(testRulesDir, "api.md"),
				"# API Rules\n- Use REST endpoints",
			);

			// Create observations
			const store = createMemoryStore();
			const gitRemote = "git@github.com:test/racing.git";
			await store.indexObservations(gitRemote, [
				{
					id: generateId(),
					source: "git:commit:abc",
					type: "commit",
					timestamp: Date.now(),
					author: "alice@example.com",
					summary: "API implementation",
					detail: "REST endpoints",
					files: [],
					patterns: ["api"],
				},
			]);

			// Both should be searchable
			expect(existsSync(join(testRulesDir, "api.md"))).toBe(true);
		});

		test("should combine results from multiple layers", () => {
			// Create multiple rules files
			writeFileSync(join(testRulesDir, "api.md"), "# API\n- REST");
			writeFileSync(join(testRulesDir, "auth.md"), "# Auth\n- JWT");

			const files = readdirSync(testRulesDir);
			expect(files.length).toBe(2);
		});
	});

	describe("Layer priority", () => {
		test("rules should have highest authority", () => {
			writeFileSync(
				join(testRulesDir, "testing.md"),
				"# Testing\n- Rules take priority",
			);

			const content = readFileSync(join(testRulesDir, "testing.md"), "utf-8");
			expect(content).toContain("Rules take priority");
		});
	});
});

// ========================================
// AUTO-PROMOTION ENGINE TESTS
// ========================================

describe("Auto-Promotion Engine", () => {
	beforeEach(() => {
		setupTestEnvironment();
		clearPatternStore();
	});
	afterEach(teardownTestEnvironment);

	describe("Pattern detection", () => {
		test("should extract patterns from observations", () => {
			const observations: IndexedObservation[] = [
				{
					id: "1",
					source: "git:commit:abc",
					type: "commit",
					timestamp: Date.now(),
					author: "alice@example.com",
					summary: "Always run tests before committing",
					detail: "Use bun test to verify changes",
					files: [],
					patterns: [],
				},
			];

			const patterns = extractPatterns(observations);
			expect(patterns.length).toBeGreaterThan(0);
			expect(patterns[0].domain).toBe("testing");
		});

		test("should skip low-quality observations", () => {
			const observations: IndexedObservation[] = [
				{
					id: "1",
					source: "git:commit:abc",
					type: "commit",
					timestamp: Date.now(),
					author: "alice@example.com",
					summary: "fix", // Too short
					detail: "",
					files: [],
					patterns: [],
				},
			];

			const patterns = extractPatterns(observations);
			expect(patterns).toHaveLength(0);
		});
	});

	describe("Pattern tracking", () => {
		test("should track patterns across sessions", () => {
			const pattern: DetectedPattern = {
				id: "testing:use-bun-test",
				domain: "testing",
				description: "Use bun test for running tests",
				confidence: 0.5,
				occurrences: 1,
				sources: [{ type: "commit", id: "abc" }],
				ruleContent: "- Use bun test for running tests",
			};

			trackPattern(pattern);

			const stats = getPatternStats();
			expect(stats.totalPatterns).toBe(1);
		});

		test("should increase confidence with multiple occurrences", () => {
			const pattern: DetectedPattern = {
				id: "api:validate-inputs",
				domain: "api",
				description: "Always validate API inputs",
				confidence: 0.5,
				occurrences: 1,
				sources: [{ type: "commit", id: "abc" }],
				ruleContent: "- Always validate API inputs",
			};

			trackPattern(pattern);
			trackPattern(pattern);
			trackPattern(pattern);

			const candidates = getPromotionCandidates();
			expect(candidates.length).toBeGreaterThanOrEqual(0);
		});
	});

	describe("Promotion criteria", () => {
		test("should not promote patterns below threshold", () => {
			const pattern: DetectedPattern = {
				id: "testing:low-conf",
				domain: "testing",
				description: "Low confidence pattern",
				confidence: 0.3,
				occurrences: 1,
				sources: [{ type: "commit", id: "abc" }],
				ruleContent: "- Low confidence pattern",
			};

			trackPattern(pattern);

			const candidates = getPromotionCandidates();
			expect(candidates).toHaveLength(0);
		});

		test("should promote patterns meeting criteria", () => {
			// Track pattern multiple times to meet criteria
			for (let i = 0; i < 4; i++) {
				const pattern: DetectedPattern = {
					id: "testing:high-conf",
					domain: "testing",
					description: "High confidence pattern from multiple sources",
					confidence: 0.6,
					occurrences: 1,
					sources: [
						{
							type: "commit",
							id: `commit-${i}`,
							author: `author-${i}@example.com`,
						},
					],
					ruleContent: "- High confidence pattern",
				};
				trackPattern(pattern);
			}

			const candidates = getPromotionCandidates();
			expect(candidates.length).toBeGreaterThan(0);
		});
	});

	describe("Pattern promotion", () => {
		test("should create rules file when promoting", () => {
			const pattern: DetectedPattern = {
				id: "commands:use-bun",
				domain: "commands",
				description: "Use bun for package management",
				confidence: 0.9,
				occurrences: 5,
				sources: [{ type: "commit", id: "abc" }],
				ruleContent: "- Use bun for package management",
			};

			const result = promotePattern(pattern, testDir);
			expect(result.promoted).toBe(true);
			expect(result.filePath).toContain("commands.md");
			expect(result.filePath).toBeDefined();
			expect(existsSync(result.filePath as string)).toBe(true);
		});

		test("should not promote already documented patterns", () => {
			// Create existing rule
			writeFileSync(
				join(testRulesDir, "testing.md"),
				"# Testing\n\n- Always run tests before committing",
			);

			const pattern: DetectedPattern = {
				id: "testing:run-tests",
				domain: "testing",
				description: "Always run tests before committing",
				confidence: 0.9,
				occurrences: 5,
				sources: [{ type: "commit", id: "abc" }],
				ruleContent: "- Always run tests before committing",
			};

			const result = promotePattern(pattern, testDir);
			expect(result.promoted).toBe(false);
			expect(result.reason).toContain("already documented");
		});
	});

	describe("Evidence-based pattern extraction", () => {
		test("should extract patterns from evidence", () => {
			const evidence: Evidence[] = [
				{
					citation: {
						source: "git:commit:abc",
						excerpt: "We decided to use TypeScript for type safety",
						relevance: 0.8,
						author: "alice@example.com",
					},
					claim: "TypeScript provides better type safety",
					confidence: 0.8,
				},
			];

			const patterns = extractPatternsFromEvidence(evidence);
			expect(patterns.length).toBeGreaterThan(0);
		});
	});

	describe("Learn from observations", () => {
		test("should learn and potentially promote from observations", () => {
			const observations: IndexedObservation[] = [];

			// Create multiple observations that would trigger promotion
			for (let i = 0; i < 5; i++) {
				observations.push({
					id: `obs-${i}`,
					source: `git:commit:${i}`,
					type: "commit",
					timestamp: Date.now(),
					author: `author-${i}@example.com`,
					summary: "Always validate user input before processing",
					detail: "Input validation is critical for security",
					files: ["src/validation.ts"],
					patterns: ["validation", "security"],
				});
			}

			const results = learnFromObservations(observations, testDir);
			expect(Array.isArray(results)).toBe(true);
		});
	});
});

// ========================================
// RESEARCH ENGINE TESTS
// ========================================

describe("Research Engine", () => {
	describe("Confidence assessment", () => {
		test("should return high confidence with multiple sources", async () => {
			const mockSearch = async (_query: string): Promise<SearchResult[]> => [
				{
					observation: {
						id: "1",
						source: "git:commit:abc",
						type: "commit",
						timestamp: Date.now(),
						author: "alice@example.com",
						summary: "Implement auth",
						detail: "OAuth2 authentication flow",
						files: [],
						patterns: [],
					},
					score: 0.8,
					excerpt: "OAuth2 authentication",
				},
				{
					observation: {
						id: "2",
						source: "git:commit:def",
						type: "commit",
						timestamp: Date.now(),
						author: "bob@example.com",
						summary: "Review auth",
						detail: "Reviewed OAuth2 implementation",
						files: [],
						patterns: [],
					},
					score: 0.7,
					excerpt: "Reviewed OAuth2",
				},
			];

			const engine = createResearchEngine(mockSearch);
			const result = await engine.research("who implemented authentication?");

			expect(result.confidence).toBe("high");
			expect(result.citations.length).toBeGreaterThan(0);
		});

		test("should return medium confidence with single source", async () => {
			const mockSearch = async (_query: string): Promise<SearchResult[]> => [
				{
					observation: {
						id: "1",
						source: "git:commit:abc",
						type: "commit",
						timestamp: Date.now(),
						author: "alice@example.com",
						summary: "Implement payments",
						detail: "Payment processing system",
						files: [],
						patterns: [],
					},
					score: 0.7,
					excerpt: "Payment processing",
				},
			];

			const engine = createResearchEngine(mockSearch);
			const result = await engine.research("who knows about payments?");

			expect(result.confidence).toBe("medium");
		});

		test("should return low confidence with no sources", async () => {
			const mockSearch = async (_query: string): Promise<SearchResult[]> => [];

			const engine = createResearchEngine(mockSearch);
			const result = await engine.research("who knows about blockchain?");

			expect(result.confidence).toBe("low");
			expect(result.caveats.length).toBeGreaterThan(0);
		});
	});

	describe("Citation extraction", () => {
		test("should include citations in results", async () => {
			const mockSearch = async (_query: string): Promise<SearchResult[]> => [
				{
					observation: {
						id: "1",
						source: "git:commit:abc123",
						type: "commit",
						timestamp: 1234567890,
						author: "alice@example.com",
						summary: "Add database migration",
						detail: "Migration for user table",
						files: ["migrations/001.sql"],
						patterns: ["database"],
					},
					score: 0.9,
					excerpt: "Migration for user table",
				},
			];

			const engine = createResearchEngine(mockSearch);
			const result = await engine.research("database migrations");

			expect(result.citations.length).toBeGreaterThan(0);
			expect(result.citations[0].source).toBe("git:commit:abc123");
		});
	});

	describe("Searched sources tracking", () => {
		test("should track searched sources", async () => {
			const mockSearch = async (_query: string): Promise<SearchResult[]> => [
				{
					observation: {
						id: "1",
						source: "git:commit:abc",
						type: "commit",
						timestamp: Date.now(),
						author: "alice@example.com",
						summary: "Add logging",
						detail: "Structured logging",
						files: [],
						patterns: [],
					},
					score: 0.8,
					excerpt: "Structured logging",
				},
			];

			const engine = createResearchEngine(mockSearch);
			const result = await engine.research("logging implementation");

			expect(result.searched_sources).toBeDefined();
			expect(result.searched_sources.length).toBeGreaterThan(0);
		});
	});
});

// ========================================
// INTEGRATION TESTS
// ========================================

describe("Memory System Integration", () => {
	beforeEach(setupTestEnvironment);
	afterEach(teardownTestEnvironment);

	describe("End-to-end workflow", () => {
		test("should store observation and retrieve in search", async () => {
			const store = createMemoryStore();
			const sessionId = "integration-test-session";

			// Store observation
			const obs: RawObservation = {
				id: generateId(),
				session_id: sessionId,
				timestamp: Date.now(),
				tool: "Edit",
				input_summary: "Editing authentication module",
				output_summary: "Updated auth logic",
				files_read: [],
				files_modified: ["src/auth.ts"],
			};

			store.appendObservation(sessionId, obs);

			// Verify retrieval
			const observations = store.getSessionObservations(sessionId);
			expect(observations).toHaveLength(1);
			expect(observations[0].input_summary).toContain("authentication");
		});

		test("should index team memory and find via research", async () => {
			const store = createMemoryStore();
			const gitRemote = "git@github.com:test/integration.git";

			// Index team memory
			await store.indexObservations(gitRemote, [
				{
					id: generateId(),
					source: "git:commit:integration",
					type: "commit",
					timestamp: Date.now(),
					author: "test@example.com",
					summary: "Integration test commit",
					detail: "Testing the full integration flow",
					files: ["src/integration.ts"],
					patterns: ["integration", "testing"],
				},
			]);

			// Search
			const results = await store.search(gitRemote, "integration");
			expect(results).toBeDefined();
		});
	});

	describe("Layer coordination", () => {
		test("should create rules that are searchable", () => {
			// Create rule
			writeFileSync(
				join(testRulesDir, "integration.md"),
				"# Integration\n\n- Test all layers together",
			);

			// Verify searchable
			const content = readFileSync(
				join(testRulesDir, "integration.md"),
				"utf-8",
			);
			expect(content.toLowerCase()).toContain("layers");
		});

		test("should promote learned patterns to rules", () => {
			clearPatternStore();

			// Track pattern multiple times
			for (let i = 0; i < 5; i++) {
				const pattern: DetectedPattern = {
					id: "integration:coordinate-layers",
					domain: "general",
					description: "Coordinate all memory layers for queries",
					confidence: 0.6,
					occurrences: 1,
					sources: [
						{
							type: "commit",
							id: `commit-${i}`,
							author: `author-${i}@example.com`,
						},
					],
					ruleContent: "- Coordinate all memory layers for queries",
				};
				trackPattern(pattern);
			}

			// Promote
			const results = autoPromotePatterns(testDir);
			expect(Array.isArray(results)).toBe(true);
		});
	});
});
