/**
 * Token Usage Timeline Chart
 *
 * Area chart showing sessions and activity over time.
 */

import type React from 'react';
import { useMemo } from 'react';
import { Box } from '@/components/atoms/Box.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { VStack } from '@/components/atoms/VStack.tsx';
import { colors } from '@/theme.ts';

export interface PeriodData {
  readonly period: string;
  readonly sessionCount: number;
  readonly taskCount: number;
  readonly tokenUsage: number;
}

interface TokenUsageTimelineChartProps {
  data: readonly PeriodData[];
}

// Chart colors
const CHART_COLORS = {
  sessions: '#3b82f6', // Blue
  tasks: '#10b981', // Green
  area: 'rgba(59, 130, 246, 0.2)', // Blue with transparency
};

/**
 * Format period label for display
 */
function formatPeriodLabel(period: string): string {
  // Handle ISO week format (YYYY-Www)
  if (period.includes('-W')) {
    const parts = period.split('-W');
    return `W${parts[1]}`;
  }
  // Handle month format (YYYY-MM)
  if (period.match(/^\d{4}-\d{2}$/)) {
    const [_year, month] = period.split('-');
    const months = [
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
    return months[Number.parseInt(month, 10) - 1] || period;
  }
  // Handle day format (YYYY-MM-DD)
  if (period.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const date = new Date(period);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }
  return period;
}

export function TokenUsageTimelineChart({
  data,
}: TokenUsageTimelineChartProps): React.ReactElement {
  // Calculate max for scaling - must be called unconditionally (hooks rule)
  const maxSessions = useMemo(() => {
    if (data.length === 0) return 1;
    return Math.max(...data.map((p) => p.sessionCount), 1);
  }, [data]);

  // Calculate totals - must be called unconditionally (hooks rule)
  const totals = useMemo(() => {
    return data.reduce(
      (acc, p) => ({
        sessions: acc.sessions + p.sessionCount,
        tasks: acc.tasks + p.taskCount,
        tokens: acc.tokens + p.tokenUsage,
      }),
      { sessions: 0, tasks: 0, tokens: 0 }
    );
  }, [data]);

  // Generate SVG path for area chart - must be called unconditionally (hooks rule)
  const areaPath = useMemo(() => {
    if (data.length === 0) return '';

    const xStep = 100 / (data.length - 1 || 1);
    const points = data.map((d, i) => {
      const x = i * xStep;
      const y = 100 - (d.sessionCount / maxSessions) * 100;
      return `${x},${y}`;
    });

    // Create closed path for area
    return `M0,100 L${points.join(' L')} L100,100 Z`;
  }, [data, maxSessions]);

  // Generate SVG path for line - must be called unconditionally (hooks rule)
  const linePath = useMemo(() => {
    if (data.length === 0) return '';

    const xStep = 100 / (data.length - 1 || 1);
    const points = data.map((d, i) => {
      const x = i * xStep;
      const y = 100 - (d.sessionCount / maxSessions) * 100;
      return `${x},${y}`;
    });

    return `M${points.join(' L')}`;
  }, [data, maxSessions]);

  const chartHeight = 120;
  const chartWidth = '100%';

  // Early return AFTER all hooks
  if (data.length === 0) {
    return (
      <VStack
        gap="md"
        align="center"
        justify="center"
        style={{ minHeight: 160 }}
      >
        <Text color="muted" size="sm">
          No activity data available
        </Text>
      </VStack>
    );
  }

  return (
    <VStack gap="md" style={{ width: '100%' }}>
      {/* Summary stats */}
      <HStack gap="xl">
        <VStack gap="xs">
          <Text color="secondary" size="xs">
            Total Sessions
          </Text>
          <Text weight="semibold" size="lg">
            {totals.sessions}
          </Text>
        </VStack>
        <VStack gap="xs">
          <Text color="secondary" size="xs">
            Total Tasks
          </Text>
          <Text weight="semibold" size="lg">
            {totals.tasks}
          </Text>
        </VStack>
        <VStack gap="xs">
          <Text color="secondary" size="xs">
            Peak Day
          </Text>
          <Text weight="semibold" size="lg">
            {maxSessions} sessions
          </Text>
        </VStack>
      </HStack>

      {/* Chart */}
      <Box
        style={{
          width: chartWidth,
          height: chartHeight,
          position: 'relative',
        }}
      >
        <svg
          width="100%"
          height={chartHeight}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ overflow: 'visible' }}
          role="img"
          aria-label="Activity timeline chart showing sessions over time"
        >
          <title>Activity Timeline</title>
          {/* Grid lines */}
          <line
            x1="0"
            y1="25"
            x2="100"
            y2="25"
            stroke={colors.border.default}
            strokeWidth="0.5"
            strokeDasharray="2"
          />
          <line
            x1="0"
            y1="50"
            x2="100"
            y2="50"
            stroke={colors.border.default}
            strokeWidth="0.5"
            strokeDasharray="2"
          />
          <line
            x1="0"
            y1="75"
            x2="100"
            y2="75"
            stroke={colors.border.default}
            strokeWidth="0.5"
            strokeDasharray="2"
          />

          {/* Area fill */}
          <path d={areaPath} fill={CHART_COLORS.area} />

          {/* Line */}
          <path
            d={linePath}
            fill="none"
            stroke={CHART_COLORS.sessions}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />

          {/* Data points */}
          {data.map((d, i) => {
            const xStep = 100 / (data.length - 1 || 1);
            const x = i * xStep;
            const y = 100 - (d.sessionCount / maxSessions) * 100;
            return (
              <circle
                key={d.period}
                cx={x}
                cy={y}
                r="1.5"
                fill={CHART_COLORS.sessions}
              />
            );
          })}
        </svg>
      </Box>

      {/* X-axis labels */}
      <HStack justify="space-between" style={{ width: '100%' }}>
        {data.length <= 12 ? (
          data.map((d) => (
            <Text key={d.period} size="xs" color="muted">
              {formatPeriodLabel(d.period)}
            </Text>
          ))
        ) : (
          <>
            <Text size="xs" color="muted">
              {formatPeriodLabel(data[0].period)}
            </Text>
            <Text size="xs" color="muted">
              {formatPeriodLabel(data[Math.floor(data.length / 2)].period)}
            </Text>
            <Text size="xs" color="muted">
              {formatPeriodLabel(data[data.length - 1].period)}
            </Text>
          </>
        )}
      </HStack>
    </VStack>
  );
}
