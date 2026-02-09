/**
 * Context injection for Gemini CLI sessions.
 *
 * Provides dynamic context that supplements the static GEMINI.md file.
 * GEMINI.md contains the core guidelines; this module adds runtime
 * information like skill/discipline counts and current datetime.
 *
 * SessionStart → systemMessage with session info
 * BeforeAgent → additionalContext with current datetime
 */

/**
 * Build session start context with capability summary.
 */
export function buildSessionContext(
  pluginCount: number,
  hookCount: number,
  skillCount: number,
  disciplineCount: number,
): string {
  const lines: string[] = [
    `Han bridge active: ${pluginCount} plugins, ${hookCount} hooks, ${skillCount} skills, ${disciplineCount} disciplines.`,
    "",
    "Validation hooks run automatically after file edits (AfterTool) and when you complete a turn (AfterAgent).",
    "If validation fails, fix the issues before continuing.",
  ]

  return lines.join("\n")
}

/**
 * Build per-prompt context injected via BeforeAgent.
 * Mirrors core plugin's UserPromptSubmit hook: current datetime.
 */
export function buildPromptContext(): string {
  const now = new Date()
  const dateStr = now.toLocaleString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  })

  return `Current local time: ${dateStr}`
}
