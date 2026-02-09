/**
 * Result formatting: turns raw hook results into structured messages
 * that OpenCode's agent can understand and act on.
 *
 * Output uses XML-like tags for clear structure, making it easy
 * for the LLM to parse plugin name, file, status, and error details.
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
 * Format PostToolUse hook results for inline tool output mutation.
 *
 * Only includes failed hooks since passing validation doesn't need
 * to be surfaced to the agent.
 *
 * @returns Formatted string to append to tool output, or null if no failures
 */
export function formatInlineResults(results: HookResult[]): string | null {
  const failures = results.filter((r) => !r.skipped && r.exitCode !== 0);

  if (failures.length === 0) return null;

  const blocks = failures.map(formatSingleResult).filter(Boolean);
  if (blocks.length === 0) return null;

  return ['', '--- Han Validation ---', ...blocks].join('\n');
}

/**
 * Format PostToolUse hook results as an async notification message.
 *
 * Used with client.session.prompt() to inject validation results
 * that the agent can act on in its next turn.
 *
 * @returns Structured message for the agent, or null if no failures
 */
export function formatNotificationResults(
  results: HookResult[],
  filePaths: string[]
): string | null {
  const failures = results.filter((r) => !r.skipped && r.exitCode !== 0);

  if (failures.length === 0) return null;

  const blocks = failures.map(formatSingleResult).filter(Boolean);
  if (blocks.length === 0) return null;

  const fileList = filePaths.length > 0 ? `Files: ${filePaths.join(', ')}` : '';

  return [
    `<han-post-tool-validation${fileList ? ` files="${filePaths.join(',')}"` : ''}>`,
    'The following validation hooks reported issues after your last edit.',
    'Please fix these issues before continuing:',
    '',
    ...blocks,
    '</han-post-tool-validation>',
  ].join('\n');
}

/**
 * Format Stop/idle hook results for re-prompting the agent.
 *
 * Used when the agent finishes a turn and broader validation finds issues.
 *
 * @returns Message to send via client.session.prompt(), or null if all passed
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
