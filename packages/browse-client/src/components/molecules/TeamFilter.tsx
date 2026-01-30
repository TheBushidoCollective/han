/**
 * Team Filter Component
 *
 * Filter bar for team sessions with user and date range filters.
 * Only renders in hosted mode.
 */

import type React from 'react';
import { useState } from 'react';
import type { DateRange, TeamMember } from '../../types/auth.ts';
import { Box, HStack, Input, Pressable, Text, theme, VStack } from '../atoms/index.ts';

interface TeamFilterProps {
  members: TeamMember[];
  selectedUserId: string | null;
  onUserChange: (userId: string | null) => void;
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
}

/**
 * Member selector dropdown
 */
function MemberSelector({
  members,
  selectedUserId,
  onSelect,
}: {
  members: TeamMember[];
  selectedUserId: string | null;
  onSelect: (userId: string | null) => void;
}): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const selectedMember = members.find((m) => m.userId === selectedUserId);

  return (
    <Box style={{ position: 'relative' }}>
      <Pressable onPress={() => setIsOpen(!isOpen)}>
        <Box
          style={{
            padding: theme.spacing.sm,
            paddingHorizontal: theme.spacing.md,
            backgroundColor: theme.colors.bg.tertiary,
            borderRadius: theme.radii.md,
            borderWidth: 1,
            borderColor: theme.colors.border.default,
            minWidth: 150,
          }}
        >
          <HStack justify="space-between" align="center">
            <Text size="sm">
              {selectedMember ? selectedMember.user.name : 'All Members'}
            </Text>
            <Text size="xs" color="muted">
              {isOpen ? '\u25B2' : '\u25BC'}
            </Text>
          </HStack>
        </Box>
      </Pressable>

      {isOpen && (
        <Box
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: theme.spacing.xs,
            backgroundColor: theme.colors.bg.secondary,
            borderRadius: theme.radii.md,
            borderWidth: 1,
            borderColor: theme.colors.border.default,
            zIndex: 100,
            maxHeight: 200,
            overflow: 'auto',
          }}
        >
          <Pressable
            onPress={() => {
              onSelect(null);
              setIsOpen(false);
            }}
          >
            <Box
              style={{
                padding: theme.spacing.sm,
                paddingHorizontal: theme.spacing.md,
                backgroundColor:
                  selectedUserId === null
                    ? theme.colors.bg.hover
                    : 'transparent',
              }}
            >
              <Text size="sm">All Members</Text>
            </Box>
          </Pressable>
          {members.map((member) => (
            <Pressable
              key={member.userId}
              onPress={() => {
                onSelect(member.userId);
                setIsOpen(false);
              }}
            >
              <Box
                style={{
                  padding: theme.spacing.sm,
                  paddingHorizontal: theme.spacing.md,
                  backgroundColor:
                    selectedUserId === member.userId
                      ? theme.colors.bg.hover
                      : 'transparent',
                }}
              >
                <Text size="sm">{member.user.name}</Text>
              </Box>
            </Pressable>
          ))}
        </Box>
      )}
    </Box>
  );
}

/**
 * Team filter bar with member and date range filters
 */
export function TeamFilter({
  members,
  selectedUserId,
  onUserChange,
  dateRange,
  onDateRangeChange,
}: TeamFilterProps): React.ReactElement {
  return (
    <HStack gap="md" align="center" style={{ flexWrap: 'wrap' }}>
      <VStack gap="xs">
        <Text size="xs" color="muted">
          Team Member
        </Text>
        <MemberSelector
          members={members}
          selectedUserId={selectedUserId}
          onSelect={onUserChange}
        />
      </VStack>

      <VStack gap="xs">
        <Text size="xs" color="muted">
          From
        </Text>
        <Input
          placeholder="Start date"
          value={dateRange.start ?? ''}
          onChange={(value) =>
            onDateRangeChange({ ...dateRange, start: value || null })
          }
          style={{ width: 130 }}
        />
      </VStack>

      <VStack gap="xs">
        <Text size="xs" color="muted">
          To
        </Text>
        <Input
          placeholder="End date"
          value={dateRange.end ?? ''}
          onChange={(value) =>
            onDateRangeChange({ ...dateRange, end: value || null })
          }
          style={{ width: 130 }}
        />
      </VStack>

      {(selectedUserId || dateRange.start || dateRange.end) && (
        <Pressable
          onPress={() => {
            onUserChange(null);
            onDateRangeChange({ start: null, end: null });
          }}
        >
          <Box
            style={{
              padding: theme.spacing.sm,
              paddingHorizontal: theme.spacing.md,
              backgroundColor: theme.colors.bg.tertiary,
              borderRadius: theme.radii.md,
              marginTop: theme.spacing.lg,
            }}
          >
            <Text size="sm" color="muted">
              Clear Filters
            </Text>
          </Box>
        </Pressable>
      )}
    </HStack>
  );
}
