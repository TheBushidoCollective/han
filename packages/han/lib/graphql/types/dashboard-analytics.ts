/**
 * GraphQL DashboardAnalytics type
 *
 * Aggregated analytics data for the enhanced dashboard view.
 * Includes subagent usage, compaction stats, session effectiveness,
 * tool usage, hook health, and cost analysis.
 */

import { queryDashboardAggregates } from '../../db/index.ts';
import {
  calculateCacheSavings,
  calculateDefaultCost,
  calculateTotalCostFromModelUsage,
  DEFAULT_PRICING,
} from '../../pricing/model-pricing.ts';
import { getAggregatedStats } from '../../pricing/stats-reader.ts';
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
  summary: string | null;
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
 * Weekly cost aggregation
 */
export interface WeeklyCost {
  weekStart: string;
  weekLabel: string;
  costUsd: number;
  sessionCount: number;
  avgDailyCost: number;
}

/**
 * Per-session cost breakdown (top spenders)
 */
export interface SessionCost {
  sessionId: string;
  slug: string | null;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  messageCount: number;
  startedAt: string | null;
}

/**
 * Comparison of a subscription tier vs API credits
 */
export interface SubscriptionComparison {
  tierName: string;
  monthlyCostUsd: number;
  apiCreditCostUsd: number;
  savingsUsd: number;
  savingsPercent: number;
  recommendation: string;
}

/**
 * Cost tracking with subscription context
 */
export interface CostAnalysis {
  estimatedCostUsd: number;
  isEstimated: boolean;
  billingType: string | null;
  cacheSavingsUsd: number;
  maxSubscriptionCostUsd: number;
  costUtilizationPercent: number;
  dailyCostTrend: DailyCost[];
  weeklyCostTrend: WeeklyCost[];
  topSessionsByCost: SessionCost[];
  costPerSession: number;
  costPerCompletedTask: number;
  cacheHitRate: number;
  potentialSavingsUsd: number;
  subscriptionComparisons: SubscriptionComparison[];
  breakEvenDailySpend: number;
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

const SessionEffectivenessRef = builder.objectRef<SessionEffectiveness>(
  'SessionEffectiveness'
);

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
    summary: t.exposeString('summary', {
      nullable: true,
      description: 'Generated session summary text',
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

const WeeklyCostRef = builder.objectRef<WeeklyCost>('WeeklyCost');

export const WeeklyCostType = WeeklyCostRef.implement({
  description: 'Weekly cost aggregation',
  fields: (t) => ({
    weekStart: t.exposeString('weekStart', {
      description: 'Monday of the week (YYYY-MM-DD)',
    }),
    weekLabel: t.exposeString('weekLabel', {
      description: 'Human-readable week label (e.g., "Jan 27 - Feb 2")',
    }),
    costUsd: t.exposeFloat('costUsd', {
      description: 'Total estimated cost for this week',
    }),
    sessionCount: t.exposeInt('sessionCount', {
      description: 'Number of sessions this week',
    }),
    avgDailyCost: t.exposeFloat('avgDailyCost', {
      description: 'Average daily cost this week',
    }),
  }),
});

const SessionCostRef = builder.objectRef<SessionCost>('SessionCost');

export const SessionCostType = SessionCostRef.implement({
  description: 'Per-session cost breakdown',
  fields: (t) => ({
    sessionId: t.exposeString('sessionId', {
      description: 'Session identifier',
    }),
    slug: t.exposeString('slug', {
      nullable: true,
      description: 'Human-readable session slug',
    }),
    costUsd: t.exposeFloat('costUsd', {
      description: 'Estimated cost for this session',
    }),
    inputTokens: t.exposeInt('inputTokens', {
      description: 'Total input tokens consumed',
    }),
    outputTokens: t.exposeInt('outputTokens', {
      description: 'Total output tokens generated',
    }),
    cacheReadTokens: t.exposeInt('cacheReadTokens', {
      description: 'Tokens served from cache',
    }),
    messageCount: t.exposeInt('messageCount', {
      description: 'Total messages in session',
    }),
    startedAt: t.exposeString('startedAt', {
      nullable: true,
      description: 'Session start timestamp',
    }),
  }),
});

const SubscriptionComparisonRef = builder.objectRef<SubscriptionComparison>(
  'SubscriptionComparison'
);

export const SubscriptionComparisonType = SubscriptionComparisonRef.implement({
  description: 'Comparison of a subscription tier vs API credits',
  fields: (t) => ({
    tierName: t.exposeString('tierName', {
      description: 'Subscription tier name (e.g., "Max 5x", "Max 20x")',
    }),
    monthlyCostUsd: t.exposeFloat('monthlyCostUsd', {
      description: 'Monthly subscription cost in USD',
    }),
    apiCreditCostUsd: t.exposeFloat('apiCreditCostUsd', {
      description: 'Equivalent API credit cost for the same usage',
    }),
    savingsUsd: t.exposeFloat('savingsUsd', {
      description:
        'Amount saved with subscription vs API (positive = subscription cheaper)',
    }),
    savingsPercent: t.exposeFloat('savingsPercent', {
      description:
        'Percentage saved vs API credits (positive = subscription cheaper)',
    }),
    recommendation: t.exposeString('recommendation', {
      description:
        'Plan recommendation: "recommended", "overkill", or "good_value"',
    }),
  }),
});

const CostAnalysisRef = builder.objectRef<CostAnalysis>('CostAnalysis');

export const CostAnalysisType = CostAnalysisRef.implement({
  description: 'Cost analysis with subscription context',
  fields: (t) => ({
    estimatedCostUsd: t.exposeFloat('estimatedCostUsd', {
      description: 'Total estimated cost in USD (API credit equivalent)',
    }),
    isEstimated: t.exposeBoolean('isEstimated', {
      description:
        'Whether cost is estimated (true = Sonnet-class fallback, false = per-model pricing)',
    }),
    billingType: t.exposeString('billingType', {
      nullable: true,
      description:
        'Billing type from ~/.claude.json (e.g., "stripe_subscription")',
    }),
    cacheSavingsUsd: t.exposeFloat('cacheSavingsUsd', {
      description:
        'Actual cache savings in USD based on per-model pricing difference',
    }),
    maxSubscriptionCostUsd: t.exposeFloat('maxSubscriptionCostUsd', {
      description:
        'Current subscription tier cost (e.g., $200 for Max 20x, $100 for Max 5x)',
    }),
    costUtilizationPercent: t.exposeFloat('costUtilizationPercent', {
      description: 'Percentage of subscription cost utilized',
    }),
    dailyCostTrend: t.field({
      type: [DailyCostType],
      description: 'Daily cost breakdown',
      resolve: (data) => data.dailyCostTrend,
    }),
    weeklyCostTrend: t.field({
      type: [WeeklyCostType],
      description: 'Weekly cost aggregation',
      resolve: (data) => data.weeklyCostTrend,
    }),
    topSessionsByCost: t.field({
      type: [SessionCostType],
      description: 'Top 10 most expensive sessions',
      resolve: (data) => data.topSessionsByCost,
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
    subscriptionComparisons: t.field({
      type: [SubscriptionComparisonType],
      description:
        'Per-tier comparison of subscription cost vs API credit equivalent',
      resolve: (data) => data.subscriptionComparisons,
    }),
    breakEvenDailySpend: t.exposeFloat('breakEvenDailySpend', {
      description:
        'Daily API spend at which the current subscription breaks even',
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
// Constants
// =============================================================================

/**
 * Effectiveness scoring weights (must sum to 1.0)
 *
 * - Sentiment: How positive/negative the conversation felt
 * - Task completion: Ratio of completed tasks to created tasks
 * - Turn efficiency: Fewer turns per completed task is better
 * - Compaction penalty: More compactions = worse context management
 * - Focus: Fewer unique tools = more focused session
 */
const EFFECTIVENESS_WEIGHTS = {
  sentiment: 0.25,
  taskCompletion: 0.25,
  turnEfficiency: 0.2,
  compaction: 0.15,
  focus: 0.15,
} as const;

/** Number of unique tools in a typical focused session */
const FOCUS_BASELINE_TOOLS = 3;
/** Range of unique tools used to calculate focus (above baseline) */
const FOCUS_TOOL_RANGE = 20;
/** Default focus score when no tools are used */
const FOCUS_DEFAULT = 0.5;
/** Maximum turns-per-task before turn efficiency is zero */
const TURN_EFFICIENCY_MAX = 50;
/** Compaction count at which penalty score reaches zero */
const COMPACTION_PENALTY_MAX = 5;
/** Per-compaction penalty (100 / COMPACTION_PENALTY_MAX) */
const COMPACTION_PENALTY_PER = 100 / COMPACTION_PENALTY_MAX;

/** Theoretical optimal cache rate target for savings estimate */
const OPTIMAL_CACHE_RATE = 0.8;

/**
 * Claude subscription tiers for comparison.
 * Pricing as of 2026: Pro $20, Max 5x $100, Max 20x $200.
 */
const SUBSCRIPTION_TIERS = [
  { name: 'Pro', monthlyCostUsd: 20 },
  { name: 'Max 5x', monthlyCostUsd: 100 },
  { name: 'Max 20x', monthlyCostUsd: 200 },
] as const;

// =============================================================================
// Helper Functions
// =============================================================================

/** Round to N decimal places */
export function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Parse token usage from raw JSONL message
 */
export function parseTokensFromRawJson(rawJson: string | null): {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  cacheReadTokens: number;
} {
  const zero = {
    inputTokens: 0,
    outputTokens: 0,
    cachedTokens: 0,
    cacheReadTokens: 0,
  };
  if (!rawJson) return zero;

  try {
    const parsed = JSON.parse(rawJson);
    const usage = parsed.message?.usage || parsed.usage;
    if (!usage) return zero;

    const cacheRead = usage.cache_read_input_tokens || 0;
    const cacheCreation = usage.cache_creation_input_tokens || 0;

    return {
      inputTokens: usage.input_tokens || 0,
      outputTokens: usage.output_tokens || 0,
      cachedTokens: cacheRead || cacheCreation || 0,
      cacheReadTokens: cacheRead,
    };
  } catch {
    return zero;
  }
}

/**
 * Determine sentiment trend from a series of sentiment scores.
 * Compares average of first half vs second half.
 */
export function computeSentimentTrend(scores: number[]): string {
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

/**
 * Get the Monday of the ISO week containing the given date string.
 * Returns YYYY-MM-DD of the Monday.
 */
export function getWeekStart(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  const day = date.getUTCDay();
  // Shift Sunday (0) to 7 so Monday=1 is always the start
  const diff = day === 0 ? 6 : day - 1;
  date.setUTCDate(date.getUTCDate() - diff);
  return date.toISOString().split('T')[0];
}

/**
 * Format a week label like "Jan 27 - Feb 2"
 */
export function formatWeekLabel(weekStartStr: string): string {
  const start = new Date(`${weekStartStr}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);

  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const startMonth = monthNames[start.getUTCMonth()];
  const endMonth = monthNames[end.getUTCMonth()];

  if (startMonth === endMonth) {
    return `${startMonth} ${start.getUTCDate()} - ${end.getUTCDate()}`;
  }
  return `${startMonth} ${start.getUTCDate()} - ${endMonth} ${end.getUTCDate()}`;
}

/**
 * Detect compaction type by parsing JSON fields (not string matching).
 * Falls back to 'auto_compact' for unrecognized summary messages.
 */
export function classifyCompactionType(rawJson: string | null): string {
  if (!rawJson) return 'auto_compact';

  try {
    const parsed = JSON.parse(rawJson);

    if (parsed.type === 'auto_compact' || parsed.auto_compacted)
      return 'auto_compact';
    if (parsed.type === 'compact' || parsed.is_compact || parsed.isCompact)
      return 'compact';

    // Check for continuation markers in the content
    const content = parsed.content || parsed.message?.content || '';
    const contentStr =
      typeof content === 'string' ? content : JSON.stringify(content);
    if (contentStr.includes('continued from a previous conversation'))
      return 'continuation';

    return 'auto_compact';
  } catch {
    return 'auto_compact';
  }
}

// =============================================================================
// In-memory TTL Cache
// =============================================================================

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const analyticsCache = new Map<string, CacheEntry<DashboardAnalytics>>();
const ANALYTICS_CACHE_TTL_MS = 30_000; // 30 seconds

// =============================================================================
// Query Function
// =============================================================================

/**
 * Query dashboard analytics data from the database.
 * Uses SQL aggregation via han-native for performance (~10 SQL queries instead of ~850 DB round-trips).
 *
 * @param days Number of days to analyze (default 30)
 * @param subscriptionTier Monthly subscription cost in USD (default 200 for Max)
 */
export async function queryDashboardAnalytics(
  days = 30,
  subscriptionTier = 200
): Promise<DashboardAnalytics> {
  const cacheKey = `${days}:${subscriptionTier}`;
  const cached = analyticsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffStr = cutoffDate.toISOString();

  // Single native call replaces ~850 DB round-trips
  const agg = await queryDashboardAggregates(cutoffStr);

  // ==========================================================================
  // Build subagent usage
  // ==========================================================================
  const subagentUsage: SubagentUsageStats[] = agg.subagentUsage.map((r) => ({
    subagentType: r.subagentType,
    count: r.count,
  }));

  // ==========================================================================
  // Build tool usage
  // ==========================================================================
  const toolUsage: ToolUsageStats[] = agg.toolUsage.map((r) => ({
    toolName: r.toolName,
    count: r.count,
  }));

  // ==========================================================================
  // Build compaction stats (simplified: total count from SQL, no type breakdown)
  // ==========================================================================
  const sessionsWithCompactionsCount = agg.totalCompactionSessions;
  const sessionsWithoutCompactions = Math.max(
    0,
    agg.totalSessions - sessionsWithCompactionsCount
  );
  const compactionStats: CompactionStats = {
    totalCompactions: agg.totalCompactions,
    sessionsWithCompactions: sessionsWithCompactionsCount,
    sessionsWithoutCompactions,
    avgCompactionsPerSession:
      agg.totalSessions > 0
        ? round(agg.totalCompactions / agg.totalSessions, 2)
        : 0,
    // Type breakdown simplified - SQL doesn't parse compaction types
    autoCompactCount: agg.totalCompactions,
    manualCompactCount: 0,
    continuationCount: 0,
  };

  // ==========================================================================
  // Build per-session compaction map
  // ==========================================================================
  const sessionCompactionMap = new Map<string, number>();
  for (const sc of agg.sessionCompactions) {
    sessionCompactionMap.set(sc.sessionId, sc.compactionCount);
  }

  // Build per-session sentiment map
  const sessionSentimentMap = new Map<string, number>();
  for (const ss of agg.sessionSentiments) {
    sessionSentimentMap.set(ss.sessionId, ss.avgSentiment);
  }

  // ==========================================================================
  // Build session effectiveness scores from SQL aggregated data
  // ==========================================================================
  const scoredSessions: SessionEffectiveness[] = agg.sessionStats.map((s) => {
    const avgSentiment = sessionSentimentMap.get(s.sessionId) ?? 0;
    const compactionCount = sessionCompactionMap.get(s.sessionId) ?? 0;

    // Normalize sentiment from [-5, +5] to [0, 100]
    const sentimentComponent = ((avgSentiment + 5) / 10) * 100;

    // Turn efficiency: fewer turns = better (no per-session task data from SQL, use turn count directly)
    const turnsPerTask = Math.min(s.turnCount, TURN_EFFICIENCY_MAX);
    const turnEfficiency = Math.max(0, Math.min(100, 100 - turnsPerTask * 2));

    // Task completion: not available from SQL aggregation (would need separate query)
    const taskCompletionRate = 0;
    const taskComponent = 0.5 * 100; // neutral default

    // Compaction penalty
    const compactionPenaltyScore = Math.max(
      0,
      100 - compactionCount * COMPACTION_PENALTY_PER
    );

    // Focus score
    const uniqueToolCount = s.uniqueTools;
    const focusScore =
      uniqueToolCount > 0
        ? Math.max(
            0,
            Math.min(
              1,
              1 - (uniqueToolCount - FOCUS_BASELINE_TOOLS) / FOCUS_TOOL_RANGE
            )
          )
        : FOCUS_DEFAULT;

    const score =
      sentimentComponent * EFFECTIVENESS_WEIGHTS.sentiment +
      turnEfficiency * EFFECTIVENESS_WEIGHTS.turnEfficiency +
      taskComponent * EFFECTIVENESS_WEIGHTS.taskCompletion +
      compactionPenaltyScore * EFFECTIVENESS_WEIGHTS.compaction +
      focusScore * 100 * EFFECTIVENESS_WEIGHTS.focus;

    return {
      sessionId: s.sessionId,
      slug: s.slug ?? null,
      summary: s.summary ?? null,
      score: round(Math.max(0, Math.min(100, score)), 2),
      sentimentTrend:
        avgSentiment > 0.5
          ? 'improving'
          : avgSentiment < -0.5
            ? 'declining'
            : 'stable',
      avgSentimentScore: round(avgSentiment, 2),
      turnCount: s.turnCount,
      taskCompletionRate: round(taskCompletionRate, 2),
      compactionCount,
      focusScore: round(focusScore, 2),
      startedAt: s.startedAt ?? null,
    };
  });

  scoredSessions.sort((a, b) => b.score - a.score);
  const topSessions = scoredSessions.slice(0, 10);
  const bottomSessions = scoredSessions.slice(-10).reverse();

  // ==========================================================================
  // Build hook health
  // ==========================================================================
  const hookHealth: HookHealthStats[] = agg.hookHealth.map((h) => ({
    hookName: h.hookName,
    totalRuns: h.totalRuns,
    passCount: h.passCount,
    failCount: h.failCount,
    passRate: h.totalRuns > 0 ? round(h.passCount / h.totalRuns, 2) : 1,
    avgDurationMs: round(h.avgDurationMs, 2),
  }));

  // ==========================================================================
  // Build cost analysis (per-model pricing from aggregated stats-cache)
  // ==========================================================================
  const totalInputTokens = agg.totalInputTokens;
  const totalOutputTokens = agg.totalOutputTokens;
  const totalCacheReadTokens = agg.totalCacheReadTokens;
  const totalSessions = agg.totalSessions;

  // Get aggregated stats from all config dirs for per-model pricing
  const aggregatedStats = await getAggregatedStats();
  const hasModelUsage =
    aggregatedStats.hasStatsCacheData &&
    Object.keys(aggregatedStats.modelUsage).length > 0;

  // Use per-model pricing when available, fall back to default Sonnet-class rates
  let finalCostUsd: number;
  let isEstimated: boolean;
  let cacheSavingsUsd: number;

  if (hasModelUsage) {
    finalCostUsd = calculateTotalCostFromModelUsage(aggregatedStats.modelUsage);
    isEstimated = false;
    cacheSavingsUsd = calculateCacheSavings(aggregatedStats.modelUsage);
  } else {
    finalCostUsd = calculateDefaultCost(
      totalInputTokens,
      totalOutputTokens,
      totalCacheReadTokens
    );
    isEstimated = true;
    // Fallback: savings based on default pricing (input - cacheRead rate)
    const savedPerMTok =
      DEFAULT_PRICING.inputPerMTok - DEFAULT_PRICING.cacheReadPerMTok;
    cacheSavingsUsd = (totalCacheReadTokens / 1_000_000) * savedPerMTok;
  }

  const billingType = aggregatedStats.billingInfo.billingType;

  // Build daily cost trend from SQL aggregation (uses default pricing — no per-model breakdown per day)
  const dailyCostMap = new Map<
    string,
    { costUsd: number; sessionCount: number }
  >();
  for (const dc of agg.dailyCosts) {
    dailyCostMap.set(dc.date, {
      costUsd: calculateDefaultCost(
        dc.inputTokens,
        dc.outputTokens,
        dc.cacheReadTokens
      ),
      sessionCount: dc.sessionCount,
    });
  }

  const dailyCostTrend: DailyCost[] = [];
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayData = dailyCostMap.get(dateStr);
    dailyCostTrend.push({
      date: dateStr,
      costUsd: round(dayData?.costUsd ?? 0, 4),
      sessionCount: dayData?.sessionCount ?? 0,
    });
  }
  dailyCostTrend.reverse();

  // Aggregate daily costs into weekly buckets
  const weeklyMap = new Map<
    string,
    { costUsd: number; sessionCount: number; dayCount: number }
  >();
  for (const day of dailyCostTrend) {
    if (day.costUsd === 0 && day.sessionCount === 0) continue;
    const weekStart = getWeekStart(day.date);
    const existing = weeklyMap.get(weekStart) || {
      costUsd: 0,
      sessionCount: 0,
      dayCount: 0,
    };
    existing.costUsd += day.costUsd;
    existing.sessionCount += day.sessionCount;
    existing.dayCount++;
    weeklyMap.set(weekStart, existing);
  }

  const weeklyCostTrend: WeeklyCost[] = Array.from(weeklyMap.entries())
    .map(([weekStart, data]) => ({
      weekStart,
      weekLabel: formatWeekLabel(weekStart),
      costUsd: round(data.costUsd, 2),
      sessionCount: data.sessionCount,
      avgDailyCost:
        data.dayCount > 0 ? round(data.costUsd / data.dayCount, 2) : 0,
    }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));

  // Top 10 most expensive sessions (uses default pricing — no per-model breakdown per session)
  const topSessionsByCost: SessionCost[] = agg.sessionStats
    .map((s) => {
      const cost = calculateDefaultCost(
        s.inputTokens,
        s.outputTokens,
        s.cacheReadTokens
      );
      return {
        sessionId: s.sessionId,
        slug: s.slug ?? null,
        costUsd: round(cost, 4),
        inputTokens: s.inputTokens,
        outputTokens: s.outputTokens,
        cacheReadTokens: s.cacheReadTokens,
        messageCount: s.messageCount,
        startedAt: s.startedAt ?? null,
      };
    })
    .filter((s) => s.costUsd > 0)
    .sort((a, b) => b.costUsd - a.costUsd)
    .slice(0, 10);

  // Cache hit rate
  const totalInputClassTokens = totalInputTokens + totalCacheReadTokens;
  const cacheHitRate =
    totalInputClassTokens > 0
      ? round(totalCacheReadTokens / totalInputClassTokens, 2)
      : 0;

  // Potential savings if cache hit rate reached optimal target
  const currentNonCachedInputCost =
    ((totalInputTokens - totalCacheReadTokens) / 1_000_000) *
    DEFAULT_PRICING.inputPerMTok;
  const savingsIfOptimal =
    cacheHitRate < OPTIMAL_CACHE_RATE
      ? currentNonCachedInputCost * (OPTIMAL_CACHE_RATE - cacheHitRate)
      : 0;

  // Prorate API cost to a monthly equivalent for fair comparison
  const monthlyApiCost = days > 0 ? (finalCostUsd / days) * 30 : finalCostUsd;

  const subscriptionComparisons: SubscriptionComparison[] =
    SUBSCRIPTION_TIERS.map((tier) => {
      const savingsUsd = round(monthlyApiCost - tier.monthlyCostUsd, 2);
      const savingsPercent =
        monthlyApiCost > 0 ? round((savingsUsd / monthlyApiCost) * 100, 2) : 0;

      let recommendation: string;
      if (monthlyApiCost < tier.monthlyCostUsd * 0.5) {
        recommendation = 'overkill';
      } else if (monthlyApiCost >= tier.monthlyCostUsd) {
        recommendation = 'recommended';
      } else {
        recommendation = 'good_value';
      }

      return {
        tierName: tier.name,
        monthlyCostUsd: tier.monthlyCostUsd,
        apiCreditCostUsd: round(monthlyApiCost, 2),
        savingsUsd,
        savingsPercent,
        recommendation,
      };
    });

  const breakEvenDailySpend = round(subscriptionTier / 30, 2);

  const costAnalysis: CostAnalysis = {
    estimatedCostUsd: round(finalCostUsd, 2),
    isEstimated,
    billingType,
    cacheSavingsUsd: round(cacheSavingsUsd, 2),
    maxSubscriptionCostUsd: subscriptionTier,
    costUtilizationPercent: round((finalCostUsd / subscriptionTier) * 100, 2),
    dailyCostTrend,
    weeklyCostTrend,
    topSessionsByCost,
    costPerSession:
      totalSessions > 0 ? round(finalCostUsd / totalSessions, 2) : 0,
    costPerCompletedTask: 0, // Not tracked in SQL aggregation
    cacheHitRate,
    potentialSavingsUsd: round(savingsIfOptimal, 2),
    subscriptionComparisons,
    breakEvenDailySpend,
  };

  const result: DashboardAnalytics = {
    subagentUsage,
    compactionStats,
    topSessions,
    bottomSessions,
    toolUsage,
    hookHealth,
    costAnalysis,
  };

  analyticsCache.set(cacheKey, {
    data: result,
    expiresAt: Date.now() + ANALYTICS_CACHE_TTL_MS,
  });

  return result;
}
