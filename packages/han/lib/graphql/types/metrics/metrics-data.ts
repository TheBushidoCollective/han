/**
 * GraphQL MetricsData type
 *
 * Aggregate metrics for a time period.
 */

import { tasks, frustrations } from '../../../grpc/data-access.ts';
import { builder } from '../../builder.ts';
import type { TaskOutcomeCount } from './task-outcome-count.ts';
import { TaskOutcomeCountType } from './task-outcome-count.ts';
import type { TaskTypeCount } from './task-type-count.ts';
import { TaskTypeCountType } from './task-type-count.ts';

/**
 * Metrics result interface for GraphQL - maps from database TaskMetrics
 */
export interface MetricsResult {
  totalTasks: number;
  completedTasks: number;
  successRate: number;
  averageConfidence: number;
  averageDurationSeconds: number | null;
  calibrationScore: number | null;
  byType: Record<string, number>;
  byOutcome: Record<string, number>;
  significantFrustrations: number;
  significantFrustrationRate: number;
}

const MetricsDataRef = builder.objectRef<MetricsResult>('MetricsData');

export const MetricsDataType = MetricsDataRef.implement({
  description: 'Aggregate metrics for a time period',
  fields: (t) => ({
    totalTasks: t.int({
      description: 'Total number of tasks',
      resolve: (data) => data.totalTasks,
    }),
    completedTasks: t.int({
      description: 'Number of completed tasks',
      resolve: (data) => data.completedTasks,
    }),
    successRate: t.float({
      description: 'Success rate (0-1)',
      resolve: (data) => data.successRate,
    }),
    averageConfidence: t.float({
      description: 'Average confidence score (0-1)',
      resolve: (data) => data.averageConfidence,
    }),
    averageDuration: t.float({
      nullable: true,
      description: 'Average duration in seconds',
      resolve: (data) => data.averageDurationSeconds,
    }),
    calibrationScore: t.float({
      nullable: true,
      description: 'Calibration score (how well confidence matches outcomes)',
      resolve: (data) => data.calibrationScore,
    }),
    tasksByType: t.field({
      type: [TaskTypeCountType],
      description: 'Task breakdown by type',
      resolve: (data): TaskTypeCount[] => {
        return Object.entries(data.byType).map(([type, count]) => ({
          type: type.toUpperCase() as
            | 'IMPLEMENTATION'
            | 'FIX'
            | 'REFACTOR'
            | 'RESEARCH',
          count: count as number,
        }));
      },
    }),
    tasksByOutcome: t.field({
      type: [TaskOutcomeCountType],
      description: 'Task breakdown by outcome',
      resolve: (data): TaskOutcomeCount[] => {
        return Object.entries(data.byOutcome).map(([outcome, count]) => ({
          outcome: outcome.toUpperCase() as 'SUCCESS' | 'PARTIAL' | 'FAILURE',
          count: count as number,
        }));
      },
    }),
    // Note: recentTasks field removed - need native list function to support this
    significantFrustrations: t.int({
      description: 'Count of moderate/high frustration events',
      resolve: (data) => data.significantFrustrations,
    }),
    significantFrustrationRate: t.float({
      description: 'Significant frustrations per task',
      resolve: (data) => data.significantFrustrationRate,
    }),
  }),
});

/**
 * Helper to query metrics from database
 * Combines task metrics with native database frustration metrics
 */
export async function queryMetrics(
  period?: 'DAY' | 'WEEK' | 'MONTH'
): Promise<MetricsResult> {
  const periodMap = {
    DAY: 'day' as const,
    WEEK: 'week' as const,
    MONTH: 'month' as const,
  };

  // Query task metrics from database
  const dbMetrics = await tasks.queryMetrics({
    period: period ? periodMap[period] : undefined,
  });

  // Parse byType and byOutcome from JSON strings
  let byType: Record<string, number> = {};
  let byOutcome: Record<string, number> = {};

  try {
    if (dbMetrics.byType) {
      byType = JSON.parse(dbMetrics.byType);
    }
  } catch {
    // Ignore parse errors
  }

  try {
    if (dbMetrics.byOutcome) {
      byOutcome = JSON.parse(dbMetrics.byOutcome);
    }
  } catch {
    // Ignore parse errors
  }

  // Base result from task metrics
  const result: MetricsResult = {
    totalTasks: dbMetrics.totalTasks,
    completedTasks: dbMetrics.completedTasks,
    successRate: dbMetrics.successRate,
    averageConfidence: dbMetrics.averageConfidence ?? 0,
    averageDurationSeconds: dbMetrics.averageDurationSeconds ?? null,
    calibrationScore: dbMetrics.calibrationScore ?? null,
    byType,
    byOutcome,
    significantFrustrations: 0,
    significantFrustrationRate: 0,
  };

  // Try to get frustration metrics from gRPC
  try {
    const frustrationMetrics = await frustrations.queryMetrics();
    const totalFrustrations = frustrationMetrics.total_events;
    result.significantFrustrations = totalFrustrations;
    result.significantFrustrationRate =
      result.totalTasks > 0 ? totalFrustrations / result.totalTasks : 0;
  } catch {
    // Fall back to zero if gRPC fails
  }

  return result;
}
