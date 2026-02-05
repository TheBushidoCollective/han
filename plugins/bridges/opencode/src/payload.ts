/**
 * Payload translation: constructs Claude Code-style stdin JSON
 * from OpenCode plugin context and events.
 *
 * Claude Code hooks receive context as a JSON object on stdin:
 * {
 *   session_id: string,
 *   hook_event_name: string,
 *   cwd: string,
 *   tool_name?: string,
 *   tool_input?: object,
 *   ...
 * }
 */

import type { OpenCodeEvent, EventMapping } from "./event-map"

export interface BridgeContext {
  directory: string
  worktree: string
  sessionId: string
}

/**
 * Build a Claude Code-compatible stdin payload from an OpenCode event.
 */
export function buildEventPayload(
  mapping: EventMapping,
  event: OpenCodeEvent,
  ctx: BridgeContext,
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    session_id: ctx.sessionId,
    hook_event_name: mapping.claudeEvent,
    cwd: ctx.directory,
  }

  if (mapping.extractPayload) {
    Object.assign(base, mapping.extractPayload(event))
  }

  return base
}

/**
 * Build payload for the Stop hook.
 */
export function buildStopPayload(ctx: BridgeContext): Record<string, unknown> {
  return {
    session_id: ctx.sessionId,
    hook_event_name: "Stop",
    cwd: ctx.directory,
  }
}

/**
 * Build payload for the UserPromptSubmit hook.
 */
export function buildUserPromptPayload(
  message: unknown,
  ctx: BridgeContext,
): Record<string, unknown> {
  return {
    session_id: ctx.sessionId,
    hook_event_name: "UserPromptSubmit",
    cwd: ctx.directory,
  }
}
