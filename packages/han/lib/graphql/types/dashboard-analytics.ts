/**
 * GraphQL DashboardAnalytics type
 *
 * Aggregated analytics data for the enhanced dashboard view.
 * Includes subagent usage, compaction stats, session effectiveness,
 * tool usage, hook health, and cost analysis.
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { getHookExecutionsForSession } from '../../api/hooks.ts';
import { listSessions, messages } from '../../db/index.ts';
import { builder } from '../builder.ts';

// =============================================================================
// TypeScript Interfaces
// =============================================================================

/**
 * Tracks which subagent types are used most
 */
export interface SubagentUsageStats {
  subagentType: string;
  count: number;
}

/**
 * Tracks context compression events
 */
export interface CompactionStats {
  totalCompactions: number;
  sessionsWithCompactions: number;
  sessionsWithoutCompactions: number;
  avgCompactionsPerSession: number;
  autoCompactCount: number;
  manualCompactCount: number;
  continuationCount: number;
}

/**
 * Composite effectiveness score for a session
 */
export interface SessionEffectiveness {
  sessionId: string;
  slug: string | null;
  score: number;
  sentimentTrend: string;
  avgSentimentScore: number;
  turnCount: number;
  taskCompletionRate: number;
  compactionCount: number;
  focusScore: number;
  startedAt: string | null;
}

/**
 * Tool usage frequency stats
 */
export interface ToolUsageStats {
  toolName: string;
  count: number;
}

/**
 * Hook pass/fail rates per hook name
 */
export interface HookHealthStats {
  hookName: string;
  totalRuns: number;
  passCount: number;
  failCount: number;
  passRate: number;
  avgDurationMs: number;
}

/**
 * Daily cost data point
 */
export interface DailyCost {
  date: string;
  costUsd: number;
  sessionCount: number;
}

/**
 * Cost tracking with subscription context
 */
export interface CostAnalysis {
  estimatedCostUsd: number;
  maxSubscriptionCostUsd: number;
  costUtilizationPercent: number;
  dailyCostTrend: DailyCost[];
  costPerSession: number;
  costPerCompletedTask: number;
  cacheHitRate: number;
  potentialSavingsUsd: number;
}

/**
 * Main analytics container
 */
export interface DashboardAnalytics {
  subagentUsage: SubagentUsageStats[];
  compactionStats: CompactionStats;
  topSessions: SessionEffectiveness[];
  bottomSessions: SessionEffectiveness[];
  toolUsage: ToolUsageStats[];
  hookHealth: HookHealthStats[];
  costAnalysis: CostAnalysis;
}

// =============================================================================
// GraphQL Type Definitions
// =============================================================================

const SubagentUsageStatsRef =
  builder.objectRef<SubagentUsageStats>('SubagentUsageStats');

export const SubagentUsageStatsType = SubagentUsageStatsRef.implement({
  description: 'Subagent type usage statistics',
  fields: (t) => ({
    subagentType: t.exposeString('subagentType', {
      description:
        'Subagent type name (e.g., "Explore", "Plan", "general-purpose")',
    }),
    count: t.exposeInt('count', {
      description: 'Number of times this subagent type was used',
    }),
  }),
});

const CompactionStatsRef =
  builder.objectRef<CompactionStats>('CompactionStats');

export const CompactionStatsType = CompactionStatsRef.implement({
  description: 'Context compaction statistics',
  fields: (t) => ({
    totalCompactions: t.exposeInt('totalCompactions', {
      description: 'Total number of compaction events',
    }),
    sessionsWithCompactions: t.exposeInt('sessionsWithCompactions', {
      description: 'Number of sessions that had at least one compaction',
    }),
    sessionsWithoutCompactions: t.exposeInt('sessionsWithoutCompactions', {
      description: 'Number of sessions with no compactions',
    }),
    avgCompactionsPerSession: t.exposeFloat('avgCompactionsPerSession', {
      description: 'Average compactions per session',
    }),
    autoCompactCount: t.exposeInt('autoCompactCount', {
      description: 'Number of automatic compactions',
    }),
    manualCompactCount: t.exposeInt('manualCompactCount', {
      description: 'Number of manual compactions',
    }),
    continuationCount: t.exposeInt('continuationCount', {
      description: 'Number of continuation-type compactions',
    }),
  }),
});

const SessionEffectivenessRef =
  builder.objectRef<SessionEffectiveness>('SessionEffectiveness');

export const SessionEffectivenessType = SessionEffectivenessRef.implement({
  description: 'Composite effectiveness score for a session',
  fields: (t) => ({
    sessionId: t.exposeString('sessionId', {
      description: 'Session identifier',
    }),
    slug: t.exposeString('slug', {
      nullable: true,
      description: 'Human-readable session slug',
    }),
    score: t.exposeFloat('score', {
      description: 'Composite score (0-100)',
    }),
    sentimentTrend: t.exposeString('sentimentTrend', {
      description:
        'Sentiment trend ("improving", "declining", "stable", "neutral")',
    }),
    avgSentimentScore: t.exposeFloat('avgSentimentScore', {
      description: 'Average sentiment score (-5 to +5)',
    }),
    turnCount: t.exposeInt('turnCount', {
      description: 'Number of conversation turns',
    }),
    taskCompletionRate: t.exposeFloat('taskCompletionRate', {
      description: 'Task completion rate (0 to 1)',
    }),
    compactionCount: t.exposeInt('compactionCount', {
      description: 'Number of compactions in this session',
    }),
    focusScore: t.exposeFloat('focusScore', {
      description: 'Focus score (0 to 1, fewer unique tools = more focused)',
    }),
    startedAt: t.exposeString('startedAt', {
      nullable: true,
      description: 'Session start timestamp',
    }),
  }),
});

const ToolUsageStatsRef = builder.objectRef<ToolUsageStats>('ToolUsageStats');

export const ToolUsageStatsType = ToolUsageStatsRef.implement({
  description: 'Tool usage frequency statistics',
  fields: (t) => ({
    toolName: t.exposeString('toolName', {
      description: 'Name of the tool',
    }),
    count: t.exposeInt('count', {
      description: 'Number of times the tool was used',
    }),
  }),
});

const HookHealthStatsRef =
  builder.objectRef<HookHealthStats>('HookHealthStats');

export const HookHealthStatsType = HookHealthStatsRef.implement({
  description: 'Hook health and pass/fail statistics',
  fields: (t) => ({
    hookName: t.exposeString('hookName', {
      description: 'Name of the hook',
    }),
    totalRuns: t.exposeInt('totalRuns', {
      description: 'Total number of executions',
    }),
    passCount: t.exposeInt('passCount', {
      description: 'Number of successful executions',
    }),
    failCount: t.exposeInt('failCount', {
      description: 'Number of failed executions',
    }),
    passRate: t.exposeFloat('passRate', {
      description: 'Pass rate (0 to 1)',
    }),
    avgDurationMs: t.exposeFloat('avgDurationMs', {
      description: 'Average execution duration in milliseconds',
    }),
  }),
});

const DailyCostRef = builder.objectRef<DailyCost>('DailyCost');

export const DailyCostType = DailyCostRef.implement({
  description: 'Daily cost data point',
  fields: (t) => ({
    date: t.exposeString('date', {
      description: 'Date in YYYY-MM-DD format',
    }),
    costUsd: t.exposeFloat('costUsd', {
      description: 'Estimated cost in USD for this day',
    }),
    sessionCount: t.exposeInt('sessionCount', {
      description: 'Number of sessions on this day',
    }),
  }),
});

const CostAnalysisRef = builder.objectRef<CostAnalysis>('CostAnalysis');

export const CostAnalysisType = CostAnalysisRef.implement({
  description: 'Cost analysis with subscription context',
  fields: (t) => ({
    estimatedCostUsd: t.exposeFloat('estimatedCostUsd', {
      description: 'Total estimated cost in USD',
    }),
    maxSubscriptionCostUsd: t.exposeFloat('maxSubscriptionCostUsd', {
      description:
        'Maximum subscription cost (e.g., $200 for Max plan, $100 for Pro)',
    }),
    costUtilizationPercent: t.exposeFloat('costUtilizationPercent', {
      description: 'Percentage of subscription cost utilized',
    }),
    dailyCostTrend: t.field({
      type: [DailyCostType],
      description: 'Daily cost breakdown',
      resolve: (data) => data.dailyCostTrend,
    }),
    costPerSession: t.exposeFloat('costPerSession', {
      description: 'Average cost per session',
    }),
    costPerCompletedTask: t.exposeFloat('costPerCompletedTask', {
      description: 'Average cost per completed task',
    }),
    cacheHitRate: t.exposeFloat('cacheHitRate', {
      description: 'Cache hit rate (0 to 1)',
    }),
    potentialSavingsUsd: t.exposeFloat('potentialSavingsUsd', {
      description: 'Potential savings if cache hit rate were optimal',
    }),
  }),
});

const DashboardAnalyticsRef =
  builder.objectRef<DashboardAnalytics>('DashboardAnalytics');

export const DashboardAnalyticsType = DashboardAnalyticsRef.implement({
  description: 'Aggregated dashboard analytics data',
  fields: (t) => ({
    subagentUsage: t.field({
      type: [SubagentUsageStatsType],
      description: 'Subagent type usage breakdown',
      resolve: (data) => data.subagentUsage,
    }),
    compactionStats: t.field({
      type: CompactionStatsType,
      description: 'Context compaction statistics',
      resolve: (data) => data.compactionStats,
    }),
    topSessions: t.field({
      type: [SessionEffectivenessType],
      description: 'Top-scoring sessions by effectiveness',
      resolve: (data) => data.topSessions,
    }),
    bottomSessions: t.field({
      type: [SessionEffectivenessType],
      description: 'Lowest-scoring sessions by effectiveness',
      resolve: (data) => data.bottomSessions,
    }),
    toolUsage: t.field({
      type: [ToolUsageStatsType],
      description: 'Tool usage frequency breakdown',
      resolve: (data) => data.toolUsage,
    }),
    hookHealth: t.field({
      type: [HookHealthStatsType],
      description: 'Hook health and pass/fail rates',
      resolve: (data) => data.hookHealth,
    }),
    costAnalysis: t.field({
      type: CostAnalysisType,
      description: 'Cost analysis with subscription context',
      resolve: (data) => data.costAnalysis,
    }),
  }),
});

// =============================================================================
// Helper Functions
// =============================================================================

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
 * Parse token usage from raw JSONL message
 */
function parseTokensFromRawJson(rawJson: string | null): {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
} {
  if (!rawJson) {
    return {
      inputTokens: 0,
      outputTokens: 0,
      cachedTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
    };
  }

  try {
    const parsed = JSON.parse(rawJson);
    const usage = parsed.message?.usage || parsed.usage;
    if (!usage) {
      return {
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
      };
    }

    const cacheRead = usage.cache_read_input_tokens || 0;
    const cacheCreation = usage.cache_creation_input_tokens || 0;

    return {
      inputTokens: usage.input_tokens || 0,
      outputTokens: usage.output_tokens || 0,
      cachedTokens: cacheRead || cacheCreation || 0,
      cacheReadTokens: cacheRead,
      cacheCreationTokens: cacheCreation,
    };
  } catch {
    return {
      inputTokens: 0,
      outputTokens: 0,
      cachedTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
    };
  }
}

/**
 * Read stats-cache.json from ~/.claude/ for model usage data
 */
function readStatsCache(): {
  modelUsage?: Record<
    string,
    {
      inputTokens: number;
      outputTokens: number;
      cacheReadInputTokens: number;
      cacheCreationInputTokens: number;
      costUSD: number;
    }
  >;
} | null {
  try {
    const statsPath = join(homedir(), '.claude', 'stats-cache.json');
    if (!existsSync(statsPath)) {
      return null;
    }
    const content = readFileSync(statsPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Determine sentiment trend from a series of sentiment scores
 */
function computeSentimentTrend(scores: number[]): string {
  if (scores.length < 2) return 'neutral';

  const mid = Math.floor(scores.length / 2);
  const firstHalf = scores.slice(0, mid);
  const secondHalf = scores.slice(mid);

  const avgFirst =
    firstHalf.length > 0
      ? firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length
      : 0;
  const avgSecond =
    secondHalf.length > 0
      ? secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length
      : 0;

  const diff = avgSecond - avgFirst;
  if (diff > 0.5) return 'improving';
  if (diff < -0.5) return 'declining';
  return 'stable';
}

// =============================================================================
// Query Function
// =============================================================================

/**
 * Query dashboard analytics data from the database
 */
export async function queryDashboardAnalytics(
  days = 30
): Promise<DashboardAnalytics> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffStr = cutoffDate.toISOString();

  // Data accumulators
  const subagentCounts = new Map<string, number>();
  const toolCounts = new Map<string, number>();
  const dailyCostMap = new Map<
    string,
    { costUsd: number; sessionCount: number }
  >();
  const sessionsWithCompactions = new Set<string>();
  let totalCompactions = 0;
  let autoCompactCount = 0;
  let manualCompactCount = 0;
  let continuationCount = 0;

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCachedTokens = 0;
  let totalCacheReadTokens = 0;
  let totalSessions = 0;
  let totalCompletedTasks = 0;

  // Per-session data for effectiveness scoring
  const sessionData: Array<{
    sessionId: string;
    slug: string | null;
    turnCount: number;
    sentimentScores: number[];
    compactionCount: number;
    toolNames: Set<string>;
    taskTotal: number;
    taskCompleted: number;
    startedAt: string | null;
  }> = [];

  // Hook health accumulators
  const hookStats = new Map<
    string,
    {
      totalRuns: number;
      passCount: number;
      failCount: number;
      totalDurationMs: number;
    }
  >();

  try {
    const allSessions = await listSessions({ limit: 1000 });

    for (const session of allSessions) {
      // Fetch assistant messages for token/cost data
      const assistantMessages = await messages.list({
        sessionId: session.id,
        messageType: 'assistant',
        limit: 10000,
      });

      // Check if session is within our time window
      const sessionStartedAt =
        assistantMessages.length > 0
          ? assistantMessages[0].timestamp
          : null;

      if (sessionStartedAt && sessionStartedAt < cutoffStr) continue;

      totalSessions++;

      const sessionToolNames = new Set<string>();
      const sentimentScores: number[] = [];
      let sessionCompactions = 0;
      let sessionInputTokens = 0;
      let sessionOutputTokens = 0;
      let sessionCachedTokens = 0;

      // Process assistant messages for token data
      for (const msg of assistantMessages) {
        if (msg.timestamp < cutoffStr) continue;

        const tokens = parseTokensFromRawJson(msg.rawJson ?? null);
        sessionInputTokens += tokens.inputTokens;
        sessionOutputTokens += tokens.outputTokens;
        sessionCachedTokens += tokens.cachedTokens;
        totalCacheReadTokens += tokens.cacheReadTokens;

        if (
          msg.sentimentScore !== undefined &&
          msg.sentimentScore !== null
        ) {
          sentimentScores.push(msg.sentimentScore);
        }
      }

      totalInputTokens += sessionInputTokens;
      totalOutputTokens += sessionOutputTokens;
      totalCachedTokens += sessionCachedTokens;

      // Track daily cost
      if (sessionStartedAt) {
        const date = sessionStartedAt.split('T')[0];
        const sessionCost = calculateCost(
          sessionInputTokens,
          sessionOutputTokens,
          sessionCachedTokens
        );
        const existing = dailyCostMap.get(date) || {
          costUsd: 0,
          sessionCount: 0,
        };
        existing.costUsd += sessionCost;
        existing.sessionCount++;
        dailyCostMap.set(date, existing);
      }

      // Fetch tool_use messages for tool usage and subagent tracking
      const toolUseMessages = await messages.list({
        sessionId: session.id,
        messageType: 'tool_use',
        limit: 10000,
      });

      for (const msg of toolUseMessages) {
        if (msg.timestamp < cutoffStr) continue;

        const toolName = msg.toolName;
        if (toolName) {
          toolCounts.set(toolName, (toolCounts.get(toolName) || 0) + 1);
          sessionToolNames.add(toolName);

          // Extract subagent type from Task tool calls
          if (toolName === 'Task' && msg.toolInput) {
            try {
              const input = JSON.parse(msg.toolInput);
              const subagentType =
                input.subagent_type || input.subagentType || 'general-purpose';
              subagentCounts.set(
                subagentType,
                (subagentCounts.get(subagentType) || 0) + 1
              );
            } catch {
              subagentCounts.set(
                'general-purpose',
                (subagentCounts.get('general-purpose') || 0) + 1
              );
            }
          }

          // Track task completions from TaskUpdate tool calls
          if (toolName === 'TaskUpdate' && msg.toolInput) {
            try {
              const input = JSON.parse(msg.toolInput);
              if (input.status === 'completed') {
                totalCompletedTasks++;
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

      // Fetch summary messages for compaction tracking
      const summaryMessages = await messages.list({
        sessionId: session.id,
        messageType: 'summary',
        limit: 10000,
      });

      for (const msg of summaryMessages) {
        if (msg.timestamp < cutoffStr) continue;

        totalCompactions++;
        sessionCompactions++;
        sessionsWithCompactions.add(session.id);

        // Classify compaction type from raw JSON
        if (msg.rawJson) {
          const rawLower = msg.rawJson.toLowerCase();
          if (
            rawLower.includes('auto_compact') ||
            rawLower.includes('auto-compact')
          ) {
            autoCompactCount++;
          } else if (rawLower.includes('continuation')) {
            continuationCount++;
          } else {
            manualCompactCount++;
          }
        } else {
          autoCompactCount++;
        }
      }

      // Count user turns for effectiveness
      const userMessages = await messages.list({
        sessionId: session.id,
        messageType: 'human',
        limit: 10000,
      });
      const turnCount = userMessages.filter(
        (m) => m.timestamp >= cutoffStr
      ).length;

      // Count native tasks for task completion rate
      let taskTotal = 0;
      let taskCompleted = 0;
      const taskMessages = await messages.list({
        sessionId: session.id,
        messageType: 'tool_use',
        limit: 10000,
      });
      for (const msg of taskMessages) {
        if (msg.timestamp < cutoffStr) continue;
        if (msg.toolName === 'TaskCreate') {
          taskTotal++;
        }
        if (msg.toolName === 'TaskUpdate' && msg.toolInput) {
          try {
            const input = JSON.parse(msg.toolInput);
            if (input.status === 'completed') {
              taskCompleted++;
            }
          } catch {
            // Ignore
          }
        }
      }

      // Collect hook executions for this session
      try {
        const hookExecs = await getHookExecutionsForSession(session.id);
        for (const exec of hookExecs) {
          if (exec.timestamp < cutoffStr) continue;

          const name = exec.hookName;
          const existing = hookStats.get(name) || {
            totalRuns: 0,
            passCount: 0,
            failCount: 0,
            totalDurationMs: 0,
          };
          existing.totalRuns++;
          if (exec.passed) {
            existing.passCount++;
          } else {
            existing.failCount++;
          }
          existing.totalDurationMs += exec.durationMs;
          hookStats.set(name, existing);
        }
      } catch {
        // Ignore hook execution errors for individual sessions
      }

      sessionData.push({
        sessionId: session.id,
        slug: session.slug ?? null,
        turnCount,
        sentimentScores,
        compactionCount: sessionCompactions,
        toolNames: sessionToolNames,
        taskTotal,
        taskCompleted,
        startedAt: sessionStartedAt,
      });
    }
  } catch (error) {
    console.error('Error querying dashboard analytics:', error);
  }

  // ==========================================================================
  // Build subagent usage
  // ==========================================================================
  const subagentUsage: SubagentUsageStats[] = Array.from(
    subagentCounts.entries()
  )
    .map(([subagentType, count]) => ({ subagentType, count }))
    .sort((a, b) => b.count - a.count);

  // ==========================================================================
  // Build compaction stats
  // ==========================================================================
  const sessionsWithoutCompactions =
    totalSessions - sessionsWithCompactions.size;
  const compactionStats: CompactionStats = {
    totalCompactions,
    sessionsWithCompactions: sessionsWithCompactions.size,
    sessionsWithoutCompactions:
      sessionsWithoutCompactions > 0 ? sessionsWithoutCompactions : 0,
    avgCompactionsPerSession:
      totalSessions > 0
        ? Math.round((totalCompactions / totalSessions) * 100) / 100
        : 0,
    autoCompactCount,
    manualCompactCount,
    continuationCount,
  };

  // ==========================================================================
  // Build session effectiveness scores
  // ==========================================================================
  const scoredSessions: SessionEffectiveness[] = sessionData.map((s) => {
    const avgSentiment =
      s.sentimentScores.length > 0
        ? s.sentimentScores.reduce((sum, v) => sum + v, 0) /
          s.sentimentScores.length
        : 0;

    // Normalize sentiment from [-5, +5] to [0, 100]
    const sentimentComponent = ((avgSentiment + 5) / 10) * 100;

    // Turn efficiency: inverse of turns relative to tasks (lower turns per task = better)
    const turnsPerTask =
      s.taskCompleted > 0 ? s.turnCount / s.taskCompleted : s.turnCount;
    const turnEfficiency = Math.max(
      0,
      Math.min(100, 100 - Math.min(turnsPerTask, 50) * 2)
    );

    // Task completion rate
    const taskCompletionRate =
      s.taskTotal > 0 ? s.taskCompleted / s.taskTotal : 0;

    // Compaction penalty: fewer compactions = better (0 compactions = 100, 5+ = 0)
    const compactionPenaltyScore = Math.max(
      0,
      100 - s.compactionCount * 20
    );

    // Focus score: fewer unique tools suggests more focused work
    const uniqueToolCount = s.toolNames.size;
    const focusScore =
      uniqueToolCount > 0
        ? Math.max(0, Math.min(1, 1 - (uniqueToolCount - 3) / 20))
        : 0.5;

    // Composite score with weights
    const score =
      sentimentComponent * 0.25 +
      turnEfficiency * 0.2 +
      taskCompletionRate * 100 * 0.25 +
      compactionPenaltyScore * 0.15 +
      focusScore * 100 * 0.15;

    return {
      sessionId: s.sessionId,
      slug: s.slug,
      score: Math.round(score * 100) / 100,
      sentimentTrend: computeSentimentTrend(s.sentimentScores),
      avgSentimentScore: Math.round(avgSentiment * 100) / 100,
      turnCount: s.turnCount,
      taskCompletionRate:
        Math.round(taskCompletionRate * 1000) / 1000,
      compactionCount: s.compactionCount,
      focusScore: Math.round(focusScore * 1000) / 1000,
      startedAt: s.startedAt,
    };
  });

  scoredSessions.sort((a, b) => b.score - a.score);

  const topSessions = scoredSessions.slice(0, 10);
  const bottomSessions = scoredSessions
    .slice(-10)
    .reverse();

  // ==========================================================================
  // Build tool usage
  // ==========================================================================
  const toolUsage: ToolUsageStats[] = Array.from(toolCounts.entries())
    .map(([toolName, count]) => ({ toolName, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  // ==========================================================================
  // Build hook health
  // ==========================================================================
  const hookHealth: HookHealthStats[] = Array.from(hookStats.entries())
    .map(([hookName, stats]) => ({
      hookName,
      totalRuns: stats.totalRuns,
      passCount: stats.passCount,
      failCount: stats.failCount,
      passRate:
        stats.totalRuns > 0
          ? Math.round((stats.passCount / stats.totalRuns) * 1000) / 1000
          : 1,
      avgDurationMs:
        stats.totalRuns > 0
          ? Math.round(stats.totalDurationMs / stats.totalRuns)
          : 0,
    }))
    .sort((a, b) => b.totalRuns - a.totalRuns);

  // ==========================================================================
  // Build cost analysis
  // ==========================================================================
  const estimatedCostUsd = calculateCost(
    totalInputTokens,
    totalOutputTokens,
    totalCachedTokens
  );

  // Check stats-cache for more accurate cost data
  const statsCache = readStatsCache();
  let statsCacheCost = 0;
  if (statsCache?.modelUsage) {
    for (const usage of Object.values(statsCache.modelUsage)) {
      statsCacheCost += usage.costUSD || 0;
    }
  }

  const finalCostUsd =
    statsCacheCost > 0 ? statsCacheCost : estimatedCostUsd;

  // Default subscription cost (Max plan at $200/month)
  const maxSubscriptionCostUsd = 200;

  // Compute daily cost trend
  const dailyCostTrend: DailyCost[] = [];
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayData = dailyCostMap.get(dateStr);
    dailyCostTrend.push({
      date: dateStr,
      costUsd: dayData
        ? Math.round(dayData.costUsd * 10000) / 10000
        : 0,
      sessionCount: dayData ? dayData.sessionCount : 0,
    });
  }
  dailyCostTrend.reverse();

  // Cache hit rate: ratio of cache read tokens to total input tokens
  const totalTokensForCache = totalInputTokens + totalCacheReadTokens;
  const cacheHitRate =
    totalTokensForCache > 0
      ? Math.round((totalCacheReadTokens / totalTokensForCache) * 1000) /
        1000
      : 0;

  // Potential savings: estimate savings if cache hit rate were 80%
  const optimalCacheRate = 0.8;
  const currentNonCachedInputCost =
    ((totalInputTokens - totalCacheReadTokens) / 1_000_000) * 3.0;
  const savingsIfOptimal =
    cacheHitRate < optimalCacheRate
      ? currentNonCachedInputCost * (optimalCacheRate - cacheHitRate)
      : 0;

  const costAnalysis: CostAnalysis = {
    estimatedCostUsd: Math.round(finalCostUsd * 100) / 100,
    maxSubscriptionCostUsd,
    costUtilizationPercent:
      maxSubscriptionCostUsd > 0
        ? Math.round(
            (finalCostUsd / maxSubscriptionCostUsd) * 10000
          ) / 100
        : 0,
    dailyCostTrend,
    costPerSession:
      totalSessions > 0
        ? Math.round((finalCostUsd / totalSessions) * 10000) / 10000
        : 0,
    costPerCompletedTask:
      totalCompletedTasks > 0
        ? Math.round((finalCostUsd / totalCompletedTasks) * 10000) /
          10000
        : 0,
    cacheHitRate,
    potentialSavingsUsd: Math.round(savingsIfOptimal * 100) / 100,
  };

  return {
    subagentUsage,
    compactionStats,
    topSessions,
    bottomSessions,
    toolUsage,
    hookHealth,
    costAnalysis,
  };
}
