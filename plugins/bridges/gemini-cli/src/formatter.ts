/**
 * Result formatting: turns raw hook results into structured messages
 * for Gemini CLI's hook response protocol.
 *
 * Gemini CLI hooks communicate via stdout JSON. The bridge formats
 * hook results as Gemini CLI response objects with appropriate
 * decision/reason/systemMessage fields.
 */

import type { GeminiHookOutput, HookResult } from './types';

/**
 * Format a single hook result as a text block.
 */
function formatSingleResult(result: HookResult): string {
  const { hook, exitCode, stdout, stderr } = result;
  const status = exitCode === 0 ? 'passed' : 'failed';
  const output = (stdout || stderr).trim();

  if (!output) return '';

  return [`[${hook.pluginName}/${hook.name}] ${status}:`, output].join('\n');
}

/**
 * Format PostToolUse (AfterTool) hook results for Gemini CLI.
 *
 * Returns a GeminiHookOutput with validation results as systemMessage.
 * If all hooks pass, returns null (empty response).
 */
export function formatAfterToolResults(
  results: HookResult[]
): GeminiHookOutput | null {
  const failures = results.filter((r) => !r.skipped && r.exitCode !== 0);

  if (failures.length === 0) return null;

  const blocks = failures.map(formatSingleResult).filter(Boolean);
  if (blocks.length === 0) return null;

  const message = [
    'Han validation hooks found issues after your last edit.',
    'Please fix these issues before continuing:',
    '',
    ...blocks,
  ].join('\n');

  return {
    systemMessage: message,
  };
}

/**
 * Format Stop (AfterAgent) hook results for Gemini CLI.
 *
 * If validation fails, returns decision: "block" to force the agent
 * to continue and fix the issues.
 */
export function formatAfterAgentResults(
  results: HookResult[]
): GeminiHookOutput | null {
  const failures = results.filter((r) => !r.skipped && r.exitCode !== 0);

  if (failures.length === 0) return null;

  const blocks = failures.map(formatSingleResult).filter(Boolean);
  if (blocks.length === 0) return null;

  const reason = [
    'Han validation hooks found issues that need to be fixed:',
    '',
    ...blocks,
  ].join('\n');

  return {
    decision: 'block',
    reason,
    systemMessage: 'Validation failed - fixing issues before completing.',
  };
}

/**
 * Format PreToolUse (BeforeTool) hook results for Gemini CLI.
 *
 * If any hook fails, returns decision: "deny" to block the tool execution.
 */
export function formatBeforeToolResults(
  results: HookResult[]
): GeminiHookOutput | null {
  const failures = results.filter((r) => !r.skipped && r.exitCode !== 0);

  if (failures.length === 0) return null;

  const blocks = failures.map(formatSingleResult).filter(Boolean);
  if (blocks.length === 0) return null;

  const reason = ['Han pre-tool validation failed:', '', ...blocks].join('\n');

  return {
    decision: 'deny',
    reason,
  };
}
