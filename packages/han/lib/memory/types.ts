/**
 * Han Memory System Types
 *
 * Three-layer memory architecture:
 * - Personal: Session observations and summaries
 * - Team: Research-based knowledge from git/PRs
 * - Rules: Permanent wisdom in .claude/rules/
 */

/**
 * Raw observation captured during a session (PostToolUse hook)
 */
export interface RawObservation {
  id: string;
  session_id: string;
  timestamp: number;
  tool: string;
  input_summary: string;
  output_summary: string;
  files_read: string[];
  files_modified: string[];
}

/**
 * AI-compressed session summary (Stop hook)
 */
export interface SessionSummary {
  session_id: string;
  project: string;
  started_at: number;
  ended_at: number;
  summary: string;
  work_items: WorkItem[];
  in_progress: string[];
  decisions: Decision[];
}

/**
 * A discrete unit of work completed during a session
 */
export interface WorkItem {
  description: string;
  files: string[];
  outcome: 'completed' | 'partial' | 'blocked';
}

/**
 * A decision made during a session
 */
export interface Decision {
  description: string;
  rationale: string;
  alternatives_considered?: string[];
}

/**
 * Observation types for team memory
 */
export type ObservationType =
  | 'commit'
  | 'pr'
  | 'review'
  | 'issue'
  | 'discussion'
  | 'decision'
  | 'documentation'
  | 'session';

/**
 * Indexed observation for team memory (with embeddings)
 */
export interface IndexedObservation {
  id: string;
  source: string; // "git:commit:abc" | "github:pr:123"
  type: ObservationType;
  timestamp: number;
  author: string;
  summary: string;
  detail: string;
  files: string[];
  patterns: string[];
  embedding?: number[];
  pr_context?: {
    number: number;
    title: string;
    description: string;
  };
}

/**
 * Metadata about the index state for a project
 */
export interface IndexMetadata {
  project_path: string;
  created_at: number;
  updated_at: number;
  sources: Record<
    string,
    {
      indexed_at: number;
      last_item?: number; // timestamp of last indexed item
      item_count: number;
    }
  >;
}

/**
 * Search filters for team memory queries
 */
export interface SearchFilters {
  timeframe?: {
    start?: number;
    end?: number;
  };
  authors?: string[];
  types?: ObservationType[];
  files?: string[]; // glob patterns
}

/**
 * Search result from memory queries
 */
export interface SearchResult {
  observation: IndexedObservation;
  score: number;
  excerpt: string;
}

/**
 * Citation for research-backed answers
 */
export interface Citation {
  source: string; // e.g., "git:commit:abc123", "github:pr:42"
  excerpt: string; // Relevant quote from source
  relevance: number; // 0-1 score indicating how relevant this citation is
  timestamp?: number;
  author?: string;
  url?: string;
}

/**
 * Result from research engine
 */
export interface ResearchResult {
  answer: string;
  confidence: 'high' | 'medium' | 'low';
  citations: Citation[];
  caveats: string[];
  searched_sources: string[];
}

/**
 * Memory scope: project-local or user-wide
 */
export type MemoryScope = 'project' | 'user';

/**
 * Lead for research investigation
 */
export interface Lead {
  id: string;
  type: 'initial' | 'commit' | 'pr' | 'file' | 'reference' | 'author';
  query?: string;
  sha?: string;
  number?: number;
  path?: string;
  ref?: string;
  author?: string;
  priority: number;
}

/**
 * Evidence collected during research
 */
export interface Evidence {
  citation: Citation; // Where this evidence came from
  claim: string; // What this evidence supports
  confidence: number; // 0-1 score for strength of this evidence
}

/**
 * Result of investigating a lead
 */
export interface InvestigationResult {
  evidence: Evidence[];
  newLeads: Lead[];
}

/**
 * Options for extracting observations from a source
 */
export interface ExtractOptions {
  /** Only extract items after this timestamp */
  since?: number;
  /** Limit number of items to extract */
  limit?: number;
  /** Only extract items from specific authors */
  authors?: string[];
  /** Only extract items touching specific files (glob patterns) */
  files?: string[];
}

/**
 * Observation extracted from a source provider (before indexing)
 */
export interface ExtractedObservation {
  source: string; // e.g., "git:commit:abc123"
  type: ObservationType;
  timestamp: number;
  author: string;
  summary: string;
  detail: string;
  files: string[];
  patterns?: string[];
  pr_context?: {
    number: number;
    title: string;
    description: string;
  };
}

/**
 * Memory source provider interface
 * Providers extract observations from different sources (git, github, etc.)
 */
export interface MemoryProvider {
  /** Provider name (e.g., "git", "github") */
  name: string;

  /** Check if this provider is available in current context */
  isAvailable(): Promise<boolean>;

  /** Extract observations from the source */
  extract(options: ExtractOptions): Promise<ExtractedObservation[]>;

  /**
   * Enrich observations from other providers
   * e.g., GitHub provider adds PR context to git commits
   */
  enrich?(
    observations: ExtractedObservation[]
  ): Promise<ExtractedObservation[]>;
}
