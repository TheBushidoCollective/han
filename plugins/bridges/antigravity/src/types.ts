/**
 * Shared type definitions for the Han-Antigravity bridge.
 *
 * Antigravity (Google's agent-first IDE) doesn't have a lifecycle hooks
 * system like OpenCode. Instead, the bridge integrates via MCP server,
 * exposing skills, disciplines, and on-demand validation as tools.
 *
 * Configuration:
 *   - Global: ~/.gemini/antigravity/mcp_config.json
 *   - Rules: .agent/rules/
 *   - Skills: .agent/skills/
 *   - Workflows: .agent/workflows/
 */

// ─── Antigravity Configuration Types ─────────────────────────────────────────

/**
 * Antigravity MCP server configuration in mcp_config.json.
 */
export interface AntigravityMcpConfig {
  mcpServers: Record<
    string,
    {
      command: string;
      args?: string[];
      env?: Record<string, string>;
    }
  >;
}

/**
 * Antigravity settings from .gemini/settings.json.
 */
export interface AntigravitySettings {
  'tools.autoAccept'?: string[];
  [key: string]: unknown;
}

// ─── MCP Tool Types ──────────────────────────────────────────────────────────

/**
 * MCP tool definition shape for the bridge's tools.
 */
export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, McpToolProperty>;
    required?: string[];
  };
}

export interface McpToolProperty {
  type: string;
  description: string;
  enum?: string[];
}

/**
 * MCP tool call result.
 */
export interface McpToolResult {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
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

// ─── Harness ─────────────────────────────────────────────────────────────────

/**
 * Han harness identifies which AI coding tool is running the session.
 *
 * The union is shared verbatim across every Han bridge so a harness id
 * means the same thing in every JSONL event stream. Defaults to
 * "claude-code" when HAN_PROVIDER is not set or is unrecognized.
 */
export type HanHarness =
  | 'claude-code'
  | 'omp'
  | 'opencode'
  | 'gemini-cli'
  | 'kiro'
  | 'codex'
  | 'antigravity';

const HAN_HARNESSES: readonly HanHarness[] = [
  'claude-code',
  'omp',
  'opencode',
  'gemini-cli',
  'kiro',
  'codex',
  'antigravity',
];

function isHanHarness(value: string | undefined): value is HanHarness {
  return (
    value !== undefined && (HAN_HARNESSES as readonly string[]).includes(value)
  );
}

/**
 * Resolve the harness running this session from the environment.
 * The Antigravity bridge sets HAN_PROVIDER for its own child processes.
 */
export function getHarness(): HanHarness {
  const env = process.env.HAN_PROVIDER;
  return isHanHarness(env) ? env : 'claude-code';
}

// ─── Antigravity -> Claude Code Tool Name Mapping ────────────────────────────

/**
 * Map Antigravity tool names to Claude Code tool names.
 * Antigravity uses similar naming to VS Code extensions and Gemini tools.
 */
export const TOOL_NAME_MAP: Record<string, string> = {
  edit_file: 'Edit',
  write_file: 'Write',
  read_file: 'Read',
  run_terminal_command: 'Bash',
  search_files: 'Grep',
  list_files: 'Glob',
  edit: 'Edit',
  write: 'Write',
  bash: 'Bash',
  read: 'Read',
  glob: 'Glob',
  grep: 'Grep',
};

export function mapToolName(antigravityTool: string): string {
  return TOOL_NAME_MAP[antigravityTool.toLowerCase()] ?? antigravityTool;
}
