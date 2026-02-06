/**
 * Han Bridge for OpenCode
 *
 * Translates OpenCode's JS/TS plugin events into Han hook executions,
 * enabling Han's validation pipeline to work inside OpenCode.
 *
 * Architecture:
 *
 *   tool.execute.after (Edit/Write)
 *     -> discovery.ts finds installed plugins' PostToolUse hooks
 *     -> matcher.ts filters by tool name + file pattern
 *     -> executor.ts runs matching hook commands as parallel promises
 *     -> formatter.ts structures results into actionable feedback
 *     -> client.session.prompt() notifies agent of issues
 *
 *   session.idle (agent finished)
 *     -> discovery.ts finds installed plugins' Stop hooks
 *     -> executor.ts runs matching hooks
 *     -> formatter.ts structures results
 *     -> client.session.prompt() re-prompts agent to fix issues
 *
 * Key difference from han's dispatch: hooks run as awaited promises,
 * not fire-and-forget. Results are collected, parsed, and delivered
 * as structured messages the agent can act on.
 */

import { discoverHooks, getHooksByEvent } from "./discovery"
import { matchPostToolUseHooks, matchStopHooks } from "./matcher"
import { executeHooksParallel } from "./executor"
import {
  formatInlineResults,
  formatNotificationResults,
  formatStopResults,
} from "./formatter"
import {
  mapToolName,
  type OpenCodePluginContext,
  type ToolEventInput,
  type ToolEventOutput,
  type OpenCodeEvent,
  type StopResult,
  type HookDefinition,
} from "./types"

const PREFIX = "[han]"

/**
 * Extract file path(s) from an OpenCode tool event.
 *
 * OpenCode provides tool output with title/output/metadata.
 * For edit/write tools, the file path is typically in the metadata
 * or can be inferred from the tool output.
 */
function extractFilePaths(
  input: ToolEventInput,
  output: ToolEventOutput,
): string[] {
  const paths: string[] = []

  // Check metadata for file path
  if (output.metadata) {
    const meta = output.metadata as Record<string, unknown>
    if (typeof meta.path === "string") paths.push(meta.path)
    if (typeof meta.file_path === "string") paths.push(meta.file_path)
    if (typeof meta.filePath === "string") paths.push(meta.filePath)
  }

  // Check title for file path (common pattern: "Edit: src/foo.ts")
  if (paths.length === 0 && output.title) {
    const titleMatch = output.title.match(
      /(?:edit|write|create|modify):\s*(.+)/i,
    )
    if (titleMatch) {
      paths.push(titleMatch[1].trim())
    }
  }

  return paths
}

/**
 * Main OpenCode plugin entry point.
 */
async function hanBridgePlugin(ctx: OpenCodePluginContext) {
  const { client, directory } = ctx

  // ─── Hook Discovery ──────────────────────────────────────────────────────
  // Discover all hooks at plugin init time. This reads settings files
  // and plugin configs once, not on every event.
  const allHooks = discoverHooks(directory)

  const postToolUseHooks = getHooksByEvent(allHooks, "PostToolUse")
  const stopHooks = getHooksByEvent(allHooks, "Stop")

  if (allHooks.length === 0) {
    console.error(
      `${PREFIX} No Han plugins with hooks found. ` +
        `Install plugins: han plugin install --auto`,
    )
    return {}
  }

  console.error(
    `${PREFIX} Discovered ${postToolUseHooks.length} PostToolUse hooks, ` +
      `${stopHooks.length} Stop hooks from ${new Set(allHooks.map((h) => h.pluginName)).size} plugins`,
  )

  // ─── Session State ───────────────────────────────────────────────────────
  const sessionId = crypto.randomUUID()

  // Track pending async validations to avoid duplicate notifications
  const pendingValidations = new Map<string, Promise<void>>()

  // ─── Hook Handlers ───────────────────────────────────────────────────────

  return {
    /**
     * tool.execute.after → PostToolUse hooks
     *
     * This is the PRIMARY validation path. When the agent edits a file,
     * we run matching validation hooks (biome, eslint, tsc, etc.) as
     * parallel promises and deliver results as notifications.
     *
     * Two feedback mechanisms:
     * 1. Inline: mutate tool output to append errors (immediate)
     * 2. Async: client.session.prompt() for detailed notifications
     */
    "tool.execute.after": async (
      input: ToolEventInput,
      output: ToolEventOutput,
    ) => {
      const claudeToolName = mapToolName(input.tool)
      const filePaths = extractFilePaths(input, output)

      if (filePaths.length === 0) return

      // Find hooks matching this tool + file
      const matching = matchPostToolUseHooks(
        postToolUseHooks,
        claudeToolName,
        filePaths[0],
        directory,
      )

      if (matching.length === 0) return

      // Run all matching hooks as parallel promises
      const validationKey = `${input.callID}-${filePaths.join(",")}`

      const validationPromise = (async () => {
        try {
          const results = await executeHooksParallel(matching, filePaths, {
            cwd: directory,
            sessionId,
          })

          // Inline feedback: append failures directly to tool output
          const inline = formatInlineResults(results)
          if (inline) {
            output.output += inline
          }

          // Async notification: send detailed results as a message
          const notification = formatNotificationResults(results, filePaths)
          if (notification) {
            try {
              await client.session.prompt({
                path: { id: input.sessionID },
                body: {
                  noReply: true,
                  parts: [{ type: "text", text: notification }],
                },
              })
            } catch (err) {
              // Session may be busy; inline feedback is the fallback
              console.error(
                `${PREFIX} Could not send notification:`,
                err instanceof Error ? err.message : err,
              )
            }
          }
        } catch (err) {
          console.error(
            `${PREFIX} PostToolUse hook error:`,
            err instanceof Error ? err.message : err,
          )
        } finally {
          pendingValidations.delete(validationKey)
        }
      })()

      pendingValidations.set(validationKey, validationPromise)
    },

    /**
     * Generic event handler for session lifecycle events.
     *
     * session.idle → Stop hooks (broader project validation)
     * session.created → SessionStart (future: context injection)
     */
    event: async ({ event }: { event: OpenCodeEvent }) => {
      if (event.type === "session.idle") {
        const eventSessionId = event.properties?.sessionID as string | undefined

        // Wait for any pending PostToolUse validations to finish
        if (pendingValidations.size > 0) {
          await Promise.allSettled(pendingValidations.values())
        }

        // Run Stop hooks for full project validation
        const matching = matchStopHooks(stopHooks, directory)
        if (matching.length === 0) return

        try {
          const results = await executeHooksParallel(matching, [], {
            cwd: directory,
            sessionId,
            timeout: 120_000, // Stop hooks get more time
          })

          const message = formatStopResults(results)
          if (message && eventSessionId) {
            await client.session.prompt({
              path: { id: eventSessionId },
              body: {
                parts: [{ type: "text", text: message }],
              },
            })
          }
        } catch (err) {
          console.error(
            `${PREFIX} Stop hook error:`,
            err instanceof Error ? err.message : err,
          )
        }
      }
    },

    /**
     * Stop hook - backup validation gate.
     *
     * OpenCode calls this when the agent signals completion.
     * If Stop hooks find issues, forces the agent to continue.
     *
     * Note: session.idle handles the primary Stop flow. This is
     * a secondary gate for cases where session.idle doesn't fire
     * or when we need to force continuation.
     */
    stop: async (): Promise<StopResult | undefined> => {
      const matching = matchStopHooks(stopHooks, directory)
      if (matching.length === 0) return undefined

      try {
        const results = await executeHooksParallel(matching, [], {
          cwd: directory,
          sessionId,
          timeout: 120_000,
        })

        const message = formatStopResults(results)
        if (message) {
          return {
            continue: true,
            assistantMessage: message,
          }
        }
      } catch (err) {
        console.error(
          `${PREFIX} Stop validation error:`,
          err instanceof Error ? err.message : err,
        )
      }

      return undefined
    },
  }
}

export default hanBridgePlugin
