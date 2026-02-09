/**
 * Lightweight event logger for the Kiro bridge.
 *
 * Writes Han-format JSONL events with provider="kiro" so the
 * coordinator can index them alongside Claude Code and OpenCode sessions.
 *
 * Path: ~/.han/kiro/{project-slug}/{sessionId}-han.jsonl
 *
 * This is intentionally NOT under ~/.claude/ because Kiro sessions
 * are not Claude Code sessions. The coordinator watches this directory
 * via addWatchPath().
 */

import { randomUUID } from "node:crypto"
import { appendFileSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import type { HookDefinition, HookResult, HanProvider } from "./types"

const MAX_OUTPUT_LENGTH = 10_000

/**
 * Convert a filesystem path to a slug (matches han's pathToSlug).
 * Replaces / and . with -
 */
function pathToSlug(fsPath: string): string {
  return fsPath.replace(/^\//, "-").replace(/[/.]/g, "-")
}

/**
 * Get the han data root for Kiro.
 * Uses ~/.han/kiro/ to keep Kiro data separate from other provider data.
 */
function getHanKiroRoot(): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "/tmp"
  return join(home, ".han", "kiro")
}

/**
 * Get the JSONL events file path for a Kiro session.
 */
function getEventsFilePath(projectDir: string, sessionId: string): string {
  const slug = pathToSlug(projectDir)
  return join(getHanKiroRoot(), "projects", slug, `${sessionId}-han.jsonl`)
}

/**
 * Base event metadata - matches Han's BaseEvent format exactly.
 */
interface BaseEventMeta {
  uuid: string
  sessionId: string
  type: string
  timestamp: string
  provider: HanProvider
  cwd?: string
}

/**
 * Truncate output to prevent enormous JSONL entries.
 */
function truncateOutput(output: string): string {
  if (output.length <= MAX_OUTPUT_LENGTH) return output
  return `${output.slice(0, MAX_OUTPUT_LENGTH)}\n... [truncated, ${output.length - MAX_OUTPUT_LENGTH} more bytes]`
}

/**
 * Event logger for Kiro bridge sessions.
 *
 * Writes the same JSONL event format as Han's EventLogger but with
 * a provider field set to "kiro". Events are buffered and flushed
 * on result events or every 100ms.
 */
export class BridgeEventLogger {
  private logPath: string
  private buffer: string[] = []
  private flushTimer: ReturnType<typeof setTimeout> | null = null
  private readonly sessionId: string
  private readonly provider: HanProvider = "kiro"
  private readonly cwd: string

  constructor(sessionId: string, projectDir: string) {
    this.sessionId = sessionId
    this.cwd = projectDir
    this.logPath = getEventsFilePath(projectDir, sessionId)

    // Ensure directory exists
    try {
      mkdirSync(dirname(this.logPath), { recursive: true })
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") {
        throw err
      }
    }

    console.error(
      `[han] Event logger initialized: ${this.logPath}`,
    )
  }

  private createBase(type: string): BaseEventMeta {
    return {
      uuid: randomUUID(),
      sessionId: this.sessionId,
      type,
      timestamp: new Date().toISOString(),
      provider: this.provider,
      cwd: this.cwd,
    }
  }

  private writeEvent(event: Record<string, unknown>): void {
    const line = `${JSON.stringify(event)}\n`
    this.buffer.push(line)

    // Flush immediately for result events, batch others
    const type = event.type as string
    if (type.endsWith("_result")) {
      this.flush()
    } else {
      this.scheduleFlush()
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return
    this.flushTimer = setTimeout(() => {
      this.flush()
    }, 100)
  }

  private isFlushing = false

  flush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }
    if (this.buffer.length === 0 || this.isFlushing) return

    this.isFlushing = true
    try {
      appendFileSync(this.logPath, this.buffer.join(""))
      this.buffer = []
    } catch (err) {
      console.error(
        `[han] Failed to write events:`,
        err instanceof Error ? err.message : err,
      )
    } finally {
      this.isFlushing = false
    }
  }

  // ─── Hook Events ──────────────────────────────────────────────────────────

  /**
   * Log hook_run event. Returns UUID for correlating with hook_result.
   */
  logHookRun(hook: HookDefinition, hookType: string): string {
    const base = this.createBase("hook_run")
    this.writeEvent({
      ...base,
      data: {
        plugin: hook.pluginName,
        hook: hook.name,
        hook_type: hookType,
        directory: this.cwd,
        cached: false,
        command: hook.command,
      },
    })
    return base.uuid
  }

  /**
   * Log hook_result event.
   */
  logHookResult(result: HookResult, hookType: string, hookRunId: string): void {
    this.writeEvent({
      ...this.createBase("hook_result"),
      hookRunId,
      data: {
        plugin: result.hook.pluginName,
        hook: result.hook.name,
        hook_type: hookType,
        directory: this.cwd,
        cached: result.skipped,
        duration_ms: result.durationMs,
        exit_code: result.exitCode,
        success: result.exitCode === 0,
        output: result.stdout ? truncateOutput(result.stdout) : undefined,
        error: result.stderr || undefined,
        command: result.hook.command,
      },
    })
  }

  /**
   * Log hook_file_change event (file edit detected via tool event).
   */
  logFileChange(toolName: string, filePath: string): void {
    this.writeEvent({
      ...this.createBase("hook_file_change"),
      data: {
        session_id: this.sessionId,
        tool_name: toolName,
        file_path: filePath,
      },
    })
  }

  /**
   * Get the log file path (for coordinator watch registration).
   */
  getLogPath(): string {
    return this.logPath
  }

  /**
   * Get the projects directory (for coordinator watch path).
   */
  getWatchDir(): string {
    return join(getHanKiroRoot(), "projects")
  }
}
