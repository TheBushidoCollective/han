/**
 * TeamMetrics Type
 *
 * Aggregate team-level metrics for dashboard.
 */

import { builder } from '../../builder.ts';
import {
  type ActivityTimelineEntry,
  ActivityTimelineEntryType,
} from './activity-timeline-entry.ts';
import {
  type ContributorMetrics,
  ContributorMetricsType,
} from './contributor-metrics.ts';
import {
  type PeriodSessionCount,
  PeriodSessionCountType,
} from './period-session-count.ts';
import {
  type ProjectSessionCount,
  ProjectSessionCountType,
} from './project-session-count.ts';
import {
  type TaskCompletionMetrics,
  TaskCompletionMetricsType,
} from './task-completion-metrics.ts';
import {
  type TokenUsageAggregation,
  TokenUsageAggregationType,
} from './token-usage-aggregation.ts';

export interface TeamMetrics {
  totalSessions: number;
  totalTasks: number;
  totalTokens: number;
  estimatedCostUsd: number;
  sessionsByProject: ProjectSessionCount[];
  sessionsByPeriod: PeriodSessionCount[];
  taskCompletionMetrics: TaskCompletionMetrics;
  tokenUsageAggregation: TokenUsageAggregation;
  activityTimeline: ActivityTimelineEntry[];
  topContributors: ContributorMetrics[];
}

const TeamMetricsRef = builder.objectRef<TeamMetrics>('TeamMetrics');

export const TeamMetricsType = TeamMetricsRef.implement({
  description: 'Aggregate team-level metrics for dashboard',
  fields: (t) => ({
    totalSessions: t.exposeInt('totalSessions', {
      description: 'Total number of sessions',
    }),
    totalTasks: t.exposeInt('totalTasks', {
      description: 'Total number of tasks',
    }),
    totalTokens: t.exposeInt('totalTokens', {
      description: 'Total tokens used',
    }),
    estimatedCostUsd: t.exposeFloat('estimatedCostUsd', {
      description: 'Estimated total cost in USD',
    }),
    sessionsByProject: t.field({
      type: [ProjectSessionCountType],
      description: 'Sessions grouped by project',
      resolve: (data) => data.sessionsByProject,
    }),
    sessionsByPeriod: t.field({
      type: [PeriodSessionCountType],
      description: 'Sessions grouped by time period',
      resolve: (data) => data.sessionsByPeriod,
    }),
    taskCompletionMetrics: t.field({
      type: TaskCompletionMetricsType,
      description: 'Task completion statistics',
      resolve: (data) => data.taskCompletionMetrics,
    }),
    tokenUsageAggregation: t.field({
      type: TokenUsageAggregationType,
      description: 'Token usage aggregation',
      resolve: (data) => data.tokenUsageAggregation,
    }),
    activityTimeline: t.field({
      type: [ActivityTimelineEntryType],
      description: 'Activity over time',
      resolve: (data) => data.activityTimeline,
    }),
    topContributors: t.field({
      type: [ContributorMetricsType],
      description: 'Top contributors (anonymized)',
      resolve: (data) => data.topContributors,
    }),
  }),
});
