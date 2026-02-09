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
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
/**
 * Parse YAML frontmatter from a SKILL.md file.
 * Returns the frontmatter fields and the remaining content.
 */
function parseFrontmatter(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!match)
        return { meta: {}, body: content };
    const meta = {};
    const lines = match[1].split('\n');
    let currentKey = null;
    for (const line of lines) {
        // Key-value: "name: value"
        const kvMatch = line.match(/^(\S+):\s*(.+)$/);
        if (kvMatch) {
            const [, key, value] = kvMatch;
            meta[key] = value.replace(/^["']|["']$/g, '');
            currentKey = null;
            continue;
        }
        // Key with empty value (starts an array)
        const keyMatch = line.match(/^(\S+):\s*$/);
        if (keyMatch) {
            currentKey = keyMatch[1];
            meta[currentKey] = [];
            continue;
        }
        // Inline array: "key: []" or "key: [a, b]"
        const inlineArrayMatch = line.match(/^(\S+):\s*\[([^\]]*)\]$/);
        if (inlineArrayMatch) {
            const [, key, items] = inlineArrayMatch;
            meta[key] = items
                .split(',')
                .map((s) => s.trim().replace(/^["']|["']$/g, ''))
                .filter(Boolean);
            currentKey = null;
            continue;
        }
        // Array item: "  - value"
        const arrayMatch = line.match(/^\s*-\s+(.+)$/);
        if (arrayMatch && currentKey && Array.isArray(meta[currentKey])) {
            meta[currentKey].push(arrayMatch[1].replace(/^["']|["']$/g, ''));
        }
    }
    return { meta, body: match[2] };
}
/**
 * Discover all skills from a plugin directory.
 */
function discoverPluginSkills(pluginName, pluginRoot) {
    const skillsDir = join(pluginRoot, 'skills');
    if (!existsSync(skillsDir))
        return [];
    const skills = [];
    try {
        const entries = readdirSync(skillsDir, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory())
                continue;
            const skillMd = join(skillsDir, entry.name, 'SKILL.md');
            if (!existsSync(skillMd))
                continue;
            try {
                const content = readFileSync(skillMd, 'utf-8');
                const { meta } = parseFrontmatter(content);
                skills.push({
                    name: meta.name || entry.name,
                    description: meta.description || '',
                    pluginName,
                    allowedTools: Array.isArray(meta['allowed-tools'])
                        ? meta['allowed-tools']
                        : [],
                    filePath: skillMd,
                });
            }
            catch {
                // Skip unreadable skills
            }
        }
    }
    catch {
        // Skills directory not readable
    }
    return skills;
}
/**
 * Discover all skills from all resolved plugin paths.
 */
export function discoverAllSkills(resolvedPlugins) {
    const allSkills = [];
    for (const [pluginName, pluginRoot] of resolvedPlugins) {
        const skills = discoverPluginSkills(pluginName, pluginRoot);
        allSkills.push(...skills);
    }
    return allSkills;
}
/**
 * Load the full content of a skill's SKILL.md.
 */
export function loadSkillContent(skill) {
    try {
        return readFileSync(skill.filePath, 'utf-8');
    }
    catch {
        return `Error: Could not read skill file at ${skill.filePath}`;
    }
}
/**
 * Format a skill list for display (used by the han_skills tool).
 */
export function formatSkillList(skills, filter) {
    let filtered = skills;
    if (filter) {
        const lower = filter.toLowerCase();
        filtered = skills.filter((s) => s.name.toLowerCase().includes(lower) ||
            s.description.toLowerCase().includes(lower) ||
            s.pluginName.toLowerCase().includes(lower));
    }
    if (filtered.length === 0) {
        return filter
            ? `No skills matching "${filter}". Try a broader search term.`
            : 'No Han skills discovered. Install plugins: han plugin install --auto';
    }
    // Group by plugin
    const byPlugin = new Map();
    for (const skill of filtered) {
        const existing = byPlugin.get(skill.pluginName) || [];
        existing.push(skill);
        byPlugin.set(skill.pluginName, existing);
    }
    const lines = [`Found ${filtered.length} skills:\n`];
    for (const [plugin, pluginSkills] of byPlugin) {
        lines.push(`## ${plugin}`);
        for (const skill of pluginSkills) {
            lines.push(`- **${skill.name}**: ${skill.description || '(no description)'}`);
        }
        lines.push('');
    }
    lines.push(`\nUse han_skills with action="load" and skill="<name>" to load a skill's full content.`);
    return lines.join('\n');
}
