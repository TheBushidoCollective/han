/**
 * Team Memory API - Search team memory (git history, PRs, decisions)
 *
 * GET /api/team/search?q=query - Search team memory
 */

import { getGitRemote, getMemoryStore } from '../memory/index.ts';
import type { SearchFilters, SearchResult } from '../memory/types.ts';

/**
 * Team search result with additional metadata
 */
export interface TeamSearchResult extends SearchResult {
  /** Layer identifier for the UI */
  layer: 'team';
}

/**
 * Team search response
 */
export interface TeamSearchResponse {
  data: TeamSearchResult[];
  query: string;
  filters?: SearchFilters;
  total: number;
  gitRemote: string | null;
}

/**
 * Parse search filters from URL params
 */
function parseFilters(params: URLSearchParams): SearchFilters | undefined {
  const filters: SearchFilters = {};

  // Timeframe filters
  const since = params.get('since');
  const until = params.get('until');
  if (since || until) {
    filters.timeframe = {};
    if (since) {
      const sinceDate = new Date(since);
      if (!Number.isNaN(sinceDate.getTime())) {
        filters.timeframe.start = sinceDate.getTime();
      }
    }
    if (until) {
      const untilDate = new Date(until);
      if (!Number.isNaN(untilDate.getTime())) {
        filters.timeframe.end = untilDate.getTime();
      }
    }
  }

  // Author filter
  const authors = params.get('authors');
  if (authors) {
    filters.authors = authors
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean);
  }

  // Type filter
  const types = params.get('types');
  if (types) {
    filters.types = types
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean) as SearchFilters['types'];
  }

  // File filter
  const files = params.get('files');
  if (files) {
    filters.files = files
      .split(',')
      .map((f) => f.trim())
      .filter(Boolean);
  }

  // Only return filters if any were set
  return Object.keys(filters).length > 0 ? filters : undefined;
}

/**
 * Search team memory
 */
export async function searchTeamMemory(
  query: string,
  filters?: SearchFilters
): Promise<TeamSearchResult[]> {
  const gitRemote = getGitRemote();
  if (!gitRemote) {
    return [];
  }

  const store = getMemoryStore();
  const results = await store.search(gitRemote, query, filters);

  // Add layer identifier for UI
  return results.map((result) => ({
    ...result,
    layer: 'team' as const,
  }));
}

/**
 * Handle team API requests
 */
export async function handleTeamRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  try {
    // GET /api/team/search
    if (path === '/api/team/search') {
      const query = url.searchParams.get('q');

      if (!query || query.trim().length === 0) {
        return new Response(
          JSON.stringify({
            error: 'Missing query',
            details: "The 'q' parameter is required for search",
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const filters = parseFilters(url.searchParams);
      const gitRemote = getGitRemote();
      const results = await searchTeamMemory(query, filters);

      const response: TeamSearchResponse = {
        data: results,
        query,
        filters,
        total: results.length,
        gitRemote,
      };

      return new Response(JSON.stringify(response), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Unknown team endpoint
    return new Response(
      JSON.stringify({
        error: 'Not found',
        details: 'Unknown team API endpoint',
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
