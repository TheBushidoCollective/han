/**
 * Context injection for Codex CLI sessions.
 *
 * Replicates the core plugin's SessionStart and UserPromptSubmit
 * context injection for Codex. These guidelines are LLM-universal
 * (not Claude-specific) and improve agent quality regardless of provider.
 *
 * Codex injects context via AGENTS.md and config.toml hooks.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Core guidelines that are always injected into the system prompt.
 * These come from plugins/core/hooks/ markdown files.
 * We inline the key points rather than reading files at runtime
 * (the bridge may not be in the han repo).
 */
const CORE_GUIDELINES = `<han-guidelines>

## Professional Honesty - Epistemic Rigor

When a user makes claims about code behavior, bugs, system state, performance, or architecture:
- **VERIFY BEFORE PROCEEDING** - Read code, search codebase, run tests
- **NEVER** say "You're absolutely right" or accept claims without evidence
- **ALWAYS** start with "Let me verify..." or "I'll check the current implementation..."
- Evidence required: Read files, search with Grep/Glob, run commands

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

- Use the injected current date for temporal assertions
- NEVER hardcode future dates in tests (use relative dates or mock clocks)
- Use ISO 8601 format for machine-readable timestamps
- Store dates in UTC, convert to local only for display

## Skill Selection

Review available skills BEFORE starting work. Use han_skills to:
1. Search for relevant skills matching your task
2. Load skill content for specialized guidance
3. Announce which skills you're applying and why

</han-guidelines>`;

/**
 * Build the full system prompt context for a Codex session.
 * This is injected via AGENTS.md or config.toml system instructions.
 */
export function buildSessionContext(
  skillCount: number,
  disciplineCount: number
): string {
  const lines: string[] = [CORE_GUIDELINES];

  // Summary of available capabilities
  lines.push(`<han-capabilities>`);
  lines.push(
    `Han bridge active with ${skillCount} skills and ${disciplineCount} disciplines available.`
  );
  lines.push(
    `Tools: han_skills (browse/load skills), han_discipline (activate agent personas)`
  );
  lines.push(`</han-capabilities>`);

  return lines.join('\n');
}

/**
 * Build per-prompt context injected on each user message.
 * Mirrors core plugin's UserPromptSubmit hook: current datetime.
 */
export function buildPromptContext(): string {
  const now = new Date();
  const dateStr = now.toLocaleString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  });

  return `Current local time: ${dateStr}`;
}

/**
 * Try to load a guideline file from the core plugin if available.
 * Falls back to null if the file doesn't exist (bridge not in han repo).
 */
export function loadGuideline(
  pluginPaths: Map<string, string>,
  fileName: string
): string | null {
  const corePath = pluginPaths.get('core');
  if (!corePath) return null;

  const filePath = join(corePath, 'hooks', fileName);
  if (!existsSync(filePath)) return null;

  try {
    return readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}
