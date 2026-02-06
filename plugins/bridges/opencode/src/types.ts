/**
 * Shared type definitions for the Han-OpenCode bridge.
 */

// ─── OpenCode Plugin Types ───────────────────────────────────────────────────

/**
 * OpenCode plugin context provided by the runtime.
 * See: https://opencode.ai/docs/plugins/
 */
export interface OpenCodePluginContext {
  client: OpenCodeClient
  project: unknown
  directory: string
  worktree: string
  $: BunShell
}

export interface OpenCodeClient {
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

export type BunShell = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<{ exitCode: number; stdout: Buffer; stderr: Buffer }>

/**
 * OpenCode tool event shape from tool.execute.after.
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

export interface OpenCodeEvent {
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

// ─── OpenCode → Claude Code Tool Name Mapping ───────────────────────────────

/**
 * Map OpenCode tool names to Claude Code tool names.
 * OpenCode uses lowercase; Claude Code uses PascalCase.
 */
export const TOOL_NAME_MAP: Record<string, string> = {
  edit: "Edit",
  write: "Write",
  bash: "Bash",
  read: "Read",
  glob: "Glob",
  grep: "Grep",
  notebook_edit: "NotebookEdit",
}

export function mapToolName(openCodeTool: string): string {
  return TOOL_NAME_MAP[openCodeTool.toLowerCase()] ?? openCodeTool
}
