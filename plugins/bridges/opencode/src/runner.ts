/**
 * Hook runner: executes han CLI commands with stdin payload.
 *
 * Uses child_process.spawn for compatibility with both Bun and Node.js.
 * The han CLI reads a JSON payload from stdin to receive hook context.
 */

import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"

export interface HookResult {
  exitCode: number
  stdout: string
  stderr: string
}

/** Default timeout for hook execution (2 minutes) */
const DEFAULT_TIMEOUT = 120_000

/**
 * Resolve the han binary path.
 * Checks: PATH first, then ~/.claude/bin/han fallback.
 */
export function resolveHanBinary(): string {
  const localBin = join(homedir(), ".claude", "bin", "han")
  if (existsSync(localBin)) {
    return localBin
  }
  // Fall back to PATH lookup
  return "han"
}

/**
 * Execute a han CLI command, passing a JSON payload via stdin.
 *
 * @param args - CLI arguments (e.g. ["hook", "dispatch", "Stop"])
 * @param payload - JSON object to pipe to stdin
 * @param options - Execution options (cwd, timeout, env overrides)
 */
export async function runHanCommand(
  args: string[],
  payload: Record<string, unknown>,
  options: {
    cwd: string
    timeout?: number
    env?: Record<string, string>
  },
): Promise<HookResult> {
  const binary = resolveHanBinary()

  return new Promise((resolve) => {
    const proc = spawn(binary, args, {
      cwd: options.cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...options.env },
      timeout: options.timeout ?? DEFAULT_TIMEOUT,
    })

    const input = JSON.stringify(payload)
    proc.stdin.write(input)
    proc.stdin.end()

    let stdout = ""
    let stderr = ""

    proc.stdout.on("data", (data: Buffer) => {
      stdout += data.toString()
    })

    proc.stderr.on("data", (data: Buffer) => {
      stderr += data.toString()
    })

    proc.on("close", (code) => {
      resolve({ exitCode: code ?? 1, stdout, stderr })
    })

    proc.on("error", (err) => {
      resolve({
        exitCode: 127,
        stdout: "",
        stderr: `Failed to execute han: ${err.message}`,
      })
    })
  })
}

/**
 * Check if han CLI is available and working.
 */
export async function checkHanAvailable(cwd: string): Promise<boolean> {
  const result = await runHanCommand(["--version"], {}, { cwd, timeout: 5_000 })
  return result.exitCode === 0
}
