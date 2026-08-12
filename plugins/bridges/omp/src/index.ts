/**
 * Han Bridge for omp (Oh My Pi)
 *
 * An omp extension that makes omp sessions countable in Han. It records:
 *
 *   - session lifecycle (start, end, compaction)
 *   - every tool call, as a correlated hook_run / hook_result span
 *   - files written or edited
 *   - token counts and dollar cost, per assistant message
 *
 * Events are written to ~/.han/omp/projects/<slug>/<sessionId>-han.jsonl in
 * Han's own JSONL format, tagged `harness: "omp"`.
 *
 * Two deliberate constraints shape this file.
 *
 * First, it never registers `tool_call` or `tool_result`. omp treats a throw
 * from a `tool_call` handler as fail-closed and blocks the tool, so telemetry
 * on that event can stop a user's work. `tool_execution_start` and
 * `tool_execution_end` are omp's observability pair and carry the same facts.
 *
 * Second, every handler body is wrapped so nothing here can surface an error
 * into the session. Missing telemetry is an acceptable failure; a broken
 * session is not.
 */

import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { BridgeEventLogger } from './events';
import { resolveSessionId, SessionUsageReader } from './session';
import {
  extractFilePath,
  FILE_MUTATING_TOOLS,
  HAN_HARNESS,
  mapToolName,
  type OmpExtensionApi,
  type OmpExtensionContext,
  type OmpToolExecutionEndEvent,
  type OmpToolExecutionStartEvent,
} from './types';

const PREFIX = '[han]';

/** A tool call seen starting but not yet finished. */
interface PendingTool {
  /** Claude Code-mapped tool name, so both halves of the span agree. */
  toolName: string;
  hookRunId: string;
  startedAt: number;
  filePath?: string;
}

/**
 * Start the Han coordinator if it is not already running.
 *
 * The coordinator is what indexes these JSONL files and serves the Browse UI.
 * `ensure` is idempotent, and this is spawned detached so omp is never held
 * open by it.
 */
function startCoordinator(): void {
  try {
    const child = spawn('han', ['coordinator', 'ensure', '--background'], {
      stdio: 'ignore',
      detached: true,
      env: { ...process.env, HAN_HARNESS },
    });
    child.on('error', () => {
      // `han` is not installed. Events are still written, and are indexed
      // whenever a coordinator does run.
    });
    child.unref();
  } catch {
    // Same as above: spawning the indexer is best-effort by design.
  }
}

/** Compose a readable model label from omp's model handle. */
function describeModel(ctx: OmpExtensionContext): string | undefined {
  const model = ctx.model;
  if (!model?.id) return undefined;
  return model.provider ? `${model.provider}/${model.id}` : model.id;
}

/**
 * Reduce a failed tool's result to a single diagnostic string.
 *
 * omp types the result as `unknown` because it varies by tool. Only the
 * message is kept: the full payload can be a whole file, and the reason a
 * tool failed is the only part worth storing.
 */
function describeToolError(result: unknown): string {
  if (typeof result === 'string') return result;
  if (typeof result !== 'object' || result === null) {
    return 'tool reported an error';
  }

  const record = result as { content?: unknown; error?: unknown };
  if (typeof record.error === 'string' && record.error) return record.error;

  if (Array.isArray(record.content)) {
    const text = record.content
      .map((block) =>
        typeof block === 'object' && block !== null
          ? (block as { text?: unknown }).text
          : undefined
      )
      .filter(
        (value): value is string => typeof value === 'string' && value.length > 0
      )
      .join('\n');
    if (text) return text;
  }
  return 'tool reported an error';
}

export default function hanOmpBridge(pi: OmpExtensionApi): void {
  let logger: BridgeEventLogger | null = null;
  let usageReader: SessionUsageReader | null = null;
  let coordinatorStarted = false;
  const pendingTools = new Map<string, PendingTool>();

  /**
   * Run a handler body with telemetry failures contained.
   *
   * omp runs extensions in-process with no isolation. Its runner does catch
   * handler throws, but every escape still costs the user an error in their
   * session for something they did not ask for and cannot act on.
   */
  const guard = (label: string, body: () => void): void => {
    try {
      body();
    } catch (err) {
      console.error(
        `${PREFIX} omp bridge ${label} failed:`,
        err instanceof Error ? err.message : err
      );
    }
  };

  /**
   * Emit a token_usage event for every assistant message omp has persisted
   * since the last drain.
   *
   * omp's event bus carries no token counts and no cost, so the session JSONL
   * omp already wrote is the only source. When it cannot be read, this yields
   * nothing rather than a guess.
   */
  const drainUsage = (): void => {
    if (!logger || !usageReader) return;
    logger.logTokenUsage(usageReader.readNewUsage());
  };

  const beginSession = (ctx: OmpExtensionContext): void => {
    const startedAt = Date.now();
    const sessionFile = ctx.sessionManager?.getSessionFile?.();

    // A session with no file on disk is still worth recording: its lifecycle
    // and tool calls are real. Only usage is unavailable, because omp has
    // written nothing to read usage out of.
    const sessionId = resolveSessionId(sessionFile) ?? randomUUID();

    logger = new BridgeEventLogger(sessionId, ctx.cwd);
    usageReader = sessionFile ? new SessionUsageReader(sessionFile) : null;
    pendingTools.clear();

    if (!coordinatorStarted) {
      startCoordinator();
      coordinatorStarted = true;
    }

    logger.logSessionStart(Date.now() - startedAt, describeModel(ctx));
  };

  const endSession = (): void => {
    if (!logger) return;
    const startedAt = Date.now();
    drainUsage();
    logger.logSessionEnd(Date.now() - startedAt);
    logger = null;
    usageReader = null;
    pendingTools.clear();
  };

  pi.setLabel?.('Han');

  pi.on('session_start', (_event, ctx) => {
    guard('session_start', () => beginSession(ctx));
  });

  // A switch retargets the session file mid-process. Without this, every
  // later tool call and every token would be attributed to the session the
  // user just left.
  pi.on('session_switch', (_event, ctx) => {
    guard('session_switch', () => {
      endSession();
      beginSession(ctx);
    });
  });

  pi.on('session_shutdown', () => {
    guard('session_shutdown', endSession);
  });

  pi.on('session_compact', () => {
    guard('session_compact', () => {
      const startedAt = Date.now();
      drainUsage();
      logger?.logCompaction(Date.now() - startedAt);
    });
  });

  pi.on('tool_execution_start', (event) => {
    guard('tool_execution_start', () => {
      if (!logger) return;
      const started = event as OmpToolExecutionStartEvent;
      if (typeof started?.toolCallId !== 'string') return;

      const toolName = mapToolName(started.toolName ?? 'unknown');
      pendingTools.set(started.toolCallId, {
        toolName,
        hookRunId: logger.logToolStart(toolName),
        startedAt: Date.now(),
        filePath: FILE_MUTATING_TOOLS[toolName]
          ? extractFilePath(started.args)
          : undefined,
      });
    });
  });

  pi.on('tool_execution_end', (event) => {
    guard('tool_execution_end', () => {
      if (!logger) return;
      const ended = event as OmpToolExecutionEndEvent;
      if (typeof ended?.toolCallId !== 'string') return;

      const pending = pendingTools.get(ended.toolCallId);
      // No matching start means the bridge loaded mid-tool. A result with no
      // run would look like a corrupted span, so drop it.
      if (!pending) return;
      pendingTools.delete(ended.toolCallId);

      logger.logToolEnd({
        toolName: pending.toolName,
        hookRunId: pending.hookRunId,
        durationMs: Date.now() - pending.startedAt,
        success: !ended.isError,
        error: ended.isError ? describeToolError(ended.result) : undefined,
        filePath: pending.filePath,
      });
    });
  });

  // Usage is drained at turn end because that is the point omp has finished
  // persisting the turn's assistant messages, and it bounds how far behind
  // the metrics can fall in a long session.
  pi.on('turn_end', () => {
    guard('turn_end', drainUsage);
  });
}
