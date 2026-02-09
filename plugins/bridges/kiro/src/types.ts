/**
 * Shared type definitions for the Han-Kiro bridge.
 *
 * Kiro CLI uses a shell-based hook system where hooks receive JSON
 * via stdin and output results to stdout. This is fundamentally
 * different from OpenCode's in-process JS plugin system.
 */

// ─── Kiro Hook Payload Types ────────────────────────────────────────────────

/**
 * JSON payload passed to Kiro hooks via stdin.
 * See: https://kiro.dev/docs/cli/hooks/
 */
export interface KiroHookPayload {
  hook_event_name: string
  cwd: string
  tool_name?: string
  tool_input?: Record<string, unknown>
  tool_response?: Record<string, unknown>
}

// ─── Han Hook Types ──────────────────────────────────────────────────────────

/**
 * A hook definition parsed from a plugin's han-plugin.yml.
 */
export interface HookDefinition {
  /** Hook name (key in the hooks map, e.g. "lint-async") */
  name: string
  /** Plugin short name (e.g. "biome") */
  pluginName: string
  /** Absolute path to the plugin directory */
  pluginRoot: string
  /** The hook event type(s) */
  event: string | string[]
  /** Shell command to execute (may contain ${HAN_FILES}) */
  command: string
  /** Which tools trigger this hook (e.g. ["Edit", "Write", "NotebookEdit"]) */
  toolFilter?: string[]
  /** File glob patterns that trigger this hook */
  fileFilter?: string[]
  /** Directories required to exist (e.g. ["biome.json"]) */
  dirsWith?: string[]
  /** Bash expression to test if hook applies to this directory */
  dirTest?: string
  /** Timeout in milliseconds */
  timeout?: number
}

/**
 * Result of executing a single hook command.
 */
export interface HookResult {
  /** The hook that was executed */
  hook: HookDefinition
  /** Process exit code (0 = success) */
  exitCode: number
  /** Combined stdout output */
  stdout: string
  /** Combined stderr output */
  stderr: string
  /** Execution duration in milliseconds */
  durationMs: number
  /** Whether the hook was skipped (e.g. no matching files) */
  skipped: boolean
}

// ─── Provider ────────────────────────────────────────────────────────────────

/**
 * Han provider identifies which AI coding tool is running the session.
 */
export type HanProvider = "kiro" | "opencode" | "claude-code"

export function getProvider(): HanProvider {
  const env = process.env.HAN_PROVIDER
  if (env === "kiro") return "kiro"
  if (env === "opencode") return "opencode"
  return "claude-code"
}

// ─── Kiro → Claude Code Tool Name Mapping ────────────────────────────────────

/**
 * Map Kiro CLI tool names to Claude Code tool names.
 * Kiro uses snake_case internal names; Claude Code uses PascalCase.
 *
 * See: https://kiro.dev/docs/cli/reference/built-in-tools/
 */
export const TOOL_NAME_MAP: Record<string, string> = {
  fs_read: "Read",
  fs_write: "Write",
  execute_bash: "Bash",
  glob: "Glob",
  grep: "Grep",
  notebook_edit: "NotebookEdit",
  use_aws: "Bash",
}

export function mapToolName(kiroTool: string): string {
  return TOOL_NAME_MAP[kiroTool.toLowerCase()] ?? kiroTool
}

/**
 * Check if a Kiro tool name is a file-writing tool.
 * Used to determine if PostToolUse validation should run.
 */
export function isFileWriteTool(kiroTool: string): boolean {
  const name = kiroTool.toLowerCase()
  return name === "fs_write" || name === "notebook_edit"
}
