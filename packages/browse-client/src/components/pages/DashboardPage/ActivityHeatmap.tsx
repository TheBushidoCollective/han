/**
 * Activity Heatmap Component
 *
 * GitHub-style contribution chart showing activity over the past year.
 * Each cell represents a day, with color intensity indicating activity level.
 */

import type React from 'react';
import { useMemo } from 'react';
import { theme } from '@/components/atoms';
import { Box } from '@/components/atoms/Box.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { VStack } from '@/components/atoms/VStack.tsx';

interface DailyActivity {
  readonly date: string;
  readonly messageCount: number;
  readonly sessionCount: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

interface ActivityHeatmapProps {
  dailyActivity: ReadonlyArray<DailyActivity>;
  streakDays: number;
  totalActiveDays: number;
}

// Claude orange color scale for activity levels
const COLORS = {
  empty: theme.colors.bg.tertiary,
  level1: '#4a2c1a', // Darkest orange
  level2: '#8b4a2a', // Dark orange
  level3: '#c96442', // Medium orange
  level4: '#da7756', // Claude orange
  level5: '#f5a580', // Bright orange
};

/**
 * Get color based on activity level
 */
function getActivityColor(messageCount: number, maxMessages: number): string {
  if (messageCount === 0) return COLORS.empty;
  const intensity = messageCount / maxMessages;
  if (intensity <= 0.2) return COLORS.level1;
  if (intensity <= 0.4) return COLORS.level2;
  if (intensity <= 0.6) return COLORS.level3;
  if (intensity <= 0.8) return COLORS.level4;
  return COLORS.level5;
}

/**
 * Format date for tooltip
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Organize daily activity into weeks (columns)
 */
function organizeIntoWeeks(
  dailyActivity: ReadonlyArray<DailyActivity>
): DailyActivity[][] {
  const weeks: DailyActivity[][] = [];

  for (let i = 0; i < dailyActivity.length; i += 7) {
    weeks.push(dailyActivity.slice(i, i + 7) as DailyActivity[]);
  }

  return weeks;
}

export function ActivityHeatmap({
  dailyActivity,
  streakDays,
  totalActiveDays,
}: ActivityHeatmapProps): React.ReactElement {
  // Calculate max messages for color scaling
  const maxMessages = useMemo(() => {
    return Math.max(...dailyActivity.map((d) => d.messageCount), 1);
  }, [dailyActivity]);

  // Organize into weeks (columns)
  const weeks = useMemo(
    () => organizeIntoWeeks(dailyActivity),
    [dailyActivity]
  );

  // Cell size for activity grid - balance between visibility and fitting data
  const cellSize = 12;
  const cellGap = 2;

  return (
    <VStack gap="sm">
      {/* Stats row */}
      <HStack gap="lg">
        <VStack gap="xs">
          <Text color="secondary" size="xs">
            Current Streak
          </Text>
          <Text weight="semibold" size="lg">
            {streakDays} days
          </Text>
        </VStack>
        <VStack gap="xs">
          <Text color="secondary" size="xs">
            Active Days
          </Text>
          <Text weight="semibold" size="lg">
            {totalActiveDays}
          </Text>
        </VStack>
      </HStack>

      {/* Year and month labels - shown above grid, right-aligned */}
      <HStack gap="sm" align="flex-start" style={{ width: '100%' }}>
        <Box style={{ width: '28px', flexShrink: 0 }} />
        <Box
          style={{
            display: 'flex',
            flexDirection: 'row',
            gap: `${cellGap}px`,
            overflow: 'hidden',
            flex: 1,
            minWidth: 0,
            justifyContent: 'flex-end',
          }}
        >
          {weeks.map((week, weekIdx) => {
            // Find if this week starts a new year or month
            const firstDay = week[0];
            if (!firstDay) return null;
            const date = new Date(firstDay.date);
            const monthLabel = date.toLocaleDateString('en-US', {
              month: 'short',
            });
            const yearLabel = date.getFullYear().toString();

            // Check if this is first week of data or new year/month
            const prevWeek = weeks[weekIdx - 1];
            const prevFirstDay = prevWeek?.[0];
            const isNewYear =
              !prevFirstDay ||
              new Date(prevFirstDay.date).getFullYear() !== date.getFullYear();
            const isNewMonth =
              !prevFirstDay ||
              new Date(prevFirstDay.date).getMonth() !== date.getMonth();

            return (
              <Box
                key={`label-${week[0]?.date ?? weekIdx}`}
                style={{
                  width: cellSize,
                  flexShrink: 0,
                  overflow: 'visible',
                }}
              >
                {isNewYear ? (
                  <Text
                    color="secondary"
                    size="xs"
                    style={{ fontWeight: 600, whiteSpace: 'nowrap' }}
                  >
                    {yearLabel}
                  </Text>
                ) : isNewMonth ? (
                  <Text
                    color="muted"
                    size="xs"
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {monthLabel}
                  </Text>
                ) : null}
              </Box>
            );
          })}
        </Box>
      </HStack>

      {/* Heatmap grid */}
      <HStack gap="sm" align="flex-start" style={{ width: '100%' }}>
        {/* Day labels */}
        <VStack
          gap="xs"
          style={{
            width: '28px',
            flexShrink: 0,
          }}
        >
          <Text
            color="muted"
            size="xs"
            style={{ height: `${cellSize}px`, lineHeight: `${cellSize}px` }}
          >
            {/* Empty for Sunday */}
          </Text>
          <Text
            color="muted"
            size="xs"
            style={{ height: `${cellSize}px`, lineHeight: `${cellSize}px` }}
          >
            Mon
          </Text>
          <Text
            color="muted"
            size="xs"
            style={{ height: `${cellSize}px`, lineHeight: `${cellSize}px` }}
          >
            {/* Empty for Tuesday */}
          </Text>
          <Text
            color="muted"
            size="xs"
            style={{ height: `${cellSize}px`, lineHeight: `${cellSize}px` }}
          >
            Wed
          </Text>
          <Text
            color="muted"
            size="xs"
            style={{ height: `${cellSize}px`, lineHeight: `${cellSize}px` }}
          >
            {/* Empty for Thursday */}
          </Text>
          <Text
            color="muted"
            size="xs"
            style={{ height: `${cellSize}px`, lineHeight: `${cellSize}px` }}
          >
            Fri
          </Text>
          <Text
            color="muted"
            size="xs"
            style={{ height: `${cellSize}px`, lineHeight: `${cellSize}px` }}
          >
            {/* Empty for Saturday */}
          </Text>
        </VStack>

        {/* Grid of weeks - most recent on right, no scrollbar */}
        <Box
          style={{
            display: 'flex',
            flexDirection: 'row',
            gap: `${cellGap}px`,
            overflow: 'hidden',
            paddingBottom: 4,
            flex: 1,
            minWidth: 0,
            justifyContent: 'flex-end',
          }}
        >
          {weeks.map((week) => (
            <Box
              key={`week-${week[0]?.date ?? 'empty'}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: `${cellGap}px`,
                flexShrink: 0,
              }}
            >
              {week.map((day) => (
                <div
                  key={day.date}
                  role="img"
                  aria-label={`${formatDate(day.date)}: ${day.messageCount} messages, ${day.sessionCount} sessions`}
                  title={`${formatDate(day.date)}: ${day.messageCount} messages, ${day.sessionCount} sessions`}
                  style={{
                    width: `${cellSize}px`,
                    height: `${cellSize}px`,
                    borderRadius: '2px',
                    backgroundColor: getActivityColor(
                      day.messageCount,
                      maxMessages
                    ),
                    cursor: 'default',
                  }}
                />
              ))}
            </Box>
          ))}
        </Box>
      </HStack>

      {/* Legend */}
      <HStack gap="sm" align="center" style={{ paddingLeft: '32px' }}>
        <Text color="muted" size="xs">
          Less
        </Text>
        {[
          COLORS.empty,
          COLORS.level1,
          COLORS.level2,
          COLORS.level3,
          COLORS.level4,
          COLORS.level5,
        ].map((color) => (
          <Box
            key={color}
            style={{
              width: `${cellSize}px`,
              height: `${cellSize}px`,
              borderRadius: '2px',
              backgroundColor: color,
            }}
          />
        ))}
        <Text color="muted" size="xs">
          More
        </Text>
      </HStack>
    </VStack>
  );
}
