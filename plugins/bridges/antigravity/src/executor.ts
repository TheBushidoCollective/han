/**
 * Promise-based hook executor.
 *
 * Runs hook commands as child processes, capturing stdout/stderr/exit code.
 * Results are collected and returned for formatting into MCP tool responses.
 */

import { spawn } from "node:child_process"
import type { HookDefinition, HookResult } from "./types"
import { shouldSkipHook, recordSuccess } from "./cache"
import type { BridgeEventLogger } from "./events"

const DEFAULT_TIMEOUT = 60_000

/**
 * Execute a single hook command as a promise.
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

  // Check cache
  if (filePaths.length > 0) {
    const allCached = filePaths.every((fp) =>
      shouldSkipHook(hook.pluginName, hook.name, fp),
    )
    if (allCached) {
      return Promise.resolve({
        hook,
        exitCode: 0,
        stdout: "",
        stderr: "",
        durationMs: 0,
        skipped: true,
      })
    }
  }

  // Substitute variables
  const filesArg = filePaths.join(" ")
  let command = hook.command.replace(/\$\{HAN_FILES\}/g, filesArg)
  command = command.replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, hook.pluginRoot)

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
    options.hookType ?? "Stop",
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
        HAN_PROVIDER: "antigravity",
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

      if (options.eventLogger && hookRunId) {
        options.eventLogger.logHookResult(
          result,
          options.hookType ?? "Stop",
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

      if (options.eventLogger && hookRunId) {
        options.eventLogger.logHookResult(
          result,
          options.hookType ?? "Stop",
          hookRunId,
        )
      }

      resolve(result)
    })
  })
}

/**
 * Execute multiple hooks in parallel and collect all results.
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
          hook: hooks[0],
          exitCode: 1,
          stdout: "",
          stderr: r.reason?.message ?? "Unknown error",
          durationMs: 0,
          skipped: false,
        },
  )
}
