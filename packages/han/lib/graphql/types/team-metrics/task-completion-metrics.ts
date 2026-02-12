/**
 * TaskCompletionMetrics Type
 *
 * Aggregate task completion statistics.
 */

import { builder } from '../../builder.ts';

export interface TaskCompletionMetrics {
  totalCreated: number;
  totalCompleted: number;
  successRate: number;
  averageConfidence: number;
  successCount: number;
  partialCount: number;
  failureCount: number;
}

const TaskCompletionMetricsRef = builder.objectRef<TaskCompletionMetrics>(
  'TaskCompletionMetrics'
);

export const TaskCompletionMetricsType = TaskCompletionMetricsRef.implement({
  description: 'Aggregate task completion statistics',
  fields: (t) => ({
    totalCreated: t.exposeInt('totalCreated', {
      description: 'Total tasks created',
    }),
    totalCompleted: t.exposeInt('totalCompleted', {
      description: 'Total tasks completed (any outcome)',
    }),
    successRate: t.exposeFloat('successRate', {
      description: 'Success rate (0-1)',
    }),
    averageConfidence: t.exposeFloat('averageConfidence', {
      description: 'Average confidence score (0-1)',
    }),
    successCount: t.exposeInt('successCount', {
      description: 'Tasks completed with success outcome',
    }),
    partialCount: t.exposeInt('partialCount', {
      description: 'Tasks completed with partial outcome',
    }),
    failureCount: t.exposeInt('failureCount', {
      description: 'Tasks completed with failure outcome',
    }),
  }),
});
