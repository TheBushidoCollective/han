/**
 * Han Memory Indexer
 *
 * Orchestrates indexing of memory content via han-native using SQLite.
 * Provides FTS5 (BM25) search and embedding generation for the 5-layer
 * memory system: rules, summaries, observations, transcripts, and team memory.
 *
 * Storage location: ~/.han/han.db
 *
 * @note The native module uses SQLite with FTS5 and sqlite-vec extensions.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getHanDataDir } from '../config/claude-settings.ts';
import { fts as grpcFts, vectors as grpcVectors } from '../grpc/data-access.ts';
import {
  getGitRemote,
  getSessionsPath,
  getSummariesPath,
  normalizeGitRemote,
} from './paths.ts';
import type {
  ExtractedObservation,
  RawObservation,
  SessionSummary,
} from './types.ts';

/**
 * Document for FTS indexing
 */
export interface IndexDocument {
  id: string;
  content: string;
  metadata?: string;
}

/**
 * Search result from FTS
 */
export interface FtsResult {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
  score: number;
}

/**
 * Index layer types
 */
export type IndexLayer =
  | 'observations'
  | 'summaries'
  | 'transcripts'
  | 'team'
  | 'han_events';

/**
 * Index status for a layer
 */
export interface IndexStatus {
  layer: IndexLayer;
  documentCount: number;
  lastIndexed: number | null;
  isStale: boolean;
}

/**
 * Get the index database path
 * All data is stored in the main han.db database
 */
export function getIndexDbPath(): string {
  return join(getHanDataDir(), 'han.db');
}

/**
 * Ensure database directory exists
 */
export function ensureIndexDir(): void {
  const dbDir = getHanDataDir();
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }
}

/**
 * Get table name for a layer and optional project scope
 */
export function getTableName(layer: IndexLayer, gitRemote?: string): string {
  const base = `han_${layer}`;
  if (gitRemote) {
    const normalized = normalizeGitRemote(gitRemote);
    return `${base}_${normalized}`;
  }
  return base;
}

/**
 * Initialize the database (creates if not exists)
 */
export async function initTable(_tableName: string): Promise<boolean> {
  // Database initialization handled by coordinator via gRPC
  ensureIndexDir();
  return true;
}

/**
 * Index documents into FTS and Vector store
 * Runs both in parallel - FTS for keyword search, Vector for semantic search
 */
export async function indexDocuments(
  _tableName: string,
  documents: IndexDocument[]
): Promise<number> {
  if (documents.length === 0) return 0;

  ensureIndexDir();

  // Index via gRPC FTS service
  let count = 0;
  for (const doc of documents) {
    try {
      await grpcFts.index(doc.id, doc.content);
      count++;
    } catch {
      // Skip failed documents
    }
  }

  // Also index to vector store for semantic search (best effort)
  try {
    for (const doc of documents) {
      await grpcVectors.index(doc.id, doc.content);
    }
  } catch {
    // Vector indexing failed - FTS still works
  }

  return count;
}

/**
 * Batch size for embedding generation
 * Larger batches are more efficient but use more memory
 */
const EMBEDDING_BATCH_SIZE = 32;

/**
 * Index documents to vector store for semantic search
 * Generates embeddings and stores with sqlite-vec
 */
// Vector indexing is now handled inline in indexDocuments via gRPC

/**
 * Search FTS index
 */
export async function searchFts(
  _tableName: string,
  query: string,
  limit = 10
): Promise<FtsResult[]> {
  try {
    const results = await grpcFts.search(query, { limit });

    return results.map((r) => ({
      id: r.id,
      content: r.content,
      metadata: undefined,
      score: r.score,
    }));
  } catch {
    return [];
  }
}

/**
 * Search vector index by semantic similarity
 */
export async function searchVector(
  _tableName: string,
  query: string,
  limit = 10
): Promise<FtsResult[]> {
  try {
    const results = await grpcVectors.search(query, { limit });

    return results.map((r) => ({
      id: r.id,
      content: r.content,
      metadata: undefined,
      score: r.score,
    }));
  } catch {
    return [];
  }
}

/**
 * Reciprocal Rank Fusion constant
 * Higher values give more weight to top results
 */
const RRF_K = 60;

/**
 * Hybrid search combining FTS (keyword) and Vector (semantic) results
 * Uses Reciprocal Rank Fusion to combine rankings
 */
export async function hybridSearch(
  tableName: string,
  query: string,
  limit = 10
): Promise<FtsResult[]> {
  // Search both systems in parallel, request more results for fusion
  const expandedLimit = limit * 2;

  const [ftsResults, vectorResults] = await Promise.all([
    searchFts(tableName, query, expandedLimit),
    searchVector(tableName, query, expandedLimit),
  ]);

  // If only one system has results, return those
  if (ftsResults.length === 0) return vectorResults.slice(0, limit);
  if (vectorResults.length === 0) return ftsResults.slice(0, limit);

  // Reciprocal Rank Fusion
  const scores = new Map<string, { score: number; result: FtsResult }>();

  // Add FTS results with RRF scores
  ftsResults.forEach((result, rank) => {
    const rrfScore = 1 / (RRF_K + rank + 1);
    const existing = scores.get(result.id);
    if (existing) {
      existing.score += rrfScore;
    } else {
      scores.set(result.id, { score: rrfScore, result });
    }
  });

  // Add Vector results with RRF scores
  vectorResults.forEach((result, rank) => {
    const rrfScore = 1 / (RRF_K + rank + 1);
    const existing = scores.get(result.id);
    if (existing) {
      existing.score += rrfScore;
    } else {
      scores.set(result.id, { score: rrfScore, result });
    }
  });

  // Sort by combined RRF score and return top results
  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ result, score }) => ({
      ...result,
      score, // Replace original score with RRF fusion score
    }));
}

/**
 * Delete documents from FTS index
 */
export async function deleteDocuments(
  _tableName: string,
  ids: string[]
): Promise<number> {
  let count = 0;
  for (const id of ids) {
    const ok = await grpcFts.delete(id);
    if (ok) count++;
  }
  return count;
}

/**
 * Generate embedding for a single text
 * @deprecated Embedding generation is now handled by the coordinator
 */
export async function generateEmbedding(_text: string): Promise<number[]> {
  // Embedding generation is now handled by the coordinator via gRPC
  return [];
}

/**
 * Generate embeddings for multiple texts (batched)
 * @deprecated Embedding generation is now handled by the coordinator
 */
export async function generateEmbeddings(_texts: string[]): Promise<number[][]> {
  // Embedding generation is now handled by the coordinator via gRPC
  return [];
}

/**
 * Get embedding dimension (384 for all-MiniLM-L6-v2)
 */
export function getEmbeddingDimension(): number {
  return 384; // Default for all-MiniLM-L6-v2
}

/**
 * Convert RawObservation to IndexDocument
 */
function rawObservationToDocument(obs: RawObservation): IndexDocument {
  const content = [
    `Tool: ${obs.tool}`,
    obs.input_summary,
    obs.output_summary,
    obs.files_read.length > 0 ? `Files read: ${obs.files_read.join(', ')}` : '',
    obs.files_modified.length > 0
      ? `Files modified: ${obs.files_modified.join(', ')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    id: obs.id,
    content,
    metadata: JSON.stringify({
      session_id: obs.session_id,
      timestamp: obs.timestamp,
      tool: obs.tool,
      files_read: obs.files_read,
      files_modified: obs.files_modified,
      layer: 'observations',
    }),
  };
}

/**
 * Convert SessionSummary to IndexDocument
 */
function summaryToDocument(summary: SessionSummary): IndexDocument {
  const workItems = summary.work_items
    .map((w) => `- ${w.description} (${w.outcome})`)
    .join('\n');

  const decisions = summary.decisions
    .map((d) => `- ${d.description}: ${d.rationale}`)
    .join('\n');

  const content = [
    summary.summary,
    workItems ? `Work completed:\n${workItems}` : '',
    summary.in_progress.length > 0
      ? `In progress: ${summary.in_progress.join(', ')}`
      : '',
    decisions ? `Decisions:\n${decisions}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  return {
    id: summary.session_id,
    content,
    metadata: JSON.stringify({
      session_id: summary.session_id,
      project: summary.project,
      started_at: summary.started_at,
      ended_at: summary.ended_at,
      layer: 'summaries',
    }),
  };
}

/**
 * Convert ExtractedObservation to IndexDocument (for team memory)
 */
function extractedObservationToDocument(
  obs: ExtractedObservation
): IndexDocument {
  const content = [
    obs.summary,
    obs.detail,
    obs.files.length > 0 ? `Files: ${obs.files.join(', ')}` : '',
    obs.pr_context
      ? `PR #${obs.pr_context.number}: ${obs.pr_context.title}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    id: obs.source,
    content,
    metadata: JSON.stringify({
      source: obs.source,
      type: obs.type,
      timestamp: obs.timestamp,
      author: obs.author,
      files: obs.files,
      patterns: obs.patterns,
      pr_context: obs.pr_context,
      layer: 'team',
    }),
  };
}

/**
 * Parsed event format for indexing
 * Used for dynamic property access when converting events to documents.
 * Matches the shape written by EventLogger (lib/events/types.ts HanEvent union).
 */
interface ParsedHanEvent {
  id: string;
  type: string;
  timestamp: string; // ISO string
  data: Record<string, unknown>;
}

/**
 * Convert logged event to IndexDocument
 * Handles the actual format written by EventLogger
 */
function _hanEventToDocument(
  event: ParsedHanEvent,
  sessionId: string
): IndexDocument {
  const eventTypeLabels: Record<string, string> = {
    hook_run: 'Hook started',
    hook_result: 'Hook completed',
    mcp_tool_call: 'MCP tool called',
    mcp_tool_result: 'MCP tool result',
    exposed_tool_call: 'Exposed tool called',
    exposed_tool_result: 'Exposed tool result',
    memory_query: 'Memory queried',
    memory_learn: 'Memory learned',
    sentiment_analysis: 'Sentiment analyzed',
  };

  const label = eventTypeLabels[event.type] || event.type;
  const data = event.data || {};

  // Build descriptive content from event data
  const contentParts = [`[${label}]`];
  if (data.plugin) contentParts.push(`Plugin: ${data.plugin}`);
  if (data.hook) contentParts.push(`Hook: ${data.hook}`);
  if (data.directory) contentParts.push(`Directory: ${data.directory}`);
  if (data.success !== undefined) contentParts.push(`Success: ${data.success}`);
  if (data.output)
    contentParts.push(`Output: ${String(data.output).slice(0, 500)}`);

  const content = contentParts.join('\n');

  return {
    id: event.id,
    content,
    metadata: JSON.stringify({
      session_id: sessionId,
      timestamp: event.timestamp,
      event_type: event.type,
      layer: 'han_events',
    }),
  };
}

/**
 * Index Han events from session files
 *
 * @deprecated This function is no longer needed. The Rust coordinator (han-native)
 * automatically indexes Han events from JSONL files into the messages table with
 * message_type='han_event'. Query using messages.list({ messageType: 'han_event' }).
 *
 * This function now returns 0 (no-op) since the Rust indexer handles all JSONL indexing.
 *
 * @param _projectSlug - Ignored, kept for API compatibility
 */
export async function indexHanEvents(_projectSlug?: string): Promise<number> {
  // No-op: The Rust coordinator (han-native/src/indexer.rs) already indexes
  // Han events from *-han.jsonl files into the SQLite database.
  // Query using: messages.list({ sessionId, messageType: 'han_event' })
  return 0;
}

/**
 * Index personal session observations
 *
 * @deprecated This function reads JSONL files directly. In the future, Han's personal
 * memory system should be migrated to use the Rust indexer. For now, this function
 * remains as-is since it reads from a different location (~/.han/memory/personal/sessions)
 * than the Claude Code transcripts indexed by the Rust coordinator.
 *
 * TODO: Migrate Han personal memory to Rust indexer for consistency.
 */
export async function indexObservations(sessionId?: string): Promise<number> {
  const sessionsPath = getSessionsPath();
  if (!existsSync(sessionsPath)) {
    return 0;
  }

  const tableName = getTableName('observations');
  await initTable(tableName);

  const documents: IndexDocument[] = [];

  // Find session files to index
  const files = readdirSync(sessionsPath).filter((f) => f.endsWith('.jsonl'));

  for (const file of files) {
    // If sessionId provided, only index that session
    if (sessionId && !file.includes(sessionId)) {
      continue;
    }

    const filePath = join(sessionsPath, file);
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter((line) => line.trim());

    for (const line of lines) {
      try {
        const obs = JSON.parse(line) as RawObservation;
        documents.push(rawObservationToDocument(obs));
      } catch {
        // Skip invalid lines
      }
    }
  }

  if (documents.length === 0) {
    return 0;
  }

  return indexDocuments(tableName, documents);
}

/**
 * Index personal session summaries
 */
export async function indexSummaries(): Promise<number> {
  const summariesPath = getSummariesPath();
  if (!existsSync(summariesPath)) {
    return 0;
  }

  const tableName = getTableName('summaries');
  await initTable(tableName);

  const documents: IndexDocument[] = [];

  // Find summary files to index
  const files = readdirSync(summariesPath).filter(
    (f) => f.endsWith('.yaml') || f.endsWith('.json')
  );

  for (const file of files) {
    const filePath = join(summariesPath, file);
    try {
      const content = readFileSync(filePath, 'utf-8');
      const summary = JSON.parse(content) as SessionSummary;
      documents.push(summaryToDocument(summary));
    } catch {
      // Skip invalid files
    }
  }

  if (documents.length === 0) {
    return 0;
  }

  return indexDocuments(tableName, documents);
}

/**
 * Index team memory observations (from git/github)
 */
export async function indexTeamMemory(
  gitRemote: string,
  observations: ExtractedObservation[]
): Promise<number> {
  if (observations.length === 0) {
    return 0;
  }

  const tableName = getTableName('team', gitRemote);
  await initTable(tableName);

  const documents = observations.map(extractedObservationToDocument);
  return indexDocuments(tableName, documents);
}

/**
 * Index options for the CLI command
 */
export interface IndexOptions {
  layer?: IndexLayer;
  gitRemote?: string;
  sessionId?: string;
  projectSlug?: string;
  verbose?: boolean;
}

/**
 * Run full indexing
 */
export async function runIndex(options: IndexOptions = {}): Promise<{
  observations: number;
  summaries: number;
  team: number;
  transcripts: number;
  han_events: number;
}> {
  const results = {
    observations: 0,
    summaries: 0,
    team: 0,
    transcripts: 0,
    han_events: 0,
  };

  const layers = options.layer
    ? [options.layer]
    : ['observations', 'summaries'];

  for (const layer of layers) {
    switch (layer) {
      case 'observations':
        results.observations = await indexObservations(options.sessionId);
        if (options.verbose) {
          console.log(`Indexed ${results.observations} observations`);
        }
        break;

      case 'summaries': {
        // Index native Claude summaries from transcripts (Layer 2)
        const { indexNativeSummaries } = await import('./transcript-search.ts');
        results.summaries = await indexNativeSummaries(options.projectSlug);
        if (options.verbose) {
          console.log(`Indexed ${results.summaries} native summaries`);
        }
        break;
      }

      case 'team': {
        // Team memory requires git remote
        const remote = options.gitRemote || getGitRemote();
        if (!remote) {
          if (options.verbose) {
            console.log('Skipping team memory: not in a git repository');
          }
          break;
        }
        // Team memory indexing is handled by the providers
        // This will be called from the memory command
        if (options.verbose) {
          console.log('Team memory indexing requires running memory providers');
        }
        break;
      }

      case 'transcripts': {
        // Import transcript indexing dynamically to avoid circular deps
        const { indexTranscripts } = await import('./transcript-search.ts');
        results.transcripts = await indexTranscripts(options.projectSlug);
        if (options.verbose) {
          console.log(`Indexed ${results.transcripts} transcript messages`);
        }
        break;
      }

      case 'han_events': {
        results.han_events = await indexHanEvents(options.projectSlug);
        if (options.verbose) {
          console.log(`Indexed ${results.han_events} Han events`);
        }
        break;
      }
    }
  }

  return results;
}

/**
 * Search across all indexed layers
 */
export async function searchAll(
  query: string,
  options: {
    layers?: IndexLayer[];
    gitRemote?: string;
    limit?: number;
  } = {}
): Promise<FtsResult[]> {
  const layers = options.layers || ['observations', 'summaries'];
  const limit = options.limit || 10;
  const allResults: FtsResult[] = [];

  for (const layer of layers) {
    const tableName = getTableName(
      layer,
      layer === 'team' ? options.gitRemote : undefined
    );

    try {
      const results = await searchFts(tableName, query, limit);
      allResults.push(...results);
    } catch {
      // Table may not exist yet, skip
    }
  }

  // Sort by score and limit
  return allResults.sort((a, b) => b.score - a.score).slice(0, limit);
}
