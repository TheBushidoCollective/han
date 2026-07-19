/**
 * Plugin and hook discovery.
 *
 * Reads Claude Code settings files to find installed Han plugins,
 * resolves their paths via the marketplace, and parses han-plugin.yml
 * to extract hook definitions.
 *
 * This replaces `han hook dispatch`'s discovery with direct filesystem
 * reads, giving the bridge full control over hook execution.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
/**
 * Find all enabled Han plugins by merging user, project, and local settings.
 */
function getEnabledPlugins(projectDir) {
    const pluginNames = new Set();
    const settingsPaths = [
        join(homedir(), '.claude', 'settings.json'), // user scope
        join(projectDir, '.claude', 'settings.json'), // project scope
        join(projectDir, '.claude', 'settings.local.json'), // local scope
    ];
    for (const path of settingsPaths) {
        if (!existsSync(path))
            continue;
        try {
            const content = readFileSync(path, 'utf-8');
            const settings = JSON.parse(content);
            // Legacy `plugins` map
            if (settings.plugins) {
                for (const [name, entry] of Object.entries(settings.plugins)) {
                    if (entry.enabled !== false) {
                        // Strip @han suffix if present: "biome@han" -> "biome"
                        pluginNames.add(name.replace(/@han$/, ''));
                    }
                }
            }
            // Current `enabledPlugins` map (what `han plugin install` writes)
            if (settings.enabledPlugins) {
                for (const [name, enabled] of Object.entries(settings.enabledPlugins)) {
                    if (enabled && name.endsWith('@han')) {
                        pluginNames.add(name.replace(/@han$/, ''));
                    }
                }
            }
        }
        catch {
            // Skip unreadable settings files
        }
    }
    return Array.from(pluginNames);
}
// ─── Marketplace Resolution ──────────────────────────────────────────────────
/**
 * Candidate .claude-plugin dirs that may contain the han marketplace.json.
 * Besides project-relative and home locations, this includes marketplaces
 * installed by Claude Code under ~/.claude/plugins/marketplaces/<name>/,
 * which is where `han plugin install` registers the han marketplace.
 */
function marketplaceCandidateDirs(projectDir) {
    const candidates = [
        join(projectDir, '.claude-plugin'),
        join(homedir(), '.claude'),
    ];
    // Walk up directories looking for .claude-plugin/marketplace.json
    let dir = projectDir;
    for (let i = 0; i < 10; i++) {
        const candidate = join(dir, '.claude-plugin');
        if (existsSync(join(candidate, 'marketplace.json')) &&
            !candidates.includes(candidate)) {
            candidates.unshift(candidate);
        }
        const parent = dirname(dir);
        if (parent === dir)
            break;
        dir = parent;
    }
    // Installed marketplaces: ~/.claude/plugins/marketplaces/<name>/.claude-plugin
    const installedRoot = join(homedir(), '.claude', 'plugins', 'marketplaces');
    if (existsSync(installedRoot)) {
        try {
            for (const entry of readdirSync(installedRoot, { withFileTypes: true })) {
                if (!entry.isDirectory())
                    continue;
                const candidate = join(installedRoot, entry.name, '.claude-plugin');
                if (existsSync(join(candidate, 'marketplace.json'))) {
                    candidates.push(candidate);
                }
            }
        }
        catch {
            // Ignore unreadable marketplace directories
        }
    }
    return candidates;
}
/**
 * Locate the han marketplace.json and its directory. Candidates are checked
 * in order (project walk-up first, then well-known dirs, then installed
 * marketplaces); a marketplace named "han" always wins over an unnamed or
 * differently named one.
 */
function findMarketplaceLocation(projectDir) {
    let fallback = null;
    for (const dir of marketplaceCandidateDirs(projectDir)) {
        const path = join(dir, 'marketplace.json');
        if (!existsSync(path))
            continue;
        try {
            const marketplace = JSON.parse(readFileSync(path, 'utf-8'));
            if (!marketplace || !Array.isArray(marketplace.plugins))
                continue;
            if (marketplace.name === 'han')
                return { dir, marketplace };
            if (!fallback)
                fallback = { dir, marketplace };
        }
        catch { }
    }
    return fallback;
}
/**
 * Find the marketplace.json file. Searches up from projectDir to find
 * the han repository root, then installed marketplaces.
 */
function findMarketplace(projectDir) {
    return findMarketplaceLocation(projectDir)?.marketplace ?? null;
}
/**
 * Resolve a plugin name to its filesystem path using the marketplace.
 */
function resolvePluginPath(pluginName, marketplace, marketplaceDir) {
    const entry = marketplace.plugins.find((p) => p.name === pluginName);
    if (!entry)
        return null;
    // source is relative to the marketplace root (the parent of .claude-plugin/),
    // e.g. "./plugins/validation/biome" resolves to <repo>/plugins/validation/biome
    const marketplaceRoot = dirname(marketplaceDir);
    const pluginPath = resolve(marketplaceRoot, entry.source);
    return existsSync(pluginPath) ? pluginPath : null;
}
/**
 * Minimal YAML parser for han-plugin.yml.
 * Handles the subset of YAML used by Han plugin configs.
 */
function parseSimpleYaml(content) {
    const result = { hooks: {} };
    const lines = content.split('\n');
    let currentSection = null;
    let currentHook = null;
    let currentField = null;
    for (const line of lines) {
        const trimmed = line.trimEnd();
        // Top-level section
        if (/^hooks:\s*$/.test(trimmed)) {
            currentSection = 'hooks';
            continue;
        }
        if (currentSection !== 'hooks')
            continue;
        // Hook name (2-space indent)
        const hookMatch = trimmed.match(/^ {2}(\S+):\s*$/);
        if (hookMatch) {
            currentHook = hookMatch[1];
            if (result.hooks)
                result.hooks[currentHook] = {};
            currentField = null;
            continue;
        }
        if (!currentHook)
            continue;
        const hook = result.hooks?.[currentHook];
        if (!hook)
            continue;
        // Simple key-value (4-space indent)
        const kvMatch = trimmed.match(/^ {4}(\S+):\s*(.+)$/);
        if (kvMatch) {
            const [, key, value] = kvMatch;
            const cleanValue = value.replace(/^["']|["']$/g, '');
            currentField = null;
            if (key === 'event') {
                // event can be a string or array: [Stop, SubagentStop]
                if (cleanValue.startsWith('[')) {
                    hook.event = cleanValue
                        .replace(/^\[|\]$/g, '')
                        .split(',')
                        .map((s) => s.trim());
                }
                else {
                    hook.event = cleanValue;
                }
            }
            else if (key === 'command') {
                hook.command = cleanValue;
            }
            else if (key === 'dir_test') {
                hook.dir_test = cleanValue;
            }
            else if (key === 'timeout') {
                hook.timeout = parseInt(cleanValue, 10);
            }
            else if (key === 'tool_filter' ||
                key === 'file_filter' ||
                key === 'dirs_with') {
                if (cleanValue.startsWith('[')) {
                    if (hook)
                        hook[key] = cleanValue
                            .replace(/^\[|\]$/g, '')
                            .split(',')
                            .map((s) => s.trim().replace(/^["']|["']$/g, ''));
                }
                else {
                    currentField = key;
                }
            }
            continue;
        }
        // Array item (6-space indent with -)
        const arrayMatch = trimmed.match(/^ {6}- (.+)$/);
        if (arrayMatch && currentField && hook) {
            const value = arrayMatch[1].replace(/^["']|["']$/g, '');
            if (!hook[currentField]) {
                hook[currentField] = [];
            }
            const arr = hook[currentField];
            if (Array.isArray(arr))
                arr.push(value);
            continue;
        }
        // Key with no value starts an array
        const arrayKeyMatch = trimmed.match(/^ {4}(\S+):\s*$/);
        if (arrayKeyMatch) {
            currentField = arrayKeyMatch[1];
        }
    }
    return result;
}
/**
 * Read and parse a plugin's han-plugin.yml, extracting hook definitions.
 */
function parsePluginHooks(pluginName, pluginRoot) {
    const ymlPath = join(pluginRoot, 'han-plugin.yml');
    if (!existsSync(ymlPath))
        return [];
    try {
        const content = readFileSync(ymlPath, 'utf-8');
        const config = parseSimpleYaml(content);
        if (!config.hooks)
            return [];
        const hooks = [];
        for (const [name, def] of Object.entries(config.hooks)) {
            if (!def.command)
                continue;
            // Events can carry Claude Code tool matchers: "PostToolUse:Edit|Write".
            // Split the suffix off so the base event matches and the tools act as
            // the hook's tool filter.
            const rawEvents = def.event ?? 'Stop'; // Default event is Stop
            const events = Array.isArray(rawEvents) ? rawEvents : [rawEvents];
            const baseEvents = [];
            const suffixTools = [];
            for (const e of events) {
                const [base, tools] = e.split(':', 2);
                baseEvents.push(base);
                if (tools) {
                    suffixTools.push(...tools.split('|').map((t) => t.trim()));
                }
            }
            const toolFilter = [...(def.tool_filter ?? []), ...suffixTools];
            hooks.push({
                name,
                pluginName,
                pluginRoot,
                event: Array.isArray(rawEvents) ? baseEvents : baseEvents[0],
                command: def.command,
                toolFilter: toolFilter.length > 0 ? toolFilter : undefined,
                fileFilter: def.file_filter,
                dirsWith: def.dirs_with,
                dirTest: def.dir_test,
                timeout: def.timeout,
            });
        }
        return hooks;
    }
    catch {
        return [];
    }
}
// ─── Public API ──────────────────────────────────────────────────────────────
/**
 * Resolve enabled plugins to their filesystem paths.
 * Returns a map of plugin name -> absolute plugin root path.
 */
export function resolvePluginPaths(projectDir) {
    const resolved = new Map();
    const enabledPlugins = getEnabledPlugins(projectDir);
    if (enabledPlugins.length === 0)
        return resolved;
    const marketplace = findMarketplace(projectDir);
    if (!marketplace)
        return resolved;
    const marketplaceDir = findMarketplaceDir(projectDir);
    if (!marketplaceDir)
        return resolved;
    for (const pluginName of enabledPlugins) {
        const pluginPath = resolvePluginPath(pluginName, marketplace, marketplaceDir);
        if (pluginPath) {
            resolved.set(pluginName, pluginPath);
        }
    }
    return resolved;
}
/**
 * Find the directory containing the marketplace.json that findMarketplace
 * would parse (same candidate order, same validity check).
 */
function findMarketplaceDir(projectDir) {
    return findMarketplaceLocation(projectDir)?.dir ?? null;
}
/**
 * Discover all hook definitions from installed Han plugins.
 *
 * Reads settings files to find enabled plugins, resolves their paths
 * via the marketplace, and parses han-plugin.yml for hook definitions.
 */
export function discoverHooks(projectDir) {
    const resolved = resolvePluginPaths(projectDir);
    if (resolved.size === 0)
        return [];
    const allHooks = [];
    for (const [pluginName, pluginPath] of resolved) {
        const hooks = parsePluginHooks(pluginName, pluginPath);
        allHooks.push(...hooks);
    }
    return allHooks;
}
/**
 * Filter hooks to only those matching a specific event type.
 */
export function getHooksByEvent(hooks, event) {
    return hooks.filter((h) => {
        if (Array.isArray(h.event))
            return h.event.includes(event);
        return h.event === event;
    });
}
