/**
 * Sessions API - List and retrieve Claude Code sessions
 *
 * GET /api/sessions - List all sessions with pagination
 * GET /api/sessions/:id - Get session detail with messages
 *
 * Reads from the unified SurrealKV database.
 * The coordinator process indexes JSONL files into the database.
 */

import { existsSync, readdirSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
	getGitCommonDir,
	getGitRemoteUrl,
	getGitRoot,
	gitWorktreeList,
} from "../../../han-native";
import {
	messages as dbMessages,
	projects as dbProjects,
	sessions as dbSessions,
	type Message,
} from "../db/index.ts";

/**
 * Check if a path is within a system temp folder
 * These are typically test directories that shouldn't be shown in the UI
 */
function isTempFolderPath(path: string): boolean {
	const tempPatterns = [
		"/var/folders/", // macOS temp
		"/private/var/folders/", // macOS temp (actual path)
		"/tmp/", // Linux/macOS temp
		"/private/tmp/", // macOS /tmp alias
		"/temp/", // Windows-style temp
		"\\temp\\", // Windows backslash
		"\\Temp\\", // Windows Temp folder
	];
	const lowerPath = path.toLowerCase();
	return tempPatterns.some(
		(pattern) =>
			lowerPath.includes(pattern.toLowerCase()) || path.includes(pattern),
	);
}

/**
 * A message from a Claude Code session
 */
export interface SessionMessage {
	id: string; // The message UUID from JSONL (for sentiment matching)
	type: string;
	role?: string;
	content?: string | Array<{ type: string; text?: string }>;
	timestamp: string;
	sessionId: string;
	cwd?: string;
	gitBranch?: string;
	version?: string;
	rawJson?: string;
	// Han event specific fields
	toolName?: string; // For han_event: contains event subtype (hook_start, etc.)
	// Agent and parent tracking
	agentId?: string; // NULL for main conversation, agent ID for agent messages
	parentId?: string; // For result messages, references the call message id
}

/**
 * Subdirectory information within a worktree
 */
export interface SubdirInfo {
	/** The subdirectory relative path */
	relativePath: string;
	/** Full path to the subdirectory */
	path: string;
	/** Number of sessions in this subdirectory */
	sessionCount: number;
}

/**
 * Worktree information for a project
 */
export interface WorktreeInfo {
	/** The worktree name (e.g., "main", "feature-branch") */
	name: string;
	/** Full path to the worktree */
	path: string;
	/** Number of sessions at this worktree root */
	sessionCount: number;
	/** Whether this is a linked worktree (vs main repo) */
	isWorktree: boolean;
	/** Subdirectories with sessions within this worktree */
	subdirs?: SubdirInfo[];
}

/**
 * Grouped project with all its worktrees
 */
export interface ProjectGroup {
	/** Canonical project identifier matching the directory name in ~/.claude/projects */
	projectId: string;
	/** Git remote-based repo identifier (e.g., github-com-org-repo) */
	repoId: string;
	/** Display name for the project */
	displayName: string;
	/** All worktrees for this project */
	worktrees: WorktreeInfo[];
	/** Total sessions across all worktrees */
	totalSessions: number;
	/** Most recent session timestamp */
	lastActivity?: Date;
}

/**
 * Session list item (minimal info for list view)
 */
export interface SessionListItem {
	sessionId: string;
	date: string;
	project: string;
	projectPath: string;
	/** Encoded project directory name as stored by Claude Code (e.g., -Volumes-dev-src-...) */
	projectDir: string;
	/** Canonical project ID for grouping worktrees */
	projectId?: string;
	/** Worktree name if this is part of a multi-worktree project */
	worktreeName?: string;
	summary?: string;
	messageCount: number;
	startedAt?: string;
	endedAt?: string;
	gitBranch?: string;
	version?: string;
}

/**
 * Session detail with full messages
 */
export interface SessionDetail {
	sessionId: string;
	date: string;
	project: string;
	projectPath: string;
	/** Encoded project directory name as stored by Claude Code (e.g., -Volumes-dev-src-...) */
	projectDir: string;
	/** Canonical project ID for grouping worktrees */
	projectId?: string;
	/** Worktree name if this is part of a multi-worktree project */
	worktreeName?: string;
	startedAt?: string;
	endedAt?: string;
	gitBranch?: string;
	version?: string;
	messages: SessionMessage[];
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
	data: T[];
	page: number;
	pageSize: number;
	total: number;
	hasMore: boolean;
}

/**
 * Get the Claude Code projects directory
 */
function getClaudeProjectsPath(): string {
	return join(homedir(), ".claude", "projects");
}

/**
 * Cache for decoded project paths
 */
const decodedPathCache = new Map<string, string>();

/**
 * Decode project path from directory name
 * Claude Code encodes paths by replacing / with - and . with -
 * This creates ambiguity when decoding, so we validate against the filesystem.
 *
 * Strategy: Greedy matching - prefer longer valid path segments.
 * e.g., "-Volumes-dev-src-github-com-foo-bar" -> "/Volumes/dev/src/github.com/foo/bar"
 */
function decodeProjectPath(dirName: string): string {
	// Check cache first
	const cached = decodedPathCache.get(dirName);
	if (cached) {
		return cached;
	}

	// Get the raw segments (split by dash, handling leading dash)
	const rawName = dirName.startsWith("-") ? dirName.slice(1) : dirName;
	const rawSegments = rawName.split("-");

	// Build the path incrementally, validating against filesystem
	// Use greedy matching: try to combine as many segments as possible
	const result: string[] = [];
	let i = 0;

	while (i < rawSegments.length) {
		// Try combining multiple segments with dashes (greedy - try longest first)
		// This handles cases like "monorepo-1" being a single directory
		let bestMatch = "";
		let bestMatchLen = 0;

		// Try up to 4 segments combined with dashes
		for (let len = Math.min(4, rawSegments.length - i); len >= 1; len--) {
			const combined = rawSegments.slice(i, i + len).join("-");
			const testPath = `/${[...result, combined].join("/")}`;
			if (existsSync(testPath)) {
				if (len > bestMatchLen) {
					bestMatch = combined;
					bestMatchLen = len;
				}
				break; // Found a match at this length, stop searching shorter
			}
		}

		// If dash combinations didn't work, try with dots for domain patterns
		if (!bestMatch) {
			// Try segment.next for domain.tld patterns
			if (i + 1 < rawSegments.length) {
				const withDot = `${rawSegments[i]}.${rawSegments[i + 1]}`;
				const testDot = `/${[...result, withDot].join("/")}`;
				if (existsSync(testDot)) {
					// Also check if we can extend further with dashes
					for (
						let extra = Math.min(2, rawSegments.length - i - 2);
						extra >= 0;
						extra--
					) {
						let extended = withDot;
						if (extra > 0) {
							extended = `${withDot}-${rawSegments.slice(i + 2, i + 2 + extra).join("-")}`;
						}
						const testExtended = `/${[...result, extended].join("/")}`;
						if (existsSync(testExtended)) {
							bestMatch = extended;
							bestMatchLen = 2 + extra;
							break;
						}
					}
					if (!bestMatch) {
						bestMatch = withDot;
						bestMatchLen = 2;
					}
				}
			}
		}

		if (bestMatch) {
			result.push(bestMatch);
			i += bestMatchLen;
		} else {
			// No valid path found - just use the single segment
			result.push(rawSegments[i]);
			i++;
		}
	}

	const decoded = `/${result.join("/")}`;
	decodedPathCache.set(dirName, decoded);
	return decoded;
}

/**
 * Get project name from path (last component)
 */
function getProjectName(projectPath: string): string {
	const parts = projectPath.split("/").filter(Boolean);
	return parts[parts.length - 1] || projectPath;
}

/**
 * Encode a path to the directory name format used by Claude Code
 * This is the inverse of decodeProjectPath()
 * e.g., "/Volumes/dev/src/github.com/org/repo" -> "-Volumes-dev-src-github-com-org-repo"
 */
function encodeProjectPath(path: string): string {
	// Replace slashes and dots with dashes
	// Leading slash becomes leading dash
	return path.replace(/\//g, "-").replace(/\./g, "-");
}

/**
 * Cache for repo display name lookups
 */
const repoDisplayNameCache = new Map<string, string>();

/**
 * Get a user-friendly display name for a repository
 * Uses the repo name from git remote URL (e.g., "han" from "github.com/org/han")
 * Falls back to the git root directory name
 */
function getRepoDisplayName(projectPath: string): string {
	// Check cache first
	const cached = repoDisplayNameCache.get(projectPath);
	if (cached) {
		return cached;
	}

	const gitRoot = findGitRoot(projectPath);
	if (!gitRoot) {
		// Not a git repo, use the project path's last component
		const name = getProjectName(projectPath);
		repoDisplayNameCache.set(projectPath, name);
		return name;
	}

	// Try to extract repo name from git remote
	const gitRemote = getGitRemote(gitRoot);
	if (gitRemote) {
		// Extract repo name from remote URL
		// git@github.com:org/repo.git -> repo
		// https://github.com/org/repo -> repo
		const cleaned = gitRemote
			.replace(/^(git@|https?:\/\/)/, "")
			.replace(/\.git$/, "")
			.replace(/:/g, "/");
		const parts = cleaned.split("/").filter(Boolean);
		// Last part is the repo name
		const repoName = parts[parts.length - 1] || getProjectName(gitRoot);
		repoDisplayNameCache.set(projectPath, repoName);
		return repoName;
	}

	// Fallback to git root directory name
	const name = getProjectName(gitRoot);
	repoDisplayNameCache.set(projectPath, name);
	return name;
}

/**
 * Cache for git root lookups to avoid repeated filesystem access
 */
const gitRootCache = new Map<string, string | null>();

/**
 * Cache for worktree listings by git root
 */
const worktreeListCache = new Map<
	string,
	Array<{ path: string; branch: string }>
>();

/**
 * Resolve a path to its real path (follows symlinks)
 */
function resolvePath(path: string): string {
	try {
		return realpathSync(path);
	} catch {
		return path;
	}
}

/**
 * Get all worktrees for a git repository using native gitoxide
 */
function getWorktreesForRepo(
	gitRoot: string,
): Array<{ path: string; branch: string }> {
	// Check cache
	const cached = worktreeListCache.get(gitRoot);
	if (cached) {
		return cached;
	}

	try {
		const nativeWorktrees = gitWorktreeList(gitRoot);
		const worktrees = nativeWorktrees.map((wt) => ({
			path: resolvePath(wt.path),
			branch: wt.head ?? "detached",
		}));

		worktreeListCache.set(gitRoot, worktrees);
		return worktrees;
	} catch {
		// Git operation failed - maybe not a git repo
		worktreeListCache.set(gitRoot, []);
		return [];
	}
}

/**
 * Find the git repository root for a given path
 * For worktrees, this returns the MAIN repository root, not the worktree path
 * Uses native gitoxide for git operations
 * Returns null if not a git repository
 */
function findGitRoot(projectPath: string): string | null {
	// Resolve symlinks first
	const resolvedPath = resolvePath(projectPath);

	// Check cache with resolved path
	const cached = gitRootCache.get(resolvedPath);
	if (cached !== undefined) {
		return cached;
	}

	// If path doesn't exist, we can't check
	if (!existsSync(resolvedPath)) {
		gitRootCache.set(resolvedPath, null);
		return null;
	}

	// Use native gitoxide to find the main repo's .git directory
	// This works for both main repos and worktrees
	const gitCommonDir = getGitCommonDir(resolvedPath);
	if (!gitCommonDir) {
		gitRootCache.set(resolvedPath, null);
		return null;
	}

	// The common dir is the .git directory of the main repo
	// For main repo: returns ".git" (relative)
	// For worktree: returns absolute path like "/path/to/main-repo/.git"
	let mainRepoPath: string;

	if (gitCommonDir === ".git" || gitCommonDir.endsWith("/.git")) {
		// This is the main repo or the path ends with .git
		const gitRoot = getGitRoot(resolvedPath);
		if (!gitRoot) {
			gitRootCache.set(resolvedPath, null);
			return null;
		}
		mainRepoPath = gitRoot;
	} else {
		// gitCommonDir might be an absolute path to .git directory
		// Remove the trailing /.git to get the main repo path
		mainRepoPath = gitCommonDir.replace(/\/.git$/, "");
	}

	// Resolve the path to handle symlinks
	const resolvedGitRoot = resolvePath(mainRepoPath);
	gitRootCache.set(resolvedPath, resolvedGitRoot);
	return resolvedGitRoot;
}

/**
 * Get git remote URL for a directory
 * Returns null if not in a git repo or no remote configured
 */
function getGitRemote(cwd: string): string | null {
	return getGitRemoteUrl(cwd) ?? null;
}

/**
 * Normalize git remote URL to filesystem-safe path
 * @example
 * normalizeGitRemote("git@github.com:org/repo.git") // "github-com-org-repo"
 * normalizeGitRemote("https://github.com/org/repo") // "github-com-org-repo"
 */
function normalizeGitRemote(gitRemote: string): string {
	return gitRemote
		.replace(/^(git@|https?:\/\/)/, "")
		.replace(/\.git$/, "")
		.replace(/[/:.]/g, "-");
}

/**
 * Extract a canonical project ID from a path
 * Uses git remote URL to create consistent IDs across machines
 * Fallback uses git root detection to properly group worktrees
 */
function getProjectId(projectPath: string): string {
	// Try to find the git root first
	const gitRoot = findGitRoot(projectPath);

	if (gitRoot) {
		// Try to get git remote for a consistent cross-machine ID
		const gitRemote = getGitRemote(gitRoot);
		if (gitRemote) {
			return normalizeGitRemote(gitRemote);
		}

		// Fallback: use git root's last 3 path components (to capture domain)
		// e.g., /Volumes/dev/src/github.com/thebushidocollective/han -> github-com-thebushidocollective-han
		const parts = gitRoot.split("/").filter(Boolean);
		// Replace dots with dashes for consistency with remote-based IDs
		return parts.slice(-3).join("-").replace(/\./g, "-");
	}

	// Fallback: use last 3 components of the project path
	const parts = projectPath.split("/").filter(Boolean);
	return parts.slice(-3).join("-").replace(/\./g, "-");
}

/**
 * Location type for a project path
 */
type LocationType = "main" | "worktree" | "subdirectory";

/**
 * Full worktree info with parent path for subdirectories
 */
interface WorktreeInfoResult {
	name: string;
	isWorktree: boolean;
	type: LocationType;
	/** For subdirectories: the parent worktree path */
	parentWorktreePath?: string;
	/** For subdirectories: the relative path from parent */
	relativePath?: string;
}

/**
 * Get worktree info for a path using git worktree list
 * Returns the branch name if this is a worktree, or undefined for main repo
 * Also detects subdirectories within repos/worktrees
 */
function getWorktreeInfo(projectPath: string): WorktreeInfoResult | undefined {
	const resolvedPath = resolvePath(projectPath);
	const gitRoot = findGitRoot(resolvedPath);

	if (!gitRoot) {
		return undefined;
	}

	// Get all worktrees for this repo
	const worktrees = getWorktreesForRepo(gitRoot);

	// Find this exact path in the worktree list
	const worktree = worktrees.find((wt) => wt.path === resolvedPath);

	if (worktree) {
		// Check if this is the main worktree (same as git root)
		const isMainWorktree = resolvedPath === gitRoot;

		if (isMainWorktree) {
			// Main repo - return branch name but mark as not a worktree
			return { name: worktree.branch, isWorktree: false, type: "main" };
		}

		// This is a linked worktree - use directory name + branch
		const parts = resolvedPath.split("/").filter(Boolean);
		const dirName = parts[parts.length - 1];

		return {
			name: `${dirName} (${worktree.branch})`,
			isWorktree: true,
			type: "worktree",
		};
	}

	// Not an exact match - check if this is a subdirectory of a worktree
	for (const wt of worktrees) {
		if (resolvedPath.startsWith(`${wt.path}/`)) {
			// This is a subdirectory within a worktree
			const relativePath = resolvedPath.slice(wt.path.length + 1);
			const isMainWorktree = wt.path === gitRoot;

			// Name shown in the list is just the relative path
			const name = relativePath;

			return {
				name,
				isWorktree: !isMainWorktree,
				type: "subdirectory",
				parentWorktreePath: wt.path,
				relativePath,
			};
		}
	}

	return undefined;
}

/**
 * Get messages for a session from the database
 * The coordinator indexes JSONL files into the database
 *
 * @param sessionId - Session ID to fetch messages for
 * @param agentIdFilter - Optional agent filter:
 *   - undefined/null: All messages (no agent filtering)
 *   - "": Main conversation only (messages with no agent_id)
 *   - "abc12345": Specific agent's messages only
 */
async function getSessionMessages(
	sessionId: string,
	agentIdFilter?: string | null,
): Promise<SessionMessage[]> {
	const msgs = await dbMessages.list({ sessionId, agentIdFilter });
	return msgs.map((msg: Message) => ({
		id: msg.id, // Message UUID for sentiment matching
		type: msg.messageType,
		role: msg.role ?? undefined,
		content: msg.content ?? undefined,
		timestamp: msg.timestamp,
		sessionId: msg.sessionId,
		cwd: undefined, // These are stored at session level now
		gitBranch: undefined,
		version: undefined,
		rawJson: msg.rawJson ?? undefined,
		toolName: msg.toolName ?? undefined, // Han event subtype
		agentId: msg.agentId ?? undefined,
		parentId: msg.parentId ?? undefined,
	}));
}

/**
 * @deprecated Use getSessionMessages instead - this is for backwards compatibility
 * Parse session messages synchronously (reads from database)
 */
function parseSessionFile(filePath: string): SessionMessage[] {
	// Extract sessionId from filePath for database lookup
	// Format: ~/.claude/projects/{projectDir}/{sessionId}.jsonl
	const parts = filePath.split("/");
	const filename = parts[parts.length - 1];
	const _sessionId = filename.replace(".jsonl", "");

	// This is a sync wrapper - in practice, callers should use getSessionMessages
	// For now, return empty and rely on async callers
	console.warn(
		"parseSessionFile is deprecated - use getSessionMessages instead",
	);
	return [];
}

/**
 * Get message count for a session from the database
 */
export async function getSessionMessageCount(
	sessionId: string,
): Promise<number> {
	return dbMessages.count(sessionId);
}

/**
 * Get paginated messages for a session from the database
 *
 * @param sessionId - Session ID to fetch messages for
 * @param offset - Pagination offset
 * @param limit - Number of messages to return
 * @param agentIdFilter - Optional agent filter:
 *   - undefined/null: All messages (no agent filtering)
 *   - "": Main conversation only (messages with no agent_id)
 *   - "abc12345": Specific agent's messages only
 */
export async function getSessionMessagesPaginated(
	sessionId: string,
	offset: number,
	limit: number,
	agentIdFilter?: string | null,
): Promise<{
	messages: SessionMessage[];
	totalCount: number;
	hasMore: boolean;
}> {
	const [msgs, totalCount] = await Promise.all([
		dbMessages.list({ sessionId, offset, limit, agentIdFilter }),
		dbMessages.count(sessionId),
	]);

	const messages: SessionMessage[] = msgs.map((msg: Message) => ({
		id: msg.id, // Message UUID for sentiment matching
		type: msg.messageType,
		role: msg.role ?? undefined,
		content: msg.content ?? undefined,
		timestamp: msg.timestamp,
		sessionId: msg.sessionId,
		cwd: undefined,
		gitBranch: undefined,
		version: undefined,
		rawJson: msg.rawJson ?? undefined,
		toolName: msg.toolName ?? undefined, // Han event subtype
		agentId: msg.agentId ?? undefined,
		parentId: msg.parentId ?? undefined,
	}));

	return {
		messages,
		totalCount,
		hasMore: offset + limit < totalCount,
	};
}

/**
 * Get session detail with paginated messages from database
 * More efficient than getSession() for large transcripts
 */
export async function getSessionPaginated(
	sessionId: string,
	messageOffset = 0,
	messageLimit = 100,
): Promise<{
	session: SessionDetail | null;
	totalMessages: number;
	hasMoreMessages: boolean;
}> {
	// Query session from database
	const dbSession = await dbSessions.get(sessionId);
	if (!dbSession) {
		return { session: null, totalMessages: 0, hasMoreMessages: false };
	}

	// Get paginated messages from database
	const { messages, totalCount, hasMore } = await getSessionMessagesPaginated(
		sessionId,
		messageOffset,
		messageLimit,
	);

	if (messages.length === 0 && messageOffset === 0) {
		return { session: null, totalMessages: 0, hasMoreMessages: false };
	}

	const firstMsg = messages[0];
	const lastMsg = messages[messages.length - 1];

	// Extract project info from transcript_path if available
	let projectDir = "";
	let projectPath = "";
	let projectName = "";
	let projectId: string | undefined;
	let worktreeName: string | undefined;

	if (dbSession.transcriptPath) {
		const parts = dbSession.transcriptPath.split("/");
		const projectsIndex = parts.indexOf("projects");
		if (projectsIndex >= 0 && parts[projectsIndex + 1]) {
			projectDir = parts[projectsIndex + 1];
			projectPath = decodeProjectPath(projectDir);
			projectName = getProjectName(projectPath);
			projectId = getProjectId(projectPath);

			const worktreeInfo = getWorktreeInfo(projectPath);
			if (worktreeInfo?.type !== "main") {
				worktreeName = worktreeInfo?.name;
			}
		}
	}

	return {
		session: {
			sessionId,
			date: firstMsg?.timestamp
				? new Date(firstMsg.timestamp).toISOString().split("T")[0]
				: new Date().toISOString().split("T")[0],
			project: projectName,
			projectPath,
			projectDir,
			projectId,
			worktreeName,
			startedAt: firstMsg?.timestamp, // Derived from first message
			endedAt: lastMsg?.timestamp, // Derived from last message
			gitBranch: firstMsg?.gitBranch,
			version: firstMsg?.version,
			messages,
		},
		totalMessages: totalCount,
		hasMoreMessages: hasMore,
	};
}

/**
 * Information about a session file
 */
interface SessionFileInfo {
	sessionId: string;
	filePath: string;
	projectDir: string;
	projectPath: string;
	projectName: string;
	/** Canonical project ID for grouping worktrees */
	projectId: string;
	/** Worktree name if this is part of a multi-worktree project */
	worktreeName?: string;
	/** The type of location: main repo root, linked worktree, or subdirectory */
	locationType?: LocationType;
	/** If this is a subdirectory, the path to the parent worktree */
	parentWorktreePath?: string;
	/** If this is a subdirectory, the relative path from the parent worktree */
	subdirRelativePath?: string;
	mtime: Date;
	/** Timestamp from the last line in the JSONL - the most recent activity */
	lastUpdatedAt?: string;
}

/**
 * Lightweight session file info for fast list loading
 * Does NOT include git-derived fields (projectId, worktreeName, etc.)
 */
interface SessionFileInfoLight {
	sessionId: string;
	filePath: string;
	projectDir: string;
	projectPath: string;
	projectName: string;
	mtime: Date;
	/** Timestamp from the last line in the JSONL - the most recent activity */
	lastUpdatedAt?: string;
}

/**
 * Cache for light session files (expires after 5 seconds)
 */
let lightSessionFilesCache: {
	files: SessionFileInfoLight[];
	timestamp: number;
} | null = null;
const LIGHT_CACHE_TTL = 5000;

/**
 * Get session messages ONLY (reads from database)
 * Use this when you just need messages and don't care about project grouping
 */
export async function getSessionMessagesOnlyAsync(
	sessionId: string,
): Promise<SessionMessage[]> {
	return getSessionMessages(sessionId);
}

/**
 * Get messages for multiple sessions in a batch (for DataLoader)
 *
 * This function fetches messages for multiple sessions concurrently.
 * Used by the GraphQL DataLoader to batch message lookups and avoid N+1 queries.
 *
 * @param sessionIds - Array of session IDs to fetch messages for
 * @returns Map of sessionId -> messages array
 */
export async function getSessionMessagesBatch(
	sessionIds: string[],
): Promise<Map<string, SessionMessage[]>> {
	const results = await Promise.all(
		sessionIds.map(async (sessionId) => {
			const messages = await getSessionMessages(sessionId);
			return [sessionId, messages] as const;
		}),
	);
	return new Map(results);
}

/**
 * Get session messages ONLY (sync wrapper - returns empty for now)
 * @deprecated Use getSessionMessagesOnlyAsync instead
 */
export function getSessionMessagesOnly(_sessionId: string): SessionMessage[] {
	// This sync version can't properly access the async database
	// Callers should migrate to getSessionMessagesOnlyAsync
	console.warn(
		"getSessionMessagesOnly is deprecated - use getSessionMessagesOnlyAsync",
	);
	return [];
}

/**
 * Get all session files with minimal info (FAST - no git operations)
 *
 * This scans the filesystem for session files. The actual session data
 * comes from the database - this is just used to discover files that
 * exist for backwards compatibility during migration.
 *
 * Note: New code should use listSessionsAsync() which reads from the database.
 */
function getAllSessionFilesLight(): SessionFileInfoLight[] {
	// Check cache
	if (
		lightSessionFilesCache &&
		Date.now() - lightSessionFilesCache.timestamp < LIGHT_CACHE_TTL
	) {
		return lightSessionFilesCache.files;
	}

	const projectsPath = getClaudeProjectsPath();

	if (!existsSync(projectsPath)) {
		return [];
	}

	const files: SessionFileInfoLight[] = [];

	// List all project directories
	let projectDirs: string[];
	try {
		projectDirs = readdirSync(projectsPath);
	} catch {
		return [];
	}

	for (const projectDir of projectDirs) {
		const projectDirPath = join(projectsPath, projectDir);

		// Quick check if it's a directory
		try {
			const dirStat = statSync(projectDirPath);
			if (!dirStat.isDirectory()) continue;
		} catch {
			continue;
		}

		const projectPath = decodeProjectPath(projectDir);

		// Skip temp folder paths (test directories)
		if (isTempFolderPath(projectPath)) {
			continue;
		}

		// Skip projects where the source directory no longer exists
		// This filters out stale session data from deleted repositories
		if (!existsSync(projectPath)) {
			continue;
		}

		const projectName = getProjectName(projectPath);

		// List all JSONL files in this project (exclude agent-* files)
		let sessionFiles: string[];
		try {
			sessionFiles = readdirSync(projectDirPath).filter(
				(f) => f.endsWith(".jsonl") && !f.startsWith("agent-"),
			);
		} catch {
			continue;
		}

		for (const sessionFile of sessionFiles) {
			const sessionId = sessionFile.replace(".jsonl", "");
			const filePath = join(projectDirPath, sessionFile);

			try {
				const stats = statSync(filePath);
				// Use file mtime as the last updated time
				// The database has more accurate timestamps but this is for discovery
				files.push({
					sessionId,
					filePath,
					projectDir,
					projectPath,
					projectName,
					mtime: stats.mtime,
					lastUpdatedAt: stats.mtime.toISOString(),
				});
			} catch {
				// Skip files we can't stat
			}
		}
	}

	// Sort by lastUpdatedAt (most recent first), falling back to mtime
	files.sort((a, b) => {
		const aTime = a.lastUpdatedAt || a.mtime.toISOString();
		const bTime = b.lastUpdatedAt || b.mtime.toISOString();
		return bTime.localeCompare(aTime);
	});

	// Cache the result
	lightSessionFilesCache = { files, timestamp: Date.now() };

	return files;
}

/**
 * Get all session files across all projects
 */
function getAllSessionFiles(): SessionFileInfo[] {
	const projectsPath = getClaudeProjectsPath();

	if (!existsSync(projectsPath)) {
		return [];
	}

	const files: SessionFileInfo[] = [];

	// List all project directories
	const projectDirs = readdirSync(projectsPath).filter((d) => {
		const fullPath = join(projectsPath, d);
		return statSync(fullPath).isDirectory();
	});

	for (const projectDir of projectDirs) {
		const projectDirPath = join(projectsPath, projectDir);
		const projectPath = decodeProjectPath(projectDir);

		// Skip temp folder paths (test directories)
		if (isTempFolderPath(projectPath)) {
			continue;
		}

		// Skip projects where the source directory no longer exists
		// This filters out stale session data from deleted repositories
		if (!existsSync(projectPath)) {
			continue;
		}

		const projectName = getProjectName(projectPath);
		const projectId = getProjectId(projectPath);
		const worktreeInfo = getWorktreeInfo(projectPath);
		const worktreeName =
			worktreeInfo?.type !== "main" ? worktreeInfo?.name : undefined;

		// List all JSONL files in this project
		const sessionFiles = readdirSync(projectDirPath).filter((f) =>
			f.endsWith(".jsonl"),
		);

		for (const sessionFile of sessionFiles) {
			const sessionId = sessionFile.replace(".jsonl", "");
			const filePath = join(projectDirPath, sessionFile);

			try {
				const stats = statSync(filePath);
				// Use file mtime as the last updated time
				// More accurate timestamps come from the database
				files.push({
					sessionId,
					filePath,
					projectDir,
					projectPath,
					projectName,
					projectId,
					worktreeName,
					locationType: worktreeInfo?.type,
					parentWorktreePath: worktreeInfo?.parentWorktreePath,
					subdirRelativePath: worktreeInfo?.relativePath,
					mtime: stats.mtime,
					lastUpdatedAt: stats.mtime.toISOString(),
				});
			} catch {
				// Skip files we can't stat
			}
		}
	}

	// Sort by lastUpdatedAt (most recent first), falling back to mtime
	files.sort((a, b) => {
		const aTime = a.lastUpdatedAt || a.mtime.toISOString();
		const bTime = b.lastUpdatedAt || b.mtime.toISOString();
		return bTime.localeCompare(aTime);
	});

	return files;
}

/**
 * Internal worktree tracking during grouping
 */
interface WorktreeTracker {
	path: string;
	isWorktree: boolean;
	sessionCount: number;
	subdirs: Map<
		string,
		{
			relativePath: string;
			path: string;
			sessionCount: number;
		}
	>;
}

/**
 * Get all project groups with their worktrees
 * Groups sessions by canonical project ID to unify worktrees
 * Subdirectories are nested under their parent worktree
 */
export function getProjectGroups(): ProjectGroup[] {
	const allFiles = getAllSessionFiles();
	const groupMap = new Map<
		string,
		{
			repoId: string;
			projectDir: string;
			displayName: string;
			worktrees: Map<string, WorktreeTracker>;
			lastActivity?: Date;
		}
	>();

	for (const file of allFiles) {
		// Group by git remote-based ID (repoId) to keep worktrees together
		let group = groupMap.get(file.projectId);

		if (!group) {
			// Get display name from git remote or git root directory name
			// This ensures repos are named correctly even when first file is from worktree/subdir

			// Use the git root's encoded path as projectDir for consistent navigation
			// This ensures all sessions from the same repo (including subdirs/worktrees) share the same projectDir
			const gitRoot = findGitRoot(file.projectPath);
			const canonicalPath = gitRoot || file.projectPath;
			const canonicalProjectDir = encodeProjectPath(canonicalPath);

			group = {
				repoId: file.projectId,
				projectDir: canonicalProjectDir,
				displayName: getRepoDisplayName(file.projectPath),
				worktrees: new Map(),
				lastActivity: file.mtime,
			};
			groupMap.set(file.projectId, group);
		}

		// Handle subdirectories - nest them under their parent worktree
		if (file.locationType === "subdirectory" && file.parentWorktreePath) {
			// Find or create the parent worktree entry
			const parentPath = file.parentWorktreePath;
			let parentWorktree = group.worktrees.get(parentPath);

			if (!parentWorktree) {
				// Create parent worktree entry if it doesn't exist
				const gitRoot = findGitRoot(parentPath);
				const isLinkedWorktree = gitRoot ? parentPath !== gitRoot : false;
				parentWorktree = {
					path: parentPath,
					isWorktree: isLinkedWorktree,
					sessionCount: 0,
					subdirs: new Map(),
				};
				group.worktrees.set(parentPath, parentWorktree);
			}

			// Add or increment subdirectory count
			const subdirKey = file.subdirRelativePath || file.projectPath;
			const existingSubdir = parentWorktree.subdirs.get(subdirKey);
			if (existingSubdir) {
				existingSubdir.sessionCount++;
			} else {
				parentWorktree.subdirs.set(subdirKey, {
					relativePath: file.subdirRelativePath || file.projectPath,
					path: file.projectPath,
					sessionCount: 1,
				});
			}
		} else {
			// Track worktrees (main repo or linked worktree, not subdirectory)
			const worktreeKey = file.projectPath; // Use path as key for proper deduping
			const existing = group.worktrees.get(worktreeKey);
			if (existing) {
				existing.sessionCount++;
			} else {
				const isLinkedWorktree = file.locationType === "worktree";
				group.worktrees.set(worktreeKey, {
					path: file.projectPath,
					isWorktree: isLinkedWorktree,
					sessionCount: 1,
					subdirs: new Map(),
				});
			}
		}

		// Update last activity if this file is newer
		if (!group.lastActivity || file.mtime > group.lastActivity) {
			group.lastActivity = file.mtime;
		}
	}

	// Convert to array format
	const groups: ProjectGroup[] = [];
	for (const [_projectId, group] of groupMap) {
		const worktrees: WorktreeInfo[] = [];
		let totalSessions = 0;

		for (const [, tracker] of group.worktrees) {
			// Convert subdirs map to array
			const subdirs: SubdirInfo[] = [];
			for (const [, subdir] of tracker.subdirs) {
				subdirs.push({
					relativePath: subdir.relativePath,
					path: subdir.path,
					sessionCount: subdir.sessionCount,
				});
				totalSessions += subdir.sessionCount;
			}

			// Sort subdirs by session count
			subdirs.sort((a, b) => b.sessionCount - a.sessionCount);

			// Get a nice display name for the worktree
			let name: string;
			const gitRoot = findGitRoot(tracker.path);
			if (gitRoot && tracker.path === gitRoot) {
				// Main repo - use project name
				name = getProjectName(tracker.path);
			} else if (tracker.isWorktree) {
				// Linked worktree - get branch info
				const worktreesList = gitRoot ? getWorktreesForRepo(gitRoot) : [];
				const wt = worktreesList.find((w) => w.path === tracker.path);
				const dirName = getProjectName(tracker.path);
				name = wt ? `${dirName} (${wt.branch})` : dirName;
			} else {
				name = getProjectName(tracker.path);
			}

			worktrees.push({
				name,
				path: tracker.path,
				sessionCount: tracker.sessionCount,
				isWorktree: tracker.isWorktree,
				subdirs: subdirs.length > 0 ? subdirs : undefined,
			});
			totalSessions += tracker.sessionCount;
		}

		// Sort worktrees: main repo first, then by session count
		worktrees.sort((a, b) => {
			// Main repo (not a linked worktree) comes first
			if (!a.isWorktree && b.isWorktree) return -1;
			if (a.isWorktree && !b.isWorktree) return 1;
			// Then by session count (including subdirs)
			const aTotal =
				a.sessionCount +
				(a.subdirs?.reduce((sum, s) => sum + s.sessionCount, 0) || 0);
			const bTotal =
				b.sessionCount +
				(b.subdirs?.reduce((sum, s) => sum + s.sessionCount, 0) || 0);
			return bTotal - aTotal;
		});

		groups.push({
			// projectId is the encoded directory path matching ~/.claude/projects
			projectId: group.projectDir,
			// repoId is the git remote-based ID for grouping repos
			repoId: group.repoId,
			displayName: group.displayName,
			worktrees,
			totalSessions,
			lastActivity: group.lastActivity,
		});
	}

	// Sort by last activity (most recent first)
	groups.sort((a, b) => {
		if (!a.lastActivity) return 1;
		if (!b.lastActivity) return -1;
		return b.lastActivity.getTime() - a.lastActivity.getTime();
	});

	return groups;
}

/**
 * List all sessions with pagination from database (async version)
 * This is the preferred method - queries the database directly
 */
export async function listSessionsAsync(
	params: URLSearchParams,
): Promise<PaginatedResponse<SessionListItem>> {
	const startTime = Date.now();
	const page = Math.max(1, Number.parseInt(params.get("page") || "1", 10));
	const pageSize = Math.min(
		100,
		Math.max(1, Number.parseInt(params.get("pageSize") || "20", 10)),
	);
	const projectIdFilter = params.get("projectId");

	// If projectIdFilter is a folder slug (starts with dash), look up the database project ID
	let dbProjectId: string | undefined;
	if (projectIdFilter) {
		const slugStart = Date.now();
		if (projectIdFilter.startsWith("-")) {
			// This is a folder-based slug, look up the project by slug
			const project = await dbProjects.getBySlug(projectIdFilter);
			dbProjectId = project?.id ?? undefined;
		} else {
			// Assume it's already a database UUID
			dbProjectId = projectIdFilter;
		}
		console.log(
			`[listSessionsAsync] Slug lookup took ${Date.now() - slugStart}ms`,
		);
	}

	// Query sessions from database
	// Sessions are sorted by most recent message timestamp (descending) at the DB level
	const dbListStart = Date.now();
	const dbSessionList = await dbSessions.list({
		projectId: dbProjectId,
		limit: 1000, // Reasonable limit - DB handles sorting
	});
	console.log(
		`[listSessionsAsync] dbSessions.list took ${Date.now() - dbListStart}ms, returned ${dbSessionList.length} sessions`,
	);

	// Batch fetch message counts and timestamps for all sessions (fixes N+1 query problem)
	const sessionIds = dbSessionList.map((s) => s.id);
	const batchStart = Date.now();
	const [messageCounts, timestamps] = await Promise.all([
		dbMessages.countBatch(sessionIds),
		dbMessages.timestampsBatch(sessionIds),
	]);
	console.log(
		`[listSessionsAsync] Batch count/timestamp fetch took ${Date.now() - batchStart}ms for ${sessionIds.length} sessions`,
	);

	// Transform to SessionListItem format
	const transformStart = Date.now();
	const data: SessionListItem[] = [];

	for (const session of dbSessionList) {
		// Extract project info from transcript_path
		let projectDir = "";
		let projectPath = "";
		let projectName = "";
		let projectId: string | undefined;

		if (session.transcriptPath) {
			const parts = session.transcriptPath.split("/");
			const projectsIndex = parts.indexOf("projects");
			if (projectsIndex >= 0 && parts[projectsIndex + 1]) {
				projectDir = parts[projectsIndex + 1];
				projectPath = decodeProjectPath(projectDir);
				projectName = getProjectName(projectPath);
				projectId = getProjectId(projectPath);
			}
		}

		// Use pre-fetched message count and timestamps
		const messageCount = messageCounts[session.id] ?? 0;
		const sessionTimestamps = timestamps[session.id];

		data.push({
			sessionId: session.id,
			date:
				sessionTimestamps?.startedAt?.split("T")[0] ??
				new Date().toISOString().split("T")[0],
			project: projectName,
			projectPath,
			projectDir,
			projectId,
			summary: undefined, // TODO: Store summary in database
			messageCount,
			startedAt: sessionTimestamps?.startedAt,
			endedAt: sessionTimestamps?.endedAt,
			gitBranch: undefined, // TODO: Store in database
			version: undefined, // TODO: Store in database
		});
	}
	console.log(
		`[listSessionsAsync] Transform loop took ${Date.now() - transformStart}ms for ${data.length} items`,
	);

	// Data is already sorted by the database (most recent first)

	// Apply pagination
	const total = data.length;
	const startIndex = (page - 1) * pageSize;
	const endIndex = Math.min(startIndex + pageSize, total);
	const pageData = data.slice(startIndex, endIndex);

	console.log(`[listSessionsAsync] Total time: ${Date.now() - startTime}ms`);

	return {
		data: pageData,
		page,
		pageSize,
		total,
		hasMore: endIndex < total,
	};
}

/**
 * List all sessions with pagination (sync version - uses filesystem discovery)
 * @deprecated Use listSessionsAsync instead for database-backed queries
 *
 * Note: This version returns basic file info without message details.
 * For full session data, use listSessionsAsync or getSessionAsync.
 */
export function listSessions(
	params: URLSearchParams,
): PaginatedResponse<SessionListItem> {
	const page = Math.max(1, Number.parseInt(params.get("page") || "1", 10));
	const pageSize = Math.min(
		100,
		Math.max(1, Number.parseInt(params.get("pageSize") || "20", 10)),
	);
	const projectFilter = params.get("project");
	const worktreeFilter = params.get("worktree");
	const projectIdFilter = params.get("projectId");

	// Use the fast version that skips git operations
	let allFiles = getAllSessionFilesLight();

	// Filter by specific worktree path
	if (worktreeFilter) {
		allFiles = allFiles.filter((f) =>
			f.projectPath.toLowerCase().includes(worktreeFilter.toLowerCase()),
		);
	}

	// Filter by project name/path
	if (projectFilter) {
		allFiles = allFiles.filter(
			(f) =>
				f.projectName.toLowerCase().includes(projectFilter.toLowerCase()) ||
				f.projectPath.toLowerCase().includes(projectFilter.toLowerCase()),
		);
	}

	// Filter by projectId - supports both formats:
	// 1. Folder-based encoded path (e.g., "-Volumes-dev-src-github-com-org-repo")
	// 2. Git remote-based ID (e.g., "github-com-org-repo")
	if (projectIdFilter) {
		allFiles = allFiles.filter((f) => {
			// First, try matching against projectDir (folder-based encoded path)
			if (f.projectDir === projectIdFilter) {
				return true;
			}
			// Fallback: try matching against git remote-based ID
			const fileProjectId = getProjectId(f.projectPath);
			return fileProjectId === projectIdFilter;
		});
	}

	// Calculate pagination
	const total = allFiles.length;
	const startIndex = (page - 1) * pageSize;
	const endIndex = Math.min(startIndex + pageSize, total);

	// Files are already sorted by lastUpdatedAt in getAllSessionFilesLight()
	// Apply pagination first
	const pageFiles = allFiles.slice(startIndex, endIndex);

	// Build session list items for just this page
	// Note: This returns basic file info - message counts come from database
	const data: SessionListItem[] = pageFiles.map((fileInfo) => {
		const projectId = getProjectId(fileInfo.projectPath);

		return {
			sessionId: fileInfo.sessionId,
			date: fileInfo.mtime.toISOString().split("T")[0],
			project: fileInfo.projectName,
			projectPath: fileInfo.projectPath,
			projectDir: fileInfo.projectDir,
			projectId,
			summary: undefined, // Loaded async from database
			messageCount: 0, // Loaded async from database
			startedAt: undefined, // Loaded async from database
			endedAt: fileInfo.lastUpdatedAt,
			gitBranch: undefined,
			version: undefined,
		};
	});

	return {
		data,
		page,
		pageSize,
		total,
		hasMore: endIndex < total,
	};
}

/**
 * Session cache to avoid repeated file reads during the same request
 * Cache entries expire after 5 seconds
 */
const sessionCache = new Map<
	string,
	{ data: SessionDetail; timestamp: number }
>();
const SESSION_CACHE_TTL = 5000; // 5 seconds

/**
 * Get session detail with messages from database (with caching)
 * This is an async function that queries the database
 */
export async function getSessionAsync(
	sessionId: string,
): Promise<SessionDetail | null> {
	// Check cache first
	const cached = sessionCache.get(sessionId);
	if (cached && Date.now() - cached.timestamp < SESSION_CACHE_TTL) {
		return cached.data;
	}

	// Query session from database
	const dbSession = await dbSessions.get(sessionId);
	if (!dbSession) {
		return null;
	}

	// Get messages from database
	const messages = await getSessionMessages(sessionId);

	if (messages.length === 0) {
		return null;
	}

	const firstMsg = messages[0];
	const lastMsg = messages[messages.length - 1];

	// Extract project info from transcript_path if available
	// Format: ~/.claude/projects/{projectDir}/{sessionId}.jsonl
	let projectDir = "";
	let projectPath = "";
	let projectName = "";
	let projectId: string | undefined;
	let worktreeName: string | undefined;

	if (dbSession.transcriptPath) {
		const parts = dbSession.transcriptPath.split("/");
		const projectsIndex = parts.indexOf("projects");
		if (projectsIndex >= 0 && parts[projectsIndex + 1]) {
			projectDir = parts[projectsIndex + 1];
			projectPath = decodeProjectPath(projectDir);
			projectName = getProjectName(projectPath);
			projectId = getProjectId(projectPath);

			const worktreeInfo = getWorktreeInfo(projectPath);
			if (worktreeInfo?.type !== "main") {
				worktreeName = worktreeInfo?.name;
			}
		}
	}

	const session: SessionDetail = {
		sessionId,
		date: firstMsg?.timestamp
			? new Date(firstMsg.timestamp).toISOString().split("T")[0]
			: new Date().toISOString().split("T")[0],
		project: projectName,
		projectPath,
		projectDir,
		projectId,
		worktreeName,
		startedAt: firstMsg?.timestamp, // Derived from first message
		endedAt: lastMsg?.timestamp, // Derived from last message
		gitBranch: firstMsg?.gitBranch,
		version: firstMsg?.version,
		messages,
	};

	// Cache the result
	sessionCache.set(sessionId, { data: session, timestamp: Date.now() });

	// Clean up old cache entries (keep max 100)
	if (sessionCache.size > 100) {
		const entries = Array.from(sessionCache.entries());
		entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
		for (let i = 0; i < entries.length - 50; i++) {
			sessionCache.delete(entries[i][0]);
		}
	}

	return session;
}

/**
 * Get session detail with messages (sync wrapper for backwards compatibility)
 * @deprecated Use getSessionAsync instead
 */
export function getSession(sessionId: string): SessionDetail | null {
	// Check cache first (fast path)
	const cached = sessionCache.get(sessionId);
	if (cached && Date.now() - cached.timestamp < SESSION_CACHE_TTL) {
		return cached.data;
	}

	// For backwards compat, try to get session synchronously from filesystem
	// This path should be deprecated in favor of async database access
	const allFiles = getAllSessionFiles();
	const fileInfo = allFiles.find((f) => f.sessionId === sessionId);

	if (!fileInfo) {
		return null;
	}

	// Build session from file info without messages (messages loaded separately)
	const session: SessionDetail = {
		sessionId: fileInfo.sessionId,
		date: fileInfo.mtime.toISOString().split("T")[0],
		project: fileInfo.projectName,
		projectPath: fileInfo.projectPath,
		projectDir: fileInfo.projectDir,
		projectId: fileInfo.projectId,
		worktreeName: fileInfo.worktreeName,
		startedAt: fileInfo.lastUpdatedAt,
		endedAt: fileInfo.lastUpdatedAt,
		messages: [], // Messages loaded separately via async
	};

	// Cache the result
	sessionCache.set(sessionId, { data: session, timestamp: Date.now() });

	return session;
}

/**
 * Get all agent tasks for a session
 */
export function getAgentTasksForSession(sessionId: string): string[] {
	const allFiles = getAllSessionFiles();
	const sessionFile = allFiles.find((f) => f.sessionId === sessionId);

	if (!sessionFile) {
		return [];
	}

	// Agent files are in the same project directory as the session
	const projectDirPath = sessionFile.filePath.replace(
		`/${sessionFile.sessionId}.jsonl`,
		"",
	);

	try {
		const files = readdirSync(projectDirPath);
		return files
			.filter((f) => f.startsWith("agent-") && f.endsWith(".jsonl"))
			.map((f) => f.replace("agent-", "").replace(".jsonl", ""));
	} catch {
		return [];
	}
}

/**
 * Get agent task detail
 */
export function getAgentTask(
	sessionId: string,
	agentId: string,
): SessionDetail | null {
	const allFiles = getAllSessionFiles();
	const sessionFile = allFiles.find((f) => f.sessionId === sessionId);

	if (!sessionFile) {
		return null;
	}

	// Construct agent file path
	const agentFilePath = sessionFile.filePath.replace(
		`${sessionId}.jsonl`,
		`agent-${agentId}.jsonl`,
	);

	if (!existsSync(agentFilePath)) {
		return null;
	}

	const messages = parseSessionFile(agentFilePath);

	if (messages.length === 0) {
		return null;
	}

	const firstMsg = messages[0];
	const lastMsg = messages[messages.length - 1];
	const stats = statSync(agentFilePath);

	return {
		sessionId: agentId,
		date: stats.mtime.toISOString().split("T")[0],
		project: sessionFile.projectName,
		projectPath: sessionFile.projectPath,
		projectDir: sessionFile.projectDir,
		projectId: sessionFile.projectId,
		startedAt: firstMsg?.timestamp,
		endedAt: lastMsg?.timestamp,
		gitBranch: firstMsg?.gitBranch,
		version: firstMsg?.version,
		messages,
	};
}

/**
 * Handle sessions API requests
 */
export async function handleSessionsRequest(req: Request): Promise<Response> {
	const url = new URL(req.url);
	const path = url.pathname;

	// Extract session ID from path: /api/sessions/:id
	const sessionIdMatch = path.match(/^\/api\/sessions\/([^/]+)$/);

	try {
		if (sessionIdMatch) {
			// GET /api/sessions/:id
			const sessionId = decodeURIComponent(sessionIdMatch[1]);
			const session = getSession(sessionId);

			if (!session) {
				return new Response(
					JSON.stringify({
						error: "Session not found",
						details: `No session with ID: ${sessionId}`,
					}),
					{ status: 404, headers: { "Content-Type": "application/json" } },
				);
			}

			return new Response(JSON.stringify(session), {
				headers: { "Content-Type": "application/json" },
			});
		}

		// GET /api/sessions
		const result = listSessions(url.searchParams);
		return new Response(JSON.stringify(result), {
			headers: { "Content-Type": "application/json" },
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return new Response(
			JSON.stringify({ error: "Internal server error", details: message }),
			{ status: 500, headers: { "Content-Type": "application/json" } },
		);
	}
}
