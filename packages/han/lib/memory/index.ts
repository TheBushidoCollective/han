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

// Context Injection (for SessionStart hook)
export { injectSessionContext } from "./context-injection.ts";
// Query Expansion (for FTS semantic bridging)
export type {
	ExpandedQuery,
	ExpandQueryOptions,
	ExpansionLevel,
} from "./query-expansion.ts";
export {
	ACRONYMS,
	expandQuery,
	getExpansions,
	hasExpansion,
	SYNONYMS,
} from "./query-expansion.ts";
// Indexer (FTS + Vector hybrid search)
export type { FtsResult, IndexDocument, IndexLayer } from "./indexer.ts";
export {
	getTableName,
	hybridSearch,
	indexDocuments,
	searchFts,
	searchVector,
} from "./indexer.ts";
// Memory Agent (Agent SDK)
export type {
	MemoryAgentResponse,
	MemoryCitation,
	MemoryProgressUpdate,
	MemoryQueryParams,
} from "./memory-agent.ts";
export {
	formatMemoryAgentResult,
	getMemoryAgentMcpConfig,
	queryMemoryAgent,
} from "./memory-agent.ts";
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
	normalizeGitRemote,
	setMemoryRoot,
} from "./paths.ts";
// Auto-Promotion (self-learning)
export type { DetectedPattern, PromotionResult } from "./promotion.ts";
export {
	autoPromotePatterns,
	clearPatternStore,
	extractPatterns,
	extractPatternsFromEvidence,
	getPatternStats,
	getPromotionCandidates,
	inferDomain,
	learnFromObservations,
	learnFromResearch,
	promotePattern,
	trackPattern,
} from "./promotion.ts";
// Provider Discovery (for plugin-based providers)
export type {
	DiscoveredProvider,
	LoadedProvider,
	MCPClient,
	ProviderFactory,
	ProviderType,
} from "./provider-discovery.ts";
export {
	discoverProviders,
	loadAllProviders,
	loadProviderScript,
} from "./provider-discovery.ts";
// Providers (for Team memory extraction)
export { gitProvider } from "./providers/git.ts";
// Legacy: createGitHubProvider is now provided by hashi-github plugin
// Kept for backwards compatibility during transition
export { createGitHubProvider } from "./providers/github.ts";
// Research Engine
export { createResearchEngine } from "./research.ts";
// Storage
export type { MemoryStore } from "./storage.ts";
export { createMemoryStore, getMemoryStore } from "./storage.ts";
// Streaming (for Browse UI integration)
export {
	getActiveMemorySessions,
	getMemorySessionStatus,
	queryMemoryWithStreaming,
	startMemoryQuerySession,
} from "./streaming.ts";
// Summarization (for Stop hook)
export type { SummarizeOptions } from "./summarize.ts";
export { summarizeSession } from "./summarize.ts";
// Native Summaries (Layer 2 - Claude's context window compression)
export type { NativeSummary } from "./transcript-search.ts";
export {
	indexNativeSummaries,
	parseSummaries,
	searchNativeSummaries,
} from "./transcript-search.ts";
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
