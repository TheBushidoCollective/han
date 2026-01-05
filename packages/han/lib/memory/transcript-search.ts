/**
 * Han Transcript Search (Layer 4)
 *
 * Provides search capabilities over Claude Code conversation transcripts.
 * Transcripts are indexed into SQLite by the Rust coordinator.
 *
 * IMPORTANT: This module queries the SQLite database - it does NOT read JSONL files directly.
 * The coordinator handles JSONL → SQLite indexing.
 *
 * Key features:
 * - Search transcripts via database queries
 * - Support cross-worktree search (find context from peer worktrees)
 * - FTS5 full-text search via native module
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import {
	getTableName,
	type IndexDocument,
	indexDocuments,
	initTable,
	searchFts,
} from "./indexer.ts";
import { getGitRemote, normalizeGitRemote } from "./paths.ts";

/**
 * Transcript message types
 */
export type TranscriptMessageType =
	| "user"
	| "assistant"
	| "file-history-snapshot"
	| "summary";

/**
 * Content block types in assistant messages
 */
export type ContentBlockType = "text" | "thinking" | "tool_use" | "tool_result";

/**
 * A single content block from an assistant message
 */
export interface ContentBlock {
	type: ContentBlockType;
	text?: string;
	thinking?: string;
	name?: string;
	input?: unknown;
}

/**
 * Raw transcript entry from JSONL file
 */
export interface TranscriptEntry {
	type: TranscriptMessageType;
	uuid?: string;
	parentUuid?: string;
	sessionId?: string;
	timestamp?: string;
	cwd?: string;
	gitBranch?: string;
	isMeta?: boolean;
	message?: {
		role: "user" | "assistant";
		content: string | ContentBlock[];
		model?: string;
	};
}

/**
 * Parsed transcript message for search
 */
export interface TranscriptMessage {
	sessionId: string;
	projectSlug: string;
	messageId: string;
	timestamp: string;
	type: "user" | "assistant";
	content: string;
	thinking?: string;
	cwd?: string;
	gitBranch?: string;
}

/**
 * Native Claude summary from transcript (Layer 2)
 * These are auto-generated when context window compression occurs.
 */
export interface NativeSummary {
	sessionId: string;
	projectSlug: string;
	messageId: string;
	timestamp: string;
	content: string;
	isContextWindowCompression: boolean;
}

/**
 * Search options for transcript search
 */
export interface TranscriptSearchOptions {
	query: string;
	projectSlug?: string;
	gitRemote?: string;
	since?: number;
	limit?: number;
	scope?: "current" | "peers" | "all";
	includeThinking?: boolean;
}

/**
 * Search result from transcript search
 */
export interface TranscriptSearchResult {
	sessionId: string;
	projectSlug: string;
	projectPath: string;
	timestamp: string;
	type: "user" | "assistant";
	excerpt: string;
	context?: { before?: string; after?: string };
	score: number;
	isPeerWorktree: boolean;
	layer: "transcripts";
}

/**
 * Get the Claude projects directory
 * Uses process.env.HOME for testability
 */
export function getClaudeProjectsDir(): string {
	const home = process.env.HOME || homedir();
	return join(home, ".claude", "projects");
}

/**
 * Convert a filesystem path to Claude project slug
 * e.g., /Volumes/dev/src/github.com/foo -> -Volumes-dev-src-github-com-foo
 */
export function pathToSlug(path: string): string {
	return path.replace(/[/.]/g, "-");
}

/**
 * Convert a Claude project slug back to filesystem path
 * e.g., -Volumes-dev-src-github-com-foo -> /Volumes/dev/src/github.com/foo
 *
 * Note: This is a heuristic reverse mapping. The slug format loses information
 * about whether a character was originally '/' or '.', so we use common patterns.
 */
export function slugToPath(slug: string): string {
	// Remove leading dash
	let path = slug.startsWith("-") ? slug.slice(1) : slug;

	// Common patterns to restore
	// /Volumes/... (macOS)
	if (path.startsWith("Volumes-")) {
		path = `/Volumes/${path.slice(8).replace(/-/g, "/")}`;
	}
	// /Users/... (macOS/Linux)
	else if (path.startsWith("Users-")) {
		path = `/Users/${path.slice(6).replace(/-/g, "/")}`;
	}
	// /home/... (Linux)
	else if (path.startsWith("home-")) {
		path = `/home/${path.slice(5).replace(/-/g, "/")}`;
	}
	// /var/... (temp directories)
	else if (path.startsWith("var-")) {
		path = `/var/${path.slice(4).replace(/-/g, "/")}`;
	}
	// /tmp/... (temp directories)
	else if (path.startsWith("tmp-") || path.startsWith("private-tmp-")) {
		path = `/${path.replace(/-/g, "/")}`;
	}
	// C:\... (Windows)
	else if (/^[A-Z]-/.test(path)) {
		path = `${path[0]}:\\${path.slice(2).replace(/-/g, "\\")}`;
	}
	// Default: assume Unix-style path
	else {
		path = `/${path.replace(/-/g, "/")}`;
	}

	// Restore common domain patterns
	path = path
		.replace(/github\/com/g, "github.com")
		.replace(/gitlab\/com/g, "gitlab.com")
		.replace(/bitbucket\/org/g, "bitbucket.org");

	return path;
}

/**
 * Find all transcript files across all projects
 * Returns a map of project slug -> array of transcript file paths
 */
export function findAllTranscriptFiles(): Map<string, string[]> {
	const projectsDir = getClaudeProjectsDir();
	const result = new Map<string, string[]>();

	if (!existsSync(projectsDir)) {
		return result;
	}

	const projects = readdirSync(projectsDir);

	for (const slug of projects) {
		const projectPath = join(projectsDir, slug);

		// Skip non-directories
		try {
			if (!statSync(projectPath).isDirectory()) {
				continue;
			}
		} catch {
			continue;
		}

		// Find all .jsonl files in the project
		const files = readdirSync(projectPath)
			.filter((f) => f.endsWith(".jsonl"))
			.map((f) => join(projectPath, f));

		if (files.length > 0) {
			result.set(slug, files);
		}
	}

	return result;
}

/**
 * Find project slugs that share the same git remote (peer worktrees)
 */
export function findPeerProjects(gitRemote: string): string[] {
	const projectsDir = getClaudeProjectsDir();
	const peers: string[] = [];

	if (!existsSync(projectsDir)) {
		return peers;
	}

	const normalizedRemote = normalizeGitRemote(gitRemote);
	const projects = readdirSync(projectsDir);

	for (const slug of projects) {
		const projectPath = join(projectsDir, slug);

		// Skip non-directories
		try {
			if (!statSync(projectPath).isDirectory()) {
				continue;
			}
		} catch {
			continue;
		}

		// Try to get git remote from the original path
		const originalPath = slugToPath(slug);
		const remote = getGitRemote(originalPath);

		if (remote && normalizeGitRemote(remote) === normalizedRemote) {
			peers.push(slug);
		}
	}

	return peers;
}

/**
 * Check if two project slugs are peer worktrees (same git remote)
 */
export function arePeerWorktrees(slug1: string, slug2: string): boolean {
	const path1 = slugToPath(slug1);
	const path2 = slugToPath(slug2);

	const remote1 = getGitRemote(path1);
	const remote2 = getGitRemote(path2);

	if (!remote1 || !remote2) {
		return false;
	}

	return normalizeGitRemote(remote1) === normalizeGitRemote(remote2);
}

/**
 * Extract text content from assistant message content blocks
 */
function _extractContentText(
	content: string | ContentBlock[],
	includeThinking = false,
): { text: string; thinking?: string } {
	if (typeof content === "string") {
		return { text: content };
	}

	const textParts: string[] = [];
	let thinking: string | undefined;

	for (const block of content) {
		if (block.type === "text" && block.text) {
			textParts.push(block.text);
		} else if (block.type === "thinking" && block.thinking && includeThinking) {
			thinking = block.thinking;
		}
	}

	return { text: textParts.join("\n"), thinking };
}

/**
 * Parse a single transcript file into searchable messages
 *
 * @deprecated This function reads JSONL files directly. Use getSessionMessages() instead,
 * which queries the SQLite database populated by the Rust coordinator.
 *
 * This function is kept for backward compatibility during the migration period.
 * It now queries the database when possible, falling back to file reading only
 * if the session is not yet indexed.
 */
export async function parseTranscript(
	filePath: string,
	options: { includeThinking?: boolean; since?: number } = {},
): Promise<TranscriptMessage[]> {
	// Import database access
	const { messages: dbMessages, withFreshData } = await import(
		"../db/index.ts"
	);

	const projectSlug = basename(dirname(filePath));
	const sessionId = basename(filePath, ".jsonl").replace(/-han$/, "");

	// Query the database for this session's messages
	return withFreshData(async () => {
		const msgs = await dbMessages.list({
			sessionId,
			agentIdFilter: "", // Main conversation only
		});

		const transcriptMessages: TranscriptMessage[] = [];

		for (const msg of msgs) {
			// Only process user and assistant messages
			if (msg.role !== "user" && msg.role !== "assistant") {
				continue;
			}

			// Filter by timestamp if specified
			if (options.since && msg.timestamp) {
				const entryTime = new Date(msg.timestamp).getTime();
				if (entryTime < options.since) {
					continue;
				}
			}

			// Skip empty messages
			const content = msg.content || "";
			if (!content.trim()) {
				continue;
			}

			transcriptMessages.push({
				sessionId: msg.sessionId,
				projectSlug,
				messageId: msg.id,
				timestamp: msg.timestamp,
				type: msg.role as "user" | "assistant",
				content,
				thinking: undefined, // Thinking is not stored separately in the DB
				cwd: undefined, // CWD is not stored separately in the DB
				gitBranch: undefined, // Git branch is not stored separately in the DB
			});
		}

		return transcriptMessages;
	});
}

/**
 * Parse native summaries from a transcript file (Layer 2)
 * Extracts 'summary' type messages from Claude transcripts.
 *
 * @deprecated This function reads JSONL files directly. Use database queries instead.
 * The Rust coordinator indexes summaries into the session_summaries table.
 */
export async function parseSummaries(
	filePath: string,
): Promise<NativeSummary[]> {
	// Import database access
	const { getDbPath, initDb } = await import("../db/index.ts");
	const native = await import("../native.ts").then((m) =>
		m.tryGetNativeModule(),
	);

	if (!native) {
		return [];
	}

	const projectSlug = basename(dirname(filePath));
	const sessionId = basename(filePath, ".jsonl").replace(/-han$/, "");

	try {
		await initDb();
		const dbPath = getDbPath();

		// Query session summary from database
		const summary = native.getSessionSummary(dbPath, sessionId);

		if (!summary || !summary.content) {
			return [];
		}

		return [
			{
				sessionId: summary.sessionId,
				projectSlug,
				messageId: summary.messageId,
				timestamp: summary.timestamp,
				content: summary.content,
				isContextWindowCompression: true,
			},
		];
	} catch {
		return [];
	}
}

/**
 * Convert a NativeSummary to an IndexDocument for FTS
 */
function summaryToIndexDocument(summary: NativeSummary): IndexDocument {
	return {
		id: `summary:${summary.sessionId}:${summary.messageId}`,
		content: summary.content,
		metadata: JSON.stringify({
			sessionId: summary.sessionId,
			projectSlug: summary.projectSlug,
			messageId: summary.messageId,
			timestamp: summary.timestamp,
			isContextWindowCompression: summary.isContextWindowCompression,
			layer: "summaries",
		}),
	};
}

/**
 * Index native summaries from transcripts for a specific project
 *
 * @deprecated This function uses the legacy TS FTS system. The Rust coordinator
 * already indexes summaries directly to SQLite. Use messages.search() instead.
 */
export async function indexNativeSummaries(
	projectSlug?: string,
): Promise<number> {
	const transcriptFiles = findAllTranscriptFiles();

	// Filter to specific project if provided
	const slugsToIndex = projectSlug
		? [projectSlug]
		: Array.from(transcriptFiles.keys());

	const tableName = getTableName("summaries");
	await initTable(tableName);

	let totalIndexed = 0;

	for (const slug of slugsToIndex) {
		const files = transcriptFiles.get(slug);
		if (!files) continue;

		const documents: IndexDocument[] = [];

		for (const file of files) {
			const summaries = await parseSummaries(file);
			for (const summary of summaries) {
				documents.push(summaryToIndexDocument(summary));
			}
		}

		if (documents.length > 0) {
			const count = await indexDocuments(tableName, documents);
			totalIndexed += count;
		}
	}

	return totalIndexed;
}

/**
 * Search native summaries using FTS
 */
export async function searchNativeSummaries(
	query: string,
	options: { projectSlug?: string; limit?: number } = {},
): Promise<
	Array<{
		sessionId: string;
		projectSlug: string;
		content: string;
		timestamp: string;
		score: number;
		layer: "summaries";
	}>
> {
	const { limit = 10 } = options;
	const tableName = getTableName("summaries");

	const results = await searchFts(tableName, query, limit);

	return results.map((result) => {
		const meta = result.metadata || {};
		return {
			sessionId: meta.sessionId as string,
			projectSlug: meta.projectSlug as string,
			content:
				result.content.length > 500
					? `${result.content.slice(0, 500)}...`
					: result.content,
			timestamp: meta.timestamp as string,
			score: result.score,
			layer: "summaries" as const,
		};
	});
}

/**
 * Convert a TranscriptMessage to an IndexDocument for FTS
 */
function messageToDocument(message: TranscriptMessage): IndexDocument {
	const content = [
		message.content,
		message.thinking ? `Thinking: ${message.thinking}` : "",
	]
		.filter(Boolean)
		.join("\n\n");

	return {
		id: `${message.sessionId}:${message.messageId}`,
		content,
		metadata: JSON.stringify({
			sessionId: message.sessionId,
			projectSlug: message.projectSlug,
			messageId: message.messageId,
			timestamp: message.timestamp,
			type: message.type,
			cwd: message.cwd,
			gitBranch: message.gitBranch,
			layer: "transcripts",
		}),
	};
}

/**
 * Index transcripts for a specific project into FTS
 *
 * @deprecated This function uses the legacy TS FTS system. The Rust coordinator
 * already indexes transcripts directly to SQLite with FTS5. Use messages.search() instead.
 */
export async function indexTranscripts(
	projectSlug?: string,
	options: { since?: number; includeThinking?: boolean } = {},
): Promise<number> {
	const transcriptFiles = findAllTranscriptFiles();

	// Filter to specific project if provided
	const slugsToIndex = projectSlug
		? [projectSlug]
		: Array.from(transcriptFiles.keys());

	const tableName = getTableName("transcripts");
	await initTable(tableName);

	let totalIndexed = 0;

	for (const slug of slugsToIndex) {
		const files = transcriptFiles.get(slug);
		if (!files) continue;

		const documents: IndexDocument[] = [];

		for (const file of files) {
			const messages = await parseTranscript(file, options);
			for (const message of messages) {
				documents.push(messageToDocument(message));
			}
		}

		if (documents.length > 0) {
			const count = await indexDocuments(tableName, documents);
			totalIndexed += count;
		}
	}

	return totalIndexed;
}

/**
 * Search transcripts using FTS
 */
export async function searchTranscripts(
	options: TranscriptSearchOptions,
): Promise<TranscriptSearchResult[]> {
	const { query, limit = 10, scope = "current" } = options;

	// Determine which projects to search
	let projectSlugs: string[] = [];

	if (options.projectSlug) {
		projectSlugs = [options.projectSlug];
	} else if (scope === "current") {
		// Get current project slug
		const cwd = process.cwd();
		const slug = pathToSlug(cwd);
		projectSlugs = [slug];
	} else if (scope === "peers" && options.gitRemote) {
		projectSlugs = findPeerProjects(options.gitRemote);
	} else if (scope === "all") {
		const allFiles = findAllTranscriptFiles();
		projectSlugs = Array.from(allFiles.keys());
	}

	// Search FTS index
	const tableName = getTableName("transcripts");
	const results = await searchFts(tableName, query, limit * 2); // Get more results for filtering

	// Convert to TranscriptSearchResult
	const searchResults: TranscriptSearchResult[] = [];
	const currentSlug = pathToSlug(process.cwd());

	for (const result of results) {
		const meta = result.metadata || {};
		const projectSlug = meta.projectSlug as string;

		// Filter by project scope
		if (projectSlugs.length > 0 && !projectSlugs.includes(projectSlug)) {
			continue;
		}

		// Filter by timestamp if specified
		if (options.since && meta.timestamp) {
			const entryTime = new Date(meta.timestamp as string).getTime();
			if (entryTime < options.since) {
				continue;
			}
		}

		const isPeer =
			projectSlug !== currentSlug && arePeerWorktrees(currentSlug, projectSlug);

		searchResults.push({
			sessionId: meta.sessionId as string,
			projectSlug,
			projectPath: slugToPath(projectSlug),
			timestamp: meta.timestamp as string,
			type: meta.type as "user" | "assistant",
			excerpt:
				result.content.length > 300
					? `${result.content.slice(0, 300)}...`
					: result.content,
			score: result.score,
			isPeerWorktree: isPeer,
			layer: "transcripts",
		});

		if (searchResults.length >= limit) {
			break;
		}
	}

	return searchResults;
}

/**
 * Quick text-based search without FTS (for immediate results before index is ready)
 *
 * @deprecated This function is superseded by messages.search() which uses FTS5.
 * The Rust coordinator now keeps the database up-to-date, so FTS is always available.
 */
export async function searchTranscriptsText(
	options: TranscriptSearchOptions,
): Promise<TranscriptSearchResult[]> {
	// Use the database FTS instead of brute-force file reading
	const { messages: dbMessages, withFreshData } = await import(
		"../db/index.ts"
	);

	const { query, limit = 10 } = options;

	return withFreshData(async () => {
		// Use FTS search from the database
		const searchResults = await dbMessages.search({
			query,
			sessionId: undefined, // Search all sessions
			limit: limit * 2, // Get extra for filtering
		});

		const results: TranscriptSearchResult[] = [];

		for (const msg of searchResults) {
			// Only process user and assistant messages
			if (msg.role !== "user" && msg.role !== "assistant") {
				continue;
			}

			// Skip empty messages
			const content = msg.content || "";
			if (!content.trim()) {
				continue;
			}

			// Calculate simple relevance score based on content match
			const contentLower = content.toLowerCase();
			const queryLower = query.toLowerCase();
			const words = queryLower.split(/\s+/);
			let matchCount = 0;
			for (const word of words) {
				if (contentLower.includes(word)) matchCount++;
			}
			const score = matchCount / words.length;

			// Note: We don't have project slug in the message, so we use empty string
			// The database stores messages by session, not by project
			const projectSlug = "";

			results.push({
				sessionId: msg.sessionId,
				projectSlug,
				projectPath: slugToPath(projectSlug),
				timestamp: msg.timestamp,
				type: msg.role as "user" | "assistant",
				excerpt: content.length > 300 ? `${content.slice(0, 300)}...` : content,
				score,
				isPeerWorktree: false, // Can't determine without project info
				layer: "transcripts",
			});

			if (results.length >= limit) {
				break;
			}
		}

		// Sort by score and limit
		return results.sort((a, b) => b.score - a.score).slice(0, limit);
	});
}
