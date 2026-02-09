/**
 * Data Access Layer (DAL) MCP Server
 *
 * Provides read-only search tools for the Memory Agent.
 * This MCP server exposes:
 * - FTS search (full-text search using BM25)
 * - Vector search (semantic similarity)
 * - Hybrid search (FTS + Vector with Reciprocal Rank Fusion)
 *
 * All operations are READ-ONLY for memory safety.
 *
 * IMPORTANT: All data is stored in ~/.han/han.db (single database).
 * Transcript searches use the native module's searchMessages for FTS.
 * Other layers use the indexer functions which also target the same database.
 */

import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { getHanDataDir } from '../../config/claude-settings.ts';
import {
  detectTemporalQuery,
  grepTranscripts,
  scanRecentSessions,
} from '../../memory/fallback-search.ts';
import {
  type ExpansionLevel,
  expandQuery,
  type FtsResult,
  getGitRemote,
  getTableName,
  hybridSearch,
  searchFts,
  searchNativeSummaries,
  searchVector,
} from '../../memory/index.ts';
import {
  type MultiStrategySearchResult,
  multiStrategySearch,
  multiStrategySearchWithFallbacks,
  type SearchStrategy,
} from '../../memory/multi-strategy-search.ts';
import { tryGetNativeModule } from '../../native.ts';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id?: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface McpToolAnnotations {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

interface McpTool {
  name: string;
  description: string;
  annotations?: McpToolAnnotations;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * Memory layer names for searching
 */
type MemoryLayer = 'rules' | 'transcripts' | 'team' | 'summaries' | 'all';

/**
 * Search result with citations
 */
interface SearchResultWithCitation extends FtsResult {
  layer: string;
  browseUrl?: string;
}

/**
 * Get table name for a memory layer
 */
function getLayerTableName(layer: MemoryLayer): string[] {
  const gitRemote = getGitRemote();
  const tables: string[] = [];

  if (layer === 'all' || layer === 'rules') {
    tables.push(getTableName('observations'));
  }
  if (layer === 'all' || layer === 'transcripts') {
    tables.push(getTableName('transcripts'));
  }
  if ((layer === 'all' || layer === 'team') && gitRemote) {
    tables.push(getTableName('team', gitRemote));
  }

  return tables;
}

/**
 * Add layer info and browse URLs to results
 */
function enrichResults(
  results: FtsResult[],
  layer: string
): SearchResultWithCitation[] {
  return results.map((r) => {
    const metadata = r.metadata || {};
    let browseUrl: string | undefined;

    // Build Browse UI deep link based on source type
    if (r.id.startsWith('git:commit:')) {
      const sha = r.id.replace('git:commit:', '');
      browseUrl = `/repos?commit=${sha}`;
    } else if (metadata.session_id) {
      browseUrl = `/sessions/${metadata.session_id}`;
      if (metadata.line_number) {
        browseUrl += `#line-${metadata.line_number}`;
      }
    } else if (layer === 'rules' && metadata.domain) {
      browseUrl = `/memory?tab=rules&file=${metadata.domain}`;
    }

    return {
      ...r,
      layer,
      browseUrl,
    };
  });
}

/**
 * Search transcripts using the native module
 * The native module stores indexed messages in ~/.han/han.db
 *
 * @param query - Search query (will be expanded if expansion != "none")
 * @param limit - Maximum results to return
 * @param expansion - Query expansion level (default: "minimal")
 */
async function searchTranscriptsNative(
  query: string,
  limit: number,
  expansion: ExpansionLevel = 'minimal'
): Promise<SearchResultWithCitation[]> {
  const nativeModule = tryGetNativeModule();
  if (!nativeModule) {
    return [];
  }

  try {
    const dbPath = join(getHanDataDir(), 'han.db');

    // Expand query before search
    const { expanded } = expandQuery(query, { level: expansion });

    const messages = nativeModule.searchMessages(dbPath, expanded, null, limit);

    return messages.map((msg) => ({
      id: `transcript:${msg.sessionId}:${msg.id}`,
      content: msg.content || msg.toolResult || msg.toolInput || '',
      score: 0.7, // FTS matches get decent score
      layer: 'transcripts',
      metadata: {
        sessionId: msg.sessionId,
        messageId: msg.id,
        role: msg.role,
        messageType: msg.messageType,
        toolName: msg.toolName,
        timestamp: new Date(msg.timestamp).getTime(),
        lineNumber: msg.lineNumber,
      },
      browseUrl: `/sessions/${msg.sessionId}#msg-${msg.id}`,
    }));
  } catch (error) {
    console.error('[DAL] Transcript search error:', error);
    return [];
  }
}

/**
 * Search generated session summaries using the native module
 * Returns semantic summaries with topics for "which session discussed X" queries
 */
async function searchSummariesNative(
  query: string,
  limit: number
): Promise<SearchResultWithCitation[]> {
  const nativeModule = tryGetNativeModule();
  if (!nativeModule) {
    return [];
  }

  try {
    const dbPath = join(getHanDataDir(), 'han.db');
    const summaries = nativeModule.searchGeneratedSummaries(
      dbPath,
      query,
      limit
    );

    return summaries.map((s) => ({
      id: `summary:${s.sessionId}`,
      content: `${s.summaryText}\n\nTopics: ${s.topics.join(', ')}`,
      score: 0.8, // Generated summaries get higher score than raw transcripts
      layer: 'summaries',
      metadata: {
        sessionId: s.sessionId,
        topics: s.topics,
        outcome: s.outcome,
        filesModified: s.filesModified,
        toolsUsed: s.toolsUsed,
        messageCount: s.messageCount,
      },
      browseUrl: `/sessions/${s.sessionId}`,
    }));
  } catch (error) {
    console.error('[DAL] Summary search error:', error);
    return [];
  }
}

/**
 * Search across memory layers using FTS
 *
 * @param query - Search query
 * @param layer - Memory layer to search
 * @param limit - Maximum results to return
 * @param expansion - Query expansion level (default: "minimal")
 */
async function searchMemoryFts(
  query: string,
  layer: MemoryLayer,
  limit: number,
  expansion: ExpansionLevel = 'minimal'
): Promise<SearchResultWithCitation[]> {
  const allResults: SearchResultWithCitation[] = [];

  // Expand query once for non-native searches
  const { expanded } = expandQuery(query, { level: expansion });

  // Handle summaries layer - semantic session summaries
  if (layer === 'all' || layer === 'summaries') {
    const summaryResults = await searchSummariesNative(query, limit);
    allResults.push(...summaryResults);
  }

  // Handle transcripts specially - use native module
  if (layer === 'all' || layer === 'transcripts') {
    // Pass original query and expansion level - native handler does its own expansion
    const transcriptResults = await searchTranscriptsNative(
      query,
      limit,
      expansion
    );
    allResults.push(...transcriptResults);
  }

  // Handle other layers via indexer (use expanded query)
  const tables = getLayerTableName(layer);
  for (const table of tables) {
    // Skip transcripts - handled above via native module
    if (table.includes('transcripts')) continue;

    try {
      const layerName = table.includes('team') ? 'team' : 'rules';
      const results = await searchFts(table, expanded, limit);
      allResults.push(...enrichResults(results, layerName));
    } catch {
      // Layer not available - continue
    }
  }

  // Sort by score and return top results
  return allResults.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * Search across memory layers using vector similarity
 * Note: For transcripts/summaries, falls back to FTS since native module only has FTS
 *
 * @param query - Search query
 * @param layer - Memory layer to search
 * @param limit - Maximum results to return
 * @param expansion - Query expansion level for transcript FTS fallback (default: "minimal")
 */
async function searchMemoryVector(
  query: string,
  layer: MemoryLayer,
  limit: number,
  expansion: ExpansionLevel = 'minimal'
): Promise<SearchResultWithCitation[]> {
  const allResults: SearchResultWithCitation[] = [];

  // Handle summaries layer - semantic session summaries (FTS for now)
  if (layer === 'all' || layer === 'summaries') {
    const summaryResults = await searchSummariesNative(query, limit);
    allResults.push(...summaryResults);
  }

  // Handle transcripts specially - use native module (FTS only for now)
  // Note: Vector search naturally handles semantics, but FTS fallback benefits from expansion
  if (layer === 'all' || layer === 'transcripts') {
    const transcriptResults = await searchTranscriptsNative(
      query,
      limit,
      expansion
    );
    allResults.push(...transcriptResults);
  }

  // Handle other layers via indexer
  // Note: Vector search uses embeddings, so expansion is not needed for these
  const tables = getLayerTableName(layer);
  for (const table of tables) {
    // Skip transcripts - handled above via native module
    if (table.includes('transcripts')) continue;

    try {
      const layerName = table.includes('team') ? 'team' : 'rules';
      const results = await searchVector(table, query, limit);
      allResults.push(...enrichResults(results, layerName));
    } catch {
      // Layer not available - continue
    }
  }

  // Sort by score and return top results
  return allResults.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * Search across memory layers using hybrid (FTS + Vector with RRF)
 *
 * @param query - Search query
 * @param layer - Memory layer to search
 * @param limit - Maximum results to return
 * @param expansion - Query expansion level (default: "minimal")
 */
async function searchMemoryHybrid(
  query: string,
  layer: MemoryLayer,
  limit: number,
  expansion: ExpansionLevel = 'minimal'
): Promise<SearchResultWithCitation[]> {
  const allResults: SearchResultWithCitation[] = [];

  // Expand query for hybrid FTS component
  const { expanded } = expandQuery(query, { level: expansion });

  // Handle summaries layer - semantic session summaries (FTS for now)
  if (layer === 'all' || layer === 'summaries') {
    const summaryResults = await searchSummariesNative(query, limit);
    allResults.push(...summaryResults);
  }

  // Handle transcripts specially - use native module
  if (layer === 'all' || layer === 'transcripts') {
    const transcriptResults = await searchTranscriptsNative(
      query,
      limit,
      expansion
    );
    allResults.push(...transcriptResults);
  }

  // Handle other layers via indexer
  // hybridSearch uses both FTS (benefits from expansion) and vector (semantic)
  const tables = getLayerTableName(layer);
  for (const table of tables) {
    // Skip transcripts - handled above via native module
    if (table.includes('transcripts')) continue;

    try {
      const layerName = table.includes('team') ? 'team' : 'rules';
      // Pass expanded query - hybridSearch will use it for FTS component
      const results = await hybridSearch(table, expanded, limit);
      allResults.push(...enrichResults(results, layerName));
    } catch {
      // Layer not available - continue
    }
  }

  // Sort by score and return top results
  return allResults.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * Search native summaries and return SearchResultWithCitation format
 *
 * Wrapper around searchNativeSummaries that normalizes the return type.
 */
async function searchSummariesForMultiStrategy(
  query: string,
  limit: number
): Promise<SearchResultWithCitation[]> {
  const results = await searchNativeSummaries(query, { limit });
  return results.map((r) => ({
    id: `summary:${r.sessionId}`,
    content: r.content,
    score: r.score,
    layer: 'summaries',
    metadata: {
      sessionId: r.sessionId,
      projectSlug: r.projectSlug,
      timestamp: r.timestamp,
    },
    browseUrl: `/sessions/${r.sessionId}`,
  }));
}

/**
 * Execute multi-strategy search
 *
 * Runs all strategies (direct FTS, expanded FTS, semantic, summaries) in parallel
 * and fuses results using Reciprocal Rank Fusion.
 */
async function executeMultiStrategySearch(
  query: string,
  layer: MemoryLayer,
  limit: number,
  expansion: ExpansionLevel,
  timeout: number,
  strategies?: SearchStrategy[]
): Promise<MultiStrategySearchResult> {
  return multiStrategySearch(
    {
      query,
      layer,
      limit,
      expansion,
      timeout,
      strategies,
    },
    {
      searchMemoryFts,
      searchMemoryVector,
      searchSummariesNative: searchSummariesForMultiStrategy,
    }
  );
}

/**
 * DAL tools - all read-only
 */
const DAL_TOOLS: McpTool[] = [
  {
    name: 'memory_search_fts',
    description:
      "Search memory layers using full-text search (BM25). Returns results ranked by keyword relevance. Best for exact phrase matches and specific terms. Supports query expansion to bridge semantic gaps (e.g., 'vcs' matches 'version control').",
    annotations: {
      title: 'FTS Search',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query (keywords, phrases)',
        },
        layer: {
          type: 'string',
          enum: ['rules', 'transcripts', 'summaries', 'team', 'all'],
          description:
            "Memory layer to search. 'rules' = project conventions, 'transcripts' = past sessions, 'summaries' = session summaries with topics, 'team' = git commits/PRs, 'all' = search everywhere (default)",
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return (default: 10)',
        },
        expansion: {
          type: 'string',
          enum: ['none', 'minimal', 'full'],
          description:
            "Query expansion level. 'none' = exact match only, 'minimal' = expand acronyms (PR->pull request, CI->continuous integration), 'full' = acronyms + synonyms (refactor->refactoring). Default: minimal",
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'memory_search_vector',
    description:
      'Search memory layers using semantic/vector similarity. Returns results based on meaning, not just keywords. Best for conceptual queries and finding related content. Note: Vector search uses embeddings for semantic matching; expansion only affects FTS fallback for transcripts.',
    annotations: {
      title: 'Vector Search',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query (natural language question)',
        },
        layer: {
          type: 'string',
          enum: ['rules', 'transcripts', 'summaries', 'team', 'all'],
          description:
            "Memory layer to search. 'rules' = project conventions, 'transcripts' = past sessions, 'summaries' = session summaries with topics, 'team' = git commits/PRs, 'all' = search everywhere (default)",
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return (default: 10)',
        },
        expansion: {
          type: 'string',
          enum: ['none', 'minimal', 'full'],
          description:
            "Query expansion level for transcript FTS fallback. 'none' = exact match, 'minimal' = acronyms, 'full' = acronyms + synonyms. Default: minimal",
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'memory_search_hybrid',
    description:
      'Search memory layers using hybrid search (FTS + Vector with Reciprocal Rank Fusion). Combines keyword matching with semantic similarity for best overall results. RECOMMENDED for most queries. Supports query expansion for the FTS component.',
    annotations: {
      title: 'Hybrid Search',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query (can be keywords or natural language)',
        },
        layer: {
          type: 'string',
          enum: ['rules', 'transcripts', 'summaries', 'team', 'all'],
          description:
            "Memory layer to search. 'rules' = project conventions, 'transcripts' = past sessions, 'summaries' = session summaries with topics, 'team' = git commits/PRs, 'all' = search everywhere (default)",
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return (default: 10)',
        },
        expansion: {
          type: 'string',
          enum: ['none', 'minimal', 'full'],
          description:
            "Query expansion level for FTS component. 'none' = exact match, 'minimal' = acronyms (PR->pull request), 'full' = acronyms + synonyms. Default: minimal",
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'memory_list_layers',
    description:
      'List available memory layers and their status. Returns which layers have data and are searchable.',
    annotations: {
      title: 'List Memory Layers',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'memory_search_multi_strategy',
    description:
      'RECOMMENDED: Search memory using multiple strategies in parallel (direct FTS, expanded FTS, semantic, summaries). Fuses results using Reciprocal Rank Fusion and provides confidence scores based on strategy coverage. Returns higher confidence when multiple strategies return overlapping results.',
    annotations: {
      title: 'Multi-Strategy Search',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query (can be keywords or natural language)',
        },
        layer: {
          type: 'string',
          enum: ['rules', 'transcripts', 'team', 'all'],
          description:
            "Memory layer to search. 'rules' = project conventions, 'transcripts' = past sessions, 'team' = git commits/PRs, 'all' = search everywhere (default)",
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return (default: 10)',
        },
        expansion: {
          type: 'string',
          enum: ['none', 'minimal', 'full'],
          description:
            "Query expansion level for FTS strategies. 'none' = exact match, 'minimal' = acronyms (PR->pull request), 'full' = acronyms + synonyms. Default: minimal",
        },
        timeout: {
          type: 'number',
          description:
            'Per-strategy timeout in milliseconds (default: 5000). Strategies exceeding timeout return empty results.',
        },
        strategies: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['direct_fts', 'expanded_fts', 'semantic', 'summaries'],
          },
          description:
            "Specific strategies to run (default: all). 'direct_fts' = exact FTS, 'expanded_fts' = FTS with query expansion, 'semantic' = vector similarity, 'summaries' = session summaries.",
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'memory_search_with_fallbacks',
    description:
      'BEST FOR COMPREHENSIVE SEARCH: Multi-strategy search with automatic fallbacks. ' +
      'Runs all strategies in parallel, then applies fallbacks if no results: ' +
      "1) Recent sessions scan (for 'what was I working on' queries), " +
      '2) Raw JSONL grep (slow but thorough), ' +
      '3) Returns clarification prompt if query is ambiguous. ' +
      'Use this when you need guaranteed coverage and are willing to wait longer.',
    annotations: {
      title: 'Search with Fallbacks',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query (can be keywords or natural language)',
        },
        layer: {
          type: 'string',
          enum: ['rules', 'transcripts', 'team', 'all'],
          description:
            "Memory layer to search. 'rules' = project conventions, 'transcripts' = past sessions, 'team' = git commits/PRs, 'all' = search everywhere (default)",
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return (default: 10)',
        },
        enableGrep: {
          type: 'boolean',
          description:
            'Whether to enable raw grep fallback (slower but thorough). Default: true',
        },
        grepTimeout: {
          type: 'number',
          description:
            'Timeout for grep fallback in milliseconds (default: 5000)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'memory_grep_transcripts',
    description:
      'Raw grep search through transcript JSONL files. Use as a LAST RESORT ' +
      'when FTS and other strategies return nothing. Slower but guaranteed to find ' +
      'exact matches. Searches most recent files first.',
    annotations: {
      title: 'Grep Transcripts',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (keywords to match)',
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return (default: 10)',
        },
        timeout: {
          type: 'number',
          description: 'Search timeout in milliseconds (default: 5000)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'memory_scan_recent_sessions',
    description:
      'Scan the most recently modified sessions. Best for temporal queries like ' +
      "'what was I working on yesterday' or 'recent activity'. " +
      'Returns sessions sorted by modification time with relevance scoring.',
    annotations: {
      title: 'Scan Recent Sessions',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Optional search query to filter results. If empty, returns most recent sessions.',
        },
        limit: {
          type: 'number',
          description: 'Maximum sessions to return (default: 10)',
        },
      },
      required: [],
    },
  },
];

function handleInitialize(): unknown {
  return {
    protocolVersion: '2024-11-05',
    capabilities: {
      tools: {},
    },
    serverInfo: {
      name: 'memory-dal',
      version: '1.0.0',
    },
  };
}

function handleToolsList(): unknown {
  return {
    tools: DAL_TOOLS,
  };
}

async function handleToolsCall(params: {
  name: string;
  arguments?: Record<string, unknown>;
}): Promise<unknown> {
  try {
    const args = params.arguments || {};

    switch (params.name) {
      case 'memory_search_fts': {
        const query = typeof args.query === 'string' ? args.query : '';
        const layer = (args.layer as MemoryLayer) || 'all';
        const limit = typeof args.limit === 'number' ? args.limit : 10;
        const expansion = (args.expansion as ExpansionLevel) || 'minimal';

        if (!query) {
          throw new Error('Query is required');
        }

        const results = await searchMemoryFts(query, layer, limit, expansion);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  searchType: 'fts',
                  layer,
                  expansion,
                  resultCount: results.length,
                  results,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'memory_search_vector': {
        const query = typeof args.query === 'string' ? args.query : '';
        const layer = (args.layer as MemoryLayer) || 'all';
        const limit = typeof args.limit === 'number' ? args.limit : 10;
        const expansion = (args.expansion as ExpansionLevel) || 'minimal';

        if (!query) {
          throw new Error('Query is required');
        }

        const results = await searchMemoryVector(
          query,
          layer,
          limit,
          expansion
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  searchType: 'vector',
                  layer,
                  expansion,
                  resultCount: results.length,
                  results,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'memory_search_hybrid': {
        const query = typeof args.query === 'string' ? args.query : '';
        const layer = (args.layer as MemoryLayer) || 'all';
        const limit = typeof args.limit === 'number' ? args.limit : 10;
        const expansion = (args.expansion as ExpansionLevel) || 'minimal';

        if (!query) {
          throw new Error('Query is required');
        }

        const results = await searchMemoryHybrid(
          query,
          layer,
          limit,
          expansion
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  searchType: 'hybrid',
                  layer,
                  expansion,
                  resultCount: results.length,
                  results,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'memory_list_layers': {
        const gitRemote = getGitRemote();
        const layers = [
          {
            name: 'rules',
            description: 'Project conventions from .claude/rules/',
            available: true,
          },
          {
            name: 'transcripts',
            description: 'Past Claude Code sessions (raw messages)',
            available: true,
          },
          {
            name: 'summaries',
            description:
              "Session summaries with topics (for 'which session discussed X' queries)",
            available: true,
          },
          {
            name: 'team',
            description: 'Git commits and PRs',
            available: !!gitRemote,
            gitRemote,
          },
        ];

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ layers }, null, 2),
            },
          ],
        };
      }

      case 'memory_search_multi_strategy': {
        const query = typeof args.query === 'string' ? args.query : '';
        const layer = (args.layer as MemoryLayer) || 'all';
        const limit = typeof args.limit === 'number' ? args.limit : 10;
        const expansion = (args.expansion as ExpansionLevel) || 'minimal';
        const timeout = typeof args.timeout === 'number' ? args.timeout : 5000;
        const strategies = Array.isArray(args.strategies)
          ? (args.strategies as SearchStrategy[])
          : undefined;

        if (!query) {
          throw new Error('Query is required');
        }

        const result = await executeMultiStrategySearch(
          query,
          layer,
          limit,
          expansion,
          timeout,
          strategies
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  searchType: 'multi_strategy',
                  layer,
                  expansion,
                  confidence: result.confidence,
                  strategiesAttempted: result.strategiesAttempted,
                  strategiesSucceeded: result.strategiesSucceeded,
                  resultCount: result.results.length,
                  results: result.results,
                  strategyResults: result.strategyResults.map((sr) => ({
                    strategy: sr.strategy,
                    resultCount: sr.results.length,
                    duration: sr.duration,
                    success: sr.success,
                    error: sr.error,
                  })),
                  searchStats: result.searchStats,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'memory_search_with_fallbacks': {
        const query = typeof args.query === 'string' ? args.query : '';
        const layer = (args.layer as MemoryLayer) || 'all';
        const limit = typeof args.limit === 'number' ? args.limit : 10;
        const enableGrep = args.enableGrep !== false; // Default true
        const grepTimeout =
          typeof args.grepTimeout === 'number' ? args.grepTimeout : 5000;

        if (!query) {
          throw new Error('Query is required');
        }

        const result = await multiStrategySearchWithFallbacks(
          {
            query,
            layer,
            limit,
            enableFallbacks: true,
            enableGrep,
            grepTimeout,
          },
          {
            searchMemoryFts,
            searchMemoryVector,
            searchSummariesNative: searchSummariesForMultiStrategy,
          }
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  searchType: 'multi_strategy_with_fallbacks',
                  layer,
                  confidence: result.confidence,
                  strategiesAttempted: result.strategiesAttempted,
                  strategiesSucceeded: result.strategiesSucceeded,
                  fallbacksUsed: result.fallbacksUsed,
                  fallbacksAttempted: result.fallbacksAttempted,
                  clarificationPrompt: result.clarificationPrompt,
                  resultCount: result.results.length,
                  results: result.results,
                  strategyResults: result.strategyResults.map((sr) => ({
                    strategy: sr.strategy,
                    resultCount: sr.results.length,
                    duration: sr.duration,
                    success: sr.success,
                    error: sr.error,
                  })),
                  searchStats: result.searchStats,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'memory_grep_transcripts': {
        const query = typeof args.query === 'string' ? args.query : '';
        const limit = typeof args.limit === 'number' ? args.limit : 10;
        const timeout = typeof args.timeout === 'number' ? args.timeout : 5000;

        if (!query) {
          throw new Error('Query is required');
        }

        const result = await grepTranscripts(query, { limit, timeout });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  searchType: 'grep',
                  success: result.success,
                  duration: result.duration,
                  error: result.error,
                  resultCount: result.results.length,
                  results: result.results,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'memory_scan_recent_sessions': {
        const query = typeof args.query === 'string' ? args.query : '';
        const limit = typeof args.limit === 'number' ? args.limit : 10;

        const result = await scanRecentSessions(query || 'recent activity', {
          limit,
        });

        // Check if this is a temporal query for additional context
        const isTemporal = query ? detectTemporalQuery(query) : true;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  searchType: 'recent_sessions',
                  isTemporalQuery: isTemporal,
                  success: result.success,
                  duration: result.duration,
                  error: result.error,
                  resultCount: result.results.length,
                  results: result.results,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      default:
        throw {
          code: -32602,
          message: `Unknown tool: ${params.name}`,
        };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: `Error executing ${params.name}: ${message}`,
        },
      ],
      isError: true,
    };
  }
}

async function handleRequest(
  request: JsonRpcRequest
): Promise<JsonRpcResponse> {
  try {
    let result: unknown;

    switch (request.method) {
      case 'initialize':
        result = handleInitialize();
        break;
      case 'initialized':
        // Notification, no response needed
        return { jsonrpc: '2.0', id: request.id, result: {} };
      case 'ping':
        // Simple ping/pong for health checks
        result = {};
        break;
      case 'tools/list':
        result = handleToolsList();
        break;
      case 'tools/call':
        result = await handleToolsCall(
          request.params as {
            name: string;
            arguments?: Record<string, unknown>;
          }
        );
        break;
      default:
        throw {
          code: -32601,
          message: `Method not found: ${request.method}`,
        };
    }

    return {
      jsonrpc: '2.0',
      id: request.id,
      result,
    };
  } catch (error) {
    const errorObj =
      typeof error === 'object' && error !== null && 'code' in error
        ? (error as { code: number; message: string })
        : { code: -32603, message: String(error) };

    return {
      jsonrpc: '2.0',
      id: request.id,
      error: errorObj,
    };
  }
}

function sendResponse(response: JsonRpcResponse): void {
  const json = JSON.stringify(response);
  process.stdout.write(`${json}\n`);
}

/**
 * Start the Data Access Layer MCP server
 *
 * This server is designed to be used by the Memory Agent via Agent SDK.
 * All operations are read-only for memory safety.
 */
export async function startDalMcpServer(): Promise<void> {
  // Setup signal handlers for graceful shutdown
  process.on('SIGINT', () => process.exit(0));
  process.on('SIGTERM', () => process.exit(0));

  const rl = createInterface({
    input: process.stdin,
    terminal: false,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;

    try {
      const request = JSON.parse(line) as JsonRpcRequest;
      const response = await handleRequest(request);

      // Only send response if there's an id (not a notification)
      if (request.id !== undefined) {
        sendResponse(response);
      }
    } catch (error) {
      // JSON parse error
      sendResponse({
        jsonrpc: '2.0',
        error: {
          code: -32700,
          message: 'Parse error',
          data: String(error),
        },
      });
    }
  }
}
