/**
 * Hook Context Command
 *
 * Consolidates session-id, session-context, and memory-context for SessionStart injection.
 * Outputs all contextual information needed at the start of a Claude Code session.
 */

import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Command } from 'commander';
import { isHooksEnabled } from '../../config/han-settings.ts';
import { hookExecutions, tasks } from '../../grpc/data-access.ts';
import { injectSessionContext } from '../../memory/index.ts';

/**
 * Hook payload from Claude Code containing session context
 */
interface SessionPayload {
  session_id?: string;
  [key: string]: unknown;
}

/**
 * Check if stdin has data available.
 */
function hasStdinData(): boolean {
  try {
    if (process.stdin.isTTY) {
      return false;
    }
    const { fstatSync } = require('node:fs');
    const stat = fstatSync(0);
    return stat.isFile() || stat.isFIFO() || stat.isSocket();
  } catch {
    return false;
  }
}

/**
 * Read and parse session payload from stdin
 */
function readPayload(): SessionPayload | null {
  try {
    if (!hasStdinData()) {
      return null;
    }
    const stdin = readFileSync(0, 'utf-8');
    if (stdin.trim()) {
      return JSON.parse(stdin) as SessionPayload;
    }
  } catch {
    // stdin not available or invalid JSON
  }
  return null;
}

/**
 * Get calibration emoji based on score
 */
function getCalibrationEmoji(score: number): string {
  if (score >= 85) return '🎯';
  if (score >= 70) return '📈';
  if (score >= 50) return '⚠️';
  return '🔴';
}

/**
 * Generate performance context from database
 */
async function generatePerformanceContext(
  _sessionId: string
): Promise<string | null> {
  try {
    // Query task metrics from database
    const metrics = await tasks.queryMetrics({});

    // Query hook stats
    const hookStats = await hookExecutions.queryStats({});

    // No data case
    if (metrics.total_tasks === 0) {
      return null;
    }

    const lines: string[] = [];
    lines.push('## Your Recent Performance (Last 7 Days)\n');

    // Overall stats
    const successRate = metrics.total_tasks > 0 ? Math.round((metrics.completed_tasks / metrics.total_tasks) * 100) : 0;
    const calibrationScore = 0; // calibration score not available in gRPC data layer

    lines.push(
      `- **Tasks**: ${metrics.completed_tasks} completed, ${successRate}% success rate`
    );
    lines.push(
      `- **Calibration Score**: ${calibrationScore}% ${getCalibrationEmoji(calibrationScore)}`
    );

    // Task type breakdown not available in gRPC data layer

    // Hook failure patterns with actionable guidance
    if (hookStats.total_executions > 0 && hookStats.failure_count > 0) {
      const failureRate = Math.round(
        (hookStats.failure_count / hookStats.total_executions) * 100
      );
      if (failureRate > 10) {
        lines.push(`\n### Hook Status\n`);
        lines.push(
          `- ${hookStats.failure_count}/${hookStats.total_executions} hook failures (${failureRate}%)`
        );

        // Show general hook failure guidance
        lines.push(`\n**Common Hook Failure Tips:**\n`);
        lines.push(
          `- **Linting/Formatting**: Run \`biome check --write .\` before Stop hooks`
        );
        lines.push(
          `- **Type Errors**: Fix with \`tsc --noEmit\` to see detailed TypeScript errors`
        );
        lines.push(
          `- **Test Failures**: Check with \`bun test\` and fix before committing`
        );
        lines.push(
          `- **Git Storytelling**: Commit work early and often with \`git add\` + \`git commit\``
        );
        lines.push(
          `\n  Run \`han hook list\` to see which hooks are configured`
        );
      }
    }

    // Calibration guidance
    if (calibrationScore < 60) {
      lines.push('\n### Calibration Tips\n');
      lines.push(
        'Your calibration score is low. Focus on accurately predicting task outcomes.'
      );
      lines.push(
        'Run validation hooks before completing tasks to better assess success likelihood.'
      );
    }

    return lines.join('\n');
  } catch (error) {
    if (process.env.DEBUG) {
      console.error(
        'Performance context error:',
        error instanceof Error ? error.message : error
      );
    }
    return null;
  }
}

/**
 * Generate memory context
 */
function generateMemoryContextOutput(): string | null {
  try {
    return injectSessionContext();
  } catch (error) {
    if (process.env.DEBUG) {
      console.error(
        'Memory context error:',
        error instanceof Error ? error.message : error
      );
    }
    return null;
  }
}

/**
 * Output consolidated context for SessionStart
 */
async function outputContext(): Promise<void> {
  const payload = readPayload();
  const sessionId = payload?.session_id ?? randomUUID();

  // Output session ID in XML format
  console.log(`<session-id>${sessionId}</session-id>\n`);

  // Query existing SQLite database directly - DO NOT start coordinator during SessionStart
  // This prevents 30+ second delays when coordinator is slow to start
  // The coordinator will start lazily when actually needed
  try {
    const perfContext = await generatePerformanceContext(sessionId);
    if (perfContext) {
      console.log(perfContext);
      console.log('');
    }
  } catch {
    // Skip metrics on error - don't block session start
  }

  // Output memory context
  const memContext = generateMemoryContextOutput();
  if (memContext) {
    console.log(memContext);
  }
}

/**
 * Register the context command
 */
export function registerHookContext(hookCommand: Command): void {
  hookCommand
    .command('context')
    .description(
      'Output consolidated session context for SessionStart injection.\n' +
        'Includes: session ID, performance metrics, and memory context.'
    )
    .action(async () => {
      if (!isHooksEnabled()) {
        process.exit(0);
      }
      try {
        await outputContext();
      } catch (error) {
        // Silent failure for context - don't break session start
        if (process.env.DEBUG) {
          console.error(
            'Context error:',
            error instanceof Error ? error.message : error
          );
        }
      }
    });
}
