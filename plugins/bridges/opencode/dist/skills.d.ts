/**
 * Skill discovery and registration for OpenCode.
 *
 * Scans installed Han plugins for skills/ directories containing SKILL.md
 * files. Registers an OpenCode tool that lets the LLM list and load skills.
 *
 * OpenCode has its own skill system (.opencode/skills/) but this tool
 * gives the LLM access to Han's full skill library (400+ skills) without
 * requiring filesystem duplication.
 */
/**
 * Parsed skill metadata from SKILL.md frontmatter.
 */
export interface SkillInfo {
    /** Skill name (from frontmatter or directory name) */
    name: string;
    /** Human-readable description */
    description: string;
    /** Parent plugin name */
    pluginName: string;
    /** Allowed tools (empty = all) */
    allowedTools: string[];
    /** Full path to SKILL.md */
    filePath: string;
}
/**
 * Discover all skills from all resolved plugin paths.
 */
export declare function discoverAllSkills(resolvedPlugins: Map<string, string>): SkillInfo[];
/**
 * Load the full content of a skill's SKILL.md.
 */
export declare function loadSkillContent(skill: SkillInfo): string;
/**
 * Format a skill list for display (used by the han_skills tool).
 */
export declare function formatSkillList(skills: SkillInfo[], filter?: string): string;
