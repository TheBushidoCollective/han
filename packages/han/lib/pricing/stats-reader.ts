/**
 * Multi-config-dir stats aggregator
 *
 * Reads stats-cache.json from ALL registered config dirs and merges them.
 * Also reads billing info from ~/.claude.json.
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { ModelTokenUsage } from './model-pricing.ts';

/**
 * Shape of stats-cache.json from a Claude config directory
 */
export interface StatsCache {
  version: number;
  lastComputedDate: string;
  dailyActivity: Array<{
    date: string;
    messageCount: number;
    sessionCount: number;
    toolCallCount: number;
  }>;
  dailyModelTokens: Array<{
    date: string;
    tokensByModel: Record<string, number>;
  }>;
  modelUsage: Record<
    string,
    {
      inputTokens: number;
      outputTokens: number;
      cacheReadInputTokens: number;
      cacheCreationInputTokens: number;
      webSearchRequests: number;
      costUSD: number;
      contextWindow: number;
    }
  >;
  totalSessions: number;
  totalMessages: number;
  longestSession?: {
    sessionId: string;
    duration: number;
    messageCount: number;
    timestamp: string;
  };
  firstSessionDate?: string;
  hourCounts?: Record<string, number>;
}

/**
 * Billing info from ~/.claude.json
 */
export interface BillingInfo {
  billingType: string | null;
  displayName: string | null;
  organizationUuid: string | null;
}

/**
 * Per-config-dir stats (not merged)
 */
export interface ConfigDirStats {
  configDirId: string;
  configDirName: string;
  configDirPath: string;
  modelUsage: Record<string, ModelTokenUsage>;
  totalSessions: number;
  totalMessages: number;
  firstSessionDate: string | null;
  hasStatsCacheData: boolean;
  dailyActivity: Array<{
    date: string;
    sessionCount: number;
    messageCount: number;
  }>;
  dailyModelTokens: Array<{
    date: string;
    tokensByModel: Record<string, number>;
  }>;
}

/**
 * Aggregated stats from all config dirs
 */
export interface AggregatedStats {
  modelUsage: Record<string, ModelTokenUsage>;
  dailyModelTokens: Array<{
    date: string;
    tokensByModel: Record<string, number>;
  }>;
  totalSessions: number;
  totalMessages: number;
  firstSessionDate: string | null;
  billingInfo: BillingInfo;
  hasStatsCacheData: boolean;
}

/**
 * Read and parse stats-cache.json from a specific config directory path.
 */
export function readStatsCacheFromPath(
  configDirPath: string
): StatsCache | null {
  try {
    const statsPath = join(configDirPath, 'stats-cache.json');
    if (!existsSync(statsPath)) return null;
    const content = readFileSync(statsPath, 'utf-8');
    return JSON.parse(content) as StatsCache;
  } catch (err) {
    console.warn(`Failed to read stats-cache.json from ${configDirPath}:`, err);
    return null;
  }
}

/**
 * Read billing info from ~/.claude.json.
 * The oauthAccount field contains billing type (e.g., "stripe_subscription").
 */
export function readBillingInfo(): BillingInfo {
  const empty: BillingInfo = {
    billingType: null,
    displayName: null,
    organizationUuid: null,
  };
  try {
    const claudeJsonPath = join(homedir(), '.claude.json');
    if (!existsSync(claudeJsonPath)) return empty;
    const content = readFileSync(claudeJsonPath, 'utf-8');
    const data = JSON.parse(content);
    const account = data?.oauthAccount;
    return {
      billingType: account?.billingType ?? null,
      displayName: account?.displayName ?? null,
      organizationUuid: account?.organizationUuid ?? null,
    };
  } catch {
    return empty;
  }
}

/**
 * Merge model usage from a StatsCache into a running aggregate.
 */
function mergeModelUsage(
  target: Record<string, ModelTokenUsage>,
  source: StatsCache['modelUsage']
): void {
  for (const [modelId, usage] of Object.entries(source)) {
    const existing = target[modelId];
    if (existing) {
      existing.inputTokens += usage.inputTokens;
      existing.outputTokens += usage.outputTokens;
      existing.cacheReadInputTokens += usage.cacheReadInputTokens;
      existing.cacheCreationInputTokens += usage.cacheCreationInputTokens;
    } else {
      target[modelId] = {
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cacheReadInputTokens: usage.cacheReadInputTokens,
        cacheCreationInputTokens: usage.cacheCreationInputTokens,
      };
    }
  }
}

/**
 * Merge daily model tokens from a StatsCache into a running aggregate.
 */
function mergeDailyModelTokens(
  target: Map<string, Record<string, number>>,
  source: StatsCache['dailyModelTokens']
): void {
  for (const day of source) {
    const existing = target.get(day.date);
    if (existing) {
      for (const [model, tokens] of Object.entries(day.tokensByModel)) {
        existing[model] = (existing[model] ?? 0) + tokens;
      }
    } else {
      target.set(day.date, { ...day.tokensByModel });
    }
  }
}

/**
 * Get aggregated stats from all registered config dirs.
 * Falls back to just ~/.claude/ if listConfigDirs is not available.
 */
export async function getAggregatedStats(): Promise<AggregatedStats> {
  const modelUsage: Record<string, ModelTokenUsage> = {};
  const dailyTokensMap = new Map<string, Record<string, number>>();
  let totalSessions = 0;
  let totalMessages = 0;
  let firstSessionDate: string | null = null;
  let hasStatsCacheData = false;

  // Try to read from all registered config dirs
  let configDirPaths: string[] = [];
  try {
    const { listConfigDirs } = await import('../grpc/data-access.ts');
    const configDirs = await listConfigDirs();
    configDirPaths = configDirs.map((d: { path: string }) => d.path);
  } catch {
    // Fallback: just use default ~/.claude/
  }

  // Always include ~/.claude/ as it's the primary config dir
  const defaultPath = join(homedir(), '.claude');
  if (!configDirPaths.includes(defaultPath)) {
    configDirPaths.unshift(defaultPath);
  }

  for (const dirPath of configDirPaths) {
    const statsCache = readStatsCacheFromPath(dirPath);
    if (!statsCache) continue;

    hasStatsCacheData = true;

    if (statsCache.modelUsage) {
      mergeModelUsage(modelUsage, statsCache.modelUsage);
    }

    if (statsCache.dailyModelTokens) {
      mergeDailyModelTokens(dailyTokensMap, statsCache.dailyModelTokens);
    }

    totalSessions += statsCache.totalSessions ?? 0;
    totalMessages += statsCache.totalMessages ?? 0;

    if (statsCache.firstSessionDate) {
      if (!firstSessionDate || statsCache.firstSessionDate < firstSessionDate) {
        firstSessionDate = statsCache.firstSessionDate;
      }
    }
  }

  // Convert daily tokens map to sorted array
  const dailyModelTokens = Array.from(dailyTokensMap.entries())
    .map(([date, tokensByModel]) => ({ date, tokensByModel }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const billingInfo = readBillingInfo();

  return {
    modelUsage,
    dailyModelTokens,
    totalSessions,
    totalMessages,
    firstSessionDate,
    billingInfo,
    hasStatsCacheData,
  };
}

/**
 * Get per-config-dir stats (not merged).
 * Returns an array with one entry per config dir that has stats-cache.json.
 */
export async function getPerConfigDirStats(): Promise<ConfigDirStats[]> {
  const results: ConfigDirStats[] = [];

  let configDirs: Array<{ id: string; path: string; name?: string }> = [];
  try {
    const { listConfigDirs } = await import('../grpc/data-access.ts');
    configDirs = await listConfigDirs();
  } catch {
    // Fallback
  }

  // Always include ~/.claude/
  const defaultPath = join(homedir(), '.claude');
  if (!configDirs.some((d) => d.path === defaultPath)) {
    configDirs.unshift({ id: 'default', path: defaultPath, name: undefined });
  }

  for (const dir of configDirs) {
    const statsCache = readStatsCacheFromPath(dir.path);
    const modelUsage: Record<string, ModelTokenUsage> = {};

    if (statsCache?.modelUsage) {
      for (const [modelId, usage] of Object.entries(statsCache.modelUsage)) {
        modelUsage[modelId] = {
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          cacheReadInputTokens: usage.cacheReadInputTokens,
          cacheCreationInputTokens: usage.cacheCreationInputTokens,
        };
      }
    }

    // Derive a display name: use DB name, or basename of path
    const basename = dir.path.split('/').pop() ?? dir.path;
    const displayName =
      dir.name ||
      (basename === '.claude' ? 'Default' : basename.replace(/^\./, ''));

    results.push({
      configDirId: dir.id,
      configDirName: displayName,
      configDirPath: dir.path,
      modelUsage,
      totalSessions: statsCache?.totalSessions ?? 0,
      totalMessages: statsCache?.totalMessages ?? 0,
      firstSessionDate: statsCache?.firstSessionDate ?? null,
      hasStatsCacheData: statsCache !== null,
      dailyActivity: (statsCache?.dailyActivity ?? []).map((d) => ({
        date: d.date,
        sessionCount: d.sessionCount,
        messageCount: d.messageCount,
      })),
      dailyModelTokens: statsCache?.dailyModelTokens ?? [],
    });
  }

  return results;
}
