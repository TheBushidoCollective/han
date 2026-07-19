/**
 * Shared type definitions for the Han-Codex bridge.
 *
 * Codex CLI uses Claude-Code-style lifecycle hooks (enabled with
 * [features] hooks = true in ~/.codex/config.toml). Each hook is a shell
 * command that receives JSON via stdin and returns JSON via stdout.
 * See: https://developers.openai.com/codex/hooks
 */

// ─── Codex Hook Payload Types ───────────────────────────────────────────────

/**
 * JSON payload passed to Codex hooks via stdin.
 * Common fields are present on every event; event-specific fields are
 * marked optional.
 */
export interface CodexHookPayload {
  hook_event_name?: string;
  session_id?: string;
  transcript_path?: string;
  cwd?: string;
  model?: string;
  permission_mode?: string;
  turn_id?: string;
  /** SessionStart: startup | resume | clear | compact */
  source?: string;
  /** UserPromptSubmit: the user's prompt text */
  prompt?: string;
  /** PreToolUse / PostToolUse / PermissionRequest: tool name */
  tool_name?: string;
  /** PreToolUse / PostToolUse: unique tool call id */
  tool_use_id?: string;
  /** PreToolUse / PostToolUse / PermissionRequest: tool parameters */
  tool_input?: Record<string, unknown>;
  /** PostToolUse: tool result */
  tool_response?: unknown;
  /** Stop / SubagentStop: true when already continuing from a stop hook */
  stop_hook_active?: boolean;
  /** Stop / SubagentStop: last assistant message text */
  last_assistant_message?: string;
  /** PreCompact / PostCompact: manual | auto */
  trigger?: string;
  /** SubagentStart / SubagentStop */
  agent_id?: string;
  agent_type?: string;
}

// ─── Codex Hook Response Types ──────────────────────────────────────────────

/**
 * hookSpecificOutput for PreToolUse: allow/deny with optional input rewrite.
 */
export interface CodexPreToolUseOutput {
  hookEventName: 'PreToolUse';
  permissionDecision: 'allow' | 'deny' | 'ask';
  permissionDecisionReason?: string;
  /** Replacement tool input when permissionDecision is "allow" */
  updatedInput?: Record<string, unknown>;
}

/**
 * hookSpecificOutput for PermissionRequest.
 */
export interface CodexPermissionRequestOutput {
  hookEventName: 'PermissionRequest';
  decision: {
    behavior: 'allow' | 'deny';
    message?: string;
  };
}

/**
 * hookSpecificOutput for context-injecting events
 * (SessionStart, UserPromptSubmit, SubagentStart, PostToolUse).
 */
export interface CodexContextOutput {
  hookEventName: string;
  additionalContext: string;
}

/**
 * JSON response written to stdout. Must be valid JSON - only JSON
 * goes to stdout; all logging goes to stderr.
 */
export interface CodexHookOutput {
  /** false stops all processing; takes precedence over decision */
  continue?: boolean;
  /** Message shown to the user when continue is false */
  stopReason?: string;
  /** Warning message shown to the user */
  systemMessage?: string;
  /** true hides the output from the transcript */
  suppressOutput?: boolean;
  /** "block" semantics depend on the event (deny tool, feedback, continue) */
  decision?: 'block';
  /** Reason paired with decision (shown to the agent) */
  reason?: string;
  hookSpecificOutput?:
    | CodexPreToolUseOutput
    | CodexPermissionRequestOutput
    | CodexContextOutput;
}

// ─── Han Hook Types ──────────────────────────────────────────────────────────

/**
 * A hook definition parsed from a plugin's han-plugin.yml.
 */
export interface HookDefinition {
  /** Hook name (key in the hooks map, e.g. "lint-async") */
  name: string;
  /** Plugin short name (e.g. "biome") */
  pluginName: string;
  /** Absolute path to the plugin directory */
  pluginRoot: string;
  /** The hook event type(s) */
  event: string | string[];
  /** Shell command to execute (may contain ${HAN_FILES}) */
  command: string;
  /** Which tools trigger this hook (e.g. ["Edit", "Write", "NotebookEdit"]) */
  toolFilter?: string[];
  /** File glob patterns that trigger this hook */
  fileFilter?: string[];
  /** Directories required to exist (e.g. ["biome.json"]) */
  dirsWith?: string[];
  /** Bash expression to test if hook applies to this directory */
  dirTest?: string;
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Result of executing a single hook command.
 */
export interface HookResult {
  /** The hook that was executed */
  hook: HookDefinition;
  /** Process exit code (0 = success) */
  exitCode: number;
  /** Combined stdout output */
  stdout: string;
  /** Combined stderr output */
  stderr: string;
  /** Execution duration in milliseconds */
  durationMs: number;
  /** Whether the hook was skipped (e.g. no matching files) */
  skipped: boolean;
}

// ─── Provider ────────────────────────────────────────────────────────────────

/**
 * Han provider identifies which AI coding tool is running the session.
 */
export type HanProvider = 'codex' | 'claude-code';

export function getProvider(): HanProvider {
  const env = process.env.HAN_PROVIDER;
  if (env === 'codex') return 'codex';
  return 'claude-code';
}

// ─── Codex → Claude Code Tool Name Mapping ───────────────────────────────────

/**
 * Map Codex tool names to Claude Code tool names for Han hook matching.
 *
 * Codex's edit tool is apply_patch, but hooks also fire with the
 * Edit/Write aliases for apply_patch operations - those pass through
 * as-is. MCP tools (mcp__server__tool) also pass through unchanged.
 * Read-like tools do not fire PostToolUse matchers in practice.
 *
 * See: https://developers.openai.com/codex/hooks
 */
export const TOOL_NAME_MAP: Record<string, string> = {
  bash: 'Bash',
  shell: 'Bash',
  apply_patch: 'Edit',
  spawn_agent: 'Agent',
};

export function mapToolName(codexTool: string): string {
  return TOOL_NAME_MAP[codexTool.toLowerCase()] ?? codexTool;
}
