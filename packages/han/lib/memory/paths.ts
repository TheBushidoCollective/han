/**
 * Han Memory Path Resolution
 *
 * Handles path resolution for personal and team memory storage.
 * All derived memory lives in ~/.claude/han/memory/, NOT in project repos.
 */

import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { getGitRemoteUrl } from "../../../han-native";
import { getClaudeConfigDir } from "../config/claude-settings.ts";

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
	return join(getClaudeConfigDir(), "han", "memory");
}

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
	return getGitRemoteUrl(cwd ?? process.cwd()) ?? null;
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

/**
 * Get Claude Code projects directory
 * This is where Claude Code stores session transcripts
 */
export function getClaudeProjectsDir(): string {
	return join(getClaudeConfigDir(), "projects");
}

/**
 * Convert a filesystem path to Claude Code's project slug format
 * Claude Code replaces both `/` and `.` with `-`
 *
 * @example
 * pathToSlug("/Volumes/dev/src/github.com/foo/bar") // "-Volumes-dev-src-github-com-foo-bar"
 */
export function pathToSlug(fsPath: string): string {
	// Replace path separators and dots with dashes, removing leading slashes
	return fsPath.replace(/^\//, "-").replace(/[/.]/g, "-");
}

/**
 * Get the path to a project's Claude Code directory
 */
export function getClaudeProjectPath(projectPath: string): string {
	const slug = pathToSlug(projectPath);
	return join(getClaudeProjectsDir(), slug);
}

/**
 * Get the Han events file path for a session
 * When projectPath is provided, stores in the Claude project directory.
 * Otherwise stores in personal sessions directory with date prefix.
 *
 * @example
 * // With project path (stores in project directory):
 * getHanEventsFilePath("/path/to/project", "abc123")
 * // ~/.claude/projects/-path-to-project/abc123-han.jsonl
 *
 * // Without project path (stores in sessions directory):
 * getHanEventsFilePath("abc123")
 * // ~/.claude/han/memory/personal/sessions/2025-01-15-abc123-han.jsonl
 */
export function getHanEventsFilePath(sessionId: string): string;
export function getHanEventsFilePath(
	projectPath: string,
	sessionId: string,
): string;
export function getHanEventsFilePath(
	projectPathOrSessionId: string,
	sessionId?: string,
): string {
	if (sessionId === undefined) {
		// Single argument: sessionId only, use sessions directory
		const date = new Date().toISOString().split("T")[0];
		return join(
			getSessionsPath(),
			`${date}-${projectPathOrSessionId}-han.jsonl`,
		);
	}
	// Two arguments: projectPath and sessionId, use project directory
	const projectDir = getClaudeProjectPath(projectPathOrSessionId);
	return join(projectDir, `${sessionId}-han.jsonl`);
}
