/**
 * Shared plugin discovery utilities
 *
 * Provides consistent plugin directory resolution across every command that
 * needs to locate a plugin on disk.
 *
 * A marketplace's `.claude-plugin/marketplace.json` is the authority: every
 * entry carries a `source` pointing at its directory, and legacy names stay
 * published as extra entries pointing at the same source. That makes the
 * manifest the only place that knows both the current
 * `plugins/<category>/<name>` layout and every historical alias. Scanning for
 * `han-plugin.yml` is the fallback, since plugins that ship only agents or an
 * MCP server have no such file.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, parse, resolve, sep } from 'node:path';
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

interface MarketplaceSourceObject {
  source?: string;
  path?: string;
}

interface MarketplaceManifest {
  metadata?: { pluginRoot?: string };
  plugins?: Array<{ name?: string; source?: string | MarketplaceSourceObject }>;
}

/**
 * Index every plugin entry in a marketplace manifest, canonical names and
 * aliases alike, into `cache`.
 *
 * Remote sources (github, npm, archive, git) have no local directory and are
 * skipped. A `source` that escapes the marketplace root is rejected, since a
 * manifest is third-party content.
 */
function addManifestEntries(
  marketplaceRoot: string,
  cache: Map<string, string>
): void {
  const manifestPath = join(
    marketplaceRoot,
    '.claude-plugin',
    'marketplace.json'
  );
  if (!existsSync(manifestPath)) return;

  let manifest: MarketplaceManifest;
  try {
    manifest = JSON.parse(
      readFileSync(manifestPath, 'utf-8')
    ) as MarketplaceManifest;
  } catch {
    return;
  }

  const pluginRoot = manifest.metadata?.pluginRoot;
  const rootPrefix = resolve(marketplaceRoot);

  for (const entry of manifest.plugins ?? []) {
    if (!entry?.name) continue;

    const source = entry.source;
    let relative: string | undefined;
    if (typeof source === 'string') {
      // `metadata.pluginRoot` prefixes bare sources, letting an entry say
      // "formatter" instead of "./plugins/formatter".
      relative =
        pluginRoot && !source.startsWith('.') && !isAbsolute(source)
          ? join(pluginRoot, source)
          : source;
    } else if (source?.source === 'directory' && source.path) {
      relative = source.path;
    }
    if (!relative) continue;

    const resolved = isAbsolute(relative)
      ? relative
      : join(marketplaceRoot, relative);
    const target = resolve(resolved);
    if (target !== rootPrefix && !target.startsWith(rootPrefix + sep)) continue;
    if (!existsSync(resolved)) continue;

    cache.set(entry.name.toLowerCase(), resolved);
  }
}

/**
 * Build the plugin name to directory map for a marketplace root.
 *
 * Reads `.claude-plugin/marketplace.json` first so canonical names and every
 * published alias resolve, then scans up to depth 3 for `han-plugin.yml` to
 * pick up plugins the manifest does not list.
 *
 * @param marketplaceRoot - Root directory of the marketplace to scan
 * @returns Map of lowercased plugin name to plugin directory path
 */
export function buildPluginDirCache(
  marketplaceRoot: string
): Map<string, string> {
  const cache = new Map<string, string>();

  addManifestEntries(marketplaceRoot, cache);

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

        if (existsSync(join(subdir, 'han-plugin.yml'))) {
          // Prefer the declared plugin name over the directory name.
          let name = entry.name;
          const pluginJsonPath = join(subdir, '.claude-plugin', 'plugin.json');
          if (existsSync(pluginJsonPath)) {
            try {
              const pluginJson = JSON.parse(
                readFileSync(pluginJsonPath, 'utf-8')
              );
              if (pluginJson.name) name = pluginJson.name;
            } catch {
              // Invalid plugin.json, keep the directory name.
            }
          }
          // The manifest wins when both know the name.
          if (!cache.has(name.toLowerCase())) {
            cache.set(name.toLowerCase(), subdir);
          }
        }

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
  if (!pluginName) return null;

  let cache = pluginDirCache.get(marketplaceRoot);
  if (!cache) {
    cache = buildPluginDirCache(marketplaceRoot);
    pluginDirCache.set(marketplaceRoot, cache);
  }

  return cache.get(pluginName.toLowerCase()) ?? null;
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
