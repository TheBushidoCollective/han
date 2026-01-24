/**
 * MCP Session Registry
 *
 * Maintains per-terminal session state for the MCP server.
 * Each MCP instance has its own registry (not shared singleton).
 *
 * Key design decisions:
 * - In-memory only: no file I/O for session state
 * - Each MCP process has independent state
 * - Summary cached per session, invalidated when transcript changes
 * - Thread-safe for single MCP process (JavaScript is single-threaded)
 */

import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import {
	getClaudeProjectsDir,
	pathToSlug,
} from "../../memory/transcript-search.ts";
import {
	summarizeTranscriptFile,
	type TranscriptSummaryOptions,
} from "../../memory/transcript-summary.ts";
import type { SessionSummary } from "../../memory/types.ts";
import { getNativeModule } from "../../native.ts";

export interface SessionState {
	/** Claude Code session ID */
	sessionId: string;
	/** When this session was registered */
	registeredAt: number;
	/** Project slug (path encoded) */
	projectSlug: string;
	/** Path to the transcript file */
	transcriptPath: string | null;
	/** Cached summary (computed on demand) */
	cachedSummary: SessionSummary | null;
	/** Timestamp when summary was cached */
	summaryCachedAt: number;
	/** Last known mtime of transcript file */
	lastTranscriptMtime: number;
}

export interface RegisterSessionParams {
	session_id: string;
	project_path?: string;
}

export interface SessionRegistryStats {
	registeredSessions: number;
	sessionsWithCache: number;
	oldestSession: number | null;
}

/**
 * Session Registry for MCP
 *
 * Maintains session state in memory for the lifetime of the MCP process.
 * Each MCP process has its own registry - no shared state between terminals.
 */
export class SessionRegistry {
	private sessions = new Map<string, SessionState>();

	/**
	 * Register a session for transcript-based memory
	 *
	 * Called when agent invokes register_session tool at SessionStart.
	 */
	register(params: RegisterSessionParams): SessionState {
		const { session_id, project_path } = params;

		// Get project slug
		const projectPath = project_path || process.cwd();
		const projectSlug = pathToSlug(projectPath);

		// Find transcript file for this session
		const transcriptPath = this.findTranscriptFile(projectSlug, session_id);

		const state: SessionState = {
			sessionId: session_id,
			registeredAt: Date.now(),
			projectSlug,
			transcriptPath,
			cachedSummary: null,
			summaryCachedAt: 0,
			lastTranscriptMtime: 0,
		};

		this.sessions.set(session_id, state);
		return state;
	}

	/**
	 * Get session state by ID
	 */
	getSession(sessionId: string): SessionState | undefined {
		return this.sessions.get(sessionId);
	}

	/**
	 * Get or compute summary for a session
	 *
	 * Returns cached summary if transcript hasn't changed.
	 * Otherwise recomputes from transcript.
	 */
	async getSummary(
		sessionId: string,
		options: TranscriptSummaryOptions = {},
	): Promise<SessionSummary | null> {
		const state = this.sessions.get(sessionId);
		if (!state) {
			return null;
		}

		// Check if transcript file exists and get mtime
		if (!state.transcriptPath) {
			// Try to find transcript file again
			state.transcriptPath = this.findTranscriptFile(
				state.projectSlug,
				sessionId,
			);
			if (!state.transcriptPath) {
				return null;
			}
		}

		const currentMtime = this.getFileMtime(state.transcriptPath);

		// Return cached summary if transcript hasn't changed
		if (
			state.cachedSummary &&
			state.lastTranscriptMtime > 0 &&
			currentMtime === state.lastTranscriptMtime
		) {
			return state.cachedSummary;
		}

		// Recompute summary from transcript
		const summary = await summarizeTranscriptFile(
			state.transcriptPath,
			options,
		);

		// Update cache
		state.cachedSummary = summary;
		state.summaryCachedAt = Date.now();
		state.lastTranscriptMtime = currentMtime;

		return summary;
	}

	/**
	 * Invalidate cached summary for a session
	 *
	 * Call this when you know the transcript has changed.
	 */
	invalidateCache(sessionId: string): void {
		const state = this.sessions.get(sessionId);
		if (state) {
			state.cachedSummary = null;
			state.summaryCachedAt = 0;
			state.lastTranscriptMtime = 0;
		}
	}

	/**
	 * Unregister a session
	 */
	unregister(sessionId: string): boolean {
		return this.sessions.delete(sessionId);
	}

	/**
	 * Get statistics about registered sessions
	 */
	getStats(): SessionRegistryStats {
		let oldestSession: number | null = null;
		let sessionsWithCache = 0;

		for (const state of this.sessions.values()) {
			if (oldestSession === null || state.registeredAt < oldestSession) {
				oldestSession = state.registeredAt;
			}
			if (state.cachedSummary) {
				sessionsWithCache++;
			}
		}

		return {
			registeredSessions: this.sessions.size,
			sessionsWithCache,
			oldestSession,
		};
	}

	/**
	 * Get all registered session IDs
	 */
	getRegisteredSessionIds(): string[] {
		return Array.from(this.sessions.keys());
	}

	/**
	 * Find transcript file for a session
	 *
	 * Claude Code stores transcripts at:
	 * ~/.claude/projects/{slug}/{sessionId}.jsonl
	 * or sometimes with date prefix
	 */
	private findTranscriptFile(
		projectSlug: string,
		sessionId: string,
	): string | null {
		const projectsDir = getClaudeProjectsDir();
		const projectDir = join(projectsDir, projectSlug);

		if (!existsSync(projectDir)) {
			return null;
		}

		try {
			// Use native session file listing (already sorted by mtime, newest first)
			const native = getNativeModule();
			const files = native.listSessionFiles(projectDir);

			if (files.length === 0) {
				return null;
			}

			// Look for exact session ID match first
			const exactMatch = files.find(
				(f) => f.name === `${sessionId}.jsonl` || f.name.includes(sessionId),
			);

			if (exactMatch) {
				return exactMatch.path;
			}

			// Return most recent file as fallback (files already sorted newest first)
			return files[0].path;
		} catch {
			// Directory read error
		}

		return null;
	}

	/**
	 * Get file modification time
	 */
	private getFileMtime(filePath: string): number {
		try {
			const stats = statSync(filePath);
			return stats.mtimeMs;
		} catch {
			return 0;
		}
	}
}

// Export a factory function instead of singleton
// Each MCP process should create its own registry
export function createSessionRegistry(): SessionRegistry {
	return new SessionRegistry();
}
