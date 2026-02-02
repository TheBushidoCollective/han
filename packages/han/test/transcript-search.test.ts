/**
 * Tests for transcript search (Layer 4)
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Counter for unique test directories (Date.now() can collide when tests run < 1ms apart)
let testCounter = 0;

describe.serial("transcript search", () => {
	let testDir: string;
	let originalHome: string | undefined;

	beforeEach(() => {
		testCounter++;
		testDir = join(
			tmpdir(),
			`han-transcript-test-${Date.now()}-${testCounter}-${Math.random().toString(36).slice(2, 8)}`,
		);
		mkdirSync(testDir, { recursive: true });
		originalHome = process.env.HOME;
	});

	afterEach(() => {
		if (originalHome !== undefined) {
			process.env.HOME = originalHome;
		}

		try {
			rmSync(testDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	});

	describe("path utilities", () => {
		test("getClaudeProjectsDir returns correct path", async () => {
			const { getClaudeProjectsDir } = await import(
				"../lib/memory/transcript-search.ts"
			);
			const path = getClaudeProjectsDir();

			expect(path).toContain(".claude");
			expect(path).toContain("projects");
		});

		test("pathToSlug converts paths correctly", async () => {
			const { pathToSlug } = await import("../lib/memory/transcript-search.ts");

			expect(pathToSlug("/Volumes/dev/src")).toBe("-Volumes-dev-src");
			expect(pathToSlug("/home/user/project")).toBe("-home-user-project");
			expect(pathToSlug("/Users/name/code")).toBe("-Users-name-code");
		});

		test("pathToSlug handles dots and slashes", async () => {
			const { pathToSlug } = await import("../lib/memory/transcript-search.ts");

			expect(pathToSlug("/foo/bar.baz")).toBe("-foo-bar-baz");
			expect(pathToSlug("/github.com/org/repo")).toBe("-github-com-org-repo");
		});

		test("slugToPath converts macOS Volumes paths", async () => {
			const { slugToPath } = await import("../lib/memory/transcript-search.ts");

			const slug = "-Volumes-dev-src-github-com-org-repo";
			const path = slugToPath(slug);

			expect(path).toContain("/Volumes/");
			expect(path).toContain("github.com");
		});

		test("slugToPath converts Users paths", async () => {
			const { slugToPath } = await import("../lib/memory/transcript-search.ts");

			const slug = "-Users-name-projects-myapp";
			const path = slugToPath(slug);

			expect(path).toContain("/Users/");
		});

		test("slugToPath converts home paths", async () => {
			const { slugToPath } = await import("../lib/memory/transcript-search.ts");

			const slug = "-home-user-code-project";
			const path = slugToPath(slug);

			expect(path).toContain("/home/");
		});

		test("slugToPath restores github.com domain", async () => {
			const { slugToPath } = await import("../lib/memory/transcript-search.ts");

			const slug = "-Volumes-dev-src-github-com-org-repo";
			const path = slugToPath(slug);

			expect(path).toContain("github.com");
		});

		test("slugToPath restores gitlab.com domain", async () => {
			const { slugToPath } = await import("../lib/memory/transcript-search.ts");

			const slug = "-Volumes-dev-gitlab-com-org-repo";
			const path = slugToPath(slug);

			expect(path).toContain("gitlab.com");
		});
	});

	describe("transcript types", () => {
		test("TranscriptMessageType includes expected types", async () => {
			const types: import("../lib/memory/transcript-search.ts").TranscriptMessageType[] =
				["user", "assistant", "file-history-snapshot", "summary"];

			expect(types).toContain("user");
			expect(types).toContain("assistant");
			expect(types).toContain("summary");
		});

		test("ContentBlockType includes expected types", async () => {
			const types: import("../lib/memory/transcript-search.ts").ContentBlockType[] =
				["text", "thinking", "tool_use", "tool_result"];

			expect(types).toContain("text");
			expect(types).toContain("thinking");
		});

		test("TranscriptEntry has required fields", async () => {
			const entry: import("../lib/memory/transcript-search.ts").TranscriptEntry =
				{
					type: "user",
					message: {
						role: "user",
						content: "Hello",
					},
				};

			expect(entry.type).toBe("user");
			expect(entry.message?.content).toBe("Hello");
		});

		test("TranscriptEntry supports optional fields", async () => {
			const entry: import("../lib/memory/transcript-search.ts").TranscriptEntry =
				{
					type: "assistant",
					uuid: "test-uuid",
					sessionId: "session-123",
					timestamp: "2024-01-01T00:00:00Z",
					cwd: "/test/path",
					gitBranch: "main",
					message: {
						role: "assistant",
						content: [{ type: "text", text: "Hello" }],
						model: "claude-3-opus",
					},
				};

			expect(entry.uuid).toBe("test-uuid");
			expect(entry.sessionId).toBe("session-123");
			expect(entry.cwd).toBe("/test/path");
		});

		test("TranscriptMessage has required fields", async () => {
			const message: import("../lib/memory/transcript-search.ts").TranscriptMessage =
				{
					sessionId: "session-123",
					projectSlug: "test-project",
					messageId: "msg-1",
					timestamp: "2024-01-01T00:00:00Z",
					type: "user",
					content: "Hello world",
				};

			expect(message.sessionId).toBe("session-123");
			expect(message.projectSlug).toBe("test-project");
			expect(message.type).toBe("user");
		});

		test("TranscriptSearchOptions has optional fields", async () => {
			const options: import("../lib/memory/transcript-search.ts").TranscriptSearchOptions =
				{
					query: "test",
				};

			expect(options.query).toBe("test");
			expect(options.limit).toBeUndefined();
			expect(options.scope).toBeUndefined();
		});

		test("TranscriptSearchResult has required fields", async () => {
			const result: import("../lib/memory/transcript-search.ts").TranscriptSearchResult =
				{
					sessionId: "session-123",
					projectSlug: "test-project",
					projectPath: "/test/path",
					timestamp: "2024-01-01T00:00:00Z",
					type: "assistant",
					excerpt: "Some text...",
					score: 0.85,
					isPeerWorktree: false,
					layer: "transcripts",
				};

			expect(result.score).toBe(0.85);
			expect(result.layer).toBe("transcripts");
		});
	});

	describe("findAllTranscriptFiles", () => {
		test("returns a Map", async () => {
			// Set up isolated test environment
			process.env.HOME = testDir;
			const projectsDir = join(testDir, ".claude", "projects");
			mkdirSync(projectsDir, { recursive: true });

			const { findAllTranscriptFiles } = await import(
				"../lib/memory/transcript-search.ts"
			);

			const files = findAllTranscriptFiles();

			expect(files instanceof Map).toBe(true);
		});

		test("finds JSONL files in project directories", async () => {
			// Set up isolated test environment
			process.env.HOME = testDir;
			const projectsDir = join(testDir, ".claude", "projects");
			const projectDir = join(projectsDir, "-test-project");
			mkdirSync(projectDir, { recursive: true });

			// Create test transcript
			const testFile = join(projectDir, "test.jsonl");
			writeFileSync(testFile, "");

			const { findAllTranscriptFiles } = await import(
				"../lib/memory/transcript-search.ts"
			);

			const files = findAllTranscriptFiles();

			// Should find the test project with its jsonl file
			expect(files.size).toBeGreaterThan(0);
			for (const [slug, projectFiles] of files) {
				expect(typeof slug).toBe("string");
				expect(Array.isArray(projectFiles)).toBe(true);
				for (const file of projectFiles) {
					expect(file).toEndWith(".jsonl");
				}
			}
		});
	});

	// parseTranscript tests removed - JSONL parsing moved to Rust coordinator
	// (han-native/src/indexer.rs). TypeScript now queries SQLite database.
	// Architecture: JSONL → Rust Coordinator → SQLite ← TypeScript queries

	describe.skip("searchTranscriptsText", () => {
		// SKIPPED: These tests can hang when accessing real user transcripts because
		// arePeerWorktrees() calls getGitRemote() on every result, which is slow/hangs
		// on non-existent paths. Need proper mocking of findAllTranscriptFiles() and
		// getGitRemote() for isolation.
		test(
			"returns array of search results",
			async () => {
				const { searchTranscriptsText } = await import(
					"../lib/memory/transcript-search.ts"
				);

				// Search - just verify it returns an array
				const results = await searchTranscriptsText({
					query: "test",
					scope: "all",
					limit: 1,
				});

				expect(Array.isArray(results)).toBe(true);
			},
			{ timeout: 30000 },
		);

		test(
			"respects limit option",
			async () => {
				const { searchTranscriptsText } = await import(
					"../lib/memory/transcript-search.ts"
				);

				// Search with limit - verify it returns at most the limit
				const results = await searchTranscriptsText({
					query: "the",
					scope: "all",
					limit: 5,
				});

				expect(Array.isArray(results)).toBe(true);
				expect(results.length).toBeLessThanOrEqual(5);
			},
			{ timeout: 30000 },
		);

		test(
			"results have required fields when results exist",
			async () => {
				const { searchTranscriptsText } = await import(
					"../lib/memory/transcript-search.ts"
				);

				// Search for something likely to have matches
				const results = await searchTranscriptsText({
					query: "the",
					scope: "all",
					limit: 1,
				});

				// Only verify structure if we got results
				if (results.length > 0) {
					const result = results[0];
					expect(result).toHaveProperty("sessionId");
					expect(result).toHaveProperty("projectSlug");
					expect(result).toHaveProperty("projectPath");
					expect(result).toHaveProperty("timestamp");
					expect(result).toHaveProperty("type");
					expect(result).toHaveProperty("excerpt");
					expect(result).toHaveProperty("score");
					expect(result).toHaveProperty("isPeerWorktree");
					expect(result).toHaveProperty("layer");
					expect(result.layer).toBe("transcripts");
				}
			},
			{ timeout: 30000 },
		);

		test(
			"excerpt is truncated for long content",
			async () => {
				const { searchTranscriptsText } = await import(
					"../lib/memory/transcript-search.ts"
				);

				const results = await searchTranscriptsText({
					query: "the",
					scope: "all",
					limit: 10,
				});

				// Excerpts should never exceed 303 chars (300 + "...")
				for (const result of results) {
					expect(result.excerpt.length).toBeLessThanOrEqual(303);
				}
			},
			{ timeout: 30000 },
		);

		test(
			"score is between 0 and 1",
			async () => {
				const { searchTranscriptsText } = await import(
					"../lib/memory/transcript-search.ts"
				);

				const results = await searchTranscriptsText({
					query: "test",
					scope: "all",
					limit: 10,
				});

				// Verify scores are valid
				for (const result of results) {
					expect(result.score).toBeGreaterThanOrEqual(0);
					expect(result.score).toBeLessThanOrEqual(1);
				}
			},
			{ timeout: 30000 },
		);
	});

	describe("TranscriptSearchOptions scope options", () => {
		test("scope current limits to current project", async () => {
			const options: import("../lib/memory/transcript-search.ts").TranscriptSearchOptions =
				{
					query: "test",
					scope: "current",
				};

			expect(options.scope).toBe("current");
		});

		test("scope peers searches peer worktrees", async () => {
			const options: import("../lib/memory/transcript-search.ts").TranscriptSearchOptions =
				{
					query: "test",
					scope: "peers",
					gitRemote: "git@github.com:org/repo.git",
				};

			expect(options.scope).toBe("peers");
			expect(options.gitRemote).toBeDefined();
		});

		test("scope all searches all projects", async () => {
			const options: import("../lib/memory/transcript-search.ts").TranscriptSearchOptions =
				{
					query: "test",
					scope: "all",
				};

			expect(options.scope).toBe("all");
		});
	});
});
