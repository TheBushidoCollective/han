/**
 * Summaries API - List and retrieve session summaries
 *
 * GET /api/summaries - List all summaries with pagination
 * GET /api/summaries/:id - Get summary detail
 *
 * Uses transcript-based summarization to produce rich summaries with
 * work_items, decisions, and in_progress tracking.
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { summarizeTranscriptFile } from "../memory/transcript-summary.ts";
import type { SessionSummary } from "../memory/types.ts";

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
 * Session file metadata for sorting/filtering before summarization
 */
interface SessionFile {
	sessionId: string;
	projectPath: string;
	projectName: string;
	filePath: string;
	mtime: Date;
}

/**
 * Get the Claude Code projects directory
 */
function getClaudeProjectsPath(): string {
	return join(homedir(), ".claude", "projects");
}

/**
 * Decode project path from directory name
 * e.g., "-Volumes-dev-src-github-com-foo-bar" -> "/Volumes/dev/src/github.com/foo/bar"
 */
function decodeProjectPath(dirName: string): string {
	if (dirName.startsWith("-")) {
		return `/${dirName.slice(1).replace(/-/g, "/")}`;
	}
	return dirName.replace(/-/g, "/");
}

/**
 * Get project name from path (last component)
 */
function getProjectName(projectPath: string): string {
	const parts = projectPath.split("/").filter(Boolean);
	return parts[parts.length - 1] || projectPath;
}

/**
 * Get all session files from Claude Code projects
 * Returns metadata needed for pagination and filtering before summarization
 */
function getAllSessionFiles(): SessionFile[] {
	const projectsPath = getClaudeProjectsPath();
	const sessions: SessionFile[] = [];

	if (!existsSync(projectsPath)) {
		return sessions;
	}

	// List all project directories
	const projectDirs = readdirSync(projectsPath).filter((d) => {
		const fullPath = join(projectsPath, d);
		try {
			return statSync(fullPath).isDirectory();
		} catch {
			return false;
		}
	});

	for (const projectDir of projectDirs) {
		const projectDirPath = join(projectsPath, projectDir);
		const projectPath = decodeProjectPath(projectDir);
		const projectName = getProjectName(projectPath);

		// List all JSONL files in this project
		let sessionFileNames: string[];
		try {
			sessionFileNames = readdirSync(projectDirPath).filter((f) =>
				f.endsWith(".jsonl"),
			);
		} catch {
			continue;
		}

		for (const sessionFileName of sessionFileNames) {
			const sessionId = sessionFileName.replace(".jsonl", "");
			const filePath = join(projectDirPath, sessionFileName);

			// Skip agent files (they don't have their own summaries)
			if (sessionFileName.startsWith("agent-")) {
				continue;
			}

			try {
				const stats = statSync(filePath);
				sessions.push({
					sessionId,
					projectPath,
					projectName,
					filePath,
					mtime: stats.mtime,
				});
			} catch {
				// Skip files we can't access
			}
		}
	}

	// Sort by modification time, newest first
	sessions.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

	return sessions;
}

/**
 * Convert SessionFile to SessionSummary using transcript-based summarization
 *
 * Uses the transcript-summary module for rich summary extraction with
 * work_items, decisions, and in_progress tracking.
 */
async function toSessionSummary(
	sessionFile: SessionFile,
): Promise<SessionSummary | null> {
	// Use transcript-based summarization for rich summaries
	const summary = await summarizeTranscriptFile(sessionFile.filePath, {
		project: sessionFile.projectName,
	});

	if (summary) {
		return summary;
	}

	// Fallback to basic summary if summarization fails
	return {
		session_id: sessionFile.sessionId,
		project: sessionFile.projectName,
		started_at: sessionFile.mtime.getTime(),
		ended_at: sessionFile.mtime.getTime(),
		summary: "Session data unavailable",
		work_items: [],
		in_progress: [],
		decisions: [],
	};
}

/**
 * List all summaries with pagination
 *
 * Computes summaries on-demand from transcripts for the requested page.
 */
export async function listSummaries(
	params: URLSearchParams,
): Promise<PaginatedResponse<SessionSummary>> {
	const page = Math.max(1, Number.parseInt(params.get("page") || "1", 10));
	const pageSize = Math.min(
		100,
		Math.max(1, Number.parseInt(params.get("pageSize") || "20", 10)),
	);

	// Get all session files from Claude Code projects
	const allSessions = getAllSessionFiles();

	// Calculate pagination
	const total = allSessions.length;
	const startIndex = (page - 1) * pageSize;
	const endIndex = Math.min(startIndex + pageSize, total);
	const pageSessions = allSessions.slice(startIndex, endIndex);

	// Compute summaries on-demand for this page
	const summaryPromises = pageSessions.map(toSessionSummary);
	const summaries = await Promise.all(summaryPromises);
	const data = summaries.filter((s): s is SessionSummary => s !== null);

	return {
		data,
		page,
		pageSize,
		total,
		hasMore: endIndex < total,
	};
}

/**
 * Get a specific summary by session ID
 *
 * Computes summary on-demand from the transcript.
 */
export async function getSummary(
	sessionId: string,
): Promise<SessionSummary | null> {
	const allSessions = getAllSessionFiles();
	const sessionFile = allSessions.find((s) => s.sessionId === sessionId);

	if (!sessionFile) {
		return null;
	}

	return toSessionSummary(sessionFile);
}

/**
 * Count all sessions (for dashboard stats)
 */
export function countSummaries(): number {
	return getAllSessionFiles().length;
}

/**
 * Handle summaries API requests
 */
export async function handleSummariesRequest(req: Request): Promise<Response> {
	const url = new URL(req.url);
	const path = url.pathname;

	// Extract session ID from path: /api/summaries/:id
	const sessionIdMatch = path.match(/^\/api\/summaries\/([^/]+)$/);

	try {
		if (sessionIdMatch) {
			// GET /api/summaries/:id
			const sessionId = decodeURIComponent(sessionIdMatch[1]);
			const summary = await getSummary(sessionId);

			if (!summary) {
				return new Response(
					JSON.stringify({
						error: "Summary not found",
						details: `No summary for session: ${sessionId}`,
					}),
					{ status: 404, headers: { "Content-Type": "application/json" } },
				);
			}

			return new Response(JSON.stringify(summary), {
				headers: { "Content-Type": "application/json" },
			});
		}

		// GET /api/summaries
		const result = await listSummaries(url.searchParams);
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
