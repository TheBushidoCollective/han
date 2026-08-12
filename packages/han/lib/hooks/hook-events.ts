/**
 * The Claude Code hook event catalogue.
 *
 * This module is deliberately dependency-free. Consumers include UI modules
 * that are re-exported from `hooks/index.ts`, and pulling a module with a
 * transitive graph into that barrel makes it an async module, which breaks
 * `require()` of the barrel on older Bun releases.
 */

/**
 * Every Claude Code hook event, in the order han writes them into a generated
 * `hooks.json`. This is the single source of truth: the `HookEventType` union,
 * shorthand validation, and hooks.json key ordering all derive from it, so a
 * new upstream event is added in exactly one place.
 *
 * Complete as of Claude Code 2.1.228.
 * See https://code.claude.com/docs/en/plugins-reference#hooks
 */
export const HOOK_EVENT_TYPES = [
  'SessionStart',
  'Setup',
  'UserPromptSubmit',
  'UserPromptExpansion',
  'PreToolUse',
  'PermissionRequest',
  'PermissionDenied',
  'PostToolUse',
  'PostToolUseFailure',
  'PostToolBatch',
  'Notification',
  'MessageDisplay',
  'Stop',
  'SubagentStop',
  'SubagentStart',
  'TaskCreated',
  'TaskCompleted',
  'StopFailure',
  'TeammateIdle',
  'InstructionsLoaded',
  'ConfigChange',
  'CwdChanged',
  'DirectoryAdded',
  'FileChanged',
  'WorktreeCreate',
  'WorktreeRemove',
  'PreCompact',
  'PostCompact',
  'Elicitation',
  'ElicitationResult',
  'SessionEnd',
] as const;

/**
 * Claude Code hook event types that can trigger han hooks.
 */
export type HookEventType = (typeof HOOK_EVENT_TYPES)[number];
