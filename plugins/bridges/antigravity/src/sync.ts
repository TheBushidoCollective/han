/**
 * Sync Han assets to Antigravity's native directories.
 *
 * Antigravity discovers skills and rules from:
 *   - .agent/skills/<name>/SKILL.md  (per-project skills)
 *   - .agent/rules/<name>.md         (per-project rules)
 *   - ~/.gemini/antigravity/skills/  (global skills)
 *
 * This module copies Han's skills and generates rules files so
 * Antigravity can discover them natively without MCP tool calls.
 * This is optional - the MCP tools (han_skills, han_discipline)
 * work without syncing.
 */

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
  rmSync,
  copyFileSync,
} from "node:fs"
import { join, basename } from "node:path"
import type { SkillInfo } from "./skills"
import type { DisciplineInfo } from "./disciplines"
import { buildRulesContent } from "./context"

const HAN_SYNC_MARKER = "<!-- managed by han bridge - do not edit -->"

/**
 * Sync skills to .agent/skills/ directory.
 *
 * Copies SKILL.md files from installed Han plugins into Antigravity's
 * workspace skills directory. Antigravity will discover them natively.
 *
 * @returns Number of skills synced
 */
export function syncSkills(
  projectDir: string,
  skills: SkillInfo[],
): { synced: number; removed: number } {
  const agentSkillsDir = join(projectDir, ".agent", "skills")
  mkdirSync(agentSkillsDir, { recursive: true })

  // Track which skill directories we manage
  const managedSkills = new Set<string>()
  let synced = 0

  for (const skill of skills) {
    const skillDir = join(agentSkillsDir, `han-${skill.pluginName}-${skill.name}`)
    managedSkills.add(basename(skillDir))

    mkdirSync(skillDir, { recursive: true })

    // Read source SKILL.md
    let content: string
    try {
      content = readFileSync(skill.filePath, "utf-8")
    } catch {
      continue
    }

    // Add managed marker to content
    const markedContent = `${HAN_SYNC_MARKER}\n${content}`

    const targetPath = join(skillDir, "SKILL.md")

    // Only write if content changed
    if (existsSync(targetPath)) {
      try {
        const existing = readFileSync(targetPath, "utf-8")
        if (existing === markedContent) continue
      } catch {
        // Re-write on read error
      }
    }

    writeFileSync(targetPath, markedContent)
    synced++
  }

  // Remove skills we previously synced but are no longer active
  let removed = 0
  try {
    const entries = readdirSync(agentSkillsDir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (!entry.name.startsWith("han-")) continue
      if (managedSkills.has(entry.name)) continue

      // Check if it has our marker before removing
      const skillMd = join(agentSkillsDir, entry.name, "SKILL.md")
      if (existsSync(skillMd)) {
        try {
          const content = readFileSync(skillMd, "utf-8")
          if (content.startsWith(HAN_SYNC_MARKER)) {
            rmSync(join(agentSkillsDir, entry.name), { recursive: true })
            removed++
          }
        } catch {
          // Skip if can't read
        }
      }
    }
  } catch {
    // Directory might not exist yet
  }

  return { synced, removed }
}

/**
 * Sync Han guidelines to .agent/rules/ directory.
 *
 * Generates a rules file with Han's core guidelines so Antigravity
 * injects them into the agent's context natively.
 *
 * @returns Whether the rules file was updated
 */
export function syncRules(
  projectDir: string,
  skillCount: number,
  disciplineCount: number,
): boolean {
  const rulesDir = join(projectDir, ".agent", "rules")
  mkdirSync(rulesDir, { recursive: true })

  const rulesPath = join(rulesDir, "han-guidelines.md")
  const content = `${HAN_SYNC_MARKER}\n${buildRulesContent(skillCount, disciplineCount)}`

  // Only write if changed
  if (existsSync(rulesPath)) {
    try {
      const existing = readFileSync(rulesPath, "utf-8")
      if (existing === content) return false
    } catch {
      // Re-write on read error
    }
  }

  writeFileSync(rulesPath, content)
  return true
}

/**
 * Generate MCP config entry for Han in Antigravity's mcp_config.json.
 *
 * Returns the JSON config that should be added to
 * ~/.gemini/antigravity/mcp_config.json.
 */
export function generateMcpConfig(projectDir: string): string {
  const config = {
    mcpServers: {
      han: {
        command: "npx",
        args: [
          "-y",
          "@thebushidocollective/antigravity-han-mcp",
          "--project-dir",
          projectDir,
        ],
      },
    },
  }

  return JSON.stringify(config, null, 2)
}

/**
 * Full sync: skills + rules + report.
 */
export function syncAll(
  projectDir: string,
  skills: SkillInfo[],
  disciplines: DisciplineInfo[],
): string {
  const skillResult = syncSkills(projectDir, skills)
  const rulesUpdated = syncRules(projectDir, skills.length, disciplines.length)

  const lines: string[] = ["Han sync complete:\n"]

  lines.push(`- Skills: ${skillResult.synced} synced to .agent/skills/`)
  if (skillResult.removed > 0) {
    lines.push(`  (${skillResult.removed} stale skills removed)`)
  }

  lines.push(`- Rules: ${rulesUpdated ? "updated" : "up to date"} at .agent/rules/han-guidelines.md`)
  lines.push(`\nAntigravity will now discover ${skills.length} skills natively.`)

  if (disciplines.length > 0) {
    lines.push(
      `\n${disciplines.length} disciplines available via han_discipline tool.`,
    )
  }

  return lines.join("\n")
}
