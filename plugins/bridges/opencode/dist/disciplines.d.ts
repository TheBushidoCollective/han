/**
 * Discipline (agent) discovery and context injection for OpenCode.
 *
 * Han's discipline plugins define specialized agent personas (frontend,
 * backend, SRE, security, etc.) with curated skill sets. This module
 * discovers available disciplines and injects their context into
 * OpenCode's system prompt via experimental.chat.system.transform.
 *
 * The LLM can switch disciplines via the han_discipline tool, which
 * changes what gets injected into the system prompt on subsequent calls.
 */
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
 * Discover all discipline plugins from resolved plugin paths.
 */
export declare function discoverDisciplines(resolvedPlugins: Map<string, string>, allSkills: SkillInfo[]): DisciplineInfo[];
/**
 * Format discipline list for the han_discipline tool.
 */
export declare function formatDisciplineList(disciplines: DisciplineInfo[]): string;
/**
 * Build system prompt context for an active discipline.
 * This gets injected via experimental.chat.system.transform.
 */
export declare function buildDisciplineContext(discipline: DisciplineInfo): string;
