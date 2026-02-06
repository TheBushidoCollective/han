/**
 * Promise-based hook executor.
 *
 * Runs hook commands as child processes, capturing stdout/stderr/exit code.
 * Unlike han's fire-and-forget dispatch, this awaits all results and returns
 * structured data that can be formatted into actionable agent feedback.
 */

import { spawn } from "node:child_process"
import type { HookDefinition, HookResult } from "./types"
import { shouldSkipHook, recordSuccess } from "./cache"
import type { BridgeEventLogger } from "./events"

const DEFAULT_TIMEOUT = 60_000 // 60s for individual hooks

/**
 * Execute a single hook command as a promise.
 *
 * Substitutes ${HAN_FILES} with the provided file path(s) and runs
 * the command in the project directory with proper environment setup.
 */
export function executeHook(
  hook: HookDefinition,
  filePaths: string[],
  options: {
    cwd: string
    sessionId: string
    timeout?: number
    eventLogger?: BridgeEventLogger
    hookType?: string
  },
): Promise<HookResult> {
  const startTime = Date.now()

  // Check cache: skip if every file is unchanged since last successful run
  if (filePaths.length > 0) {
    const allCached = filePaths.every((fp) =>
      shouldSkipHook(hook.pluginName, hook.name, fp),
    )
    if (allCached) {
      return {
        hook,
        exitCode: 0,
        stdout: "",
        stderr: "",
        durationMs: 0,
        skipped: true,
      }
    }
  }

  // Substitute ${HAN_FILES} with actual file paths
  const filesArg = filePaths.join(" ")
  let command = hook.command.replace(/\$\{HAN_FILES\}/g, filesArg)

  // Substitute ${CLAUDE_PLUGIN_ROOT}
  command = command.replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, hook.pluginRoot)

  // If command still has no files and requires them, skip
  if (hook.command.includes("${HAN_FILES}") && filePaths.length === 0) {
    return Promise.resolve({
      hook,
      exitCode: 0,
      stdout: "",
      stderr: "",
      durationMs: 0,
      skipped: true,
    })
  }

  // Log hook_run event
  const hookRunId = options.eventLogger?.logHookRun(
    hook,
    options.hookType ?? "PostToolUse",
  )

  return new Promise((resolve) => {
    const timeout = hook.timeout ?? options.timeout ?? DEFAULT_TIMEOUT

    const child = spawn(command, {
      cwd: options.cwd,
      shell: "/bin/bash",
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        CLAUDE_PLUGIN_ROOT: hook.pluginRoot,
        CLAUDE_PROJECT_DIR: options.cwd,
        HAN_SESSION_ID: options.sessionId,
        HAN_PROVIDER: "opencode",
        HAN_FILES: filesArg,
        HAN_FILE: filePaths[0] ?? "",
      },
      timeout,
    })

    let stdout = ""
    let stderr = ""

    child.stdout.on("data", (data: Buffer) => {
      stdout += data.toString()
    })

    child.stderr.on("data", (data: Buffer) => {
      stderr += data.toString()
    })

    child.on("close", (code) => {
      const exitCode = code ?? 1

      // Cache successful results so unchanged files skip next time
      if (exitCode === 0) {
        for (const fp of filePaths) {
          recordSuccess(hook.pluginName, hook.name, fp)
        }
      }

      const result: HookResult = {
        hook,
        exitCode,
        stdout,
        stderr,
        durationMs: Date.now() - startTime,
        skipped: false,
      }

      // Log hook_result event
      if (options.eventLogger && hookRunId) {
        options.eventLogger.logHookResult(
          result,
          options.hookType ?? "PostToolUse",
          hookRunId,
        )
      }

      resolve(result)
    })

    child.on("error", (err) => {
      const result: HookResult = {
        hook,
        exitCode: 127,
        stdout: "",
        stderr: `Failed to execute: ${err.message}`,
        durationMs: Date.now() - startTime,
        skipped: false,
      }

      // Log hook_result for errors too
      if (options.eventLogger && hookRunId) {
        options.eventLogger.logHookResult(
          result,
          options.hookType ?? "PostToolUse",
          hookRunId,
        )
      }

      resolve(result)
    })
  })
}

/**
 * Execute multiple hooks in parallel and collect all results.
 *
 * Runs all hooks as concurrent promises. Each hook runs independently;
 * one failure does not affect others.
 */
export async function executeHooksParallel(
  hooks: HookDefinition[],
  filePaths: string[],
  options: {
    cwd: string
    sessionId: string
    timeout?: number
    eventLogger?: BridgeEventLogger
    hookType?: string
  },
): Promise<HookResult[]> {
  if (hooks.length === 0) return []

  const results = await Promise.allSettled(
    hooks.map((hook) => executeHook(hook, filePaths, options)),
  )

  return results.map((r) =>
    r.status === "fulfilled"
      ? r.value
      : {
          hook: hooks[0], // fallback, shouldn't happen
          exitCode: 1,
          stdout: "",
          stderr: r.reason?.message ?? "Unknown error",
          durationMs: 0,
          skipped: false,
        },
  )
}
