/**
 * Discipline (agent) discovery for Kiro.
 *
 * Han's discipline plugins define specialized agent personas (frontend,
 * backend, SRE, security, etc.) with curated skill sets. This module
 * discovers available disciplines for context injection.
 */

import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import type { SkillInfo } from "./skills"

/**
 * Discipline metadata parsed from a discipline plugin.
 */
export interface DisciplineInfo {
  /** Discipline name (e.g. "frontend", "sre", "security") */
  name: string
  /** Description from plugin.json */
  description: string
  /** Plugin root directory */
  pluginRoot: string
  /** Skills provided by this discipline */
  skills: SkillInfo[]
}

/**
 * Parse plugin.json for discipline metadata.
 */
function parsePluginJson(
  pluginRoot: string,
): { name: string; description: string } | null {
  const pluginJsonPath = join(pluginRoot, ".claude-plugin", "plugin.json")
  if (!existsSync(pluginJsonPath)) return null

  try {
    const content = readFileSync(pluginJsonPath, "utf-8")
    const json = JSON.parse(content)
    return {
      name: json.name ?? "",
      description: json.description ?? "",
    }
  } catch {
    return null
  }
}

/**
 * Check if a plugin is a discipline plugin by its directory structure.
 * Discipline plugins live in plugins/disciplines/.
 */
function isDisciplinePlugin(pluginRoot: string): boolean {
  return pluginRoot.includes("/disciplines/") || pluginRoot.includes("\\disciplines\\")
}

/**
 * Discover all discipline plugins from resolved plugin paths.
 */
export function discoverDisciplines(
  resolvedPlugins: Map<string, string>,
  allSkills: SkillInfo[],
): DisciplineInfo[] {
  const disciplines: DisciplineInfo[] = []

  for (const [pluginName, pluginRoot] of resolvedPlugins) {
    if (!isDisciplinePlugin(pluginRoot)) continue

    const meta = parsePluginJson(pluginRoot)
    if (!meta) continue

    // Find skills belonging to this discipline
    const disciplineSkills = allSkills.filter(
      (s) => s.pluginName === pluginName,
    )

    disciplines.push({
      name: pluginName,
      description: meta.description,
      pluginRoot,
      skills: disciplineSkills,
    })
  }

  return disciplines
}

/**
 * Format discipline list for display.
 */
export function formatDisciplineList(disciplines: DisciplineInfo[]): string {
  if (disciplines.length === 0) {
    return "No discipline plugins discovered. Install with: han plugin install --auto"
  }

  const lines: string[] = [`Available disciplines (${disciplines.length}):\n`]

  for (const d of disciplines) {
    const skillCount = d.skills.length
    lines.push(
      `- **${d.name}**: ${d.description || "(no description)"}` +
        (skillCount > 0 ? ` (${skillCount} skills)` : ""),
    )
  }

  lines.push(
    `\nUse han_discipline with action="activate" and discipline="<name>" to activate a discipline.`,
  )

  return lines.join("\n")
}

/**
 * Build system prompt context for an active discipline.
 */
export function buildDisciplineContext(discipline: DisciplineInfo): string {
  const lines: string[] = [
    `<han-discipline name="${discipline.name}">`,
    `You are operating as a **${discipline.name}** specialist.`,
    discipline.description ? `\n${discipline.description}` : "",
  ]

  if (discipline.skills.length > 0) {
    lines.push("\n## Available Skills\n")
    lines.push(
      "The following specialized skills are available for this discipline. " +
        "Use han_skills to load any skill's full content when needed:\n",
    )
    for (const skill of discipline.skills) {
      lines.push(`- **${skill.name}**: ${skill.description || "(no description)"}`)
    }
  }

  lines.push("</han-discipline>")

  return lines.join("\n")
}
