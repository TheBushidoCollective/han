/**
 * Bun-native utility replacements for NAPI functions.
 *
 * These replace the functions previously provided by han-native:
 * - sha256: Bun.CryptoHasher
 * - glob: Bun.Glob
 * - git operations: Bun.spawn with git CLI
 */

/**
 * SHA-256 hash of a string, returning hex digest.
 */
export function sha256(data: string): string {
	const hasher = new Bun.CryptoHasher("sha256");
	hasher.update(data);
	return hasher.digest("hex") as string;
}

/**
 * Glob files matching a pattern in a directory.
 * Returns array of relative file paths.
 */
export async function globFiles(
	pattern: string,
	cwd: string,
): Promise<string[]> {
	const glob = new Bun.Glob(pattern);
	const results: string[] = [];
	for await (const file of glob.scan({ cwd, onlyFiles: true })) {
		results.push(file);
	}
	return results;
}

/**
 * Synchronous glob using Bun.Glob.scanSync.
 */
export function globFilesSync(pattern: string, cwd: string): string[] {
	const glob = new Bun.Glob(pattern);
	return [...glob.scanSync({ cwd, onlyFiles: true })];
}

// ============================================================================
// Git utilities via Bun.spawn
// ============================================================================

/**
 * Run a git command and return trimmed stdout, or null on error.
 */
async function gitCommand(
	args: string[],
	cwd: string,
): Promise<string | null> {
	try {
		const proc = Bun.spawn(["git", ...args], {
			cwd,
			stdout: "pipe",
			stderr: "ignore",
		});
		const text = await new Response(proc.stdout).text();
		const exitCode = await proc.exited;
		if (exitCode !== 0) return null;
		return text.trim();
	} catch {
		return null;
	}
}

/**
 * Synchronous git command via spawnSync (for hot paths that can't be async).
 */
function gitCommandSync(args: string[], cwd: string): string | null {
	try {
		const proc = Bun.spawnSync(["git", ...args], {
			cwd,
			stdout: "pipe",
			stderr: "ignore",
		});
		if (proc.exitCode !== 0) return null;
		return proc.stdout.toString().trim();
	} catch {
		return null;
	}
}

/**
 * Get the git remote URL for origin.
 */
export function getGitRemoteUrl(dir: string): string | null {
	return gitCommandSync(["remote", "get-url", "origin"], dir);
}

/**
 * Async version of getGitRemoteUrl.
 */
export async function getGitRemoteUrlAsync(
	dir: string,
): Promise<string | null> {
	return gitCommand(["remote", "get-url", "origin"], dir);
}

/**
 * Get the current git branch.
 */
export function getGitBranch(dir: string): string | null {
	return gitCommandSync(["rev-parse", "--abbrev-ref", "HEAD"], dir);
}

/**
 * Async version of getGitBranch.
 */
export async function getGitBranchAsync(dir: string): Promise<string | null> {
	return gitCommand(["rev-parse", "--abbrev-ref", "HEAD"], dir);
}

/**
 * Get the git repository root directory.
 */
export function getGitRoot(dir: string): string | null {
	return gitCommandSync(["rev-parse", "--show-toplevel"], dir);
}

/**
 * Async version of getGitRoot.
 */
export async function getGitRootAsync(dir: string): Promise<string | null> {
	return gitCommand(["rev-parse", "--show-toplevel"], dir);
}

/**
 * Get the git common directory (for worktrees).
 */
export function getGitCommonDir(dir: string): string | null {
	return gitCommandSync(["rev-parse", "--git-common-dir"], dir);
}

/**
 * List files tracked by git in a directory.
 */
export function gitLsFiles(dir: string): string[] {
	const result = gitCommandSync(["ls-files"], dir);
	if (!result) return [];
	return result.split("\n").filter(Boolean);
}

// ============================================================================
// Git worktree operations
// ============================================================================

export interface GitWorktree {
	path: string;
	name: string;
	head?: string;
	isMain: boolean;
	isLocked: boolean;
}

/**
 * List git worktrees for a repository.
 */
export function gitWorktreeList(dir: string): GitWorktree[] {
	const result = gitCommandSync(
		["worktree", "list", "--porcelain"],
		dir,
	);
	if (!result) return [];

	const worktrees: GitWorktree[] = [];
	let current: Partial<GitWorktree> = {};
	let isFirst = true;

	for (const line of result.split("\n")) {
		if (line.startsWith("worktree ")) {
			if (current.path) {
				worktrees.push(current as GitWorktree);
			}
			const path = line.slice("worktree ".length);
			current = {
				path,
				name: path.split("/").pop() || path,
				isMain: isFirst,
				isLocked: false,
			};
			isFirst = false;
		} else if (line.startsWith("HEAD ")) {
			current.head = line.slice("HEAD ".length);
		} else if (line.startsWith("branch ")) {
			// Use branch name as the head ref
			const branch = line.slice("branch ".length);
			current.head = branch.replace("refs/heads/", "");
		} else if (line === "locked") {
			current.isLocked = true;
		}
	}

	if (current.path) {
		worktrees.push(current as GitWorktree);
	}

	return worktrees;
}

/**
 * Add a git worktree at the specified path for a branch.
 */
export function gitWorktreeAdd(
	dir: string,
	path: string,
	branch: string,
): void {
	const result = Bun.spawnSync(["git", "worktree", "add", path, branch], {
		cwd: dir,
		stdout: "ignore",
		stderr: "pipe",
	});
	if (result.exitCode !== 0) {
		throw new Error(
			`git worktree add failed: ${result.stderr.toString()}`,
		);
	}
}

/**
 * Remove a git worktree at the specified path.
 */
export function gitWorktreeRemove(
	dir: string,
	path: string,
	force?: boolean | null,
): void {
	const args = ["worktree", "remove", path];
	if (force) args.push("--force");
	const result = Bun.spawnSync(["git", ...args], {
		cwd: dir,
		stdout: "ignore",
		stderr: "pipe",
	});
	if (result.exitCode !== 0) {
		throw new Error(
			`git worktree remove failed: ${result.stderr.toString()}`,
		);
	}
}

/**
 * Create a new git branch.
 */
export function gitCreateBranch(dir: string, branch: string): void {
	const result = Bun.spawnSync(["git", "branch", branch], {
		cwd: dir,
		stdout: "ignore",
		stderr: "pipe",
	});
	if (result.exitCode !== 0) {
		throw new Error(
			`git branch create failed: ${result.stderr.toString()}`,
		);
	}
}

// ============================================================================
// FileEventType enum
// ============================================================================

export enum FileEventType {
	Created = "Created",
	Modified = "Modified",
	Removed = "Removed",
}
