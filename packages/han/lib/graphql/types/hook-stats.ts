/**
 * GraphQL HookStats type
 *
 * Represents hook execution statistics.
 */

import { getSessionHookStats } from '../../api/hooks.ts';
import { builder } from '../builder.ts';
import { HookTypeStatType } from './hook-type-stat.ts';

/**
 * Hook statistics data
 */
interface HookStatsData {
  totalHooks: number;
  passedHooks: number;
  failedHooks: number;
  totalDurationMs: number;
  byHookType: Record<string, { total: number; passed: number }>;
}

/**
 * Hook stats type ref
 */
const HookStatsRef = builder.objectRef<HookStatsData>('HookStats');

/**
 * Hook stats type implementation
 */
export const HookStatsType = HookStatsRef.implement({
  description: 'Hook execution statistics',
  fields: (t) => ({
    totalHooks: t.exposeInt('totalHooks', {
      description: 'Total hook executions',
    }),
    passedHooks: t.exposeInt('passedHooks', {
      description: 'Number of passed hooks',
    }),
    failedHooks: t.exposeInt('failedHooks', {
      description: 'Number of failed hooks',
    }),
    totalDurationMs: t.exposeInt('totalDurationMs', {
      description: 'Total duration of all hooks in ms',
    }),
    passRate: t.float({
      description: 'Pass rate as a percentage',
      resolve: (s) =>
        s.totalHooks > 0
          ? Math.round((s.passedHooks / s.totalHooks) * 1000) / 10
          : 100,
    }),
    byHookType: t.field({
      type: [HookTypeStatType],
      description: 'Statistics broken down by hook type',
      resolve: (s) =>
        Object.entries(s.byHookType).map(([hookType, stats]) => ({
          hookType,
          ...stats,
        })),
    }),
  }),
});

/**
 * Query session hook stats
 */
export async function querySessionHookStats(
  sessionId: string
): Promise<HookStatsData> {
  return getSessionHookStats(sessionId);
}
