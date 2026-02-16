/**
 * GraphQL ActivityData type
 *
 * Complete activity data for dashboard visualizations.
 */

import { queryActivityAggregates } from '../../grpc/data-access.ts';
import {
  calculateDefaultCost,
  calculateModelCost,
} from '../../pricing/model-pricing.ts';
import { getAggregatedStats } from '../../pricing/stats-reader.ts';
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
  // Parse: claude-{family}-{major}[-{minor}][-{date}]
  const match = modelId.match(/claude-(\w+)-(\d+)(?:-(\d+))?(?:-\d{8})?$/);
  if (match) {
    const family = match[1].charAt(0).toUpperCase() + match[1].slice(1);
    const major = match[2];
    const minor = match[3];
    return minor ? `${family} ${major}.${minor}` : `${family} ${major}`;
  }
  // Fallback: capitalize second segment
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
    estimatedCostUsd: calculateDefaultCost(
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

  // Read stats-cache.json from ALL registered config dirs (multi-environment)
  const aggregatedStats = await getAggregatedStats();

  const dailyModelTokens: DailyModelTokens[] = aggregatedStats.dailyModelTokens;
  const modelUsage: ModelUsageStats[] = Object.entries(
    aggregatedStats.modelUsage
  ).map(([model, usage]) => ({
    model,
    displayName: getModelDisplayName(model),
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cacheReadTokens: usage.cacheReadInputTokens,
    cacheCreationTokens: usage.cacheCreationInputTokens,
    totalTokens: usage.inputTokens + usage.outputTokens,
    costUsd: calculateModelCost(
      model,
      usage.inputTokens,
      usage.outputTokens,
      usage.cacheReadInputTokens,
      usage.cacheCreationInputTokens
    ),
  }));

  const result: ActivityData = {
    dailyActivity,
    hourlyActivity,
    tokenUsage,
    streakDays,
    totalActiveDays,
    dailyModelTokens,
    modelUsage,
    totalSessions: aggregatedStats.hasStatsCacheData
      ? aggregatedStats.totalSessions
      : agg.totalSessions,
    totalMessages: aggregatedStats.hasStatsCacheData
      ? aggregatedStats.totalMessages
      : agg.totalMessages,
    firstSessionDate: aggregatedStats.firstSessionDate,
  };

  activityCache.set(cacheKey, {
    data: result,
    expiresAt: Date.now() + ACTIVITY_CACHE_TTL_MS,
  });

  return result;
}
