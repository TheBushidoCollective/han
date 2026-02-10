/**
 * GraphQL ActivityData type
 *
 * Complete activity data for dashboard visualizations.
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { queryActivityAggregates } from '../../db/index.ts';
import { builder } from '../builder.ts';
import { type DailyActivity, DailyActivityType } from './daily-activity.ts';
import {
  type DailyModelTokens,
  DailyModelTokensType,
} from './daily-model-tokens.ts';
import { type HourlyActivity, HourlyActivityType } from './hourly-activity.ts';
import {
  type ModelUsageStats,
  ModelUsageStatsType,
} from './model-usage-stats.ts';
import {
  type TokenUsageStats,
  TokenUsageStatsType,
} from './token-usage-stats.ts';

/**
 * Activity data container
 */
export interface ActivityData {
  dailyActivity: DailyActivity[];
  hourlyActivity: HourlyActivity[];
  tokenUsage: TokenUsageStats;
  streakDays: number;
  totalActiveDays: number;
  // Model usage from stats-cache.json (long-lived data)
  dailyModelTokens: DailyModelTokens[];
  modelUsage: ModelUsageStats[];
  totalSessions: number;
  totalMessages: number;
  firstSessionDate: string | null;
}

/**
 * Activity data type ref
 */
const ActivityDataRef = builder.objectRef<ActivityData>('ActivityData');

/**
 * Convert model ID to human-readable display name
 */
function getModelDisplayName(modelId: string): string {
  if (modelId.includes('opus-4-6')) return 'Opus 4.6';
  if (modelId.includes('opus-4-5')) return 'Opus 4.5';
  if (modelId.includes('opus-4-1')) return 'Opus 4.1';
  if (modelId.includes('opus-4-')) return 'Opus 4';
  if (modelId.includes('sonnet-4-5')) return 'Sonnet 4.5';
  if (modelId.includes('sonnet-4-')) return 'Sonnet 4';
  if (modelId.includes('haiku-4-5')) return 'Haiku 4.5';
  if (modelId.includes('haiku-4-')) return 'Haiku 4';
  if (modelId.includes('sonnet-3-5')) return 'Sonnet 3.5';
  if (modelId.includes('haiku-3-5')) return 'Haiku 3.5';
  if (modelId.includes('opus-3')) return 'Opus 3';
  // Fallback: extract model family from ID
  const parts = modelId.split('-');
  if (parts.length >= 2) {
    return parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
  }
  return modelId;
}

/**
 * Activity data type implementation
 */
export const ActivityDataType = ActivityDataRef.implement({
  description: 'Complete activity data for dashboard visualizations',
  fields: (t) => ({
    dailyActivity: t.field({
      type: [DailyActivityType],
      description: 'Activity by day for heatmap (last 365 days)',
      resolve: (data) => data.dailyActivity,
    }),
    hourlyActivity: t.field({
      type: [HourlyActivityType],
      description: 'Activity by hour of day (0-23)',
      resolve: (data) => data.hourlyActivity,
    }),
    tokenUsage: t.field({
      type: TokenUsageStatsType,
      description: 'Aggregate token usage statistics',
      resolve: (data) => data.tokenUsage,
    }),
    streakDays: t.exposeInt('streakDays', {
      description: 'Current consecutive days with activity',
    }),
    totalActiveDays: t.exposeInt('totalActiveDays', {
      description: 'Total number of days with activity',
    }),
    dailyModelTokens: t.field({
      type: [DailyModelTokensType],
      description:
        'Daily token usage by model (from Claude Code stats, survives session cleanup)',
      resolve: (data) =>
        data.dailyModelTokens.map((d) => ({
          date: d.date,
          models: Object.entries(d.tokensByModel).map(([model, tokens]) => ({
            model,
            displayName: getModelDisplayName(model),
            tokens,
          })),
          totalTokens: Object.values(d.tokensByModel).reduce(
            (sum, t) => sum + t,
            0
          ),
        })),
    }),
    modelUsage: t.field({
      type: [ModelUsageStatsType],
      description:
        'Cumulative model usage (from Claude Code stats, survives session cleanup)',
      resolve: (data) => data.modelUsage,
    }),
    totalSessions: t.exposeInt('totalSessions', {
      description:
        'Total sessions from Claude Code stats (survives session cleanup)',
    }),
    totalMessages: t.exposeInt('totalMessages', {
      description:
        'Total messages from Claude Code stats (survives session cleanup)',
    }),
    firstSessionDate: t.exposeString('firstSessionDate', {
      description: 'Date of first session',
      nullable: true,
    }),
  }),
});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Stats cache data structure from ~/.claude/stats-cache.json
 */
interface StatsCache {
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
 * Read and parse stats-cache.json from ~/.claude/
 */
function readStatsCache(): StatsCache | null {
  try {
    const statsPath = join(homedir(), '.claude', 'stats-cache.json');
    if (!existsSync(statsPath)) {
      return null;
    }
    const content = readFileSync(statsPath, 'utf-8');
    return JSON.parse(content) as StatsCache;
  } catch (error) {
    console.error('Error reading stats-cache.json:', error);
    return null;
  }
}

/**
 * Calculate estimated cost based on Claude pricing
 */
function calculateCost(
  inputTokens: number,
  outputTokens: number,
  cachedTokens: number
): number {
  const inputCost = (inputTokens / 1_000_000) * 3.0;
  const outputCost = (outputTokens / 1_000_000) * 15.0;
  const cacheCost = (cachedTokens / 1_000_000) * 0.3;
  return inputCost + outputCost + cacheCost;
}

/**
 * Calculate streak days (consecutive days with activity)
 */
function calculateStreak(dailyActivity: DailyActivity[]): number {
  let streak = 0;
  const today = new Date().toISOString().split('T')[0];

  for (let i = dailyActivity.length - 1; i >= 0; i--) {
    const activity = dailyActivity[i];
    if (i === dailyActivity.length - 1 && activity.date !== today) {
      continue;
    }
    if (activity.messageCount > 0) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

// =============================================================================
// In-memory TTL Cache
// =============================================================================

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const activityCache = new Map<string, CacheEntry<ActivityData>>();
const ACTIVITY_CACHE_TTL_MS = 30_000; // 30 seconds

// =============================================================================
// Query Function
// =============================================================================

/**
 * Query activity data from the database.
 * Uses SQL aggregation via han-native for performance (~3 SQL queries instead of ~425 DB round-trips).
 */
export async function queryActivityData(days = 365): Promise<ActivityData> {
  const cacheKey = `${days}`;
  const cached = activityCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffStr = cutoffDate.toISOString();

  // Single native call replaces ~425 DB round-trips
  const agg = await queryActivityAggregates(cutoffStr);

  // Build daily activity map from SQL results
  const dailyMap = new Map<string, DailyActivity>();
  for (const row of agg.dailyActivity) {
    dailyMap.set(row.date, {
      date: row.date,
      sessionCount: row.sessionCount,
      messageCount: row.messageCount,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      cachedTokens: row.cacheReadTokens,
      linesAdded: row.linesAdded,
      linesRemoved: row.linesRemoved,
      filesChanged: row.filesChanged,
    });
  }

  // Fill in all days in the range
  const dailyActivity: DailyActivity[] = [];
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    dailyActivity.push(
      dailyMap.get(dateStr) || {
        date: dateStr,
        sessionCount: 0,
        messageCount: 0,
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 0,
        linesAdded: 0,
        linesRemoved: 0,
        filesChanged: 0,
      }
    );
  }
  dailyActivity.reverse();

  // Build hourly activity from SQL results (fill all 24 hours)
  const hourlyMap = new Map<number, HourlyActivity>();
  for (let h = 0; h < 24; h++) {
    hourlyMap.set(h, { hour: h, sessionCount: 0, messageCount: 0 });
  }
  for (const row of agg.hourlyActivity) {
    hourlyMap.set(row.hour, {
      hour: row.hour,
      sessionCount: row.sessionCount,
      messageCount: row.messageCount,
    });
  }
  const hourlyActivity = Array.from(hourlyMap.values()).sort(
    (a, b) => a.hour - b.hour
  );

  const tokenUsage: TokenUsageStats = {
    totalInputTokens: agg.totalInputTokens,
    totalOutputTokens: agg.totalOutputTokens,
    totalCachedTokens: agg.totalCacheReadTokens,
    totalTokens: agg.totalInputTokens + agg.totalOutputTokens,
    estimatedCostUsd: calculateCost(
      agg.totalInputTokens,
      agg.totalOutputTokens,
      agg.totalCacheReadTokens
    ),
    messageCount: agg.totalMessages,
    sessionCount: agg.totalSessions,
  };

  const streakDays = calculateStreak(dailyActivity);
  const totalActiveDays = dailyActivity.filter(
    (d) => d.messageCount > 0
  ).length;

  // Read stats-cache.json for model usage data (survives session cleanup)
  const statsCache = readStatsCache();

  const dailyModelTokens: DailyModelTokens[] =
    statsCache?.dailyModelTokens ?? [];
  const modelUsage: ModelUsageStats[] = statsCache?.modelUsage
    ? Object.entries(statsCache.modelUsage).map(([model, usage]) => ({
        model,
        displayName: getModelDisplayName(model),
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cacheReadTokens: usage.cacheReadInputTokens,
        cacheCreationTokens: usage.cacheCreationInputTokens,
        totalTokens: usage.inputTokens + usage.outputTokens,
      }))
    : [];

  const result: ActivityData = {
    dailyActivity,
    hourlyActivity,
    tokenUsage,
    streakDays,
    totalActiveDays,
    dailyModelTokens,
    modelUsage,
    totalSessions: statsCache?.totalSessions ?? agg.totalSessions,
    totalMessages: statsCache?.totalMessages ?? agg.totalMessages,
    firstSessionDate: statsCache?.firstSessionDate ?? null,
  };

  activityCache.set(cacheKey, {
    data: result,
    expiresAt: Date.now() + ACTIVITY_CACHE_TTL_MS,
  });

  return result;
}
