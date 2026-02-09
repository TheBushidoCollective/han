/**
 * Shared type definitions for the Han-Codex bridge.
 */

// ─── Codex Plugin Types ─────────────────────────────────────────────────────

/**
 * Codex plugin context provided by the runtime.
 * See: https://developers.openai.com/codex/cli/features/
 *
 * Codex CLI's extension model uses config.toml-based hooks and MCP servers.
 * This plugin can run as:
 *   1. A Codex config hook handler (invoked by Codex lifecycle events)
 *   2. An MCP server (providing tools like han_skills, han_discipline)
 *   3. A standalone bridge (imported as a JS/TS module)
 */
export interface CodexPluginContext {
  client: CodexClient
  project: unknown
  directory: string
  worktree: string
}

export interface CodexClient {
  session: {
    prompt(args: {
      path: { id: string }
      body: {
        noReply?: boolean
        parts: Array<{ type: "text"; text: string }>
      }
    }): Promise<void>
  }
}

/**
 * Codex tool event shape from hook execution.
 * Codex uses function_call / function_call_output response items.
 */
export interface ToolBeforeInput {
  tool: string
  sessionID: string
  callID: string
}

export interface ToolBeforeOutput {
  args: Record<string, unknown>
}

/**
 * Codex tool event shape after execution.
 */
export interface ToolEventInput {
  tool: string
  sessionID: string
  callID: string
}

export interface ToolEventOutput {
  title: string
  output: string
  metadata?: Record<string, unknown>
}

export interface CodexEvent {
  type: string
  properties?: Record<string, unknown>
}

export interface StopResult {
  continue: boolean
  assistantMessage?: string
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
 * Defaults to "claude-code" when HAN_PROVIDER is not set.
 */
export type HanProvider = "codex" | "claude-code"

export function getProvider(): HanProvider {
  const env = process.env.HAN_PROVIDER
  if (env === "codex") return "codex"
  return "claude-code"
}

// ─── Codex → Claude Code Tool Name Mapping ───────────────────────────────────

/**
 * Map Codex tool names to Claude Code tool names.
 * Codex uses snake_case / lowercase; Claude Code uses PascalCase.
 *
 * Codex tools (from function_call response items):
 * - shell: Execute shell commands (equivalent to Bash)
 * - write: Write/create files
 * - edit: Edit existing files via patch
 * - read: Read file contents
 * - list: List directory contents (equivalent to Glob)
 */
export const TOOL_NAME_MAP: Record<string, string> = {
  shell: "Bash",
  edit: "Edit",
  write: "Write",
  read: "Read",
  list: "Glob",
  bash: "Bash",
  glob: "Glob",
  grep: "Grep",
  notebook_edit: "NotebookEdit",
}

export function mapToolName(codexTool: string): string {
  return TOOL_NAME_MAP[codexTool.toLowerCase()] ?? codexTool
}
