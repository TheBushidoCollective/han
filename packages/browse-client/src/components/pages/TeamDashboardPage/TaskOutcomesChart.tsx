/**
 * Task Outcomes Chart
 *
 * Donut chart showing task outcome distribution (success/partial/failure).
 */

import type React from 'react';
import { useMemo } from 'react';
import { Box } from '@/components/atoms/Box.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { VStack } from '@/components/atoms/VStack.tsx';

interface TaskOutcomesChartProps {
  successCount: number;
  partialCount: number;
  failureCount: number;
}

// Outcome colors
const OUTCOME_COLORS = {
  success: '#10b981', // Green
  partial: '#f59e0b', // Amber
  failure: '#ef4444', // Red
};

export function TaskOutcomesChart({
  successCount,
  partialCount,
  failureCount,
}: TaskOutcomesChartProps): React.ReactElement {
  const total = successCount + partialCount + failureCount;

  // Calculate percentages
  const { successPct, partialPct, failurePct } = useMemo(() => {
    if (total === 0) {
      return { successPct: 0, partialPct: 0, failurePct: 0 };
    }
    return {
      successPct: (successCount / total) * 100,
      partialPct: (partialCount / total) * 100,
      failurePct: (failureCount / total) * 100,
    };
  }, [successCount, partialCount, failureCount, total]);

  // Calculate stroke dash arrays for donut segments
  const circumference = 2 * Math.PI * 40; // radius = 40

  const successDash = (successPct / 100) * circumference;
  const partialDash = (partialPct / 100) * circumference;
  const failureDash = (failurePct / 100) * circumference;

  const successOffset = 0;
  const partialOffset = -successDash;
  const failureOffset = -(successDash + partialDash);

  if (total === 0) {
    return (
      <VStack
        gap="md"
        align="center"
        justify="center"
        style={{ minHeight: 180 }}
      >
        <Text color="muted" size="sm">
          No task data available
        </Text>
      </VStack>
    );
  }

  return (
    <VStack gap="md" align="center" style={{ width: '100%' }}>
      {/* Donut Chart */}
      <Box style={{ position: 'relative', width: 120, height: 120 }}>
        <svg
          width="120"
          height="120"
          viewBox="0 0 100 100"
          style={{ transform: 'rotate(-90deg)' }}
          role="img"
          aria-label="Task outcomes donut chart"
        >
          <title>Task Outcomes</title>
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="#374151"
            strokeWidth="12"
          />
          {/* Success segment */}
          {successPct > 0 && (
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke={OUTCOME_COLORS.success}
              strokeWidth="12"
              strokeDasharray={`${successDash} ${circumference - successDash}`}
              strokeDashoffset={successOffset}
            />
          )}
          {/* Partial segment */}
          {partialPct > 0 && (
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke={OUTCOME_COLORS.partial}
              strokeWidth="12"
              strokeDasharray={`${partialDash} ${circumference - partialDash}`}
              strokeDashoffset={partialOffset}
            />
          )}
          {/* Failure segment */}
          {failurePct > 0 && (
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke={OUTCOME_COLORS.failure}
              strokeWidth="12"
              strokeDasharray={`${failureDash} ${circumference - failureDash}`}
              strokeDashoffset={failureOffset}
            />
          )}
        </svg>
        {/* Center text */}
        <Box
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <VStack gap="xs" align="center">
            <Text weight="bold" size="lg">
              {total}
            </Text>
            <Text color="muted" size="xs">
              Total
            </Text>
          </VStack>
        </Box>
      </Box>

      {/* Legend */}
      <VStack gap="sm" style={{ width: '100%' }}>
        <HStack justify="space-between" align="center">
          <HStack gap="xs" align="center">
            <Box
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                backgroundColor: OUTCOME_COLORS.success,
              }}
            />
            <Text size="sm">Success</Text>
          </HStack>
          <Text size="sm" weight="medium">
            {successCount} ({Math.round(successPct)}%)
          </Text>
        </HStack>
        <HStack justify="space-between" align="center">
          <HStack gap="xs" align="center">
            <Box
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                backgroundColor: OUTCOME_COLORS.partial,
              }}
            />
            <Text size="sm">Partial</Text>
          </HStack>
          <Text size="sm" weight="medium">
            {partialCount} ({Math.round(partialPct)}%)
          </Text>
        </HStack>
        <HStack justify="space-between" align="center">
          <HStack gap="xs" align="center">
            <Box
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                backgroundColor: OUTCOME_COLORS.failure,
              }}
            />
            <Text size="sm">Failure</Text>
          </HStack>
          <Text size="sm" weight="medium">
            {failureCount} ({Math.round(failurePct)}%)
          </Text>
        </HStack>
      </VStack>
    </VStack>
  );
}
