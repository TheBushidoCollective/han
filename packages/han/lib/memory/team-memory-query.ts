/**
 * Team Memory Query
 *
 * Main entry point for team memory queries with permission-aware access.
 * Combines permission filtering, search, and synthesis for team-wide memory.
 *
 * Data Flow:
 * Query -> Get User -> Get Permitted Sessions -> Pre-filter
 *       -> Hybrid Search -> Double-check Permissions
 *       -> Memory Agent Synthesis -> Citations + Visibility
 */

import type { Session } from '../grpc/data-access.ts';
import { sessions as dbSessions, searchMessages as grpcSearchMessages } from '../grpc/data-access.ts';

import type {
  MemoryScope,
  UserPermissionContext,
} from './permission-filter.ts';
import {
  applySessionIdPreFilter,
  filterSessionsByPermission,
  validateSearchResults,
} from './permission-filter.ts';
import { enforceRateLimit, RateLimitExceededError } from './rate-limiter.ts';
import {
  cachePermittedSessions,
  cacheQueryResult,
  getCachedPermittedSessions,
  getCachedQueryResult,
  type TeamMemoryCacheEntry,
} from './team-memory-cache.ts';

/**
 * Team memory query parameters
 */
export interface TeamMemoryQueryParams {
  /** The question to research */
  question: string;
  /** User permission context */
  context: UserPermissionContext;
  /** Memory scope to search */
  scope?: MemoryScope;
  /** Maximum results to return */
  limit?: number;
  /** Whether to use cache */
  useCache?: boolean;
  /** Project path for context-aware search */
  projectPath?: string;
}

/**
 * Citation with visibility information
 */
export interface TeamCitation {
  /** Source identifier */
  source: string;
  /** Relevant excerpt (sanitized) */
  excerpt: string;
  /** Session ID if from a session */
  sessionId?: string;
  /** Visibility level of the source */
  visibility: 'public' | 'team' | 'private';
  /** Author if known */
  author?: string;
  /** Timestamp if known */
  timestamp?: number;
}

/**
 * Team memory query result
 */
export interface TeamMemoryResult {
  /** Synthesized answer */
  answer: string;
  /** Confidence level */
  confidence: 'high' | 'medium' | 'low';
  /** Citations with visibility metadata */
  citations: TeamCitation[];
  /** Number of sessions searched */
  sessionsSearched: number;
  /** Whether result is from cache */
  cached: boolean;
  /** Search statistics */
  stats: {
    totalSessions: number;
    permittedSessions: number;
    resultsFound: number;
    resultsFiltered: number;
  };
}

/**
 * Search result with session context
 */
interface SearchResultWithSession {
  id: string;
  content: string;
  score: number;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Get permitted session IDs for a user (with caching)
 */
export async function getPermittedSessionIds(
  context: UserPermissionContext,
  scope: MemoryScope = 'team'
): Promise<string[]> {
  // Check cache first
  const cached = getCachedPermittedSessions(context.userId, context.orgId);
  if (cached) {
    return cached;
  }

  // Get all sessions from database
  const allSessions = await dbSessions.list({ limit: 2000 });

  // Filter by permissions
  const result = filterSessionsByPermission(allSessions, context, scope);

  // Cache the result
  cachePermittedSessions(context.userId, result.sessionIds, context.orgId);

  return result.sessionIds;
}

/**
 * Search messages with session filter
 *
 * Extends the native search to support session ID filtering for permissions
 */
async function searchMessagesWithSessionFilter(
  query: string,
  sessionIds: string[],
  limit: number
): Promise<SearchResultWithSession[]> {
  const results: SearchResultWithSession[] = [];

  // Search each permitted session via gRPC
  const sessionsToSearch = applySessionIdPreFilter(sessionIds);

  for (const sessionId of sessionsToSearch) {
    if (results.length >= limit) break;

    try {
      const sessionResults = await grpcSearchMessages({
        query,
        sessionId,
        limit: Math.min(10, limit - results.length), // Limit per session
      });

      for (const msg of sessionResults) {
        results.push({
          id: msg.id,
          content: msg.content || '',
          score: msg.score ?? 0.7, // FTS match score
          sessionId: msg.session_id,
          metadata: {},
        });
      }
    } catch {
      // Skip sessions that fail to search
    }
  }

  // Sort by score
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, limit);
}

/**
 * Determine visibility level for a citation
 */
function determineVisibility(
  sessionId: string | undefined,
  _context: UserPermissionContext,
  _session?: Session
): 'public' | 'team' | 'private' {
  if (!sessionId) {
    // Non-session sources (rules, docs) are public within the org
    return 'public';
  }

  // For now, treat all session content as team-visible
  // This will be refined when proper ACLs are implemented
  return 'team';
}

/**
 * Sanitize excerpt for safe display
 *
 * Removes potentially sensitive information from excerpts
 */
function sanitizeExcerpt(content: string, maxLength = 200): string {
  // Truncate
  let excerpt = content.slice(0, maxLength);
  if (content.length > maxLength) {
    excerpt += '...';
  }

  // Remove potential secrets (basic patterns)
  excerpt = excerpt.replace(
    /(?:password|secret|token|api[_-]?key|auth)\s*[:=]\s*['"][^'"]+['"]/gi,
    '[REDACTED]'
  );
  excerpt = excerpt.replace(
    /(?:Bearer|Basic)\s+[A-Za-z0-9._-]+/gi,
    '[REDACTED]'
  );

  return excerpt;
}

/**
 * Synthesize answer from search results
 *
 * Simple synthesis without LLM - returns summary of findings
 * For LLM-powered synthesis, use queryTeamMemoryWithAgent
 */
function synthesizeAnswer(
  question: string,
  results: SearchResultWithSession[]
): { answer: string; confidence: 'high' | 'medium' | 'low' } {
  if (results.length === 0) {
    return {
      answer: 'No relevant information found in accessible team memory.',
      confidence: 'low',
    };
  }

  // Group results by content similarity
  const uniqueContents = new Set<string>();
  const relevantResults: SearchResultWithSession[] = [];

  for (const result of results) {
    // Simple deduplication by content prefix
    const contentKey = result.content.slice(0, 100);
    if (!uniqueContents.has(contentKey)) {
      uniqueContents.add(contentKey);
      relevantResults.push(result);
    }
  }

  // Build summary
  const summaryParts: string[] = [];

  if (relevantResults.length === 1) {
    summaryParts.push(
      `Found 1 relevant result in team memory related to "${question}".`
    );
  } else {
    summaryParts.push(
      `Found ${relevantResults.length} relevant results in team memory related to "${question}".`
    );
  }

  // Add top result excerpt
  if (relevantResults[0]) {
    const excerpt = sanitizeExcerpt(relevantResults[0].content, 300);
    summaryParts.push(`\nMost relevant: "${excerpt}"`);
  }

  // Determine confidence based on result count and scores
  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (relevantResults.length >= 5) {
    confidence = 'high';
  } else if (relevantResults.length >= 2) {
    confidence = 'medium';
  }

  return {
    answer: summaryParts.join('\n'),
    confidence,
  };
}

/**
 * Query team memory with permission filtering
 *
 * Main entry point for team memory queries
 */
export async function queryTeamMemory(
  params: TeamMemoryQueryParams
): Promise<TeamMemoryResult> {
  const {
    question,
    context,
    scope = 'team',
    limit = 20,
    useCache = true,
    // projectPath is reserved for future context-aware search
    projectPath: _projectPath,
  } = params;

  // Rate limit check
  try {
    enforceRateLimit(context.userId, 'query');
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      return {
        answer: `Rate limit exceeded. Please wait ${Math.ceil(error.result.resetIn / 1000)} seconds.`,
        confidence: 'low',
        citations: [],
        sessionsSearched: 0,
        cached: false,
        stats: {
          totalSessions: 0,
          permittedSessions: 0,
          resultsFound: 0,
          resultsFiltered: 0,
        },
      };
    }
    throw error;
  }

  // Check cache
  if (useCache) {
    const cached = getCachedQueryResult(
      context.userId,
      question,
      scope,
      context.orgId
    );
    if (cached) {
      return {
        answer: cached.answer,
        confidence: cached.confidence,
        citations: cached.citations,
        sessionsSearched: cached.sessionsSearched,
        cached: true,
        stats: {
          totalSessions: cached.sessionsSearched,
          permittedSessions: cached.sessionsSearched,
          resultsFound: cached.citations.length,
          resultsFiltered: 0,
        },
      };
    }
  }

  // Get permitted session IDs
  const permittedSessionIds = await getPermittedSessionIds(context, scope);

  if (permittedSessionIds.length === 0) {
    return {
      answer:
        'No accessible sessions found. You may not have permission to search team memory.',
      confidence: 'low',
      citations: [],
      sessionsSearched: 0,
      cached: false,
      stats: {
        totalSessions: 0,
        permittedSessions: 0,
        resultsFound: 0,
        resultsFiltered: 0,
      },
    };
  }

  // Search with session filter
  const searchResults = await searchMessagesWithSessionFilter(
    question,
    permittedSessionIds,
    limit * 2 // Get extra for deduplication
  );

  // Double-check permissions on results (defense in depth)
  const permittedSet = new Set(permittedSessionIds);
  const { validated, rejected } = validateSearchResults(
    searchResults,
    permittedSet
  );

  if (rejected > 0) {
    console.warn(
      `[TeamMemory] Permission double-check rejected ${rejected} results`
    );
  }

  // Synthesize answer
  const { answer, confidence } = synthesizeAnswer(question, validated);

  // Build citations
  const citations: TeamCitation[] = validated.slice(0, limit).map((result) => ({
    source: result.sessionId
      ? `transcript:${result.sessionId}:${result.id}`
      : result.id,
    excerpt: sanitizeExcerpt(result.content),
    sessionId: result.sessionId,
    visibility: determineVisibility(result.sessionId, context),
    author:
      (result.metadata?.author as string) ||
      (result.metadata?.role as string) ||
      undefined,
    timestamp: result.metadata?.timestamp as number | undefined,
  }));

  const result: TeamMemoryResult = {
    answer,
    confidence,
    citations,
    sessionsSearched: permittedSessionIds.length,
    cached: false,
    stats: {
      totalSessions: permittedSessionIds.length,
      permittedSessions: permittedSessionIds.length,
      resultsFound: validated.length,
      resultsFiltered: rejected,
    },
  };

  // Cache the result
  if (useCache) {
    const cacheEntry: TeamMemoryCacheEntry = {
      answer: result.answer,
      confidence: result.confidence,
      citations: result.citations,
      sessionsSearched: result.sessionsSearched,
      cachedAt: Date.now(),
    };
    cacheQueryResult(
      context.userId,
      question,
      scope,
      cacheEntry,
      context.orgId
    );
  }

  return result;
}

/**
 * Search team memory without synthesis
 *
 * Lower-level API that returns raw search results
 */
export async function searchTeamMemory(
  query: string,
  context: UserPermissionContext,
  options: {
    scope?: MemoryScope;
    limit?: number;
  } = {}
): Promise<{
  results: SearchResultWithSession[];
  sessionsSearched: number;
}> {
  const { scope = 'team', limit = 20 } = options;

  // Rate limit check
  enforceRateLimit(context.userId, 'search');

  // Get permitted session IDs
  const permittedSessionIds = await getPermittedSessionIds(context, scope);

  if (permittedSessionIds.length === 0) {
    return { results: [], sessionsSearched: 0 };
  }

  // Search with session filter
  const searchResults = await searchMessagesWithSessionFilter(
    query,
    permittedSessionIds,
    limit
  );

  // Double-check permissions
  const permittedSet = new Set(permittedSessionIds);
  const { validated } = validateSearchResults(searchResults, permittedSet);

  return {
    results: validated,
    sessionsSearched: permittedSessionIds.length,
  };
}

/**
 * Get memory layers available to a user
 */
export async function getTeamMemoryLayers(
  context: UserPermissionContext
): Promise<
  Array<{
    name: string;
    description: string;
    available: boolean;
    sessionCount: number;
  }>
> {
  const personalSessions = await getPermittedSessionIds(context, 'personal');
  const projectSessions = await getPermittedSessionIds(context, 'project');
  const teamSessions = await getPermittedSessionIds(context, 'team');

  return [
    {
      name: 'personal',
      description: 'Your own sessions',
      available: personalSessions.length > 0,
      sessionCount: personalSessions.length,
    },
    {
      name: 'project',
      description: 'Sessions in projects you belong to',
      available: projectSessions.length > personalSessions.length,
      sessionCount: projectSessions.length,
    },
    {
      name: 'team',
      description: 'Sessions visible via repo permissions',
      available: teamSessions.length > projectSessions.length,
      sessionCount: teamSessions.length,
    },
    {
      name: 'org',
      description: 'Aggregated learnings only (no raw data)',
      available: !!context.orgId,
      sessionCount: teamSessions.length, // Same sessions, different access
    },
  ];
}
