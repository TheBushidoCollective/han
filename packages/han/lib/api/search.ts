/**
 * Global Memory Search API - Search all memory layers at once
 *
 * GET /api/search?q=query - Search all memory layers
 *
 * Uses the unified queryMemoryAgent function which spawns an Agent SDK
 * agent with discovered MCP providers (blueprints, github, etc.)
 */

import {
  type MemoryAgentResponse,
  queryMemoryAgent,
} from '../memory/memory-agent.ts';

/**
 * Parameters for memory search (requires project context)
 */
export interface MemorySearchParams {
  query: string;
  projectPath: string;
  limit?: number;
}

/**
 * Citation from a memory search result
 */
export interface Citation {
  source: string;
  excerpt: string;
  author?: string;
  timestamp?: number;
  layer?: string;
}

/**
 * Response format for memory search
 */
export interface MemorySearchResponse {
  query: string;
  answer: string;
  source: string;
  confidence: string;
  citations: Citation[];
  caveats: string[];
  layersSearched: string[];
}

/**
 * Search memory layers using the Memory Agent (requires project context)
 */
export async function searchMemory(
  params: MemorySearchParams
): Promise<MemorySearchResponse> {
  const { query, projectPath, limit } = params;

  // Call the unified queryMemoryAgent which uses Agent SDK with discovered providers
  // projectPath is required for context-aware plugin discovery
  const result: MemoryAgentResponse = await queryMemoryAgent({
    question: query,
    projectPath,
    limit,
  });

  // Map the result to the GlobalSearchResponse format
  return {
    query,
    answer: result.answer,
    source:
      result.searchedLayers.length > 1
        ? 'combined'
        : result.searchedLayers[0] || 'transcripts',
    confidence: result.confidence,
    citations: result.citations.map(
      (c: MemoryAgentResponse['citations'][number]): Citation => ({
        source: c.source,
        excerpt: c.excerpt,
        author: c.author,
        timestamp: c.timestamp,
        layer: c.layer,
      })
    ),
    caveats: result.error ? [result.error] : [],
    layersSearched: result.searchedLayers,
  };
}

/**
 * Handle global search API requests
 */
export async function handleSearchRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  try {
    // GET /api/search
    if (path === '/api/search') {
      const query = url.searchParams.get('q');
      const projectPath = url.searchParams.get('projectPath');

      if (!query || query.trim().length === 0) {
        return new Response(
          JSON.stringify({
            error: 'Missing query',
            details: "The 'q' parameter is required for search",
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (!projectPath || projectPath.trim().length === 0) {
        return new Response(
          JSON.stringify({
            error: 'Missing projectPath',
            details:
              "The 'projectPath' parameter is required for memory search. It determines which plugins are available.",
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Parse optional limit parameter
      const limitParam = url.searchParams.get('limit');
      const limit = limitParam
        ? Math.min(100, Math.max(1, Number.parseInt(limitParam, 10)))
        : undefined;

      const response = await searchMemory({ query, projectPath, limit });

      return new Response(JSON.stringify(response), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Unknown search endpoint
    return new Response(
      JSON.stringify({
        error: 'Not found',
        details: 'Unknown search API endpoint',
      }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
