/**
 * Unit tests for hook-cache.ts
 * Tests file caching, manifest operations, and directory scanning
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
	buildManifest,
	type CacheManifest,
	checkForChanges,
	computeFileHash,
	findDirectoriesWithMarkers,
	findFilesWithGlob,
	getCacheDir,
	getCacheFilePath,
	getProjectRoot,
	loadCacheManifest,
	saveCacheManifest,
	trackFiles,
} from "../lib/hooks/index.ts";

// Store original environment
const originalEnv = { ...process.env };

let testDir: string;
let configDir: string;
let projectDir: string;

function setup(): void {
	const random = Math.random().toString(36).substring(2, 9);
	testDir = join(tmpdir(), `han-hook-cache-test-${Date.now()}-${random}`);
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

describe("hook-cache.ts", () => {
	beforeEach(() => {
		setup();
	});

	afterEach(() => {
		teardown();
	});

	describe("getProjectRoot", () => {
		test("returns CLAUDE_PROJECT_DIR when set", () => {
			process.env.CLAUDE_PROJECT_DIR = "/custom/project";
			const result = getProjectRoot();
			expect(result).toBe("/custom/project");
		});

		test("returns cwd when CLAUDE_PROJECT_DIR not set", () => {
			delete process.env.CLAUDE_PROJECT_DIR;
			const result = getProjectRoot();
			expect(result).toBe(process.cwd());
		});
	});

	describe("getCacheDir", () => {
		test("returns correct cache directory path", () => {
			const result = getCacheDir();
			expect(result).toContain("/repos/");
			expect(result).toContain("/cache");
		});
	});

	describe("getCacheFilePath", () => {
		test("returns correct cache file path", () => {
			const result = getCacheFilePath("jutsu-biome", "lint");
			expect(result).toContain("jutsu-biome_lint.json");
		});

		test("sanitizes plugin name with slashes", () => {
			const result = getCacheFilePath("org/plugin", "hook");
			expect(result).toContain("org_plugin_hook.json");
		});
	});

	describe("computeFileHash", () => {
		test("computes hash of file contents", () => {
			const filePath = join(projectDir, "test-file.txt");
			writeFileSync(filePath, "test content");

			const hash = computeFileHash(filePath);

			expect(hash).toBeDefined();
			expect(typeof hash).toBe("string");
			expect(hash.length).toBeGreaterThan(0);
		});

		test("returns different hashes for different content", () => {
			const file1 = join(projectDir, "file1.txt");
			const file2 = join(projectDir, "file2.txt");
			writeFileSync(file1, "content one");
			writeFileSync(file2, "content two");

			const hash1 = computeFileHash(file1);
			const hash2 = computeFileHash(file2);

			expect(hash1).not.toBe(hash2);
		});

		test("returns same hash for same content", () => {
			const file1 = join(projectDir, "same1.txt");
			const file2 = join(projectDir, "same2.txt");
			writeFileSync(file1, "identical");
			writeFileSync(file2, "identical");

			const hash1 = computeFileHash(file1);
			const hash2 = computeFileHash(file2);

			expect(hash1).toBe(hash2);
		});
	});

	describe("loadCacheManifest and saveCacheManifest", () => {
		test("returns null when cache does not exist", () => {
			const result = loadCacheManifest(
				"nonexistent-plugin",
				"nonexistent-hook",
			);
			expect(result).toBeNull();
		});

		test("saves and loads cache manifest", () => {
			const manifest: CacheManifest = {
				"src/index.ts": "abc123",
				"src/utils.ts": "def456",
			};

			const saved = saveCacheManifest("test-plugin", "test-hook", manifest);
			expect(saved).toBe(true);

			const loaded = loadCacheManifest("test-plugin", "test-hook");
			expect(loaded).toEqual(manifest);
		});

		test("creates cache directory if needed", () => {
			const manifest: CacheManifest = { "file.ts": "hash" };

			const saved = saveCacheManifest("new-plugin", "new-hook", manifest);
			expect(saved).toBe(true);

			const cachePath = getCacheFilePath("new-plugin", "new-hook");
			expect(existsSync(cachePath)).toBe(true);
		});

		test("returns null for invalid JSON in cache file", () => {
			const cachePath = getCacheFilePath("invalid-plugin", "invalid-hook");
			const cacheDir = join(cachePath, "..");
			mkdirSync(cacheDir, { recursive: true });
			writeFileSync(cachePath, "not valid json");

			const result = loadCacheManifest("invalid-plugin", "invalid-hook");
			expect(result).toBeNull();
		});

		test("saves empty manifest", () => {
			const manifest: CacheManifest = {};

			const saved = saveCacheManifest("empty-plugin", "empty-hook", manifest);
			expect(saved).toBe(true);

			const loaded = loadCacheManifest("empty-plugin", "empty-hook");
			expect(loaded).toEqual({});
		});

		test("overwrites existing cache manifest", () => {
			const manifest1: CacheManifest = { "old.ts": "old-hash" };
			const manifest2: CacheManifest = { "new.ts": "new-hash" };

			saveCacheManifest("overwrite-plugin", "overwrite-hook", manifest1);
			const loaded1 = loadCacheManifest("overwrite-plugin", "overwrite-hook");
			expect(loaded1).toEqual(manifest1);

			saveCacheManifest("overwrite-plugin", "overwrite-hook", manifest2);
			const loaded2 = loadCacheManifest("overwrite-plugin", "overwrite-hook");
			expect(loaded2).toEqual(manifest2);
		});

		test("handles manifest with special characters in paths", () => {
			const manifest: CacheManifest = {
				"src/file-with-dashes.ts": "hash1",
				"src/file with spaces.ts": "hash2",
				"src/file.spec.ts": "hash3",
			};

			const saved = saveCacheManifest(
				"special-plugin",
				"special-hook",
				manifest,
			);
			expect(saved).toBe(true);

			const loaded = loadCacheManifest("special-plugin", "special-hook");
			expect(loaded).toEqual(manifest);
		});

		test("returns null for empty file", () => {
			const cachePath = getCacheFilePath(
				"empty-file-plugin",
				"empty-file-hook",
			);
			const cacheDir = join(cachePath, "..");
			mkdirSync(cacheDir, { recursive: true });
			writeFileSync(cachePath, "");

			const result = loadCacheManifest("empty-file-plugin", "empty-file-hook");
			expect(result).toBeNull();
		});
	});

	describe("findFilesWithGlob", () => {
		test("finds files matching glob pattern", () => {
			mkdirSync(join(projectDir, "src"), { recursive: true });
			writeFileSync(join(projectDir, "src", "index.ts"), "");
			writeFileSync(join(projectDir, "src", "utils.ts"), "");
			writeFileSync(join(projectDir, "README.md"), "");

			const files = findFilesWithGlob(projectDir, ["**/*.ts"]);

			expect(files.length).toBe(2);
			expect(files.some((f) => f.includes("index.ts"))).toBe(true);
			expect(files.some((f) => f.includes("utils.ts"))).toBe(true);
		});

		test("handles multiple patterns", () => {
			writeFileSync(join(projectDir, "index.ts"), "");
			writeFileSync(join(projectDir, "utils.ts"), "");
			writeFileSync(join(projectDir, "style.css"), "");

			const files = findFilesWithGlob(projectDir, ["**/*.ts", "**/*.css"]);

			expect(files.length).toBe(3);
		});

		test("returns empty array for no matches", () => {
			const files = findFilesWithGlob(projectDir, ["**/*.xyz"]);
			expect(files).toEqual([]);
		});

		test("handles nested directories", () => {
			mkdirSync(join(projectDir, "src", "utils", "helpers"), {
				recursive: true,
			});
			writeFileSync(join(projectDir, "src", "index.ts"), "");
			writeFileSync(join(projectDir, "src", "utils", "logger.ts"), "");
			writeFileSync(
				join(projectDir, "src", "utils", "helpers", "format.ts"),
				"",
			);

			const files = findFilesWithGlob(projectDir, ["**/*.ts"]);

			expect(files.length).toBe(3);
		});

		test("respects gitignore", () => {
			// Initialize git repo
			mkdirSync(join(projectDir, ".git"), { recursive: true });
			writeFileSync(join(projectDir, ".gitignore"), "ignored.ts\n");

			writeFileSync(join(projectDir, "included.ts"), "");
			writeFileSync(join(projectDir, "ignored.ts"), "");

			const files = findFilesWithGlob(projectDir, ["**/*.ts"]);

			expect(files.length).toBe(1);
			expect(files[0]).toContain("included.ts");
		});

		test("handles empty directory", () => {
			const emptyDir = join(projectDir, "empty");
			mkdirSync(emptyDir, { recursive: true });

			const files = findFilesWithGlob(emptyDir, ["**/*.ts"]);

			expect(files).toEqual([]);
		});

		test("handles specific file patterns", () => {
			writeFileSync(join(projectDir, "index.ts"), "");
			writeFileSync(join(projectDir, "index.test.ts"), "");
			writeFileSync(join(projectDir, "utils.ts"), "");

			const files = findFilesWithGlob(projectDir, ["**/*.test.ts"]);

			expect(files.length).toBe(1);
			expect(files[0]).toContain("index.test.ts");
		});
	});

	describe("buildManifest", () => {
		test("builds manifest from files", () => {
			writeFileSync(join(projectDir, "file1.ts"), "content1");
			writeFileSync(join(projectDir, "file2.ts"), "content2");

			// Use findFilesWithGlob to get canonical paths
			const files = findFilesWithGlob(projectDir, ["**/*.ts"]);
			// Get the canonical projectDir from the first file path
			const canonicalProjectDir = files[0]
				.replace("/file1.ts", "")
				.replace("/file2.ts", "");

			const manifest = buildManifest(files, canonicalProjectDir);

			expect(Object.keys(manifest).length).toBe(2);
			// Manifest keys are relative paths
			expect(manifest["file1.ts"]).toBeDefined();
			expect(manifest["file2.ts"]).toBeDefined();
		});

		test("returns empty manifest for empty file list", () => {
			const manifest = buildManifest([], projectDir);
			expect(manifest).toEqual({});
		});

		test("builds manifest with nested file paths", () => {
			mkdirSync(join(projectDir, "src"), { recursive: true });
			writeFileSync(join(projectDir, "src", "index.ts"), "content");

			const files = findFilesWithGlob(projectDir, ["**/*.ts"]);
			const canonicalProjectDir = files[0].replace("/src/index.ts", "");

			const manifest = buildManifest(files, canonicalProjectDir);

			expect(Object.keys(manifest).length).toBe(1);
			expect(manifest["src/index.ts"]).toBeDefined();
		});

		test("generates different hashes for different content", () => {
			writeFileSync(join(projectDir, "a.ts"), "content a");
			writeFileSync(join(projectDir, "b.ts"), "content b");

			const files = findFilesWithGlob(projectDir, ["**/*.ts"]);
			const canonicalProjectDir = files[0]
				.replace("/a.ts", "")
				.replace("/b.ts", "");

			const manifest = buildManifest(files, canonicalProjectDir);

			expect(manifest["a.ts"]).not.toBe(manifest["b.ts"]);
		});

		test("generates same hash for identical content", () => {
			writeFileSync(join(projectDir, "x.ts"), "same content");
			writeFileSync(join(projectDir, "y.ts"), "same content");

			const files = findFilesWithGlob(projectDir, ["**/*.ts"]);
			const canonicalProjectDir = files[0]
				.replace("/x.ts", "")
				.replace("/y.ts", "");

			const manifest = buildManifest(files, canonicalProjectDir);

			expect(manifest["x.ts"]).toBe(manifest["y.ts"]);
		});
	});

	describe("trackFiles", () => {
		test("tracks project files and saves manifest", () => {
			writeFileSync(join(projectDir, "index.ts"), "content");

			const result = trackFiles("test-plugin", "test-hook", projectDir, [
				"**/*.ts",
			]);

			expect(result).toBe(true);

			const manifest = loadCacheManifest("test-plugin", "test-hook");
			expect(manifest).not.toBeNull();
		});

		test("includes han-config.yml in tracked patterns", () => {
			writeFileSync(join(projectDir, "han-config.yml"), "test: true");

			const result = trackFiles("test-plugin", "test-hook", projectDir, [
				"**/*.ts",
			]);

			expect(result).toBe(true);

			const manifest = loadCacheManifest("test-plugin", "test-hook");
			expect(manifest).not.toBeNull();
			// The manifest should include han-config.yml even though we only specified *.ts
		});

		test("tracks plugin files when pluginRoot provided", () => {
			const pluginDir = join(testDir, "plugin");
			mkdirSync(pluginDir, { recursive: true });
			writeFileSync(join(pluginDir, "plugin.json"), "{}");
			writeFileSync(join(projectDir, "index.ts"), "");

			const result = trackFiles(
				"test-plugin",
				"test-hook",
				projectDir,
				["**/*.ts"],
				pluginDir,
			);

			expect(result).toBe(true);

			// Should have both project and plugin manifests
			const projectManifest = loadCacheManifest("test-plugin", "test-hook");
			const pluginManifest = loadCacheManifest("test-plugin", "__plugin__");
			expect(projectManifest).not.toBeNull();
			expect(pluginManifest).not.toBeNull();
		});

		test("tracks empty project directory", () => {
			const result = trackFiles("empty-plugin", "empty-hook", projectDir, [
				"**/*.ts",
			]);

			expect(result).toBe(true);

			const manifest = loadCacheManifest("empty-plugin", "empty-hook");
			expect(manifest).not.toBeNull();
		});

		test("tracks multiple file types", () => {
			writeFileSync(join(projectDir, "index.ts"), "ts content");
			writeFileSync(join(projectDir, "style.css"), "css content");
			writeFileSync(join(projectDir, "README.md"), "md content");

			const result = trackFiles("multi-plugin", "multi-hook", projectDir, [
				"**/*.ts",
				"**/*.css",
				"**/*.md",
			]);

			expect(result).toBe(true);

			const manifest = loadCacheManifest("multi-plugin", "multi-hook");
			expect(manifest).not.toBeNull();
			if (manifest) {
				const keys = Object.keys(manifest);
				expect(keys.some((k) => k.includes("index.ts"))).toBe(true);
				expect(keys.some((k) => k.includes("style.css"))).toBe(true);
				expect(keys.some((k) => k.includes("README.md"))).toBe(true);
			}
		});

		test("updates manifest on subsequent tracks", () => {
			writeFileSync(join(projectDir, "file.ts"), "original");

			trackFiles("update-plugin", "update-hook", projectDir, ["**/*.ts"]);
			const manifest1 = loadCacheManifest("update-plugin", "update-hook");

			writeFileSync(join(projectDir, "file.ts"), "modified");

			trackFiles("update-plugin", "update-hook", projectDir, ["**/*.ts"]);
			const manifest2 = loadCacheManifest("update-plugin", "update-hook");

			expect(manifest1).not.toEqual(manifest2);
		});
	});

	describe("checkForChanges", () => {
		test("returns true when no cache exists", () => {
			writeFileSync(join(projectDir, "index.ts"), "content");

			const result = checkForChanges(
				"uncached-plugin",
				"uncached-hook",
				projectDir,
				["**/*.ts"],
			);

			expect(result).toBe(true);
		});

		test("returns false when no changes since last track", () => {
			writeFileSync(join(projectDir, "index.ts"), "content");

			// Track first
			trackFiles("track-plugin", "track-hook", projectDir, ["**/*.ts"]);

			// Check for changes - should be false since nothing changed
			const result = checkForChanges("track-plugin", "track-hook", projectDir, [
				"**/*.ts",
			]);

			expect(result).toBe(false);
		});

		test("returns true when file content changed", () => {
			const filePath = join(projectDir, "index.ts");
			writeFileSync(filePath, "original content");

			// Track first
			trackFiles("change-plugin", "change-hook", projectDir, ["**/*.ts"]);

			// Modify file
			writeFileSync(filePath, "modified content");

			// Check for changes - should be true
			const result = checkForChanges(
				"change-plugin",
				"change-hook",
				projectDir,
				["**/*.ts"],
			);

			expect(result).toBe(true);
		});

		test("returns true when new file added", () => {
			writeFileSync(join(projectDir, "index.ts"), "content");

			// Track first
			trackFiles("add-plugin", "add-hook", projectDir, ["**/*.ts"]);

			// Add new file
			writeFileSync(join(projectDir, "new.ts"), "new content");

			// Check for changes - should be true
			const result = checkForChanges("add-plugin", "add-hook", projectDir, [
				"**/*.ts",
			]);

			expect(result).toBe(true);
		});

		test("checks plugin files when pluginRoot provided", () => {
			const pluginDir = join(testDir, "plugin");
			mkdirSync(pluginDir, { recursive: true });
			writeFileSync(join(pluginDir, "plugin.json"), "{}");
			writeFileSync(join(projectDir, "index.ts"), "");

			// Track first
			trackFiles("plugin-change", "hook", projectDir, ["**/*.ts"], pluginDir);

			// Modify plugin file
			writeFileSync(join(pluginDir, "plugin.json"), '{"modified": true}');

			// Check for changes - should be true due to plugin change
			const result = checkForChanges(
				"plugin-change",
				"hook",
				projectDir,
				["**/*.ts"],
				pluginDir,
			);

			expect(result).toBe(true);
		});

		test("returns false when plugin files unchanged", () => {
			const pluginDir = join(testDir, "plugin");
			mkdirSync(pluginDir, { recursive: true });
			writeFileSync(join(pluginDir, "plugin.json"), "{}");
			writeFileSync(join(projectDir, "index.ts"), "");

			// Track first
			trackFiles(
				"plugin-no-change",
				"hook",
				projectDir,
				["**/*.ts"],
				pluginDir,
			);

			// Check without any changes
			const result = checkForChanges(
				"plugin-no-change",
				"hook",
				projectDir,
				["**/*.ts"],
				pluginDir,
			);

			expect(result).toBe(false);
		});

		test("returns true when file is deleted", () => {
			const filePath = join(projectDir, "temp.ts");
			writeFileSync(filePath, "content");

			// Track first
			trackFiles("delete-plugin", "delete-hook", projectDir, ["**/*.ts"]);

			// Delete file
			rmSync(filePath);

			// Check for changes - should be true
			const result = checkForChanges(
				"delete-plugin",
				"delete-hook",
				projectDir,
				["**/*.ts"],
			);

			expect(result).toBe(true);
		});

		test("returns false for empty project with no changes", () => {
			// Create han-config.yml so it's in the manifest
			writeFileSync(join(projectDir, "han-config.yml"), "");

			// Track empty directory (with only han-config.yml)
			trackFiles("empty-check", "empty-hook", projectDir, ["**/*.ts"]);

			// Check with no changes
			const result = checkForChanges("empty-check", "empty-hook", projectDir, [
				"**/*.ts",
			]);

			expect(result).toBe(false);
		});

		test("detects changes in nested directories", () => {
			mkdirSync(join(projectDir, "src"), { recursive: true });
			writeFileSync(join(projectDir, "src", "index.ts"), "original");

			// Track first
			trackFiles("nested-plugin", "nested-hook", projectDir, ["**/*.ts"]);

			// Modify nested file
			writeFileSync(join(projectDir, "src", "index.ts"), "modified");

			// Check for changes - should be true
			const result = checkForChanges(
				"nested-plugin",
				"nested-hook",
				projectDir,
				["**/*.ts"],
			);

			expect(result).toBe(true);
		});

		test("returns false when only non-tracked files change", () => {
			writeFileSync(join(projectDir, "index.ts"), "ts content");
			writeFileSync(join(projectDir, "README.md"), "readme");

			// Only track TS files
			trackFiles("selective-plugin", "selective-hook", projectDir, ["**/*.ts"]);

			// Modify non-tracked file
			writeFileSync(join(projectDir, "README.md"), "updated readme");

			// Check for changes - should be false (only tracked .ts)
			const result = checkForChanges(
				"selective-plugin",
				"selective-hook",
				projectDir,
				["**/*.ts"],
			);

			expect(result).toBe(false);
		});

		test("handles han-config.yml changes", () => {
			writeFileSync(join(projectDir, "index.ts"), "content");
			writeFileSync(join(projectDir, "han-config.yml"), "config: true");

			// Track (han-config.yml automatically included)
			trackFiles("config-plugin", "config-hook", projectDir, ["**/*.ts"]);

			// Modify han-config.yml
			writeFileSync(join(projectDir, "han-config.yml"), "config: false");

			// Check for changes - should be true
			const result = checkForChanges(
				"config-plugin",
				"config-hook",
				projectDir,
				["**/*.ts"],
			);

			expect(result).toBe(true);
		});
	});

	describe("findDirectoriesWithMarkers", () => {
		test("finds directories containing marker files", () => {
			const pkg1 = join(projectDir, "packages", "core");
			const pkg2 = join(projectDir, "packages", "utils");
			mkdirSync(pkg1, { recursive: true });
			mkdirSync(pkg2, { recursive: true });
			writeFileSync(join(pkg1, "package.json"), "{}");
			writeFileSync(join(pkg2, "package.json"), "{}");

			const result = findDirectoriesWithMarkers(projectDir, ["package.json"]);

			expect(result.length).toBe(2);
		});

		test("finds root directory if marker at root", () => {
			writeFileSync(join(projectDir, "Cargo.toml"), "");

			const result = findDirectoriesWithMarkers(projectDir, ["Cargo.toml"]);

			expect(result.length).toBe(1);
		});

		test("handles multiple marker patterns", () => {
			const dir1 = join(projectDir, "js-project");
			const dir2 = join(projectDir, "rust-project");
			mkdirSync(dir1, { recursive: true });
			mkdirSync(dir2, { recursive: true });
			writeFileSync(join(dir1, "package.json"), "{}");
			writeFileSync(join(dir2, "Cargo.toml"), "");

			const result = findDirectoriesWithMarkers(projectDir, [
				"package.json",
				"Cargo.toml",
			]);

			expect(result.length).toBe(2);
		});

		test("returns empty array when no markers found", () => {
			const result = findDirectoriesWithMarkers(projectDir, [
				"nonexistent.marker",
			]);
			expect(result).toEqual([]);
		});

		test("respects gitignore patterns", () => {
			// Initialize git repo
			mkdirSync(join(projectDir, ".git"), { recursive: true });
			writeFileSync(join(projectDir, ".gitignore"), "ignored/\n");

			// Create ignored directory with marker
			const ignored = join(projectDir, "ignored");
			mkdirSync(ignored, { recursive: true });
			writeFileSync(join(ignored, "package.json"), "{}");

			// Create non-ignored directory with marker
			const included = join(projectDir, "included");
			mkdirSync(included, { recursive: true });
			writeFileSync(join(included, "package.json"), "{}");

			const result = findDirectoriesWithMarkers(projectDir, ["package.json"]);

			expect(result.length).toBe(1);
			expect(result[0]).toContain("included");
		});

		test("handles deeply nested directories", () => {
			const nested = join(projectDir, "a", "b", "c", "d");
			mkdirSync(nested, { recursive: true });
			writeFileSync(join(nested, "package.json"), "{}");

			const result = findDirectoriesWithMarkers(projectDir, ["package.json"]);

			expect(result.length).toBe(1);
			expect(result[0]).toContain("a/b/c/d");
		});

		test("handles empty directory", () => {
			const result = findDirectoriesWithMarkers(projectDir, ["package.json"]);

			expect(result).toEqual([]);
		});

		test("finds multiple markers in same directory", () => {
			writeFileSync(join(projectDir, "package.json"), "{}");
			writeFileSync(join(projectDir, "Cargo.toml"), "");

			const result1 = findDirectoriesWithMarkers(projectDir, ["package.json"]);
			const result2 = findDirectoriesWithMarkers(projectDir, ["Cargo.toml"]);
			const result3 = findDirectoriesWithMarkers(projectDir, [
				"package.json",
				"Cargo.toml",
			]);

			expect(result1.length).toBe(1);
			expect(result2.length).toBe(1);
			// With multiple patterns, it finds the dir once (not duplicated)
			expect(result3.length).toBe(1);
		});

		test("handles directories with special characters", () => {
			const specialDir = join(projectDir, "my-project_v1.0");
			mkdirSync(specialDir, { recursive: true });
			writeFileSync(join(specialDir, "package.json"), "{}");

			const result = findDirectoriesWithMarkers(projectDir, ["package.json"]);

			expect(result.length).toBe(1);
			expect(result[0]).toContain("my-project_v1.0");
		});

		test("respects nested gitignore files", () => {
			// Initialize git repo
			mkdirSync(join(projectDir, ".git"), { recursive: true });

			// Create nested structure with nested .gitignore
			const subdir = join(projectDir, "subdir");
			mkdirSync(subdir, { recursive: true });
			writeFileSync(join(subdir, ".gitignore"), "local-ignored/\n");

			// Create locally ignored directory
			const localIgnored = join(subdir, "local-ignored");
			mkdirSync(localIgnored, { recursive: true });
			writeFileSync(join(localIgnored, "package.json"), "{}");

			// Create non-ignored directory in subdir
			const notIgnored = join(subdir, "included");
			mkdirSync(notIgnored, { recursive: true });
			writeFileSync(join(notIgnored, "package.json"), "{}");

			const result = findDirectoriesWithMarkers(projectDir, ["package.json"]);

			expect(result.length).toBe(1);
			expect(result[0]).toContain("included");
		});
	});
});
