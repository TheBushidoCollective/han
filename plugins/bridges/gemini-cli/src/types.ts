/**
 * Shared type definitions for the Han-Gemini CLI bridge.
 */

// ─── Gemini CLI Hook Types ──────────────────────────────────────────────────

/**
 * Gemini CLI hook input received via stdin.
 * See: https://geminicli.com/docs/hooks/
 */
export interface GeminiHookInput {
  /** Tool name (for BeforeTool/AfterTool events) */
  tool_name?: string
  /** Tool input parameters */
  tool_input?: Record<string, unknown>
  /** LLM request context */
  llm_request?: {
    messages: Array<{ role: string; content: string }>
  }
  /** LLM response (for AfterModel hooks) */
  llm_response?: unknown
  /** Final agent response (for AfterAgent hooks) */
  prompt_response?: unknown
}

/**
 * Gemini CLI hook output written to stdout.
 * Must be valid JSON - only JSON goes to stdout.
 */
export interface GeminiHookOutput {
  /** Decision for tool/agent control */
  decision?: "allow" | "deny" | "block"
  /** Reason for decision (shown to agent) */
  reason?: string
  /** System message shown to user */
  systemMessage?: string
  /** Event-specific output */
  hookSpecificOutput?: Record<string, unknown>
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
export type HanProvider = "gemini-cli" | "opencode" | "claude-code"

export function getProvider(): HanProvider {
  const env = process.env.HAN_PROVIDER
  if (env === "gemini-cli") return "gemini-cli"
  if (env === "opencode") return "opencode"
  return "claude-code"
}

// ─── Gemini CLI → Claude Code Tool Name Mapping ─────────────────────────────

/**
 * Map Gemini CLI tool names to Claude Code tool names.
 * Gemini CLI uses snake_case; Claude Code uses PascalCase.
 *
 * See: https://geminicli.com/docs/tools/file-system/
 * See: https://geminicli.com/docs/tools/shell/
 */
export const TOOL_NAME_MAP: Record<string, string> = {
  write_file: "Write",
  replace: "Edit",
  run_shell_command: "Bash",
  read_file: "Read",
  list_directory: "Glob",
  glob: "Glob",
  search_file_content: "Grep",
  google_web_search: "WebSearch",
  web_fetch: "WebFetch",
  save_memory: "Write",
  write_todos: "TodoWrite",
}

export function mapToolName(geminiTool: string): string {
  return TOOL_NAME_MAP[geminiTool.toLowerCase()] ?? geminiTool
}

/**
 * Check if a Gemini CLI tool name is a file-writing tool.
 * Used to determine if PostToolUse validation should run.
 */
export function isFileWriteTool(geminiTool: string): boolean {
  const name = geminiTool.toLowerCase()
  return name === "write_file" || name === "replace"
}
