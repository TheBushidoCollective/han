/**
 * Han Bridge for OpenCode
 *
 * This OpenCode plugin translates OpenCode's event system into Claude Code
 * hook invocations, enabling Han plugins to work seamlessly with OpenCode.
 *
 * Architecture:
 *   OpenCode event (e.g. session.created, tool.execute.after)
 *     -> event-map.ts translates to Claude Code event name (SessionStart, PostToolUse)
 *     -> payload.ts constructs Claude Code-compatible stdin JSON
 *     -> runner.ts executes `han hook dispatch|orchestrate <event>`
 *     -> hook output returned to OpenCode (for stop: can force continuation)
 *
 * Usage in opencode.json:
 *   { "plugin": ["opencode-plugin-han"] }
 *
 * Or as a local plugin:
 *   Copy src/index.ts to .opencode/plugins/han-bridge.ts
 */

import {
  EVENT_MAP,
  STOP_MAPPING,
  USER_PROMPT_MAPPING,
  type OpenCodeEvent,
} from "./event-map"
import {
  buildEventPayload,
  buildStopPayload,
  buildUserPromptPayload,
  type BridgeContext,
} from "./payload"
import { runHanCommand, checkHanAvailable } from "./runner"

/**
 * OpenCode plugin context provided by the runtime.
 * See: https://opencode.ai/docs/plugins/
 */
interface OpenCodePluginContext {
  client: unknown
  project: unknown
  directory: string
  worktree: string
  $: unknown
}

/**
 * OpenCode plugin hook return types.
 */
interface StopResult {
  continue: boolean
  assistantMessage?: string
}

type PluginHooks = {
  event?: (args: { event: OpenCodeEvent }) => Promise<void>
  stop?: (input: unknown) => Promise<StopResult | undefined | void>
  "chat.message"?: (message: unknown) => Promise<unknown>
}

const PREFIX = "[han-bridge]"

/**
 * Main OpenCode plugin entry point.
 *
 * When OpenCode loads this plugin, it:
 * 1. Checks that the han CLI is available
 * 2. Generates a session ID for the bridge lifetime
 * 3. Returns hook handlers that translate OpenCode events to han hook calls
 */
async function hanBridgePlugin(
  ctx: OpenCodePluginContext,
): Promise<PluginHooks> {
  const { directory, worktree } = ctx

  // Verify han is available before registering hooks
  const available = await checkHanAvailable(directory)
  if (!available) {
    console.error(
      `${PREFIX} han CLI not found.\n` +
        `Install: curl -fsSL https://han.guru/install.sh | bash\n` +
        `Or: npm install -g @thebushidocollective/han\n` +
        `Han hooks will not run in this OpenCode session.`,
    )
    return {}
  }

  // Generate a stable session ID for this OpenCode session.
  // All hooks in this session share the same ID for correlation.
  const sessionId = crypto.randomUUID()
  const bridgeCtx: BridgeContext = { directory, worktree, sessionId }

  /**
   * Execute a han hook command and return the result.
   */
  async function executeHook(
    command: "dispatch" | "orchestrate",
    claudeEvent: string,
    payload: Record<string, unknown>,
  ) {
    const args = ["hook", command, claudeEvent]
    return runHanCommand(args, payload, {
      cwd: directory,
      env: { HAN_SESSION_ID: sessionId },
    })
  }

  return {
    /**
     * Generic event handler - routes OpenCode events to Claude Code hooks.
     *
     * Maps:
     *   session.created          -> SessionStart (dispatch)
     *   tool.execute.before      -> PreToolUse (dispatch)
     *   tool.execute.after       -> PostToolUse (dispatch)
     *   experimental.session.compacting -> PreCompact (dispatch)
     */
    event: async ({ event }: { event: OpenCodeEvent }) => {
      const mapping = EVENT_MAP[event.type]
      if (!mapping) return

      const payload = buildEventPayload(mapping, event, bridgeCtx)

      try {
        await executeHook(mapping.command, mapping.claudeEvent, payload)
      } catch (err) {
        // Non-fatal: log and continue. A failing hook should not crash OpenCode.
        console.error(
          `${PREFIX} ${mapping.claudeEvent} hook error:`,
          err instanceof Error ? err.message : err,
        )
      }
    },

    /**
     * Stop hook - maps to Claude Code's Stop event.
     *
     * Han's Stop hooks run validation (linting, type checking, tests).
     * If any hook fails (non-zero exit), the bridge forces OpenCode to
     * continue the conversation, passing the validation output as context
     * so the agent can fix the issues.
     *
     * This is the most important mapping: it enables Han's validation
     * pipeline (biome, eslint, typescript, etc.) to work in OpenCode.
     */
    stop: async (_input: unknown) => {
      const payload = buildStopPayload(bridgeCtx)

      try {
        const result = await executeHook(
          STOP_MAPPING.command,
          STOP_MAPPING.claudeEvent,
          payload,
        )

        // If hooks reported issues, force the agent to continue and fix them
        if (result.exitCode !== 0) {
          const output = (result.stdout || result.stderr).trim()
          if (output) {
            return {
              continue: true,
              assistantMessage: output,
            }
          }
        }
      } catch (err) {
        console.error(
          `${PREFIX} Stop hook error:`,
          err instanceof Error ? err.message : err,
        )
      }

      // No issues found or hook didn't produce output - allow stop
      return undefined
    },

    /**
     * Chat message hook - maps to Claude Code's UserPromptSubmit event.
     *
     * Fires after the user submits a message but before the agent processes it.
     * Han's UserPromptSubmit hooks inject context (e.g. current datetime).
     * The message is returned unmodified; hook output goes to the console.
     */
    "chat.message": async (message: unknown) => {
      const payload = buildUserPromptPayload(message, bridgeCtx)

      try {
        await executeHook(
          USER_PROMPT_MAPPING.command,
          USER_PROMPT_MAPPING.claudeEvent,
          payload,
        )
      } catch (err) {
        console.error(
          `${PREFIX} UserPromptSubmit hook error:`,
          err instanceof Error ? err.message : err,
        )
      }

      // Return message unmodified - Han doesn't transform user messages
      return message
    },
  }
}

export default hanBridgePlugin
