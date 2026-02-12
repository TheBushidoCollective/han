/**
 * Shared plugin discovery utilities
 *
 * Provides consistent plugin directory resolution across all hook commands
 * (list, explain, run). Uses dynamic scanning for han-plugin.yml
 * files to support flexible directory structures.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, parse } from 'node:path';
import {
  getClaudeConfigDir,
  getProjectDir,
  type MarketplaceConfig,
} from '../config/claude-settings.ts';

/**
 * Find marketplace root by walking up from a directory.
 * Looks for .claude-plugin/marketplace.json which indicates a marketplace repo.
 * This handles the case where CWD is a subdirectory of the marketplace.
 *
 * @param startDir - Directory to start searching from
 * @returns Marketplace root directory, or null if not found
 */
function findMarketplaceRoot(startDir: string): string | null {
  let dir = startDir;
  const { root } = parse(dir);

  while (dir !== root) {
    if (existsSync(join(dir, '.claude-plugin', 'marketplace.json'))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return null;
}

/**
 * Cache of plugin name to directory mappings per marketplace root.
 * Prevents repeated filesystem scans for the same marketplace.
 */
const pluginDirCache = new Map<string, Map<string, string>>();

/**
 * Build plugin directory cache by scanning for han-plugin.yml files.
 * Recursively scans up to depth 3 to support directory structures like:
 * - plugins/validation/biome/han-plugin.yml
 * - plugins/services/github/han-plugin.yml
 *
 * @param marketplaceRoot - Root directory of the marketplace to scan
 * @returns Map of plugin name to plugin directory path
 */
export function buildPluginDirCache(
  marketplaceRoot: string
): Map<string, string> {
  const cache = new Map<string, string>();

  const scanDir = (dir: string, depth: number) => {
    // Depth 3 supports: plugins/category/plugin/han-plugin.yml
    if (depth > 3) return;
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith('.') || entry.name === 'node_modules')
          continue;

        const subdir = join(dir, entry.name);

        // Check if this directory has han-plugin.yml
        if (existsSync(join(subdir, 'han-plugin.yml'))) {
          // Get plugin name from .claude-plugin/plugin.json if available
          const pluginJsonPath = join(subdir, '.claude-plugin', 'plugin.json');
          if (existsSync(pluginJsonPath)) {
            try {
              const pluginJson = JSON.parse(
                readFileSync(pluginJsonPath, 'utf-8')
              );
              if (pluginJson.name) {
                cache.set(pluginJson.name, subdir);
              }
            } catch {
              // Invalid plugin.json, fall back to directory name
              cache.set(entry.name, subdir);
            }
          } else {
            // No plugin.json, use directory name
            cache.set(entry.name, subdir);
          }
        }

        // Recurse into subdirectories
        scanDir(subdir, depth + 1);
      }
    } catch {
      // Directory not readable
    }
  };

  scanDir(marketplaceRoot, 0);
  return cache;
}

/**
 * Find plugin directory in a marketplace using cached lookup.
 *
 * @param marketplaceRoot - Root directory of the marketplace
 * @param pluginName - Name of the plugin to find
 * @returns Absolute path to plugin directory, or null if not found
 */
export function findPluginInMarketplace(
  marketplaceRoot: string,
  pluginName: string
): string | null {
  // Use cached mapping if available
  if (!pluginDirCache.has(marketplaceRoot)) {
    pluginDirCache.set(marketplaceRoot, buildPluginDirCache(marketplaceRoot));
  }

  const cache = pluginDirCache.get(marketplaceRoot);
  return cache?.get(pluginName) ?? null;
}

/**
 * Clear the plugin directory cache.
 * Useful for testing or when plugins are installed/removed.
 */
export function clearPluginDirCache(): void {
  pluginDirCache.clear();
}

/**
 * Source information for a discovered plugin
 */
export interface PluginSource {
  type: 'github' | 'directory' | 'git' | 'development';
  path?: string;
  repo?: string;
}

/**
 * Result of resolving a plugin directory
 */
export interface PluginDirResult {
  path: string | null;
  source: PluginSource;
}

/**
 * Resolve a path to absolute, relative to a base directory.
 */
function resolveToAbsolute(path: string, basePath?: string): string {
  if (path.startsWith('/')) {
    return path;
  }
  return join(basePath ?? process.cwd(), path);
}

/**
 * Get plugin directory with source information.
 * Checks multiple locations in order of precedence:
 * 1. Directory source from marketplace config
 * 2. Git source from marketplace config
 * 3. Development mode (running in marketplace repo)
 * 4. Default shared config path (GitHub source)
 *
 * @param pluginName - Name of the plugin
 * @param marketplace - Marketplace identifier
 * @param marketplaceConfig - Optional marketplace configuration
 * @returns Plugin directory path and source information
 */
export function getPluginDirWithSource(
  pluginName: string,
  marketplace: string,
  marketplaceConfig: MarketplaceConfig | undefined
): PluginDirResult {
  const projectDir = getProjectDir();

  // Check marketplace config for directory source
  if (marketplaceConfig?.source?.source === 'directory') {
    const directoryPath = marketplaceConfig.source.path;
    if (directoryPath) {
      const absolutePath = resolveToAbsolute(directoryPath, projectDir);
      const found = findPluginInMarketplace(absolutePath, pluginName);
      if (found) {
        return {
          path: found,
          source: { type: 'directory', path: absolutePath },
        };
      }
    }
  }

  // Check for git source
  if (
    marketplaceConfig?.source?.source === 'git' &&
    marketplaceConfig.source.url
  ) {
    const configDir = getClaudeConfigDir();
    if (configDir) {
      const marketplaceRoot = join(
        configDir,
        'plugins',
        'marketplaces',
        marketplace
      );
      const found = findPluginInMarketplace(marketplaceRoot, pluginName);
      if (found) {
        return {
          path: found,
          source: { type: 'git', path: marketplaceConfig.source.url },
        };
      }
    }
  }

  // Check if we're in the marketplace repo (development mode)
  // Walk up from projectDir to find marketplace root (handles subdirectories)
  const marketplaceDevRoot = findMarketplaceRoot(projectDir);
  if (marketplaceDevRoot) {
    const found = findPluginInMarketplace(marketplaceDevRoot, pluginName);
    if (found) {
      return {
        path: found,
        source: { type: 'development', path: marketplaceDevRoot },
      };
    }
  }

  // Fall back to default shared config path (GitHub source)
  const configDir = getClaudeConfigDir();
  if (configDir) {
    const marketplaceRoot = join(
      configDir,
      'plugins',
      'marketplaces',
      marketplace
    );
    if (existsSync(marketplaceRoot)) {
      const found = findPluginInMarketplace(marketplaceRoot, pluginName);
      if (found) {
        return {
          path: found,
          source: {
            type: 'github',
            repo: marketplaceConfig?.source?.repo || marketplace,
          },
        };
      }
    }
  }

  return { path: null, source: { type: 'github' } };
}

/**
 * Get plugin directory for a plugin (simple version without source info).
 *
 * @param pluginName - Name of the plugin
 * @param marketplace - Marketplace identifier
 * @param marketplaceConfig - Optional marketplace configuration
 * @returns Absolute path to plugin directory, or null if not found
 */
export function getPluginDir(
  pluginName: string,
  marketplace: string,
  marketplaceConfig: MarketplaceConfig | undefined
): string | null {
  return getPluginDirWithSource(pluginName, marketplace, marketplaceConfig)
    .path;
}
