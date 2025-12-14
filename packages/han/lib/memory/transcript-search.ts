/**
 * Han Transcript Search (Layer 4)
 *
 * Provides search capabilities over Claude Code conversation transcripts.
 * Transcripts are stored at ~/.claude/projects/{slug}/*.jsonl
 *
 * Key features:
 * - Parse and search JSONL transcript files
 * - Support cross-worktree search (find context from peer worktrees)
 * - Index transcripts into FTS for fast search
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
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
 */
export function getClaudeProjectsDir(): string {
	return join(homedir(), ".claude", "projects");
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
function extractContentText(
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
 */
export function parseTranscript(
	filePath: string,
	options: { includeThinking?: boolean; since?: number } = {},
): TranscriptMessage[] {
	if (!existsSync(filePath)) {
		return [];
	}

	const messages: TranscriptMessage[] = [];
	const projectSlug = basename(dirname(filePath));
	const content = readFileSync(filePath, "utf-8");
	const lines = content.split("\n").filter((line) => line.trim());

	for (const line of lines) {
		try {
			const entry = JSON.parse(line) as TranscriptEntry;

			// Skip non-message entries
			if (entry.type !== "user" && entry.type !== "assistant") {
				continue;
			}

			// Skip meta messages
			if (entry.isMeta) {
				continue;
			}

			// Skip if no message content
			if (!entry.message?.content) {
				continue;
			}

			// Filter by timestamp if specified
			if (options.since && entry.timestamp) {
				const entryTime = new Date(entry.timestamp).getTime();
				if (entryTime < options.since) {
					continue;
				}
			}

			const sessionId = entry.sessionId || basename(filePath, ".jsonl");
			const { text, thinking } = extractContentText(
				entry.message.content,
				options.includeThinking,
			);

			// Skip empty messages
			if (!text.trim()) {
				continue;
			}

			messages.push({
				sessionId,
				projectSlug,
				messageId: entry.uuid || "",
				timestamp: entry.timestamp || "",
				type: entry.type as "user" | "assistant",
				content: text,
				thinking,
				cwd: entry.cwd,
				gitBranch: entry.gitBranch,
			});
		} catch {
			// Skip invalid JSON lines
		}
	}

	return messages;
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
			const messages = parseTranscript(file, options);
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
 */
export function searchTranscriptsText(
	options: TranscriptSearchOptions,
): TranscriptSearchResult[] {
	const { query, limit = 10, scope = "current" } = options;
	const queryLower = query.toLowerCase();
	const results: TranscriptSearchResult[] = [];

	// Determine which projects to search
	const transcriptFiles = findAllTranscriptFiles();
	let projectSlugs: string[];

	if (options.projectSlug) {
		projectSlugs = [options.projectSlug];
	} else if (scope === "current") {
		const cwd = process.cwd();
		const slug = pathToSlug(cwd);
		projectSlugs = [slug];
	} else if (scope === "peers" && options.gitRemote) {
		projectSlugs = findPeerProjects(options.gitRemote);
	} else {
		projectSlugs = Array.from(transcriptFiles.keys());
	}

	const currentSlug = pathToSlug(process.cwd());

	for (const slug of projectSlugs) {
		const files = transcriptFiles.get(slug);
		if (!files) continue;

		for (const file of files) {
			const messages = parseTranscript(file, {
				since: options.since,
				includeThinking: options.includeThinking,
			});

			for (const message of messages) {
				const contentLower = message.content.toLowerCase();
				if (contentLower.includes(queryLower)) {
					// Calculate simple relevance score
					const words = queryLower.split(/\s+/);
					let matchCount = 0;
					for (const word of words) {
						if (contentLower.includes(word)) matchCount++;
					}
					const score = matchCount / words.length;

					const isPeer =
						slug !== currentSlug && arePeerWorktrees(currentSlug, slug);

					results.push({
						sessionId: message.sessionId,
						projectSlug: slug,
						projectPath: slugToPath(slug),
						timestamp: message.timestamp,
						type: message.type,
						excerpt:
							message.content.length > 300
								? `${message.content.slice(0, 300)}...`
								: message.content,
						score,
						isPeerWorktree: isPeer,
						layer: "transcripts",
					});
				}
			}
		}
	}

	// Sort by score and limit
	return results.sort((a, b) => b.score - a.score).slice(0, limit);
}
