/**
 * Unit tests for checkpoint.ts
 * Tests checkpoint capture, loading, change detection, and cleanup
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
	captureCheckpoint,
	cleanupOldCheckpoints,
	getCheckpointDir,
	getCheckpointPath,
	hasChangedSinceCheckpoint,
	loadCheckpoint,
} from "../lib/checkpoint.ts";

// Store original environment
const originalEnv = { ...process.env };

let testDir: string;
let configDir: string;
let projectDir: string;

function setup(): void {
	const random = Math.random().toString(36).substring(2, 9);
	testDir = join(tmpdir(), `han-checkpoint-test-${Date.now()}-${random}`);
	configDir = join(testDir, ".claude");
	projectDir = join(testDir, "project");
	mkdirSync(configDir, { recursive: true });
	mkdirSync(projectDir, { recursive: true });

	process.env.CLAUDE_CONFIG_DIR = configDir;
	process.env.CLAUDE_PROJECT_DIR = projectDir;
}

function teardown(): void {
	process.env = { ...originalEnv };

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

	describe("getCheckpointDir", () => {
		test("returns correct checkpoint directory path", () => {
			const result = getCheckpointDir();
			expect(result).toContain("/projects/");
			expect(result).toContain("/han/checkpoints");
		});

		test("path includes project slug", () => {
			const result = getCheckpointDir();
			// Should contain the slugified project path
			expect(result).toMatch(/projects\/.*\/han\/checkpoints$/);
		});
	});

	describe("getCheckpointPath", () => {
		test("returns correct path for session checkpoint", () => {
			const result = getCheckpointPath("session", "session-123");
			expect(result).toContain("checkpoints");
			expect(result).toContain("session_session-123.json");
		});

		test("returns correct path for agent checkpoint", () => {
			const result = getCheckpointPath("agent", "agent-456");
			expect(result).toContain("checkpoints");
			expect(result).toContain("agent_agent-456.json");
		});

		test("sanitizes checkpoint ID", () => {
			const result = getCheckpointPath("session", "id/with/slashes");
			expect(result).toContain("session_id_with_slashes.json");
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
		test("removes checkpoints older than maxAge", async () => {
			// Create old checkpoint
			writeFileSync(join(projectDir, "file.ts"), "content");
			captureCheckpoint("session", "old-checkpoint", ["**/*.ts"]);

			// Wait a bit then create new checkpoint
			await new Promise((resolve) => setTimeout(resolve, 100));
			captureCheckpoint("session", "new-checkpoint", ["**/*.ts"]);

			// Cleanup checkpoints older than 50ms
			const removed = cleanupOldCheckpoints(50);

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

		test("returns count of removed checkpoints", async () => {
			writeFileSync(join(projectDir, "file.ts"), "content");

			// Create multiple old checkpoints
			captureCheckpoint("session", "old-1", ["**/*.ts"]);
			captureCheckpoint("session", "old-2", ["**/*.ts"]);
			captureCheckpoint("agent", "old-3", ["**/*.ts"]);

			await new Promise((resolve) => setTimeout(resolve, 100));

			// Cleanup
			const removed = cleanupOldCheckpoints(50);

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

		test("handles both session and agent checkpoints", async () => {
			writeFileSync(join(projectDir, "file.ts"), "content");

			// Create old checkpoints of both types
			captureCheckpoint("session", "old-session", ["**/*.ts"]);
			captureCheckpoint("agent", "old-agent", ["**/*.ts"]);

			await new Promise((resolve) => setTimeout(resolve, 100));

			// Create new ones
			captureCheckpoint("session", "new-session", ["**/*.ts"]);
			captureCheckpoint("agent", "new-agent", ["**/*.ts"]);

			// Cleanup old ones
			const removed = cleanupOldCheckpoints(50);

			expect(removed).toBe(2);
			expect(loadCheckpoint("session", "old-session")).toBeNull();
			expect(loadCheckpoint("agent", "old-agent")).toBeNull();
			expect(loadCheckpoint("session", "new-session")).not.toBeNull();
			expect(loadCheckpoint("agent", "new-agent")).not.toBeNull();
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
