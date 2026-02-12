/**
 * Result formatting for the Kiro bridge.
 *
 * Kiro hooks communicate via stdout/stderr. Results are structured
 * as XML-tagged messages that the agent can parse and act on.
 *
 * Key difference from OpenCode bridge: no tool output mutation.
 * All results go to stdout (for display) or stderr (for warnings/blocking).
 */

import type { HookResult } from './types';

/**
 * Format a single hook result as a structured validation block.
 */
function formatSingleResult(result: HookResult): string {
  const { hook, exitCode, stdout, stderr } = result;
  const status = exitCode === 0 ? 'passed' : 'failed';
  const output = (stdout || stderr).trim();

  if (!output) return '';

  return [
    `<han-validation plugin="${hook.pluginName}" hook="${hook.name}" status="${status}">`,
    output,
    `</han-validation>`,
  ].join('\n');
}

/**
 * Format PostToolUse hook results for stdout delivery.
 *
 * Only includes failed hooks since passing validation doesn't need
 * to be surfaced to the agent.
 *
 * @returns Formatted string for stdout, or null if no failures
 */
export function formatPostToolResults(results: HookResult[]): string | null {
  const failures = results.filter((r) => !r.skipped && r.exitCode !== 0);

  if (failures.length === 0) return null;

  const blocks = failures.map(formatSingleResult).filter(Boolean);
  if (blocks.length === 0) return null;

  return [
    '<han-post-tool-validation>',
    'The following validation hooks reported issues after your last edit.',
    'Please fix these issues before continuing:',
    '',
    ...blocks,
    '</han-post-tool-validation>',
  ].join('\n');
}

/**
 * Format PreToolUse hook results for stderr (used with exit code 2 to block).
 *
 * @returns Formatted string for stderr, or null if no failures
 */
export function formatPreToolResults(results: HookResult[]): string | null {
  const failures = results.filter((r) => !r.skipped && r.exitCode !== 0);

  if (failures.length === 0) return null;

  const blocks = failures.map(formatSingleResult).filter(Boolean);
  if (blocks.length === 0) return null;

  return [
    '<han-pre-tool-validation>',
    'Han validation hooks blocked this operation:',
    '',
    ...blocks,
    '</han-pre-tool-validation>',
  ].join('\n');
}

/**
 * Format Stop hook results for stdout delivery.
 *
 * Used when the agent finishes a turn and broader validation finds issues.
 *
 * @returns Message to output to stdout, or null if all passed
 */
export function formatStopResults(results: HookResult[]): string | null {
  const failures = results.filter((r) => !r.skipped && r.exitCode !== 0);

  if (failures.length === 0) return null;

  const blocks = failures.map(formatSingleResult).filter(Boolean);
  if (blocks.length === 0) return null;

  return [
    '<han-validation-summary>',
    'Han validation hooks found issues that need to be fixed:',
    '',
    ...blocks,
    '</han-validation-summary>',
  ].join('\n');
}

/**
 * Format agentSpawn context for stdout.
 * Includes core guidelines, skill/discipline counts, and capabilities.
 */
export function formatAgentSpawnContext(
  sessionContext: string,
  disciplineContext: string | null
): string {
  const parts = [sessionContext];
  if (disciplineContext) {
    parts.push(disciplineContext);
  }
  return parts.join('\n\n');
}
