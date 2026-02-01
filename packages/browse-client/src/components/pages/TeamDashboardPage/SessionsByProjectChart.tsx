/**
 * Sessions By Project Chart
 *
 * Horizontal bar chart showing session counts per project.
 */

import type React from 'react';
import { useMemo } from 'react';
import { Box } from '@/components/atoms/Box.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { VStack } from '@/components/atoms/VStack.tsx';
import { colors, spacing } from '@/theme.ts';

export interface ProjectData {
  readonly projectId: string;
  readonly projectName: string;
  readonly sessionCount: number;
  readonly taskCount: number;
  readonly successRate: number;
}

interface SessionsByProjectChartProps {
  data: readonly ProjectData[];
}

// Color palette for projects
const PROJECT_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#ef4444', // Red
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#84cc16', // Lime
  '#ec4899', // Pink
  '#6366f1', // Indigo
];

export function SessionsByProjectChart({
  data,
}: SessionsByProjectChartProps): React.ReactElement {
  // Calculate max for scaling
  const maxSessions = useMemo(() => {
    return Math.max(...data.map((p) => p.sessionCount), 1);
  }, [data]);

  // Calculate total sessions
  const totalSessions = useMemo(() => {
    return data.reduce((sum, p) => sum + p.sessionCount, 0);
  }, [data]);

  if (data.length === 0) {
    return (
      <VStack
        gap="md"
        align="center"
        justify="center"
        style={{ minHeight: 120 }}
      >
        <Text color="muted" size="sm">
          No project data available
        </Text>
      </VStack>
    );
  }

  return (
    <VStack gap="sm" style={{ width: '100%' }}>
      {/* Summary */}
      <HStack gap="lg" style={{ marginBottom: spacing.sm }}>
        <VStack gap="xs">
          <Text color="secondary" size="xs">
            Total Sessions
          </Text>
          <Text weight="semibold" size="lg">
            {totalSessions}
          </Text>
        </VStack>
        <VStack gap="xs">
          <Text color="secondary" size="xs">
            Active Projects
          </Text>
          <Text weight="semibold" size="lg">
            {data.length}
          </Text>
        </VStack>
      </HStack>

      {/* Bars */}
      {data.map((project, idx) => {
        const barWidth = Math.max(
          (project.sessionCount / maxSessions) * 100,
          2
        );
        const color = PROJECT_COLORS[idx % PROJECT_COLORS.length];

        return (
          <VStack key={project.projectId} gap="xs" style={{ width: '100%' }}>
            <HStack justify="space-between" align="center">
              <Text
                size="sm"
                style={{
                  maxWidth: 200,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {project.projectName}
              </Text>
              <HStack gap="md" align="center">
                <Text size="sm" color="muted">
                  {project.taskCount} tasks
                </Text>
                <Text size="sm" weight="medium">
                  {project.sessionCount} sessions
                </Text>
              </HStack>
            </HStack>
            <Box
              style={{
                width: '100%',
                height: 8,
                backgroundColor: colors.bg.tertiary,
                borderRadius: 4,
                overflow: 'hidden',
              }}
            >
              <Box
                style={{
                  width: `${barWidth}%`,
                  height: '100%',
                  backgroundColor: color,
                  borderRadius: 4,
                  transition: 'width 0.3s ease',
                }}
              />
            </Box>
          </VStack>
        );
      })}
    </VStack>
  );
}
