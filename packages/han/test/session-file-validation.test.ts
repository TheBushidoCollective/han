/**
 * Tests for Session File Validation System
 *
 * Tests the session-based file validation tracking that replaced hook_cache.
 * This system tracks:
 * 1. File changes per session (session_file_changes)
 * 2. File validation status per hook (session_file_validations)
 * 3. Stale detection when files are modified by another session
 *
 * NOTE: These tests require the native module for database access.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Check if native module is available
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const nativeModulePath = join(__dirname, "..", "native", "han-native.node");
const NATIVE_AVAILABLE = existsSync(nativeModulePath);
const SKIP_NATIVE = process.env.SKIP_NATIVE === "true" || !NATIVE_AVAILABLE;

// Skip tests when native module is not available
const describeWithNative = SKIP_NATIVE ? describe.skip : describe;

// Lazy import to avoid module load failures
let _resetDbState: () => void;
if (!SKIP_NATIVE) {
	const dbModule = await import("../lib/db/index.ts");
	_resetDbState = dbModule._resetDbState;
}

// Save original environment
const originalClaudeConfigDir = process.env.CLAUDE_CONFIG_DIR;

// Create isolated test directory
const testDir = join(
	"/tmp",
	`han-session-validation-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
);
const configDir = join(testDir, "config");
const projectDir = join(testDir, "project");

beforeAll(() => {
	// Reset database state to pick up new CLAUDE_CONFIG_DIR
	_resetDbState();
	// Create test directories
	mkdirSync(join(configDir, "han"), { recursive: true });
	mkdirSync(projectDir, { recursive: true });
	// Set isolated config dir for database
	process.env.CLAUDE_CONFIG_DIR = configDir;
});

afterAll(() => {
	// Reset database state before restoring environment
	_resetDbState();
	// Restore original environment
	if (originalClaudeConfigDir) {
		process.env.CLAUDE_CONFIG_DIR = originalClaudeConfigDir;
	} else {
		delete process.env.CLAUDE_CONFIG_DIR;
	}
	// Clean up test directory
	try {
		rmSync(testDir, { recursive: true, force: true });
	} catch {
		// Ignore cleanup errors
	}
});

// Helper to create test files
function createTestFile(name: string, content: string): string {
	const filePath = join(projectDir, name);
	writeFileSync(filePath, content);
	return filePath;
}

// Helper to compute file hash
function computeHash(content: string): string {
	return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

// Helper to create a test session
async function createTestSession(sessionId: string) {
	const { sessions, initDb } = await import("../lib/db/index.ts");
	await initDb();
	return sessions.upsert({
		id: sessionId,
		status: "active",
	});
}

describeWithNative("Session File Validation System", () => {
	describe("sessionFileChanges", () => {
		test("records file change for a session", async () => {
			const { sessionFileChanges } = await import("../lib/db/index.ts");

			await createTestSession("file-changes-1");

			const result = await sessionFileChanges.record({
				sessionId: "file-changes-1",
				filePath: "/project/src/main.ts",
				action: "modified",
				fileHashAfter: "abcd1234",
			});

			expect(result).toBeDefined();
			expect(result.sessionId).toBe("file-changes-1");
			expect(result.filePath).toBe("/project/src/main.ts");
			expect(result.action).toBe("modified");
			expect(result.fileHashAfter).toBe("abcd1234");
		});

		test("tracks multiple files for a session", async () => {
			const { sessionFileChanges } = await import("../lib/db/index.ts");

			await createTestSession("file-changes-2");

			await sessionFileChanges.record({
				sessionId: "file-changes-2",
				filePath: "/project/src/a.ts",
				action: "created",
				fileHashAfter: "hash1",
			});

			await sessionFileChanges.record({
				sessionId: "file-changes-2",
				filePath: "/project/src/b.ts",
				action: "modified",
				fileHashAfter: "hash2",
			});

			const hasChanges = await sessionFileChanges.hasChanges("file-changes-2");
			expect(hasChanges).toBe(true);
		});

		test("gets files modified by session", async () => {
			const { sessionFileChanges, getSessionModifiedFiles } = await import(
				"../lib/db/index.ts"
			);

			await createTestSession("file-changes-3");

			await sessionFileChanges.record({
				sessionId: "file-changes-3",
				filePath: "/project/new.ts",
				action: "created",
				fileHashAfter: "hash1",
			});

			await sessionFileChanges.record({
				sessionId: "file-changes-3",
				filePath: "/project/old.ts",
				action: "modified",
				fileHashAfter: "hash2",
			});

			const modified = await getSessionModifiedFiles("file-changes-3");
			expect(modified.success).toBe(true);
			expect(modified.created).toContain("/project/new.ts");
			expect(modified.modified).toContain("/project/old.ts");
		});
	});

	describe("sessionFileValidations", () => {
		test("records file validation", async () => {
			const { sessionFileValidations } = await import("../lib/db/index.ts");

			await createTestSession("validation-1");

			const result = await sessionFileValidations.record({
				sessionId: "validation-1",
				filePath: "/project/src/main.ts",
				fileHash: "abc123",
				pluginName: "jutsu-typescript",
				hookName: "typecheck",
				directory: "/project",
				commandHash: "cmd-hash-1",
			});

			expect(result).toBeDefined();
			expect(result.sessionId).toBe("validation-1");
			expect(result.fileHash).toBe("abc123");
		});

		test("retrieves file validation", async () => {
			const { sessionFileValidations } = await import("../lib/db/index.ts");

			await createTestSession("validation-2");

			await sessionFileValidations.record({
				sessionId: "validation-2",
				filePath: "/project/lib/utils.ts",
				fileHash: "def456",
				pluginName: "jutsu-biome",
				hookName: "lint",
				directory: "/project",
				commandHash: "cmd-hash-2",
			});

			const validation = await sessionFileValidations.get(
				"validation-2",
				"/project/lib/utils.ts",
				"jutsu-biome",
				"lint",
				"/project",
			);

			expect(validation).toBeDefined();
			expect(validation?.fileHash).toBe("def456");
			expect(validation?.commandHash).toBe("cmd-hash-2");
		});

		test("lists all validations for session and hook", async () => {
			const { sessionFileValidations } = await import("../lib/db/index.ts");

			await createTestSession("validation-3");

			// Record multiple validations
			await sessionFileValidations.record({
				sessionId: "validation-3",
				filePath: "/project/a.ts",
				fileHash: "hash-a",
				pluginName: "jutsu-typescript",
				hookName: "typecheck",
				directory: "/project",
				commandHash: "cmd-hash",
			});

			await sessionFileValidations.record({
				sessionId: "validation-3",
				filePath: "/project/b.ts",
				fileHash: "hash-b",
				pluginName: "jutsu-typescript",
				hookName: "typecheck",
				directory: "/project",
				commandHash: "cmd-hash",
			});

			const validations = await sessionFileValidations.list(
				"validation-3",
				"jutsu-typescript",
				"typecheck",
				"/project",
			);

			expect(validations.length).toBe(2);
			expect(validations.map((v) => v.filePath)).toContain("/project/a.ts");
			expect(validations.map((v) => v.filePath)).toContain("/project/b.ts");
		});

		test("updates validation on re-record", async () => {
			const { sessionFileValidations } = await import("../lib/db/index.ts");

			await createTestSession("validation-4");

			// Initial validation
			await sessionFileValidations.record({
				sessionId: "validation-4",
				filePath: "/project/main.ts",
				fileHash: "old-hash",
				pluginName: "jutsu-biome",
				hookName: "format",
				directory: "/project",
				commandHash: "cmd-hash-1",
			});

			// Re-validate with new hash
			await sessionFileValidations.record({
				sessionId: "validation-4",
				filePath: "/project/main.ts",
				fileHash: "new-hash",
				pluginName: "jutsu-biome",
				hookName: "format",
				directory: "/project",
				commandHash: "cmd-hash-2",
			});

			const validation = await sessionFileValidations.get(
				"validation-4",
				"/project/main.ts",
				"jutsu-biome",
				"format",
				"/project",
			);

			expect(validation?.fileHash).toBe("new-hash");
			expect(validation?.commandHash).toBe("cmd-hash-2");
		});
	});

	describe("needsValidation", () => {
		test("returns true when no validation exists", async () => {
			const { sessionFileValidations, sessionFileChanges } = await import(
				"../lib/db/index.ts"
			);

			await createTestSession("needs-validation-1");

			// Record a file change but no validation
			await sessionFileChanges.record({
				sessionId: "needs-validation-1",
				filePath: "/project/new.ts",
				action: "created",
				fileHashAfter: "hash1",
			});

			const needs = await sessionFileValidations.needsValidation(
				"needs-validation-1",
				"jutsu-typescript",
				"typecheck",
				"/project",
				"cmd-hash",
			);

			expect(needs).toBe(true);
		});

		test("returns false when all files validated with same command", async () => {
			const { sessionFileValidations, sessionFileChanges } = await import(
				"../lib/db/index.ts"
			);

			await createTestSession("needs-validation-2");

			// Record file change
			await sessionFileChanges.record({
				sessionId: "needs-validation-2",
				filePath: "/project/validated.ts",
				action: "modified",
				fileHashAfter: "hash1",
			});

			// Record validation with same command hash
			await sessionFileValidations.record({
				sessionId: "needs-validation-2",
				filePath: "/project/validated.ts",
				fileHash: "hash1",
				pluginName: "jutsu-typescript",
				hookName: "typecheck",
				directory: "/project",
				commandHash: "cmd-hash",
			});

			const needs = await sessionFileValidations.needsValidation(
				"needs-validation-2",
				"jutsu-typescript",
				"typecheck",
				"/project",
				"cmd-hash",
			);

			expect(needs).toBe(false);
		});

		test("returns true when command hash changed", async () => {
			const { sessionFileValidations, sessionFileChanges } = await import(
				"../lib/db/index.ts"
			);

			await createTestSession("needs-validation-3");

			// Record file change and validation
			await sessionFileChanges.record({
				sessionId: "needs-validation-3",
				filePath: "/project/file.ts",
				action: "modified",
				fileHashAfter: "hash1",
			});

			await sessionFileValidations.record({
				sessionId: "needs-validation-3",
				filePath: "/project/file.ts",
				fileHash: "hash1",
				pluginName: "jutsu-typescript",
				hookName: "typecheck",
				directory: "/project",
				commandHash: "old-cmd-hash",
			});

			// Check with different command hash
			const needs = await sessionFileValidations.needsValidation(
				"needs-validation-3",
				"jutsu-typescript",
				"typecheck",
				"/project",
				"new-cmd-hash",
			);

			expect(needs).toBe(true);
		});
	});

	describe("checkFilesNeedValidation", () => {
		test("identifies files needing validation", async () => {
			const { sessionFileValidations, sessionFileChanges } = await import(
				"../lib/db/index.ts"
			);

			await createTestSession("check-files-1");

			const fileContent = "const x = 1;";
			const filePath = createTestFile("check-file-1.ts", fileContent);
			const fileHash = computeHash(fileContent);

			// Record file change
			await sessionFileChanges.record({
				sessionId: "check-files-1",
				filePath,
				action: "created",
				fileHashAfter: fileHash,
			});

			// Check without validation
			const result = await sessionFileValidations.checkFilesNeedValidation(
				"check-files-1",
				"jutsu-typescript",
				"typecheck",
				projectDir,
				"cmd-hash",
				(path) => {
					try {
						const content = require("node:fs").readFileSync(path, "utf8");
						return computeHash(content);
					} catch {
						return "";
					}
				},
			);

			expect(result.needsValidation).toBe(true);
			expect(result.files).toContain(filePath);
			expect(result.staleFiles).toHaveLength(0);
		});

		test("detects stale files (modified by another session)", async () => {
			const { sessionFileValidations, sessionFileChanges } = await import(
				"../lib/db/index.ts"
			);

			await createTestSession("check-files-2");

			const originalContent = "const a = 1;";
			const modifiedContent = "const a = 2;";
			const filePath = createTestFile("stale-file.ts", originalContent);
			const originalHash = computeHash(originalContent);

			// Session 2 recorded the file with original content
			await sessionFileChanges.record({
				sessionId: "check-files-2",
				filePath,
				action: "modified",
				fileHashAfter: originalHash,
			});

			// But the file was modified by "another session" (simulate by changing file)
			writeFileSync(filePath, modifiedContent);

			// Check should detect the file as stale
			const result = await sessionFileValidations.checkFilesNeedValidation(
				"check-files-2",
				"jutsu-typescript",
				"typecheck",
				projectDir,
				"cmd-hash",
				(path) => {
					try {
						const content = require("node:fs").readFileSync(path, "utf8");
						return computeHash(content);
					} catch {
						return "";
					}
				},
			);

			// Stale file should not need validation by this session
			expect(result.staleFiles).toContain(filePath);
			expect(result.files).not.toContain(filePath);
		});

		test.skip("skips already validated files", async () => {
			const { sessionFileValidations, sessionFileChanges } = await import(
				"../lib/db/index.ts"
			);

			await createTestSession("check-files-3");

			const fileContent = "export const val = 42;";
			const filePath = createTestFile("validated-file.ts", fileContent);
			const fileHash = computeHash(fileContent);

			// Record file change
			await sessionFileChanges.record({
				sessionId: "check-files-3",
				filePath,
				action: "created",
				fileHashAfter: fileHash,
			});

			// Record validation
			await sessionFileValidations.record({
				sessionId: "check-files-3",
				filePath,
				fileHash,
				pluginName: "jutsu-biome",
				hookName: "lint",
				directory: projectDir,
				commandHash: "cmd-hash",
			});

			// Check - file should not need validation
			const result = await sessionFileValidations.checkFilesNeedValidation(
				"check-files-3",
				"jutsu-biome",
				"lint",
				projectDir,
				"cmd-hash",
				(path) => {
					try {
						const content = require("node:fs").readFileSync(path, "utf8");
						return computeHash(content);
					} catch {
						return "";
					}
				},
			);

			expect(result.needsValidation).toBe(false);
			expect(result.files).not.toContain(filePath);
		});

		test("re-validates when command changes", async () => {
			const { sessionFileValidations, sessionFileChanges } = await import(
				"../lib/db/index.ts"
			);

			await createTestSession("check-files-4");

			const fileContent = "let count = 0;";
			const filePath = createTestFile("revalidate-file.ts", fileContent);
			const fileHash = computeHash(fileContent);

			// Record file change and validation
			await sessionFileChanges.record({
				sessionId: "check-files-4",
				filePath,
				action: "created",
				fileHashAfter: fileHash,
			});

			await sessionFileValidations.record({
				sessionId: "check-files-4",
				filePath,
				fileHash,
				pluginName: "jutsu-typescript",
				hookName: "typecheck",
				directory: projectDir,
				commandHash: "old-cmd-hash",
			});

			// Check with different command - should need re-validation
			const result = await sessionFileValidations.checkFilesNeedValidation(
				"check-files-4",
				"jutsu-typescript",
				"typecheck",
				projectDir,
				"new-cmd-hash", // Different command hash
				(path) => {
					try {
						const content = require("node:fs").readFileSync(path, "utf8");
						return computeHash(content);
					} catch {
						return "";
					}
				},
			);

			expect(result.needsValidation).toBe(true);
			expect(result.files).toContain(filePath);
		});
	});

	describe("cross-session isolation", () => {
		test("sessions track their own file changes independently", async () => {
			const { sessionFileChanges, getSessionModifiedFiles } = await import(
				"../lib/db/index.ts"
			);

			await createTestSession("isolation-1a");
			await createTestSession("isolation-1b");

			// Session A modifies file A
			await sessionFileChanges.record({
				sessionId: "isolation-1a",
				filePath: "/project/a.ts",
				action: "modified",
				fileHashAfter: "hash-a",
			});

			// Session B modifies file B
			await sessionFileChanges.record({
				sessionId: "isolation-1b",
				filePath: "/project/b.ts",
				action: "modified",
				fileHashAfter: "hash-b",
			});

			const modifiedA = await getSessionModifiedFiles("isolation-1a");
			const modifiedB = await getSessionModifiedFiles("isolation-1b");

			expect(modifiedA.allModified).toContain("/project/a.ts");
			expect(modifiedA.allModified).not.toContain("/project/b.ts");
			expect(modifiedB.allModified).toContain("/project/b.ts");
			expect(modifiedB.allModified).not.toContain("/project/a.ts");
		});

		test("validations are session-specific", async () => {
			const { sessionFileValidations } = await import("../lib/db/index.ts");

			await createTestSession("isolation-2a");
			await createTestSession("isolation-2b");

			// Session A validates file
			await sessionFileValidations.record({
				sessionId: "isolation-2a",
				filePath: "/project/shared.ts",
				fileHash: "hash1",
				pluginName: "jutsu-typescript",
				hookName: "typecheck",
				directory: "/project",
				commandHash: "cmd-hash",
			});

			// Session B should not see Session A's validation
			const validationB = await sessionFileValidations.get(
				"isolation-2b",
				"/project/shared.ts",
				"jutsu-typescript",
				"typecheck",
				"/project",
			);

			expect(validationB).toBeNull();
		});
	});
});
