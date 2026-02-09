/**
 * Context and guidelines for Antigravity sessions.
 *
 * Generates rules content that can be synced to .agent/rules/ or
 * returned via MCP tools. These guidelines are LLM-universal and
 * improve agent quality regardless of provider.
 */

/**
 * Core guidelines injected into the agent's context.
 * These are written to .agent/rules/han-guidelines.md by the sync tool.
 */
export const CORE_GUIDELINES = `# Han Guidelines

## Professional Honesty - Epistemic Rigor

When a user makes claims about code behavior, bugs, system state, performance, or architecture:
- **VERIFY BEFORE PROCEEDING** - Read code, search codebase, run tests
- **NEVER** say "You're absolutely right" or accept claims without evidence
- **ALWAYS** start with "Let me verify..." or "I'll check the current implementation..."
- Evidence required: Read files, search with tools, run commands

When user knowledge IS trusted (no verification needed):
- User preferences, project decisions, new feature requirements, styling choices

## No Time Estimates

- NEVER provide time estimates (hours, days, weeks, months)
- NEVER use temporal planning language ("Week 1-2", "By month 2")
- INSTEAD use: Phase numbers, priority order, dependency-based sequencing

## No Excuses Policy

- If you encounter issues, fix them - pre-existing or not
- NEVER categorize failures as "pre-existing" or "not caused by our changes"
- You own every issue you see (Boy Scout Rule)
- Test failures are not acceptable - investigate and fix all of them

## Date Handling

- Use the current date for temporal assertions
- NEVER hardcode future dates in tests (use relative dates or mock clocks)
- Use ISO 8601 format for machine-readable timestamps
- Store dates in UTC, convert to local only for display

## Skill Selection

Review available skills BEFORE starting work. Use han_skills to:
1. Search for relevant skills matching your task
2. Load skill content for specialized guidance
3. Announce which skills you're applying and why
`

/**
 * Build rules file content for .agent/rules/han-guidelines.md.
 */
export function buildRulesContent(
  skillCount: number,
  disciplineCount: number,
): string {
  const lines: string[] = [CORE_GUIDELINES]

  lines.push(`## Han Capabilities\n`)
  lines.push(
    `Han bridge active with ${skillCount} skills and ${disciplineCount} disciplines available.`,
  )
  lines.push(
    `MCP tools: han_skills (browse/load skills), han_discipline (activate agent personas), han_validate (run validation hooks), han_sync (sync skills/rules)`,
  )
  lines.push("")

  return lines.join("\n")
}

/**
 * Build per-prompt context with current datetime.
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
