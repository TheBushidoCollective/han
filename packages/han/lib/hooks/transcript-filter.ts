/**
 * Transcript-Based Session Filtering
 *
 * Extracts modified files from session/agent transcripts to enable
 * session-scoped stop hooks. Only runs hooks on files THIS session modified.
 *
 * This prevents conflicts when multiple Claude Code sessions work in the
 * same working tree - each session only runs hooks on its own changes.
 */

import { existsSync, readdirSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { parseTranscript, pathToSlug } from "../memory/transcript-search.ts";
import { getNativeModule } from "../native.ts";
import { getProjectsBaseDir } from "./checkpoint.ts";
import { findFilesWithGlob } from "./hook-cache.ts";

/**
 * Result of extracting modified files from a transcript
 */
export interface TranscriptModifiedFiles {
	/** Files that were written (new files) */
	written: string[];
	/** Files that were edited (modified files) */
	edited: string[];
	/** Combined set of all modified files (written + edited) */
	allModified: string[];
	/** Session or agent ID this was extracted from */
	id: string;
	/** Whether transcript was successfully found and parsed */
	success: boolean;
}

/**
 * In-memory cache for transcript-extracted files.
 * Keyed by "{type}:{id}", cleared on process exit.
 */
const transcriptCache = new Map<string, TranscriptModifiedFiles>();

/**
 * Find the transcript file for a session
 */
function findSessionTranscript(
	sessionId: string,
	projectPath: string,
): string | null {
	const projectsDir = getProjectsBaseDir();
	const projectSlug = pathToSlug(projectPath);
	const projectDir = join(projectsDir, projectSlug);

	if (!existsSync(projectDir)) {
		return null;
	}

	// Try exact match first
	const exactPath = join(projectDir, `${sessionId}.jsonl`);
	if (existsSync(exactPath)) {
		return exactPath;
	}

	// Fall back to searching for partial match (session IDs may be prefixed)
	try {
		const files = readdirSync(projectDir).filter((f) => f.endsWith(".jsonl"));
		const match = files.find((f) => f.includes(sessionId));
		return match ? join(projectDir, match) : null;
	} catch {
		return null;
	}
}

/**
 * Find the transcript file for an agent
 */
function findAgentTranscript(
	agentId: string,
	projectPath: string,
): string | null {
	const projectsDir = getProjectsBaseDir();
	const projectSlug = pathToSlug(projectPath);
	const projectDir = join(projectsDir, projectSlug);

	if (!existsSync(projectDir)) {
		return null;
	}

	// Agent transcripts use "agent-" prefix
	const agentPath = join(projectDir, `agent-${agentId}.jsonl`);
	if (existsSync(agentPath)) {
		return agentPath;
	}

	// Fall back to searching for partial match
	try {
		const files = readdirSync(projectDir).filter((f) => f.endsWith(".jsonl"));
		const match = files.find((f) => f.includes(`agent-${agentId}`));
		return match ? join(projectDir, match) : null;
	} catch {
		return null;
	}
}

/**
 * Extract modified files from a transcript file
 */
function extractModifiedFilesFromTranscript(
	transcriptPath: string,
): TranscriptModifiedFiles {
	const native = getNativeModule();
	const written = new Set<string>();
	const edited = new Set<string>();

	// Parse transcript messages
	const messages = parseTranscript(transcriptPath);

	for (const message of messages) {
		if (message.type !== "assistant") continue;

		// Use native regex extraction for performance
		const result = native.extractFileOperations(message.content);

		for (const op of result.operations) {
			if (op.operation === "write") {
				written.add(op.path);
			} else if (op.operation === "edit") {
				edited.add(op.path);
			}
			// Skip 'read' and 'delete' for hook filtering
		}
	}

	const allModified = [...new Set([...written, ...edited])];

	return {
		written: [...written],
		edited: [...edited],
		allModified,
		id: basename(transcriptPath, ".jsonl"),
		success: true,
	};
}

/**
 * Get files modified by a session or agent from its transcript.
 *
 * Uses in-memory caching since the transcript doesn't change during
 * a single hook dispatch invocation.
 *
 * @param type - "session" or "agent"
 * @param id - Session or agent ID
 * @param projectPath - Project directory path
 * @returns Modified files or empty result with success=false on failure
 */
export function getTranscriptModifiedFiles(
	type: "session" | "agent",
	id: string,
	projectPath: string,
): TranscriptModifiedFiles {
	const cacheKey = `${type}:${id}`;

	// Check cache first
	const cached = transcriptCache.get(cacheKey);
	if (cached) {
		return cached;
	}

	// Find transcript file
	const transcriptPath =
		type === "session"
			? findSessionTranscript(id, projectPath)
			: findAgentTranscript(id, projectPath);

	if (!transcriptPath) {
		// Graceful fallback: can't find transcript, run hook
		const result: TranscriptModifiedFiles = {
			written: [],
			edited: [],
			allModified: [],
			id,
			success: false,
		};
		return result;
	}

	try {
		const result = extractModifiedFilesFromTranscript(transcriptPath);
		transcriptCache.set(cacheKey, result);
		return result;
	} catch {
		// Graceful fallback: parse error, run hook
		return {
			written: [],
			edited: [],
			allModified: [],
			id,
			success: false,
		};
	}
}

/**
 * Check if any files from ifChanged patterns were modified in this session.
 *
 * Compares the set of files matching the hook's ifChanged patterns
 * against the files actually modified in the session transcript.
 *
 * @param modifiedFiles - Files extracted from transcript
 * @param directory - Hook target directory
 * @param patterns - ifChanged glob patterns from hook config
 * @returns true if intersection is non-empty (session modified pattern files)
 */
export function hasSessionModifiedPatternFiles(
	modifiedFiles: TranscriptModifiedFiles,
	directory: string,
	patterns: string[],
): boolean {
	if (modifiedFiles.allModified.length === 0) {
		return false;
	}

	if (!patterns || patterns.length === 0) {
		// No patterns = run on all changes
		return true;
	}

	// Get files matching patterns in target directory
	const patternFiles = findFilesWithGlob(directory, patterns);

	// Convert pattern files to relative paths for comparison
	const patternFilesSet = new Set(
		patternFiles.map((f) => relative(directory, f)),
	);

	// Check if any transcript-modified files match pattern files
	for (const modifiedPath of modifiedFiles.allModified) {
		// Normalize the modified path (may be relative or absolute)
		let normalizedPath = modifiedPath;

		if (modifiedPath.startsWith("/")) {
			// Absolute path - make relative to directory
			normalizedPath = relative(directory, modifiedPath);
		}

		// Direct match
		if (patternFilesSet.has(normalizedPath)) {
			return true;
		}

		// Also check if any pattern file ends with the modified path
		// (handles cases where transcript paths are shortened)
		for (const patternFile of patternFilesSet) {
			if (patternFile.endsWith(normalizedPath)) {
				return true;
			}
		}
	}

	return false;
}

/**
 * Get the intersection of session-modified files with pattern-matched files.
 *
 * Returns the actual file paths that:
 * 1. Were modified by THIS session (from transcript)
 * 2. Match the hook's ifChanged patterns
 *
 * These are the files the hook should operate on instead of the whole directory.
 *
 * @param modifiedFiles - Files extracted from transcript
 * @param directory - Hook target directory
 * @param patterns - ifChanged glob patterns from hook config
 * @returns Array of relative file paths to pass to the hook command
 */
export function getSessionFilteredFiles(
	modifiedFiles: TranscriptModifiedFiles,
	directory: string,
	patterns: string[],
): string[] {
	if (modifiedFiles.allModified.length === 0) {
		return [];
	}

	if (!patterns || patterns.length === 0) {
		// No patterns = return all session-modified files (relative to directory)
		return modifiedFiles.allModified
			.map((f) => {
				if (f.startsWith("/")) {
					const rel = relative(directory, f);
					// Only include files within the directory
					return rel.startsWith("..") ? null : rel;
				}
				// Already relative - check if it goes outside directory
				if (f.startsWith("..")) {
					return null;
				}
				return f;
			})
			.filter((f): f is string => f !== null);
	}

	// Get files matching patterns in target directory
	const patternFiles = findFilesWithGlob(directory, patterns);

	// Convert pattern files to relative paths for comparison
	const patternFilesMap = new Map<string, string>();
	for (const f of patternFiles) {
		patternFilesMap.set(relative(directory, f), relative(directory, f));
	}

	const result: string[] = [];

	// Find intersection of transcript-modified files with pattern files
	for (const modifiedPath of modifiedFiles.allModified) {
		// Normalize the modified path (may be relative or absolute)
		let normalizedPath = modifiedPath;

		if (modifiedPath.startsWith("/")) {
			// Absolute path - make relative to directory
			normalizedPath = relative(directory, modifiedPath);
		}

		// Skip files outside the directory
		if (normalizedPath.startsWith("..")) {
			continue;
		}

		// Direct match
		if (patternFilesMap.has(normalizedPath)) {
			result.push(normalizedPath);
			continue;
		}

		// Also check if any pattern file ends with the modified path
		// (handles cases where transcript paths are shortened)
		for (const patternFile of patternFilesMap.keys()) {
			if (
				patternFile.endsWith(normalizedPath) &&
				!result.includes(patternFile)
			) {
				result.push(patternFile);
			}
		}
	}

	return result;
}

/**
 * Template variable for session-filtered files in hook commands.
 *
 * Use ${HAN_FILES} in your command to have it replaced with session-modified files.
 *
 * @example
 * command: "npx biome check --write ${HAN_FILES}"
 * command: "./scripts/lint.sh ${HAN_FILES}"
 */
// biome-ignore lint/suspicious/noTemplateCurlyInString: This is intentionally a literal string pattern, not a template
export const HAN_FILES_TEMPLATE = "${HAN_FILES}";

/**
 * Modify a hook command to target specific files using template substitution.
 *
 * Only modifies the command if it contains ${HAN_FILES} template variable.
 * This allows opt-in file targeting for commands that support it.
 *
 * @param command - Hook command, optionally containing ${HAN_FILES}
 * @param files - Files to substitute (e.g., ["src/foo.ts", "src/bar.ts"])
 * @returns Modified command with files substituted, or original if no template
 */
export function buildCommandWithFiles(
	command: string,
	files: string[],
): string {
	// Only substitute if template variable is present
	if (!command.includes(HAN_FILES_TEMPLATE)) {
		return command;
	}

	if (files.length === 0) {
		// Template present but no files - replace with "." as fallback
		return command.replace(HAN_FILES_TEMPLATE, ".");
	}

	// Escape file paths for shell (handle spaces, special chars)
	const escapedFiles = files.map((f) => {
		if (f.includes(" ") || f.includes("'") || f.includes('"')) {
			return `'${f.replace(/'/g, "'\\''")}'`;
		}
		return f;
	});

	const fileList = escapedFiles.join(" ");
	return command.replace(HAN_FILES_TEMPLATE, fileList);
}

/**
 * Check if a command uses the ${HAN_FILES} template variable.
 */
export function commandUsesSessionFiles(command: string): boolean {
	return command.includes(HAN_FILES_TEMPLATE);
}

/**
 * Clear the transcript cache.
 * Useful for testing or when transcript changes mid-execution.
 */
export function clearTranscriptCache(): void {
	transcriptCache.clear();
}
