/**
 * Jujutsu (jj) VCS Utilities
 *
 * Provides jj-specific functionality for AI-DLC workflows:
 * - Workspace management (jj's equivalent to git worktrees)
 * - Bookmark management (jj's equivalent to branches)
 * - Git interop for PR creation
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Workspace information returned by jj workspace list
 */
export interface JjWorkspace {
	/** Workspace name (default is "default") */
	name: string;
	/** Absolute path to workspace directory */
	path: string;
	/** Working copy commit ID */
	workingCopyCommit: string;
	/** Whether this is the current workspace */
	isCurrent: boolean;
}

/**
 * Bookmark (branch equivalent) information
 */
export interface JjBookmark {
	/** Bookmark name */
	name: string;
	/** Commit ID the bookmark points to */
	commit: string;
	/** Whether this bookmark tracks a remote */
	isRemote: boolean;
	/** Remote name if tracking */
	remote?: string;
}

/**
 * Check if jj is installed and available
 * @returns true if jj command is available
 */
export function isJjInstalled(): boolean {
	try {
		execSync("jj version", { stdio: "pipe" });
		return true;
	} catch {
		return false;
	}
}

/**
 * Detect if directory is a jj repository
 * Prefers jj over git for colocated repos (checks .jj first)
 * @param directory - Directory to check (defaults to cwd)
 * @returns true if directory is a jj repo
 */
export function isJjRepo(directory?: string): boolean {
	const cwd = directory || process.cwd();

	// Check for .jj directory (faster than running jj root)
	if (existsSync(join(cwd, ".jj"))) {
		return true;
	}

	// Also try jj root for nested directories
	try {
		execSync("jj root --ignore-working-copy", { cwd, stdio: "pipe" });
		return true;
	} catch {
		return false;
	}
}

/**
 * Get the jj repository root
 * @param directory - Starting directory (defaults to cwd)
 * @returns Absolute path to repo root or null
 */
export function getJjRoot(directory?: string): string | null {
	const cwd = directory || process.cwd();

	try {
		return execSync("jj root --ignore-working-copy", { cwd, stdio: "pipe" })
			.toString()
			.trim();
	} catch {
		return null;
	}
}

/**
 * Check if repo is colocated with git
 * @param directory - Directory to check (defaults to cwd)
 * @returns true if both .jj and .git exist
 */
export function isColocatedRepo(directory?: string): boolean {
	const cwd = directory || process.cwd();
	const root = getJjRoot(cwd);
	if (!root) return false;

	return existsSync(join(root, ".jj")) && existsSync(join(root, ".git"));
}

/**
 * List all jj workspaces
 * @param directory - Directory within the repo (defaults to cwd)
 * @returns Array of workspace information
 */
export function listWorkspaces(directory?: string): JjWorkspace[] {
	const cwd = directory || process.cwd();

	try {
		// Use jj workspace list with template for machine-readable output
		const output = execSync(
			'jj workspace list --template \'concat(name, "\\t", working_copy_commit.commit_id().shortest(12), "\\n")\'',
			{ cwd, stdio: "pipe" },
		).toString();

		const root = getJjRoot(cwd);
		if (!root) return [];

		// Parse output: each line is "name\tcommit_id"
		const lines = output.trim().split("\n").filter(Boolean);
		const currentWorkspace = getCurrentWorkspaceName(cwd);

		return lines.map((line) => {
			const [name, workingCopyCommit] = line.split("\t");
			// Workspace path is root for default, or root/.jj/workspaces/<name> for others
			const path =
				name === "default" ? root : join(root, ".jj", "workspaces", name);

			return {
				name,
				path: name === "default" ? root : path,
				workingCopyCommit: workingCopyCommit || "",
				isCurrent: name === currentWorkspace,
			};
		});
	} catch {
		return [];
	}
}

/**
 * Get the current workspace name
 * @param directory - Directory within the repo (defaults to cwd)
 * @returns Workspace name or "default"
 */
export function getCurrentWorkspaceName(directory?: string): string {
	const cwd = directory || process.cwd();

	try {
		// The workspace name is in .jj/working_copy/type file
		const root = getJjRoot(cwd);
		if (!root) return "default";

		const output = execSync("jj workspace root", { cwd, stdio: "pipe" })
			.toString()
			.trim();

		// If we're in the main repo, it's default
		if (output === root) return "default";

		// Otherwise parse the workspace name from the path
		const match = output.match(/\.jj[\/\\]workspaces[\/\\]([^\/\\]+)/);
		return match?.[1] || "default";
	} catch {
		return "default";
	}
}

/**
 * Create a new jj workspace
 * @param name - Workspace name (used in path)
 * @param path - Path where workspace will be created
 * @param directory - Directory within the repo (defaults to cwd)
 * @throws Error if workspace creation fails
 */
export function createWorkspace(
	name: string,
	path: string,
	directory?: string,
): void {
	const cwd = directory || process.cwd();

	try {
		execSync(`jj workspace add --name "${name}" "${path}"`, {
			cwd,
			stdio: "pipe",
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Failed to create jj workspace: ${message}`);
	}
}

/**
 * Remove a jj workspace
 * @param name - Workspace name to remove
 * @param directory - Directory within the repo (defaults to cwd)
 * @throws Error if workspace removal fails
 */
export function removeWorkspace(name: string, directory?: string): void {
	const cwd = directory || process.cwd();

	if (name === "default") {
		throw new Error("Cannot remove the default workspace");
	}

	try {
		execSync(`jj workspace forget "${name}"`, { cwd, stdio: "pipe" });
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Failed to remove jj workspace: ${message}`);
	}
}

/**
 * List all bookmarks (jj's branch equivalent)
 * @param directory - Directory within the repo (defaults to cwd)
 * @returns Array of bookmark information
 */
export function listBookmarks(directory?: string): JjBookmark[] {
	const cwd = directory || process.cwd();

	try {
		// Use jj bookmark list with template for machine-readable output
		const output = execSync(
			'jj bookmark list --template \'concat(name, "\\t", commit_id.shortest(12), "\\t", if(remote, remote, "local"), "\\n")\'',
			{ cwd, stdio: "pipe" },
		).toString();

		const lines = output.trim().split("\n").filter(Boolean);

		return lines.map((line) => {
			const [name, commit, remoteOrLocal] = line.split("\t");
			const isRemote = remoteOrLocal !== "local";

			return {
				name,
				commit: commit || "",
				isRemote,
				remote: isRemote ? remoteOrLocal : undefined,
			};
		});
	} catch {
		return [];
	}
}

/**
 * Create a new bookmark
 * @param name - Bookmark name
 * @param revision - Revision to point to (defaults to @)
 * @param directory - Directory within the repo (defaults to cwd)
 * @throws Error if bookmark creation fails
 */
export function createBookmark(
	name: string,
	revision?: string,
	directory?: string,
): void {
	const cwd = directory || process.cwd();
	const rev = revision || "@";

	try {
		execSync(`jj bookmark create "${name}" -r "${rev}"`, {
			cwd,
			stdio: "pipe",
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Failed to create jj bookmark: ${message}`);
	}
}

/**
 * Move a bookmark to a new revision
 * @param name - Bookmark name
 * @param revision - New revision to point to
 * @param directory - Directory within the repo (defaults to cwd)
 * @throws Error if bookmark move fails
 */
export function moveBookmark(
	name: string,
	revision: string,
	directory?: string,
): void {
	const cwd = directory || process.cwd();

	try {
		execSync(`jj bookmark set "${name}" -r "${revision}"`, {
			cwd,
			stdio: "pipe",
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Failed to move jj bookmark: ${message}`);
	}
}

/**
 * Delete a bookmark
 * @param name - Bookmark name to delete
 * @param directory - Directory within the repo (defaults to cwd)
 * @throws Error if bookmark deletion fails
 */
export function deleteBookmark(name: string, directory?: string): void {
	const cwd = directory || process.cwd();

	try {
		execSync(`jj bookmark delete "${name}"`, { cwd, stdio: "pipe" });
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Failed to delete jj bookmark: ${message}`);
	}
}

/**
 * Get the default branch (trunk) for the repo
 * Uses trunk() revset which respects repo config
 * @param directory - Directory within the repo (defaults to cwd)
 * @returns Default branch name or "main" as fallback
 */
export function getDefaultBranch(directory?: string): string {
	const cwd = directory || process.cwd();

	try {
		// Try to get trunk bookmark name from jj
		const output = execSync(
			'jj log -r "trunk()" --no-graph --template "if(bookmarks, bookmarks)"',
			{ cwd, stdio: "pipe" },
		)
			.toString()
			.trim();

		if (output) {
			// May have multiple bookmarks, take the first one
			return output.split(/\s+/)[0];
		}

		// Fallback: check common branch names
		const bookmarks = listBookmarks(cwd);
		const commonNames = ["main", "master", "trunk", "develop"];

		for (const name of commonNames) {
			if (bookmarks.some((b) => b.name === name)) {
				return name;
			}
		}

		return "main";
	} catch {
		return "main";
	}
}

/**
 * Push changes to git remote (for PR creation in colocated repos)
 * @param bookmark - Bookmark name to push
 * @param remote - Remote name (defaults to "origin")
 * @param directory - Directory within the repo (defaults to cwd)
 * @throws Error if push fails
 */
export function gitPush(
	bookmark: string,
	remote?: string,
	directory?: string,
): void {
	const cwd = directory || process.cwd();
	const remoteName = remote || "origin";

	try {
		execSync(`jj git push --bookmark "${bookmark}" --remote "${remoteName}"`, {
			cwd,
			stdio: "pipe",
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Failed to push to git remote: ${message}`);
	}
}

/**
 * Fetch from git remote
 * @param remote - Remote name (defaults to "origin")
 * @param directory - Directory within the repo (defaults to cwd)
 * @throws Error if fetch fails
 */
export function gitFetch(remote?: string, directory?: string): void {
	const cwd = directory || process.cwd();
	const remoteName = remote || "origin";

	try {
		execSync(`jj git fetch --remote "${remoteName}"`, { cwd, stdio: "pipe" });
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Failed to fetch from git remote: ${message}`);
	}
}

/**
 * Squash (combine) commits
 * Useful for auto_squash option when merging
 * @param revision - Revision to squash into parent
 * @param directory - Directory within the repo (defaults to cwd)
 * @throws Error if squash fails
 */
export function squash(revision?: string, directory?: string): void {
	const cwd = directory || process.cwd();
	const rev = revision ? `-r "${revision}"` : "";

	try {
		execSync(`jj squash ${rev}`.trim(), { cwd, stdio: "pipe" });
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Failed to squash: ${message}`);
	}
}

/**
 * Create a new change (commit) with description
 * @param description - Change description
 * @param directory - Directory within the repo (defaults to cwd)
 * @throws Error if commit fails
 */
export function commit(description: string, directory?: string): void {
	const cwd = directory || process.cwd();

	try {
		execSync(`jj commit -m "${description.replace(/"/g, '\\"')}"`, {
			cwd,
			stdio: "pipe",
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Failed to commit: ${message}`);
	}
}

/**
 * Describe (update message of) the current change
 * @param description - New change description
 * @param revision - Revision to describe (defaults to @)
 * @param directory - Directory within the repo (defaults to cwd)
 * @throws Error if describe fails
 */
export function describe(
	description: string,
	revision?: string,
	directory?: string,
): void {
	const cwd = directory || process.cwd();
	const rev = revision ? `-r "${revision}"` : "";

	try {
		execSync(
			`jj describe ${rev} -m "${description.replace(/"/g, '\\"')}"`.trim(),
			{ cwd, stdio: "pipe" },
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Failed to describe change: ${message}`);
	}
}

/**
 * Rebase current change onto another revision
 * @param destination - Destination revision
 * @param source - Source revision (defaults to @)
 * @param directory - Directory within the repo (defaults to cwd)
 * @throws Error if rebase fails
 */
export function rebase(
	destination: string,
	source?: string,
	directory?: string,
): void {
	const cwd = directory || process.cwd();
	const src = source ? `-r "${source}"` : "";

	try {
		execSync(`jj rebase ${src} -d "${destination}"`.trim(), {
			cwd,
			stdio: "pipe",
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Failed to rebase: ${message}`);
	}
}

/**
 * Check if there are conflicts in the working copy
 * @param directory - Directory within the repo (defaults to cwd)
 * @returns true if there are conflicts
 */
export function hasConflicts(directory?: string): boolean {
	const cwd = directory || process.cwd();

	try {
		const output = execSync(
			'jj log -r @ --no-graph --template "conflict"',
			{ cwd, stdio: "pipe" },
		)
			.toString()
			.trim();

		return output === "true";
	} catch {
		return false;
	}
}

/**
 * Get AI-DLC workspace name for a unit
 * @param intentSlug - Intent slug (e.g., "vcs-strategy-config")
 * @param unitSlug - Unit slug (e.g., "06-jj-support")
 * @returns Workspace name like "ai-dlc-vcs-strategy-config-06-jj-support"
 */
export function getAiDlcWorkspaceName(
	intentSlug: string,
	unitSlug: string,
): string {
	return `ai-dlc-${intentSlug}-${unitSlug}`;
}

/**
 * Find AI-DLC workspaces for a given intent
 * @param intentSlug - Intent slug to filter by
 * @param directory - Directory within the repo (defaults to cwd)
 * @returns Array of workspaces matching the intent
 */
export function findAiDlcWorkspaces(
	intentSlug: string,
	directory?: string,
): JjWorkspace[] {
	const workspaces = listWorkspaces(directory);
	const prefix = `ai-dlc-${intentSlug}-`;

	return workspaces.filter((ws) => ws.name.startsWith(prefix));
}

/**
 * Warning message for colocated repo workspace creation
 * When creating workspaces in colocated repos, the new workspace
 * becomes a pure jj workspace (not colocated)
 */
export const COLOCATION_WARNING = `
Note: Creating a workspace in a colocated git+jj repo.
The new workspace will be a pure jj workspace without git colocaton.
Use 'jj git push' from the new workspace to sync changes to git.
`;
