/**
 * Time of Day Chart Component
 *
 * Bar chart showing activity distribution across hours of the day.
 * Uses circadian rhythm colors and fills full width of container.
 */

import type React from 'react';
import { useMemo } from 'react';
import { Box } from '@/components/atoms/Box.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { VStack } from '@/components/atoms/VStack.tsx';

interface HourlyActivity {
  readonly hour: number;
  readonly messageCount: number;
  readonly sessionCount: number;
}

interface TimeOfDayChartProps {
  hourlyActivity: ReadonlyArray<HourlyActivity>;
}

/**
 * Format hour for display (12-hour format)
 */
function formatHour(hour: number): string {
  if (hour === 0) return '12a';
  if (hour === 12) return '12p';
  if (hour < 12) return `${hour}a`;
  return `${hour - 12}p`;
}

/**
 * Circadian rhythm color palette
 * Colors reflect natural light patterns throughout the day
 */
const CIRCADIAN_COLORS = {
  // Night (10pm - 5am): Deep indigo/blue - darkness
  night: '#312e81',
  // Dawn (5am - 7am): Soft blue transitioning to light
  dawn: '#6366f1',
  // Morning (7am - 12pm): Warm golden/amber - sunrise energy
  morning: '#f59e0b',
  // Afternoon (12pm - 5pm): Bright yellow - peak sunlight
  afternoon: '#fbbf24',
  // Evening (5pm - 8pm): Warm orange/coral - sunset
  evening: '#f97316',
  // Dusk (8pm - 10pm): Purple/magenta - twilight
  dusk: '#c026d3',
};

/**
 * Get color for bar based on time of day using circadian rhythm
 */
function getBarColor(hour: number): string {
  // Night (10pm - 5am)
  if (hour >= 22 || hour < 5) return CIRCADIAN_COLORS.night;
  // Dawn (5am - 7am)
  if (hour >= 5 && hour < 7) return CIRCADIAN_COLORS.dawn;
  // Morning (7am - 12pm)
  if (hour >= 7 && hour < 12) return CIRCADIAN_COLORS.morning;
  // Afternoon (12pm - 5pm)
  if (hour >= 12 && hour < 17) return CIRCADIAN_COLORS.afternoon;
  // Evening (5pm - 8pm)
  if (hour >= 17 && hour < 20) return CIRCADIAN_COLORS.evening;
  // Dusk (8pm - 10pm)
  return CIRCADIAN_COLORS.dusk;
}

/**
 * Get label for time period
 */
function getTimePeriodLabel(hour: number): string {
  if (hour >= 22 || hour < 5) return 'Night';
  if (hour >= 5 && hour < 7) return 'Dawn';
  if (hour >= 7 && hour < 12) return 'Morning';
  if (hour >= 12 && hour < 17) return 'Afternoon';
  if (hour >= 17 && hour < 20) return 'Evening';
  return 'Dusk';
}

export function TimeOfDayChart({
  hourlyActivity,
}: TimeOfDayChartProps): React.ReactElement {
  // Calculate max for scaling
  const maxMessages = useMemo(() => {
    return Math.max(...hourlyActivity.map((h) => h.messageCount), 1);
  }, [hourlyActivity]);

  // Find peak hour
  const peakHour = useMemo(() => {
    let peak = hourlyActivity[0];
    for (const h of hourlyActivity) {
      if (h.messageCount > peak.messageCount) {
        peak = h;
      }
    }
    return peak;
  }, [hourlyActivity]);

  // Calculate period totals for circadian rhythm
  const periodTotals = useMemo(() => {
    const totals = {
      night: 0,
      dawn: 0,
      morning: 0,
      afternoon: 0,
      evening: 0,
      dusk: 0,
    };
    for (const h of hourlyActivity) {
      if (h.hour >= 22 || h.hour < 5) totals.night += h.messageCount;
      else if (h.hour >= 5 && h.hour < 7) totals.dawn += h.messageCount;
      else if (h.hour >= 7 && h.hour < 12) totals.morning += h.messageCount;
      else if (h.hour >= 12 && h.hour < 17) totals.afternoon += h.messageCount;
      else if (h.hour >= 17 && h.hour < 20) totals.evening += h.messageCount;
      else totals.dusk += h.messageCount;
    }
    return totals;
  }, [hourlyActivity]);

  const chartHeight = 100;

  return (
    <VStack gap="md" style={{ width: '100%' }}>
      {/* Peak hour indicator */}
      <HStack gap="lg">
        <VStack gap="xs">
          <Text color="secondary" size="xs">
            Peak Hour
          </Text>
          <HStack gap="xs" align="baseline">
            <Text weight="semibold" size="lg">
              {formatHour(peakHour.hour)}
            </Text>
            <Text color="muted" size="xs">
              ({getTimePeriodLabel(peakHour.hour)})
            </Text>
          </HStack>
        </VStack>
        <VStack gap="xs">
          <Text color="secondary" size="xs">
            Peak Activity
          </Text>
          <Text weight="semibold" size="lg">
            {peakHour.messageCount} messages
          </Text>
        </VStack>
      </HStack>

      {/* Bar chart - full width with flex */}
      <VStack gap="xs" style={{ width: '100%' }}>
        <HStack
          align="flex-end"
          style={{
            height: chartHeight,
            width: '100%',
          }}
        >
          {hourlyActivity.map((h) => {
            const barHeight = Math.max(
              (h.messageCount / maxMessages) * chartHeight,
              h.messageCount > 0 ? 4 : 2
            );
            return (
              <Box
                key={h.hour}
                style={{
                  flex: 1,
                  height: barHeight,
                  backgroundColor: getBarColor(h.hour),
                  borderRadius: 2,
                  opacity: h.messageCount > 0 ? 1 : 0.3,
                  marginHorizontal: 1,
                }}
              />
            );
          })}
        </HStack>

        {/* Hour labels below the chart */}
        <HStack style={{ width: '100%' }}>
          {hourlyActivity.map((h) => (
            <Box
              key={`label-${h.hour}`}
              style={{
                flex: 1,
                alignItems: 'center',
              }}
            >
              {h.hour % 3 === 0 && (
                <Text color="muted" size="xs">
                  {formatHour(h.hour)}
                </Text>
              )}
            </Box>
          ))}
        </HStack>
      </VStack>

      {/* Period legend - circadian rhythm */}
      <HStack gap="md" wrap>
        <HStack gap="xs" align="center">
          <Box
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '2px',
              backgroundColor: CIRCADIAN_COLORS.night,
            }}
          />
          <Text color="muted" size="xs">
            Night ({periodTotals.night})
          </Text>
        </HStack>
        <HStack gap="xs" align="center">
          <Box
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '2px',
              backgroundColor: CIRCADIAN_COLORS.dawn,
            }}
          />
          <Text color="muted" size="xs">
            Dawn ({periodTotals.dawn})
          </Text>
        </HStack>
        <HStack gap="xs" align="center">
          <Box
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '2px',
              backgroundColor: CIRCADIAN_COLORS.morning,
            }}
          />
          <Text color="muted" size="xs">
            Morning ({periodTotals.morning})
          </Text>
        </HStack>
        <HStack gap="xs" align="center">
          <Box
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '2px',
              backgroundColor: CIRCADIAN_COLORS.afternoon,
            }}
          />
          <Text color="muted" size="xs">
            Afternoon ({periodTotals.afternoon})
          </Text>
        </HStack>
        <HStack gap="xs" align="center">
          <Box
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '2px',
              backgroundColor: CIRCADIAN_COLORS.evening,
            }}
          />
          <Text color="muted" size="xs">
            Evening ({periodTotals.evening})
          </Text>
        </HStack>
        <HStack gap="xs" align="center">
          <Box
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '2px',
              backgroundColor: CIRCADIAN_COLORS.dusk,
            }}
          />
          <Text color="muted" size="xs">
            Dusk ({periodTotals.dusk})
          </Text>
        </HStack>
      </HStack>
    </VStack>
  );
}
