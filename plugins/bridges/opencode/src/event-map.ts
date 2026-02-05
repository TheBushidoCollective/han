/**
 * Event mapping from OpenCode events to Claude Code hook events.
 *
 * OpenCode fires JS events to plugins; Claude Code fires shell-command hooks.
 * This module defines the translation table between the two systems.
 */

export interface OpenCodeEvent {
  type: string
  properties?: Record<string, unknown>
}

export interface EventMapping {
  /** The Claude Code hook event name (e.g. "Stop", "PreToolUse") */
  claudeEvent: string
  /**
   * Which han CLI subcommand to use:
   * - "dispatch" reads hooks.json from installed plugins (SessionStart, PreToolUse, etc.)
   * - "orchestrate" reads han-plugin.yml with dependency resolution (Stop, SubagentStop)
   */
  command: "dispatch" | "orchestrate"
  /** Extract tool/event-specific fields from the OpenCode event */
  extractPayload?: (event: OpenCodeEvent) => Record<string, unknown>
}

/**
 * Mapping of OpenCode event types (received via the `event` handler)
 * to Claude Code hook events.
 */
export const EVENT_MAP: Record<string, EventMapping> = {
  "session.created": {
    claudeEvent: "SessionStart",
    command: "dispatch",
  },
  "tool.execute.before": {
    claudeEvent: "PreToolUse",
    command: "dispatch",
    extractPayload: (event) => {
      const tool = event.properties?.tool as
        | { name?: string; input?: unknown }
        | undefined
      return {
        tool_name: tool?.name,
        tool_input: tool?.input,
      }
    },
  },
  "tool.execute.after": {
    claudeEvent: "PostToolUse",
    command: "dispatch",
    extractPayload: (event) => {
      const tool = event.properties?.tool as
        | { name?: string; input?: unknown; result?: unknown }
        | undefined
      return {
        tool_name: tool?.name,
        tool_input: tool?.input,
        tool_result: tool?.result,
      }
    },
  },
  "experimental.session.compacting": {
    claudeEvent: "PreCompact",
    command: "dispatch",
  },
}

/**
 * Stop event uses orchestration (dependency-resolved, phased execution)
 * because Stop hooks in Han are defined in han-plugin.yml, not hooks.json.
 */
export const STOP_MAPPING: EventMapping = {
  claudeEvent: "Stop",
  command: "orchestrate",
}

/**
 * UserPromptSubmit is triggered by OpenCode's chat.message hook,
 * which is a dedicated handler (not part of the generic event system).
 */
export const USER_PROMPT_MAPPING: EventMapping = {
  claudeEvent: "UserPromptSubmit",
  command: "dispatch",
}
