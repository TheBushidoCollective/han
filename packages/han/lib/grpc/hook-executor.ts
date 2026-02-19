/**
 * gRPC-based hook execution via coordinator streaming.
 *
 * Sends ExecuteHooksRequest to the coordinator and streams
 * HookOutput messages back, forwarding stdout/stderr to the
 * CLI process in real-time.
 */

import {
  outputStructuredResult,
  outputStructuredSuccess,
} from '../hook-runner.js';
import { getCoordinatorClients } from './client.js';
import type { HookOutput } from './generated/coordinator_pb.js';

export interface ExecuteHooksOptions {
  event: string;
  sessionId?: string;
  toolName?: string;
  toolInput?: string;
  cwd?: string;
  env?: Record<string, string>;
}

export interface HookExecutionResult {
  hookId: string;
  pluginName: string;
  hookName: string;
  exitCode: number;
  cached: boolean;
  error?: string;
  durationMs: number;
}

/**
 * Execute hooks via gRPC streaming.
 *
 * Streams stdout/stderr to process.stdout/stderr in real-time.
 * Returns results for all completed hooks.
 */
export async function executeHooksViaGrpc(
  options: ExecuteHooksOptions
): Promise<HookExecutionResult[]> {
  const clients = getCoordinatorClients();
  const results: HookExecutionResult[] = [];

  const stream = clients.hooks.executeHooks({
    event: options.event,
    sessionId: options.sessionId,
    toolName: options.toolName,
    toolInput: options.toolInput,
    cwd: options.cwd ?? process.cwd(),
    env: options.env ?? {},
  });

  for await (const output of stream) {
    handleHookOutput(output, results);
  }

  return results;
}

/**
 * Process a single HookOutput message from the stream.
 */
function handleHookOutput(
  output: HookOutput,
  results: HookExecutionResult[]
): void {
  const payload = output.payload;

  if (payload.case === 'stdoutLine') {
    process.stdout.write(`${payload.value}\n`);
  } else if (payload.case === 'stderrLine') {
    process.stderr.write(`${payload.value}\n`);
  } else if (payload.case === 'complete') {
    const complete = payload.value;
    results.push({
      hookId: output.hookId,
      pluginName: output.pluginName,
      hookName: output.hookName,
      exitCode: complete.exitCode,
      cached: complete.cached,
      error: complete.error,
      durationMs: Number(complete.durationMs),
    });
  }
}

/**
 * Execute hooks via gRPC, buffering stdout/stderr instead of streaming.
 * Used for structured output mode where we need to capture all output.
 */
async function executeHooksViaGrpcBuffered(
  options: ExecuteHooksOptions
): Promise<{ results: HookExecutionResult[]; output: string }> {
  const clients = getCoordinatorClients();
  const results: HookExecutionResult[] = [];
  const lines: string[] = [];

  const stream = clients.hooks.executeHooks({
    event: options.event,
    sessionId: options.sessionId,
    toolName: options.toolName,
    toolInput: options.toolInput,
    cwd: options.cwd ?? process.cwd(),
    env: options.env ?? {},
  });

  for await (const output of stream) {
    const payload = output.payload;

    if (payload.case === 'stdoutLine' || payload.case === 'stderrLine') {
      lines.push(payload.value);
    } else if (payload.case === 'complete') {
      const complete = payload.value;
      results.push({
        hookId: output.hookId,
        pluginName: output.pluginName,
        hookName: output.hookName,
        exitCode: complete.exitCode,
        cached: complete.cached,
        error: complete.error,
        durationMs: Number(complete.durationMs),
      });
    }
  }

  return { results, output: lines.join('\n') };
}

/**
 * Execute hooks and exit with appropriate code.
 *
 * Used by `han hook run` when delegating to the coordinator.
 * Exits with non-zero if any hook failed.
 *
 * When `hookEventName` is set, outputs structured JSON instead of streaming.
 */
export async function executeHooksAndExit(
  options: ExecuteHooksOptions & { hookEventName?: string }
): Promise<never> {
  try {
    if (options.hookEventName) {
      // Structured mode: buffer output, format as JSON
      const { results, output } = await executeHooksViaGrpcBuffered(options);
      const failures = results.filter((r) => r.exitCode !== 0);

      if (failures.length > 0) {
        outputStructuredResult({
          systemMessage: failures
            .map(
              (f) =>
                `${f.pluginName}/${f.hookName} failed${f.error ? `: ${f.error}` : ''}`
            )
            .join('\n'),
          additionalContext:
            output.slice(0, 4000) +
            '\n\nFix the validation errors above and retry.' +
            '\nDo NOT ask the user any questions.',
          decision: 'block',
          hookSpecificOutput: { hookEventName: options.hookEventName },
        });
      }
      // Success: suppress output from agent context
      outputStructuredSuccess(options.hookEventName);
    }

    // Existing streaming path (dispatch mode / no hookEventName)
    const results = await executeHooksViaGrpc(options);

    // Exit with the worst exit code from any hook
    const worstExitCode = results.reduce(
      (max, r) => Math.max(max, r.exitCode),
      0
    );
    process.exit(worstExitCode);
  } catch (error) {
    console.error('[han hook] gRPC execution failed:', error);
    process.exit(1);
  }
}
