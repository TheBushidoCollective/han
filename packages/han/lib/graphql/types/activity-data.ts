/**
 * GraphQL ActivityData type
 *
 * Complete activity data for dashboard visualizations.
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { listSessions, messages } from '../../db/index.ts';
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
 * Parse token usage from raw JSONL message
 */
function parseTokensFromRawJson(rawJson: string | null): {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
} {
  if (!rawJson) return { inputTokens: 0, outputTokens: 0, cachedTokens: 0 };

  try {
    const parsed = JSON.parse(rawJson);
    const usage = parsed.message?.usage || parsed.usage;
    if (!usage) return { inputTokens: 0, outputTokens: 0, cachedTokens: 0 };

    return {
      inputTokens: usage.input_tokens || 0,
      outputTokens: usage.output_tokens || 0,
      cachedTokens:
        usage.cache_read_input_tokens || usage.cache_creation_input_tokens || 0,
    };
  } catch {
    return { inputTokens: 0, outputTokens: 0, cachedTokens: 0 };
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
 * Parse line changes from raw JSON message content
 */
function parseLineChangesFromRawJson(rawJson: string | null): {
  linesAdded: number;
  linesRemoved: number;
  filesChanged: Set<string>;
} {
  const result = {
    linesAdded: 0,
    linesRemoved: 0,
    filesChanged: new Set<string>(),
  };
  if (!rawJson) return result;

  try {
    const parsed = JSON.parse(rawJson);
    const content = parsed.message?.content || parsed.content || [];

    if (!Array.isArray(content)) return result;

    for (const block of content) {
      if (block.type === 'tool_use') {
        const toolName = block.name?.toLowerCase() || '';
        const input = block.input || {};

        if (toolName === 'edit' && input.file_path) {
          result.filesChanged.add(input.file_path);
          const oldLines = (input.old_string || '').split('\n').length;
          const newLines = (input.new_string || '').split('\n').length;
          if (newLines > oldLines) {
            result.linesAdded += newLines - oldLines;
          } else if (oldLines > newLines) {
            result.linesRemoved += oldLines - newLines;
          }
          if (input.old_string !== input.new_string) {
            result.linesAdded += Math.max(0, newLines);
            result.linesRemoved += Math.max(0, oldLines);
          }
        } else if (toolName === 'write' && input.file_path) {
          result.filesChanged.add(input.file_path);
          const contentLines = (input.content || '').split('\n').length;
          result.linesAdded += contentLines;
        }
      }
    }
  } catch {
    // Ignore parse errors
  }

  return result;
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
// Query Function
// =============================================================================

/**
 * Query activity data from the database
 *
 * @param days - Number of days of activity to include (default 365)
 * @param dataSource - Optional DataSource for context-based access. Uses LocalDataSource if not provided.
 */
export async function queryActivityData(days = 365): Promise<ActivityData> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffStr = cutoffDate.toISOString();

  const dailyMap = new Map<string, DailyActivity>();
  const hourlyMap = new Map<number, HourlyActivity>();
  const sessionSet = new Set<string>();

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCachedTokens = 0;
  let messageCount = 0;

  for (let h = 0; h < 24; h++) {
    hourlyMap.set(h, { hour: h, sessionCount: 0, messageCount: 0 });
  }

  try {
    const allSessions = await listSessions({ limit: 1000 });

    for (const session of allSessions) {
      const sessionMessages = await messages.list({
        sessionId: session.id,
        messageType: 'assistant',
        limit: 10000,
      });

      for (const msg of sessionMessages) {
        if (msg.timestamp < cutoffStr) continue;

        const date = msg.timestamp.split('T')[0];
        const hour = new Date(msg.timestamp).getHours();

        const daily = dailyMap.get(date) || {
          date,
          sessionCount: 0,
          messageCount: 0,
          inputTokens: 0,
          outputTokens: 0,
          cachedTokens: 0,
          linesAdded: 0,
          linesRemoved: 0,
          filesChanged: 0,
        };

        const tokens = parseTokensFromRawJson(msg.rawJson ?? null);
        const lineChanges = parseLineChangesFromRawJson(msg.rawJson ?? null);
        daily.messageCount++;
        daily.inputTokens += tokens.inputTokens;
        daily.outputTokens += tokens.outputTokens;
        daily.cachedTokens += tokens.cachedTokens;
        daily.linesAdded += lineChanges.linesAdded;
        daily.linesRemoved += lineChanges.linesRemoved;
        const existingFiles =
          (daily as { _filesSet?: Set<string> })._filesSet || new Set<string>();
        for (const file of lineChanges.filesChanged) {
          existingFiles.add(file);
        }
        (daily as { _filesSet?: Set<string> })._filesSet = existingFiles;
        daily.filesChanged = existingFiles.size;
        dailyMap.set(date, daily);

        const hourly = hourlyMap.get(hour);
        if (hourly) hourly.messageCount++;

        totalInputTokens += tokens.inputTokens;
        totalOutputTokens += tokens.outputTokens;
        totalCachedTokens += tokens.cachedTokens;
        messageCount++;

        sessionSet.add(session.id);
      }

      if (sessionMessages.length > 0) {
        const firstMsg = sessionMessages[0];
        if (firstMsg.timestamp >= cutoffStr) {
          const date = firstMsg.timestamp.split('T')[0];
          const hour = new Date(firstMsg.timestamp).getHours();

          const daily = dailyMap.get(date);
          if (daily) daily.sessionCount++;

          const hourly = hourlyMap.get(hour);
          if (hourly) hourly.sessionCount++;
        }
      }
    }
  } catch (error) {
    console.error('Error querying activity data:', error);
  }

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

  const hourlyActivity = Array.from(hourlyMap.values()).sort(
    (a, b) => a.hour - b.hour
  );

  const tokenUsage: TokenUsageStats = {
    totalInputTokens,
    totalOutputTokens,
    totalCachedTokens,
    totalTokens: totalInputTokens + totalOutputTokens,
    estimatedCostUsd: calculateCost(
      totalInputTokens,
      totalOutputTokens,
      totalCachedTokens
    ),
    messageCount,
    sessionCount: sessionSet.size,
  };

  const streakDays = calculateStreak(dailyActivity);
  const totalActiveDays = dailyActivity.filter(
    (d) => d.messageCount > 0
  ).length;

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

  return {
    dailyActivity,
    hourlyActivity,
    tokenUsage,
    streakDays,
    totalActiveDays,
    dailyModelTokens,
    modelUsage,
    totalSessions: statsCache?.totalSessions ?? sessionSet.size,
    totalMessages: statsCache?.totalMessages ?? messageCount,
    firstSessionDate: statsCache?.firstSessionDate ?? null,
  };
}
