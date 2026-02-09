/**
 * Skill discovery for Gemini CLI bridge.
 *
 * Scans installed Han plugins for skills/ directories containing SKILL.md
 * files. Reports skill count for context injection.
 *
 * Note: Gemini CLI has its own native skill system (skills/SKILL.md in
 * extensions). Han skills are discovered for counting and context purposes
 * but are not re-registered as Gemini CLI skills to avoid duplication.
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
 * Returns the frontmatter fields and the remaining content.
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
    // Key-value: "name: value"
    const kvMatch = line.match(/^(\S+):\s*(.+)$/)
    if (kvMatch) {
      const [, key, value] = kvMatch
      meta[key] = value.replace(/^["']|["']$/g, "")
      currentKey = null
      continue
    }

    // Key with empty value (starts an array)
    const keyMatch = line.match(/^(\S+):\s*$/)
    if (keyMatch) {
      currentKey = keyMatch[1]
      meta[currentKey] = []
      continue
    }

    // Inline array: "key: []" or "key: [a, b]"
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

    // Array item: "  - value"
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
