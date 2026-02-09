/**
 * Discipline (agent) discovery for Gemini CLI bridge.
 *
 * Han's discipline plugins define specialized agent personas (frontend,
 * backend, SRE, security, etc.). This module discovers available disciplines
 * for counting and context injection purposes.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SkillInfo } from './skills';

/**
 * Discipline metadata parsed from a discipline plugin.
 */
export interface DisciplineInfo {
  /** Discipline name (e.g. "frontend", "sre", "security") */
  name: string;
  /** Description from plugin.json */
  description: string;
  /** Plugin root directory */
  pluginRoot: string;
  /** Skills provided by this discipline */
  skills: SkillInfo[];
}

/**
 * Parse plugin.json for discipline metadata.
 */
function parsePluginJson(
  pluginRoot: string
): { name: string; description: string } | null {
  const pluginJsonPath = join(pluginRoot, '.claude-plugin', 'plugin.json');
  if (!existsSync(pluginJsonPath)) return null;

  try {
    const content = readFileSync(pluginJsonPath, 'utf-8');
    const json = JSON.parse(content);
    return {
      name: json.name ?? '',
      description: json.description ?? '',
    };
  } catch {
    return null;
  }
}

/**
 * Check if a plugin is a discipline plugin by its directory structure.
 * Discipline plugins live in plugins/disciplines/.
 */
function isDisciplinePlugin(pluginRoot: string): boolean {
  return (
    pluginRoot.includes('/disciplines/') ||
    pluginRoot.includes('\\disciplines\\')
  );
}

/**
 * Discover all discipline plugins from resolved plugin paths.
 */
export function discoverDisciplines(
  resolvedPlugins: Map<string, string>,
  allSkills: SkillInfo[]
): DisciplineInfo[] {
  const disciplines: DisciplineInfo[] = [];

  for (const [pluginName, pluginRoot] of resolvedPlugins) {
    if (!isDisciplinePlugin(pluginRoot)) continue;

    const meta = parsePluginJson(pluginRoot);
    if (!meta) continue;

    // Find skills belonging to this discipline
    const disciplineSkills = allSkills.filter(
      (s) => s.pluginName === pluginName
    );

    disciplines.push({
      name: pluginName,
      description: meta.description,
      pluginRoot,
      skills: disciplineSkills,
    });
  }

  return disciplines;
}
