import { describe, expect, it } from "bun:test";
import {
	FileEventType,
	getGitBranch,
	getGitCommonDir,
	getGitRemoteUrl,
	getGitRoot,
	gitCreateBranch,
	gitLsFiles,
	gitWorktreeList,
	globFiles,
	globFilesSync,
	sha256,
} from "../lib/bun-utils.ts";

describe("Bun Utils", () => {
	describe("sha256", () => {
		it("hashes a string to hex", () => {
			const result = sha256("hello");
			expect(result).toBe(
				"2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
			);
		});

		it("produces different hashes for different inputs", () => {
			expect(sha256("a")).not.toBe(sha256("b"));
		});

		it("produces consistent hashes", () => {
			expect(sha256("test")).toBe(sha256("test"));
		});
	});

	describe("globFiles", () => {
		it("finds TypeScript files", async () => {
			const files = await globFiles("*.ts", import.meta.dir);
			expect(files.length).toBeGreaterThan(0);
			for (const f of files) {
				expect(f).toEndWith(".ts");
			}
		});

		it("returns empty for non-matching pattern", async () => {
			const files = await globFiles(
				"*.nonexistent12345",
				import.meta.dir,
			);
			expect(files).toEqual([]);
		});
	});

	describe("globFilesSync", () => {
		it("finds files synchronously", () => {
			const files = globFilesSync("*.ts", import.meta.dir);
			expect(files.length).toBeGreaterThan(0);
		});
	});

	describe("git operations", () => {
		// These tests assume we're in a git repo
		const repoRoot = import.meta.dir + "/..";

		it("getGitRoot returns a path", () => {
			const root = getGitRoot(repoRoot);
			expect(root).not.toBeNull();
			expect(root).toContain("/");
		});

		it("getGitBranch returns branch name", () => {
			const branch = getGitBranch(repoRoot);
			expect(branch).not.toBeNull();
			expect(typeof branch).toBe("string");
		});

		it("getGitCommonDir returns a path", () => {
			const commonDir = getGitCommonDir(repoRoot);
			expect(commonDir).not.toBeNull();
		});

		it("gitLsFiles returns tracked files", () => {
			const files = gitLsFiles(repoRoot);
			expect(files.length).toBeGreaterThan(0);
		});

		it("getGitRemoteUrl returns null for non-git dir", () => {
			const url = getGitRemoteUrl("/tmp");
			expect(url).toBeNull();
		});

		it("gitWorktreeList returns at least main worktree", () => {
			const worktrees = gitWorktreeList(repoRoot);
			expect(worktrees.length).toBeGreaterThanOrEqual(1);
			// First worktree should be main
			const main = worktrees.find((w) => w.isMain);
			expect(main).toBeDefined();
		});
	});

	describe("FileEventType", () => {
		it("has expected values", () => {
			expect(FileEventType.Created).toBe("Created");
			expect(FileEventType.Modified).toBe("Modified");
			expect(FileEventType.Removed).toBe("Removed");
		});
	});
});
