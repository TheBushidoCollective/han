/**
 * Skill discovery and registration for Antigravity.
 *
 * Scans installed Han plugins for skills/ directories containing SKILL.md
 * files. Exposes via MCP tools so the agent can list and load skills.
 *
 * Antigravity has its own skill system (.agent/skills/) using the same
 * SKILL.md format. The han_sync tool can optionally copy skills there
 * for native discovery. This module provides on-demand access without
 * filesystem duplication.
 */

import { readFileSync, existsSync, readdirSync } from "node:fs"
import { join } from "node:path"

/**
 * Parsed skill metadata from SKILL.md frontmatter.
 */
export interface SkillInfo {
  /** Skill name (from frontmatter or directory name) */
  name: string
  /** Human-readable description */
  description: string
  /** Parent plugin name */
  pluginName: string
  /** Allowed tools (empty = all) */
  allowedTools: string[]
  /** Full path to SKILL.md */
  filePath: string
}

/**
 * Parse YAML frontmatter from a SKILL.md file.
 */
function parseFrontmatter(content: string): {
  meta: Record<string, unknown>
  body: string
} {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!match) return { meta: {}, body: content }

  const meta: Record<string, unknown> = {}
  const lines = match[1].split("\n")
  let currentKey: string | null = null

  for (const line of lines) {
    const kvMatch = line.match(/^(\S+):\s*(.+)$/)
    if (kvMatch) {
      const [, key, value] = kvMatch
      meta[key] = value.replace(/^["']|["']$/g, "")
      currentKey = null
      continue
    }

    const keyMatch = line.match(/^(\S+):\s*$/)
    if (keyMatch) {
      currentKey = keyMatch[1]
      meta[currentKey] = []
      continue
    }

    const inlineArrayMatch = line.match(/^(\S+):\s*\[([^\]]*)\]$/)
    if (inlineArrayMatch) {
      const [, key, items] = inlineArrayMatch
      meta[key] = items
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean)
      currentKey = null
      continue
    }

    const arrayMatch = line.match(/^\s*-\s+(.+)$/)
    if (arrayMatch && currentKey && Array.isArray(meta[currentKey])) {
      ;(meta[currentKey] as string[]).push(
        arrayMatch[1].replace(/^["']|["']$/g, ""),
      )
    }
  }

  return { meta, body: match[2] }
}

/**
 * Discover all skills from a plugin directory.
 */
function discoverPluginSkills(
  pluginName: string,
  pluginRoot: string,
): SkillInfo[] {
  const skillsDir = join(pluginRoot, "skills")
  if (!existsSync(skillsDir)) return []

  const skills: SkillInfo[] = []

  try {
    const entries = readdirSync(skillsDir, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const skillMd = join(skillsDir, entry.name, "SKILL.md")
      if (!existsSync(skillMd)) continue

      try {
        const content = readFileSync(skillMd, "utf-8")
        const { meta } = parseFrontmatter(content)

        skills.push({
          name: (meta.name as string) || entry.name,
          description: (meta.description as string) || "",
          pluginName,
          allowedTools: Array.isArray(meta["allowed-tools"])
            ? (meta["allowed-tools"] as string[])
            : [],
          filePath: skillMd,
        })
      } catch {
        // Skip unreadable skills
      }
    }
  } catch {
    // Skills directory not readable
  }

  return skills
}

/**
 * Discover all skills from all resolved plugin paths.
 */
export function discoverAllSkills(
  resolvedPlugins: Map<string, string>,
): SkillInfo[] {
  const allSkills: SkillInfo[] = []

  for (const [pluginName, pluginRoot] of resolvedPlugins) {
    const skills = discoverPluginSkills(pluginName, pluginRoot)
    allSkills.push(...skills)
  }

  return allSkills
}

/**
 * Load the full content of a skill's SKILL.md.
 */
export function loadSkillContent(skill: SkillInfo): string {
  try {
    return readFileSync(skill.filePath, "utf-8")
  } catch {
    return `Error: Could not read skill file at ${skill.filePath}`
  }
}

/**
 * Format a skill list for display.
 */
export function formatSkillList(
  skills: SkillInfo[],
  filter?: string,
): string {
  let filtered = skills

  if (filter) {
    const lower = filter.toLowerCase()
    filtered = skills.filter(
      (s) =>
        s.name.toLowerCase().includes(lower) ||
        s.description.toLowerCase().includes(lower) ||
        s.pluginName.toLowerCase().includes(lower),
    )
  }

  if (filtered.length === 0) {
    return filter
      ? `No skills matching "${filter}". Try a broader search term.`
      : "No Han skills discovered. Install plugins: han plugin install --auto"
  }

  // Group by plugin
  const byPlugin = new Map<string, SkillInfo[]>()
  for (const skill of filtered) {
    const existing = byPlugin.get(skill.pluginName) || []
    existing.push(skill)
    byPlugin.set(skill.pluginName, existing)
  }

  const lines: string[] = [`Found ${filtered.length} skills:\n`]

  for (const [plugin, pluginSkills] of byPlugin) {
    lines.push(`## ${plugin}`)
    for (const skill of pluginSkills) {
      lines.push(`- **${skill.name}**: ${skill.description || "(no description)"}`)
    }
    lines.push("")
  }

  lines.push(
    `\nUse han_skills with action="load" and skill="<name>" to load a skill's full content.`,
  )

  return lines.join("\n")
}
