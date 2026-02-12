/**
 * View Toggle Component
 *
 * Toggle between "My Sessions" and "Team Sessions" views.
 * Only renders in hosted mode.
 */

import type React from 'react';
import { Box, HStack, Pressable, Text, theme } from '../atoms/index.ts';

export type ViewMode = 'personal' | 'team';

interface ViewToggleProps {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
}

/**
 * Toggle button for switching between personal and team views
 */
export function ViewToggle({
  value,
  onChange,
}: ViewToggleProps): React.ReactElement {
  return (
    <HStack
      style={{
        backgroundColor: theme.colors.bg.tertiary,
        borderRadius: theme.radii.md,
        padding: 2,
      }}
    >
      <Pressable onPress={() => onChange('personal')}>
        <Box
          style={{
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            borderRadius: theme.radii.sm,
            backgroundColor:
              value === 'personal'
                ? theme.colors.bg.primary
                : theme.colors.bg.tertiary,
          }}
        >
          <Text
            size="sm"
            weight={value === 'personal' ? 'medium' : 'normal'}
            style={{
              color:
                value === 'personal'
                  ? theme.colors.text.primary
                  : theme.colors.text.muted,
            }}
          >
            My Sessions
          </Text>
        </Box>
      </Pressable>
      <Pressable onPress={() => onChange('team')}>
        <Box
          style={{
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            borderRadius: theme.radii.sm,
            backgroundColor:
              value === 'team'
                ? theme.colors.bg.primary
                : theme.colors.bg.tertiary,
          }}
        >
          <Text
            size="sm"
            weight={value === 'team' ? 'medium' : 'normal'}
            style={{
              color:
                value === 'team'
                  ? theme.colors.text.primary
                  : theme.colors.text.muted,
            }}
          >
            Team Sessions
          </Text>
        </Box>
      </Pressable>
    </HStack>
  );
}
