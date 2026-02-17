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

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import type { HookDefinition } from './types';

// ─── Settings Discovery ─────────────────────────────────────────────────────

interface PluginEntry {
  enabled?: boolean;
}

interface ClaudeSettings {
  plugins?: Record<string, PluginEntry>;
}

interface MarketplacePlugin {
  name: string;
  source: string;
}

interface Marketplace {
  plugins: MarketplacePlugin[];
}

/**
 * Find all enabled Han plugins by merging user, project, and local settings.
 */
function getEnabledPlugins(projectDir: string): string[] {
  const pluginNames = new Set<string>();

  const settingsPaths = [
    join(homedir(), '.claude', 'settings.json'), // user scope
    join(projectDir, '.claude', 'settings.json'), // project scope
    join(projectDir, '.claude', 'settings.local.json'), // local scope
  ];

  for (const path of settingsPaths) {
    if (!existsSync(path)) continue;
    try {
      const content = readFileSync(path, 'utf-8');
      const settings: ClaudeSettings = JSON.parse(content);
      if (!settings.plugins) continue;

      for (const [name, entry] of Object.entries(settings.plugins)) {
        if (entry.enabled !== false) {
          // Strip @han suffix if present: "biome@han" -> "biome"
          const cleanName = name.replace(/@han$/, '');
          pluginNames.add(cleanName);
        }
      }
    } catch {
      // Skip unreadable settings files
    }
  }

  return Array.from(pluginNames);
}

// ─── Marketplace Resolution ──────────────────────────────────────────────────

/**
 * Find the marketplace.json file. Searches up from projectDir to find
 * the han repository root, or falls back to the npm-installed marketplace.
 */
function findMarketplace(projectDir: string): Marketplace | null {
  // Check well-known locations
  const candidates = [
    join(projectDir, '.claude-plugin', 'marketplace.json'),
    join(homedir(), '.claude', 'marketplace.json'),
  ];

  // Walk up directories looking for .claude-plugin/marketplace.json
  let dir = projectDir;
  for (let i = 0; i < 10; i++) {
    const candidate = join(dir, '.claude-plugin', 'marketplace.json');
    if (existsSync(candidate) && !candidates.includes(candidate)) {
      candidates.unshift(candidate);
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  for (const path of candidates) {
    if (!existsSync(path)) continue;
    try {
      const content = readFileSync(path, 'utf-8');
      return JSON.parse(content) as Marketplace;
    } catch {}
  }

  return null;
}

/**
 * Resolve a plugin name to its filesystem path using the marketplace.
 */
function resolvePluginPath(
  pluginName: string,
  marketplace: Marketplace,
  marketplaceDir: string
): string | null {
  const entry = marketplace.plugins.find((p) => p.name === pluginName);
  if (!entry) return null;

  // source is relative to marketplace.json location (e.g. "./plugins/validation/biome")
  const pluginPath = resolve(marketplaceDir, entry.source);
  return existsSync(pluginPath) ? pluginPath : null;
}

// ─── han-plugin.yml Parsing ──────────────────────────────────────────────────

interface RawHookDef {
  event?: string | string[];
  command?: string;
  tool_filter?: string[];
  file_filter?: string[];
  dirs_with?: string[];
  dir_test?: string;
  timeout?: number;
}

interface RawPluginConfig {
  hooks?: Record<string, RawHookDef>;
}

/**
 * Minimal YAML parser for han-plugin.yml.
 * Handles the subset of YAML used by Han plugin configs.
 */
function parseSimpleYaml(content: string): RawPluginConfig {
  const result: RawPluginConfig = { hooks: {} };
  const lines = content.split('\n');

  let currentSection: string | null = null;
  let currentHook: string | null = null;
  let currentField: string | null = null;

  for (const line of lines) {
    const trimmed = line.trimEnd();

    // Top-level section
    if (/^hooks:\s*$/.test(trimmed)) {
      currentSection = 'hooks';
      continue;
    }

    if (currentSection !== 'hooks') continue;

    // Hook name (2-space indent)
    const hookMatch = trimmed.match(/^ {2}(\S+):\s*$/);
    if (hookMatch) {
      currentHook = hookMatch[1];
      if (result.hooks) result.hooks[currentHook] = {};
      currentField = null;
      continue;
    }

    if (!currentHook) continue;
    const hook = result.hooks?.[currentHook];
    if (!hook) continue;

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
        } else {
          hook.event = cleanValue;
        }
      } else if (key === 'command') {
        hook.command = cleanValue;
      } else if (key === 'dir_test') {
        hook.dir_test = cleanValue;
      } else if (key === 'timeout') {
        hook.timeout = parseInt(cleanValue, 10);
      } else if (
        key === 'tool_filter' ||
        key === 'file_filter' ||
        key === 'dirs_with'
      ) {
        if (cleanValue.startsWith('[')) {
          (hook as Record<string, unknown>)[key] = cleanValue
            .replace(/^\[|\]$/g, '')
            .split(',')
            .map((s) => s.trim().replace(/^["']|["']$/g, ''));
        } else {
          currentField = key;
        }
      }
      continue;
    }

    // Array item (6-space indent with -)
    const arrayMatch = trimmed.match(/^ {6}- (.+)$/);
    if (arrayMatch && currentField) {
      const value = arrayMatch[1].replace(/^["']|["']$/g, '');
      const rec = hook as Record<string, unknown>;
      if (!rec[currentField]) {
        rec[currentField] = [];
      }
      (rec[currentField] as string[]).push(value);
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
function parsePluginHooks(
  pluginName: string,
  pluginRoot: string
): HookDefinition[] {
  const ymlPath = join(pluginRoot, 'han-plugin.yml');
  if (!existsSync(ymlPath)) return [];

  try {
    const content = readFileSync(ymlPath, 'utf-8');
    const config = parseSimpleYaml(content);
    if (!config.hooks) return [];

    const hooks: HookDefinition[] = [];

    for (const [name, def] of Object.entries(config.hooks)) {
      if (!def.command) continue;

      hooks.push({
        name,
        pluginName,
        pluginRoot,
        event: def.event ?? 'Stop', // Default event is Stop
        command: def.command,
        toolFilter: def.tool_filter,
        fileFilter: def.file_filter,
        dirsWith: def.dirs_with,
        dirTest: def.dir_test,
        timeout: def.timeout,
      });
    }

    return hooks;
  } catch {
    return [];
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Resolve enabled plugins to their filesystem paths.
 * Returns a map of plugin name -> absolute plugin root path.
 */
export function resolvePluginPaths(projectDir: string): Map<string, string> {
  const resolved = new Map<string, string>();
  const enabledPlugins = getEnabledPlugins(projectDir);
  if (enabledPlugins.length === 0) return resolved;

  const marketplace = findMarketplace(projectDir);
  if (!marketplace) return resolved;

  const marketplaceDir = findMarketplaceDir(projectDir);
  if (!marketplaceDir) return resolved;

  for (const pluginName of enabledPlugins) {
    const pluginPath = resolvePluginPath(
      pluginName,
      marketplace,
      marketplaceDir
    );
    if (pluginPath) {
      resolved.set(pluginName, pluginPath);
    }
  }

  return resolved;
}

/**
 * Find the directory containing marketplace.json.
 */
function findMarketplaceDir(projectDir: string): string | null {
  const candidates = [
    join(projectDir, '.claude-plugin'),
    join(homedir(), '.claude'),
  ];

  let dir = projectDir;
  for (let i = 0; i < 10; i++) {
    const candidate = join(dir, '.claude-plugin');
    if (
      existsSync(join(candidate, 'marketplace.json')) &&
      !candidates.includes(candidate)
    ) {
      candidates.unshift(candidate);
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return (
    candidates.find((d) => existsSync(join(d, 'marketplace.json'))) ?? null
  );
}

/**
 * Discover all hook definitions from installed Han plugins.
 *
 * Reads settings files to find enabled plugins, resolves their paths
 * via the marketplace, and parses han-plugin.yml for hook definitions.
 */
export function discoverHooks(projectDir: string): HookDefinition[] {
  const resolved = resolvePluginPaths(projectDir);
  if (resolved.size === 0) return [];

  const allHooks: HookDefinition[] = [];

  for (const [pluginName, pluginPath] of resolved) {
    const hooks = parsePluginHooks(pluginName, pluginPath);
    allHooks.push(...hooks);
  }

  return allHooks;
}

/**
 * Filter hooks to only those matching a specific event type.
 */
export function getHooksByEvent(
  hooks: HookDefinition[],
  event: string
): HookDefinition[] {
  return hooks.filter((h) => {
    if (Array.isArray(h.event)) return h.event.includes(event);
    return h.event === event;
  });
}
