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

const SubscriptionComparisonRef =
  builder.objectRef<SubscriptionComparison>('SubscriptionComparison');

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

/**
 * Claude API pricing (Sonnet-class, as of 2025).
 * These are estimates — actual cost varies by model.
 * stats-cache.json provides more accurate data when available.
 */
const PRICING = {
  inputPerMTok: 3.0,
  outputPerMTok: 15.0,
  cacheReadPerMTok: 0.3,
} as const;

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
 * Calculate estimated cost based on Claude pricing.
 * Uses Sonnet-class pricing as a baseline estimate.
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  cachedTokens: number
): number {
  const inputCost = (inputTokens / 1_000_000) * PRICING.inputPerMTok;
  const outputCost = (outputTokens / 1_000_000) * PRICING.outputPerMTok;
  const cacheCost = (cachedTokens / 1_000_000) * PRICING.cacheReadPerMTok;
  return inputCost + outputCost + cacheCost;
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
  const zero = { inputTokens: 0, outputTokens: 0, cachedTokens: 0, cacheReadTokens: 0 };
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
 * Read stats-cache.json from ~/.claude/ for model usage data.
 * Returns null if unavailable (logs warning on parse failure).
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
    if (!existsSync(statsPath)) return null;
    const content = readFileSync(statsPath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.warn('Failed to read stats-cache.json, using estimated costs:', err);
    return null;
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
  const diff = (day === 0 ? 6 : day - 1);
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

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
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

    if (parsed.type === 'auto_compact' || parsed.auto_compacted) return 'auto_compact';
    if (parsed.type === 'compact' || parsed.is_compact || parsed.isCompact) return 'compact';

    // Check for continuation markers in the content
    const content = parsed.content || parsed.message?.content || '';
    const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
    if (contentStr.includes('continued from a previous conversation')) return 'continuation';

    return 'auto_compact';
  } catch {
    return 'auto_compact';
  }
}

// =============================================================================
// Query Function
// =============================================================================

/**
 * Query dashboard analytics data from the database.
 *
 * @param days Number of days to analyze (default 30)
 * @param subscriptionTier Monthly subscription cost in USD (default 200 for Max)
 */
export async function queryDashboardAnalytics(
  days = 30,
  subscriptionTier = 200
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

  // Per-session cost tracking (for top spenders list)
  const sessionCosts: SessionCost[] = [];

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
      // Fetch ALL messages for this session in a single query
      const allMessages = await messages.list({
        sessionId: session.id,
        limit: 50000,
      });

      if (allMessages.length === 0) continue;

      // Check if session is within our time window using first message
      const sessionStartedAt = allMessages[0]?.timestamp ?? null;
      if (sessionStartedAt && sessionStartedAt < cutoffStr) continue;

      totalSessions++;

      const sessionToolNames = new Set<string>();
      const sentimentScores: number[] = [];
      let sessionCompactions = 0;
      let sessionInputTokens = 0;
      let sessionOutputTokens = 0;
      let sessionCachedTokens = 0;
      let sessionCacheReadTokens = 0;
      let turnCount = 0;
      let taskTotal = 0;
      let taskCompleted = 0;

      // Process all messages in a single pass
      for (const msg of allMessages) {
        if (msg.timestamp < cutoffStr) continue;

        // Assistant messages: token tracking + sentiment
        if (msg.messageType === 'assistant') {
          const tokens = parseTokensFromRawJson(msg.rawJson ?? null);
          sessionInputTokens += tokens.inputTokens;
          sessionOutputTokens += tokens.outputTokens;
          sessionCachedTokens += tokens.cachedTokens;
          sessionCacheReadTokens += tokens.cacheReadTokens;
          totalCacheReadTokens += tokens.cacheReadTokens;

          if (msg.sentimentScore != null) {
            sentimentScores.push(msg.sentimentScore);
          }
        }

        // User messages: count turns + sentiment
        if (msg.messageType === 'human' || msg.messageType === 'user') {
          turnCount++;
          if (msg.sentimentScore != null) {
            sentimentScores.push(msg.sentimentScore);
          }
        }

        // Tool use messages: tool usage, subagent tracking, task tracking
        if (msg.messageType === 'tool_use' && msg.toolName) {
          toolCounts.set(msg.toolName, (toolCounts.get(msg.toolName) || 0) + 1);
          sessionToolNames.add(msg.toolName);

          // Extract subagent type from Task tool calls
          if (msg.toolName === 'Task' && msg.toolInput) {
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

          // Track task creation and completion
          if (msg.toolName === 'TaskCreate') {
            taskTotal++;
          }
          if (msg.toolName === 'TaskUpdate' && msg.toolInput) {
            try {
              const input = JSON.parse(msg.toolInput);
              if (input.status === 'completed') {
                taskCompleted++;
                totalCompletedTasks++;
              }
            } catch {
              // Malformed tool input
            }
          }
        }

        // Summary messages: compaction tracking
        if (msg.messageType === 'summary') {
          const compactType = classifyCompactionType(msg.rawJson ?? null);
          totalCompactions++;
          sessionCompactions++;
          sessionsWithCompactions.add(session.id);

          if (compactType === 'auto_compact') autoCompactCount++;
          else if (compactType === 'compact') manualCompactCount++;
          else if (compactType === 'continuation') continuationCount++;
        }
      }

      totalInputTokens += sessionInputTokens;
      totalOutputTokens += sessionOutputTokens;
      totalCachedTokens += sessionCachedTokens;

      // Track daily cost and per-session cost
      const sessionCost = calculateCost(
        sessionInputTokens,
        sessionOutputTokens,
        sessionCachedTokens
      );

      if (sessionStartedAt) {
        const date = sessionStartedAt.split('T')[0];
        const existing = dailyCostMap.get(date) || {
          costUsd: 0,
          sessionCount: 0,
        };
        existing.costUsd += sessionCost;
        existing.sessionCount++;
        dailyCostMap.set(date, existing);
      }

      sessionCosts.push({
        sessionId: session.id,
        slug: session.slug ?? null,
        costUsd: round(sessionCost, 4),
        inputTokens: sessionInputTokens,
        outputTokens: sessionOutputTokens,
        cacheReadTokens: sessionCacheReadTokens,
        messageCount: allMessages.length,
        startedAt: sessionStartedAt,
      });

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
      } catch (err) {
        console.warn(`Failed to load hook executions for session ${session.id}:`, err);
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
    sessionsWithoutCompactions: Math.max(0, sessionsWithoutCompactions),
    avgCompactionsPerSession:
      totalSessions > 0
        ? round(totalCompactions / totalSessions, 2)
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

    // Turn efficiency: fewer turns per completed task = better
    // When no tasks completed, cap at TURN_EFFICIENCY_MAX to avoid extreme scores
    const turnsPerTask =
      s.taskCompleted > 0
        ? s.turnCount / s.taskCompleted
        : Math.min(s.turnCount, TURN_EFFICIENCY_MAX);
    const turnEfficiency = Math.max(
      0,
      Math.min(100, 100 - Math.min(turnsPerTask, TURN_EFFICIENCY_MAX) * 2)
    );

    // Task completion rate (default to 0.5 for sessions with no tasks to avoid penalizing)
    const taskCompletionRate =
      s.taskTotal > 0 ? s.taskCompleted / s.taskTotal : 0;
    const taskComponent = (s.taskTotal > 0 ? taskCompletionRate : 0.5) * 100;

    // Compaction penalty: 0 compactions = 100, COMPACTION_PENALTY_MAX+ = 0
    const compactionPenaltyScore = Math.max(
      0,
      100 - s.compactionCount * COMPACTION_PENALTY_PER
    );

    // Focus score: fewer unique tools relative to baseline = more focused
    const uniqueToolCount = s.toolNames.size;
    const focusScore =
      uniqueToolCount > 0
        ? Math.max(0, Math.min(1, 1 - (uniqueToolCount - FOCUS_BASELINE_TOOLS) / FOCUS_TOOL_RANGE))
        : FOCUS_DEFAULT;

    // Composite score with named weights
    const score =
      sentimentComponent * EFFECTIVENESS_WEIGHTS.sentiment +
      turnEfficiency * EFFECTIVENESS_WEIGHTS.turnEfficiency +
      taskComponent * EFFECTIVENESS_WEIGHTS.taskCompletion +
      compactionPenaltyScore * EFFECTIVENESS_WEIGHTS.compaction +
      focusScore * 100 * EFFECTIVENESS_WEIGHTS.focus;

    return {
      sessionId: s.sessionId,
      slug: s.slug,
      score: round(Math.max(0, Math.min(100, score)), 2),
      sentimentTrend: computeSentimentTrend(s.sentimentScores),
      avgSentimentScore: round(avgSentiment, 2),
      turnCount: s.turnCount,
      taskCompletionRate: round(taskCompletionRate, 2),
      compactionCount: s.compactionCount,
      focusScore: round(focusScore, 2),
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
          ? round(stats.passCount / stats.totalRuns, 2)
          : 1,
      avgDurationMs:
        stats.totalRuns > 0
          ? round(stats.totalDurationMs / stats.totalRuns, 2)
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

  // Check stats-cache for more accurate cost data (survives session cleanup)
  const statsCache = readStatsCache();
  let statsCacheCost = 0;
  if (statsCache?.modelUsage) {
    for (const usage of Object.values(statsCache.modelUsage)) {
      statsCacheCost += usage.costUSD || 0;
    }
  }

  const finalCostUsd =
    statsCacheCost > 0 ? statsCacheCost : estimatedCostUsd;

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
      costUsd: round(dayData?.costUsd ?? 0, 4),
      sessionCount: dayData?.sessionCount ?? 0,
    });
  }
  dailyCostTrend.reverse();

  // Aggregate daily costs into weekly buckets
  const weeklyMap = new Map<string, { costUsd: number; sessionCount: number; dayCount: number }>();
  for (const day of dailyCostTrend) {
    if (day.costUsd === 0 && day.sessionCount === 0) continue;
    const weekStart = getWeekStart(day.date);
    const existing = weeklyMap.get(weekStart) || { costUsd: 0, sessionCount: 0, dayCount: 0 };
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
      avgDailyCost: data.dayCount > 0 ? round(data.costUsd / data.dayCount, 2) : 0,
    }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));

  // Top 10 most expensive sessions
  const topSessionsByCost = sessionCosts
    .filter((s) => s.costUsd > 0)
    .sort((a, b) => b.costUsd - a.costUsd)
    .slice(0, 10);

  // Cache hit rate: ratio of cache read tokens to total input-class tokens
  const totalInputClassTokens = totalInputTokens + totalCacheReadTokens;
  const cacheHitRate =
    totalInputClassTokens > 0
      ? round(totalCacheReadTokens / totalInputClassTokens, 2)
      : 0;

  // Potential savings: estimate if cache hit rate reached optimal target
  const currentNonCachedInputCost =
    ((totalInputTokens - totalCacheReadTokens) / 1_000_000) * PRICING.inputPerMTok;
  const savingsIfOptimal =
    cacheHitRate < OPTIMAL_CACHE_RATE
      ? currentNonCachedInputCost * (OPTIMAL_CACHE_RATE - cacheHitRate)
      : 0;

  // Prorate API cost to a monthly equivalent for fair comparison
  // If analyzing 30 days, it maps 1:1 to a monthly subscription
  const monthlyApiCost = days > 0 ? (finalCostUsd / days) * 30 : finalCostUsd;

  // Build per-tier comparisons
  const subscriptionComparisons: SubscriptionComparison[] = SUBSCRIPTION_TIERS.map(
    (tier) => {
      const savingsUsd = round(monthlyApiCost - tier.monthlyCostUsd, 2);
      const savingsPercent =
        monthlyApiCost > 0
          ? round((savingsUsd / monthlyApiCost) * 100, 2)
          : 0;

      let recommendation: string;
      if (monthlyApiCost < tier.monthlyCostUsd * 0.5) {
        // API cost is less than half the subscription — not worth it
        recommendation = 'overkill';
      } else if (monthlyApiCost >= tier.monthlyCostUsd) {
        // API cost meets or exceeds subscription — great value
        recommendation = 'recommended';
      } else {
        // API cost is between 50-100% of subscription — decent value
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
    }
  );

  // Break-even: daily API spend at which the user's subscription tier pays for itself
  const breakEvenDailySpend = round(subscriptionTier / 30, 2);

  const costAnalysis: CostAnalysis = {
    estimatedCostUsd: round(finalCostUsd, 2),
    maxSubscriptionCostUsd: subscriptionTier,
    costUtilizationPercent:
      round((finalCostUsd / subscriptionTier) * 100, 2),
    dailyCostTrend,
    weeklyCostTrend,
    topSessionsByCost,
    costPerSession:
      totalSessions > 0
        ? round(finalCostUsd / totalSessions, 2)
        : 0,
    costPerCompletedTask:
      totalCompletedTasks > 0
        ? round(finalCostUsd / totalCompletedTasks, 2)
        : 0,
    cacheHitRate,
    potentialSavingsUsd: round(savingsIfOptimal, 2),
    subscriptionComparisons,
    breakEvenDailySpend,
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
