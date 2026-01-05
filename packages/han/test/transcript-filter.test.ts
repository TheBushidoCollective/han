/**
 * Unit tests for transcript-filter.ts
 * Tests transcript-based session filtering for stop hooks
 */
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import {
	existsSync,
	mkdirSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
	buildCommandWithFiles,
	clearTranscriptCache,
	commandUsesSessionFiles,
	getProjectsBaseDir,
	getSessionFilteredFiles,
	getTranscriptModifiedFiles,
	HAN_FILES_TEMPLATE,
	hasSessionModifiedPatternFiles,
} from "../lib/hooks/index.ts";
import {
	pathToSlug,
	type TranscriptMessage,
} from "../lib/memory/transcript-search.ts";

// Mock parseTranscript to avoid database dependency in tests
// The actual implementation queries SQLite, but tests work with mock data
const mockParseTranscript = mock(() =>
	Promise.resolve([] as TranscriptMessage[]),
);
mock.module("../lib/memory/transcript-search.ts", () => ({
	parseTranscript: mockParseTranscript,
	pathToSlug,
}));

// Store original environment
const originalEnv = { ...process.env };

let testDir: string;
let configDir: string;
let projectDir: string;

function setup(): void {
	const random = Math.random().toString(36).substring(2, 9);
	// Use realpath to resolve symlinks (e.g., /var -> /private/var on macOS)
	const baseTmpDir = realpathSync(tmpdir());
	testDir = join(baseTmpDir, `han-transcript-test-${Date.now()}-${random}`);
	configDir = join(testDir, ".claude");
	projectDir = join(testDir, "project");
	mkdirSync(configDir, { recursive: true });
	mkdirSync(projectDir, { recursive: true });
	mkdirSync(join(configDir, "projects"), { recursive: true });

	process.env.CLAUDE_CONFIG_DIR = configDir;
	process.env.CLAUDE_PROJECT_DIR = projectDir;

	// Clear any cached transcript data
	clearTranscriptCache();

	// Reset mock to default (empty array)
	mockParseTranscript.mockReset();
	mockParseTranscript.mockImplementation(() =>
		Promise.resolve([] as TranscriptMessage[]),
	);
}

function teardown(): void {
	// Clear cache before restoring environment
	clearTranscriptCache();

	// Restore environment variables properly
	for (const key in process.env) {
		if (!(key in originalEnv)) {
			delete process.env[key];
		}
	}
	for (const key in originalEnv) {
		process.env[key] = originalEnv[key];
	}

	if (testDir && existsSync(testDir)) {
		try {
			rmSync(testDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	}
}

/**
 * Create a mock transcript file and set up the mock to return appropriate messages
 *
 * Creates an empty JSONL file so findSessionTranscript() finds it,
 * then configures the mock to return messages with the specified operations.
 */
function createMockTranscript(
	projectPath: string,
	sessionId: string,
	operations: Array<{ path: string; operation: "write" | "edit" | "read" }>,
): string {
	const projectsDir = getProjectsBaseDir();
	const projectSlug = pathToSlug(projectPath);
	const projectTranscriptDir = join(projectsDir, projectSlug);
	mkdirSync(projectTranscriptDir, { recursive: true });

	const transcriptPath = join(projectTranscriptDir, `${sessionId}.jsonl`);

	// Create an empty file so findSessionTranscript() can find it
	writeFileSync(transcriptPath, "");

	// Build transcript messages that the native extractFileOperations will parse
	const messages: TranscriptMessage[] = [];

	// Add a user message first
	messages.push({
		sessionId,
		projectSlug,
		messageId: "user-1",
		timestamp: new Date().toISOString(),
		type: "user",
		content: "Help me modify some files",
	});

	// Add assistant messages with file operations
	// The native extractFileOperations looks for patterns like "Writing to X" and "Editing X"
	for (const op of operations) {
		let content = "";
		switch (op.operation) {
			case "write":
				content = `Writing to ${op.path}`;
				break;
			case "edit":
				content = `Editing ${op.path}`;
				break;
			case "read":
				content = `Reading ${op.path}`;
				break;
		}

		messages.push({
			sessionId,
			projectSlug,
			messageId: `assistant-${op.path}`,
			timestamp: new Date().toISOString(),
			type: "assistant",
			content,
		});
	}

	// Configure the mock to return these messages
	mockParseTranscript.mockImplementation(() => Promise.resolve(messages));

	return transcriptPath;
}

describe("transcript-filter.ts", () => {
	beforeEach(() => {
		setup();
	});

	afterEach(() => {
		teardown();
	});

	describe("getTranscriptModifiedFiles", () => {
		test("returns success=false when transcript not found", async () => {
			const result = await getTranscriptModifiedFiles(
				"session",
				"nonexistent-session-id",
				projectDir,
			);

			expect(result.success).toBe(false);
			expect(result.allModified).toEqual([]);
		});

		test("extracts write operations from transcript", async () => {
			createMockTranscript(projectDir, "test-session-1", [
				{ path: "src/main.ts", operation: "write" },
				{ path: "src/utils.ts", operation: "write" },
			]);

			const result = await getTranscriptModifiedFiles(
				"session",
				"test-session-1",
				projectDir,
			);

			expect(result.success).toBe(true);
			expect(result.written).toContain("src/main.ts");
			expect(result.written).toContain("src/utils.ts");
			expect(result.allModified.length).toBe(2);
		});

		test("extracts edit operations from transcript", async () => {
			createMockTranscript(projectDir, "test-session-2", [
				{ path: "src/config.ts", operation: "edit" },
			]);

			const result = await getTranscriptModifiedFiles(
				"session",
				"test-session-2",
				projectDir,
			);

			expect(result.success).toBe(true);
			expect(result.edited).toContain("src/config.ts");
			expect(result.allModified.length).toBe(1);
		});

		test("ignores read operations", async () => {
			createMockTranscript(projectDir, "test-session-3", [
				{ path: "src/read-only.ts", operation: "read" },
				{ path: "src/modified.ts", operation: "edit" },
			]);

			const result = await getTranscriptModifiedFiles(
				"session",
				"test-session-3",
				projectDir,
			);

			expect(result.success).toBe(true);
			expect(result.allModified).not.toContain("src/read-only.ts");
			expect(result.allModified).toContain("src/modified.ts");
		});

		test("combines write and edit operations in allModified", async () => {
			createMockTranscript(projectDir, "test-session-4", [
				{ path: "src/new-file.ts", operation: "write" },
				{ path: "src/existing.ts", operation: "edit" },
			]);

			const result = await getTranscriptModifiedFiles(
				"session",
				"test-session-4",
				projectDir,
			);

			expect(result.success).toBe(true);
			expect(result.allModified.length).toBe(2);
			expect(result.allModified).toContain("src/new-file.ts");
			expect(result.allModified).toContain("src/existing.ts");
		});

		test("caches results for same session", async () => {
			createMockTranscript(projectDir, "test-session-cache", [
				{ path: "src/cached.ts", operation: "write" },
			]);

			const result1 = await getTranscriptModifiedFiles(
				"session",
				"test-session-cache",
				projectDir,
			);
			const result2 = await getTranscriptModifiedFiles(
				"session",
				"test-session-cache",
				projectDir,
			);

			expect(result1).toBe(result2); // Same object reference (cached)
		});

		test("handles agent type transcripts", async () => {
			// Create agent transcript with agent- prefix
			const projectsDir = getProjectsBaseDir();
			const projectSlug = pathToSlug(projectDir);
			const projectTranscriptDir = join(projectsDir, projectSlug);
			mkdirSync(projectTranscriptDir, { recursive: true });

			const agentTranscriptPath = join(
				projectTranscriptDir,
				"agent-test-agent-id.jsonl",
			);
			// Create empty file so findAgentTranscript() finds it
			writeFileSync(agentTranscriptPath, "");

			// Configure mock to return messages with write operation
			mockParseTranscript.mockImplementation(() =>
				Promise.resolve([
					{
						sessionId: "test-agent-id",
						projectSlug,
						messageId: "assistant-1",
						timestamp: new Date().toISOString(),
						type: "assistant" as const,
						content: "Writing to agent-file.ts",
					},
				]),
			);

			const result = await getTranscriptModifiedFiles(
				"agent",
				"test-agent-id",
				projectDir,
			);

			expect(result.success).toBe(true);
			expect(result.written).toContain("agent-file.ts");
		});
	});

	describe("hasSessionModifiedPatternFiles", () => {
		test("returns false when no files modified", () => {
			const modifiedFiles = {
				written: [],
				edited: [],
				allModified: [],
				id: "test",
				success: true,
			};

			const result = hasSessionModifiedPatternFiles(modifiedFiles, projectDir, [
				"**/*.ts",
			]);

			expect(result).toBe(false);
		});

		test("returns true when no patterns specified (run on all changes)", () => {
			const modifiedFiles = {
				written: ["src/file.ts"],
				edited: [],
				allModified: ["src/file.ts"],
				id: "test",
				success: true,
			};

			const result = hasSessionModifiedPatternFiles(
				modifiedFiles,
				projectDir,
				[],
			);

			expect(result).toBe(true);
		});

		test("returns true when modified files match pattern files", () => {
			// Create actual files in the project directory
			mkdirSync(join(projectDir, "src"), { recursive: true });
			writeFileSync(join(projectDir, "src/main.ts"), "// main");
			writeFileSync(join(projectDir, "src/utils.ts"), "// utils");

			const modifiedFiles = {
				written: [],
				edited: ["src/main.ts"],
				allModified: ["src/main.ts"],
				id: "test",
				success: true,
			};

			const result = hasSessionModifiedPatternFiles(modifiedFiles, projectDir, [
				"src/**/*.ts",
			]);

			expect(result).toBe(true);
		});

		test("returns false when modified files do not match pattern", () => {
			// Create actual files in the project directory
			mkdirSync(join(projectDir, "src"), { recursive: true });
			mkdirSync(join(projectDir, "docs"), { recursive: true });
			writeFileSync(join(projectDir, "src/main.ts"), "// main");
			writeFileSync(join(projectDir, "docs/readme.md"), "# readme");

			const modifiedFiles = {
				written: [],
				edited: ["docs/readme.md"],
				allModified: ["docs/readme.md"],
				id: "test",
				success: true,
			};

			const result = hasSessionModifiedPatternFiles(modifiedFiles, projectDir, [
				"src/**/*.ts",
			]);

			expect(result).toBe(false);
		});
	});

	describe("clearTranscriptCache", () => {
		test("clears cached transcript data", async () => {
			createMockTranscript(projectDir, "test-session-clear", [
				{ path: "src/file.ts", operation: "write" },
			]);

			// First call - populate cache
			const result1 = await getTranscriptModifiedFiles(
				"session",
				"test-session-clear",
				projectDir,
			);

			// Clear cache
			clearTranscriptCache();

			// Second call - should not be same object (cache was cleared)
			const result2 = await getTranscriptModifiedFiles(
				"session",
				"test-session-clear",
				projectDir,
			);

			// Results should have same content but be different objects
			expect(result1.allModified).toEqual(result2.allModified);
			expect(result1).not.toBe(result2);
		});
	});

	describe("getSessionFilteredFiles", () => {
		test("returns empty array when no files modified", () => {
			const modifiedFiles = {
				written: [],
				edited: [],
				allModified: [],
				id: "test",
				success: true,
			};

			const result = getSessionFilteredFiles(modifiedFiles, projectDir, [
				"**/*.ts",
			]);

			expect(result).toEqual([]);
		});

		test("returns all modified files when no patterns specified", () => {
			const modifiedFiles = {
				written: ["src/file.ts"],
				edited: ["src/other.ts"],
				allModified: ["src/file.ts", "src/other.ts"],
				id: "test",
				success: true,
			};

			const result = getSessionFilteredFiles(modifiedFiles, projectDir, []);

			expect(result).toContain("src/file.ts");
			expect(result).toContain("src/other.ts");
		});

		test("returns intersection of modified files and pattern files", () => {
			// Create actual files in the project directory
			mkdirSync(join(projectDir, "src"), { recursive: true });
			writeFileSync(join(projectDir, "src/main.ts"), "// main");
			writeFileSync(join(projectDir, "src/utils.ts"), "// utils");

			const modifiedFiles = {
				written: [],
				edited: ["src/main.ts"],
				allModified: ["src/main.ts"],
				id: "test",
				success: true,
			};

			const result = getSessionFilteredFiles(modifiedFiles, projectDir, [
				"src/**/*.ts",
			]);

			expect(result).toContain("src/main.ts");
			expect(result).not.toContain("src/utils.ts"); // Not modified
		});

		test("excludes files outside directory", () => {
			const modifiedFiles = {
				written: [],
				edited: ["../outside/file.ts"],
				allModified: ["../outside/file.ts"],
				id: "test",
				success: true,
			};

			const result = getSessionFilteredFiles(modifiedFiles, projectDir, []);

			expect(result).toEqual([]);
		});
	});

	describe("buildCommandWithFiles", () => {
		test("returns original command when no template present", () => {
			const result = buildCommandWithFiles("npx biome check --write .", [
				"src/file.ts",
			]);

			expect(result).toBe("npx biome check --write .");
		});

		test("substitutes template with file list", () => {
			const result = buildCommandWithFiles(
				`npx biome check --write ${HAN_FILES_TEMPLATE}`,
				["src/file.ts", "src/other.ts"],
			);

			expect(result).toBe("npx biome check --write src/file.ts src/other.ts");
		});

		test("replaces template with . when no files", () => {
			const result = buildCommandWithFiles(
				`npx biome check --write ${HAN_FILES_TEMPLATE}`,
				[],
			);

			expect(result).toBe("npx biome check --write .");
		});

		test("escapes file paths with spaces", () => {
			const result = buildCommandWithFiles(
				`npx biome check ${HAN_FILES_TEMPLATE}`,
				["src/my file.ts"],
			);

			expect(result).toBe("npx biome check 'src/my file.ts'");
		});

		test("escapes file paths with quotes", () => {
			const result = buildCommandWithFiles(
				`npx biome check ${HAN_FILES_TEMPLATE}`,
				["src/file's.ts"],
			);

			expect(result).toBe("npx biome check 'src/file'\\''s.ts'");
		});
	});

	describe("commandUsesSessionFiles", () => {
		test("returns true when template present", () => {
			expect(
				commandUsesSessionFiles(`npx biome check ${HAN_FILES_TEMPLATE}`),
			).toBe(true);
		});

		test("returns false when template not present", () => {
			expect(commandUsesSessionFiles("npx biome check .")).toBe(false);
		});
	});
});
