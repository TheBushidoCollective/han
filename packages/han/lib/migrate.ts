/**
 * Plugin Migration Module
 *
 * Migrates old plugin names (e.g., `jutsu-typescript@han`) to new short names
 * (e.g., `typescript@han`) in Claude Code settings files.
 *
 * Uses plugin-aliases.ts as the source of truth for old->new name mappings.
 * This is self-contained and does not depend on marketplace.json or its cache.
 */

import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { parseDocument } from 'yaml';
import { getClaudeConfigDir } from './config/claude-settings.ts';
import { getHanConfigPaths } from './config/han-settings.ts';
import { isDeprecatedPluginName, PLUGIN_ALIASES } from './plugin-aliases.ts';

/**
 * Build migration map from PLUGIN_ALIASES.
 * Maps old prefixed names (e.g., "jutsu-typescript") to their canonical
 * short name derived from the path (e.g., "typescript" from "languages/typescript").
 *
 * Uses the path's last segment as the canonical name, which matches the
 * marketplace's canonical plugin names exactly.
 */
function buildMigrationMap(): Map<string, string> {
  const migrationMap = new Map<string, string>();

  for (const [oldName, path] of Object.entries(PLUGIN_ALIASES)) {
    if (isDeprecatedPluginName(oldName)) {
      const segments = path.split('/');
      const canonical = segments[segments.length - 1];
      if (canonical && canonical !== oldName) {
        migrationMap.set(oldName.toLowerCase(), canonical);
      }
    }
  }

  return migrationMap;
}

// Cache the migration map
let cachedMigrationMap: Map<string, string> | null = null;

/**
 * Get the migration map (cached)
 */
function getMigrationMap(): Map<string, string> {
  if (!cachedMigrationMap) {
    cachedMigrationMap = buildMigrationMap();
  }
  return cachedMigrationMap;
}

/**
 * Get the canonical name for an old plugin name
 */
function getCanonicalName(oldName: string): string | null {
  const map = getMigrationMap();
  return map.get(oldName.toLowerCase()) || null;
}

/**
 * Check if a plugin name is an old-style name that should be migrated
 */
export function isOldPluginName(name: string): boolean {
  return getMigrationMap().has(name.toLowerCase());
}

/**
 * Result of a migration operation
 */
export interface MigrationResult {
  /** Path to the settings file that was migrated */
  path: string;
  /** Whether any changes were made */
  modified: boolean;
  /** Old plugin names that were migrated */
  migratedPlugins: Array<{ oldName: string; newName: string }>;
  /** Error message if migration failed */
  error?: string;
}

/**
 * Claude settings structure (subset relevant to migration)
 */
interface ClaudeSettings {
  enabledPlugins?: Record<string, boolean>;
  permissions?: {
    allow?: string[];
    deny?: string[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Read and parse a JSON settings file
 */
function readSettingsFile(path: string): ClaudeSettings | null {
  if (!existsSync(path)) {
    return null;
  }

  try {
    const content = readFileSync(path, 'utf-8');
    return JSON.parse(content) as ClaudeSettings;
  } catch {
    return null;
  }
}

/**
 * Write settings to a JSON file, preserving formatting
 */
function writeSettingsFile(path: string, settings: ClaudeSettings): void {
  writeFileSync(path, `${JSON.stringify(settings, null, 2)}\n`, 'utf-8');
}

/**
 * Migrate plugin names in enabledPlugins section.
 * Converts old names like "jutsu-typescript@han" to "typescript@han".
 */
function migrateEnabledPlugins(enabledPlugins: Record<string, boolean>): {
  migrated: Record<string, boolean>;
  changes: Array<{ oldName: string; newName: string }>;
} {
  const migrated: Record<string, boolean> = {};
  const changes: Array<{ oldName: string; newName: string }> = [];

  for (const [key, enabled] of Object.entries(enabledPlugins)) {
    // Check if this is a @han plugin
    if (!key.endsWith('@han')) {
      migrated[key] = enabled;
      continue;
    }

    const pluginName = key.slice(0, -4); // Remove "@han" suffix
    const canonicalName = getCanonicalName(pluginName);

    if (canonicalName && canonicalName !== pluginName) {
      // This is an old name - migrate it
      const newKey = `${canonicalName}@han`;
      migrated[newKey] = enabled;
      changes.push({ oldName: key, newName: newKey });
    } else {
      // Keep as-is (either already migrated or not a known alias)
      migrated[key] = enabled;
    }
  }

  return { migrated, changes };
}

/**
 * Migrate plugin names in permissions.allow/deny arrays.
 * Converts old names like "jutsu-typescript@han" to "typescript@han".
 */
function migratePermissionItems(items: string[]): {
  migrated: string[];
  changes: Array<{ oldName: string; newName: string }>;
} {
  const migrated: string[] = [];
  const changes: Array<{ oldName: string; newName: string }> = [];

  for (const item of items) {
    // Check if this is a @han plugin permission
    if (!item.endsWith('@han')) {
      migrated.push(item);
      continue;
    }

    const pluginName = item.slice(0, -4); // Remove "@han" suffix
    const canonicalName = getCanonicalName(pluginName);

    if (canonicalName && canonicalName !== pluginName) {
      // This is an old name - migrate it
      const newItem = `${canonicalName}@han`;
      migrated.push(newItem);
      changes.push({ oldName: item, newName: newItem });
    } else {
      // Keep as-is
      migrated.push(item);
    }
  }

  return { migrated, changes };
}

/**
 * Migrate a single settings file.
 */
export function migrateSettingsFile(path: string): MigrationResult {
  const result: MigrationResult = {
    path,
    modified: false,
    migratedPlugins: [],
  };

  const settings = readSettingsFile(path);
  if (!settings) {
    return result;
  }

  let modified = false;

  // Migrate enabledPlugins
  if (settings.enabledPlugins) {
    const { migrated, changes } = migrateEnabledPlugins(
      settings.enabledPlugins
    );
    if (changes.length > 0) {
      settings.enabledPlugins = migrated;
      result.migratedPlugins.push(...changes);
      modified = true;
    }
  }

  // Migrate permissions.allow
  if (
    settings.permissions?.allow &&
    Array.isArray(settings.permissions.allow)
  ) {
    const { migrated, changes } = migratePermissionItems(
      settings.permissions.allow
    );
    if (changes.length > 0) {
      settings.permissions.allow = migrated;
      result.migratedPlugins.push(...changes);
      modified = true;
    }
  }

  // Migrate permissions.deny
  if (settings.permissions?.deny && Array.isArray(settings.permissions.deny)) {
    const { migrated, changes } = migratePermissionItems(
      settings.permissions.deny
    );
    if (changes.length > 0) {
      settings.permissions.deny = migrated;
      result.migratedPlugins.push(...changes);
      modified = true;
    }
  }

  if (modified) {
    try {
      writeSettingsFile(path, settings);
      result.modified = true;
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    }
  }

  return result;
}

/**
 * Get paths to all Claude settings files that may contain plugin references.
 */
export function getSettingsFilePaths(projectPath?: string): string[] {
  const paths: string[] = [];

  // User settings - use getClaudeConfigDir() which respects CLAUDE_CONFIG_DIR
  const configDir = getClaudeConfigDir();
  if (configDir) {
    paths.push(join(configDir, 'settings.json'));
  }

  // Project settings
  if (projectPath) {
    paths.push(join(projectPath, '.claude', 'settings.json'));
    paths.push(join(projectPath, '.claude', 'settings.local.json'));
  }

  return paths;
}

/**
 * Migrate plugin names in all settings files.
 *
 * This function is idempotent - running it multiple times will have no effect
 * after the first successful migration.
 */
export function migratePluginNames(projectPath?: string): MigrationResult[] {
  const paths = getSettingsFilePaths(projectPath);
  const results: MigrationResult[] = [];

  for (const path of paths) {
    results.push(migrateSettingsFile(path));
  }

  return results;
}

/**
 * Migrate a single YAML config file (han.yml or han-config.yml).
 *
 * Handles two formats:
 * - han.yml (new format): keys under `plugins:` section (e.g., `plugins.jutsu-bun` -> `plugins.bun`)
 * - han-config.yml (legacy flat format): top-level keys (e.g., `jutsu-credo:` -> `credo:`)
 *
 * Uses parseDocument() to preserve YAML comments and formatting.
 */
export function migrateYamlConfigFile(filePath: string): MigrationResult {
  const result: MigrationResult = {
    path: filePath,
    modified: false,
    migratedPlugins: [],
  };

  if (!existsSync(filePath)) {
    return result;
  }

  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return result;
  }

  const doc = parseDocument(content);
  if (!doc.contents || doc.errors.length > 0) {
    return result;
  }

  let modified = false;
  const isLegacyFormat = filePath.endsWith('han-config.yml');

  if (isLegacyFormat) {
    // Legacy format: top-level keys are plugin names
    modified = migrateYamlMapKeys(doc.contents, result);
  } else {
    // New format: plugin names under `plugins:` key
    const pluginsNode = doc.get('plugins', true);
    if (
      pluginsNode &&
      typeof pluginsNode === 'object' &&
      'items' in pluginsNode
    ) {
      modified = migrateYamlMapKeys(pluginsNode, result);
    }
  }

  if (modified) {
    try {
      writeFileSync(filePath, doc.toString(), 'utf-8');
      result.modified = true;
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    }
  }

  return result;
}

/**
 * Rename deprecated plugin keys in a YAML map node.
 * Mutates the node in-place, preserving comments and formatting.
 */
function migrateYamlMapKeys(node: unknown, result: MigrationResult): boolean {
  if (!node || typeof node !== 'object' || !('items' in node)) {
    return false;
  }

  const mapNode = node as { items: Array<{ key: unknown; value: unknown }> };
  let modified = false;

  for (const pair of mapNode.items) {
    const key = pair.key;
    if (!key || typeof key !== 'object' || !('value' in key)) {
      continue;
    }

    const keyObj = key as { value: string };
    const keyValue = keyObj.value;
    if (typeof keyValue !== 'string') continue;

    const canonical = getCanonicalName(keyValue);
    if (canonical && canonical !== keyValue) {
      keyObj.value = canonical;
      result.migratedPlugins.push({ oldName: keyValue, newName: canonical });
      modified = true;
    }
  }

  return modified;
}

/**
 * Find all han.yml and han-config.yml files that may contain plugin name keys.
 *
 * Sources:
 * - Standard config paths from getHanConfigPaths() (user, project, local, root)
 * - Subdirectory han.yml files (per-directory overrides)
 * - Subdirectory han-config.yml files (legacy format)
 */
export function findYamlConfigFiles(projectPath: string): string[] {
  const paths = new Set<string>();

  // Standard han config paths
  for (const { path } of getHanConfigPaths()) {
    if (existsSync(path)) {
      paths.add(path);
    }
  }

  // Scan project subdirectories for han.yml and han-config.yml
  scanForYamlConfigs(projectPath, paths, 0);

  return Array.from(paths);
}

/**
 * Recursively scan directories for han.yml and han-config.yml files.
 * Skips common non-project directories.
 */
function scanForYamlConfigs(
  dir: string,
  found: Set<string>,
  depth: number
): void {
  // Limit depth to avoid scanning deeply nested dirs
  if (depth > 5) return;

  const skipDirs = new Set([
    'node_modules',
    '.git',
    '.next',
    'dist',
    'out',
    'build',
    'target',
    '.turbo',
    '.cache',
    'vendor',
  ]);

  let names: string[];
  try {
    names = readdirSync(dir, 'utf-8');
  } catch {
    return;
  }

  for (const name of names) {
    if (name === 'han.yml' || name === 'han-config.yml') {
      found.add(join(dir, name));
      continue;
    }
    if (skipDirs.has(name)) continue;
    const fullPath = join(dir, name);
    try {
      if (statSync(fullPath).isDirectory()) {
        scanForYamlConfigs(fullPath, found, depth + 1);
      }
    } catch {
      // Skip entries we can't stat
    }
  }
}

/**
 * Migrate plugin names in all YAML config files.
 */
export function migrateYamlConfigFiles(projectPath: string): MigrationResult[] {
  const files = findYamlConfigFiles(projectPath);
  const results: MigrationResult[] = [];

  for (const file of files) {
    results.push(migrateYamlConfigFile(file));
  }

  return results;
}

/**
 * Log migration results to console.
 */
export function logMigrationResults(
  results: MigrationResult[],
  verbose = false
): void {
  const modifiedResults = results.filter((r) => r.modified);

  if (modifiedResults.length === 0) {
    if (verbose) {
      console.log('No plugin names needed migration.');
    }
    return;
  }

  console.log('Migrated plugin names:');
  for (const result of modifiedResults) {
    console.log(`  ${result.path}:`);
    for (const { oldName, newName } of result.migratedPlugins) {
      console.log(`    ${oldName} -> ${newName}`);
    }
  }
}

/**
 * Run migration as a standalone operation.
 * This can be called from a startup hook to migrate settings automatically.
 */
export function runMigration(
  options: { projectPath?: string; verbose?: boolean; silent?: boolean } = {}
): boolean {
  const {
    projectPath = process.cwd(),
    verbose = false,
    silent = false,
  } = options;

  const jsonResults = migratePluginNames(projectPath);
  const yamlResults = migrateYamlConfigFiles(projectPath);
  const results = [...jsonResults, ...yamlResults];

  if (!silent) {
    logMigrationResults(results, verbose);
  }

  return results.some((r) => r.modified);
}
