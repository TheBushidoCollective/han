/**
 * Han Event Types
 *
 * Defines all event types that can be logged to session-scoped Han event logs.
 * Events are stored in {session-id}-han.jsonl files and indexed into SQLite.
 *
 * Event structure mirrors Claude transcript format for consistency:
 * - uuid: Unique event identifier
 * - sessionId: Parent session UUID
 * - agentId: (optional) Agent ID if running in agent context
 * - timestamp: ISO timestamp
 * - type: Event type discriminator
 *
 * Global ID format:
 * - Standard events: {EventType}:{uuid}
 * - Agent events: Agent:{sessionId}:{agentId}
 */

/**
 * Base event interface - all events extend this
 * Matches Claude transcript metadata structure for consistent indexing.
 */
export interface BaseEvent {
  /** Unique event ID (UUID format like Claude's uuid field) */
  uuid: string;
  /** Session ID this event belongs to */
  sessionId: string;
  /** Agent ID if this event is from an agent context */
  agentId?: string;
  /** Event type discriminator */
  type: string;
  /** ISO timestamp */
  timestamp: string;
  /** Current working directory (matches Claude's cwd field) */
  cwd?: string;
  /** Git branch (matches Claude's gitBranch field) */
  gitBranch?: string;
}

/**
 * Hook lifecycle events (mirrors tool_use/tool_result pattern)
 */
export interface HookRunEvent extends BaseEvent {
  type: 'hook_run';
  data: {
    plugin: string;
    hook: string;
    /** Hook type (e.g., "Stop", "SessionStart") */
    hook_type: string;
    directory: string;
    cached: boolean;
  };
}

export interface HookResultEvent extends BaseEvent {
  type: 'hook_result';
  /** UUID of the parent hook_run event (for correlation) */
  hookRunId?: string;
  data: {
    plugin: string;
    hook: string;
    /** Hook type (e.g., "Stop", "SessionStart") */
    hook_type: string;
    directory: string;
    cached: boolean;
    duration_ms: number;
    exit_code: number;
    success: boolean;
    output?: string;
    error?: string;
  };
}

export type HookEvent = HookRunEvent | HookResultEvent;

/**
 * Hook Reference events - for `han hook reference` commands
 * These inject markdown file content with must-read-first tags
 */
export interface HookReferenceEvent extends BaseEvent {
  type: 'hook_reference';
  data: {
    plugin: string;
    /** Path to the referenced file */
    file_path: string;
    /** Reason for must-read-first (if specified) */
    reason?: string;
    /** Whether file was found and content injected */
    success: boolean;
    /** Duration in ms */
    duration_ms: number;
  };
}

/**
 * Hook Validation events - for `han hook run` validation commands
 * These run linters, type checkers, and other validation tools
 */
export interface HookValidationEvent extends BaseEvent {
  type: 'hook_validation';
  data: {
    plugin: string;
    /** Hook name (e.g., "lint", "typecheck") */
    hook: string;
    /** Hook type (e.g., "Stop", "SessionStart") */
    hook_type: string;
    /** Directory being validated */
    directory: string;
    /** Whether result was from cache */
    cached: boolean;
    /** Duration in ms */
    duration_ms: number;
    /** Exit code */
    exit_code: number;
    /** Whether validation passed */
    success: boolean;
    /** Validation output */
    output?: string;
    /** Error message if failed */
    error?: string;
  };
}

/**
 * Hook Validation Cache events - for caching validated file states
 * Contains a map of file paths to their hashes at validation time
 */
export interface HookValidationCacheEvent extends BaseEvent {
  type: 'hook_validation_cache';
  data: {
    plugin: string;
    /** Hook name (e.g., "lint", "typecheck") */
    hook: string;
    /** Directory being validated */
    directory: string;
    /** Hash of the command for detecting config changes */
    command_hash: string;
    /** Map of file paths to their content hashes at validation time */
    files: Record<string, string>;
  };
}

/**
 * Hook Datetime events - for datetime injection hooks
 */
export interface HookDatetimeEvent extends BaseEvent {
  type: 'hook_datetime';
  data: {
    plugin: string;
    /** The datetime string that was output */
    datetime: string;
    /** Duration in ms */
    duration_ms: number;
  };
}

/**
 * Hook File Change events - extracted from Write/Edit tool calls during indexing
 */
export interface HookFileChangeEvent extends BaseEvent {
  type: 'hook_file_change';
  data: {
    /** Session ID */
    session_id: string;
    /** Tool that made the change (Edit, Write) */
    tool_name: string;
    /** Path to the changed file */
    file_path: string;
  };
}

/**
 * Hook Script events - for generic bash/cat script execution
 */
export interface HookScriptEvent extends BaseEvent {
  type: 'hook_script';
  data: {
    plugin: string;
    /** Command that was executed */
    command: string;
    /** Duration in ms */
    duration_ms: number;
    /** Exit code */
    exit_code: number;
    /** Whether script succeeded */
    success: boolean;
    /** Script output (truncated) */
    output?: string;
  };
}

/**
 * Queue operation events - for task queue management
 */
export interface QueueOperationEvent extends BaseEvent {
  type: 'queue_operation';
  data: {
    operation: 'enqueue' | 'dequeue' | 'complete' | 'fail';
    queue_name: string;
    task_id?: string;
    task_description?: string;
  };
}

export type SpecificHookEvent =
  | HookReferenceEvent
  | HookValidationEvent
  | HookValidationCacheEvent
  | HookDatetimeEvent
  | HookFileChangeEvent
  | HookScriptEvent
  | QueueOperationEvent;

/**
 * MCP tool events
 */
export interface McpToolCallEvent extends BaseEvent {
  type: 'mcp_tool_call';
  data: {
    tool: string;
    arguments?: Record<string, unknown>;
  };
}

export interface McpToolResultEvent extends BaseEvent {
  type: 'mcp_tool_result';
  data: {
    tool: string;
    call_id: string;
    success: boolean;
    duration_ms: number;
    result?: unknown;
    error?: string;
  };
}

export type McpToolEvent = McpToolCallEvent | McpToolResultEvent;

/**
 * Exposed tool events (tools proxied from backend MCP servers)
 */
export interface ExposedToolCallEvent extends BaseEvent {
  type: 'exposed_tool_call';
  data: {
    server: string;
    tool: string;
    prefixed_name: string;
    arguments?: Record<string, unknown>;
  };
}

export interface ExposedToolResultEvent extends BaseEvent {
  type: 'exposed_tool_result';
  data: {
    server: string;
    tool: string;
    prefixed_name: string;
    call_id: string;
    success: boolean;
    duration_ms: number;
    result?: unknown;
    error?: string;
  };
}

export type ExposedToolEvent = ExposedToolCallEvent | ExposedToolResultEvent;

/**
 * Memory events
 */
export interface MemoryQueryEvent extends BaseEvent {
  type: 'memory_query';
  data: {
    question: string;
    route?: 'personal' | 'team' | 'rules';
    success: boolean;
    duration_ms: number;
  };
}

export interface MemoryLearnEvent extends BaseEvent {
  type: 'memory_learn';
  data: {
    domain: string;
    scope: 'project' | 'user';
    success: boolean;
  };
}

export type MemoryEvent = MemoryQueryEvent | MemoryLearnEvent;

/**
 * Sentiment analysis events (generated during indexing)
 */
export type SentimentLevel = 'positive' | 'neutral' | 'negative';
export type FrustrationLevel = 'low' | 'moderate' | 'high';

export interface SentimentAnalysisEvent extends BaseEvent {
  type: 'sentiment_analysis';
  data: {
    /** ID of the user message being analyzed */
    message_id: string;
    /** Raw sentiment score (typically -5 to +5) */
    sentiment_score: number;
    /** Categorized sentiment level */
    sentiment_level: SentimentLevel;
    /** Frustration score (0-10) if frustration detected */
    frustration_score?: number;
    /** Frustration level if detected */
    frustration_level?: FrustrationLevel;
    /** Detected signals (e.g., "CAPS", "punctuation", "negative_words") */
    signals: string[];
    /** Optional link to current task ID */
    task_id?: string;
  };
}

export type SentimentEvent = SentimentAnalysisEvent;

/**
 * Task lifecycle events
 *
 * Tasks are tracked through start/update/complete/fail events.
 * All task events require sessionId, agentId is optional.
 */

/** Task types (matches existing metrics types) */
export type TaskType =
  | 'implementation'
  | 'fix'
  | 'refactor'
  | 'research'
  | 'other';

/** Task outcomes */
export type TaskOutcome = 'success' | 'partial' | 'failure';

/** Task complexity levels */
export type TaskComplexity = 'trivial' | 'simple' | 'moderate' | 'complex';

export interface TaskStartEvent extends BaseEvent {
  type: 'task_start';
  data: {
    /** Unique task ID */
    task_id: string;
    /** Task description */
    description: string;
    /** Task type */
    task_type: TaskType;
    /** Estimated complexity */
    estimated_complexity?: TaskComplexity;
  };
}

export interface TaskUpdateEvent extends BaseEvent {
  type: 'task_update';
  data: {
    /** Task ID being updated */
    task_id: string;
    /** Status update */
    status?: string;
    /** Notes */
    notes?: string;
  };
}

export interface TaskCompleteEvent extends BaseEvent {
  type: 'task_complete';
  data: {
    /** Task ID being completed */
    task_id: string;
    /** Task outcome */
    outcome: TaskOutcome;
    /** Confidence in outcome (0.0-1.0) */
    confidence: number;
    /** Duration in seconds */
    duration_seconds: number;
    /** Files modified */
    files_modified?: string[];
    /** Tests added */
    tests_added?: number;
    /** Notes */
    notes?: string;
  };
}

export interface TaskFailEvent extends BaseEvent {
  type: 'task_fail';
  data: {
    /** Task ID that failed */
    task_id: string;
    /** Failure reason */
    reason: string;
    /** Confidence (0.0-1.0) */
    confidence?: number;
    /** Duration in seconds */
    duration_seconds: number;
    /** Attempted solutions */
    attempted_solutions?: string[];
    /** Notes */
    notes?: string;
  };
}

export type TaskEvent =
  | TaskStartEvent
  | TaskUpdateEvent
  | TaskCompleteEvent
  | TaskFailEvent;

/**
 * Frustration detection events
 *
 * Generated during sentiment analysis or explicit detection.
 */
export interface FrustrationDetectedEvent extends BaseEvent {
  type: 'frustration_detected';
  data: {
    /** Frustration level */
    frustration_level: FrustrationLevel;
    /** Frustration score (0-10) */
    frustration_score: number;
    /** User message that triggered detection */
    user_message: string;
    /** Detected signals */
    detected_signals: string[];
    /** Optional context */
    context?: string;
    /** Associated task ID */
    task_id?: string;
  };
}

export type FrustrationDetectedEvents = FrustrationDetectedEvent;

/**
 * Union of all Han event types
 */
/**
 * Hook check state event - for tracking check mode deduplication
 * Records the fingerprint of hooks that need validation to avoid spam
 */
export interface HookCheckStateEvent extends BaseEvent {
  type: 'hook_check_state';
  data: {
    /** Hook type being checked (e.g., "Stop", "SubagentStop") */
    hook_type: string;
    /** Fingerprint of hooks needing validation (sorted JSON of hook identifiers) */
    fingerprint: string;
    /** Number of hooks that need to run */
    hooks_count: number;
  };
}

export type HanEvent =
  | HookEvent
  | SpecificHookEvent
  | HookCheckStateEvent
  | McpToolEvent
  | ExposedToolEvent
  | MemoryEvent
  | SentimentEvent
  | TaskEvent
  | FrustrationDetectedEvents;

/**
 * Event type discriminator values
 */
export type HanEventType = HanEvent['type'];

/**
 * Configuration for event logging
 */
export interface EventLogConfig {
  /** Enable event logging (default: true) */
  enabled: boolean;
  /** Include command output in hook events (default: true) */
  logOutput: boolean;
  /** Maximum output length before truncation (default: 10000) */
  maxOutputLength: number;
  /** Print events to stderr as they're logged (default: false, or HAN_VERBOSE env) */
  verbose: boolean;
  /** Only output verbose logs to stderr, don't write to JSONL file (default: false) */
  verboseOnly: boolean;
}

/**
 * Default event log configuration
 */
export const DEFAULT_EVENT_CONFIG: EventLogConfig = {
  enabled: true,
  logOutput: true,
  maxOutputLength: 10000,
  verbose: false,
  verboseOnly: false,
};
