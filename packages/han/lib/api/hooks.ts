/**
 * Hooks API
 *
 * Reads hook execution data from han_events in the database.
 * Han events are indexed by the Rust coordinator from JSONL files.
 *
 * IMPORTANT: This module queries the SQLite database - it does NOT read JSONL files directly.
 * The coordinator handles JSONL → SQLite indexing.
 */

import type { Message } from '../grpc/data-access.ts';
import { messages, withFreshData } from '../grpc/data-access.ts';

/**
 * Hook execution record
 */
export interface HookExecution {
  id: string;
  sessionId: string | null;
  taskId: string | null;
  hookType: string;
  hookName: string;
  hookSource: string | null;
  directory: string | null;
  durationMs: number;
  exitCode: number;
  passed: boolean;
  output: string | null;
  error: string | null;
  timestamp: string;
  /** Glob patterns that trigger this hook (used for file validation tracking) */
  ifChanged: string[] | null;
  /** The command that was executed */
  command: string | null;
}

/**
 * Hook event data from han_event rawJson
 * Supports both snake_case (from JSONL storage) and camelCase formats
 */
interface HookEventData {
  type: 'hook_run' | 'hook_result' | 'hook_execution';
  id?: string;
  timestamp: string;
  // Top-level fields (from hook_execution events in JSONL)
  hook_type?: string;
  hook_name?: string;
  hook_source?: string;
  duration_ms?: number;
  exit_code?: number;
  passed?: boolean;
  output?: string;
  error?: string;
  session_id?: string;
  task_id?: string;
  // Nested data fields (from hook_run/hook_result events)
  data?: {
    plugin?: string;
    hook?: string;
    hookType?: string;
    hook_type?: string;
    hook_name?: string;
    hook_source?: string;
    directory?: string;
    success?: boolean;
    passed?: boolean;
    duration_ms?: number;
    durationMs?: number;
    exit_code?: number;
    exitCode?: number;
    output?: string;
    error?: string;
    session_id?: string;
    sessionId?: string;
    task_id?: string;
    taskId?: string;
    // Correlation ID linking hook_result to its parent hook_run
    hookRunId?: string;
    // File validation tracking fields
    if_changed?: string[];
    ifChanged?: string[];
    command?: string;
  };
}

/**
 * Parse hook execution data from a Message with han_event type
 * Handles multiple event formats:
 * - hook_execution: From JSONL storage (snake_case fields at top level)
 * - hook_result: From event logger (nested data object)
 */
function parseHookExecutionFromMessage(msg: Message): HookExecution | null {
  // Try to parse the rawJson which contains the full event data
  if (!msg.raw_json) {
    return null;
  }

  try {
    const event = JSON.parse(msg.raw_json) as HookEventData;

    // Process hook_execution events (from JSONL storage via metrics)
    if (event.type === 'hook_execution') {
      return {
        id: msg.id || event.id || `hook-${msg.timestamp}-${msg.line_number}`,
        sessionId: msg.session_id || event.session_id || null,
        taskId: event.task_id || null,
        hookType: event.hook_type || 'unknown',
        hookName: event.hook_name || 'unknown',
        hookSource: event.hook_source || null,
        directory: event.data?.directory || null,
        durationMs: event.duration_ms || 0,
        exitCode: event.exit_code ?? 0,
        passed: event.passed ?? true,
        output: event.output || null,
        error: event.error || null,
        timestamp: msg.timestamp || event.timestamp,
        ifChanged: event.data?.if_changed || event.data?.ifChanged || null,
        command: event.data?.command || null,
      };
    }

    // Process hook_result events (from event logger)
    if (event.type === 'hook_result') {
      const data = event.data || {};

      return {
        id: msg.id || event.id || `hook-${msg.timestamp}-${msg.line_number}`,
        sessionId: msg.session_id || data.session_id || data.sessionId || null,
        taskId: data.task_id || data.taskId || null,
        hookType:
          data.hookType || data.hook_type || event.hook_type || 'unknown',
        hookName: data.hook || data.hook_name || data.plugin || 'unknown',
        hookSource: data.hook_source || data.plugin || null,
        directory: data.directory || null,
        durationMs: data.duration_ms || data.durationMs || 0,
        exitCode: data.exit_code ?? data.exitCode ?? 0,
        passed: data.passed ?? data.success ?? true,
        output: data.output || null,
        error: data.error || null,
        timestamp: msg.timestamp || event.timestamp,
        ifChanged: data.if_changed || data.ifChanged || null,
        command: data.command || null,
      };
    }

    // Process hook_run events (from event logger - start of hook execution)
    // These represent the start of a hook run; the result comes in hook_result
    if (event.type === 'hook_run') {
      const data = event.data || {};

      return {
        id: msg.id || event.id || `hook-${msg.timestamp}-${msg.line_number}`,
        sessionId: msg.session_id || data.session_id || data.sessionId || null,
        taskId: data.task_id || data.taskId || null,
        hookType:
          data.hookType || data.hook_type || event.hook_type || 'unknown',
        hookName: data.hook || data.hook_name || data.plugin || 'unknown',
        hookSource: data.hook_source || data.plugin || null,
        directory: data.directory || null,
        durationMs: data.duration_ms || data.durationMs || 0,
        exitCode: data.exit_code ?? data.exitCode ?? 0,
        // hook_run events are in-progress - passed is unknown until result arrives
        passed: data.passed ?? data.success ?? true,
        output: data.output || null,
        error: data.error || null,
        timestamp: msg.timestamp || event.timestamp,
        ifChanged: data.if_changed || data.ifChanged || null,
        command: data.command || null,
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Get hook executions for a specific session
 * Queries han_events from the database instead of reading JSONL files.
 *
 * Handles correlation between hook_run and hook_result events:
 * - hook_run: Logged when hook starts executing
 * - hook_result: Logged when hook completes (has hookRunId for correlation)
 *
 * We prefer hook_result events as they contain the final outcome.
 * hook_run events without a corresponding result are treated as in-progress.
 */
export async function getHookExecutionsForSession(
  sessionId: string
): Promise<HookExecution[]> {
  return withFreshData(async () => {
    // Query han_events for this session
    const hanEvents = await messages.list({
      sessionId,
      type: 'han_event',
    });

    const executions: HookExecution[] = [];
    // Track hook_run IDs that have a corresponding hook_result
    const hookRunIdsWithResults = new Set<string>();

    // First pass: identify hook_result events and collect their hookRunId
    for (const msg of hanEvents) {
      if (!msg.raw_json) continue;
      try {
        const event = JSON.parse(msg.raw_json) as HookEventData;
        if (event.type === 'hook_result' && event.data?.hookRunId) {
          hookRunIdsWithResults.add(event.data.hookRunId);
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Second pass: parse hook executions, skipping hook_run events that have a result
    for (const msg of hanEvents) {
      if (!msg.raw_json) continue;
      try {
        const event = JSON.parse(msg.raw_json) as HookEventData;

        // Skip hook_run events that have a corresponding hook_result
        // (the hook_result has the complete data)
        if (event.type === 'hook_run') {
          const eventId = msg.id || event.id;
          if (eventId && hookRunIdsWithResults.has(eventId)) {
            continue; // Skip - we'll use the hook_result instead
          }
        }

        const execution = parseHookExecutionFromMessage(msg);
        if (execution) {
          executions.push(execution);
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Sort by timestamp (oldest first for timeline)
    return executions.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  });
}

/**
 * Get all recent hook executions across all sessions
 * Queries han_events from the database instead of reading JSONL files.
 */
export async function getRecentHookExecutions(
  limit = 50
): Promise<HookExecution[]> {
  return withFreshData(async () => {
    // Search for hook-related events across all sessions
    // Note: We can't filter by message_type without a sessionId in the current API,
    // so we search for hook-related content and filter
    const searchResults = await messages.search({
      query: 'hook_result',
      limit: limit * 3, // Get more to account for filtering
    });

    const executions: HookExecution[] = [];

    for (const msg of searchResults) {
      // FtsSearchResult has limited fields - only source identifies han_event type
      if (msg.source !== 'han_event') {
        continue;
      }

      // Parse the execution directly from the content field (which is raw_json)
      try {
        if (!msg.content) continue;
        const event = JSON.parse(msg.content) as { type?: string; hook_type?: string; hook_name?: string; duration_ms?: number; exit_code?: number; passed?: boolean; output?: string; error?: string; session_id?: string; task_id?: string; timestamp?: string; id?: string; data?: Record<string, unknown> };
        const execution: HookExecution = {
          id: msg.id || `hook-${msg.session_id}-${Date.now()}`,
          sessionId: (msg.session_id ?? null),
          taskId: (event.task_id ?? null),
          hookType: event.hook_type || 'unknown',
          hookName: event.hook_name || 'unknown',
          hookSource: null,
          directory: null,
          durationMs: event.duration_ms || 0,
          exitCode: event.exit_code ?? 0,
          passed: event.passed ?? true,
          output: event.output || null,
          error: event.error || null,
          timestamp: event.timestamp || new Date().toISOString(),
          ifChanged: null,
          command: null,
        };
        executions.push(execution);
      } catch {
        // Ignore parse errors
      }
    }

    // Sort by timestamp (newest first) and limit
    return executions
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      .slice(0, limit);
  });
}

/**
 * Get hook execution statistics for a session
 * Queries han_events from the database instead of reading JSONL files.
 */
export async function getSessionHookStats(sessionId: string): Promise<{
  totalHooks: number;
  passedHooks: number;
  failedHooks: number;
  totalDurationMs: number;
  byHookType: Record<string, { total: number; passed: number }>;
}> {
  const executions = await getHookExecutionsForSession(sessionId);

  const byHookType: Record<string, { total: number; passed: number }> = {};
  let totalDurationMs = 0;
  let passedHooks = 0;
  let failedHooks = 0;

  for (const exec of executions) {
    if (exec.passed) {
      passedHooks++;
    } else {
      failedHooks++;
    }
    totalDurationMs += exec.durationMs;

    if (!byHookType[exec.hookType]) {
      byHookType[exec.hookType] = { total: 0, passed: 0 };
    }
    byHookType[exec.hookType].total++;
    if (exec.passed) {
      byHookType[exec.hookType].passed++;
    }
  }

  return {
    totalHooks: executions.length,
    passedHooks,
    failedHooks,
    totalDurationMs,
    byHookType,
  };
}
