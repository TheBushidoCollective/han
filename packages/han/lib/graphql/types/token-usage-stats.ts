/**
 * GraphQL TokenUsageStats type
 *
 * Aggregate token usage statistics.
 */

import { builder } from '../builder.ts';

/**
 * Token usage statistics
 */
export interface TokenUsageStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCachedTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  messageCount: number;
  sessionCount: number;
}

/**
 * Token usage stats type ref
 */
const TokenUsageStatsRef =
  builder.objectRef<TokenUsageStats>('TokenUsageStats');

/**
 * Token usage stats type implementation
 */
export const TokenUsageStatsType = TokenUsageStatsRef.implement({
  description: 'Aggregate token usage statistics',
  fields: (t) => ({
    totalInputTokens: t.field({
      type: 'BigInt',
      description: 'Total input tokens across all messages',
      resolve: (data) => data.totalInputTokens,
    }),
    totalOutputTokens: t.field({
      type: 'BigInt',
      description: 'Total output tokens generated',
      resolve: (data) => data.totalOutputTokens,
    }),
    totalCachedTokens: t.field({
      type: 'BigInt',
      description: 'Total cached tokens used',
      resolve: (data) => data.totalCachedTokens,
    }),
    totalTokens: t.field({
      type: 'BigInt',
      description: 'Total tokens (input + output)',
      resolve: (data) => data.totalTokens,
    }),
    estimatedCostUsd: t.exposeFloat('estimatedCostUsd', {
      description: 'Estimated cost in USD based on Claude pricing',
    }),
    messageCount: t.exposeInt('messageCount', {
      description: 'Number of messages with token data',
    }),
    sessionCount: t.exposeInt('sessionCount', {
      description: 'Number of unique sessions',
    }),
  }),
});
