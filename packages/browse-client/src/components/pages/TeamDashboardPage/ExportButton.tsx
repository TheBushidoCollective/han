/**
 * Export Button Component
 *
 * Exports team metrics data as CSV or JSON.
 */

import type React from 'react';
import { useCallback, useState } from 'react';
import { Box } from '@/components/atoms/Box.tsx';
import { Button } from '@/components/atoms/Button.tsx';
import { Pressable } from '@/components/atoms/Pressable.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { VStack } from '@/components/atoms/VStack.tsx';
import { colors, spacing } from '@/theme.ts';

/**
 * Raw GraphQL data type with nullable fields
 */
interface RawTeamMetricsData {
  readonly totalSessions?: number | null;
  readonly totalTasks?: number | null;
  readonly totalTokens?: number | null;
  readonly estimatedCostUsd?: number | null;
  readonly sessionsByProject?: ReadonlyArray<{
    readonly projectId?: string | null;
    readonly projectName?: string | null;
    readonly sessionCount?: number | null;
    readonly taskCount?: number | null;
    readonly successRate?: number | null;
  }> | null;
  readonly sessionsByPeriod?: ReadonlyArray<{
    readonly period?: string | null;
    readonly sessionCount?: number | null;
    readonly taskCount?: number | null;
    readonly tokenUsage?: number | null;
  }> | null;
  readonly taskCompletionMetrics?: {
    readonly totalCreated?: number | null;
    readonly totalCompleted?: number | null;
    readonly successRate?: number | null;
    readonly averageConfidence?: number | null;
    readonly successCount?: number | null;
    readonly partialCount?: number | null;
    readonly failureCount?: number | null;
  } | null;
  readonly tokenUsageAggregation?: {
    readonly totalInputTokens?: number | null;
    readonly totalOutputTokens?: number | null;
    readonly totalCachedTokens?: number | null;
    readonly totalTokens?: number | null;
    readonly estimatedCostUsd?: number | null;
  } | null;
}

/**
 * Normalized export data with non-nullable fields
 */
interface NormalizedTeamMetricsData {
  totalSessions: number;
  totalTasks: number;
  totalTokens: number;
  estimatedCostUsd: number;
  sessionsByProject: Array<{
    projectId: string;
    projectName: string;
    sessionCount: number;
    taskCount: number;
    successRate: number;
  }>;
  sessionsByPeriod: Array<{
    period: string;
    sessionCount: number;
    taskCount: number;
    tokenUsage: number;
  }>;
  taskCompletionMetrics: {
    totalCreated: number;
    totalCompleted: number;
    successRate: number;
    averageConfidence: number;
    successCount: number;
    partialCount: number;
    failureCount: number;
  };
  tokenUsageAggregation: {
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCachedTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
  };
}

interface ExportButtonProps {
  data: RawTeamMetricsData | null | undefined;
}

/**
 * Normalize GraphQL data with nullable fields to export-friendly format
 */
function normalizeData(data: RawTeamMetricsData): NormalizedTeamMetricsData {
  return {
    totalSessions: data.totalSessions ?? 0,
    totalTasks: data.totalTasks ?? 0,
    totalTokens: data.totalTokens ?? 0,
    estimatedCostUsd: data.estimatedCostUsd ?? 0,
    sessionsByProject: (data.sessionsByProject ?? []).map((p) => ({
      projectId: p.projectId ?? 'unknown',
      projectName: p.projectName ?? 'Unknown Project',
      sessionCount: p.sessionCount ?? 0,
      taskCount: p.taskCount ?? 0,
      successRate: p.successRate ?? 0,
    })),
    sessionsByPeriod: (data.sessionsByPeriod ?? []).map((p) => ({
      period: p.period ?? '',
      sessionCount: p.sessionCount ?? 0,
      taskCount: p.taskCount ?? 0,
      tokenUsage: p.tokenUsage ?? 0,
    })),
    taskCompletionMetrics: {
      totalCreated: data.taskCompletionMetrics?.totalCreated ?? 0,
      totalCompleted: data.taskCompletionMetrics?.totalCompleted ?? 0,
      successRate: data.taskCompletionMetrics?.successRate ?? 0,
      averageConfidence: data.taskCompletionMetrics?.averageConfidence ?? 0,
      successCount: data.taskCompletionMetrics?.successCount ?? 0,
      partialCount: data.taskCompletionMetrics?.partialCount ?? 0,
      failureCount: data.taskCompletionMetrics?.failureCount ?? 0,
    },
    tokenUsageAggregation: {
      totalInputTokens: data.tokenUsageAggregation?.totalInputTokens ?? 0,
      totalOutputTokens: data.tokenUsageAggregation?.totalOutputTokens ?? 0,
      totalCachedTokens: data.tokenUsageAggregation?.totalCachedTokens ?? 0,
      totalTokens: data.tokenUsageAggregation?.totalTokens ?? 0,
      estimatedCostUsd: data.tokenUsageAggregation?.estimatedCostUsd ?? 0,
    },
  };
}

type ExportFormat = 'csv' | 'json';

/**
 * Convert data to CSV format
 */
function toCSV(data: NormalizedTeamMetricsData): string {
  const lines: string[] = [];

  // Summary section
  lines.push('# Team Metrics Summary');
  lines.push('Metric,Value');
  lines.push(`Total Sessions,${data.totalSessions}`);
  lines.push(`Total Tasks,${data.totalTasks}`);
  lines.push(`Total Tokens,${data.totalTokens}`);
  lines.push(`Estimated Cost (USD),${data.estimatedCostUsd.toFixed(2)}`);
  lines.push(
    `Success Rate,${(data.taskCompletionMetrics.successRate * 100).toFixed(1)}%`
  );
  lines.push(
    `Average Confidence,${(data.taskCompletionMetrics.averageConfidence * 100).toFixed(1)}%`
  );
  lines.push('');

  // Task outcomes section
  lines.push('# Task Outcomes');
  lines.push('Outcome,Count');
  lines.push(`Success,${data.taskCompletionMetrics.successCount}`);
  lines.push(`Partial,${data.taskCompletionMetrics.partialCount}`);
  lines.push(`Failure,${data.taskCompletionMetrics.failureCount}`);
  lines.push('');

  // Token usage section
  lines.push('# Token Usage');
  lines.push('Type,Count');
  lines.push(`Input Tokens,${data.tokenUsageAggregation.totalInputTokens}`);
  lines.push(`Output Tokens,${data.tokenUsageAggregation.totalOutputTokens}`);
  lines.push(`Cached Tokens,${data.tokenUsageAggregation.totalCachedTokens}`);
  lines.push('');

  // Sessions by project section
  lines.push('# Sessions by Project');
  lines.push('Project,Sessions,Tasks,Success Rate');
  for (const project of data.sessionsByProject) {
    lines.push(
      `"${project.projectName}",${project.sessionCount},${project.taskCount},${(project.successRate * 100).toFixed(1)}%`
    );
  }
  lines.push('');

  // Sessions by period section
  lines.push('# Activity by Period');
  lines.push('Period,Sessions,Tasks,Token Usage');
  for (const period of data.sessionsByPeriod) {
    lines.push(
      `${period.period},${period.sessionCount},${period.taskCount},${period.tokenUsage}`
    );
  }

  return lines.join('\n');
}

/**
 * Trigger download of data as file
 */
function downloadFile(
  content: string,
  filename: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function ExportButton({ data }: ExportButtonProps): React.ReactElement {
  const [showMenu, setShowMenu] = useState(false);

  const handleExport = useCallback(
    (format: ExportFormat) => {
      if (!data) return;

      const normalizedData = normalizeData(data);
      const timestamp = new Date().toISOString().split('T')[0];

      if (format === 'csv') {
        const csv = toCSV(normalizedData);
        downloadFile(csv, `team-metrics-${timestamp}.csv`, 'text/csv');
      } else {
        const json = JSON.stringify(normalizedData, null, 2);
        downloadFile(
          json,
          `team-metrics-${timestamp}.json`,
          'application/json'
        );
      }

      setShowMenu(false);
    },
    [data]
  );

  return (
    <VStack style={{ position: 'relative' }}>
      <Button size="sm" onClick={() => setShowMenu(!showMenu)} disabled={!data}>
        Export
      </Button>

      {showMenu && (
        <VStack
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: spacing.xs,
            backgroundColor: colors.bg.secondary,
            borderRadius: 6,
            border: `1px solid ${colors.border.default}`,
            overflow: 'hidden',
            zIndex: 100,
            minWidth: 120,
          }}
        >
          <Pressable onPress={() => handleExport('csv')}>
            <Box
              style={{
                padding: spacing.sm,
                cursor: 'pointer',
              }}
            >
              <Text size="sm">Export CSV</Text>
            </Box>
          </Pressable>
          <Pressable onPress={() => handleExport('json')}>
            <Box
              style={{
                padding: spacing.sm,
                cursor: 'pointer',
                borderTop: `1px solid ${colors.border.default}`,
              }}
            >
              <Text size="sm">Export JSON</Text>
            </Box>
          </Pressable>
        </VStack>
      )}
    </VStack>
  );
}
