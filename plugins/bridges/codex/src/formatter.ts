/**
 * Result formatting: turns raw hook results into Codex hook responses.
 *
 * Codex hooks communicate via stdout JSON. The bridge formats hook
 * results as CodexHookOutput objects with the appropriate decision
 * and hookSpecificOutput shapes per event.
 */

import type { CodexHookOutput, HookResult } from './types';

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
 * Collect failure blocks from hook results.
 */
function failureBlocks(results: HookResult[]): string[] {
  const failures = results.filter((r) => !r.skipped && r.exitCode !== 0);
  return failures.map(formatSingleResult).filter(Boolean);
}

/**
 * Format PreToolUse hook results as a Codex permission decision.
 *
 * If any hook fails, the tool call is denied via hookSpecificOutput
 * and the reason is sent to the agent.
 */
export function formatPreToolUseResults(
  results: HookResult[]
): CodexHookOutput | null {
  const blocks = failureBlocks(results);
  if (blocks.length === 0) return null;

  const reason = [
    'Han pre-tool validation blocked this operation:',
    '',
    ...blocks,
  ].join('\n');

  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  };
}

/**
 * Format PermissionRequest hook results as a Codex allow/deny decision.
 *
 * If any hook fails, the permission request is denied with the reason
 * shown to the user.
 */
export function formatPermissionRequestResults(
  results: HookResult[]
): CodexHookOutput | null {
  const blocks = failureBlocks(results);
  if (blocks.length === 0) return null;

  const message = [
    'Han pre-tool validation denied this operation:',
    '',
    ...blocks,
  ].join('\n');

  return {
    hookSpecificOutput: {
      hookEventName: 'PermissionRequest',
      decision: {
        behavior: 'deny',
        message,
      },
    },
  };
}

/**
 * Format PostToolUse hook results as tool-result feedback.
 *
 * decision: "block" replaces the tool result with the reason, so the
 * agent sees validation failures as feedback on its edit.
 */
export function formatPostToolUseResults(
  results: HookResult[]
): CodexHookOutput | null {
  const blocks = failureBlocks(results);
  if (blocks.length === 0) return null;

  const reason = [
    '<han-post-tool-validation>',
    'The following validation hooks reported issues after your last edit.',
    'Please fix these issues before continuing:',
    '',
    ...blocks,
    '</han-post-tool-validation>',
  ].join('\n');

  return {
    decision: 'block',
    reason,
  };
}

/**
 * Format Stop/SubagentStop hook results as a continuation decision.
 *
 * decision: "block" turns the reason into a new user prompt, forcing
 * the agent to keep working until validation passes.
 */
export function formatStopResults(
  results: HookResult[]
): CodexHookOutput | null {
  const blocks = failureBlocks(results);
  if (blocks.length === 0) return null;

  const reason = [
    '<han-validation-summary>',
    'Han validation hooks found issues that need to be fixed:',
    '',
    ...blocks,
    '</han-validation-summary>',
  ].join('\n');

  return {
    decision: 'block',
    reason,
  };
}
