#!/usr/bin/env bun
/**
 * Han Bridge for Kiro CLI
 *
 * CLI entry point called by Kiro's hook system. Each Kiro hook event
 * dispatches to a handler that discovers, matches, and executes Han
 * validation hooks.
 *
 * Unlike the OpenCode bridge (in-process JS plugin), this is a shell
 * command that Kiro invokes. It reads JSON from stdin, runs Han hooks,
 * and outputs results to stdout/stderr with appropriate exit codes.
 *
 * Usage (from Kiro agent config):
 *   "command": "npx kiro-plugin-han <event>"
 *
 * Events:
 *   agent-spawn        -> SessionStart (output context to stdout)
 *   user-prompt-submit -> UserPromptSubmit (output datetime to stdout)
 *   pre-tool-use       -> PreToolUse (exit 2 to block, stderr for reason)
 *   post-tool-use      -> PostToolUse (stdout for validation results)
 *   stop               -> Stop (stdout for validation, exit 1 if failures)
 *
 * Architecture:
 *
 *   Kiro fires hook event
 *     -> stdin JSON payload { hook_event_name, cwd, tool_name, tool_input }
 *     -> bridge reads payload, maps Kiro tool names to Claude Code names
 *     -> discovery.ts finds installed plugins' hooks
 *     -> matcher.ts filters by tool name + file pattern
 *     -> executor.ts runs matching hook commands as parallel promises
 *     -> formatter.ts structures results
 *     -> stdout/stderr output + exit code
 */

import { discoverHooks, resolvePluginPaths, getHooksByEvent } from "./discovery"
import { matchPostToolUseHooks, matchStopHooks } from "./matcher"
import { executeHooksParallel } from "./executor"
import { invalidateFile } from "./cache"
import {
  formatPostToolResults,
  formatPreToolResults,
  formatStopResults,
} from "./formatter"
import {
  mapToolName,
  isFileWriteTool,
  type KiroHookPayload,
} from "./types"
import { BridgeEventLogger } from "./events"
import {
  discoverAllSkills,
  formatSkillList,
} from "./skills"
import {
  discoverDisciplines,
  formatDisciplineList,
} from "./disciplines"
import { buildSessionContext, buildPromptContext } from "./context"

const PREFIX = "[han]"

/**
 * Read JSON payload from stdin.
 * Kiro passes hook context as JSON via stdin.
 */
async function readStdin(): Promise<KiroHookPayload> {
  const chunks: Buffer[] = []

  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer)
  }

  const raw = Buffer.concat(chunks).toString("utf-8").trim()
  if (!raw) {
    return { hook_event_name: "", cwd: process.cwd() }
  }

  try {
    return JSON.parse(raw) as KiroHookPayload
  } catch {
    console.error(`${PREFIX} Failed to parse stdin JSON`)
    return { hook_event_name: "", cwd: process.cwd() }
  }
}

/**
 * Extract file path(s) from Kiro tool input.
 *
 * Kiro's fs_write tool passes file_path in tool_input.
 */
function extractFilePaths(payload: KiroHookPayload): string[] {
  const paths: string[] = []

  if (payload.tool_input) {
    const input = payload.tool_input
    if (typeof input.file_path === "string") paths.push(input.file_path)
    if (typeof input.filePath === "string") paths.push(input.filePath)
    if (typeof input.path === "string") paths.push(input.path)
  }

  if (payload.tool_response) {
    const resp = payload.tool_response
    if (typeof resp.file_path === "string" && !paths.includes(resp.file_path)) {
      paths.push(resp.file_path)
    }
  }

  return paths
}

/**
 * Start the Han coordinator daemon in the background.
 */
function startCoordinator(watchDir: string): void {
  try {
    const { spawn } = require("node:child_process") as typeof import("node:child_process")

    const child = spawn(
      "han",
      ["coordinator", "ensure", "--background", "--watch-path", watchDir],
      {
        stdio: "ignore",
        detached: true,
        env: {
          ...process.env,
          HAN_PROVIDER: "kiro",
        },
      },
    )

    child.unref()
    console.error(`${PREFIX} Coordinator ensure started (watch: ${watchDir})`)
  } catch {
    console.error(
      `${PREFIX} Could not start coordinator (han CLI not found). ` +
        `Browse UI won't show Kiro sessions.`,
    )
  }
}

// ─── Event Handlers ─────────────────────────────────────────────────────────

/**
 * Handle agentSpawn event (SessionStart equivalent).
 * Outputs core guidelines and capability context to stdout.
 */
async function handleAgentSpawn(payload: KiroHookPayload): Promise<void> {
  const directory = payload.cwd || process.cwd()
  const resolvedPlugins = resolvePluginPaths(directory)
  const allSkills = discoverAllSkills(resolvedPlugins)
  const allDisciplines = discoverDisciplines(resolvedPlugins, allSkills)

  const context = buildSessionContext(allSkills.length, allDisciplines.length)
  process.stdout.write(context)
}

/**
 * Handle userPromptSubmit event.
 * Outputs current datetime to stdout.
 */
async function handleUserPromptSubmit(_payload: KiroHookPayload): Promise<void> {
  const context = buildPromptContext()
  process.stdout.write(context)
}

/**
 * Handle preToolUse event.
 *
 * Runs PreToolUse hooks. Uses Kiro's exit code convention:
 * - Exit 0: Allow tool execution
 * - Exit 2: Block tool execution, stderr sent to LLM
 * - Other: Show stderr warning, allow execution
 */
async function handlePreToolUse(payload: KiroHookPayload): Promise<void> {
  const directory = payload.cwd || process.cwd()
  const kiroToolName = payload.tool_name ?? ""
  const claudeToolName = mapToolName(kiroToolName)

  const sessionId = process.env.HAN_SESSION_ID ?? crypto.randomUUID()
  const eventLogger = new BridgeEventLogger(sessionId, directory)

  const allHooks = discoverHooks(directory)
  const preToolUseHooks = getHooksByEvent(allHooks, "PreToolUse")

  if (preToolUseHooks.length === 0) return

  const matching = preToolUseHooks.filter((h) => {
    if (!h.toolFilter) return true
    return h.toolFilter.includes(claudeToolName)
  })

  if (matching.length === 0) return

  const results = await executeHooksParallel(matching, [], {
    cwd: directory,
    sessionId,
    eventLogger,
    hookType: "PreToolUse",
  })

  eventLogger.flush()

  // Check for failures - use exit code 2 to block execution
  const message = formatPreToolResults(results)
  if (message) {
    process.stderr.write(message)
    process.exit(2)
  }
}

/**
 * Handle postToolUse event (primary validation path).
 *
 * Runs PostToolUse validation hooks when the agent edits files.
 * Results go to stdout for the agent to see.
 */
async function handlePostToolUse(payload: KiroHookPayload): Promise<void> {
  const directory = payload.cwd || process.cwd()
  const kiroToolName = payload.tool_name ?? ""
  const claudeToolName = mapToolName(kiroToolName)
  const filePaths = extractFilePaths(payload)

  if (filePaths.length === 0) return

  const sessionId = process.env.HAN_SESSION_ID ?? crypto.randomUUID()
  const eventLogger = new BridgeEventLogger(sessionId, directory)

  // Log file changes and invalidate cache
  for (const fp of filePaths) {
    eventLogger.logFileChange(claudeToolName, fp)
    invalidateFile(fp)
  }

  const allHooks = discoverHooks(directory)
  const postToolUseHooks = getHooksByEvent(allHooks, "PostToolUse")

  // Find hooks matching this tool + file
  const matching = matchPostToolUseHooks(
    postToolUseHooks,
    claudeToolName,
    filePaths[0],
    directory,
  )

  if (matching.length === 0) return

  const results = await executeHooksParallel(matching, filePaths, {
    cwd: directory,
    sessionId,
    eventLogger,
    hookType: "PostToolUse",
  })

  eventLogger.flush()

  const message = formatPostToolResults(results)
  if (message) {
    process.stdout.write(message)
  }
}

/**
 * Handle stop event (full project validation).
 *
 * Runs Stop hooks for project-wide validation.
 * Non-zero exit code tells Kiro the agent should continue fixing.
 */
async function handleStop(payload: KiroHookPayload): Promise<void> {
  const directory = payload.cwd || process.cwd()
  const sessionId = process.env.HAN_SESSION_ID ?? crypto.randomUUID()
  const eventLogger = new BridgeEventLogger(sessionId, directory)

  const allHooks = discoverHooks(directory)
  const stopHooks = getHooksByEvent(allHooks, "Stop")
  const matching = matchStopHooks(stopHooks, directory)

  if (matching.length === 0) return

  const results = await executeHooksParallel(matching, [], {
    cwd: directory,
    sessionId,
    timeout: 120_000,
    eventLogger,
    hookType: "Stop",
  })

  eventLogger.flush()

  const message = formatStopResults(results)
  if (message) {
    process.stdout.write(message)
    process.exit(1)
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const event = process.argv[2]

  if (!event) {
    console.error(`${PREFIX} Usage: kiro-plugin-han <event>`)
    console.error(`${PREFIX} Events: agent-spawn, user-prompt-submit, pre-tool-use, post-tool-use, stop`)
    process.exit(1)
  }

  // Set provider env for child processes
  process.env.HAN_PROVIDER = "kiro"

  // Generate a session ID if not already set
  if (!process.env.HAN_SESSION_ID) {
    process.env.HAN_SESSION_ID = crypto.randomUUID()
  }

  // Start coordinator on first invocation (agent-spawn)
  if (event === "agent-spawn") {
    const cwd = process.cwd()
    const eventLogger = new BridgeEventLogger(process.env.HAN_SESSION_ID, cwd)
    startCoordinator(eventLogger.getWatchDir())
  }

  const payload = await readStdin()

  try {
    switch (event) {
      case "agent-spawn":
        await handleAgentSpawn(payload)
        break
      case "user-prompt-submit":
        await handleUserPromptSubmit(payload)
        break
      case "pre-tool-use":
        await handlePreToolUse(payload)
        break
      case "post-tool-use":
        await handlePostToolUse(payload)
        break
      case "stop":
        await handleStop(payload)
        break
      default:
        console.error(`${PREFIX} Unknown event: ${event}`)
        process.exit(1)
    }
  } catch (err) {
    console.error(
      `${PREFIX} Error handling ${event}:`,
      err instanceof Error ? err.message : err,
    )
    process.exit(1)
  }
}

main()
