/**
 * Shared type definitions for the Han-omp bridge.
 *
 * The omp extension API is declared structurally here rather than imported
 * from `@oh-my-pi/pi-coding-agent`. omp ships as a self-contained binary
 * (Homebrew, curl installer), so the npm package is not guaranteed to be
 * resolvable on a machine that runs omp. The sibling OpenCode bridge makes
 * the same call for the same reason: it declares `OpenCodePluginContext`
 * locally instead of depending on `@opencode-ai/plugin` in its server module.
 *
 * Field names below are taken from the published type declarations of
 * @oh-my-pi/pi-coding-agent (dist/types/extensibility/extensions/types.d.ts),
 * narrowed to the surface this bridge actually consumes. Every optional
 * member is guarded at the callsite, so a future omp release that drops or
 * renames one degrades the affected metric instead of breaking the session.
 */

// ─── Han Harness Identity ────────────────────────────────────────────────────

/**
 * Canonical Han harness id for Oh My Pi.
 *
 * Every event this bridge writes carries `harness: "omp"`. Han reads an absent
 * `harness` as "claude-code", so this must always be written explicitly.
 */
export const HAN_HARNESS = 'omp';

// ─── omp Extension API (structural subset) ───────────────────────────────────

/** omp's model handle. Only the identity fields are read here. */
export interface OmpModel {
  id?: string;
  provider?: string;
}

/** Return of `ctx.getContextUsage()`. */
export interface OmpContextUsage {
  tokens?: number;
}

/**
 * Read-only session manager exposed as `ctx.sessionManager`.
 *
 * `getSessionFile()` returns the absolute path of the session JSONL. omp keeps
 * a new session in memory until its first assistant message, so the path can
 * name a file that does not exist yet.
 */
export interface OmpSessionManager {
  getSessionFile?(): string | undefined;
}

/** Managed timer handle returned by `ctx.setTimeout`. */
export type OmpTimer = unknown;

/**
 * Handler context passed to every `pi.on(...)` handler.
 */
export interface OmpExtensionContext {
  cwd: string;
  sessionManager?: OmpSessionManager;
  model?: OmpModel;
  getContextUsage?(): OmpContextUsage | undefined;
  /**
   * Throw-contained one-shot timer. omp tears the whole session down on an
   * uncaught throw from a raw `setTimeout` callback, so background work must
   * go through this.
   */
  setTimeout?(
    callback: (...args: unknown[]) => void,
    ms?: number,
    ...args: unknown[]
  ): OmpTimer;
  clearTimer?(timer: OmpTimer): void;
}

/** `tool_execution_start` payload. */
export interface OmpToolExecutionStartEvent {
  type: 'tool_execution_start';
  toolCallId: string;
  toolName: string;
  args: unknown;
  intent?: string;
}

/** `tool_execution_end` payload. */
export interface OmpToolExecutionEndEvent {
  type: 'tool_execution_end';
  toolCallId: string;
  toolName: string;
  result: unknown;
  isError: boolean;
}

/**
 * The omp events this bridge subscribes to.
 *
 * `tool_call` and `tool_result` are deliberately absent. omp treats a throw
 * from a `tool_call` handler as fail-closed and blocks the tool, so a
 * telemetry handler on that event can break a user's session. The
 * `tool_execution_*` pair is documented as observability and carries the same
 * information.
 */
export type OmpObservedEvent =
  | 'session_start'
  | 'session_switch'
  | 'session_shutdown'
  | 'session_compact'
  | 'turn_end'
  | 'tool_execution_start'
  | 'tool_execution_end';

/**
 * The slice of `ExtensionAPI` this bridge uses: event subscription and the
 * logger. Handlers are typed loosely because omp's own union is far wider
 * than what is consumed here.
 */
export interface OmpExtensionApi {
  on(
    event: OmpObservedEvent,
    handler: (event: unknown, ctx: OmpExtensionContext) => void | Promise<void>
  ): void;
  setLabel?(label: string): void;
  logger?: {
    debug?(message: string, ...args: unknown[]): void;
    error?(message: string, ...args: unknown[]): void;
  };
}

// ─── omp Session JSONL (structural subset) ───────────────────────────────────

/**
 * Token and cost accounting omp attaches to a persisted assistant message.
 *
 * Verified against a real session file written by omp 17.2.15: every assistant
 * message carried `input`, `output`, `cacheRead`, `cacheWrite`, `totalTokens`,
 * and a full `cost` breakdown. `cost` is still typed optional because a
 * provider omp cannot price (a local model, a bring-your-own-endpoint) has no
 * dollar figure to report, and a missing cost must not be reported as zero.
 */
export interface OmpUsage {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  cost?: {
    total?: number;
  };
}

/** An assistant message as persisted inside a `message` session entry. */
export interface OmpPersistedMessage {
  role?: string;
  model?: string;
  provider?: string;
  usage?: OmpUsage;
}

/** A single line of an omp session JSONL file. */
export interface OmpSessionEntry {
  type?: string;
  /** 8-character entry id. Absent on the header and the title slot. */
  id?: string;
  message?: OmpPersistedMessage;
}

// ─── omp → Claude Code Tool Name Mapping ─────────────────────────────────────

/**
 * Map omp's built-in tool names to Claude Code's.
 *
 * omp names tools in lowercase; Claude Code uses PascalCase. Han's tool
 * metrics are keyed by name, so without this an omp `read` and a Claude Code
 * `Read` would be counted as two different tools and no cross-harness tool
 * comparison would line up. Unknown names (MCP tools, extension tools) pass
 * through untouched.
 */
export const TOOL_NAME_MAP: Record<string, string> = {
  read: 'Read',
  write: 'Write',
  edit: 'Edit',
  bash: 'Bash',
  glob: 'Glob',
  grep: 'Grep',
  task: 'Task',
  eval: 'Eval',
  browser: 'Browser',
  computer: 'Computer',
  debug: 'Debug',
  hub: 'Hub',
  yield: 'Yield',
};

export function mapToolName(ompTool: string): string {
  return TOOL_NAME_MAP[ompTool.toLowerCase()] ?? ompTool;
}

/**
 * Tools whose successful execution means a file on disk changed.
 *
 * Keyed by the mapped (Claude Code) name so this stays aligned with the other
 * bridges' file-change reporting.
 */
export const FILE_MUTATING_TOOLS: Record<string, true> = {
  Write: true,
  Edit: true,
};

/**
 * Pull a file path out of an omp tool's arguments.
 *
 * omp's `write` and `edit` both take `path`. `file_path` is accepted as well
 * so an MCP or extension tool that follows the Claude Code convention is still
 * reported.
 */
export function extractFilePath(args: unknown): string | undefined {
  if (typeof args !== 'object' || args === null) return undefined;
  const record = args as Record<string, unknown>;
  const candidate = record.path ?? record.file_path ?? record.filePath;
  return typeof candidate === 'string' && candidate.length > 0
    ? candidate
    : undefined;
}
