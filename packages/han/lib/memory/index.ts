/**
 * Han Memory System
 *
 * Three-layer memory architecture:
 * - Personal: Session observations and summaries
 * - Team: Research-based knowledge from git/PRs
 * - Rules: Permanent wisdom in .claude/rules/
 *
 * @example
 * ```typescript
 * import { getMemoryStore, getProjectMemoryPath } from "./memory";
 *
 * const store = getMemoryStore();
 *
 * // Personal memory
 * store.appendObservation(sessionId, observation);
 * const recent = store.getRecentSessions(5);
 *
 * // Team memory
 * const results = await store.search(gitRemote, "who knows about auth?");
 * ```
 */

// Capture (for PostToolUse hook)
export type { ToolUseEvent } from "./capture.ts";
export { captureToolUse } from "./capture.ts";
// Context Injection (for SessionStart hook)
export { injectSessionContext } from "./context-injection.ts";
// Paths
export {
	ensureDir,
	ensureMemoryDirs,
	ensureProjectDirs,
	generateId,
	getCurrentProjectPath,
	getGitRemote,
	getMemoryRoot,
	getPersonalIndexPath,
	getPersonalPath,
	getProjectIndexPath,
	getProjectMemoryPath,
	getProjectMetaPath,
	getSessionFilePath,
	getSessionsPath,
	getSummariesPath,
	getSummaryFilePath,
	HAN_MEMORY_ROOT,
	normalizeGitRemote,
	setMemoryRoot,
} from "./paths.ts";
// Providers (for Team memory extraction)
export { gitProvider } from "./providers/git.ts";
export type { MCPClient } from "./providers/github.ts";
export { createGitHubProvider } from "./providers/github.ts";
// Research Engine
export { createResearchEngine } from "./research.ts";
// Storage
export type { MemoryStore } from "./storage.ts";
export { createMemoryStore, getMemoryStore } from "./storage.ts";
// Summarization (for Stop hook)
export type { SummarizeOptions } from "./summarize.ts";
export { summarizeSession } from "./summarize.ts";
// Types
export type {
	Citation,
	Decision,
	Evidence,
	ExtractedObservation,
	ExtractOptions,
	IndexedObservation,
	IndexMetadata,
	InvestigationResult,
	Lead,
	MemoryProvider,
	MemoryScope,
	ObservationType,
	RawObservation,
	ResearchResult,
	SearchFilters,
	SearchResult,
	SessionSummary,
	WorkItem,
} from "./types.ts";
// Vector Store (optional - for semantic search)
export type { VectorStore } from "./vector-store.ts";
export {
	createFallbackVectorStore,
	createLanceVectorStore,
	getVectorStore,
} from "./vector-store.ts";
