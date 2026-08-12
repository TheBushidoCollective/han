/**
 * Han event logger for the omp bridge.
 *
 * Writes Han-format JSONL events tagged `harness: "omp"` so the coordinator
 * indexes omp sessions alongside Claude Code ones.
 *
 * Path: ~/.han/omp/projects/{project-slug}/{sessionId}-han.jsonl
 *
 * This is deliberately not under ~/.omp/ or ~/.claude/: these are Han events,
 * not harness-native session data. The path shape matches every other Han
 * bridge so the indexer needs no per-harness special case.
 */

import { createHash, randomUUID } from 'node:crypto';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { OmpAssistantUsage } from './session';
import { pathToSlug } from './session';
import { HAN_HARNESS } from './types';

/** Cap on any free-text field written into an event, in characters. */
const MAX_OUTPUT_LENGTH = 10_000;

/**
 * The `plugin` attributed to events this bridge originates.
 *
 * These events do not come from a Han plugin's hook, they come from the
 * bridge itself, so this is deliberately a name no Han plugin can claim.
 */
const BRIDGE_PLUGIN = 'omp-bridge';

/** Root for omp's Han data, kept separate from other harnesses. */
function getHanOmpRoot(): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? '/tmp';
  return join(home, '.han', 'omp');
}

/** Directory the coordinator must watch to see this harness at all. */
export function getWatchDir(): string {
  return join(getHanOmpRoot(), 'projects');
}

/** JSONL events file for one omp session. */
function getEventsFilePath(projectDir: string, sessionId: string): string {
  return join(getWatchDir(), pathToSlug(projectDir), `${sessionId}-han.jsonl`);
}

/**
 * Base event metadata. Mirrors Han's `BaseEvent`, with `harness` set on every
 * event: Han reads an absent `harness` as "claude-code", so omitting it would
 * silently file omp's work under Claude Code.
 */
interface BaseEventMeta {
  uuid: string;
  sessionId: string;
  type: string;
  timestamp: string;
  harness: string;
  cwd?: string;
}

function truncate(text: string): string {
  if (text.length <= MAX_OUTPUT_LENGTH) return text;
  const dropped = text.length - MAX_OUTPUT_LENGTH;
  return `${text.slice(0, MAX_OUTPUT_LENGTH)}\n... [truncated, ${dropped} more bytes]`;
}

/**
 * Derive a stable UUID from a stable key.
 *
 * Token usage is read out of a file omp can rewrite in full, which forces a
 * re-scan from byte zero. In-process bookkeeping stops the re-scan re-emitting
 * within one session, but a session resumed in a new process has no such
 * memory. Keying the event uuid on the omp entry id makes re-emission
 * idempotent at the row level instead of double counting tokens.
 */
function stableUuid(key: string): string {
  const hex = createHash('sha256').update(key).digest('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

/**
 * Han hook types this bridge reports under. These are Claude Code's hook
 * names, reused so omp's lifecycle lands in the same buckets as every other
 * harness rather than inventing an omp-only vocabulary.
 */
export type BridgeHookType =
  | 'SessionStart'
  | 'Stop'
  | 'PreCompact'
  | 'PostToolUse';

/**
 * Writes Han JSONL events for one omp session.
 *
 * Every public method appends a complete, self-consistent group of events in
 * a single write. There is no background flush timer on purpose: omp runs
 * extensions in-process with no isolation, and a throw escaping a raw timer
 * callback tears down the user's whole session.
 */
export class BridgeEventLogger {
  private readonly logPath: string;
  private readonly sessionId: string;
  private readonly cwd: string;
  private buffer: string[] = [];
  private directoryReady = false;

  constructor(sessionId: string, projectDir: string) {
    this.sessionId = sessionId;
    this.cwd = projectDir;
    this.logPath = getEventsFilePath(projectDir, sessionId);
  }

  /** Absolute path of this session's Han events file. */
  getLogPath(): string {
    return this.logPath;
  }

  private createBase(type: string, uuid?: string): BaseEventMeta {
    return {
      uuid: uuid ?? randomUUID(),
      sessionId: this.sessionId,
      type,
      timestamp: new Date().toISOString(),
      harness: HAN_HARNESS,
      cwd: this.cwd,
    };
  }

  private stage(event: Record<string, unknown>): void {
    this.buffer.push(`${JSON.stringify(event)}\n`);
  }

  /**
   * Append everything staged so far.
   *
   * Failures are swallowed after being reported: losing telemetry is an
   * acceptable outcome, interrupting the user's session over it is not.
   */
  private flush(): void {
    if (this.buffer.length === 0) return;
    const pending = this.buffer;
    this.buffer = [];

    try {
      if (!this.directoryReady) {
        mkdirSync(dirname(this.logPath), { recursive: true });
        this.directoryReady = true;
      }
      appendFileSync(this.logPath, pending.join(''));
    } catch (err) {
      console.error(
        '[han] Failed to write omp events:',
        err instanceof Error ? err.message : err
      );
    }
  }

  /** Stage a `hook_run` and return its uuid, for the result to correlate to. */
  private stageRun(hookType: BridgeHookType, hook: string): string {
    const run = this.createBase('hook_run');
    this.stage({
      ...run,
      data: {
        plugin: BRIDGE_PLUGIN,
        hook,
        hook_type: hookType,
        directory: this.cwd,
        cached: false,
      },
    });
    return run.uuid;
  }

  private stageResult(
    hookType: BridgeHookType,
    hook: string,
    hookRunId: string,
    outcome: {
      durationMs: number;
      success: boolean;
      output?: string;
      error?: string;
    }
  ): void {
    this.stage({
      ...this.createBase('hook_result'),
      hookRunId,
      data: {
        plugin: BRIDGE_PLUGIN,
        hook,
        hook_type: hookType,
        directory: this.cwd,
        cached: false,
        duration_ms: outcome.durationMs,
        exit_code: outcome.success ? 0 : 1,
        success: outcome.success,
        output: outcome.output ? truncate(outcome.output) : undefined,
        error: outcome.error ? truncate(outcome.error) : undefined,
      },
    });
  }

  /**
   * Stage a complete `hook_run` / `hook_result` pair in one write.
   *
   * Only for events that are already over by the time this bridge hears about
   * them, where a run and a result would carry the same timestamp anyway. A
   * span that can actually fail partway (a tool call) records its run and its
   * result separately, so that a run left without a result stays meaningful:
   * it is how Han represents work that died mid-flight.
   */
  private stagePair(
    hookType: BridgeHookType,
    hook: string,
    outcome: {
      durationMs: number;
      success: boolean;
      output?: string;
      error?: string;
    }
  ): void {
    this.stageResult(hookType, hook, this.stageRun(hookType, hook), outcome);
  }

  /** Session opened. */
  logSessionStart(durationMs: number, model?: string): void {
    this.stagePair('SessionStart', 'session', {
      durationMs,
      success: true,
      output: model
        ? `omp session started (model ${model})`
        : 'omp session started',
    });
    this.flush();
  }

  /** Session closed. */
  logSessionEnd(durationMs: number): void {
    this.stagePair('Stop', 'session', {
      durationMs,
      success: true,
      output: 'omp session ended',
    });
    this.flush();
  }

  /** Context compaction ran. */
  logCompaction(durationMs: number): void {
    this.stagePair('PreCompact', 'compact', {
      durationMs,
      success: true,
      output: 'omp compacted session context',
    });
    this.flush();
  }

  /**
   * A tool started executing. Returns the id its result must correlate to.
   *
   * Written immediately rather than held until the tool finishes, so a tool
   * still running when the session dies leaves a `hook_run` with no result,
   * which is exactly how Han represents abandoned work.
   */
  logToolStart(toolName: string): string {
    const hookRunId = this.stageRun('PostToolUse', toolName);
    this.flush();
    return hookRunId;
  }

  /**
   * A tool finished, plus a file-change record when it mutated a file.
   *
   * The tool's own output is deliberately not recorded. An omp `read` result
   * is an entire file, and copying those into Han's event log would multiply
   * every session's on-disk footprint to buy nothing a tool count does not
   * already provide. Failures do record their message, because that is the
   * part worth investigating.
   */
  logToolEnd(params: {
    toolName: string;
    hookRunId: string;
    durationMs: number;
    success: boolean;
    error?: string;
    filePath?: string;
  }): void {
    this.stageResult('PostToolUse', params.toolName, params.hookRunId, {
      durationMs: params.durationMs,
      success: params.success,
      error: params.error,
    });

    if (params.filePath && params.success) {
      this.stage({
        ...this.createBase('hook_file_change'),
        data: {
          session_id: this.sessionId,
          tool_name: params.toolName,
          file_path: params.filePath,
        },
      });
    }
    this.flush();
  }

  /**
   * Token and dollar cost for assistant messages, one event each.
   *
   * Per-message rather than per-session so per-turn granularity survives into
   * Han's rollups.
   */
  logTokenUsage(records: readonly OmpAssistantUsage[]): void {
    if (records.length === 0) return;

    for (const record of records) {
      this.stage({
        ...this.createBase(
          'token_usage',
          stableUuid(`omp:token_usage:${this.sessionId}:${record.entryId}`)
        ),
        data: {
          model: record.model,
          provider: record.provider,
          input_tokens: record.inputTokens,
          output_tokens: record.outputTokens,
          cache_read_tokens: record.cacheReadTokens,
          cache_creation_tokens: record.cacheCreationTokens,
          cost_usd: record.costUsd,
        },
      });
    }
    this.flush();
  }
}
