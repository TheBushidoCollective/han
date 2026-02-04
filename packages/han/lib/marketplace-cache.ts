import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MarketplacePlugin } from './shared.ts';

/**
 * Check if Han marketplace is configured in Claude settings
 * Returns true if Han is installed in any scope (user, project, or local)
 */
function isHanInstalled(): boolean {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  const configDir = process.env.CLAUDE_CONFIG_DIR || join(homeDir, '.claude');

  // Check user scope
  const userSettings = join(configDir, 'settings.json');
  if (existsSync(userSettings)) {
    try {
      const data = JSON.parse(readFileSync(userSettings, 'utf-8'));
      if (data.extraKnownMarketplaces?.han) {
        return true;
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Use CLAUDE_PROJECT_DIR for project settings if set (for testability)
  // Otherwise fall back to process.cwd()
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

  // Check project scope
  const projectSettings = join(projectDir, '.claude', 'settings.json');
  if (existsSync(projectSettings)) {
    try {
      const data = JSON.parse(readFileSync(projectSettings, 'utf-8'));
      if (data.extraKnownMarketplaces?.han) {
        return true;
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Check local scope
  const localSettings = join(projectDir, '.claude', 'settings.local.json');
  if (existsSync(localSettings)) {
    try {
      const data = JSON.parse(readFileSync(localSettings, 'utf-8'));
      if (data.extraKnownMarketplaces?.han) {
        return true;
      }
    } catch {
      // Ignore parse errors
    }
  }

  return false;
}

const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const MARKETPLACE_URL =
  'https://raw.githubusercontent.com/TheBushidoCollective/han/refs/heads/main/.claude-plugin/marketplace.json';

export interface MarketplaceCache {
  plugins: MarketplacePlugin[];
  timestamp: number;
  version: string;
}

/**
 * Get the cache directory path
 * Uses CLAUDE_CONFIG_DIR if set, otherwise ~/.claude/cache
 */
function getCacheDir(): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  const configDir = process.env.CLAUDE_CONFIG_DIR
    ? process.env.CLAUDE_CONFIG_DIR
    : join(homeDir, '.claude');
  return join(configDir, 'cache');
}

/**
 * Get the marketplace cache file path
 */
function getCacheFilePath(): string {
  return join(getCacheDir(), 'han-marketplace.json');
}

/**
 * Read marketplace cache from disk
 */
function readCache(): MarketplaceCache | null {
  const cachePath = getCacheFilePath();
  if (!existsSync(cachePath)) {
    return null;
  }

  try {
    const data = readFileSync(cachePath, 'utf-8');
    return JSON.parse(data) as MarketplaceCache;
  } catch {
    // Corrupt cache, return null
    return null;
  }
}

/**
 * Write marketplace cache to disk
 */
function writeCache(cache: MarketplaceCache): void {
  const cacheDir = getCacheDir();
  if (!existsSync(cacheDir)) {
    mkdirSync(cacheDir, { recursive: true });
  }

  const cachePath = getCacheFilePath();
  writeFileSync(cachePath, JSON.stringify(cache, null, 2));
}

/**
 * Check if cache is stale (older than CACHE_DURATION_MS)
 */
function isCacheStale(cache: MarketplaceCache): boolean {
  const age = Date.now() - cache.timestamp;
  return age > CACHE_DURATION_MS;
}

/**
 * Fetch marketplace data from GitHub
 */
async function fetchFromGitHub(): Promise<MarketplacePlugin[]> {
  const response = await fetch(MARKETPLACE_URL);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch marketplace: ${response.status} ${response.statusText}`
    );
  }

  const marketplace = (await response.json()) as {
    plugins: MarketplacePlugin[];
  };
  return marketplace.plugins;
}

/**
 * Get marketplace plugins, using cache if available and fresh
 * @param forceRefresh - If true, bypass cache and fetch from GitHub
 * @returns Marketplace plugins and whether data was fetched from cache
 */
export async function getMarketplacePlugins(
  forceRefresh = false
): Promise<{ plugins: MarketplacePlugin[]; fromCache: boolean }> {
  // If not forcing refresh, try cache first
  if (!forceRefresh) {
    const cache = readCache();
    if (cache && !isCacheStale(cache)) {
      return { plugins: cache.plugins, fromCache: true };
    }
  }

  // If Han is already installed in Claude settings, prefer cache over network fetch
  // (Claude Code already has access to marketplace via the configured marketplace)
  const hanInstalled = isHanInstalled();
  if (hanInstalled && !forceRefresh) {
    // Use cache if available, even if stale
    const cache = readCache();
    if (cache) {
      return { plugins: cache.plugins, fromCache: true };
    }
    // No cache available yet - fall through to fetch and create initial cache
  }

  // Cache miss, stale, or forced refresh - fetch from GitHub
  try {
    const plugins = await fetchFromGitHub();

    // Write to cache
    const cache: MarketplaceCache = {
      plugins,
      timestamp: Date.now(),
      version: '1.0',
    };
    writeCache(cache);

    return { plugins, fromCache: false };
  } catch (error) {
    // If fetch fails, try to use stale cache as fallback
    const cache = readCache();
    if (cache) {
      console.warn('Warning: Using stale marketplace cache due to fetch error');
      return { plugins: cache.plugins, fromCache: true };
    }

    // No cache available, re-throw error
    throw error;
  }
}

/**
 * Update marketplace cache by fetching latest data from GitHub
 * @returns Updated marketplace plugins
 */
export async function updateMarketplaceCache(): Promise<MarketplacePlugin[]> {
  const plugins = await fetchFromGitHub();

  const cache: MarketplaceCache = {
    plugins,
    timestamp: Date.now(),
    version: '1.0',
  };
  writeCache(cache);

  return plugins;
}

/**
 * Get cache age in hours
 */
export function getCacheAge(): number | null {
  const cache = readCache();
  if (!cache) {
    return null;
  }

  const ageMs = Date.now() - cache.timestamp;
  return ageMs / (60 * 60 * 1000); // Convert to hours
}

/**
 * Check if cache exists
 */
export function hasCachedMarketplace(): boolean {
  return existsSync(getCacheFilePath());
}
