import { existsSync, readFileSync, renameSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Marketplace source configuration
 */
export interface MarketplaceSource {
  source: 'directory' | 'git' | 'github';
  path?: string;
  url?: string;
  repo?: string;
}

/**
 * Marketplace configuration
 */
export interface MarketplaceConfig {
  source: MarketplaceSource;
}

/**
 * Claude Code settings structure
 */
export interface ClaudeSettings {
  extraKnownMarketplaces?: Record<string, MarketplaceConfig>;
  enabledPlugins?: Record<string, boolean>;
  hooks?: Record<string, unknown>;
}

/**
 * Settings file locations in order of precedence (lowest to highest priority):
 * 1. User settings (~/.claude/settings.json) - Personal global settings
 * 2. Project settings (.claude/settings.json) - Team-shared project settings
 * 3. Local settings (.claude/settings.local.json) - Personal project-specific settings
 * 4. Enterprise managed settings (managed-settings.json) - Cannot be overridden
 *
 * @see https://code.claude.com/docs/en/settings
 */
export type SettingsScope = 'user' | 'project' | 'local' | 'enterprise';

/**
 * Get Claude config directory (~/.claude)
 */
export function getClaudeConfigDir(): string {
  if (process.env.CLAUDE_CONFIG_DIR) {
    return process.env.CLAUDE_CONFIG_DIR;
  }
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  if (!homeDir) {
    return '';
  }
  return join(homeDir, '.claude');
}

/** Cached result so migration only runs once per process */
let _hanDataDir: string | null = null;

/**
 * Get Han's own data directory (~/.han)
 *
 * Han stores its coordinator, database, memory, and logs here.
 * This is provider-agnostic — shared across Claude Code, OpenCode,
 * and any future provider integrations.
 *
 * On first call, auto-migrates ~/.claude/han → ~/.han if the old
 * directory exists and the new one doesn't.
 *
 * Priority:
 * 1. HAN_DATA_DIR environment variable (for testing/custom paths)
 * 2. ~/.han (default, auto-migrated from ~/.claude/han)
 */
export function getHanDataDir(): string {
  if (_hanDataDir) return _hanDataDir;

  if (process.env.HAN_DATA_DIR) {
    _hanDataDir = process.env.HAN_DATA_DIR;
    return _hanDataDir;
  }

  const homeDir = process.env.HOME || process.env.USERPROFILE;
  if (!homeDir) {
    return '';
  }

  const newDir = join(homeDir, '.han');
  const oldDir = join(getClaudeConfigDir(), 'han');

  // Already migrated or fresh install with data
  if (existsSync(newDir)) {
    _hanDataDir = newDir;
    return _hanDataDir;
  }

  // Old directory exists — auto-migrate
  if (existsSync(oldDir)) {
    try {
      // Ensure parent exists (it's ~/, so it always does, but be safe)
      mkdirSync(dirname(newDir), { recursive: true });
      renameSync(oldDir, newDir);
      console.error(`[han] Migrated data directory: ${oldDir} → ${newDir}`);
      _hanDataDir = newDir;
      return _hanDataDir;
    } catch {
      // Migration failed (permissions, cross-device, coordinator holding lock, etc.)
      // Fall back to old path — next restart will retry
      console.error(
        `[han] Could not migrate ${oldDir} → ${newDir}, using old path. ` +
          `Stop the coordinator and retry, or move manually.`,
      );
      _hanDataDir = oldDir;
      return _hanDataDir;
    }
  }

  // Neither exists — fresh install
  _hanDataDir = newDir;
  return _hanDataDir;
}

/**
 * Get project directory by walking up from CWD to find project markers.
 * Falls back to CWD if not found.
 *
 * Project markers (in order of precedence):
 * 1. .git directory
 * 2. .claude/settings.json
 * 3. .claude/han.yml
 * 4. han.yml (root config)
 */
export function getProjectDir(): string {
  if (process.env.CLAUDE_PROJECT_DIR) {
    return process.env.CLAUDE_PROJECT_DIR;
  }

  let dir = process.cwd();
  const { root } = require('node:path').parse(dir);

  // Walk up directory tree looking for project markers
  while (dir !== root) {
    if (
      existsSync(join(dir, '.git')) ||
      existsSync(join(dir, '.claude', 'settings.json')) ||
      existsSync(join(dir, '.claude', 'han.yml')) ||
      existsSync(join(dir, 'han.yml'))
    ) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break; // Reached root
    dir = parent;
  }

  // Fall back to CWD if no project markers found
  return process.cwd();
}

/**
 * Read settings from a file path
 */
export function readSettingsFile(path: string): ClaudeSettings | null {
  if (!existsSync(path)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Get all settings file paths in order of precedence (lowest to highest)
 * @param projectPath - Optional explicit project path (overrides cwd-based detection)
 */
export function getSettingsPaths(
  projectPath?: string
): { scope: SettingsScope; path: string }[] {
  const paths: { scope: SettingsScope; path: string }[] = [];
  const configDir = getClaudeConfigDir();
  const projectDir = projectPath || getProjectDir();

  // 1. User settings (lowest priority)
  if (configDir) {
    paths.push({
      scope: 'user',
      path: join(configDir, 'settings.json'),
    });
  }

  // 2. Project settings (team-shared)
  paths.push({
    scope: 'project',
    path: join(projectDir, '.claude', 'settings.json'),
  });

  // 3. Local settings (personal project-specific)
  paths.push({
    scope: 'local',
    path: join(projectDir, '.claude', 'settings.local.json'),
  });

  // 4. Enterprise managed settings (highest priority, cannot be overridden)
  if (configDir) {
    paths.push({
      scope: 'enterprise',
      path: join(configDir, 'managed-settings.json'),
    });
  }

  return paths;
}

/**
 * Merge enabled plugins from multiple settings files.
 * Higher priority settings override lower priority ones.
 * Setting a plugin to false explicitly disables it.
 */
function mergeEnabledPlugins(
  base: Map<string, string>,
  settings: ClaudeSettings
): void {
  if (!settings.enabledPlugins) return;

  for (const [key, enabled] of Object.entries(settings.enabledPlugins)) {
    if (!key.includes('@')) continue;

    const [pluginName, marketplace] = key.split('@');
    if (enabled) {
      base.set(pluginName, marketplace);
    } else {
      // Explicitly disabled - remove from map
      base.delete(pluginName);
    }
  }
}

/**
 * Merge marketplace configurations from multiple settings files.
 * Higher priority settings override lower priority ones.
 */
function mergeMarketplaces(
  base: Map<string, MarketplaceConfig>,
  settings: ClaudeSettings
): void {
  if (!settings.extraKnownMarketplaces) return;

  for (const [name, config] of Object.entries(
    settings.extraKnownMarketplaces
  )) {
    base.set(name, config);
  }
}

/**
 * Get all enabled plugins and marketplace configurations from merged settings.
 *
 * Settings are merged in order of precedence:
 * 1. User settings (~/.claude/settings.json) - lowest priority
 * 2. Project settings (.claude/settings.json)
 * 3. Local settings (.claude/settings.local.json)
 * 4. Enterprise settings (managed-settings.json) - highest priority
 *
 * @param projectPath - Optional explicit project path for settings lookup
 * @see https://code.claude.com/docs/en/settings
 */
export function getMergedPluginsAndMarketplaces(projectPath?: string): {
  plugins: Map<string, string>;
  marketplaces: Map<string, MarketplaceConfig>;
} {
  const plugins = new Map<string, string>();
  const marketplaces = new Map<string, MarketplaceConfig>();

  // Process settings in order of precedence (lowest to highest)
  for (const { path } of getSettingsPaths(projectPath)) {
    const settings = readSettingsFile(path);
    if (settings) {
      mergeMarketplaces(marketplaces, settings);
      mergeEnabledPlugins(plugins, settings);
    }
  }

  return { plugins, marketplaces };
}

/**
 * Get merged settings from all scopes.
 * This performs a deep merge with higher priority settings overriding lower ones.
 */
export function getMergedSettings(): ClaudeSettings {
  const merged: ClaudeSettings = {};

  for (const { path } of getSettingsPaths()) {
    const settings = readSettingsFile(path);
    if (settings) {
      // Merge extraKnownMarketplaces
      if (settings.extraKnownMarketplaces) {
        merged.extraKnownMarketplaces = {
          ...merged.extraKnownMarketplaces,
          ...settings.extraKnownMarketplaces,
        };
      }

      // Merge enabledPlugins
      if (settings.enabledPlugins) {
        merged.enabledPlugins = {
          ...merged.enabledPlugins,
          ...settings.enabledPlugins,
        };
      }

      // Merge hooks
      if (settings.hooks) {
        merged.hooks = {
          ...merged.hooks,
          ...settings.hooks,
        };
      }
    }
  }

  return merged;
}
