/**
 * Unit tests for checkpoint.ts
 * Tests checkpoint capture, loading, change detection, and cleanup
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	existsSync,
	mkdirSync,
	realpathSync,
	rmSync,
	utimesSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
	captureCheckpoint,
	cleanupOldCheckpoints,
	getCheckpointDir,
	getCheckpointPath,
	getProjectSlug,
	getProjectsBaseDir,
	hasChangedSinceCheckpoint,
	listCheckpoints,
	loadCheckpoint,
} from "../lib/hooks/index.ts";

// Store original environment
const originalEnv = { ...process.env };

let testDir: string;
let configDir: string;
let projectDir: string;

function setup(): void {
	const random = Math.random().toString(36).substring(2, 9);
	// Use realpath to resolve symlinks (e.g., /var -> /private/var on macOS)
	const baseTmpDir = realpathSync(tmpdir());
	testDir = join(baseTmpDir, `han-checkpoint-test-${Date.now()}-${random}`);
	configDir = join(testDir, ".claude");
	projectDir = join(testDir, "project");
	mkdirSync(configDir, { recursive: true });
	mkdirSync(projectDir, { recursive: true });

	process.env.CLAUDE_CONFIG_DIR = configDir;
	process.env.CLAUDE_PROJECT_DIR = projectDir;
}

function teardown(): void {
	// Restore environment variables properly
	// Delete any keys that were added
	for (const key in process.env) {
		if (!(key in originalEnv)) {
			delete process.env[key];
		}
	}
	// Restore original values
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

describe("checkpoint.ts", () => {
	beforeEach(() => {
		setup();
	});

	afterEach(() => {
		teardown();
	});

	describe("getProjectSlug", () => {
		test("derives slug from directory path", () => {
			const result = getProjectSlug("/Users/john/projects/my-app");
			expect(result).toBe("Users-john-projects-my-app");
		});

		test("removes leading slash and replaces slashes with dashes", () => {
			const result = getProjectSlug("/home/dev/work/api-service");
			expect(result).toBe("home-dev-work-api-service");
		});

		test("uses CLAUDE_PROJECT_DIR when no path provided", () => {
			const result = getProjectSlug();
			// Should use projectDir which was set in setup()
			expect(result).toContain("project");
		});
	});

	describe("getProjectsBaseDir", () => {
		test("returns ~/.claude/projects/", () => {
			const result = getProjectsBaseDir();
			expect(result).toMatch(/\.claude\/projects$/);
		});
	});

	describe("getCheckpointDir", () => {
		test("returns correct checkpoint directory path", () => {
			const result = getCheckpointDir();
			expect(result).toContain("/.claude/projects/");
		});

		test("path includes project slug", () => {
			const result = getCheckpointDir();
			// Should contain the project path under projects/
			expect(result).toMatch(/\.claude\/projects\/.+$/);
		});
	});

	describe("getCheckpointPath", () => {
		test("returns correct path for session checkpoint", () => {
			const result = getCheckpointPath("session", "session-123");
			expect(result).toContain("/session-123/checkpoint.json");
		});

		test("returns correct path for agent checkpoint", () => {
			const result = getCheckpointPath("agent", "agent-456");
			expect(result).toContain("/agent-agent-456/checkpoint.json");
		});

		test("sanitizes checkpoint ID", () => {
			const result = getCheckpointPath("session", "id/with/slashes");
			expect(result).toContain("/id_with_slashes/checkpoint.json");
		});
	});

	describe("captureCheckpoint", () => {
		test("captures checkpoint for matching files", () => {
			writeFileSync(join(projectDir, "file1.ts"), "content1");
			writeFileSync(join(projectDir, "file2.ts"), "content2");

			const result = captureCheckpoint("session", "test-session", ["**/*.ts"]);

			expect(result).toBe(true);

			const checkpoint = loadCheckpoint("session", "test-session");
			expect(checkpoint).not.toBeNull();
			expect(checkpoint?.type).toBe("session");
			expect(checkpoint?.patterns).toEqual(["**/*.ts"]);
			expect(Object.keys(checkpoint?.files || {}).length).toBe(2);
		});

		test("creates checkpoint directory if needed", () => {
			writeFileSync(join(projectDir, "test.ts"), "content");

			const result = captureCheckpoint("agent", "new-agent", ["**/*.ts"]);

			expect(result).toBe(true);
			const checkpointPath = getCheckpointPath("agent", "new-agent");
			expect(existsSync(checkpointPath)).toBe(true);
		});

		test("includes created_at timestamp", () => {
			writeFileSync(join(projectDir, "test.ts"), "content");

			const beforeCapture = Date.now();
			captureCheckpoint("session", "timestamped", ["**/*.ts"]);
			const afterCapture = Date.now();

			const checkpoint = loadCheckpoint("session", "timestamped");
			expect(checkpoint?.created_at).toBeDefined();

			if (!checkpoint) throw new Error("Checkpoint should exist");
			const checkpointTime = new Date(checkpoint.created_at).getTime();
			expect(checkpointTime).toBeGreaterThanOrEqual(beforeCapture);
			expect(checkpointTime).toBeLessThanOrEqual(afterCapture);
		});

		test("stores file hashes in checkpoint", () => {
			writeFileSync(join(projectDir, "file1.ts"), "unique content 1");
			writeFileSync(join(projectDir, "file2.ts"), "unique content 2");

			captureCheckpoint("session", "hash-test", ["**/*.ts"]);

			const checkpoint = loadCheckpoint("session", "hash-test");
			const files = checkpoint?.files || {};

			expect(Object.keys(files).length).toBe(2);
			// Hashes should be different for different content
			const hashes = Object.values(files);
			expect(hashes[0]).not.toBe(hashes[1]);
			// Hashes should be non-empty strings
			expect(hashes[0].length).toBeGreaterThan(0);
			expect(hashes[1].length).toBeGreaterThan(0);
		});

		test("handles multiple glob patterns", () => {
			writeFileSync(join(projectDir, "file.ts"), "ts content");
			writeFileSync(join(projectDir, "style.css"), "css content");
			writeFileSync(join(projectDir, "readme.md"), "markdown content");

			captureCheckpoint("session", "multi-pattern", [
				"**/*.ts",
				"**/*.css",
				"**/*.md",
			]);

			const checkpoint = loadCheckpoint("session", "multi-pattern");
			expect(Object.keys(checkpoint?.files || {}).length).toBe(3);
		});

		test("handles empty directory", () => {
			const result = captureCheckpoint("session", "empty", ["**/*.ts"]);

			expect(result).toBe(true);
			const checkpoint = loadCheckpoint("session", "empty");
			expect(checkpoint).not.toBeNull();
			expect(Object.keys(checkpoint?.files || {}).length).toBe(0);
		});

		test("overwrites existing checkpoint", () => {
			writeFileSync(join(projectDir, "file.ts"), "original");

			captureCheckpoint("session", "overwrite-test", ["**/*.ts"]);
			const first = loadCheckpoint("session", "overwrite-test");
			const firstHash = first?.files["file.ts"];

			// Modify and recapture
			writeFileSync(join(projectDir, "file.ts"), "modified");
			captureCheckpoint("session", "overwrite-test", ["**/*.ts"]);
			const second = loadCheckpoint("session", "overwrite-test");
			const secondHash = second?.files["file.ts"];

			expect(firstHash).not.toBe(secondHash);
		});
	});

	describe("loadCheckpoint", () => {
		test("returns null when checkpoint does not exist", () => {
			const result = loadCheckpoint("session", "nonexistent");
			expect(result).toBeNull();
		});

		test("loads checkpoint data correctly", () => {
			writeFileSync(join(projectDir, "test.ts"), "content");
			captureCheckpoint("agent", "load-test", ["**/*.ts"]);

			const checkpoint = loadCheckpoint("agent", "load-test");

			expect(checkpoint).not.toBeNull();
			expect(checkpoint?.type).toBe("agent");
			expect(checkpoint?.patterns).toEqual(["**/*.ts"]);
			expect(checkpoint?.created_at).toBeDefined();
			expect(checkpoint?.files).toBeDefined();
		});

		test("returns null for corrupted checkpoint file", () => {
			const checkpointPath = getCheckpointPath("session", "corrupted");
			const checkpointDir = join(checkpointPath, "..");
			mkdirSync(checkpointDir, { recursive: true });
			writeFileSync(checkpointPath, "not valid json");

			const result = loadCheckpoint("session", "corrupted");
			expect(result).toBeNull();
		});
	});

	describe("hasChangedSinceCheckpoint", () => {
		test("returns false when no files changed", () => {
			writeFileSync(join(projectDir, "file1.ts"), "content1");
			writeFileSync(join(projectDir, "file2.ts"), "content2");

			captureCheckpoint("session", "unchanged", ["**/*.ts"]);
			const checkpoint = loadCheckpoint("session", "unchanged");

			if (!checkpoint) throw new Error("Checkpoint should exist");
			const result = hasChangedSinceCheckpoint(checkpoint, projectDir, [
				"**/*.ts",
			]);

			expect(result).toBe(false);
		});

		test("returns true when file content changed", () => {
			const filePath = join(projectDir, "file.ts");
			writeFileSync(filePath, "original content");

			captureCheckpoint("session", "content-change", ["**/*.ts"]);
			const checkpoint = loadCheckpoint("session", "content-change");

			// Modify file
			writeFileSync(filePath, "modified content");

			if (!checkpoint) throw new Error("Checkpoint should exist");
			const result = hasChangedSinceCheckpoint(checkpoint, projectDir, [
				"**/*.ts",
			]);

			expect(result).toBe(true);
		});

		test("returns true when new file added", () => {
			writeFileSync(join(projectDir, "existing.ts"), "content");

			captureCheckpoint("session", "new-file", ["**/*.ts"]);
			const checkpoint = loadCheckpoint("session", "new-file");

			// Add new file
			writeFileSync(join(projectDir, "new.ts"), "new content");

			if (!checkpoint) throw new Error("Checkpoint should exist");
			const result = hasChangedSinceCheckpoint(checkpoint, projectDir, [
				"**/*.ts",
			]);

			expect(result).toBe(true);
		});

		test("returns true when file deleted", () => {
			const filePath = join(projectDir, "deleteme.ts");
			writeFileSync(filePath, "content");

			captureCheckpoint("session", "file-delete", ["**/*.ts"]);
			const checkpoint = loadCheckpoint("session", "file-delete");

			// Delete file
			rmSync(filePath);

			if (!checkpoint) throw new Error("Checkpoint should exist");
			const result = hasChangedSinceCheckpoint(checkpoint, projectDir, [
				"**/*.ts",
			]);

			expect(result).toBe(true);
		});

		test("handles pattern changes", () => {
			writeFileSync(join(projectDir, "file.ts"), "ts content");
			writeFileSync(join(projectDir, "style.css"), "css content");

			// Capture with only .ts pattern
			captureCheckpoint("session", "pattern-change", ["**/*.ts"]);
			const checkpoint = loadCheckpoint("session", "pattern-change");

			// Check with different patterns (now including .css)
			// Should detect change because .css files weren't in checkpoint
			if (!checkpoint) throw new Error("Checkpoint should exist");
			const result = hasChangedSinceCheckpoint(checkpoint, projectDir, [
				"**/*.ts",
				"**/*.css",
			]);

			expect(result).toBe(true);
		});

		test("handles nested directories", () => {
			const nestedDir = join(projectDir, "src", "utils");
			mkdirSync(nestedDir, { recursive: true });
			const nestedFile = join(nestedDir, "helper.ts");
			writeFileSync(nestedFile, "original");

			captureCheckpoint("session", "nested", ["**/*.ts"]);
			const checkpoint = loadCheckpoint("session", "nested");

			// Modify nested file
			writeFileSync(nestedFile, "modified");

			if (!checkpoint) throw new Error("Checkpoint should exist");
			const result = hasChangedSinceCheckpoint(checkpoint, projectDir, [
				"**/*.ts",
			]);

			expect(result).toBe(true);
		});

		test("returns false for changes outside patterns", () => {
			writeFileSync(join(projectDir, "tracked.ts"), "content");
			writeFileSync(join(projectDir, "ignored.txt"), "original");

			captureCheckpoint("session", "pattern-ignore", ["**/*.ts"]);
			const checkpoint = loadCheckpoint("session", "pattern-ignore");

			// Modify file not matching pattern
			writeFileSync(join(projectDir, "ignored.txt"), "modified");

			if (!checkpoint) throw new Error("Checkpoint should exist");
			const result = hasChangedSinceCheckpoint(checkpoint, projectDir, [
				"**/*.ts",
			]);

			expect(result).toBe(false);
		});
	});

	describe("cleanupOldCheckpoints", () => {
		test("removes checkpoints older than maxAge", () => {
			// Create old checkpoint
			writeFileSync(join(projectDir, "file.ts"), "content");
			captureCheckpoint("session", "old-checkpoint", ["**/*.ts"]);

			// Explicitly set old checkpoint to have old mtime (1 second ago)
			const oldTime = new Date(Date.now() - 1000);
			utimesSync(
				getCheckpointPath("session", "old-checkpoint"),
				oldTime,
				oldTime,
			);

			// Create new checkpoint (will have current mtime)
			captureCheckpoint("session", "new-checkpoint", ["**/*.ts"]);

			// Cleanup checkpoints older than 500ms
			// old-checkpoint is 1s old (should be removed)
			// new-checkpoint is ~0ms old (should be kept)
			const removed = cleanupOldCheckpoints(500);

			expect(removed).toBe(1);
			expect(loadCheckpoint("session", "old-checkpoint")).toBeNull();
			expect(loadCheckpoint("session", "new-checkpoint")).not.toBeNull();
		});

		test("uses default maxAge of 24 hours", () => {
			writeFileSync(join(projectDir, "file.ts"), "content");
			captureCheckpoint("session", "recent", ["**/*.ts"]);

			// Should not remove recent checkpoints
			const removed = cleanupOldCheckpoints();

			expect(removed).toBe(0);
			expect(loadCheckpoint("session", "recent")).not.toBeNull();
		});

		test("returns count of removed checkpoints", () => {
			writeFileSync(join(projectDir, "file.ts"), "content");

			// Create multiple old checkpoints
			captureCheckpoint("session", "old-1", ["**/*.ts"]);
			captureCheckpoint("session", "old-2", ["**/*.ts"]);
			captureCheckpoint("agent", "old-3", ["**/*.ts"]);

			// Explicitly set all checkpoints to have old mtime (1 second ago)
			const oldTime = new Date(Date.now() - 1000);
			utimesSync(getCheckpointPath("session", "old-1"), oldTime, oldTime);
			utimesSync(getCheckpointPath("session", "old-2"), oldTime, oldTime);
			utimesSync(getCheckpointPath("agent", "old-3"), oldTime, oldTime);

			// Cleanup checkpoints older than 500ms
			const removed = cleanupOldCheckpoints(500);

			expect(removed).toBe(3);
		});

		test("handles empty checkpoint directory", () => {
			const removed = cleanupOldCheckpoints();
			expect(removed).toBe(0);
		});

		test("handles nonexistent checkpoint directory", () => {
			// Don't create any checkpoints, directory won't exist
			const removed = cleanupOldCheckpoints();
			expect(removed).toBe(0);
		});

		test("preserves checkpoints within maxAge window", async () => {
			writeFileSync(join(projectDir, "file.ts"), "content");

			captureCheckpoint("session", "keep-1", ["**/*.ts"]);
			captureCheckpoint("session", "keep-2", ["**/*.ts"]);

			// Cleanup with very long maxAge
			const removed = cleanupOldCheckpoints(86400000); // 24 hours

			expect(removed).toBe(0);
			expect(loadCheckpoint("session", "keep-1")).not.toBeNull();
			expect(loadCheckpoint("session", "keep-2")).not.toBeNull();
		});

		test("handles both session and agent checkpoints", () => {
			writeFileSync(join(projectDir, "file.ts"), "content");

			// Create old checkpoints of both types
			captureCheckpoint("session", "old-session", ["**/*.ts"]);
			captureCheckpoint("agent", "old-agent", ["**/*.ts"]);

			// Explicitly set old checkpoints to have old mtime (1 second ago)
			const oldTime = new Date(Date.now() - 1000);
			utimesSync(getCheckpointPath("session", "old-session"), oldTime, oldTime);
			utimesSync(getCheckpointPath("agent", "old-agent"), oldTime, oldTime);

			// Create new ones (they will have current mtime)
			captureCheckpoint("session", "new-session", ["**/*.ts"]);
			captureCheckpoint("agent", "new-agent", ["**/*.ts"]);

			// Cleanup old ones (500ms threshold - old files are 1s old, new files are ~0ms old)
			const removed = cleanupOldCheckpoints(500);

			expect(removed).toBe(2);
			expect(loadCheckpoint("session", "old-session")).toBeNull();
			expect(loadCheckpoint("agent", "old-agent")).toBeNull();
			expect(loadCheckpoint("session", "new-session")).not.toBeNull();
			expect(loadCheckpoint("agent", "new-agent")).not.toBeNull();
		});
	});

	describe("listCheckpoints", () => {
		test("returns empty array when no checkpoints exist", () => {
			const result = listCheckpoints();
			expect(result).toEqual([]);
		});

		test("lists all checkpoints in directory", () => {
			writeFileSync(join(projectDir, "file.ts"), "content");

			captureCheckpoint("session", "session-1", ["**/*.ts"]);
			captureCheckpoint("session", "session-2", ["**/*.ts"]);
			captureCheckpoint("agent", "agent-1", ["**/*.ts"]);

			const result = listCheckpoints();

			expect(result.length).toBe(3);
			expect(result.map((c) => c.id).sort()).toEqual([
				"agent-1",
				"session-1",
				"session-2",
			]);
		});

		test("includes correct metadata for session checkpoints", () => {
			writeFileSync(join(projectDir, "file1.ts"), "content1");
			writeFileSync(join(projectDir, "file2.ts"), "content2");

			captureCheckpoint("session", "metadata-test", ["**/*.ts"]);

			const result = listCheckpoints();

			expect(result.length).toBe(1);
			expect(result[0].type).toBe("session");
			expect(result[0].id).toBe("metadata-test");
			expect(result[0].fileCount).toBe(2);
			expect(result[0].createdAt).toBeDefined();
			expect(result[0].path).toContain("checkpoint.json");
		});

		test("includes correct metadata for agent checkpoints", () => {
			writeFileSync(join(projectDir, "file.ts"), "content");

			captureCheckpoint("agent", "agent-test", ["**/*.ts"]);

			const result = listCheckpoints();

			expect(result.length).toBe(1);
			expect(result[0].type).toBe("agent");
			expect(result[0].id).toBe("agent-test");
			expect(result[0].path).toContain("agent-agent-test");
		});

		test("sorts checkpoints by creation time, newest first", async () => {
			writeFileSync(join(projectDir, "file.ts"), "content");

			captureCheckpoint("session", "oldest", ["**/*.ts"]);
			await new Promise((resolve) => setTimeout(resolve, 50));
			captureCheckpoint("session", "middle", ["**/*.ts"]);
			await new Promise((resolve) => setTimeout(resolve, 50));
			captureCheckpoint("session", "newest", ["**/*.ts"]);

			const result = listCheckpoints();

			expect(result.length).toBe(3);
			expect(result[0].id).toBe("newest");
			expect(result[1].id).toBe("middle");
			expect(result[2].id).toBe("oldest");
		});
	});

	describe("subdirectory path matching", () => {
		test("correctly compares files in subdirectory against project-root checkpoint", () => {
			// Create files in a subdirectory (simulating packages/han/lib structure)
			const subDir = join(projectDir, "packages", "core");
			mkdirSync(subDir, { recursive: true });
			writeFileSync(join(subDir, "index.ts"), "original content");
			writeFileSync(join(subDir, "utils.ts"), "helper content");

			// Capture checkpoint at project root (how SessionStart captures it)
			captureCheckpoint("session", "subdir-test", ["**/*.ts"]);
			const checkpoint = loadCheckpoint("session", "subdir-test");

			if (!checkpoint) throw new Error("Checkpoint should exist");

			// Verify checkpoint has project-root-relative paths
			expect(checkpoint.files["packages/core/index.ts"]).toBeDefined();
			expect(checkpoint.files["packages/core/utils.ts"]).toBeDefined();

			// Check for changes from subdirectory - should return false (no changes)
			const hasChanges = hasChangedSinceCheckpoint(checkpoint, subDir, [
				"**/*.ts",
			]);
			expect(hasChanges).toBe(false);
		});

		test("detects changes in subdirectory when comparing against project-root checkpoint", () => {
			// Create files in a subdirectory
			const subDir = join(projectDir, "packages", "core");
			mkdirSync(subDir, { recursive: true });
			writeFileSync(join(subDir, "index.ts"), "original content");

			// Capture checkpoint at project root
			captureCheckpoint("session", "subdir-change", ["**/*.ts"]);
			const checkpoint = loadCheckpoint("session", "subdir-change");

			if (!checkpoint) throw new Error("Checkpoint should exist");

			// Modify file in subdirectory
			writeFileSync(join(subDir, "index.ts"), "modified content");

			// Check for changes from subdirectory - should return true
			const hasChanges = hasChangedSinceCheckpoint(checkpoint, subDir, [
				"**/*.ts",
			]);
			expect(hasChanges).toBe(true);
		});

		test("handles checking subdirectory when checkpoint has files from multiple directories", () => {
			// Create files in multiple subdirectories
			const coreDir = join(projectDir, "packages", "core");
			const webDir = join(projectDir, "packages", "web");
			mkdirSync(coreDir, { recursive: true });
			mkdirSync(webDir, { recursive: true });
			writeFileSync(join(coreDir, "index.ts"), "core content");
			writeFileSync(join(webDir, "app.ts"), "web content");

			// Capture checkpoint at project root (includes both directories)
			captureCheckpoint("session", "multi-dir", ["**/*.ts"]);
			const checkpoint = loadCheckpoint("session", "multi-dir");

			if (!checkpoint) throw new Error("Checkpoint should exist");

			// Modify only web directory
			writeFileSync(join(webDir, "app.ts"), "modified web content");

			// Check core directory - should return false (core unchanged)
			const coreHasChanges = hasChangedSinceCheckpoint(checkpoint, coreDir, [
				"**/*.ts",
			]);
			expect(coreHasChanges).toBe(false);

			// Check web directory - should return true (web changed)
			const webHasChanges = hasChangedSinceCheckpoint(checkpoint, webDir, [
				"**/*.ts",
			]);
			expect(webHasChanges).toBe(true);
		});
	});

	describe("subdirectory edge cases", () => {
		test("handles deeply nested subdirectory", () => {
			// Create deeply nested structure
			const deepDir = join(projectDir, "packages", "core", "lib", "utils");
			mkdirSync(deepDir, { recursive: true });
			writeFileSync(join(deepDir, "helper.ts"), "deep content");

			// Capture at project root
			captureCheckpoint("session", "deep-nested", ["**/*.ts"]);
			const checkpoint = loadCheckpoint("session", "deep-nested");

			if (!checkpoint) throw new Error("Checkpoint should exist");
			expect(
				checkpoint.files["packages/core/lib/utils/helper.ts"],
			).toBeDefined();

			// Check from deep subdirectory - no changes
			const hasChanges = hasChangedSinceCheckpoint(checkpoint, deepDir, [
				"**/*.ts",
			]);
			expect(hasChanges).toBe(false);
		});

		test("detects new file added in subdirectory after checkpoint", () => {
			const subDir = join(projectDir, "packages", "core");
			mkdirSync(subDir, { recursive: true });
			writeFileSync(join(subDir, "existing.ts"), "existing");

			captureCheckpoint("session", "new-file-subdir", ["**/*.ts"]);
			const checkpoint = loadCheckpoint("session", "new-file-subdir");

			if (!checkpoint) throw new Error("Checkpoint should exist");

			// Add new file in subdirectory
			writeFileSync(join(subDir, "new.ts"), "new content");

			const hasChanges = hasChangedSinceCheckpoint(checkpoint, subDir, [
				"**/*.ts",
			]);
			expect(hasChanges).toBe(true);
		});

		test("detects file deleted from subdirectory after checkpoint", () => {
			const subDir = join(projectDir, "packages", "core");
			mkdirSync(subDir, { recursive: true });
			writeFileSync(join(subDir, "keep.ts"), "keep");
			writeFileSync(join(subDir, "delete.ts"), "delete");

			captureCheckpoint("session", "delete-file-subdir", ["**/*.ts"]);
			const checkpoint = loadCheckpoint("session", "delete-file-subdir");

			if (!checkpoint) throw new Error("Checkpoint should exist");

			// Delete file from subdirectory
			rmSync(join(subDir, "delete.ts"));

			const hasChanges = hasChangedSinceCheckpoint(checkpoint, subDir, [
				"**/*.ts",
			]);
			expect(hasChanges).toBe(true);
		});

		test("returns no changes when subdirectory not in checkpoint", () => {
			// Create file only at root
			writeFileSync(join(projectDir, "root.ts"), "root content");

			captureCheckpoint("session", "root-only", ["**/*.ts"]);
			const checkpoint = loadCheckpoint("session", "root-only");

			if (!checkpoint) throw new Error("Checkpoint should exist");

			// Create new subdirectory that wasn't in checkpoint
			const newDir = join(projectDir, "packages", "new");
			mkdirSync(newDir, { recursive: true });

			// Check empty subdirectory - checkpoint had no files there
			// This should return false (no changes - 0 files matched in both)
			const hasChanges = hasChangedSinceCheckpoint(checkpoint, newDir, [
				"**/*.ts",
			]);
			expect(hasChanges).toBe(false);
		});

		test("handles checking project root after subdirectory checkpoint", () => {
			// Create files in subdirectory
			const subDir = join(projectDir, "packages", "core");
			mkdirSync(subDir, { recursive: true });
			writeFileSync(join(subDir, "index.ts"), "content");

			// Capture at project root
			captureCheckpoint("session", "root-check", ["**/*.ts"]);
			const checkpoint = loadCheckpoint("session", "root-check");

			if (!checkpoint) throw new Error("Checkpoint should exist");

			// Check from project root (same as checkpoint) - no changes
			const hasChanges = hasChangedSinceCheckpoint(checkpoint, projectDir, [
				"**/*.ts",
			]);
			expect(hasChanges).toBe(false);
		});
	});

	describe("integration scenarios", () => {
		test("full session checkpoint workflow", () => {
			// Setup initial files
			writeFileSync(join(projectDir, "index.ts"), "initial");
			writeFileSync(join(projectDir, "utils.ts"), "helpers");

			// Capture checkpoint at session start
			captureCheckpoint("session", "main-session", ["**/*.ts"]);

			// No changes - should return false
			const checkpoint = loadCheckpoint("session", "main-session");
			if (!checkpoint) throw new Error("Checkpoint should exist");
			expect(
				hasChangedSinceCheckpoint(checkpoint, projectDir, ["**/*.ts"]),
			).toBe(false);

			// Make changes
			writeFileSync(join(projectDir, "index.ts"), "modified");

			// Should detect changes
			expect(
				hasChangedSinceCheckpoint(checkpoint, projectDir, ["**/*.ts"]),
			).toBe(true);
		});

		test("agent checkpoint workflow", () => {
			// Setup project
			writeFileSync(join(projectDir, "code.ts"), "code");

			// Capture checkpoint at agent start
			captureCheckpoint("agent", "dev-agent", ["**/*.ts"]);

			// Agent makes changes
			writeFileSync(join(projectDir, "code.ts"), "updated code");
			writeFileSync(join(projectDir, "new.ts"), "new file");

			// Should detect changes
			const checkpoint = loadCheckpoint("agent", "dev-agent");
			if (!checkpoint) throw new Error("Checkpoint should exist");
			expect(
				hasChangedSinceCheckpoint(checkpoint, projectDir, ["**/*.ts"]),
			).toBe(true);
		});

		test("cleanup workflow after session end", async () => {
			writeFileSync(join(projectDir, "file.ts"), "content");

			// Create session checkpoint
			captureCheckpoint("session", "ended-session", ["**/*.ts"]);

			// Simulate time passing
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Cleanup old sessions
			const removed = cleanupOldCheckpoints(50);

			expect(removed).toBeGreaterThan(0);
			expect(loadCheckpoint("session", "ended-session")).toBeNull();
		});
	});
});
