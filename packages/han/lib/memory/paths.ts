/**
 * Han Memory Path Resolution
 *
 * Handles path resolution for personal and team memory storage.
 * All derived memory lives in ~/.claude/han/memory/, NOT in project repos.
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Override for memory root (used in tests)
 */
let memoryRootOverride: string | null = null;

/**
 * Set a custom memory root (for testing)
 * Pass null to reset to default
 */
export function setMemoryRoot(path: string | null): void {
	memoryRootOverride = path;
}

/**
 * Get root directory for all Han memory data
 * Computed lazily to support test environment overrides
 */
export function getMemoryRoot(): string {
	if (memoryRootOverride) {
		return memoryRootOverride;
	}
	return join(homedir(), ".claude", "han", "memory");
}

/**
 * @deprecated Use getMemoryRoot() instead - this constant is computed at import time
 * and doesn't respect runtime HOME changes (for testing)
 */
export const HAN_MEMORY_ROOT = join(homedir(), ".claude", "han", "memory");

/**
 * Get path to personal memory storage
 */
export function getPersonalPath(): string {
	return join(getMemoryRoot(), "personal");
}

/**
 * Get path to personal session observations
 */
export function getSessionsPath(): string {
	return join(getPersonalPath(), "sessions");
}

/**
 * Get path to personal session summaries
 */
export function getSummariesPath(): string {
	return join(getPersonalPath(), "summaries");
}

/**
 * Get path to personal memory index
 */
export function getPersonalIndexPath(): string {
	return join(getPersonalPath(), ".index");
}

/**
 * Normalize git remote URL to filesystem-safe path
 *
 * @example
 * normalizeGitRemote("git@github.com:org/repo.git") // "github.com_org_repo"
 * normalizeGitRemote("https://github.com/org/repo") // "github.com_org_repo"
 * normalizeGitRemote("https://gitlab.com/team/project.git") // "gitlab.com_team_project"
 */
export function normalizeGitRemote(gitRemote: string): string {
	return gitRemote
		.replace(/^(git@|https?:\/\/)/, "")
		.replace(/\.git$/, "")
		.replace(/[/:]/g, "_");
}

/**
 * Get path to project memory storage from git remote
 */
export function getProjectMemoryPath(gitRemote: string): string {
	const normalized = normalizeGitRemote(gitRemote);
	return join(getMemoryRoot(), "projects", normalized);
}

/**
 * Get path to project memory index
 */
export function getProjectIndexPath(gitRemote: string): string {
	return join(getProjectMemoryPath(gitRemote), ".index");
}

/**
 * Get path to project metadata file
 */
export function getProjectMetaPath(gitRemote: string): string {
	return join(getProjectMemoryPath(gitRemote), "meta.yaml");
}

/**
 * Get git remote URL for current directory
 * Returns null if not in a git repo or no remote configured
 */
export function getGitRemote(cwd?: string): string | null {
	try {
		const result = execSync("git remote get-url origin", {
			cwd: cwd || process.cwd(),
			encoding: "utf-8",
			stdio: ["pipe", "pipe", "pipe"],
		});
		return result.trim() || null;
	} catch {
		return null;
	}
}

/**
 * Get project memory path for current directory
 * Returns null if not in a git repo
 */
export function getCurrentProjectPath(): string | null {
	const remote = getGitRemote();
	if (!remote) return null;
	return getProjectMemoryPath(remote);
}

/**
 * Ensure a directory exists, creating it recursively if needed
 */
export function ensureDir(dirPath: string): void {
	if (!existsSync(dirPath)) {
		mkdirSync(dirPath, { recursive: true });
	}
}

/**
 * Ensure all memory directories exist
 */
export function ensureMemoryDirs(): void {
	ensureDir(getSessionsPath());
	ensureDir(getSummariesPath());
	ensureDir(getPersonalIndexPath());
}

/**
 * Ensure project memory directories exist
 */
export function ensureProjectDirs(gitRemote: string): void {
	const projectPath = getProjectMemoryPath(gitRemote);
	ensureDir(projectPath);
	ensureDir(getProjectIndexPath(gitRemote));
}

/**
 * Generate a unique ID for observations
 */
export function generateId(): string {
	const timestamp = Date.now().toString(36);
	const random = Math.random().toString(36).substring(2, 8);
	return `${timestamp}-${random}`;
}

/**
 * Generate session file path
 */
export function getSessionFilePath(sessionId: string): string {
	const date = new Date().toISOString().split("T")[0];
	return join(getSessionsPath(), `${date}-${sessionId}.jsonl`);
}

/**
 * Generate summary file path
 */
export function getSummaryFilePath(sessionId: string): string {
	const date = new Date().toISOString().split("T")[0];
	return join(getSummariesPath(), `${date}-${sessionId}.yaml`);
}
