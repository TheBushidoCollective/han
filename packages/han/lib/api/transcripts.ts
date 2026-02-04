/**
 * Transcripts API - Search conversation transcripts
 *
 * GET /api/transcripts/search?q=query - Search transcripts
 */

import { getGitRemote } from '../memory/index.ts';
import {
  searchTranscripts as searchTranscriptsFts,
  searchTranscriptsText,
  type TranscriptSearchOptions,
  type TranscriptSearchResult,
} from '../memory/transcript-search.ts';

/**
 * Transcript search response
 */
export interface TranscriptSearchResponse {
  data: TranscriptSearchResult[];
  query: string;
  scope: TranscriptSearchOptions['scope'];
  total: number;
  usedFts: boolean;
}

/**
 * Parse transcript search options from URL params
 */
function parseOptions(params: URLSearchParams): TranscriptSearchOptions {
  const query = params.get('q') || '';
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(params.get('limit') || '20', 10))
  );
  const scope = (params.get('scope') ||
    'peers') as TranscriptSearchOptions['scope'];
  const includeThinking = params.get('includeThinking') === 'true';

  const options: TranscriptSearchOptions = {
    query,
    limit,
    scope,
    includeThinking,
  };

  // Project slug filter
  const projectSlug = params.get('projectSlug');
  if (projectSlug) {
    options.projectSlug = projectSlug;
  }

  // Git remote for peer detection
  const gitRemote = getGitRemote();
  if (gitRemote) {
    options.gitRemote = gitRemote;
  }

  // Since filter (timestamp)
  const since = params.get('since');
  if (since) {
    const sinceDate = new Date(since);
    if (!Number.isNaN(sinceDate.getTime())) {
      options.since = sinceDate.getTime();
    }
  }

  return options;
}

/**
 * Search transcripts with FTS fallback to text search
 */
export async function searchTranscripts(
  options: TranscriptSearchOptions
): Promise<{ results: TranscriptSearchResult[]; usedFts: boolean }> {
  try {
    // Try FTS search first
    const results = await searchTranscriptsFts(options);
    return { results, usedFts: true };
  } catch {
    // Fall back to text-based search
    const results = await searchTranscriptsText(options);
    return { results, usedFts: false };
  }
}

/**
 * Handle transcripts API requests
 */
export async function handleTranscriptsRequest(
  req: Request
): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  try {
    // GET /api/transcripts/search
    if (path === '/api/transcripts/search') {
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

      const options = parseOptions(url.searchParams);
      const { results, usedFts } = await searchTranscripts(options);

      const response: TranscriptSearchResponse = {
        data: results,
        query: options.query,
        scope: options.scope,
        total: results.length,
        usedFts,
      };

      return new Response(JSON.stringify(response), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Unknown transcripts endpoint
    return new Response(
      JSON.stringify({
        error: 'Not found',
        details: 'Unknown transcripts API endpoint',
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
